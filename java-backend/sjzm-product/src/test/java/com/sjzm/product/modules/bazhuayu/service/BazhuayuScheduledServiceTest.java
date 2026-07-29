package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.config.DatabaseWorkloadGate;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuTaskMapping;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
import com.sjzm.product.modules.bazhuayu.mapper.PremiumProductMapper;
import com.sjzm.product.service.AsinImportService;
import com.sjzm.product.service.ScoringService;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BazhuayuScheduledServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void runCollectionIgnoresDuplicateRawAsinsFromBazhuayuPages() throws Exception {
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuConfigService configService = mock(BazhuayuConfigService.class);
        BazhuayuWeeklyRawMapper rawMapper = mock(BazhuayuWeeklyRawMapper.class);
        AsinImportService asinImportService = mock(AsinImportService.class);
        ScoringService scoringService = mock(ScoringService.class);
        BazhuayuRunStateService runState = mock(BazhuayuRunStateService.class);
        ThreadPoolTaskExecutor executor = mock(ThreadPoolTaskExecutor.class);
        BazhuayuConfig config = new BazhuayuConfig();
        config.setDataPageSize(1000);
        config.setDrainMaxRows(1000);
        AsinImportService.StreamingFilterContext ctx =
                mock(AsinImportService.StreamingFilterContext.class);

        when(scoringService.getCurrentWeekTag()).thenReturn("2026-W27");
        BazhuayuTaskMapping entry = taskEntry("task-us", "美国榜单采集精铺", "精铺", true);
        when(configService.listTaskEntries()).thenReturn(List.of(entry));
        when(configService.findTaskEntry("bangdan", "US", "task-us")).thenReturn(entry);
        when(client.getLatestBatchSnapshot("task-us")).thenReturn(finishedBatch("20260721-100000", 3));
        when(asinImportService.createStreamingTask(anyString(), anyString(), any(), anyString(),
                anyString(), anyString(), anyBoolean(), anyString(), any(BazhuayuBatchSnapshot.class)))
                .thenReturn(ctx);
        when(asinImportService.createStreamingTask(
                "US", "BAZHUAYU_AUTO", 7L, "task-us", "美国榜单采集精铺",
                "精铺", true, "competitor_products")).thenReturn(ctx);
        when(asinImportService.finishStreamingTask(ctx)).thenReturn(Map.of("taskId", 99L));

        doAnswer(invocation -> {
            Consumer<List<JsonNode>> pageHandler = invocation.getArgument(2);
            pageHandler.accept(List.of(
                    row("B0DUPLIC01", "$9.99", "1"),
                    row("B0DUPLIC01", "$9.99", "1"),
                    row("B0UNIQUE01", "$12.99", "2")));
            return 3;
        }).when(client).fetchBatchDataStreaming(anyString(), any(BazhuayuBatchSnapshot.class), any());

        BazhuayuScheduledService service = new BazhuayuScheduledService(
                client, configService, config, rawMapper, mock(PremiumProductMapper.class), asinImportService,
                scoringService, runState, executor, workloadGate());

        Map<String, Object> result = service.runCollection("US");

        assertThat(result.get("weekTag")).isEqualTo("2026-W27");
        verify(client, never()).getNotExportedPage(anyString(), anyInt());
        verify(asinImportService).filterPageAndAppend(org.mockito.ArgumentMatchers.eq(ctx), any());
        verify(rawMapper).insertBatchIgnoreDup(anyListOfRawRows());
        verify(asinImportService).finishStreamingTask(ctx);
    }

    @Test
    void runCollectionDoesNotClearCurrentRawRowsWhenNoNotExportedDataExists() {
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuConfigService configService = mock(BazhuayuConfigService.class);
        BazhuayuWeeklyRawMapper rawMapper = mock(BazhuayuWeeklyRawMapper.class);
        AsinImportService asinImportService = mock(AsinImportService.class);
        ScoringService scoringService = mock(ScoringService.class);
        BazhuayuRunStateService runState = mock(BazhuayuRunStateService.class);
        ThreadPoolTaskExecutor executor = mock(ThreadPoolTaskExecutor.class);
        BazhuayuConfig config = new BazhuayuConfig();
        config.setDrainMaxRows(1000);

        when(scoringService.getCurrentWeekTag()).thenReturn("2026-W27");
        BazhuayuTaskMapping entry = taskEntry("task-us", "美国榜单采集精铺", "精铺", true);
        AsinImportService.StreamingFilterContext ctx = mock(AsinImportService.StreamingFilterContext.class);
        when(configService.listTaskEntries()).thenReturn(List.of(entry));
        when(configService.findTaskEntry("bangdan", "US", "task-us")).thenReturn(entry);
        when(client.getLatestBatchSnapshot("task-us")).thenReturn(finishedBatch("20260721-100000", 0));
        when(asinImportService.createStreamingTask(anyString(), anyString(), any(), anyString(),
                anyString(), anyString(), anyBoolean(), anyString(), any(BazhuayuBatchSnapshot.class)))
                .thenReturn(ctx);
        when(asinImportService.createStreamingTask(
                "US", "BAZHUAYU_AUTO", 7L, "task-us", "美国榜单采集精铺",
                "精铺", true, "competitor_products")).thenReturn(ctx);
        when(asinImportService.finishStreamingTask(ctx)).thenReturn(Map.of("taskId", 100L));
        when(client.fetchBatchDataStreaming(anyString(), any(BazhuayuBatchSnapshot.class), any()))
                .thenReturn(0);

        BazhuayuScheduledService service = new BazhuayuScheduledService(
                client, configService, config, rawMapper, mock(PremiumProductMapper.class), asinImportService,
                scoringService, runState, executor, workloadGate());

        service.runCollection("US");

        verify(asinImportService).finishStreamingTask(ctx);
        verify(rawMapper, never()).insertBatchIgnoreDup(anyListOfRawRows());
    }

    @Test
    void premiumTaskBypassesInitialFilterButWaitsForManualRequest() throws Exception {
        BazhuayuClient client = mock(BazhuayuClient.class);
        BazhuayuConfigService configService = mock(BazhuayuConfigService.class);
        BazhuayuWeeklyRawMapper rawMapper = mock(BazhuayuWeeklyRawMapper.class);
        PremiumProductMapper premiumMapper = mock(PremiumProductMapper.class);
        AsinImportService asinImportService = mock(AsinImportService.class);
        ScoringService scoringService = mock(ScoringService.class);
        BazhuayuRunStateService runState = mock(BazhuayuRunStateService.class);
        ThreadPoolTaskExecutor executor = mock(ThreadPoolTaskExecutor.class);
        BazhuayuConfig config = new BazhuayuConfig();
        config.setDrainMaxRows(1000);

        BazhuayuTaskMapping entry = new BazhuayuTaskMapping();
        entry.setId(7L);
        entry.setTaskName("美国榜单采集精品");
        entry.setTaskCategory("精品");
        entry.setFunctionKey("bangdan");
        entry.setMarketplace("US");
        entry.setTaskId("premium-us");
        entry.setInitialFilter(false);
        when(scoringService.getCurrentWeekTag()).thenReturn("2026-W29");
        when(configService.listTaskEntries()).thenReturn(List.of(entry));
        when(configService.findTaskEntry("bangdan", "US", "premium-us")).thenReturn(entry);
        when(client.getLatestBatchSnapshot("premium-us")).thenReturn(finishedBatch("20260721-220000", 1));
        AsinImportService.StreamingFilterContext ctx = mock(AsinImportService.StreamingFilterContext.class);
        when(asinImportService.createStreamingTask(anyString(), anyString(), any(), anyString(),
                anyString(), anyString(), anyBoolean(), anyString(), any(BazhuayuBatchSnapshot.class)))
                .thenReturn(ctx);
        when(ctx.getTaskId()).thenReturn(101L);
        when(asinImportService.createStreamingTask(
                "US", "BAZHUAYU_AUTO", 7L, "premium-us", "美国榜单采集精品",
                "精品", false, "premium_products")).thenReturn(ctx);
        when(asinImportService.finishStreamingTask(ctx)).thenReturn(Map.of("taskId", 101L, "passCount", 1));
        doAnswer(invocation -> {
            Consumer<List<JsonNode>> pageHandler = invocation.getArgument(2);
            pageHandler.accept(List.of(row("B0PREMIUM1", "$19.99", "5")));
            return 1;
        }).when(client).fetchBatchDataStreaming(anyString(), any(BazhuayuBatchSnapshot.class), any());
        BazhuayuScheduledService service = new BazhuayuScheduledService(
                client, configService, config, rawMapper, premiumMapper, asinImportService,
                scoringService, runState, executor, workloadGate());

        service.runCollection("US");

        verify(premiumMapper).upsertRawBatch(any());
        verify(asinImportService).appendPageWithoutInitialFilter(org.mockito.ArgumentMatchers.eq(ctx), any());
        verify(asinImportService).finishStreamingTask(ctx);
        verify(rawMapper, never()).insertBatchIgnoreDup(anyListOfRawRows());
        verify(client, never()).drainNotExported(anyString(), any(), anyInt(), nullable(BooleanSupplier.class));
    }

    private BazhuayuTaskMapping taskEntry(String taskId, String name, String category, boolean initialFilter) {
        BazhuayuTaskMapping entry = new BazhuayuTaskMapping();
        entry.setId(7L);
        entry.setFunctionKey("bangdan");
        entry.setMarketplace("US");
        entry.setTaskId(taskId);
        entry.setTaskName(name);
        entry.setTaskCategory(category);
        entry.setInitialFilter(initialFilter);
        return entry;
    }

    private DatabaseWorkloadGate workloadGate() {
        return new DatabaseWorkloadGate(2, 1, 1, 1000);
    }

    private BazhuayuBatchSnapshot finishedBatch(String batchNo, int count) {
        String iso = batchNo.substring(0, 4) + "-" + batchNo.substring(4, 6) + "-"
                + batchNo.substring(6, 8) + "T" + batchNo.substring(9, 11) + ":"
                + batchNo.substring(11, 13) + ":" + batchNo.substring(13, 15);
        return BazhuayuBatchSnapshot.expected(batchNo, iso, iso, count);
    }

    @SuppressWarnings("unchecked")
    private List<BazhuayuWeeklyRaw> anyListOfRawRows() {
        return any(List.class);
    }

    private JsonNode row(String asin, String price, String reviews) throws Exception {
        return objectMapper.readTree("""
                {
                  "ASIN": "%s",
                  "价格": "%s",
                  "review数量": "%s",
                  "标题": "Test product"
                }
                """.formatted(asin, price, reviews));
    }
}
