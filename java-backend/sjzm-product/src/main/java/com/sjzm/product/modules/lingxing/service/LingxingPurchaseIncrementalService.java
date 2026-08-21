package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.rds.mapper.LingxingPurchaseDataLayerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 增量采购同步服务
 * 实现日志 8.17 要求的增量请求优化：
 * 1. 使用游标记录 last_success_time
 * 2. 采购单只拉最近变更 + 定向复查未完成项
 * 3. 采购计划只拉新增/变化 + 定向复查未完成
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingPurchaseIncrementalService {

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int INCOMPLETE_BATCH_SIZE = 100;

    private final LingxingSyncCursorService cursorService;
    private final LingxingPurchaseDataLayerService purchaseService;
    private final LingxingPurchaseDataLayerMapper purchaseMapper;

    /**
     * 增量同步采购单
     * 链路：最近变更窗口 + 定向复查未完成项
     */
    public Map<String, Object> syncPurchaseOrdersIncremental() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fallback = now.minusDays(30); // 首次回退30天

        // 1. 增量窗口：拉取最近变更的采购单
        String startTime = cursorService.getIncrementalStartTime("PURCHASE_ORDER", fallback);
        String endTime = now.format(DATETIME_FMT);

        log.info("[PurchaseIncremental] Syncing orders: {} -> {}", startTime, endTime);
        Map<String, Object> incrementalResult = purchaseService.syncPurchaseOrders(
                startTime, endTime, "update_time", List.of(), List.of(), null);

        int incrementalCount = (int) incrementalResult.getOrDefault("upsertedOrders", 0);

        // 2. 定向复查：status=2 的未完成采购单
        List<String> incompleteOrders = purchaseMapper.selectActivePurchaseOrderSns();
        int probedCount = 0;

        if (!incompleteOrders.isEmpty()) {
            log.info("[PurchaseIncremental] Probing {} incomplete orders", incompleteOrders.size());

            for (int from = 0; from < incompleteOrders.size(); from += INCOMPLETE_BATCH_SIZE) {
                List<String> batch = incompleteOrders.subList(
                        from, Math.min(from + INCOMPLETE_BATCH_SIZE, incompleteOrders.size()));

                // 定向查询，不使用时间窗口
                purchaseService.syncPurchaseOrders(
                        "1990-01-01 00:00:00",
                        LocalDateTime.now().plusDays(1).format(DATETIME_FMT),
                        "create_time",
                        batch,
                        List.of(),
                        null
                );
                probedCount += batch.size();
            }
        }

        // 3. 更新游标
        int totalRecords = incrementalCount + probedCount;
        cursorService.updateCursor("PURCHASE_ORDER", now, "incremental", totalRecords);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("incrementalWindow", startTime + " -> " + endTime);
        result.put("incrementalCount", incrementalCount);
        result.put("incompleteProbed", probedCount);
        result.put("totalProcessed", totalRecords);
        result.put("cursorUpdated", now);
        return result;
    }

    /**
     * 增量同步采购计划
     * 链路：最近变更窗口 + 定向复查未完成计划
     */
    public Map<String, Object> syncPurchasePlansIncremental() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fallback = now.minusDays(30);

        String startTime = cursorService.getIncrementalStartTime("PURCHASE_PLAN", fallback);
        String endTime = now.format(DATETIME_FMT);

        log.info("[PurchasePlanIncremental] Syncing plans: {} -> {}", startTime, endTime);

        // 采购计划使用 creator_time 字段，只需要日期部分
        String startDate = startTime.substring(0, 10);
        String endDate = endTime.substring(0, 10);

        Map<String, Object> incrementalResult = purchaseService.syncPurchasePlans(
                startDate, endDate, "creator_time", List.of(), List.of(), List.of());

        int incrementalCount = (int) incrementalResult.getOrDefault("upserted", 0);

        // 采购计划暂不复查未完成项（可后续添加 status 查询）
        // TODO: 添加 selectActivePurchasePlanSns() 查询未完成计划

        cursorService.updateCursor("PURCHASE_PLAN", now, "incremental", incrementalCount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("incrementalWindow", startDate + " -> " + endDate);
        result.put("incrementalCount", incrementalCount);
        result.put("cursorUpdated", now);
        return result;
    }
}
