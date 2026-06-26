package com.sjzm.product.service;

import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductLineTreeServiceTest {

    @Mock
    ForbiddenCategoryService forbiddenCategoryService;

    @Mock
    CompetitorProductMapper competitorProductMapper;

    @Mock
    DengZongShopMapper dengZongShopMapper;

    @Mock
    DengZongShopService dengZongShopService;

    @InjectMocks
    ProductLineTreeService service;

    private Map<String, Object> row(String bsrId, long nodeId, String fullPath, int count) {
        Map<String, Object> m = new HashMap<>();
        m.put("bsrId", bsrId);
        m.put("nodeId", nodeId);
        m.put("nodeFullPath", fullPath);
        m.put("nodeName", fullPath.substring(fullPath.lastIndexOf(':') + 1));
        m.put("productCount", count);
        return m;
    }

    @Test
    @SuppressWarnings("unchecked")
    void excludesForbiddenL1Category() {
        when(forbiddenCategoryService.isForbidden("Electronics")).thenReturn(true);
        when(forbiddenCategoryService.isForbidden("Home & Garden")).thenReturn(false);

        List<Map<String, Object>> rows = List.of(
                row("b1", 11L, "Electronics:Headphones", 50),
                row("b2", 21L, "Home & Garden:Wall Art", 30)
        );
        Map<String, Object> result = service.buildTree(rows, Map.of(), List.of());
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");

        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).get("bsrId")).isEqualTo("b2");
    }

    @Test
    @SuppressWarnings("unchecked")
    void zhengLineSortsBeforeNonZheng() {
        lenient().when(forbiddenCategoryService.isForbidden(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        List<Map<String, Object>> rows = List.of(
                row("big", 11L, "A:Big", 100),
                row("zh", 21L, "B:Zheng", 10)
        );
        Map<String, Integer> zhengCounts = Map.of("zh_21", 5);
        List<String> zhengBsrOrder = List.of("zh");

        Map<String, Object> result = service.buildTree(rows, zhengCounts, zhengBsrOrder);
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");

        assertThat(lines.get(0).get("bsrId")).isEqualTo("zh");
        assertThat(lines.get(0).get("isZheng")).isEqualTo(true);
        assertThat(lines.get(1).get("bsrId")).isEqualTo("big");
        assertThat(lines.get(1).get("isZheng")).isEqualTo(false);
    }

    @Test
    @SuppressWarnings("unchecked")
    void emptyRowsYieldEmptyLines() {
        Map<String, Object> result = service.buildTree(List.of(), Map.of(), List.of());
        assertThat((List<Map<String, Object>>) result.get("productLines")).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void getTreeLoadsDataThroughServiceLayer() {
        lenient().when(forbiddenCategoryService.isForbidden(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);
        when(competitorProductMapper.countByNodeId("UK", "202506"))
                .thenReturn(List.of(row("zh", 21L, "Home & Garden:Wall Art", 10)));
        when(dengZongShopService.getMaxBatchDate("UK")).thenReturn("20250624");

        Map<String, Object> zhengCountRow = new HashMap<>();
        zhengCountRow.put("composite_key", "zh_21");
        zhengCountRow.put("product_count", 5);
        when(dengZongShopMapper.selectZhengNodeCounts("UK", "20250624"))
                .thenReturn(List.of(zhengCountRow));

        when(dengZongShopMapper.selectZhengBsrIdsOrdered("UK", "20250624"))
                .thenReturn(List.of(Map.of("bsrId", "zh", "productCount", 1)));

        Map<String, Object> result = service.getTree("UK", "202506");

        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("month")).isEqualTo("202506");
        assertThat(result.get("zhengBatchDate")).isEqualTo("20250624");

        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");
        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).get("bsrId")).isEqualTo("zh");
        assertThat(lines.get(0).get("isZheng")).isEqualTo(true);
    }
}
