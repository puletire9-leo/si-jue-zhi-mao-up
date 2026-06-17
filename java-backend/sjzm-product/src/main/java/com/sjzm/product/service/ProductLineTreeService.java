package com.sjzm.product.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductLineTreeService {

    static final int MIN_ZENG = 3;

    private final ForbiddenCategoryService forbiddenCategoryService;

    /**
     * 构建品线树。
     * @param l2Rows          竞品 countByNodeId 结果（含 bsrId/nodeId/nodeFullPath/nodeName/productCount）
     * @param zhengCounts     郑总各子类商品数：key="bsrId_nodeId" -> count
     * @param zhengBsrIdOrder 郑总 bsr_id 按商品数降序的榜单顺序
     */
    public Map<String, Object> buildTree(
            List<Map<String, Object>> l2Rows,
            Map<String, Integer> zhengCounts,
            List<String> zhengBsrIdOrder) {

        List<Map<String, Object>> rows = l2Rows.stream()
                .filter(r -> r.get("bsrId") != null)
                .filter(r -> !forbiddenCategoryService.isForbidden(firstSegment((String) r.get("nodeFullPath"))))
                .collect(Collectors.toList());

        Map<String, List<Map<String, Object>>> grouped = rows.stream()
                .collect(Collectors.groupingBy(r -> (String) r.get("bsrId")));

        List<Map<String, Object>> lines = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            String bsrId = entry.getKey();
            List<Map<String, Object>> children = entry.getValue();
            int totalCount = children.stream()
                    .mapToInt(c -> ((Number) c.get("productCount")).intValue()).sum();

            children.sort((a, b) -> {
                int aZc = zhengCounts.getOrDefault(bsrId + "_" + a.get("nodeId"), 0);
                int bZc = zhengCounts.getOrDefault(bsrId + "_" + b.get("nodeId"), 0);
                if (aZc != bZc) return Integer.compare(bZc, aZc);
                int countA = ((Number) a.get("productCount")).intValue();
                int countB = ((Number) b.get("productCount")).intValue();
                return Integer.compare(countB, countA);
            });
            children.forEach(child -> {
                int zc = zhengCounts.getOrDefault(bsrId + "_" + child.get("nodeId"), 0);
                child.put("isZheng", zc >= MIN_ZENG);
                child.put("zhengCount", zc);
            });

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("bsrId", bsrId);
            line.put("bsrName", extractBsrName(children));
            line.put("productCount", totalCount);
            line.put("subCategories", children);
            boolean lineHasZheng = children.stream().anyMatch(c ->
                    zhengCounts.getOrDefault(bsrId + "_" + c.get("nodeId"), 0) >= MIN_ZENG);
            line.put("isZheng", lineHasZheng);
            line.put("zhengCount", children.stream()
                    .mapToInt(c -> zhengCounts.getOrDefault(bsrId + "_" + c.get("nodeId"), 0)).sum());
            lines.add(line);
        }

        lines.sort((a, b) -> {
            int aIdx = zhengBsrIdOrder.indexOf((String) a.get("bsrId"));
            int bIdx = zhengBsrIdOrder.indexOf((String) b.get("bsrId"));
            if (aIdx >= 0 && bIdx >= 0) return Integer.compare(aIdx, bIdx);
            if (aIdx >= 0) return -1;
            if (bIdx >= 0) return 1;
            int countA = ((Number) a.get("productCount")).intValue();
            int countB = ((Number) b.get("productCount")).intValue();
            return Integer.compare(countB, countA);
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productLines", lines);
        return result;
    }

    private String firstSegment(String path) {
        if (path == null || path.isEmpty()) return "";
        return path.split(":")[0];
    }

    private String extractBsrName(List<Map<String, Object>> children) {
        for (Map<String, Object> c : children) {
            String path = (String) c.get("nodeFullPath");
            if (path != null && !path.isEmpty()) return path.split(":")[0];
        }
        return "";
    }
}
