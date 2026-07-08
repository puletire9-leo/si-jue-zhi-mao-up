package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.mapper.ShopFetchRunMapper;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopCollectionServiceTest {

    @Mock
    ShopProfileMapper shopProfileMapper;

    @Mock
    ShopProductMapper shopProductMapper;

    @Mock
    ShopWatchlistMapper watchlistMapper;

    @Mock
    ShopFetchRunMapper fetchRunMapper;

    @InjectMocks
    ShopCollectionService service;

    @Test
    void resolveSnapshotRejectsSourceRunFromAnotherShop() {
        ShopFetchRun run = run("RUN_1", "DE", "OTHER", "SUCCESS");
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run);

        assertThrows(IllegalArgumentException.class,
                () -> service.resolveSnapshot("UK", "TUGBA2365", "RUN_1", null));
    }

    @Test
    @SuppressWarnings("unchecked")
    void productWallLimitsEachSectionToDefaultPageSize() {
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run("RUN_1", "UK", "TUGBA2365", "SUCCESS"));
        when(shopProductMapper.selectList(ArgumentMatchers.<LambdaQueryWrapper<ShopProduct>>any()))
                .thenReturn(products("A", 30));

        Map<String, Object> result = service.productWall("UK", "TUGBA2365", "RUN_1", null, null, null, null);
        Map<String, Object> sections = (Map<String, Object>) result.get("sections");
        Map<String, Object> aSection = (Map<String, Object>) sections.get("A");

        assertThat(aSection.get("count")).isEqualTo(30);
        assertThat((List<?>) aSection.get("products")).hasSize(24);
    }

    @Test
    void productsUsesResolvedSourceRunIdInsteadOfOnlyBatchDate() {
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run("RUN_1", "UK", "TUGBA2365", "SUCCESS"));
        when(shopProfileMapper.countProductsFromShopProducts("UK", "TUGBA2365", "20260708", "RUN_1", null, null))
                .thenReturn(0L);

        PageResult<?> result = service.products("UK", "TUGBA2365", null, "RUN_1",
                null, null, 1, 60);

        assertThat(result.getTotal()).isZero();
        verify(shopProfileMapper).countProductsFromShopProducts(
                eq("UK"), eq("TUGBA2365"), eq("20260708"), eq("RUN_1"), eq(null), eq(null));
    }

    @Test
    void compareUsesSqlCountsAndPageQueriesInsteadOfLoadingWholeSnapshots() {
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run("RUN_1", "UK", "TUGBA2365", "SUCCESS"));
        when(fetchRunMapper.selectById("RUN_2")).thenReturn(run("RUN_2", "UK", "TUGBA2365", "SUCCESS"));
        when(shopProfileMapper.selectCompareProducts(
                eq("UK"), eq("TUGBA2365"), eq("RUN_1"), eq("RUN_2"),
                ArgumentMatchers.anyString(), eq(0), eq(12)))
                .thenReturn(List.of());

        Map<String, Object> result = service.compare("UK", "TUGBA2365", "RUN_1", "RUN_2", 1, 12);

        assertThat(result.get("summary")).isNotNull();
        verify(shopProfileMapper).countCompareProducts("UK", "TUGBA2365", "RUN_1", "RUN_2", "NEW");
        verify(shopProfileMapper).selectCompareProducts("UK", "TUGBA2365", "RUN_1", "RUN_2", "NEW", 0, 12);
        verify(shopProductMapper, never()).selectList(ArgumentMatchers.<LambdaQueryWrapper<ShopProduct>>any());
    }

    private ShopFetchRun run(String runId, String marketplace, String sellerName, String status) {
        ShopFetchRun run = new ShopFetchRun();
        run.setRunId(runId);
        run.setMarketplace(marketplace);
        run.setSellerName(sellerName);
        run.setStatus(status);
        run.setBatchCode("2026-W28");
        run.setBatchDate("20260708");
        run.setTotal(30);
        run.setFetchedCount(30);
        run.setWrittenCount(30);
        run.setApiCalls(1);
        return run;
    }

    private List<ShopProduct> products(String tier, int count) {
        List<ShopProduct> products = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ShopProduct product = new ShopProduct();
            product.setAsin("ASIN_" + i);
            product.setSalesTier(tier);
            product.setUnits(100 - i);
            products.add(product);
        }
        return products;
    }
}
