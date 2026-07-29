package com.sjzm.product.modules.requestcenter.service;

import com.sjzm.product.mapper.AsinImportResultMapper;
import com.sjzm.product.mapper.AsinImportTaskMapper;
import com.sjzm.product.mapper.SkipAsinMapper;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import com.sjzm.product.modules.requestcenter.gateway.SellerspriteExecutionGateway;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestItemMapper;
import com.sjzm.product.modules.requestcenter.mapper.SellerspriteRequestRunMapper;
import com.sjzm.product.modules.shopcandidate.service.ShopCandidateService;
import com.sjzm.product.modules.shopcollection.service.ShopCollectionService;
import com.sjzm.product.modules.shopcollection.service.ShopProductSyncService;
import com.sjzm.product.modules.shoppremium.mapper.ShopPremiumPoolMapper;
import com.sjzm.product.service.CleanLayerService;
import com.sjzm.product.service.CompetitorService;
import com.sjzm.product.service.DengZongShopService;
import com.sjzm.product.service.ScoringService;
import com.sjzm.product.util.WeekTagUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.redisson.api.RedissonClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SellerspriteRequestCenterServiceCleanFinalizationTest {

    private SellerspriteRequestRunMapper runMapper;
    private SellerspriteRequestItemMapper itemMapper;
    private ScoringService scoringService;
    private CleanLayerService cleanLayerService;
    private Executor executor;
    private SellerspriteRequestCenterService service;

    @BeforeEach
    void setUp() {
        runMapper = mock(SellerspriteRequestRunMapper.class);
        itemMapper = mock(SellerspriteRequestItemMapper.class);
        scoringService = mock(ScoringService.class);
        cleanLayerService = mock(CleanLayerService.class);
        executor = mock(Executor.class);
        service = new SellerspriteRequestCenterService(
                runMapper,
                itemMapper,
                mock(ShopProductSyncService.class),
                mock(ShopCollectionService.class),
                mock(ShopCandidateService.class),
                mock(WeekTagUtil.class),
                mock(TransactionTemplate.class),
                executor,
                mock(ShopPremiumPoolMapper.class),
                mock(AsinImportTaskMapper.class),
                mock(AsinImportResultMapper.class),
                mock(CompetitorService.class),
                mock(SellerspriteExecutionGateway.class),
                mock(DengZongShopService.class),
                mock(RedissonClient.class),
                scoringService,
                cleanLayerService,
                mock(SkipAsinMapper.class));
    }

    @Test
    void marksAsinBatchSuccessfulOnlyAfterCleanLayerRefresh() {
        SellerspriteRequestRun run = completedRequest("run-clean-ok", "ASIN_BATCH_LOOKUP");
        when(runMapper.selectById(run.getRunId())).thenReturn(run);
        when(itemMapper.selectPending(run.getRunId(), 1)).thenReturn(List.of());
        when(scoringService.updateWeekTags()).thenReturn("2026-W31");
        when(cleanLayerService.cleanWeekBatch("US", "2026-W31"))
                .thenReturn(Map.of("affectedRows", 123));

        Map<String, Object> result = service.consumeNext(run.getRunId(), 1);

        verify(cleanLayerService).cleanWeekBatch("US", "2026-W31");
        verify(runMapper).updateById(run);
        assertThat(run.getStatus()).isEqualTo("SUCCESS");
        assertThat(result.get("finished")).isEqualTo(true);
    }

    @Test
    void pausesAndSchedulesRetryWhenCleanLayerRefreshFails() {
        SellerspriteRequestRun run = completedRequest("run-clean-fail", "ASIN_BATCH_LOOKUP");
        when(runMapper.selectById(run.getRunId())).thenReturn(run);
        when(itemMapper.selectPending(run.getRunId(), 1)).thenReturn(List.of());
        when(scoringService.updateWeekTags()).thenReturn("2026-W31");
        when(cleanLayerService.cleanWeekBatch("US", "2026-W31"))
                .thenThrow(new IllegalStateException("database busy"));
        when(runMapper.pauseSystem(eq(run.getRunId()), any(), any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    run.setStatus("PAUSED_SYSTEM");
                    run.setSystemPauseReason(invocation.getArgument(1));
                    run.setSystemResumeAt(invocation.getArgument(2));
                    return 1;
                });

        Map<String, Object> result = service.consumeNext(run.getRunId(), 1);

        verify(runMapper).pauseSystem(eq(run.getRunId()), any(), any(LocalDateTime.class));
        verify(runMapper, never()).updateById(run);
        assertThat(run.getStatus()).isEqualTo("PAUSED_SYSTEM");
        assertThat(run.getSystemPauseReason()).startsWith("新品清洗收尾失败:");
        assertThat(result.get("finished")).isEqualTo(false);
    }

    @Test
    void scheduledRecoveryRestartsCleanFinalizationWithoutPendingItems() {
        SellerspriteRequestRun run = completedRequest("run-clean-retry", "ASIN_BATCH_LOOKUP");
        run.setStatus("PAUSED_SYSTEM");
        run.setSystemPauseReason("新品清洗收尾失败: database busy");
        run.setSystemResumeAt(LocalDateTime.now().minusSeconds(1));
        when(runMapper.selectDueSystemRetryRunIds()).thenReturn(List.of(run.getRunId()));
        when(runMapper.selectById(run.getRunId())).thenReturn(run);
        when(runMapper.resume(run.getRunId())).thenAnswer(invocation -> {
            run.setStatus("RUNNING");
            return 1;
        });

        service.recoverDueSafeRetries();

        verify(runMapper).resume(run.getRunId());
        verify(itemMapper, never()).releaseDueSafeRetries(run.getRunId());
        verify(executor).execute(any(Runnable.class));
    }

    @Test
    void premiumLookupCompletesWithoutTouchingCompetitorCleanLayer() {
        SellerspriteRequestRun run = completedRequest("run-premium", "PREMIUM_ASIN_LOOKUP");
        when(runMapper.selectById(run.getRunId())).thenReturn(run);
        when(itemMapper.selectPending(run.getRunId(), 1)).thenReturn(List.of());

        service.consumeNext(run.getRunId(), 1);

        verify(scoringService, never()).updateWeekTags();
        verify(cleanLayerService, never()).cleanWeekBatch(any(), any());
        assertThat(run.getStatus()).isEqualTo("SUCCESS");
    }

    private SellerspriteRequestRun completedRequest(String runId, String requestType) {
        SellerspriteRequestRun run = new SellerspriteRequestRun();
        run.setRunId(runId);
        run.setRequestType(requestType);
        run.setMarketplace("US");
        run.setStatus("RUNNING");
        run.setPendingCount(0);
        run.setSuccessCount(1);
        run.setFailedCount(0);
        run.setSkippedCount(0);
        run.setApiCalls(1);
        return run;
    }
}
