package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.ProductLineGuidance;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.ProductLineGuidanceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 品线选品指导意见服务。
 *
 * 3个核心方法:
 * 1. aggregateData(batchId) — 聚合competitor_products数据供Agent分析
 * 2. saveAnalysisResults(batchId, results) — 保存Agent分析结果
 * 3. queryGuidance(batchId) — 查询已保存的分析指导
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductLineGuidanceService {

    private final ProductLineGuidanceMapper guidanceMapper;
    private final CompetitorProductMapper productMapper;
    private final ObjectMapper objectMapper;

    /**
     * 聚合competitor_products数据，按BSR子品类分组统计。
     * batchId 对应 week_tag（如 "2026-W24"）。
     *
     * @return {"productLines": [{bsrId, nodeName, productCount, avgPrice, ...}, ...]}
     */
    public Map<String, Object> aggregateData(String batchId) {
        log.info("聚合品线数据: batchId={}", batchId);

        // 查询当前批次的所有竞品数据
        LambdaQueryWrapper<CompetitorProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompetitorProduct::getWeekTag, batchId)
               .eq(CompetitorProduct::getIsCurrent, 1);
        List<CompetitorProduct> products = productMapper.selectList(wrapper);

        if (products.isEmpty()) {
            log.warn("批次{}无数据", batchId);
            return Map.of("productLines", List.of(), "batchId", batchId);
        }

        // 按 nodeId (BSR节点) 分组
        Map<String, List<CompetitorProduct>> byNode = products.stream()
                .filter(p -> p.getNodeId() != null)
                .collect(Collectors.groupingBy(p -> String.valueOf(p.getNodeId())));

        List<Map<String, Object>> productLines = new ArrayList<>();
        for (Map.Entry<String, List<CompetitorProduct>> entry : byNode.entrySet()) {
            String bsrId = entry.getKey();
            List<CompetitorProduct> nodeProducts = entry.getValue();

            productLines.add(buildSubCategoryData(bsrId, nodeProducts));
        }

        // 按productCount降序
        productLines.sort((a, b) -> ((Integer) b.get("productCount")) - ((Integer) a.get("productCount")));

        log.info("聚合完成: {}个品线, {}条产品", productLines.size(), products.size());
        return Map.of("productLines", productLines, "batchId", batchId);
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

    /** 构建单个子品类的聚合数据 */
    private Map<String, Object> buildSubCategoryData(String bsrId, List<CompetitorProduct> products) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("bsrId", bsrId);

        CompetitorProduct first = products.get(0);
        data.put("nodeName", extractNodeName(first.getNodeLabelPath()));
        data.put("nodeFullPath", first.getNodeLabelPath());
        data.put("marketplace", first.getMarketplace());
        data.put("productCount", products.size());

        // 价格统计
        List<BigDecimal> prices = products.stream()
                .map(CompetitorProduct::getPrice)
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
                .map(CompetitorProduct::getRating)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("avgRating", Math.round(avgRating * 100.0) / 100.0);

        long avgRatings = (long) products.stream()
                .map(CompetitorProduct::getRatings)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average().orElse(0);
        data.put("avgRatings", avgRatings);

        // 销量/收入统计
        long totalUnits = products.stream()
                .map(CompetitorProduct::getUnits)
                .filter(Objects::nonNull)
                .mapToLong(Integer::intValue).sum();
        data.put("totalUnits", totalUnits);

        BigDecimal totalRevenue = products.stream()
                .map(CompetitorProduct::getRevenue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        data.put("totalRevenue", totalRevenue);

        // 增速（unitsGr 平均）
        double avgGrowth = products.stream()
                .map(CompetitorProduct::getUnitsGr)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("unitsGrowthRate", Math.round(avgGrowth * 100.0) / 100.0);

        // BSR变化率
        double avgBsrCr = products.stream()
                .map(CompetitorProduct::getBsrCr)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        data.put("bsrChangeRate", Math.round(avgBsrCr * 100.0) / 100.0);

        // Top品牌
        Map<String, Long> brandCounts = products.stream()
                .map(CompetitorProduct::getBrand)
                .filter(b -> b != null && !b.isEmpty())
                .collect(Collectors.groupingBy(b -> b, Collectors.counting()));
        List<Map<String, Object>> topBrands = brandCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
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

        // BestSeller/AmazonChoice 计数
        long bestSellerCount = products.stream()
                .filter(p -> "1".equals(p.getBestSeller()) || "Y".equalsIgnoreCase(p.getBestSeller()))
                .count();
        long amazonChoiceCount = products.stream()
                .filter(p -> "1".equals(p.getAmazonChoice()) || "Y".equalsIgnoreCase(p.getAmazonChoice()))
                .count();
        data.put("bestSellerCount", bestSellerCount);
        data.put("amazonChoiceCount", amazonChoiceCount);

        // 品牌总数（唯一品牌数，供CR3粒度修正）
        data.put("brandCount", brandCounts.size());

        // 价格带产品数统计（供price_band空白检测）
        Map<String, Integer> priceBandCounts = new LinkedHashMap<>();
        priceBandCounts.put("BUDGET", countInPriceRange(products, 4.99, 5.99));
        priceBandCounts.put("LOW", countInPriceRange(products, 5.99, 7.99));
        priceBandCounts.put("MID", countInPriceRange(products, 7.99, 9.99));
        priceBandCounts.put("PREMIUM", countInPriceRange(products, 9.99, 16.99));
        data.put("priceBandCounts", priceBandCounts);

        // 平均上架天数（供lifecycle listingDays信号）
        long avgListingDays = (long) products.stream()
                .map(CompetitorProduct::getListingDays)
                .filter(Objects::nonNull)
                .filter(d -> d > 0)
                .mapToInt(Integer::intValue)
                .average().orElse(0);
        data.put("avgListingDays", avgListingDays);

        // Sample产品（按units降序，最多10个）
        List<Map<String, Object>> sampleProducts = products.stream()
                .sorted((a, b) -> {
                    int ua = a.getUnits() != null ? a.getUnits() : 0;
                    int ub = b.getUnits() != null ? b.getUnits() : 0;
                    return Integer.compare(ub, ua);
                })
                .limit(10)
                .map(this::toSampleProduct)
                .collect(Collectors.toList());
        data.put("sampleProducts", sampleProducts);

        return data;
    }

    /** 将竞品转为样本产品Map */
    private Map<String, Object> toSampleProduct(CompetitorProduct p) {
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
        // 精确字段：FBA真实费用（避免硬编码估算）
        m.put("fbaFee", p.getFba());
        // profit用于Python端倒推采购成本（cost_local = price - commission - VAT - FBA - profit）
        m.put("profit", p.getProfit());
        // weightG精确克数（BigDecimal，比pkgWeight String更可靠）
        m.put("weightG", p.getWeightG());
        // 上架天数（供lifecycle新兴信号辅助判定）
        m.put("listingDays", p.getListingDays());
        return m;
    }

    /** 从nodeLabelPath提取最后一级名称 */
    private String extractNodeName(String nodeLabelPath) {
        if (nodeLabelPath == null || nodeLabelPath.isEmpty()) return "";
        String[] parts = nodeLabelPath.split("[:\\/>]");
        return parts[parts.length - 1].trim();
    }

    /** 统计价格在指定区间内的产品数量 [min, max) */
    private int countInPriceRange(List<CompetitorProduct> products, double min, double max) {
        BigDecimal minBd = BigDecimal.valueOf(min);
        BigDecimal maxBd = BigDecimal.valueOf(max);
        return (int) products.stream()
                .map(CompetitorProduct::getPrice)
                .filter(Objects::nonNull)
                .filter(p -> p.compareTo(minBd) >= 0 && p.compareTo(maxBd) < 0)
                .count();
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
