package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.CategoryBaseline;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.CategoryBaselineMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 品类基线服务 — 计算和查询品类百分位基线。
 *
 * 核心功能：
 * 1. computeBaselines — 从 competitor_products 聚合计算品类基线
 * 2. getBaseline — 查询指定品类的基线数据
 * 3. getHealthIndicators — 获取品类健康度指标
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryBaselineService {

    private final CategoryBaselineMapper baselineMapper;
    private final CompetitorProductMapper productMapper;

    /**
     * 查询品类基线。
     *
     * @param marketplace   站点 UK/DE/US
     * @param categoryLabel 品类名称
     * @param month         基线月份（如 "2026-06"），null 则取最新
     * @return 基线数据，不存在返回 null
     */
    public CategoryBaseline getBaseline(String marketplace, String categoryLabel, String month) {
        LambdaQueryWrapper<CategoryBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CategoryBaseline::getMarketplace, marketplace)
               .eq(CategoryBaseline::getCategoryLabel, categoryLabel);

        if (month != null && !month.isEmpty()) {
            wrapper.eq(CategoryBaseline::getBaselineMonth, month);
        } else {
            // 取最新月份
            wrapper.orderByDesc(CategoryBaseline::getBaselineMonth).last("LIMIT 1");
        }

        return baselineMapper.selectOne(wrapper);
    }

    /**
     * 批量计算品类基线（从 competitor_products 聚合）。
     * 建议每月初执行一次，或数据更新后手动触发。
     *
     * @param marketplace 站点 UK/DE/US
     * @param month       基线月份（如 "2026-06"）
     * @return 计算的品类数量
     */
    @Transactional
    public int computeBaselines(String marketplace, String month) {
        log.info("计算品类基线: marketplace={}, month={}", marketplace, month);

        // 查询当前站点的所有竞品数据
        LambdaQueryWrapper<CompetitorProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompetitorProduct::getMarketplace, marketplace);
        // 使用当前有效的数据
        if (month != null && !month.isEmpty()) {
            wrapper.eq(CompetitorProduct::getWeekTag, month);
        }
        wrapper.eq(CompetitorProduct::getIsCurrent, 1);

        List<CompetitorProduct> products = productMapper.selectList(wrapper);
        if (products.isEmpty()) {
            log.warn("无竞品数据: marketplace={}", marketplace);
            return 0;
        }

        // 按品类分组（从 nodeLabelPath 提取最后一级品类名）
        Map<String, List<CompetitorProduct>> byCategory = products.stream()
                .filter(p -> p.getNodeLabelPath() != null && !p.getNodeLabelPath().isEmpty())
                .collect(Collectors.groupingBy(p -> {
                    String path = p.getNodeLabelPath();
                    int idx = path.lastIndexOf('>');
                    return idx >= 0 ? path.substring(idx + 1).trim() : path;
                }));

        // 清除旧基线
        LambdaQueryWrapper<CategoryBaseline> deleteWrapper = new LambdaQueryWrapper<>();
        deleteWrapper.eq(CategoryBaseline::getMarketplace, marketplace)
                     .eq(CategoryBaseline::getBaselineMonth, month);
        baselineMapper.delete(deleteWrapper);

        int count = 0;
        for (Map.Entry<String, List<CompetitorProduct>> entry : byCategory.entrySet()) {
            String categoryLabel = entry.getKey();
            List<CompetitorProduct> categoryProducts = entry.getValue();

            // 样本量过少跳过（至少10个产品）
            if (categoryProducts.size() < 10) {
                continue;
            }

            CategoryBaseline baseline = computeCategoryBaseline(
                    marketplace, categoryLabel, month, categoryProducts);
            baselineMapper.insert(baseline);
            count++;
        }

        log.info("品类基线计算完成: {}个品类", count);
        return count;
    }

    /**
     * 获取品类健康度指标。
     *
     * @param marketplace   站点
     * @param categoryLabel 品类名称
     * @return 健康度指标 Map
     */
    public Map<String, Object> getHealthIndicators(String marketplace, String categoryLabel) {
        CategoryBaseline baseline = getBaseline(marketplace, categoryLabel, null);
        if (baseline == null) {
            return Map.of(
                    "categoryLabel", categoryLabel,
                    "marketplace", marketplace,
                    "hasBaseline", false,
                    "message", "暂无基线数据"
            );
        }

        Map<String, Object> result = new HashMap<>();
        result.put("categoryLabel", categoryLabel);
        result.put("marketplace", marketplace);
        result.put("hasBaseline", true);
        result.put("baselineMonth", baseline.getBaselineMonth());
        result.put("sampleSize", baseline.getSampleSize());
        result.put("confidence", baseline.getConfidence());

        // 健康度指标
        result.put("avgGrowthRate", baseline.getAvgGrowthRate());
        result.put("avgCr3", baseline.getAvgCr3());
        result.put("avgMargin", baseline.getAvgMargin());
        result.put("avgRating", baseline.getAvgRating());
        result.put("totalProducts", baseline.getTotalProducts());

        // 百分位基线（供 Python Agent 使用）
        Map<String, Map<String, BigDecimal>> percentiles = new HashMap<>();
        for (String dim : List.of("size", "volume", "profit", "emotion", "decor", "fission", "culture", "market")) {
            Map<String, BigDecimal> dimPercentiles = new HashMap<>();
            dimPercentiles.put("p25", getPercentileField(baseline, "p25", dim));
            dimPercentiles.put("p50", getPercentileField(baseline, "p50", dim));
            dimPercentiles.put("p75", getPercentileField(baseline, "p75", dim));
            percentiles.put(dim, dimPercentiles);
        }
        result.put("percentiles", percentiles);

        return result;
    }

    /**
     * 计算单个品类的基线。
     */
    private CategoryBaseline computeCategoryBaseline(
            String marketplace, String categoryLabel, String month, List<CompetitorProduct> products) {

        CategoryBaseline baseline = new CategoryBaseline();
        baseline.setMarketplace(marketplace);
        baseline.setCategoryLabel(categoryLabel);
        baseline.setBaselineMonth(month);
        baseline.setSampleSize(products.size());
        baseline.setComputedAt(LocalDateTime.now());
        baseline.setDataSource("auto");
        baseline.setConfidence(BigDecimal.valueOf(0.80));

        // 提取数值指标
        List<BigDecimal> prices = products.stream()
                .filter(p -> p.getPrice() != null)
                .map(CompetitorProduct::getPrice)
                .collect(Collectors.toList());

        List<Integer> ratings = products.stream()
                .filter(p -> p.getRatings() != null)
                .map(CompetitorProduct::getRatings)
                .collect(Collectors.toList());

        List<BigDecimal> ratingsAvg = products.stream()
                .filter(p -> p.getRating() != null)
                .map(CompetitorProduct::getRating)
                .collect(Collectors.toList());

        // 品类健康度指标
        baseline.setAvgMargin(computeAvgMargin(products));
        baseline.setAvgCr3(BigDecimal.ZERO); // CR3 需要品牌数据，简化处理
        baseline.setAvgRating(computeAvg(ratingsAvg));
        baseline.setTotalProducts(products.size());

        // 平均增速（从 unitsGr 字段计算）
        List<BigDecimal> growthRates = products.stream()
                .filter(p -> p.getUnitsGr() != null)
                .map(CompetitorProduct::getUnitsGr)
                .collect(Collectors.toList());
        baseline.setAvgGrowthRate(computeAvg(growthRates));

        // 计算8维百分位（简化版本，基于可用数据）
        // size: 基于价格推断（低价通常=小件）
        List<BigDecimal> sizeScores = prices.stream()
                .map(p -> priceToSizeScore(p))
                .collect(Collectors.toList());
        setPercentileFields(baseline, "size", sizeScores);

        // volume: 基于评论数推断（评论多=销量高）
        List<BigDecimal> volumeScores = ratings.stream()
                .map(r -> BigDecimal.valueOf(Math.min(r / 10.0, 100.0)))
                .collect(Collectors.toList());
        setPercentileFields(baseline, "volume", volumeScores);

        // profit: 基于实际利润率（profit/price）
        List<BigDecimal> profitScores = products.stream()
                .filter(p -> p.getPrice() != null && p.getPrice().doubleValue() > 0
                         && p.getProfit() != null)
                .map(p -> {
                    double margin = p.getProfit().doubleValue() / p.getPrice().doubleValue() * 100;
                    return BigDecimal.valueOf(Math.min(Math.max(margin, 0), 100));
                })
                .collect(Collectors.toList());
        // 无利润数据时回退到默认值
        if (profitScores.isEmpty()) {
            setDefaultPercentileFields(baseline, "profit");
        } else {
            setPercentileFields(baseline, "profit", profitScores);
        }

        // 其他维度使用默认值（需要 LLM 评分时由 Python Agent 补充）
        for (String dim : List.of("emotion", "decor", "fission", "culture")) {
            setDefaultPercentileFields(baseline, dim);
        }

        // market: 基于产品数量和增长
        List<BigDecimal> marketScores = List.of(
                BigDecimal.valueOf(50), BigDecimal.valueOf(50), BigDecimal.valueOf(50));
        setPercentileFields(baseline, "market", marketScores);

        return baseline;
    }

    /**
     * 价格转体积分数（低价=小件=高分）。
     */
    private BigDecimal priceToSizeScore(BigDecimal price) {
        if (price == null) return BigDecimal.valueOf(50);
        double p = price.doubleValue();
        if (p < 10) return BigDecimal.valueOf(90);
        if (p < 20) return BigDecimal.valueOf(70);
        if (p < 30) return BigDecimal.valueOf(50);
        if (p < 50) return BigDecimal.valueOf(30);
        return BigDecimal.valueOf(15);
    }

    /**
     * 设置百分位字段。
     */
    private void setPercentileFields(CategoryBaseline baseline, String dimension, List<BigDecimal> values) {
        if (values.isEmpty()) {
            setDefaultPercentileFields(baseline, dimension);
            return;
        }

        Collections.sort(values);
        BigDecimal p25 = getPercentile(values, 25);
        BigDecimal p50 = getPercentile(values, 50);
        BigDecimal p75 = getPercentile(values, 75);

        setPercentileField(baseline, "p25", dimension, p25);
        setPercentileField(baseline, "p50", dimension, p50);
        setPercentileField(baseline, "p75", dimension, p75);
    }

    /**
     * 设置默认百分位（50/50/50）。
     */
    private void setDefaultPercentileFields(CategoryBaseline baseline, String dimension) {
        BigDecimal defaultVal = BigDecimal.valueOf(50);
        setPercentileField(baseline, "p25", dimension, BigDecimal.valueOf(40));
        setPercentileField(baseline, "p50", dimension, defaultVal);
        setPercentileField(baseline, "p75", dimension, BigDecimal.valueOf(60));
    }

    /**
     * 计算百分位值。
     */
    private BigDecimal getPercentile(List<BigDecimal> sorted, int percentile) {
        if (sorted.isEmpty()) return BigDecimal.ZERO;
        int index = (int) Math.ceil(percentile / 100.0 * sorted.size()) - 1;
        index = Math.max(0, Math.min(index, sorted.size() - 1));
        return sorted.get(index).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 计算平均利润率（从 profit/price 推导）。
     */
    private BigDecimal computeAvgMargin(List<CompetitorProduct> products) {
        List<BigDecimal> margins = products.stream()
                .filter(p -> p.getPrice() != null && p.getPrice().doubleValue() > 0
                         && p.getProfit() != null)
                .map(p -> p.getProfit()
                        .divide(p.getPrice(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)))
                .collect(Collectors.toList());
        return margins.isEmpty()
                ? BigDecimal.valueOf(30).setScale(2, RoundingMode.HALF_UP)
                : computeAvg(margins);
    }

    /**
     * 计算平均值。
     */
    private BigDecimal computeAvg(List<BigDecimal> values) {
        if (values.isEmpty()) return BigDecimal.ZERO;
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    /**
     * 反射式设置百分位字段。
     */
    private void setPercentileField(CategoryBaseline baseline, String percentile, String dimension, BigDecimal value) {
        String fieldName = percentile + capitalizeFirst(dimension);
        try {
            var field = CategoryBaseline.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(baseline, value);
        } catch (Exception e) {
            log.warn("设置字段失败: {}", fieldName);
        }
    }

    /**
     * 反射式获取百分位字段。
     */
    private BigDecimal getPercentileField(CategoryBaseline baseline, String percentile, String dimension) {
        String fieldName = percentile + capitalizeFirst(dimension);
        try {
            var field = CategoryBaseline.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            Object value = field.get(baseline);
            return value != null ? (BigDecimal) value : BigDecimal.ZERO;
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    /**
     * 首字母大写。
     */
    private String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1);
    }
}
