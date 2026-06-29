package com.sjzm.product.service;

import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductLineTreeService {

    static final int MIN_ZENG = 3;
    static final String ZHENG_METHOD_ID = "M02";
    static final String ZHENG_METHOD_NAME = "郑总同行品线跟随法";

    private final ForbiddenCategoryService forbiddenCategoryService;
    private final CompetitorProductMapper competitorProductMapper;
    private final DengZongShopMapper dengZongShopMapper;
    private final DengZongShopService dengZongShopService;

    public Map<String, Object> getTree(String marketplace, String month) {
        List<Map<String, Object>> l2Rows = competitorProductMapper.countByNodeId(marketplace, month);
        Map<String, Object> tree = buildTree(l2Rows, new HashMap<>(), new ArrayList<>(), false);
        tree.put("marketplace", marketplace);
        tree.put("month", month);
        return tree;
    }

    /**
     * 构建品线树。
     * @param l2Rows          竞品 countByNodeId 结果（含 bsrId/nodeId/nodeFullPath/nodeName/productCount）
     * @param zhengCounts     郑总各子类商品数：key="bsrId_nodeId" -> count
     * @param zhengBsrIdOrder 郑总 bsr_id 按商品数降序的榜单顺序
     */
    public Map<String, Object> buildTree(
            List<Map<String, Object>> l2Rows,
            Map<String, Integer> zhengCounts,
            List<String> zhengBsrIdOrder,
            boolean useZhengMethod) {

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
                if (useZhengMethod && aZc != bZc) return Integer.compare(bZc, aZc);
                int countA = ((Number) a.get("productCount")).intValue();
                int countB = ((Number) b.get("productCount")).intValue();
                return Integer.compare(countB, countA);
            });
            children.forEach(child -> {
                if (useZhengMethod) {
                    int zc = zhengCounts.getOrDefault(bsrId + "_" + child.get("nodeId"), 0);
                    child.put("methodHit", zc >= MIN_ZENG);
                    child.put("methodHitCount", zc);
                }
            });

            Map<String, Object> line = new LinkedHashMap<>();
            line.put("bsrId", bsrId);
            line.put("bsrName", extractBsrName(children));
            line.put("productCount", totalCount);
            line.put("subCategories", children);
            boolean lineHasZheng = children.stream().anyMatch(c ->
                    zhengCounts.getOrDefault(bsrId + "_" + c.get("nodeId"), 0) >= MIN_ZENG);
            if (useZhengMethod) {
                line.put("methodHit", lineHasZheng);
                line.put("methodHitCount",
                        children.stream().mapToInt(c -> zhengCounts.getOrDefault(bsrId + "_" + c.get("nodeId"), 0)).sum());
            }
            lines.add(line);
        }

        lines.sort((a, b) -> {
            int aIdx = zhengBsrIdOrder.indexOf((String) a.get("bsrId"));
            int bIdx = zhengBsrIdOrder.indexOf((String) b.get("bsrId"));
            if (useZhengMethod && aIdx >= 0 && bIdx >= 0) return Integer.compare(aIdx, bIdx);
            if (useZhengMethod && aIdx >= 0) return -1;
            if (useZhengMethod && bIdx >= 0) return 1;
            int countA = ((Number) a.get("productCount")).intValue();
            int countB = ((Number) b.get("productCount")).intValue();
            return Integer.compare(countB, countA);
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productLines", lines);
        return result;
    }

    private Map<String, Integer> loadZhengCounts(String marketplace, String zhengBatchDate) {
        if (zhengBatchDate == null) {
            return new HashMap<>();
        }

        Map<String, Integer> zhengCounts = new HashMap<>();
        for (Map<String, Object> row : dengZongShopMapper.selectZhengNodeCounts(marketplace, zhengBatchDate)) {
            String key = (String) row.get("composite_key");
            Integer count = row.get("product_count") instanceof Number
                    ? ((Number) row.get("product_count")).intValue() : 0;
            if (key != null) {
                zhengCounts.put(key, count);
            }
        }
        return zhengCounts;
    }

    private List<String> loadZhengBsrIdOrder(String marketplace, String zhengBatchDate) {
        if (zhengBatchDate == null) {
            return new ArrayList<>();
        }

        return dengZongShopMapper.selectZhengBsrIdsOrdered(marketplace, zhengBatchDate).stream()
                .map(row -> (String) row.get("bsrId"))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
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
