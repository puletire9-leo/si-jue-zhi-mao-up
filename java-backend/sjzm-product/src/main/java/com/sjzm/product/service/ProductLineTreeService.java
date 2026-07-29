package com.sjzm.product.service;

import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.modules.shopcollection.mapper.ShopProductMapper;
import com.sjzm.product.util.DayBatchSupport;
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
    private final ShopProductMapper shopProductMapper;

    public Map<String, Object> getTree(String marketplace, String month) {
        return getTree(marketplace, month, null);
    }

    /**
     * 带方法卡口径的品线树. methodId=M01 时 productCount 按 M01 硬筛后重算 (与方法卡商品列表一致).
     * methodId 为 null 或非 M01 时保持原有 productCount (全量竞品).
     */
    public Map<String, Object> getTree(String marketplace, String month, String methodId) {
        List<Map<String, Object>> l2Rows;
        if ("M01".equalsIgnoreCase(methodId)) {
            l2Rows = countByNodeIdWithM01Filter(marketplace, month);
        } else {
            l2Rows = competitorProductMapper.countByNodeId(marketplace, month);
        }
        Map<String, Object> tree = buildTree(l2Rows, new HashMap<>(), new ArrayList<>(), false);
        tree.put("marketplace", marketplace);
        tree.put("month", month);
        if (methodId != null && !methodId.isEmpty()) {
            tree.put("methodId", methodId);
        }
        return tree;
    }

    /**
     * 品线树跟随批次口径（替代按月）。batchDates 为 yyyy-MM-dd 列表；
     * 为空时自动取该站点/口径下最新批次（第一条），保证默认展示最新导入。
     * methodId=M01 时 productCount 按 M01 硬筛重算，与方法卡商品列表一致。
     */
    public Map<String, Object> getTreeByBatch(String marketplace, List<String> batchDates, String methodId) {
        return getTreeByBatch(marketplace, batchDates, methodId, null);
    }

    /**
     * 品线树跟随批次口径，支持双数据源。dataSource：
     *   "new"/null → 新品榜(competitor_products_clean)；"shop" → 店铺(shop_products)；
     *   "all" → 两源统计后按 (bsrId,nodeId) 合并 productCount。
     * methodId=M01 时固定走新品榜 M01 硬筛口径(店铺无该口径)，dataSource 仅在无方法卡时生效。
     * 批次日期两源同为 yyyy-MM-dd 展示：新品榜按 DATE(created_at) 匹配，店铺按 batch_date(yyyyMMdd) 匹配(内部归一)。
     */
    public Map<String, Object> getTreeByBatch(String marketplace, List<String> batchDates,
                                              String methodId, String dataSource) {
        List<String> requested = normalizeBatchDates(batchDates);
        // 数据源不再被方法卡屏蔽：methodId 与 dataSource 组合决定每个源用哪套统计口径。
        String source = (dataSource == null || dataSource.isEmpty()) ? "all" : dataSource.toLowerCase();

        List<Map<String, Object>> l2Rows;
        List<String> usedDays;
        switch (source) {
            case "shop" -> {
                usedDays = resolveShopBatchDays(marketplace, requested);
                l2Rows = shopRowsByBatch(marketplace, usedDays, methodId);
            }
            case "all" -> {
                // 两源各自跟随批次(某天只有一源有数据也各自返回)，行级按 (bsrId,nodeId) 合并求和。
                List<String> newDays = resolveNewBatchDays(marketplace, requested);
                List<String> shopDays = resolveShopBatchDays(marketplace, requested);
                List<Map<String, Object>> newRows = newRowsByBatch(marketplace, newDays, methodId);
                List<Map<String, Object>> shopRows = shopRowsByBatch(marketplace, shopDays, methodId);
                l2Rows = mergeNodeRows(newRows, shopRows);
                usedDays = mergeDistinct(newDays, shopDays);
            }
            default -> { // "new"
                usedDays = resolveNewBatchDays(marketplace, requested);
                l2Rows = newRowsByBatch(marketplace, usedDays, methodId);
            }
        }

        Map<String, Object> tree = buildTree(l2Rows, new HashMap<>(), new ArrayList<>(), false);
        tree.put("marketplace", marketplace);
        tree.put("batchDates", usedDays);
        tree.put("dataSource", source);
        if (methodId != null && !methodId.isEmpty()) {
            tree.put("methodId", methodId);
        }
        return tree;
    }

    /** 去空/trim/去重；无有效项返回空列表。 */
    private List<String> normalizeBatchDates(List<String> batchDates) {
        if (batchDates == null || batchDates.isEmpty()) return Collections.emptyList();
        return batchDates.stream()
                .filter(d -> d != null && !d.isBlank())
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());
    }

    /** 新品榜(clean 表)批次日：传入非空原样返回；为空取最新单天批次(无数据返回空=全量)。 */
    private List<String> resolveNewBatchDays(String marketplace, List<String> requested) {
        if (!requested.isEmpty()) return requested;
        List<Map<String, Object>> batches = competitorProductMapper
                .selectCleanCreatedWeeksWithCount(marketplace, null);
        if (batches != null && !batches.isEmpty()) {
            Object latest = batches.get(0).get("week");
            if (latest != null) return List.of(String.valueOf(latest));
        }
        return Collections.emptyList();
    }

    /** 店铺(shop_products)批次日：传入非空原样返回；为空取最新单天批次(无数据返回空=全量)。 */
    private List<String> resolveShopBatchDays(String marketplace, List<String> requested) {
        if (!requested.isEmpty()) return requested;
        List<Map<String, Object>> batches = shopProductMapper.selectSelectionWeeks(marketplace);
        if (batches != null && !batches.isEmpty()) {
            Object latest = batches.get(0).get("week");
            if (latest != null) return List.of(String.valueOf(latest));
        }
        return Collections.emptyList();
    }

    /** yyyy-MM-dd → yyyyMMdd(店铺 batch_date 列口径)。 */
    private List<String> toCompactDays(List<String> days) {
        if (days == null || days.isEmpty()) return Collections.emptyList();
        return days.stream()
                .map(DayBatchSupport::normalizeToCompactDate)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> mergeDistinct(List<String> a, List<String> b) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        if (a != null) set.addAll(a);
        if (b != null) set.addAll(b);
        return new ArrayList<>(set);
    }

    /** 两源节点行按 (bsrId,nodeId) 合并 productCount，其余列取先出现者。 */
    private List<Map<String, Object>> mergeNodeRows(List<Map<String, Object>> a, List<Map<String, Object>> b) {
        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        for (List<Map<String, Object>> src : List.of(
                a == null ? Collections.<Map<String, Object>>emptyList() : a,
                b == null ? Collections.<Map<String, Object>>emptyList() : b)) {
            for (Map<String, Object> row : src) {
                String key = String.valueOf(row.get("bsrId")) + "\u0001" + String.valueOf(row.get("nodeId"));
                Map<String, Object> exist = merged.get(key);
                if (exist == null) {
                    merged.put(key, new LinkedHashMap<>(row));
                } else {
                    int sum = ((Number) exist.get("productCount")).intValue()
                            + ((Number) row.get("productCount")).intValue();
                    exist.put("productCount", sum);
                    if (exist.get("nodeFullPath") == null && row.get("nodeFullPath") != null) {
                        exist.put("nodeFullPath", row.get("nodeFullPath"));
                        exist.put("nodeName", row.get("nodeName"));
                    }
                }
            }
        }
        return new ArrayList<>(merged.values());
    }

    /**
     * 按 M01 硬筛条件统计各 node 的商品数, 参数与 MethodCardServiceImpl.ruleFor() 严格对齐.
     */
    private List<Map<String, Object>> countByNodeIdWithM01Filter(String marketplace, String month) {
        String normalized = marketplace == null ? "UK" : marketplace.toUpperCase();
        return switch (normalized) {
            case "DE" -> competitorProductMapper.countByNodeIdForM01(
                    "DE", month,
                    new java.math.BigDecimal("5.99"), new java.math.BigDecimal("18.99"),
                    new java.math.BigDecimal("300"), 90, 4, 20, 50, 25000);
            case "US" -> competitorProductMapper.countByNodeIdForM01(
                    "US", month,
                    new java.math.BigDecimal("6.99"), new java.math.BigDecimal("25.99"),
                    new java.math.BigDecimal("300"), 90, 50, 120, 200, null);
            case "UK" -> competitorProductMapper.countByNodeIdForM01(
                    "UK", month,
                    new java.math.BigDecimal("4.99"), new java.math.BigDecimal("17.99"),
                    new java.math.BigDecimal("300"), 90, 2, 10, 30, 20000);
            default -> throw new IllegalArgumentException("M01 暂只支持 UK / DE / US");
        };
    }

    /** M01 硬筛的按批次日期统计，参数口径与 countByNodeIdWithM01Filter 完全一致。 */
    private List<Map<String, Object>> countByNodeIdForM01ByBatch(String marketplace, List<String> batchDates) {
        String normalized = marketplace == null ? "UK" : marketplace.toUpperCase();
        return switch (normalized) {
            case "DE" -> competitorProductMapper.countByNodeIdForM01ByBatch(
                    "DE", batchDates,
                    new java.math.BigDecimal("5.99"), new java.math.BigDecimal("18.99"),
                    new java.math.BigDecimal("300"), 90, 4, 20, 50, 25000);
            case "US" -> competitorProductMapper.countByNodeIdForM01ByBatch(
                    "US", batchDates,
                    new java.math.BigDecimal("6.99"), new java.math.BigDecimal("25.99"),
                    new java.math.BigDecimal("300"), 90, 50, 120, 200, null);
            case "UK" -> competitorProductMapper.countByNodeIdForM01ByBatch(
                    "UK", batchDates,
                    new java.math.BigDecimal("4.99"), new java.math.BigDecimal("17.99"),
                    new java.math.BigDecimal("300"), 90, 2, 10, 30, 20000);
            default -> throw new IllegalArgumentException("M01 暂只支持 UK / DE / US");
        };
    }

    /**
     * 新品榜(competitor_products_clean)按批次 + 方法卡统计节点商品数。
     * M01→M01 硬筛；M03→M03 硬筛；null→全量。口径与方法卡列表页严格一致。
     */
    private List<Map<String, Object>> newRowsByBatch(String marketplace, List<String> batchDates, String methodId) {
        if ("M01".equalsIgnoreCase(methodId)) {
            return countByNodeIdForM01ByBatch(marketplace, batchDates);
        }
        if ("M03".equalsIgnoreCase(methodId)) {
            com.sjzm.product.methodrule.M03Rule rule =
                    com.sjzm.product.methodrule.M03Rule.forMarketplace(marketplace);
            return competitorProductMapper.countByNodeIdForM03ByBatch(
                    marketplace, batchDates, rule.listingDaysMax(), rule.sales90());
        }
        return competitorProductMapper.countByNodeIdByBatch(marketplace, batchDates);
    }

    /**
     * 店铺(shop_products)按批次 + 方法卡统计节点商品数，口径与 ShopCollectionService.applySelectionMethodRule 一致。
     * M01→M01 硬筛；M03→M03 硬筛；null→全量。batchDates 需先归一为 yyyyMMdd(此方法内部处理)。
     */
    private List<Map<String, Object>> shopRowsByBatch(String marketplace, List<String> days, String methodId) {
        List<String> compactDates = toCompactDays(days);
        if ("M01".equalsIgnoreCase(methodId)) {
            com.sjzm.product.methodrule.M01Rule rule =
                    com.sjzm.product.methodrule.M01Rule.forMarketplace(marketplace);
            return shopProductMapper.countByNodeIdForM01ByBatch(
                    marketplace, compactDates,
                    rule.priceMin(), rule.priceMax(), rule.weightMax(), rule.listingDaysMax(),
                    rule.sales30(), rule.sales60(), rule.sales90(), rule.salesMax(), rule.bsrMax());
        }
        if ("M03".equalsIgnoreCase(methodId)) {
            com.sjzm.product.methodrule.M03Rule rule =
                    com.sjzm.product.methodrule.M03Rule.forMarketplace(marketplace);
            return shopProductMapper.countByNodeIdForM03ByBatch(
                    marketplace, compactDates, rule.listingDaysMax(), rule.sales90());
        }
        return shopProductMapper.countByNodeIdByBatch(marketplace, compactDates);
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
