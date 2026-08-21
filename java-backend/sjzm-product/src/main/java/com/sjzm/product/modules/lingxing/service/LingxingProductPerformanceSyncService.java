package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 领星产品表现同步服务。
 *
 * 手动触发：按 店铺集合 + 时间窗 + 汇总维度 分页拉取 productPerformance/asinList →
 * 少量结构化列 + raw_json 双写 → 按业务键（维度值+店铺集合+时间窗+币种）幂等 upsert。
 *
 * 约束（文档）：时间窗 ≤ 92 天；sid 必填、上限 200；令牌桶容量 1（串行 + 翻页限流）。
 *
 * <p>2026-07 清理废弃端点时误删本链路，2026-07-30 按 git d4d9650 蓝本恢复，
 * 用于 {@link LingxingScheduledSyncService} 每周自动同步。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingProductPerformanceSyncService {

    private static final String PATH = "/bd/productPerformance/openApi/asinList";
    private static final String REPORTING_CURRENCY = "GBP";
    private static final int PAGE_SIZE = 1000;          // 文档上限 10000，保守取 1000
    private static final int MAX_PAGES = 1000;
    private static final int MAX_SPAN_DAYS = 92;
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingProductPerformanceMapper mapper;
    private final RdsBatchWriteService rdsBatchWriteService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 同步产品表现。
     *
     * @param sids         店铺 ID 列表（必填，上限 200）
     * @param startDate    时间窗开始 YYYY-MM-DD（与结束跨度 ≤ 92 天）
     * @param endDate      时间窗结束 YYYY-MM-DD
     * @param summaryField 汇总维度 asin/parent_asin/msku/sku（默认 asin）
     * @param currencyCode 仅允许 GBP；可空，空值也按 GBP 请求
     * @return 同步结果统计 {pages, fetched, upserted}
     */
    public Map<String, Object> sync(List<Long> sids, String startDate, String endDate,
                                    String summaryField, String currencyCode) {
        if (sids == null || sids.isEmpty()) {
            throw new IllegalArgumentException("sids 必填：请先同步领星店铺并选择店铺");
        }
        if (sids.size() > 200) {
            throw new IllegalArgumentException("sid 上限 200，当前 " + sids.size());
        }
        validateSpan(startDate, endDate, MAX_SPAN_DAYS);
        String normalizedCurrency = normalizeCurrency(currencyCode);
        String summary = (summaryField == null || summaryField.isBlank()) ? "asin" : summaryField;
        // 店铺集合排序后拼接，作为业务键的一部分（同一集合聚合为一行口径）。
        // 多店铺时拼接串很长会撑爆 biz_key/sid_scope 列，超过阈值改用 SHA-256 摘要（定长、稳定）。
        String rawScope = sids.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
        String sidScope = rawScope.length() <= 200 ? rawScope : "sha256:" + sha256(rawScope);

        int offset = 0;
        int pages = 0;
        int fetched = 0;
        int upserted = 0;

        for (int p = 0; p < MAX_PAGES; p++) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", offset);
            body.put("length", PAGE_SIZE);
            body.put("sort_field", "volume");
            body.put("sort_type", "desc");
            body.put("summary_field", summary);
            ArrayNode sidArr = body.putArray("sid");
            sids.forEach(sidArr::add);
            body.put("start_date", startDate);
            body.put("end_date", endDate);
            body.put("currency_code", normalizedCurrency);

            JsonNode resp = client.post(PATH, body);
            JsonNode list = resp.path("data").path("list");
            if (!list.isArray() || list.isEmpty()) break;

            pages++;
            // 按 bizKey 去重：多店铺聚合时 API 偶发返回重复 msku 行，同批 insert 会撞 uk_biz_key
            Map<String, LingxingProductPerformance> byKey = new LinkedHashMap<>();
            for (JsonNode row : list) {
                validateResponseCurrency(row);
                LingxingProductPerformance e = mapRow(row, summary, sidScope, startDate, endDate, normalizedCurrency);
                if (e.getBizKey() == null || e.getBizKey().isBlank()) continue;
                byKey.put(e.getBizKey(), e); // 后写覆盖前写
            }
            Map<String, Long> existingIds = byKey.isEmpty() ? Map.of() : mapper.selectList(
                                    new LambdaQueryWrapper<LingxingProductPerformance>()
                                            .select(LingxingProductPerformance::getId,
                                                    LingxingProductPerformance::getBizKey)
                                            .in(LingxingProductPerformance::getBizKey, byKey.keySet()))
                            .stream().collect(Collectors.toMap(
                                    LingxingProductPerformance::getBizKey,
                                    LingxingProductPerformance::getId,
                                    (left, right) -> left));
            List<LingxingProductPerformance> entities = new ArrayList<>(byKey.values());
            entities.forEach(entity -> entity.setId(existingIds.get(entity.getBizKey())));
            if (!entities.isEmpty()) {
                upserted += rdsBatchWriteService.saveOrUpdate(
                        LingxingProductPerformanceMapper.class, entities, DB_BATCH_SIZE,
                        entity -> entity.getId() != null);
            }
            fetched += list.size();

            if (list.size() < PAGE_SIZE) break;
            offset += PAGE_SIZE;
            // 正式全页请求保持已验证成功的业务节奏；客户端时间轴负责跨入口兜底。
            sleep(sids.size() > 1 ? 10_000L : 1_000L);
        }

        log.info("领星产品表现同步完成：{} 页 / 拉取 {} 条 / upsert {} 条（summary={}, 窗口 {}~{}）",
                pages, fetched, upserted, summary, startDate, endDate);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pages", pages);
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        r.put("currencyCode", normalizedCurrency);
        return r;
    }

    private String normalizeCurrency(String currencyCode) {
        if (currencyCode == null || currencyCode.isBlank()) {
            return REPORTING_CURRENCY;
        }
        String normalized = currencyCode.trim().toUpperCase(java.util.Locale.ROOT);
        if (!REPORTING_CURRENCY.equals(normalized)) {
            throw new IllegalArgumentException("领星产品表现统一使用 GBP，拒绝币种: " + normalized);
        }
        return normalized;
    }

    private void validateResponseCurrency(JsonNode row) {
        String responseCurrency = asText(row, "currency_code");
        if (responseCurrency != null && !REPORTING_CURRENCY.equalsIgnoreCase(responseCurrency.trim())) {
            throw new IllegalStateException("领星产品表现返回非 GBP 数据，拒绝入库: " + responseCurrency);
        }
    }

    private LingxingProductPerformance mapRow(JsonNode row, String summary, String sidScope,
                                              String startDate, String endDate, String currencyCode) {
        LingxingProductPerformance e = new LingxingProductPerformance();
        e.setSummaryField(summary);
        e.setSidScope(sidScope);
        e.setStartDate(LocalDate.parse(startDate));
        e.setEndDate(LocalDate.parse(endDate));

        // 维度值：从 asins/parent_asins/price_list 里按 summary 取
        String asin = firstNested(row, "asins", "asin");
        String parentAsin = firstNested(row, "parent_asins", "parent_asin");
        String msku = firstNested(row, "price_list", "seller_sku");
        String sku = firstNested(row, "price_list", "local_sku");
        e.setAsin(asin);
        e.setParentAsin(parentAsin);
        e.setMsku(msku);
        e.setSku(sku);
        e.setItemName(asText(row, "item_name"));

        e.setCurrencyCode(currencyCode);

        String summaryValue = switch (summary) {
            case "parent_asin" -> parentAsin;
            case "msku" -> msku;
            case "sku" -> sku;
            default -> asin;
        };
        e.setSummaryValue(summaryValue);

        e.setVolume(asInt(row, "volume"));
        e.setOrderItems(asInt(row, "order_items"));
        e.setAmount(asDecimal(row, "amount"));
        e.setGrossProfit(asDecimal(row, "gross_profit"));
        e.setGrossMargin(asDecimal(row, "gross_margin"));
        e.setSessionsTotal(asInt(row, "sessions_total"));
        e.setSpend(asDecimal(row, "spend"));
        e.setTacos(asDecimal(row, "tacos"));

        e.setRawJson(row.toString());
        e.setSyncedAt(LocalDateTime.now());

        // 业务幂等键：维度值 + 店铺集合 + 时间窗 + 币种
        // 列长 varchar(255)：超长时整键 SHA-256，避免截断导致假撞键
        String fullKey = summary + ":" + safe(summaryValue) + "|" + sidScope + "|"
                + startDate + "|" + endDate + "|" + safe(currencyCode);
        e.setBizKey(fullKey.length() <= 250 ? fullKey : "sha256:" + sha256(fullKey));
        return e;
    }

    // ---------- 工具 ----------

    /** 取数组首元素的某字段（如 asins[0].asin） */
    private String firstNested(JsonNode row, String arrKey, String field) {
        JsonNode arr = row.path(arrKey);
        if (arr.isArray() && !arr.isEmpty()) {
            String v = arr.get(0).path(field).asText("");
            return v.isEmpty() ? null : v;
        }
        return null;
    }

    private void validateSpan(String start, String end, int maxDays) {
        LocalDate s = LocalDate.parse(start);
        LocalDate e = LocalDate.parse(end);
        if (e.isBefore(s)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        long span = ChronoUnit.DAYS.between(s, e) + 1; // 双闭区间
        if (span > maxDays) {
            throw new IllegalArgumentException("时间窗跨度 " + span + " 天，超过上限 " + maxDays + " 天");
        }
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private String asText(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("");
        return v.isEmpty() ? null : v;
    }

    private Integer asInt(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return (int) Double.parseDouble(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private BigDecimal asDecimal(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** SHA-256 十六进制摘要（sidScope 过长时定长化，防撑爆 biz_key/sid_scope 列）。 */
    private String sha256(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(d.length * 2);
            for (byte b : d) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString();
        } catch (Exception e) {
            // 摘要失败极罕见，退化用长度+hashCode 兜底（仍定长）
            return "len" + s.length() + "_" + Integer.toHexString(s.hashCode());
        }
    }
}
