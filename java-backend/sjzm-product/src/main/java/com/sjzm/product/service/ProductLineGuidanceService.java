package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.DengZongShop;
import com.sjzm.product.entity.ProductLineGuidance;
import com.sjzm.product.mapper.DengZongShopMapper;
import com.sjzm.product.mapper.ProductLineGuidanceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 品线选品指导意见服务 — 郑总店铺品线聚合引擎。
 *
 * 数据源: deng_zong_shop 表（郑总29店 ~6991商品）
 * 聚合层级: L1品线(bsr_id) → L2小类(node_id) → 样本商品
 *
 * 3个核心方法:
 * 1. aggregateData(marketplace, month) — 从deng_zong_shop聚合，建立郑总模型
 * 2. saveAnalysisResults(batchId, results) — 保存Agent分析结果
 * 3. queryGuidance(batchId) — 查询已保存的分析指导
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductLineGuidanceService {

    /** 小类最少商品数阈值：低于此数跳过分析（噪声品类） */
    private static final int MIN_SUB_PRODUCTS = 10;

    private final ProductLineGuidanceMapper guidanceMapper;
    private final DengZongShopMapper dengZongShopMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 从 deng_zong_shop 按 marketplace+month 两级聚合品线数据。
     *
     * L1: bsr_id（亚马逊大类，如 beauty/sports）
     * L2: node_id（小类节点，如 Nail Tips）
     *
     * @param marketplace 站点 UK/DE
     * @param month       数据月份 如 202605
     * @return {"batchId": "...", "productLines": [{bsrId, subCategories: [...]}, ...]}
     */
    public Map<String, Object> aggregateData(String marketplace, String month) {
        log.info("品线聚合: marketplace={}, month={}", marketplace, month);

        // 从 deng_zong_shop 查询
        LambdaQueryWrapper<DengZongShop> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DengZongShop::getMarketplace, marketplace)
               .eq(DengZongShop::getMonth, month);
        List<DengZongShop> all = dengZongShopMapper.selectList(wrapper);

        if (all.isEmpty()) {
            log.warn("deng_zong_shop 无数据: marketplace={}, month={}", marketplace, month);
            return Map.of("productLines", List.of(), "batchId", "");
        }

        // ── L1: 按 bsr_id 分组 ──
        Map<String, List<DengZongShop>> byBsrId = all.stream()
                .filter(p -> p.getBsrId() != null && !p.getBsrId().isEmpty())
                .collect(Collectors.groupingBy(DengZongShop::getBsrId,
                        LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> productLines = new ArrayList<>();

        for (Map.Entry<String, List<DengZongShop>> entry : byBsrId.entrySet()) {
            String bsrId = entry.getKey();
            List<DengZongShop> bsrProducts = entry.getValue();

            // L1 品线统计
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("bsrId", bsrId);
            line.put("productCount", bsrProducts.size());

            // 总销量/营收
            long totalUnits = bsrProducts.stream()
                    .map(DengZongShop::getUnits).filter(Objects::nonNull)
                    .mapToLong(Integer::intValue).sum();
            line.put("totalUnits", totalUnits);

            BigDecimal totalRevenue = bsrProducts.stream()
                    .map(DengZongShop::getRevenue).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            line.put("totalRevenue", totalRevenue);

            // 平均利润率
            double avgProfitRate = bsrProducts.stream()
                    .filter(p -> p.getProfit() != null && p.getPrice() != null
                            && p.getPrice().compareTo(BigDecimal.ZERO) > 0)
                    .mapToDouble(p -> p.getProfit().doubleValue() / p.getPrice().doubleValue() * 100)
                    .average().orElse(0);
            line.put("avgProfitRate", Math.round(avgProfitRate * 10.0) / 10.0);

            // 郑总店铺数
            long storeCount = bsrProducts.stream()
                    .map(DengZongShop::getSellerName).filter(Objects::nonNull).distinct().count();
            line.put("storeCount", (int) storeCount);

            // ── L2: 按 node_id 分组 ──
            Map<Long, List<DengZongShop>> byNodeId = bsrProducts.stream()
                    .filter(p -> p.getNodeId() != null)
                    .collect(Collectors.groupingBy(DengZongShop::getNodeId,
                            LinkedHashMap::new, Collectors.toList()));

            List<Map<String, Object>> subCategories = new ArrayList<>();
            for (Map.Entry<Long, List<DengZongShop>> nodeEntry : byNodeId.entrySet()) {
                Long nodeId = nodeEntry.getKey();
                List<DengZongShop> nodeProducts = nodeEntry.getValue();

                // 过滤：至少 MIN_SUB_PRODUCTS 个商品才有分析价值
                if (nodeProducts.size() < MIN_SUB_PRODUCTS) continue;

                Map<String, Object> sub = buildSubCategoryAggregation(
                        String.valueOf(nodeId), nodeProducts);
                subCategories.add(sub);
            }

            // 小类按商品数降序
            subCategories.sort((a, b) ->
                    ((Integer) b.get("productCount")) - ((Integer) a.get("productCount")));
            line.put("subCategoryCount", subCategories.size());
            line.put("subCategories", subCategories);

            productLines.add(line);
        }

        // 品线按商品数降序
        productLines.sort((a, b) ->
                ((Integer) b.get("productCount")) - ((Integer) a.get("productCount")));

        // 生成 batch_id
        String batchId = marketplace + "_" + month + "_"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));

        log.info("品线聚合完成: {} L1品线, {} 总商品, batchId={}",
                productLines.size(), all.size(), batchId);
        return Map.of(
                "batchId", batchId,
                "marketplace", marketplace,
                "month", month,
                "totalProducts", all.size(),
                "sourceTable", "deng_zong_shop",
                "productLines", productLines
        );
    }

    /**
     * 保存Agent分析结果。
     */
    @Transactional
    public Map<String, Object> saveAnalysisResults(String batchId, List<Map<String, Object>> results) {
        log.info("保存分析结果: batchId={}, {}条", batchId, results.size());

        // 先清理旧数据
        guidanceMapper.deleteByBatchId(batchId);

        List<ProductLineGuidance> guidanceList = new ArrayList<>();
        for (Map<String, Object> result : results) {
            ProductLineGuidance g = new ProductLineGuidance();
            g.setBatchId(batchId);
            g.setMarketplace((String) result.getOrDefault("marketplace", "UK"));
            g.setBsrId((String) result.getOrDefault("bsrId", ""));
            g.setNodeName((String) result.getOrDefault("nodeName", ""));
            g.setNodeFullPath((String) result.getOrDefault("nodeFullPath", ""));

            // 算法层确定性结果
            g.setArchetype((String) result.getOrDefault("archetype", "UNKNOWN"));
            g.setArchetypeMethod((String) result.getOrDefault("archetypeMethod", ""));
            g.setLifecycleStage((String) result.getOrDefault("lifecycleStage", ""));
            g.setLifecycleWindow((String) result.getOrDefault("lifecycleWindow", ""));

            Object cr3Obj = result.get("cr3");
            if (cr3Obj instanceof Number) {
                g.setCr3(BigDecimal.valueOf(((Number) cr3Obj).doubleValue()));
            }
            g.setCompetitionPattern((String) result.getOrDefault("competitionPattern", ""));
            g.setEntryBarrier((String) result.getOrDefault("entryBarrier", ""));

            Object marginObj = result.get("profitMargin");
            if (marginObj instanceof Number) {
                g.setProfitMargin(BigDecimal.valueOf(((Number) marginObj).doubleValue()));
            }
            g.setProfitVerdict((String) result.getOrDefault("profitVerdict", ""));

            Object scoreObj = result.get("opportunityScore");
            if (scoreObj instanceof Number) {
                g.setOpportunityScore(((Number) scoreObj).intValue());
            }
            g.setRecommendLevel((String) result.getOrDefault("recommendLevel", "WATCH"));
            g.setGoNoGo((String) result.getOrDefault("goNoGo", "WAIT_AND_SEE"));

            // JSON字段
            g.setPriceBandJson(toJson(result.get("priceBand")));
            g.setScoreBreakdownJson(toJson(result.get("scoreBreakdown")));
            g.setRiskRulesJson(toJson(result.get("riskRules")));
            g.setFullAnalysisJson(toJson(result));

            guidanceList.add(g);
        }

        if (!guidanceList.isEmpty()) {
            guidanceMapper.insertBatch(guidanceList);
        }

        log.info("保存完成: {}条指导意见", guidanceList.size());
        return Map.of("saved", guidanceList.size(), "batchId", batchId);
    }

    /**
     * 查询已保存的分析指导。
     */
    public List<ProductLineGuidance> queryGuidance(String batchId, String bsrId) {
        LambdaQueryWrapper<ProductLineGuidance> wrapper = new LambdaQueryWrapper<>();
        if (batchId != null && !batchId.isEmpty()) {
            wrapper.eq(ProductLineGuidance::getBatchId, batchId);
        }
        if (bsrId != null && !bsrId.isEmpty()) {
            wrapper.eq(ProductLineGuidance::getBsrId, bsrId);
        }
        wrapper.orderByDesc(ProductLineGuidance::getOpportunityScore);
        return guidanceMapper.selectList(wrapper);
    }

    // ─── 内部方法 ─────────────────────────────────────────────────────────

    /** 构建单个L2小类的聚合数据（数据源: DengZongShop） */
    private Map<String, Object> buildSubCategoryAggregation(String nodeIdStr, List<DengZongShop> products) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("nodeId", nodeIdStr);

        DengZongShop first = products.get(0);
        data.put("nodeName", extractNodeName(first.getNodeLabelPath()));
        data.put("nodeFullPath", first.getNodeLabelPath());
        data.put("productCount", products.size());

        // 价格统计
        List<BigDecimal> prices = products.stream()
                .map(DengZongShop::getPrice)
                .filter(Objects::nonNull)
                .filter(p -> p.compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());

        if (!prices.isEmpty()) {
            BigDecimal sum = prices.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            data.put("avgPrice", sum.divide(BigDecimal.valueOf(prices.size()), 2, RoundingMode.HALF_UP));
            data.put("priceMin", Collections.min(prices));
            data.put("priceMax", Collections.max(prices));
        } else {
            data.put("avgPrice", 0);
            data.put("priceMin", 0);
            data.put("priceMax", 0);
        }

        // 评分统计
        double avgRating = products.stream()
                .map(DengZongShop::getRating)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("avgRating", Math.round(avgRating * 100.0) / 100.0);

        long avgRatings = (long) products.stream()
                .map(DengZongShop::getRatings)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average().orElse(0);
        data.put("avgRatings", avgRatings);

        // 销量/营收
        long totalUnits = products.stream()
                .map(DengZongShop::getUnits)
                .filter(Objects::nonNull)
                .mapToLong(Integer::intValue).sum();
        data.put("totalUnits", totalUnits);

        BigDecimal totalRevenue = products.stream()
                .map(DengZongShop::getRevenue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        data.put("totalRevenue", totalRevenue);

        // 平均BSR
        long avgBsr = (long) products.stream()
                .map(DengZongShop::getBsr)
                .filter(Objects::nonNull)
                .filter(b -> b > 0)
                .mapToInt(Integer::intValue)
                .average().orElse(0);
        data.put("avgBsr", avgBsr);

        // 增速
        double avgGrowth = products.stream()
                .map(DengZongShop::getUnitsGr)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("unitsGrowthRate", Math.round(avgGrowth * 100.0) / 100.0);

        double avgBsrCr = products.stream()
                .map(DengZongShop::getBsrCr)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("bsrChangeRate", Math.round(avgBsrCr * 100.0) / 100.0);

        // 店铺名列表
        List<String> storeNames = products.stream()
                .map(DengZongShop::getSellerName)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        data.put("storeNames", storeNames);

        // BestSeller / AmazonChoice 计数
        long bestSellerCount = products.stream()
                .filter(p -> "1".equals(p.getBestSeller()) || "Y".equalsIgnoreCase(p.getBestSeller()))
                .count();
        long amazonChoiceCount = products.stream()
                .filter(p -> "1".equals(p.getAmazonChoice()) || "Y".equalsIgnoreCase(p.getAmazonChoice()))
                .count();
        data.put("bestSellerCount", bestSellerCount);
        data.put("amazonChoiceCount", amazonChoiceCount);

        // 平均上架天数
        long avgListingDays = (long) products.stream()
                .map(DengZongShop::getAvailableDate)
                .filter(Objects::nonNull)
                .filter(d -> d > 0)
                .mapToLong(Long::intValue)
                .average().orElse(0);
        data.put("avgListingDays", avgListingDays);

        // 样本商品（Top10 按销量降序）
        List<Map<String, Object>> sampleProducts = products.stream()
                .sorted((a, b) -> {
                    int ua = a.getUnits() != null ? a.getUnits() : 0;
                    int ub = b.getUnits() != null ? b.getUnits() : 0;
                    return Integer.compare(ub, ua);
                })
                .limit(10)
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("asin", p.getAsin());
                    m.put("title", p.getTitle());
                    m.put("price", p.getPrice());
                    m.put("units", p.getUnits());
                    m.put("rating", p.getRating());
                    m.put("ratings", p.getRatings());
                    m.put("bsr", p.getBsr());
                    m.put("brand", p.getBrand());
                    m.put("weight", p.getPkgWeight());
                    m.put("dimensions", p.getPkgDimensions());
                    m.put("imageUrl", p.getImageUrl());
                    m.put("fbaFee", p.getFba());
                    m.put("profit", p.getProfit());
                    m.put("weightG", p.getPkgWeight());
                    m.put("sellerName", p.getSellerName());
                    m.put("listingDays", p.getAvailableDate());
                    return m;
                })
                .collect(Collectors.toList());
        data.put("sampleProducts", sampleProducts);

        // 品牌统计
        Map<String, Long> brandCounts = products.stream()
                .map(DengZongShop::getBrand)
                .filter(b -> b != null && !b.isEmpty())
                .collect(Collectors.groupingBy(b -> b, Collectors.counting()));
        List<Map<String, Object>> topBrands = brandCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("productCount", e.getValue().intValue());
                    m.put("share", products.isEmpty() ? 0 :
                            Math.round(e.getValue() * 10000.0 / products.size()) / 10000.0);
                    return m;
                })
                .collect(Collectors.toList());
        data.put("topBrands", topBrands);
        data.put("brandCount", brandCounts.size());

        return data;
    }

    /** 从nodeLabelPath提取最后一级名称 */
    private String extractNodeName(String nodeLabelPath) {
        if (nodeLabelPath == null || nodeLabelPath.isEmpty()) return "未知";
        String[] parts = nodeLabelPath.split("[:\\/>]");
        return parts[parts.length - 1].trim();
    }

    /** 对象转JSON字符串 */
    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.warn("JSON序列化失败: {}", e.getMessage());
            return null;
        }
    }
}
