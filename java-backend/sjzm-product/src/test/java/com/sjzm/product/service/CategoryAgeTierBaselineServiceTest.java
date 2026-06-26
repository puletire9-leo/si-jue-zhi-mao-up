package com.sjzm.product.service;

import com.sjzm.product.mapper.CategoryAgeTierBaselineMapper;
import com.sjzm.product.service.impl.CategoryAgeTierBaselineServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryAgeTierBaselineServiceTest {

    @Mock
    CategoryAgeTierBaselineMapper mapper;

    @InjectMocks
    CategoryAgeTierBaselineServiceImpl service;

    @Test
    void computeAndTagByMonth_normalizesMonthAndMarketplace() {
        when(mapper.deleteByBaselineMonth("202606", "UK")).thenReturn(12);
        when(mapper.insertComputedSlices("202606", "UK")).thenReturn(36);
        when(mapper.tagAsinsByMonth("202606", "UK")).thenReturn(8500);

        Map<String, Object> result = service.computeAndTagByMonth("2026-06", "uk");

        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("basesDeleted")).isEqualTo(12);
        assertThat(result.get("basesInserted")).isEqualTo(36);
        assertThat(result.get("asinsTagged")).isEqualTo(8500);
    }

    @Test
    void computeAndTagByMonth_allMarketplacesWhenNull() {
        when(mapper.deleteByBaselineMonth("202606", null)).thenReturn(0);
        when(mapper.insertComputedSlices("202606", null)).thenReturn(108);
        when(mapper.tagAsinsByMonth("202606", null)).thenReturn(19575);

        Map<String, Object> result = service.computeAndTagByMonth("202606", null);

        assertThat(result.get("marketplace")).isEqualTo("ALL");
        assertThat(result.get("basesInserted")).isEqualTo(108);
        assertThat(result.get("asinsTagged")).isEqualTo(19575);
    }

    @Test
    void computeAndTagByMonth_rejectsInvalidMonth() {
        assertThatThrownBy(() -> service.computeAndTagByMonth("2026", "UK"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("month 只支持");

        assertThatThrownBy(() -> service.computeAndTagByMonth(null, "UK"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("month 不能为空");
    }

    @Test
    void tagAsinsByWeek_callsMapperWithNormalizedArgs() {
        when(mapper.tagAsinsByWeek("2026-W26", "202606", "DE")).thenReturn(5200);

        Map<String, Object> result = service.tagAsinsByWeek("2026-W26", "2026-06", "de");

        assertThat(result.get("weekTag")).isEqualTo("2026-W26");
        assertThat(result.get("baselineMonth")).isEqualTo("202606");
        assertThat(result.get("marketplace")).isEqualTo("DE");
        assertThat(result.get("asinsTagged")).isEqualTo(5200);
    }

    @Test
    void tagAsinsByWeek_rejectsBlankWeekTag() {
        assertThatThrownBy(() -> service.tagAsinsByWeek("  ", "202606", "DE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("weekTag");
    }
}
