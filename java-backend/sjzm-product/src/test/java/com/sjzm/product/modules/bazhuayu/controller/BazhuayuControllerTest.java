package com.sjzm.product.modules.bazhuayu.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.AsinImportTask;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuBatchSnapshot;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuClient;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuRunStateService;
import com.sjzm.product.modules.bazhuayu.service.BazhuayuScheduledService;
import com.sjzm.product.modules.requestcenter.service.SellerspriteRequestCenterService;
import com.sjzm.product.service.ScoringService;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * overview 三段口径：当前运行(内存) / 本周(ISO 周) / 历史累计(全量)。
 * 用 now() 保证 US 任务落在本周；UK 任务用一年前日期，只出现在历史累计里。
 */
class BazhuayuControllerTest {

    @Test
    void triggerWithoutBatchMetadataLocksLatestFinishedBatchForOldFrontend() throws Exception {
        BazhuayuScheduledService scheduledService = mock(BazhuayuScheduledService.class);
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuBatchSnapshot latest = BazhuayuBatchSnapshot.fromStatus(new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree("{\"status\":\"Finished\",\"currentTotalExtractCount\":1136,"
                        + "\"startExecuteTime\":\"2026-07-15T16:43:55.243\","
                        + "\"endExecuteTime\":\"2026-07-15T16:46:50.700\"}"));
        when(client.getLatestBatchSnapshot("task-de")).thenReturn(latest);

        BazhuayuController controller = new BazhuayuController(
                scheduledService,
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuConfigService.class),
                mock(BazhuayuRunStateService.class),
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuCloudStatsService.class),
                client,
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuImageSearchService.class),
                mock(BazhuayuWeeklyRawMapper.class),
                mock(AsinImportTaskMapper.class),
                mock(ScoringService.class),
                mock(SellerspriteRequestCenterService.class));

        Map<String, Object> data = controller.trigger(
                "bangdan", "DE", "task-de", null, null, null, 0).getData();

        assertThat(data.get("batchNo")).isEqualTo("20260715-164355");
        verify(scheduledService).triggerTaskAsync("bangdan", "DE", "task-de", latest);
    }

    @Test
    void overview_splitsCountsIntoWeekAndLifetime() {
        ScoringService scoringService = mock(ScoringService.class);
        AsinImportTaskMapper taskMapper = mock(AsinImportTaskMapper.class);
        BazhuayuWeeklyRawMapper rawMapper = mock(BazhuayuWeeklyRawMapper.class);
        BazhuayuRunStateService runStateService = mock(BazhuayuRunStateService.class);

        // US: 本周内创建的 DONE 任务
        LocalDateTime nowIshWeekday = LocalDateTime.now().withHour(10).withMinute(0);
        AsinImportTask usDone = task("US", "DONE", 10, 8, 2, 1, 0, 4, 4, 2, 0,
                "2026-06", nowIshWeekday, nowIshWeekday.plusHours(1));
        // UK: 一年前的历史任务，只落在 lifetime 里，不落 week
        LocalDateTime lastYear = LocalDateTime.now().minusYears(1);
        AsinImportTask ukReady = task("UK", "READY", 20, 15, 3, 2, 0, 5, 5, 0, 0,
                "2025-06", lastYear, lastYear.plusHours(1));
        BazhuayuWeeklyRaw raw1 = raw("US");
        BazhuayuWeeklyRaw raw2 = raw("UK");
        // 当前运行槽：DRAINING (STARTING/WAITING_CLOUD/DRAINING 三态都算 running)
        BazhuayuRunStateService.RunState state = new BazhuayuRunStateService.RunState();
        state.setTaskKey("bangdan:US");
        state.setMarketplace("US");
        state.setPhase(BazhuayuRunStateService.Phase.DRAINING);
        state.setCloudExtractCount(123);
        state.setDrainedRows(45);

        when(scoringService.getCurrentWeekTag()).thenReturn("2026-W27");
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(usDone, ukReady));
        when(rawMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(raw1, raw2));
        when(runStateService.all()).thenReturn(List.of(state));

        BazhuayuController controller = new BazhuayuController(
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuScheduledService.class),
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuConfigService.class),
                runStateService,
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuCloudStatsService.class),
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuClient.class),
                mock(com.sjzm.product.modules.bazhuayu.service.BazhuayuImageSearchService.class),
                rawMapper,
                taskMapper,
                scoringService,
                mock(SellerspriteRequestCenterService.class));

        Map<String, Object> overview = controller.overview().getData();

        assertThat(overview.get("weekTag")).isEqualTo("2026-W27");
        assertThat(overview).containsKey("weekStart");
        assertThat(overview).containsKey("datasource");

        // 三段任务列表
        assertThat((List<?>) overview.get("weekTasks")).hasSize(1);      // 只有 US
        assertThat((List<?>) overview.get("lifetimeTasks")).hasSize(2);  // US + UK

        // 跨站点 summary 汇总
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) overview.get("summary");
        assertThat(summary.get("currentRunning")).isEqualTo(1L);            // DRAINING = running
        assertThat(summary.get("currentCloudExtractCount")).isEqualTo(123L);
        assertThat(summary.get("weeklyRawCount")).isEqualTo(2L);
        assertThat(summary.get("weekTaskCount")).isEqualTo(1L);             // 只有 US 在本周
        assertThat(summary.get("weekDoneCount")).isEqualTo(1L);
        assertThat(summary.get("lifetimeTaskCount")).isEqualTo(2L);
        assertThat(summary.get("lifetimeDoneCount")).isEqualTo(1L);

        // 站点级三段字段
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> marketplaces = (List<Map<String, Object>>) overview.get("marketplaces");
        assertThat(marketplaces).hasSize(3);  // US/UK/DE (DE 空占位)
        Map<String, Object> us = marketplaces.stream()
                .filter(row -> "US".equals(row.get("marketplace")))
                .findFirst()
                .orElseThrow();
        assertThat(us.get("currentPhase")).isEqualTo(BazhuayuRunStateService.Phase.DRAINING);
        assertThat(us.get("currentRunning")).isEqualTo(true);
        assertThat(us.get("weekTaskCount")).isEqualTo(1);
        assertThat(us.get("weekDoneCount")).isEqualTo(1L);
        assertThat(us.get("lifetimeTaskCount")).isEqualTo(1);
        assertThat(us.get("weeklyRawCount")).isEqualTo(1L);

        Map<String, Object> uk = marketplaces.stream()
                .filter(row -> "UK".equals(row.get("marketplace")))
                .findFirst()
                .orElseThrow();
        assertThat(uk.get("currentRunning")).isEqualTo(false);   // 无 running slot
        assertThat(uk.get("weekTaskCount")).isEqualTo(0);        // 一年前的任务不在本周
        assertThat(uk.get("lifetimeTaskCount")).isEqualTo(1);
    }

    @Test
    void parseDatasource_extractsHostPortDatabase() {
        Map<String, String> ds = BazhuayuController.parseDatasource(
                "jdbc:mysql://mysql:3306/sijuelishi_dev?useUnicode=true&characterEncoding=UTF-8",
                "dev");

        assertThat(ds.get("host")).isEqualTo("mysql");
        assertThat(ds.get("port")).isEqualTo("3306");
        assertThat(ds.get("database")).isEqualTo("sijuelishi_dev");
        assertThat(ds.get("profile")).isEqualTo("dev");
    }

    @Test
    void parseDatasource_blankUrlFallsBackToQuestionMarks() {
        Map<String, String> ds = BazhuayuController.parseDatasource("", null);
        assertThat(ds.get("host")).isEqualTo("?");
        assertThat(ds.get("port")).isEqualTo("?");
        assertThat(ds.get("database")).isEqualTo("?");
        assertThat(ds.get("profile")).isEqualTo("default");
    }

    private AsinImportTask task(String marketplace, String status, int total, int pass, int priceFail, int reviewFail,
                                int duplicate, int skip, int batchTotal, int apiSuccess, int apiFail,
                                String month, LocalDateTime createdAt, LocalDateTime completedAt) {
        AsinImportTask task = new AsinImportTask();
        task.setId((long) (Math.random() * 10000 + 1));
        task.setMarketplace(marketplace);
        task.setImportType("BAZHUAYU_AUTO");
        task.setTaskStatus(status);
        task.setTotalCount(total);
        task.setPassCount(pass);
        task.setPriceFailCount(priceFail);
        task.setReviewFailCount(reviewFail);
        task.setDuplicateCount(duplicate);
        task.setSkipCount(skip);
        task.setBatchTotal(batchTotal);
        task.setBatchCurrent(0);
        task.setApiSuccess(apiSuccess);
        task.setApiFail(apiFail);
        task.setDataMonth(month);
        task.setCreatedAt(createdAt);
        task.setUpdatedAt(completedAt);
        return task;
    }

    private BazhuayuWeeklyRaw raw(String marketplace) {
        BazhuayuWeeklyRaw raw = new BazhuayuWeeklyRaw();
        raw.setMarketplace(marketplace);
        raw.setWeekTag("2026-W27");
        raw.setAsin("B012345678");
        return raw;
    }
}
