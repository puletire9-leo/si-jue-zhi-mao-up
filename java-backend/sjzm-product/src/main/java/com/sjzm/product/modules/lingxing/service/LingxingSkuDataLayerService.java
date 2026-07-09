package com.sjzm.product.modules.lingxing.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.mapper.LingxingSkuDataLayerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Normalized Lingxing SKU data layer.
 *
 * This service migrates the existing real fetched data into the formal tables and
 * is also called by future sync flows after raw API rows are saved.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingSkuDataLayerService {

    private static final DateTimeFormatter RUN_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final LingxingSkuDataLayerMapper mapper;
    private final ObjectProvider<LingxingProductPerformanceSyncService> performanceSyncServiceProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> rebuildSkuSnapshotAndTargetPoolFromExisting(String snapshotWeek, String snapshotDate) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        String date = StringUtils.hasText(snapshotDate) ? snapshotDate.trim() : LocalDate.now().toString();
        String runId = runId("sku-snapshot");
        int snapshotRows = 0;
        int targetRows = 0;

        try {
            mapper.beginRun(runId, "SNAPSHOT_AND_TARGET_POOL", "ALL", null, null, week, null,
                    json(Map.of("snapshotWeek", week, "snapshotDate", date)));
            snapshotRows = mapper.upsertStoreSnapshotFromPerformance(week, date, runId);
            mapper.deactivateTargetPoolSnapshot(week);
            targetRows = mapper.upsertTargetPoolFromSnapshot(week, runId, LingxingSkuPoolService.TARGET_TAG_IDS);
            snapshotRows = mapper.countStoreSnapshot(week);
            targetRows = mapper.countTargetPool(week);
            mapper.finishRun(runId, "SUCCESS", snapshotRows + targetRows, null);
        } catch (RuntimeException ex) {
            mapper.finishRun(runId, "FAILED", snapshotRows + targetRows, ex.getMessage());
            throw ex;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("snapshotWeek", week);
        result.put("snapshotDate", date);
        result.put("snapshotRows", snapshotRows);
        result.put("targetRows", targetRows);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> upsertWeeklyFromExistingPerformance(String startDate,
                                                                    String endDate,
                                                                    String snapshotWeek,
                                                                    String sourceRunId) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        String runId = StringUtils.hasText(sourceRunId) ? sourceRunId.trim() + "-weekly" : runId("sku-weekly");
        int rows = 0;

        try {
            mapper.beginRun(runId, "WEEKLY", "ALL", startDate, endDate, week, yearMonth(startDate),
                    json(Map.of("startDate", safe(startDate), "endDate", safe(endDate), "snapshotWeek", week)));
            rows = mapper.upsertWeeklyFromPerformance(emptyToNull(startDate), emptyToNull(endDate), week, runId);
            rows = mapper.countWeekly(emptyToNull(startDate), emptyToNull(endDate));
            mapper.finishRun(runId, "SUCCESS", rows, null);
        } catch (RuntimeException ex) {
            mapper.finishRun(runId, "FAILED", rows, ex.getMessage());
            throw ex;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("startDate", startDate);
        result.put("endDate", endDate);
        result.put("snapshotWeek", week);
        result.put("weeklyRows", rows);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> rebuildMonthly(String yearMonth) {
        if (!StringUtils.hasText(yearMonth)) {
            throw new IllegalArgumentException("yearMonth 必填，格式 yyyy-MM");
        }
        String month = yearMonth.trim();
        String runId = runId("sku-monthly");
        int rows = 0;

        try {
            mapper.beginRun(runId, "MONTHLY", "ALL", null, null, null, month,
                    json(Map.of("yearMonth", month)));
            rows = mapper.rebuildMonthly(month, runId);
            rows = mapper.countMonthly(month);
            mapper.finishRun(runId, "SUCCESS", rows, null);
        } catch (RuntimeException ex) {
            mapper.finishRun(runId, "FAILED", rows, ex.getMessage());
            throw ex;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("runId", runId);
        result.put("yearMonth", month);
        result.put("monthlyRows", rows);
        return result;
    }

    public Map<String, Object> stats(String snapshotWeek, String yearMonth) {
        String week = StringUtils.hasText(snapshotWeek) ? snapshotWeek.trim() : null;
        String month = StringUtils.hasText(yearMonth) ? yearMonth.trim() : null;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("snapshotWeek", week);
        result.put("yearMonth", month);
        result.put("stats", mapper.stats(week, month));
        return result;
    }

    public Map<String, Object> syncWeeklyFromTargetPool(String snapshotWeek,
                                                        String startDate,
                                                        String endDate,
                                                        String currencyCode,
                                                        String marketplace,
                                                        Long sid,
                                                        Integer limitRows,
                                                        Integer batchSize) {
        String week = normalizeSnapshotWeek(snapshotWeek);
        String normalizedMarketplace = StringUtils.hasText(marketplace)
                ? marketplace.trim().toUpperCase(Locale.ROOT)
                : null;

        int targetRows = mapper.countTargetRowsForWeeklySync(week, normalizedMarketplace, sid);
        List<Map<String, Object>> stores = mapper.listTargetStoresForWeeklySync(week, normalizedMarketplace, sid);
        if (stores.isEmpty()) {
            throw new IllegalArgumentException("没有找到包含所需 SKU 的店铺");
        }

        Map<String, List<Map<String, Object>>> storeGroups = groupStoresByMarketplace(stores);

        String runId = runId("sku-weekly-target-marketplace-msku");
        Map<String, Object> runParams = new LinkedHashMap<>();
        runParams.put("syncStrategy", "TARGET_MARKETPLACE_STORES_FULL_MSKU");
        runParams.put("summaryField", "msku");
        runParams.put("snapshotWeek", week);
        runParams.put("startDate", safe(startDate));
        runParams.put("endDate", safe(endDate));
        runParams.put("currencyCode", safe(currencyCode));
        runParams.put("marketplace", safe(normalizedMarketplace));
        runParams.put("sid", sid == null ? "" : sid);
        runParams.put("targetRows", targetRows);
        runParams.put("targetStoreCount", stores.size());
        runParams.put("marketplaceGroupCount", storeGroups.size());
        runParams.put("ignoredLimitRows", limitRows == null ? "" : limitRows);
        runParams.put("ignoredBatchSize", batchSize == null ? "" : batchSize);
        mapper.beginRun(runId, "WEEKLY_TARGET_POOL", normalizedMarketplace == null ? "ALL" : normalizedMarketplace,
                startDate, endDate, week, yearMonth(startDate), json(runParams));

        int syncedStores = 0;
        int syncedMarketplaceGroups = 0;
        int fetched = 0;
        int upserted = 0;
        Map<String, Integer> storesByMarketplace = new LinkedHashMap<>();
        List<Map<String, Object>> selectedStores = new ArrayList<>();
        List<Map<String, Object>> selectedMarketplaceGroups = new ArrayList<>();

        try {
            for (Map.Entry<String, List<Map<String, Object>>> entry : storeGroups.entrySet()) {
                String groupMarketplace = entry.getKey();
                List<Map<String, Object>> groupStores = entry.getValue();
                List<Long> groupSids = groupStores.stream()
                        .map(store -> Long.parseLong(String.valueOf(store.get("sid"))))
                        .sorted()
                        .toList();
                Map<String, Object> sync = performanceSyncServiceProvider.getObject().syncWithoutWeeklyNormalization(
                        groupSids,
                        startDate,
                        endDate,
                        "msku",
                        currencyCode,
                        null,
                        null,
                        false
                );
                syncedMarketplaceGroups++;
                syncedStores += groupStores.size();
                fetched += asInt(sync.get("fetched"));
                upserted += asInt(sync.get("upserted"));
                storesByMarketplace.put(groupMarketplace, groupStores.size());
                selectedMarketplaceGroups.add(Map.of(
                        "marketplace", groupMarketplace,
                        "sidCount", groupSids.size(),
                        "sids", groupSids,
                        "targetRows", groupStores.stream().mapToInt(store -> asInt(store.get("targetRows"))).sum(),
                        "fetched", asInt(sync.get("fetched")),
                        "upserted", asInt(sync.get("upserted"))
                ));
                for (Map<String, Object> store : groupStores) {
                    selectedStores.add(Map.of(
                            "marketplace", groupMarketplace,
                            "sid", Long.parseLong(String.valueOf(store.get("sid"))),
                            "storeName", safeObj(store.get("storeName")),
                            "targetRows", asInt(store.get("targetRows"))
                    ));
                }

                sleep(10_000L);
            }

            Map<String, Object> weekly = upsertWeeklyFromExistingPerformance(startDate, endDate, week, runId);
            mapper.finishRun(runId, "SUCCESS", asInt(weekly.get("weeklyRows")), null);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("runId", runId);
            result.put("snapshotWeek", week);
            result.put("syncStrategy", "TARGET_MARKETPLACE_STORES_FULL_MSKU");
            result.put("summaryField", "msku");
            result.put("targetRows", targetRows);
            result.put("targetStoreCount", stores.size());
            result.put("marketplaceGroupCount", storeGroups.size());
            result.put("syncedMarketplaceGroups", syncedMarketplaceGroups);
            result.put("syncedStores", syncedStores);
            result.put("storesByMarketplace", storesByMarketplace);
            result.put("selectedMarketplaceGroups", selectedMarketplaceGroups);
            result.put("selectedStores", selectedStores);
            result.put("fetched", fetched);
            result.put("upserted", upserted);
            result.put("weekly", weekly);
            result.put("estimatedMinMinutes", Math.ceil(storeGroups.size() * 10.0 / 60.0));
            result.put("estimatedSafeMinutes", Math.ceil(storeGroups.size() * 300.0 / 60.0));
            return result;
        } catch (RuntimeException ex) {
            mapper.finishRun(runId, "FAILED", upserted, ex.getMessage());
            throw ex;
        }
    }

    public void afterSkuPerformanceSync(String startDate, String endDate, String summaryField, String sourceRunId) {
        String summary = StringUtils.hasText(summaryField) ? summaryField.trim() : "asin";
        if (!"msku".equalsIgnoreCase(summary)) {
            return;
        }
        upsertWeeklyFromExistingPerformance(startDate, endDate, null, sourceRunId);
    }

    private String normalizeSnapshotWeek(String snapshotWeek) {
        if (StringUtils.hasText(snapshotWeek)) {
            return snapshotWeek.trim();
        }
        LocalDate today = LocalDate.now();
        WeekFields wf = WeekFields.ISO;
        return "%d-W%02d".formatted(today.get(wf.weekBasedYear()), today.get(wf.weekOfWeekBasedYear()));
    }

    private String yearMonth(String startDate) {
        if (!StringUtils.hasText(startDate)) {
            return null;
        }
        return LocalDate.parse(startDate).format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

    private String runId(String prefix) {
        return prefix + "-" + LocalDateTime.now().format(RUN_TIME);
    }

    private String json(Map<String, ?> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private String emptyToNull(String s) {
        return StringUtils.hasText(s) ? s.trim() : null;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private int asInt(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("同步被中断", ex);
        }
    }

    private Object safeObj(Object value) {
        return value == null ? "" : value;
    }

    private Map<String, List<Map<String, Object>>> groupStoresByMarketplace(List<Map<String, Object>> stores) {
        Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> store : stores) {
            String marketplace = String.valueOf(store.get("marketplace"));
            grouped.computeIfAbsent(marketplace, k -> new ArrayList<>()).add(store);
        }
        return grouped;
    }
}
