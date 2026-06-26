package com.sjzm.product.service;

import com.sjzm.product.entity.CategoryBsrBaseline;
import com.sjzm.product.entity.SubcategoryBaseline;
import com.sjzm.product.mapper.CategoryBsrBaselineMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.SubcategoryBaselineMapper;
import com.sjzm.product.service.impl.SalesBaselineServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalesBaselineServiceTest {

    @Mock
    CategoryBsrBaselineMapper categoryBsrBaselineMapper;

    @Mock
    SubcategoryBaselineMapper subcategoryBaselineMapper;

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @InjectMocks
    SalesBaselineServiceImpl service;

    @Test
    void computeBsrBaseline_usesLatestMonthWhenMonthMissing() {
        when(competitorProductMapper.selectLatestMonth("UK")).thenReturn("202606");
        when(competitorProductMapper.selectCount(any())).thenReturn(128L);
        when(categoryBsrBaselineMapper.deleteByBaselineMonth("202606", "UK")).thenReturn(3);
        when(categoryBsrBaselineMapper.insertComputedSlices("202606", "UK")).thenReturn(18);
        when(categoryBsrBaselineMapper.selectCount(any())).thenReturn(18L);

        Map<String, Object> result = service.computeBsrBaseline(null, "uk");

        assertThat(result.get("success")).isEqualTo(true);
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("eligibleCompetitorRows")).isEqualTo(128L);
        assertThat(result.get("inserted")).isEqualTo(18);
        assertThat(result.get("totalRows")).isEqualTo(18L);
    }

    @Test
    void getBsrHealth_returnsFalseWhenSliceMissing() {
        when(categoryBsrBaselineMapper.selectOne(any())).thenReturn(null);

        Map<String, Object> result = service.getBsrHealth("DE", "kitchen", 12000, null);

        assertThat(result.get("hasBaseline")).isEqualTo(false);
        assertThat(result.get("marketplace")).isEqualTo("DE");
        assertThat(result.get("bsrId")).isEqualTo("kitchen");
        assertThat(result.get("bsrBucket")).isEqualTo("5k20k");
    }

    @Test
    void getBsrHealth_returnsComputedBenchmark() {
        CategoryBsrBaseline baseline = new CategoryBsrBaseline();
        baseline.setMarketplace("DE");
        baseline.setBsrId("kitchen");
        baseline.setBsrBucket("5k20k");
        baseline.setBaselineMonth("202606");
        baseline.setSampleSize(138);
        baseline.setUnitsP25(44);
        baseline.setUnitsP50(56);
        baseline.setUnitsP75(165);
        baseline.setPriceAvg(new BigDecimal("21.58"));
        baseline.setConfidence("high");
        when(categoryBsrBaselineMapper.selectOne(any())).thenReturn(baseline);

        Map<String, Object> result = service.getBsrHealth("DE", "kitchen", 12000, null);

        assertThat(result.get("hasBaseline")).isEqualTo(true);
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("confidence")).isEqualTo("high");
        assertThat(result.get("priceAvg")).isEqualTo(new BigDecimal("21.58"));
        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        assertThat(units.get("p25")).isEqualTo(44);
        assertThat(units.get("p50")).isEqualTo(56);
        assertThat(units.get("p75")).isEqualTo(165);
    }

    @Test
    void computeSubcategoryBaseline_normalizesDashedMonth() {
        when(competitorProductMapper.selectCount(any())).thenReturn(520L);
        when(subcategoryBaselineMapper.deleteByBaselineMonth("202606", null)).thenReturn(1);
        when(subcategoryBaselineMapper.insertComputedSlices("202606", null)).thenReturn(9);
        when(subcategoryBaselineMapper.selectCount(any())).thenReturn(9L);

        Map<String, Object> result = service.computeSubcategoryBaseline("2026-06", null);

        assertThat(result.get("success")).isEqualTo(true);
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("ALL");
        assertThat(result.get("minimumSampleSize")).isEqualTo(30);
        assertThat(result.get("eligibleCompetitorRows")).isEqualTo(520L);
        assertThat(result.get("inserted")).isEqualTo(9);
    }

    @Test
    void getSubcategoryHealth_returnsBenchmark() {
        SubcategoryBaseline baseline = new SubcategoryBaseline();
        baseline.setMarketplace("UK");
        baseline.setBsrId("garden/outdoors");
        baseline.setSubCategory("Garden Sun Catchers");
        baseline.setCanonicalKey(null);
        baseline.setBaselineMonth("202606");
        baseline.setSampleSize(35);
        baseline.setUnitsP50(18);
        baseline.setUnitsP75(31);
        baseline.setUnitsP90(48);
        baseline.setPriceP50(new BigDecimal("9.99"));
        baseline.setConfidence("mid");
        when(subcategoryBaselineMapper.selectOne(any())).thenReturn(baseline);

        Map<String, Object> result = service.getSubcategoryHealth("UK", "garden/outdoors", "Garden Sun Catchers", null);

        assertThat(result.get("hasBaseline")).isEqualTo(true);
        assertThat(result.get("bsrId")).isEqualTo("garden/outdoors");
        assertThat(result.get("queryBsrId")).isEqualTo("garden/outdoors");
        assertThat(result.get("resolvedBy")).isEqualTo("AMAZON_LEAF");
        assertThat(result.get("matchedRawSubCategory")).isEqualTo("Garden Sun Catchers");
        assertThat(result.get("priceP50")).isEqualTo(new BigDecimal("9.99"));
        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        assertThat(units.get("p50")).isEqualTo(18);
        assertThat(units.get("p75")).isEqualTo(31);
        assertThat(units.get("p90")).isEqualTo(48);
    }

    @Test
    void getSubcategoryHealth_requiresBsrIdToSeparateSameLeafInDifferentBigCategories() {
        // 同 leaf 名 "Glass Art & Suncatchers" 在 home 和 arts-crafts 两个 bsr_id 下都有命中。
        // 旧粒度会揉成一行；新粒度 4 列 ((marketplace, bsr_id, sub_category, baseline_month))
        // 让 mapper 必须分别命中两行，不再相互污染。
        SubcategoryBaseline homeBaseline = new SubcategoryBaseline();
        homeBaseline.setMarketplace("UK");
        homeBaseline.setBsrId("home");
        homeBaseline.setSubCategory("Glass Art & Suncatchers");
        homeBaseline.setBaselineMonth("202606");
        homeBaseline.setSampleSize(60);
        homeBaseline.setUnitsP50(12);
        homeBaseline.setUnitsP75(20);
        homeBaseline.setUnitsP90(33);
        homeBaseline.setPriceP50(new BigDecimal("14.50"));
        homeBaseline.setConfidence("mid");

        SubcategoryBaseline artsBaseline = new SubcategoryBaseline();
        artsBaseline.setMarketplace("UK");
        artsBaseline.setBsrId("arts-crafts");
        artsBaseline.setSubCategory("Glass Art & Suncatchers");
        artsBaseline.setBaselineMonth("202606");
        artsBaseline.setSampleSize(45);
        artsBaseline.setUnitsP50(5);
        artsBaseline.setUnitsP75(9);
        artsBaseline.setUnitsP90(14);
        artsBaseline.setPriceP50(new BigDecimal("22.00"));
        artsBaseline.setConfidence("mid");

        when(subcategoryBaselineMapper.selectOne(any()))
                .thenReturn(homeBaseline)
                .thenReturn(artsBaseline);

        Map<String, Object> homeResult = service.getSubcategoryHealth(
                "UK", "home", "Glass Art & Suncatchers", "202606");
        Map<String, Object> artsResult = service.getSubcategoryHealth(
                "UK", "arts-crafts", "Glass Art & Suncatchers", "202606");

        assertThat(homeResult.get("bsrId")).isEqualTo("home");
        assertThat(homeResult.get("sampleSize")).isEqualTo(60);
        @SuppressWarnings("unchecked")
        Map<String, Object> homeUnits = (Map<String, Object>) homeResult.get("units");
        assertThat(homeUnits.get("p50")).isEqualTo(12);

        assertThat(artsResult.get("bsrId")).isEqualTo("arts-crafts");
        assertThat(artsResult.get("sampleSize")).isEqualTo(45);
        @SuppressWarnings("unchecked")
        Map<String, Object> artsUnits = (Map<String, Object>) artsResult.get("units");
        assertThat(artsUnits.get("p50")).isEqualTo(5);
    }
}
