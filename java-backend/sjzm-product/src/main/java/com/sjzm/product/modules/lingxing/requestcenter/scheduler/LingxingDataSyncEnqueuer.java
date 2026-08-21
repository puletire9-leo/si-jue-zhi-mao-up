package com.sjzm.product.modules.lingxing.requestcenter.scheduler;

import com.sjzm.product.modules.lingxing.requestcenter.service.LingxingRequestCenterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * 领星基础数据定时入口。这里只生成持久化队列任务，禁止直接调用领星 API。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LingxingDataSyncEnqueuer {

    private final LingxingRequestCenterService requestCenterService;

    @Value("${lingxing.scheduled.enabled:false}")
    private boolean scheduledEnabled;

    @Scheduled(cron = "${lingxing.scheduled.cron:0 30 3 ? * MON}")
    public void enqueueWeeklyProductSync() {
        if (!scheduledEnabled) {
            log.debug("领星每周同步入队已禁用，跳过");
            return;
        }
        LocalDate start = LocalDate.now().minusDays(7)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate end = start.plusDays(6);
        requestCenterService.enqueue(
                LingxingWeeklyProductSyncTaskHandler.TYPE,
                "{\"startDate\":\"" + start + "\",\"endDate\":\"" + end + "\"}",
                "lingxing-scheduler");
        log.info("领星每周数据同步已进入运行中心: {}~{}", start, end);
    }

    @Scheduled(cron = "${lingxing.inventory-batch.cron:0 20 0 * * ?}")
    public void enqueueDailyInventoryBatchSync() {
        if (!scheduledEnabled) {
            log.debug("领星库存批次同步入队已禁用，跳过");
            return;
        }
        LocalDate date = LocalDate.now().minusDays(1);
        requestCenterService.enqueue(
                LingxingInventoryBatchSyncTaskHandler.TYPE,
                "{\"startDate\":\"" + date + "\",\"endDate\":\"" + date + "\"}",
                "lingxing-scheduler");
        log.info("领星库存批次同步已进入运行中心: {}", date);
    }
}

