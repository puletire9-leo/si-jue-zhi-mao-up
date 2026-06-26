package com.sjzm.product.service;

import com.sjzm.product.dto.SubcategoryAliasResolution;
import com.sjzm.product.dto.WinnerTypeSummary;
import com.sjzm.product.entity.CategoryDislocation;
import com.sjzm.product.mapper.CategoryDislocationMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.service.impl.CategoryDislocationServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryDislocationServiceTest {

    @Mock
    CategoryDislocationMapper categoryDislocationMapper;

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @Mock
    SubcategoryAliasService subcategoryAliasService;

    @InjectMocks
    CategoryDislocationServiceImpl service;

    @Test
    void computeDislocation_usesLatestMonthAndBootstrapsAlias() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(subcategoryAliasService.bootstrap("202606", "UK"))
                .thenReturn(Map.of("approvedCompetitorAliases", 32, "pendingCompetitorAliases", 11));
        when(categoryDislocationMapper.deleteByBaselineMonth("202606", "UK")).thenReturn(4);
        when(categoryDislocationMapper.insertComputedSlices("202606", "UK")).thenReturn(12);
        when(categoryDislocationMapper.selectCount(any())).thenReturn(12L);

        Map<String, Object> result = service.computeDislocation(null, "uk");

        assertThat(result.get("success")).isEqualTo(true);
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("aliasBootstrap"))
                .isEqualTo(Map.of("approvedCompetitorAliases", 32, "pendingCompetitorAliases", 11));
        assertThat(result.get("inserted")).isEqualTo(12);
        assertThat(result.get("totalRows")).isEqualTo(12L);
    }

    @Test
    void getSignalHealth_returnsFalseWhenSliceMissing() {
        when(categoryDislocationMapper.selectOne(any())).thenReturn(null);
        when(subcategoryAliasService.resolve("DE", "Garden Sun Catchers")).thenReturn(null);

        Map<String, Object> result = service.getSignalHealth("DE", "Garden Sun Catchers", null);

        assertThat(result.get("hasSignal")).isEqualTo(false);
        assertThat(result.get("marketplace")).isEqualTo("DE");
        assertThat(result.get("subCategory")).isEqualTo("Garden Sun Catchers");
    }

    @Test
    void getSignalHealth_resolvesAliasAndReturnsSignal() {
        CategoryDislocation row = new CategoryDislocation();
        row.setMarketplace("UK");
        row.setBsrId("garden/outdoors");
        row.setCanonicalKey("garden_sun_catchers");
        row.setSubCategory("Garden Sun Catchers");
        row.setBaselineMonth("202606");
        row.setDengzongCount(0);
        row.setOtherCnCount(1);
        row.setNonCnCount(8);
        row.setTotalSellers(9);
        row.setProductCount(148);
        row.setAvgUnits(new BigDecimal("31.42"));
        row.setDzShare(new BigDecimal("0.0000"));
        row.setNonCnShare(new BigDecimal("0.8889"));
        row.setDislocationScore(new BigDecimal("0.8123"));
        row.setHeatSignal("GREEN");

        when(categoryDislocationMapper.selectOne(any())).thenReturn(null, row);
        when(subcategoryAliasService.resolve("UK", "Glass Art & Suncatchers"))
                .thenReturn(new SubcategoryAliasResolution(
                        "garden_sun_catchers",
                        "Garden Sun Catchers",
                        "COMPETITOR",
                        "Glass Art & Suncatchers",
                        "CATEGORY_RULE"
                ));

        Map<String, Object> result = service.getSignalHealth("UK", "Glass Art & Suncatchers", null);

        assertThat(result.get("hasSignal")).isEqualTo(true);
        assertThat(result.get("canonicalKey")).isEqualTo("garden_sun_catchers");
        assertThat(result.get("subCategory")).isEqualTo("Garden Sun Catchers");
        assertThat(result.get("resolvedBy")).isEqualTo("CATEGORY_RULE");
        assertThat(result.get("heatSignal")).isEqualTo("GREEN");
        assertThat(result.get("dislocationScore")).isEqualTo(new BigDecimal("0.8123"));
        @SuppressWarnings("unchecked")
        Map<String, Object> sellerCounts = (Map<String, Object>) result.get("sellerCounts");
        assertThat(sellerCounts.get("dengzong")).isEqualTo(0);
        assertThat(sellerCounts.get("otherCn")).isEqualTo(1);
        assertThat(sellerCounts.get("nonCn")).isEqualTo(8);
        assertThat(sellerCounts.get("total")).isEqualTo(9);
    }

    @Test
    void listOpportunities_usesLatestBaselineMonth() {
        CategoryDislocation first = new CategoryDislocation();
        first.setCanonicalKey("garden_sun_catchers");
        first.setSubCategory("Garden Sun Catchers");
        first.setHeatSignal("GREEN");
        first.setDislocationScore(new BigDecimal("0.8123"));
        first.setProductCount(148);
        first.setAvgUnits(new BigDecimal("31.42"));

        CategoryDislocation second = new CategoryDislocation();
        second.setCanonicalKey("bookends");
        second.setSubCategory("Bookends");
        second.setHeatSignal("GREEN");
        second.setDislocationScore(new BigDecimal("0.5231"));
        second.setProductCount(67);
        second.setAvgUnits(new BigDecimal("18.20"));

        when(categoryDislocationMapper.selectLatestBaselineMonth("UK")).thenReturn("202606");
        when(categoryDislocationMapper.selectList(any())).thenReturn(List.of(first, second));

        Map<String, Object> result = service.listOpportunities("UK", null, "green", 20);

        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("heatSignal")).isEqualTo("GREEN");
        assertThat(result.get("total")).isEqualTo(2);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertThat(items).hasSize(2);
        assertThat(items.get(0).get("canonicalKey")).isEqualTo("garden_sun_catchers");
        assertThat(items.get(0).get("dislocationScore")).isEqualTo(new BigDecimal("0.8123"));
    }

    @Test
    void listActionableOpportunities_intersectsWinnerCanonicalAndMergesWinnerStats() {
        CategoryDislocation first = new CategoryDislocation();
        first.setBsrId("garden/outdoors");
        first.setCanonicalKey("garden_sun_catchers");
        first.setSubCategory("Garden Sun Catchers");
        first.setHeatSignal("GREEN");
        first.setDislocationScore(new BigDecimal("0.8123"));
        first.setProductCount(148);
        first.setAvgUnits(new BigDecimal("31.42"));
        first.setDengzongCount(0);
        first.setOtherCnCount(1);
        first.setNonCnCount(8);
        first.setTotalSellers(9);
        first.setDzShare(new BigDecimal("0.0000"));
        first.setNonCnShare(new BigDecimal("0.8889"));

        CategoryDislocation second = new CategoryDislocation();
        second.setBsrId("kitchen");
        second.setCanonicalKey("reusable_shopping_bags");
        second.setSubCategory("Reusable Shopping Bags");
        second.setHeatSignal("GREEN");
        second.setDislocationScore(new BigDecimal("0.6231"));
        second.setProductCount(67);
        second.setAvgUnits(new BigDecimal("18.20"));
        second.setDengzongCount(0);
        second.setOtherCnCount(2);
        second.setNonCnCount(6);
        second.setTotalSellers(8);
        second.setDzShare(new BigDecimal("0.0000"));
        second.setNonCnShare(new BigDecimal("0.7500"));

        WinnerTypeSummary suncatcher = new WinnerTypeSummary();
        suncatcher.setCanonicalKey("garden_sun_catchers");
        suncatcher.setCanonicalName("Garden Sun Catchers");
        suncatcher.setWinnerCount(11L);
        suncatcher.setGreenCount(4L);
        suncatcher.setEliminatedCount(1L);
        suncatcher.setWinnerMarketplaces("DE,UK");
        suncatcher.setTopArchetypes("CUSTOM:11");
        suncatcher.setTopCarriers("Suncatcher:9|Hanging Ornament:2");
        suncatcher.setTopElements("Highland Cow:4|Butterfly:3|Bee:2");

        WinnerTypeSummary bags = new WinnerTypeSummary();
        bags.setCanonicalKey("reusable_shopping_bags");
        bags.setCanonicalName("Reusable Shopping Bags");
        bags.setWinnerCount(17L);
        bags.setGreenCount(6L);
        bags.setEliminatedCount(5L);
        bags.setWinnerMarketplaces("UK");
        bags.setTopArchetypes("CUSTOM:15|STD:2");
        bags.setTopCarriers("Canvas Tote:12|Tote Bag:3");
        bags.setTopElements("Football:5|Capybara:3|Butterfly:2");

        when(categoryDislocationMapper.selectLatestBaselineMonth("UK")).thenReturn("202606");
        when(categoryDislocationMapper.selectActionableSlices("UK", "202606", "GREEN", 20))
                .thenReturn(List.of(first, second));
        when(categoryDislocationMapper.selectWinnerTypeSummaries(eq(List.of("garden_sun_catchers", "reusable_shopping_bags"))))
                .thenReturn(List.of(suncatcher, bags));

        Map<String, Object> result = service.listActionableOpportunities("UK", null, "green", 20);

        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("heatSignal")).isEqualTo("GREEN");
        assertThat(result.get("total")).isEqualTo(2);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertThat(items).hasSize(2);
        assertThat(items.get(0).get("canonicalKey")).isEqualTo("garden_sun_catchers");
        assertThat(items.get(0).get("winnerCount")).isEqualTo(11L);
        assertThat(items.get(0).get("greenCount")).isEqualTo(4L);
        assertThat(items.get(0).get("eliminatedCount")).isEqualTo(1L);
        assertThat(items.get(0).get("winnerMarketplaces")).isEqualTo(List.of("DE", "UK"));
        assertThat(items.get(0).get("topCarriers")).isEqualTo(List.of("Suncatcher:9", "Hanging Ornament:2"));
        assertThat(items.get(0).get("topElements")).isEqualTo(List.of("Highland Cow:4", "Butterfly:3", "Bee:2"));
        assertThat(items.get(1).get("canonicalKey")).isEqualTo("reusable_shopping_bags");
        assertThat(items.get(1).get("topArchetypes")).isEqualTo(List.of("CUSTOM:15", "STD:2"));
    }
}
