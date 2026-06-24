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

    @Mock
    SubcategoryAliasService subcategoryAliasService;

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
        when(subcategoryAliasService.bootstrap("202606", null)).thenReturn(Map.of("winnerAliases", 12));
        when(subcategoryBaselineMapper.deleteByBaselineMonth("202606", null)).thenReturn(1);
        when(subcategoryBaselineMapper.insertComputedSlices("202606", null)).thenReturn(9);
        when(subcategoryBaselineMapper.selectCount(any())).thenReturn(9L);

        Map<String, Object> result = service.computeSubcategoryBaseline("2026-06", null);

        assertThat(result.get("success")).isEqualTo(true);
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("ALL");
        assertThat(result.get("aliasBootstrap")).isEqualTo(Map.of("winnerAliases", 12));
        assertThat(result.get("inserted")).isEqualTo(9);
    }

    @Test
    void getSubcategoryHealth_returnsBenchmark() {
        SubcategoryBaseline baseline = new SubcategoryBaseline();
        baseline.setMarketplace("UK");
        baseline.setBsrId("garden/outdoors");
        baseline.setSubCategory("Garden Sun Catchers");
        baseline.setBaselineMonth("202606");
        baseline.setSampleSize(35);
        baseline.setUnitsP50(18);
        baseline.setUnitsP75(31);
        baseline.setUnitsP90(48);
        baseline.setPriceP50(new BigDecimal("9.99"));
        baseline.setConfidence("mid");
        when(subcategoryBaselineMapper.selectOne(any())).thenReturn(baseline);

        Map<String, Object> result = service.getSubcategoryHealth("UK", "Garden Sun Catchers", null);

        assertThat(result.get("hasBaseline")).isEqualTo(true);
        assertThat(result.get("bsrId")).isEqualTo("garden/outdoors");
        assertThat(result.get("priceP50")).isEqualTo(new BigDecimal("9.99"));
        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        assertThat(units.get("p50")).isEqualTo(18);
        assertThat(units.get("p75")).isEqualTo(31);
        assertThat(units.get("p90")).isEqualTo(48);
    }
}
