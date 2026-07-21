package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.PageResult;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileProduct;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.shopcandidate.entity.ShopFetchRun;
import com.sjzm.product.modules.shopcandidate.mapper.ShopFetchRunMapper;
import com.sjzm.product.modules.shopcollection.dto.ShopTierAgeCategoryCell;
import com.sjzm.product.modules.shopcollection.dto.ShopProductSelectionQuery;
import com.sjzm.product.modules.shopcollection.entity.ShopProduct;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopWatchlistMapper;
import com.sjzm.product.modules.shopcollection.rule.ShopProfileLabelRule;
import com.sjzm.product.modules.shopcollection.rule.ShopProfileLabelRule.CategoryLabel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;

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

    @Mock
    ShopProfileLabelRule labelRule;

    @InjectMocks
    ShopCollectionService service;

    @BeforeEach
    void initShopProductTableInfo() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), "test"),
                ShopProduct.class);
    }

    @Test
    void selectionCategoriesReuseM01AndBatchFiltersButIgnoreCurrentCategory() {
        ShopProductSelectionQuery query = new ShopProductSelectionQuery();
        query.setMarketplace("US");
        query.setMethodId("M01");
        query.setBatchDates(List.of("20260714"));
        query.setCategories(List.of("Sports & Outdoors:Fan Shop"));
        when(shopProductMapper.selectSelectionCategories(ArgumentMatchers.any()))
                .thenReturn(List.of(Map.of("category", "Sports & Outdoors:Fan Shop", "count", 3L)));

        service.selectionCategories(query);

        ArgumentCaptor<Wrapper<ShopProduct>> wrapperCaptor = ArgumentCaptor.forClass(Wrapper.class);
        verify(shopProductMapper).selectSelectionCategories(wrapperCaptor.capture());
        Wrapper<ShopProduct> wrapper = wrapperCaptor.getValue();
        LambdaQueryWrapper<ShopProduct> lambdaWrapper = (LambdaQueryWrapper<ShopProduct>) wrapper;
        assertThat(wrapper.getCustomSqlSegment())
                .contains("marketplace", "batch_date", "price", "listing_days")
                .doesNotContain("node_label_path");
        assertThat(lambdaWrapper.getParamNameValuePairs().values())
                .contains("US", "20260714")
                .doesNotContain("Sports & Outdoors:Fan Shop");
    }

    @Test
    void selectionProductsAcceptIsoWeekBatchFilter() {
        ShopProductSelectionQuery query = new ShopProductSelectionQuery();
        query.setMarketplace("UK");
        query.setBatchDates(List.of("2026-W29"));
        when(shopProductMapper.selectPage(ArgumentMatchers.any(Page.class), ArgumentMatchers.any(Wrapper.class)))
                .thenReturn(new Page<>(1, 60, 0));

        service.selectionProducts(query);

        ArgumentCaptor<Wrapper<ShopProduct>> wrapperCaptor = ArgumentCaptor.forClass(Wrapper.class);
        verify(shopProductMapper).selectPage(ArgumentMatchers.any(Page.class), wrapperCaptor.capture());
        Wrapper<ShopProduct> wrapper = wrapperCaptor.getValue();
        assertThat(wrapper.getCustomSqlSegment())
                .contains("batch_code")
                .doesNotContain("STR_TO_DATE(batch_date", "%x-W%v");
        assertThat(((LambdaQueryWrapper<ShopProduct>) wrapper).getParamNameValuePairs().values())
                .contains("2026-W29");
    }

    @Test
    void selectionBatchesUsesWeeklyAggregation() {
        List<Map<String, Object>> weeks = List.of(Map.of(
                "week", "2026-W29",
                "count", 30216L,
                "startDate", "2026-07-14",
                "endDate", "2026-07-14"));
        when(shopProductMapper.selectSelectionWeeks("UK")).thenReturn(weeks);

        assertThat(service.selectionBatches("UK")).isEqualTo(weeks);
        verify(shopProductMapper).selectSelectionWeeks("UK");
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void selectionProductsMatchSelectedFullCategoryExactly() {
        ShopProductSelectionQuery query = new ShopProductSelectionQuery();
        query.setMarketplace("US");
        query.setCategories(List.of("Sports & Outdoors:Fan Shop:Outdoor Flags"));
        when(shopProductMapper.selectPage(ArgumentMatchers.any(Page.class), ArgumentMatchers.any(Wrapper.class)))
                .thenReturn(new Page<>(1, 60, 0));

        service.selectionProducts(query);

        ArgumentCaptor<Wrapper<ShopProduct>> wrapperCaptor = ArgumentCaptor.forClass(Wrapper.class);
        verify(shopProductMapper).selectPage(ArgumentMatchers.any(Page.class), wrapperCaptor.capture());
        Wrapper<ShopProduct> wrapper = wrapperCaptor.getValue();
        LambdaQueryWrapper<ShopProduct> lambdaWrapper = (LambdaQueryWrapper<ShopProduct>) wrapper;
        assertThat(wrapper.getCustomSqlSegment()).contains("TRIM(node_label_path) =");
        assertThat(lambdaWrapper.getParamNameValuePairs().values())
                .contains("Sports & Outdoors:Fan Shop:Outdoor Flags");
    }

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

        ArgumentCaptor<LambdaQueryWrapper<ShopProduct>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(shopProductMapper).selectList(wrapperCaptor.capture());
        assertThat(wrapperCaptor.getValue().getSqlSelect())
                .contains("asin", "parent_asin", "image_url", "title", "units", "sales_tier",
                        "price", "rating", "ratings", "node_label_path", "product_url")
                .doesNotContain("raw_json");
    }

    @Test
    void productsUsesResolvedSourceRunIdInsteadOfOnlyBatchDate() {
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run("RUN_1", "UK", "TUGBA2365", "SUCCESS"));
        when(shopProfileMapper.countProductsFromShopProducts(
                eq("UK"), eq("TUGBA2365"), eq("20260708"), eq("RUN_1"),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.isNull(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any()))
                .thenReturn(0L);

        PageResult<?> result = service.products("UK", "TUGBA2365", null, "RUN_1",
                null, null, null, null, null, null, 1, 60);

        assertThat(result.getTotal()).isZero();
        verify(shopProfileMapper).countProductsFromShopProducts(
                eq("UK"), eq("TUGBA2365"), eq("20260708"), eq("RUN_1"),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.isNull(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    void attentionFilterClassifiesEachProductInsteadOfOnlyLeafCategory() {
        when(fetchRunMapper.selectById("RUN_1")).thenReturn(run("RUN_1", "UK", "TUGBA2365", "SUCCESS"));
        when(shopProfileMapper.countProductsFromShopProducts(
                eq("UK"), eq("TUGBA2365"), eq("20260708"), eq("RUN_1"),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.isNull(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any()))
                .thenReturn(2L);
        ShopProfileProduct good = profileProduct("A1", "Decor", "Arts : Decor");
        ShopProfileProduct neutral = profileProduct("A2", "Decor", "Industrial : Decor");
        when(shopProfileMapper.selectProductsFromShopProducts(
                eq("UK"), eq("TUGBA2365"), eq("20260708"), eq("RUN_1"),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.eq(false),
                ArgumentMatchers.isNull(), ArgumentMatchers.isNull(), ArgumentMatchers.isNull(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                eq(0), eq(2)))
                .thenReturn(List.of(good, neutral));
        when(labelRule.classify("Decor", "Arts : Decor")).thenReturn(new CategoryLabel(
                "GOOD_TENDENCY", "GOOD_DECOR_SMALL", "好品倾向", List.of(), List.of("GOOD_DECOR_SMALL")));
        when(labelRule.classify("Decor", "Industrial : Decor")).thenReturn(new CategoryLabel(
                "NEUTRAL", "NO_RULE_HIT", "未命中", List.of(), List.of()));

        PageResult<ShopProfileProduct> result = service.products("UK", "TUGBA2365", null, "RUN_1",
                null, null, "GOOD_TENDENCY", null, null, null, 1, 60);

        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getList()).extracting(ShopProfileProduct::getAsin).containsExactly("A1");
        assertThat(result.getList().get(0).getAttentionLevel()).isEqualTo("GOOD_TENDENCY");
    }

    @Test
    void summaryEnriches3dFieldsWithOneBatchCellQuery() {
        ShopProfileSummary sellerA = summary("SELLER_A", 20L);
        ShopProfileSummary sellerB = summary("SELLER_B", 30L);
        when(shopProductMapper.selectMaxBatchDate("UK")).thenReturn("20260708");
        when(shopProfileMapper.selectSummaryFromShopProducts(
                eq("UK"), eq("20260708"), ArgumentMatchers.isNull(), ArgumentMatchers.isNull(),
                ArgumentMatchers.isNull(), eq(100),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any()))
                .thenReturn(List.of(sellerA, sellerB));

        ShopTierAgeCategoryCell aCell = cell("SELLER_A", "A", "NEW", "Decor", "Arts : Decor", 4L);
        ShopTierAgeCategoryCell bCell = cell("SELLER_B", "D", "OLD", "Decor", "Arts : Decor", 3L);
        when(shopProfileMapper.selectTierAgeCategoryCellsBatchFromShopProducts(
                eq("UK"), eq(List.of("SELLER_A", "SELLER_B")), eq("20260708"), ArgumentMatchers.isNull(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any()))
                .thenReturn(List.of(aCell, bCell));
        when(labelRule.classify("Decor", "Arts : Decor")).thenReturn(new CategoryLabel(
                "GOOD_TENDENCY", "GOOD_DECOR_SMALL", "好品倾向", List.of(), List.of("GOOD_DECOR_SMALL")));

        List<ShopProfileSummary> result = service.summary("UK", null, null, null, 100, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getNewABCCount()).isEqualTo(4L);
        assertThat(result.get(1).getOldDCount()).isEqualTo(3L);
        verify(shopProfileMapper, never()).selectTierAgeCategoryCellsFromShopProducts(
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(),
                ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any(), ArgumentMatchers.any());
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

    private ShopProfileProduct profileProduct(String asin, String categoryLeaf, String nodeLabelPath) {
        ShopProfileProduct product = new ShopProfileProduct();
        product.setAsin(asin);
        product.setCategoryLeaf(categoryLeaf);
        product.setNodeLabelPath(nodeLabelPath);
        return product;
    }

    private ShopProfileSummary summary(String sellerName, Long productCount) {
        ShopProfileSummary summary = new ShopProfileSummary();
        summary.setMarketplace("UK");
        summary.setSellerName(sellerName);
        summary.setProductCount(productCount);
        summary.setACount(0L);
        summary.setBCount(0L);
        summary.setCCount(0L);
        summary.setDCount(0L);
        summary.setUnknownCount(0L);
        return summary;
    }

    private ShopTierAgeCategoryCell cell(String sellerName, String tier, String ageBucket,
                                         String categoryKey, String nodeLabelPath, Long count) {
        ShopTierAgeCategoryCell cell = new ShopTierAgeCategoryCell();
        cell.setMarketplace("UK");
        cell.setSellerName(sellerName);
        cell.setSalesTier(tier);
        cell.setAgeBucket(ageBucket);
        cell.setCategoryKey(categoryKey);
        cell.setNodeLabelPath(nodeLabelPath);
        cell.setProductCount(count);
        cell.setUnitsSum(0L);
        cell.setM01HitCount(0L);
        return cell;
    }
}
