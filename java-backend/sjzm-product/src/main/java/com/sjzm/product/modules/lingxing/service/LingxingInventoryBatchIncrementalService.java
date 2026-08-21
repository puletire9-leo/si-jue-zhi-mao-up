package com.sjzm.product.modules.lingxing.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 本地仓批次增量同步服务
 * 实现：同一业务日期成功后不重复全量请求，除非明确传入强制重拉参数
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingInventoryBatchIncrementalService {

    private final LingxingSyncCursorService cursorService;
    private final LingxingInventoryBatchService batchService;

    /**
     * 增量同步本地仓批次
     *
     * @param targetDate 目标日期（默认今天）
     * @param force 是否强制重拉
     * @return 同步结果
     */
    public Map<String, Object> syncInventoryBatchIncremental(String targetDate, boolean force) {
        if (targetDate == null || targetDate.isEmpty()) {
            targetDate = LocalDateTime.now().toLocalDate().toString();
        }

        // 检查是否需要跳过
        boolean shouldSkip = cursorService.shouldSkipDate("INVENTORY_BATCH", targetDate, force);
        if (shouldSkip && !force) {
            log.info("[InventoryBatchIncremental] Skip date {} (already synced)", targetDate);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("skipped", true);
            result.put("reason", "Date already synced");
            result.put("targetDate", targetDate);
            return result;
        }

        log.info("[InventoryBatchIncremental] Syncing inventory batch for date: {}", targetDate);
        Map<String, Object> syncResult = batchService.syncDaily(targetDate, targetDate, null);

        // 更新游标
        int recordCount = (int) syncResult.getOrDefault("upserted", 0);
        LocalDateTime cursorTime = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        cursorService.updateCursor("INVENTORY_BATCH", cursorTime, "incremental", recordCount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("targetDate", targetDate);
        result.put("recordCount", recordCount);
        result.put("cursorUpdated", cursorTime);
        result.put("syncDetail", syncResult);
        return result;
    }
}
