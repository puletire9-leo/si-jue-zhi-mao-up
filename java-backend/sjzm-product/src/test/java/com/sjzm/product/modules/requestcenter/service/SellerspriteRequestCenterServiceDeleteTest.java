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

import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SellerspriteRequestCenterServiceDeleteTest {

    private SellerspriteRequestRunMapper runMapper;
    private SellerspriteRequestItemMapper itemMapper;
    private SellerspriteRequestCenterService service;

    @BeforeEach
    void setUp() {
        runMapper = mock(SellerspriteRequestRunMapper.class);
        itemMapper = mock(SellerspriteRequestItemMapper.class);
        service = new SellerspriteRequestCenterService(
                runMapper,
                itemMapper,
                mock(ShopProductSyncService.class),
                mock(ShopCollectionService.class),
                mock(ShopCandidateService.class),
                mock(WeekTagUtil.class),
                mock(TransactionTemplate.class),
                mock(Executor.class),
                mock(ShopPremiumPoolMapper.class),
                mock(AsinImportTaskMapper.class),
                mock(AsinImportResultMapper.class),
                mock(CompetitorService.class),
                mock(SellerspriteExecutionGateway.class),
                mock(DengZongShopService.class),
                mock(RedissonClient.class),
                mock(ScoringService.class),
                mock(CleanLayerService.class),
                mock(SkipAsinMapper.class));
    }

    @Test
    void deletesStoppedRunAndItsItems() {
        SellerspriteRequestRun run = run("run-stopped", "STOPPED");
        when(runMapper.selectById(run.getRunId())).thenReturn(run);
        when(runMapper.deleteById(run.getRunId())).thenReturn(1);

        int affected = service.delete(run.getRunId());

        assertThat(affected).isEqualTo(1);
        verify(itemMapper).delete(any());
        verify(runMapper).deleteById(run.getRunId());
    }

    @Test
    void rejectsRunningRunBeforeDeletingAnything() {
        SellerspriteRequestRun run = run("run-running", "RUNNING");
        when(runMapper.selectById(run.getRunId())).thenReturn(run);

        assertThatThrownBy(() -> service.delete(run.getRunId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("请先停止任务");

        verify(itemMapper, never()).delete(any());
        verify(runMapper, never()).deleteById(run.getRunId());
    }

    private SellerspriteRequestRun run(String runId, String status) {
        SellerspriteRequestRun run = new SellerspriteRequestRun();
        run.setRunId(runId);
        run.setStatus(status);
        return run;
    }
}
