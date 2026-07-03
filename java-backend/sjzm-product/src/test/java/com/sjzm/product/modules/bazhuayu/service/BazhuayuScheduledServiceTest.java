package com.sjzm.product.modules.bazhuayu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuWeeklyRaw;
import com.sjzm.product.mapper.BazhuayuWeeklyRawMapper;
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
        when(configService.getMarketplaceTaskMap()).thenReturn(Map.of("US", "task-us"));
        when(asinImportService.createStreamingTask("US", "BAZHUAYU_AUTO")).thenReturn(ctx);
        when(asinImportService.finishStreamingTask(ctx)).thenReturn(Map.of("taskId", 99L));

        doAnswer(invocation -> {
            Consumer<List<JsonNode>> pageHandler = invocation.getArgument(1);
            pageHandler.accept(List.of(
                    row("B0DUPLIC01", "$9.99", "1"),
                    row("B0DUPLIC01", "$9.99", "1"),
                    row("B0UNIQUE01", "$12.99", "2")));
            return 3;
        }).when(client).drainNotExported(anyString(), any(), anyInt(), nullable(BooleanSupplier.class));

        BazhuayuScheduledService service = new BazhuayuScheduledService(
                client, configService, config, rawMapper, asinImportService,
                scoringService, runState, executor);

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
        when(configService.getMarketplaceTaskMap()).thenReturn(Map.of("US", "task-us"));
        when(client.drainNotExported(anyString(), any(), anyInt(), nullable(BooleanSupplier.class)))
                .thenReturn(0);

        BazhuayuScheduledService service = new BazhuayuScheduledService(
                client, configService, config, rawMapper, asinImportService,
                scoringService, runState, executor);

        service.runCollection("US");

        verify(asinImportService, never()).createStreamingTask(anyString(), anyString());
        verify(asinImportService, never()).finishStreamingTask(any());
        verify(rawMapper, never()).insertBatchIgnoreDup(anyListOfRawRows());
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
