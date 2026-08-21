package com.sjzm.product.modules.lingxing.service;

import com.sjzm.product.rds.mapper.LingxingSyncCursorMapper;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 领星同步游标服务
 * 管理增量同步的时间窗口，避免全量请求
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingSyncCursorService {

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final LingxingSyncCursorMapper cursorMapper;
    private final RdsBatchWriteService rdsBatchWriteService;

    /**
     * 获取增量同步的起始时间
     * 使用"上次成功时间 - 1 天"作为下界，确保不遗漏边界数据
     *
     * @param dataType 数据类型（PURCHASE_ORDER/PURCHASE_PLAN/INVENTORY_BATCH/SP_ACTUAL/SP_PLAN）
     * @param fallback 回退默认值（首次同步时使用）
     * @return 格式化的起始时间字符串
     */
    public String getIncrementalStartTime(String dataType, LocalDateTime fallback) {
        LocalDateTime lastSuccess = cursorMapper.getLastSuccessTime(dataType);
        if (lastSuccess == null) {
            log.info("[SyncCursor] {} no cursor, use fallback: {}", dataType, fallback);
            return fallback.format(DATETIME_FMT);
        }

        // 向前推 1 天，避免边界遗漏
        LocalDateTime startTime = lastSuccess.minusDays(1);
        log.info("[SyncCursor] {} incremental window: {} (last_success: {})",
                dataType, startTime, lastSuccess);
        return startTime.format(DATETIME_FMT);
    }

    /**
     * 获取增量同步的起始日期（仅日期，用于本地仓批次）
     */
    public String getIncrementalStartDate(String dataType, LocalDateTime fallback) {
        LocalDateTime lastSuccess = cursorMapper.getLastSuccessTime(dataType);
        if (lastSuccess == null) {
            return fallback.format(DATE_FMT);
        }
        return lastSuccess.minusDays(1).format(DATE_FMT);
    }

    /**
     * 更新同步游标
     *
     * @param dataType 数据类型
     * @param successTime 本次成功同步时间
     * @param runId 运行ID
     * @param recordCount 本次记录数
     */
    public void updateCursor(String dataType, LocalDateTime successTime, String runId, Integer recordCount) {
        rdsBatchWriteService.executeOne(LingxingSyncCursorMapper.class, mapper -> {
            mapper.updateCursor(dataType, successTime, runId, recordCount);
            return 1;
        });
        log.info("[SyncCursor] {} updated: time={}, runId={}, count={}",
                dataType, successTime, runId, recordCount);
    }

    /**
     * 检查是否需要跳过本次同步（同一业务日期已成功）
     */
    public boolean shouldSkipDate(String dataType, String targetDate, boolean force) {
        if (force) {
            return false;
        }

        LocalDateTime lastSuccess = cursorMapper.getLastSuccessTime(dataType);
        if (lastSuccess == null) {
            return false;
        }

        String lastDate = lastSuccess.format(DATE_FMT);
        boolean shouldSkip = lastDate.equals(targetDate);
        if (shouldSkip) {
            log.info("[SyncCursor] {} skip date {} (already synced at {})", dataType, targetDate, lastSuccess);
        }
        return shouldSkip;
    }
}
