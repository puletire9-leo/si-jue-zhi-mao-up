package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingProductPerformanceMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformance;
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
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingProductPerformanceSyncService {

    private static final String PATH = "/bd/productPerformance/openApi/asinList";
    private static final int PAGE_SIZE = 1000;          // 文档上限 10000，保守取 1000
    private static final int MAX_PAGES = 1000;
    private static final int MAX_SPAN_DAYS = 92;
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingProductPerformanceMapper mapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 同步产品表现。
     *
     * @param sids         店铺 ID 列表（必填，上限 200）
     * @param startDate    时间窗开始 YYYY-MM-DD（与结束跨度 ≤ 92 天）
     * @param endDate      时间窗结束 YYYY-MM-DD
     * @param summaryField 汇总维度 asin/parent_asin/msku/sku（默认 asin）
     * @param currencyCode 币种 USD/CNY（可空，空为原币种）
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
        String summary = (summaryField == null || summaryField.isBlank()) ? "asin" : summaryField;
        // 店铺集合排序后拼接，作为业务键的一部分（同一集合聚合为一行口径）
        String sidScope = sids.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));

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
            if (currencyCode != null && !currencyCode.isBlank()) {
                body.put("currency_code", currencyCode);
            }

            JsonNode resp = client.post(PATH, body);
            JsonNode list = resp.path("data").path("list");
            if (!list.isArray() || list.isEmpty()) break;

            pages++;
            for (JsonNode row : list) {
                LingxingProductPerformance e = mapRow(row, summary, sidScope, startDate, endDate, currencyCode);
                if (e.getId() == null) e.setId(com.baomidou.mybatisplus.core.toolkit.IdWorker.getId());
                mapper.upsert(e);
                upserted++;
            }
            fetched += list.size();

            if (list.size() < PAGE_SIZE) break;
            offset += PAGE_SIZE;
            // 令牌桶容量 1：多店铺间隔 10s，单店铺 1s（文档限流规则）
            sleep(sids.size() > 1 ? 10_000L : 1_000L);
        }

        log.info("领星产品表现同步完成：{} 页 / 拉取 {} 条 / upsert {} 条（summary={}, 窗口 {}~{}）",
                pages, fetched, upserted, summary, startDate, endDate);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pages", pages);
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
    }

    private LingxingProductPerformance mapRow(JsonNode row, String summary, String sidScope,
                                              String startDate, String endDate, String currencyCode) {
        LingxingProductPerformance e = new LingxingProductPerformance();
        e.setSummaryField(summary);
        // 治本：sid_scope 用行内实际 sid，不用请求参数 —— 领星按 asin 汇总时每行只归属单店铺（raw_json.sids）；
        // 用请求参数会导致同一店铺的同一 ASIN 在不同查询批次下产生不同 biz_key、重复入库。
        String rowSids = extractRowSids(row);
        String effectiveSidScope = rowSids == null || rowSids.isEmpty() ? sidScope : rowSids;
        e.setSidScope(effectiveSidScope);
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

        String currency = (currencyCode != null && !currencyCode.isBlank())
                ? currencyCode : asText(row, "currency_code");
        e.setCurrencyCode(currency);

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

        // 业务幂等键：维度值 + 店铺集合 + 时间窗 + 币种；用 SHA-256 避免多店铺 sid 拼接超过唯一键前缀长度
        String rawKey = summary + ":" + safe(summaryValue) + "|" + effectiveSidScope + "|"
                + startDate + "|" + endDate + "|" + safe(currency);
        e.setBizKey(sha256(rawKey));
        return e;
    }

    private String sha256(String s) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new RuntimeException("SHA-256 计算失败", ex);
        }
    }

    // ---------- 工具 ----------

    /** 取行内实际 sid 集合（raw_json.sids 是每行归属店铺），排序后逗号拼接。 */
    private String extractRowSids(JsonNode row) {
        JsonNode arr = row.path("sids");
        if (arr == null || !arr.isArray() || arr.isEmpty()) return null;
        List<Long> sids = new ArrayList<>(arr.size());
        arr.forEach(n -> {
            if (n.isNumber()) sids.add(n.asLong());
            else {
                try { sids.add(Long.parseLong(n.asText())); } catch (NumberFormatException ignored) {}
            }
        });
        java.util.Collections.sort(sids);
        return sids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

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
}
