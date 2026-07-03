package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingProfitAsinMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProfitAsin;
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

/**
 * 领星利润统计-ASIN 同步服务。
 *
 * 手动触发：按 店铺集合 + 时间窗（≤7天）分页拉取 profit/statistics/open/asin/list →
 * 返回按 dataDate 逐日一行 → 少量结构化列 + raw_json 双写 →
 * 按业务键（asin|sid|dataDate|currency）幂等 upsert。
 *
 * 约束（文档）：startDate~endDate 跨度 ≤ 7 天；令牌桶容量 10。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingProfitAsinSyncService {

    private static final String PATH = "/bd/profit/statistics/open/asin/list";
    private static final int PAGE_SIZE = 1000;          // 文档上限 10000，保守 1000
    private static final int MAX_PAGES = 1000;
    private static final int MAX_SPAN_DAYS = 7;
    private static final int DB_BATCH_SIZE = 500;

    private final LingxingClient client;
    private final LingxingProfitAsinMapper mapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 同步利润统计-ASIN。
     *
     * @param sids         店铺 ID 列表（可空，空则拉全部有权限店铺）
     * @param startDate    时间窗开始 YYYY-MM-DD（与结束跨度 ≤ 7 天）
     * @param endDate      时间窗结束 YYYY-MM-DD
     * @param currencyCode 币种 code（可空）
     * @return 同步结果统计 {pages, fetched, upserted}
     */
    public Map<String, Object> sync(List<Long> sids, String startDate, String endDate, String currencyCode) {
        validateSpan(startDate, endDate, MAX_SPAN_DAYS);

        int offset = 0;
        int pages = 0;
        int fetched = 0;
        int upserted = 0;

        for (int p = 0; p < MAX_PAGES; p++) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", offset);
            body.put("length", PAGE_SIZE);
            body.put("startDate", startDate);
            body.put("endDate", endDate);
            if (sids != null && !sids.isEmpty()) {
                ArrayNode sidArr = body.putArray("sids");
                sids.forEach(sidArr::add);
            }
            if (currencyCode != null && !currencyCode.isBlank()) {
                body.put("currencyCode", currencyCode);
            }

            JsonNode resp = client.post(PATH, body);
            JsonNode records = resp.path("data").path("records");
            if (!records.isArray() || records.isEmpty()) break;

            pages++;
            List<LingxingProfitAsin> entities = new ArrayList<>(records.size());
            for (JsonNode row : records) {
                LingxingProfitAsin e = mapRow(row, currencyCode);
                if (e.getBizKey() == null) continue;
                LingxingProfitAsin existing = mapper.selectOne(
                        new LambdaQueryWrapper<LingxingProfitAsin>()
                                .eq(LingxingProfitAsin::getBizKey, e.getBizKey())
                                .last("LIMIT 1"));
                if (existing != null) e.setId(existing.getId());
                entities.add(e);
            }
            if (!entities.isEmpty()) {
                Db.saveOrUpdateBatch(entities, DB_BATCH_SIZE);
                upserted += entities.size();
            }
            fetched += records.size();

            if (records.size() < PAGE_SIZE) break;
            offset += PAGE_SIZE;
            sleep(500L); // 令牌桶容量 10，翻页轻限流即可
        }

        log.info("领星利润统计-ASIN 同步完成：{} 页 / 拉取 {} 条 / upsert {} 条（窗口 {}~{}）",
                pages, fetched, upserted, startDate, endDate);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("pages", pages);
        r.put("fetched", fetched);
        r.put("upserted", upserted);
        return r;
    }

    private LingxingProfitAsin mapRow(JsonNode row, String currencyCode) {
        LingxingProfitAsin e = new LingxingProfitAsin();
        String asin = asText(row, "asin");
        String sid = asText(row, "sid");
        String dataDate = asText(row, "dataDate");
        String currency = (currencyCode != null && !currencyCode.isBlank())
                ? currencyCode : trim(asText(row, "currencyCode"));

        e.setAsin(asin);
        e.setParentAsin(asText(row, "parentAsin"));
        e.setSid(sid);
        e.setStoreName(asText(row, "storeName"));
        e.setDataDate(dataDate != null ? LocalDate.parse(dataDate) : null);
        e.setCountryCode(trim(asText(row, "countryCode")));
        e.setLocalSku(asText(row, "localSku"));
        e.setLocalName(asText(row, "localName"));
        e.setItemName(asText(row, "itemName"));
        e.setCurrencyCode(currency);

        e.setTotalSalesQuantity(asInt(row, "totalSalesQuantity"));
        e.setTotalSalesAmount(asDecimal(row, "totalSalesAmount"));
        e.setTotalAdsCost(asDecimal(row, "totalAdsCost"));
        e.setCgPrice(asDecimal(row, "cgPrice"));
        e.setCgTransportCosts(asDecimal(row, "cgTransportCosts"));
        e.setTotalCost(asDecimal(row, "totalCost"));
        e.setGrossProfit(asDecimal(row, "grossProfit"));
        e.setGrossRate(asDecimal(row, "grossRate"));

        e.setRawJson(row.toString());
        e.setSyncedAt(LocalDateTime.now());

        // 业务幂等键：asin|sid|dataDate|currency（逐日唯一）
        if (asin != null && dataDate != null) {
            e.setBizKey(asin + "|" + safe(sid) + "|" + dataDate + "|" + safe(currency));
        }
        return e;
    }

    // ---------- 工具 ----------

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

    /** 领星部分字段带尾随空格（如 "USD  "），入库前 trim */
    private String trim(String s) {
        return s == null ? null : s.trim();
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
