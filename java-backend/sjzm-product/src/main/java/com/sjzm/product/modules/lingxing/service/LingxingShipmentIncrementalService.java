package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.rds.mapper.LingxingShipmentDataMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * SP 增量同步服务
 * 实现：
 * 1. 实际 SP 只拉最近更新时间窗口；已发货终态不再进入请求池
 * 2. SP 计划主流程只按本轮变化 SP 的唯一 seq 请求，SKU 只能用于无法关联的异常补偿
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingShipmentIncrementalService {

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final LingxingSyncCursorService cursorService;
    private final LingxingShipmentDataService shipmentService;
    private final LingxingShipmentDataMapper shipmentMapper;

    /**
     * 增量同步实际 SP
     * 只拉最近更新窗口，已发货终态（shipment_status=2）不进入请求池
     */
    public Map<String, Object> syncShipmentActualIncremental() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime fallback = now.minusDays(30);

        String startTime = cursorService.getIncrementalStartTime("SP_ACTUAL", fallback);
        String endTime = now.format(DATETIME_FMT);

        log.info("[ShipmentActualIncremental] Syncing actual SP: {} -> {}", startTime, endTime);

        // 同步实际 SP（内部已过滤终态）
        LingxingShipmentDataService.ActualSyncResult actualSync =
                shipmentService.syncActualsByTimeRange(startTime, endTime);

        // 按本轮变化 SP 的 seq 同步计划
        Set<String> syncedSeqs = new LinkedHashSet<>();
        long planRows = 0;
        int seqIndex = 0;

        for (String seq : actualSync.seqs()) {
            try {
                planRows += shipmentService.syncPlansBySeq(seq);
                syncedSeqs.add(seq);
            } catch (RuntimeException ex) {
                log.error("[ShipmentActualIncremental] Failed to sync plan by seq: {}", seq, ex);
            }
            if (++seqIndex < actualSync.seqs().size()) {
                sleep();
            }
        }

        // SKU 补偿：只取无法关联的异常采购 SKU
        List<String> unlinkedSkus = shipmentMapper.selectUnlinkedPurchaseSkus(startTime, endTime);
        int skuCompensated = 0;

        if (!unlinkedSkus.isEmpty()) {
            log.info("[ShipmentActualIncremental] Compensating {} unlinked SKUs", unlinkedSkus.size());
            for (int i = 0; i < unlinkedSkus.size(); i++) {
                String sku = unlinkedSkus.get(i);
                try {
                    planRows += shipmentService.syncPlansBySku(sku);
                    skuCompensated++;
                } catch (RuntimeException ex) {
                    log.error("[ShipmentActualIncremental] Failed to compensate SKU: {}", sku, ex);
                }
                if (i < unlinkedSkus.size() - 1) {
                    sleep();
                }
            }
        }

        // 更新游标
        int totalRecords = actualSync.rowsWritten();
        cursorService.updateCursor("SP_ACTUAL", now, "incremental", totalRecords);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("incrementalWindow", startTime + " -> " + endTime);
        result.put("actualShipments", actualSync.shipmentsFetched());
        result.put("actualRows", actualSync.rowsWritten());
        result.put("planSeqs", syncedSeqs.size());
        result.put("planRows", planRows);
        result.put("skuCompensated", skuCompensated);
        result.put("cursorUpdated", now);
        return result;
    }

    private void sleep() {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
