package com.sjzm.product.modules.requestcenter.service;

import com.sjzm.product.entity.DengZongShopSeller;
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
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SellerspriteRequestCenterServiceDengZongTest {

    private SellerspriteRequestRunMapper runMapper;
    private SellerspriteRequestItemMapper itemMapper;
    private DengZongShopService dengZongShopService;
    private SellerspriteRequestCenterService service;

    @BeforeEach
    void setUp() throws InterruptedException {
        runMapper = mock(SellerspriteRequestRunMapper.class);
        itemMapper = mock(SellerspriteRequestItemMapper.class);
        dengZongShopService = mock(DengZongShopService.class);
        RedissonClient redisson = mock(RedissonClient.class);
        RLock lock = mock(RLock.class);
        when(redisson.getLock(anyString())).thenReturn(lock);
        when(lock.tryLock(anyLong(), anyLong(), any(TimeUnit.class))).thenReturn(true);
        when(lock.isHeldByCurrentThread()).thenReturn(true);
        when(itemMapper.insertBatch(any())).thenReturn(1);

        WeekTagUtil weekTagUtil = mock(WeekTagUtil.class);
        when(weekTagUtil.currentWeekTag()).thenReturn("2026-W31");
        service = new SellerspriteRequestCenterService(
                runMapper, itemMapper, mock(ShopProductSyncService.class), mock(ShopCollectionService.class),
                mock(ShopCandidateService.class), weekTagUtil, mock(TransactionTemplate.class), mock(Executor.class),
                mock(ShopPremiumPoolMapper.class), mock(AsinImportTaskMapper.class), mock(AsinImportResultMapper.class),
                mock(CompetitorService.class), mock(SellerspriteExecutionGateway.class), dengZongShopService,
                redisson, mock(ScoringService.class), mock(CleanLayerService.class), mock(SkipAsinMapper.class));
    }

    @Test
    void createsDedicatedRepeatableTaskFromRegisteredSellerIds() {
        when(dengZongShopService.sellerSelectList(any())).thenReturn(List.of(
                seller(11L, "UK", "Store A"), seller(12L, "DE", "Store B")));
        when(itemMapper.selectActiveShopKeys(any())).thenReturn(List.of());

        Map<String, Object> result = service.createDengZongShopTask(List.of(11L, 12L), "tester");

        assertThat(result.get("requestType")).isEqualTo("DENG_ZONG_SHOP_SYNC");
        assertThat(result.get("requestMode")).isEqualTo("DENG_ZONG_REPEATABLE");
        assertThat(result.get("queuedCount")).isEqualTo(2);
        verify(runMapper).insert(any(SellerspriteRequestRun.class));
        verify(itemMapper).insertBatch(any());
    }

    @Test
    void skipsSellerWithAnyActiveShopRequest() {
        when(dengZongShopService.sellerSelectList(any())).thenReturn(List.of(
                seller(11L, "UK", "Store A"), seller(12L, "DE", "Store B")));
        when(itemMapper.selectActiveShopKeys(any())).thenReturn(List.of("UK|store a"));

        Map<String, Object> result = service.createDengZongShopTask(List.of(11L, 12L), "tester");

        assertThat(result.get("queuedCount")).isEqualTo(1);
        assertThat(result.get("skippedCount")).isEqualTo(1);
    }

    private DengZongShopSeller seller(Long id, String marketplace, String sellerName) {
        DengZongShopSeller seller = new DengZongShopSeller();
        seller.setId(id);
        seller.setMarketplace(marketplace);
        seller.setSellerName(sellerName);
        return seller;
    }
}
