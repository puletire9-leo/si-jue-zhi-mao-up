package com.sjzm.product.service;

import com.sjzm.product.mapper.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * getCreatedWeeks 的 Service 层契约测试。
 * 注意：ISO 周分组 / NULL 排除 / 起止日期等逻辑在 SQL 里（DATE_FORMAT），
 * 纯 Mockito 测不到，需 DB 集成测试覆盖；此处验证委托与"最新批次在第一条"的顺序契约。
 */
@ExtendWith(MockitoExtension.class)
class CompetitorServiceCreatedWeeksTest {

    @Mock SellerspriteApiService ssApi;
    @Mock CompetitorProductMapper productMapper;
    @Mock CompetitorSubcategoryMapper subcategoryMapper;
    @Mock CompetitorFilterService filterService;
    @Mock SkipAsinMapper skipAsinMapper;
    @Mock ShopMapper shopMapper;

    @InjectMocks CompetitorService service;

    private Map<String, Object> week(String w, int count, String start, String end) {
        Map<String, Object> m = new HashMap<>();
        m.put("week", w);
        m.put("count", count);
        m.put("startDate", start);
        m.put("endDate", end);
        return m;
    }

    @Test
    void getCreatedWeeks_passesParamsAndPreservesLatestFirstOrder() {
        List<Map<String, Object>> mapperResult = List.of(
                week("2026-W19", 142, "2026-05-04", "2026-05-10"),
                week("2026-W18", 98, "2026-04-27", "2026-05-03")
        );
        // filterMode 不传（去 MODE1 默认后统计全部周）
        when(productMapper.selectCreatedWeeksWithCount("UK", "竞品", null))
                .thenReturn(mapperResult);

        List<Map<String, Object>> result = service.getCreatedWeeks("UK", "竞品", null);

        verify(productMapper).selectCreatedWeeksWithCount(eq("UK"), eq("竞品"), eq(null));
        assertThat(result).hasSize(2);
        // 第一条必须是最新批次（前端默认选中它）
        assertThat(result.get(0).get("week")).isEqualTo("2026-W19");
        assertThat(result.get(0).get("count")).isEqualTo(142);
    }

    @Test
    void getCreatedWeeks_emptyResultDoesNotThrow() {
        when(productMapper.selectCreatedWeeksWithCount("UK", "新品榜", null))
                .thenReturn(Collections.emptyList());

        assertThat(service.getCreatedWeeks("UK", "新品榜", null)).isEmpty();
    }

    @Test
    void getCreatedWeeks_usesCleanTableWhenPageUsesCleanData() {
        List<Map<String, Object>> mapperResult = List.of(
                week("2026-W29", 2757, "2026-07-14", "2026-07-14"));
        when(productMapper.selectCleanCreatedWeeksWithCount("UK", "新品榜"))
                .thenReturn(mapperResult);

        List<Map<String, Object>> result = service.getCreatedWeeks("UK", "新品榜", null, true);

        verify(productMapper).selectCleanCreatedWeeksWithCount("UK", "新品榜");
        assertThat(result.get(0).get("count")).isEqualTo(2757);
    }
}
