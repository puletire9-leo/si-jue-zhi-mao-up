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
import static org.mockito.ArgumentMatchers.anyString;
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
        Map<String, Object> result = service.buildTree(rows, Map.of(), List.of(), false);
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");

        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).get("bsrId")).isEqualTo("b2");
    }

    @Test
    @SuppressWarnings("unchecked")
    void zhengLineSortsBeforeNonZheng() {
        lenient().when(forbiddenCategoryService.isForbidden(anyString())).thenReturn(false);

        List<Map<String, Object>> rows = List.of(
                row("big", 11L, "A:Big", 100),
                row("zh", 21L, "B:Zheng", 10)
        );
        // zhengCounts: zh 子类命中 5 (>= MIN_ZENG=3)；启用郑总方法时 zh 应排到 big 前面
        Map<String, Integer> zhengCounts = Map.of("zh_21", 5);
        List<String> zhengBsrOrder = List.of("zh");

        Map<String, Object> result = service.buildTree(rows, zhengCounts, zhengBsrOrder, true);
        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");

        // useZhengMethod=true 时按 zhengBsrOrder 排序，zh 在前；命中标记字段是 methodHit
        assertThat(lines.get(0).get("bsrId")).isEqualTo("zh");
        assertThat(lines.get(0).get("methodHit")).isEqualTo(true);
        assertThat(lines.get(1).get("bsrId")).isEqualTo("big");
        assertThat(lines.get(1).get("methodHit")).isEqualTo(false);
    }

    @Test
    @SuppressWarnings("unchecked")
    void emptyRowsYieldEmptyLines() {
        Map<String, Object> result = service.buildTree(List.of(), Map.of(), List.of(), false);
        assertThat((List<Map<String, Object>>) result.get("productLines")).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void getTreeReturnsL1ListThroughServiceLayer() {
        // 当前 getTree 是纯 L1 列表（buildTree 用空郑总数据 + useZhengMethod=false），
        // 不再加载郑总批次/计数，只回 marketplace/month/productLines
        lenient().when(forbiddenCategoryService.isForbidden(anyString())).thenReturn(false);
        when(competitorProductMapper.countByNodeId("UK", "202506"))
                .thenReturn(List.of(row("zh", 21L, "Home & Garden:Wall Art", 10)));

        Map<String, Object> result = service.getTree("UK", "202506");

        assertThat(result.get("marketplace")).isEqualTo("UK");
        assertThat(result.get("month")).isEqualTo("202506");

        List<Map<String, Object>> lines = (List<Map<String, Object>>) result.get("productLines");
        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).get("bsrId")).isEqualTo("zh");
    }
}
