package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.mapper.LingxingDeveloperSkuPrefixMapper;
import com.sjzm.product.mapper.LingxingInventoryBatchMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingDeveloperSkuPrefix;
import com.sjzm.product.modules.lingxing.entity.LingxingInventoryBatchDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;

import java.time.LocalDate;
import java.util.*;

/**
 * Daily sync of Lingxing inventory batch detail (getBatchDetailList).
 *
 * <p>Flow: full paginated pull (stock_in_type_list=22 采购入库 only)
 * → match SKU prefix to developer → upsert into lingxing_inventory_batch_detail.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingInventoryBatchService {

    private static final String BATCH_DETAIL_PATH = "/erp/sc/routing/data/local_inventory/getBatchDetailList";
    private static final int PAGE_SIZE = 400;
    private static final int MAX_PAGES = 1000;

    private final LingxingClient client;
    private final LingxingInventoryBatchMapper batchMapper;
    private final LingxingDeveloperSkuPrefixMapper prefixMapper;
    private final LingxingSkuDataLayerMapper runMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Execute one full daily sync.
     *
     * @param developerFilter optional developer filter (null = all)
     * @return summary map
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> syncDaily(String developerFilter) {
        String runId = "inventory-batch-daily-" + System.currentTimeMillis();
        String today = LocalDate.now().toString();
        runMapper.beginRun(runId, "INVENTORY_BATCH_DAILY", null,
                today, today, null, null,
                "{\"developer\":" + (developerFilter != null ? "\"" + developerFilter + "\"" : "null") + "}");

        // 1. Load developer prefix map (prefix → list of developer names)
        List<LingxingDeveloperSkuPrefix> allPrefixes = prefixMapper.selectAllPrefixes();
        Map<String, List<String>> prefixToDevs = new LinkedHashMap<>();
        for (LingxingDeveloperSkuPrefix p : allPrefixes) {
            String prefix = p.getSkuPrefix();
            if (prefix == null || prefix.isEmpty()) continue;
            prefixToDevs.computeIfAbsent(prefix, k -> new ArrayList<>()).add(p.getDeveloper());
        }
        log.info("库存批次同步：加载 {} 个前缀映射（{} 个唯一前缀）",
                allPrefixes.size(), prefixToDevs.size());

        if (prefixToDevs.isEmpty()) {
            runMapper.finishRun(runId, "SUCCESS", 0, "无前缀映射，跳过");
            return Map.of("runId", runId, "fetched", 0, "upserted", 0, "skippedNoPrefix", 0);
        }

        // 2. Paginated pull from Lingxing API
        int totalFetched = 0;
        int totalUpserted = 0;
        int skippedNoPrefix = 0;
        int pages = 0;

        for (int offset = 0; pages < MAX_PAGES; offset += PAGE_SIZE) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("offset", offset);
            body.put("length", PAGE_SIZE);
            body.put("show_zero_stock", 1);
            body.put("stock_in_type_list", "22"); // 只取采购入库

            JsonNode resp = client.post(BATCH_DETAIL_PATH, body);
            JsonNode data = resp.path("data");
            if (!data.isArray() || data.isEmpty()) break;

            pages++;
            int batchFetched = data.size();
            int batchUpserted = 0;
            int batchSkipped = 0;

            // 3. Match prefix → upsert
            for (JsonNode row : data) {
                String sku = row.path("sku").asText(null);
                String batchNo = row.path("batch_no").asText(null);
                if (sku == null || sku.isEmpty() || batchNo == null || batchNo.isEmpty()) {
                    continue;
                }

                // Extract prefix (first 3 chars)
                String skuPrefix = sku.length() >= 3 ? sku.substring(0, 3) : sku;
                List<String> developers = prefixToDevs.get(skuPrefix);
                if (developers == null || developers.isEmpty()) {
                    skippedNoPrefix++;
                    batchSkipped++;
                    continue;
                }

                // Filter by developer if specified
                String matchedDev = developers.get(0);
                if (developerFilter != null && !developerFilter.isEmpty()) {
                    if (!developers.contains(developerFilter)) {
                        batchSkipped++;
                        continue;
                    }
                    matchedDev = developerFilter;
                }

                LingxingInventoryBatchDetail detail = new LingxingInventoryBatchDetail();
                detail.setBizKey(null); // generated by INSERT SQL
                detail.setBatchNo(batchNo);
                detail.setSku(sku);
                detail.setDeveloper(matchedDev);
                detail.setOperator(nullSafeText(row, "creator_real_name")); // 批次创建人（运营）
                detail.setSkuPrefix(skuPrefix);
                detail.setDataDate(LocalDate.now());
                detail.setGoodNum(nullSafeInt(row, "good_num"));
                detail.setGoodTransitNum(nullSafeInt(row, "good_transit_num"));
                detail.setTotalNum(nullSafeInt(row, "total"));
                detail.setBalanceNum(nullSafeInt(row, "balance_num"));
                detail.setTransitBalanceNum(nullSafeInt(row, "transit_balance_num"));
                detail.setWhName(nullSafeText(row, "wh_name"));
                detail.setTypeName(nullSafeText(row, "type_name"));
                detail.setPurchaseInTime(nullSafeText(row, "purchase_in_time"));
                detail.setPurchaseOrderSns(jsonArrayToString(row, "purchase_order_sns"));
                detail.setPlanSn(jsonArrayToString(row, "plan_sn"));
                detail.setRawJson(row.toString());

                batchMapper.upsert(detail);
                batchUpserted++;
            }

            totalFetched += batchFetched;
            totalUpserted += batchUpserted;
            skippedNoPrefix = 0; // reset per-page counter (cumulative from earlier batches)

            log.info("库存批次同步：第 {} 页 拉取 {} 行 → 写入 {} 行（跳过 {}）",
                    pages, batchFetched, batchUpserted, batchSkipped);

            // Sleep 1s for token bucket (capacity=1)
            if (data.size() >= PAGE_SIZE) {
                sleep(1000);
            }
        }

        runMapper.finishRun(runId, "SUCCESS", totalUpserted, null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("fetched", totalFetched);
        result.put("upserted", totalUpserted);
        result.put("pages", pages);
        result.put("skippedNoPrefix", skippedNoPrefix);
        result.put("totalPrefixes", allPrefixes.size());
        result.put("uniquePrefixes", prefixToDevs.size());
        log.info("库存批次同步完成：{} 页 / {} 行 / 写入 {} 行", pages, totalFetched, totalUpserted);
        return result;
    }

    /**
     * Query inventory batch details for the frontend arrival dashboard.
     */
    public Map<String, Object> query(int current, int size,
                                     String developer, String dataDate, String sku) {
        LambdaQueryWrapper<LingxingInventoryBatchDetail> qw =
                new LambdaQueryWrapper<LingxingInventoryBatchDetail>()
                        .eq(developer != null && !developer.isEmpty(),
                                LingxingInventoryBatchDetail::getDeveloper, developer)
                        .eq(dataDate != null && !dataDate.isEmpty(),
                                LingxingInventoryBatchDetail::getDataDate, dataDate)
                        .eq(sku != null && !sku.isEmpty(),
                                LingxingInventoryBatchDetail::getSku, sku)
                        .orderByDesc(LingxingInventoryBatchDetail::getDataDate)
                        .orderByAsc(LingxingInventoryBatchDetail::getDeveloper)
                        .orderByAsc(LingxingInventoryBatchDetail::getBatchNo);

        Page<LingxingInventoryBatchDetail> page = batchMapper.selectPage(
                new Page<>(current, size), qw);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", page.getRecords());
        result.put("total", page.getTotal());
        result.put("size", page.getSize());
        result.put("current", page.getCurrent());

        // Also return available dates for dropdown
        result.put("availableDates", batchMapper.distinctDates());
        return result;
    }

    // ─── helpers ────────────────────────────────────────────────

    private Integer nullSafeInt(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return 0;
        if (n.isInt()) return n.asInt();
        try {
            return Integer.parseInt(n.asText());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String nullSafeText(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return null;
        return n.asText();
    }

    private String jsonArrayToString(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull() || (!n.isArray() && n.asText().isEmpty())) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
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
