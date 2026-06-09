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
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 品类基线服务 — 查询品类8维百分位基线（P25/P50/P75）+ 健康度。
 *
 * 优先从 category_baselines 表查询预计算数据，
 * 若无预计算数据则返回 hasBaseline=false（Agent端已有降级逻辑）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryBaselineService {

    private final CategoryBaselineMapper baselineMapper;
    private final CompetitorProductMapper competitorProductMapper;

    /** 品类基线计算的最小样本数 */
    private static final int MIN_SAMPLE_SIZE = 10;

    /**
     * 获取品类基线数据。
     *
     * @param marketplace   站点 UK/DE/US
     * @param categoryLabel 品类名称
     * @param month         月份（可选）
     * @return 含 hasBaseline, percentiles, health 的数据字典
     */
    public Map<String, Object> getBaseline(String marketplace, String categoryLabel, String month) {
        log.info("查询品类基线: marketplace={}, category={}, month={}", marketplace, categoryLabel, month);

        // 查询预计算基线
        LambdaQueryWrapper<CategoryBaseline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CategoryBaseline::getMarketplace, marketplace)
               .eq(CategoryBaseline::getCategoryLabel, categoryLabel);

        if (month != null && !month.isEmpty()) {
            wrapper.eq(CategoryBaseline::getBaselineMonth, month);
        }
        wrapper.orderByDesc(CategoryBaseline::getComputedAt);
        wrapper.last("LIMIT 1");

        CategoryBaseline baseline = baselineMapper.selectOne(wrapper);

        if (baseline == null || baseline.getSampleSize() == null || baseline.getSampleSize() < 10) {
            log.info("无有效基线数据: {}/{}", marketplace, categoryLabel);
            return Map.of(
                    "hasBaseline", false,
                    "marketplace", marketplace,
                    "categoryLabel", categoryLabel
            );
        }

        // 构建百分位数据
        Map<String, Object> percentiles = new LinkedHashMap<>();
        percentiles.put("size", buildPercentile(baseline.getP25Size(), baseline.getP50Size(), baseline.getP75Size()));
        percentiles.put("volume", buildPercentile(baseline.getP25Volume(), baseline.getP50Volume(), baseline.getP75Volume()));
        percentiles.put("profit", buildPercentile(baseline.getP25Profit(), baseline.getP50Profit(), baseline.getP75Profit()));
        percentiles.put("emotion", buildPercentile(baseline.getP25Emotion(), baseline.getP50Emotion(), baseline.getP75Emotion()));
        percentiles.put("decor", buildPercentile(baseline.getP25Decor(), baseline.getP50Decor(), baseline.getP75Decor()));
        percentiles.put("fission", buildPercentile(baseline.getP25Fission(), baseline.getP50Fission(), baseline.getP75Fission()));
        percentiles.put("culture", buildPercentile(baseline.getP25Culture(), baseline.getP50Culture(), baseline.getP75Culture()));
        percentiles.put("market", buildPercentile(baseline.getP25Market(), baseline.getP50Market(), baseline.getP75Market()));

        // 构建健康度
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("avgGrowthRate", baseline.getAvgGrowthRate());
        health.put("avgCr3", baseline.getAvgCr3());
        health.put("avgMargin", baseline.getAvgMargin());
        health.put("avgRating", baseline.getAvgRating());
        health.put("totalProducts", baseline.getTotalProducts());

        // 综合判定
        String overall = determineOverall(baseline);
        health.put("overall", overall);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasBaseline", true);
        result.put("marketplace", marketplace);
        result.put("categoryLabel", categoryLabel);
        result.put("baselineMonth", baseline.getBaselineMonth());
        result.put("sampleSize", baseline.getSampleSize());
        result.put("percentiles", percentiles);
        result.put("health", health);

        log.info("基线查询成功: sampleSize={}, overall={}", baseline.getSampleSize(), overall);
        return result;
    }

    private Map<String, Object> buildPercentile(Object p25, Object p50, Object p75) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("p25", p25 != null ? p25 : 0);
        m.put("p50", p50 != null ? p50 : 0);
        m.put("p75", p75 != null ? p75 : 0);
        return m;
    }

    private String determineOverall(CategoryBaseline b) {
        if (b.getAvgCr3() != null && b.getAvgCr3().doubleValue() > 0.5) {
            return "SATURATED"; // 高度垄断
        }
        if (b.getAvgGrowthRate() != null && b.getAvgGrowthRate().doubleValue() > 0.2) {
            return "GROWING"; // 高增长
        }
        if (b.getAvgMargin() != null && b.getAvgMargin().doubleValue() > 0.3) {
            return "HEALTHY"; // 利润好
        }
        return "NORMAL";
    }

    // ═══════════════════════════════════════════════════════════
    // 基线计算
    // ═══════════════════════════════════════════════════════════

    /**
     * 从 competitor_products 重新计算品类百分位基线。
     *
     * 流程：
     *  1. 查询 competitor_products 中匹配条件的数据
     *  2. 按第2级品类名分组
     *  3. 每组样本数 ≥ 10 才计算
     *  4. 计算 volume/profit/size 的 P25/P50/P75
     *  5. 计算健康度指标（增长率/CR3/利润率/评分）
     *  6. 删除旧基线 → 批量写入新基线
     *
     * @param marketplace 站点 UK/DE/US
     * @param month       数据月份 如 2026-06
     * @return 计算摘要
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> computeBaseline(String marketplace, String month) {
        log.info("开始计算品类基线: marketplace={}, month={}", marketplace, month);
        long startTime = System.currentTimeMillis();

        // 1. 查询竞品数据
        LambdaQueryWrapper<CompetitorProduct> cpWrapper = new LambdaQueryWrapper<>();
        cpWrapper.eq(CompetitorProduct::getMarketplace, marketplace)
                 .eq(CompetitorProduct::getMonth, month)
                 .ne(CompetitorProduct::getFilterMode, "FAIL")
                 .isNotNull(CompetitorProduct::getNodeLabelPath);
        List<CompetitorProduct> products = competitorProductMapper.selectList(cpWrapper);
        log.info("查询到 {} 条竞品数据", products.size());

        if (products.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", "无匹配数据",
                    "totalProducts", 0
            );
        }

        // 2. 按第2级品类名分组
        Map<String, List<CompetitorProduct>> groups = new LinkedHashMap<>();
        for (CompetitorProduct p : products) {
            String label = extractCategoryLevel2(p.getNodeLabelPath());
            if (label == null || label.isEmpty()) continue;
            groups.computeIfAbsent(label, k -> new ArrayList<>()).add(p);
        }
        log.info("分组完成: {} 个品类", groups.size());

        // 3. 删除旧基线（同一 marketplace + month）
        LambdaQueryWrapper<CategoryBaseline> delWrapper = new LambdaQueryWrapper<>();
        delWrapper.eq(CategoryBaseline::getMarketplace, marketplace)
                  .eq(CategoryBaseline::getBaselineMonth, month);
        int deleted = baselineMapper.delete(delWrapper);
        log.info("删除旧基线: {} 条", deleted);

        // 4. 逐品类计算并写入
        List<CategoryBaseline> toInsert = new ArrayList<>();
        int skipped = 0;

        for (Map.Entry<String, List<CompetitorProduct>> entry : groups.entrySet()) {
            String categoryLabel = entry.getKey();
            List<CompetitorProduct> group = entry.getValue();

            if (group.size() < MIN_SAMPLE_SIZE) {
                skipped++;
                log.debug("跳过 {}：样本不足 ({} < {})", categoryLabel, group.size(), MIN_SAMPLE_SIZE);
                continue;
            }

            CategoryBaseline bl = buildBaseline(marketplace, categoryLabel, month, group);
            toInsert.add(bl);
        }

        // 5. 批量写入
        int inserted = 0;
        for (CategoryBaseline bl : toInsert) {
            baselineMapper.insert(bl);
            inserted++;
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("基线计算完成: {} 品类写入, {} 跳过, 耗时 {}ms", inserted, skipped, elapsed);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("marketplace", marketplace);
        result.put("month", month);
        result.put("totalProducts", products.size());
        result.put("totalCategories", groups.size());
        result.put("computed", inserted);
        result.put("skipped", skipped);
        result.put("elapsedMs", elapsed);
        return result;
    }

    /** 构建单条品类基线记录。 */
    private CategoryBaseline buildBaseline(String marketplace, String categoryLabel,
                                           String month, List<CompetitorProduct> group) {
        CategoryBaseline bl = new CategoryBaseline();
        bl.setMarketplace(marketplace);
        bl.setCategoryLabel(categoryLabel);
        bl.setBaselineMonth(month);
        bl.setSampleSize(group.size());
        bl.setComputedAt(LocalDateTime.now());
        bl.setDataSource("auto");
        // 置信度: 样本越多越可靠，10→0.60, 50→0.70, 100→0.75, 200→0.80, 500→0.85, 1000→0.90
        double conf = Math.min(0.95, 0.60 + 0.15 * Math.log10(Math.max(group.size(), 10) / 10.0));
        bl.setConfidence(BigDecimal.valueOf(conf).setScale(2, RoundingMode.HALF_UP));

        // --- 销量 (units) ---
        List<BigDecimal> units = group.stream()
                .map(CompetitorProduct::getUnits)
                .filter(Objects::nonNull)
                .map(BigDecimal::valueOf)
                .sorted()
                .collect(Collectors.toList());
        if (!units.isEmpty()) {
            bl.setP25Volume(percentile(units, 0.25));
            bl.setP50Volume(percentile(units, 0.50));
            bl.setP75Volume(percentile(units, 0.75));
        }

        // --- 利润 (profit) ---
        List<BigDecimal> profits = group.stream()
                .map(CompetitorProduct::getProfit)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
        if (!profits.isEmpty()) {
            bl.setP25Profit(percentile(profits, 0.25));
            bl.setP50Profit(percentile(profits, 0.50));
            bl.setP75Profit(percentile(profits, 0.75));
        }

        // --- 体积友好性 (weight_g) ---
        List<BigDecimal> weights = group.stream()
                .map(CompetitorProduct::getWeightG)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
        if (!weights.isEmpty()) {
            bl.setP25Size(percentile(weights, 0.25));
            bl.setP50Size(percentile(weights, 0.50));
            bl.setP75Size(percentile(weights, 0.75));
        }

        // --- 健康度指标 ---
        // avg_growth_rate
        double avgGrowth = group.stream()
                .map(CompetitorProduct::getUnitsGr)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        bl.setAvgGrowthRate(BigDecimal.valueOf(avgGrowth).setScale(4, RoundingMode.HALF_UP));

        // avg_cr3: 头部3品牌销量占比
        bl.setAvgCr3(computeCr3(group));

        // avg_margin: 平均利润率 (profit / price)
        double avgMargin = group.stream()
                .filter(p -> p.getProfit() != null && p.getPrice() != null
                        && p.getPrice().compareTo(BigDecimal.ZERO) > 0)
                .mapToDouble(p -> p.getProfit().divide(p.getPrice(), 4, RoundingMode.HALF_UP).doubleValue())
                .average().orElse(0);
        bl.setAvgMargin(BigDecimal.valueOf(avgMargin).setScale(4, RoundingMode.HALF_UP));

        // avg_rating
        double avgRating = group.stream()
                .map(CompetitorProduct::getRating)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average().orElse(0);
        bl.setAvgRating(BigDecimal.valueOf(avgRating).setScale(2, RoundingMode.HALF_UP));

        // total_products
        bl.setTotalProducts(group.size());

        return bl;
    }

    /**
     * 从 node_label_path 提取第2级品类名。
     * 例: "Beauty:Manicure & Pedicure:Nail Design" → "Manicure & Pedicure"
     */
    private static String extractCategoryLevel2(String path) {
        if (path == null || path.isEmpty()) return null;
        String[] parts = path.split(":");
        if (parts.length >= 2) {
            return parts[1].trim();
        }
        return parts[0].trim(); // 只有1级时回退
    }

    /**
     * 线性插值计算百分位。
     *
     * @param sorted 已排序的数值列表
     * @param p      百分位 (0.0~1.0)
     */
    private static BigDecimal percentile(List<BigDecimal> sorted, double p) {
        int n = sorted.size();
        if (n == 0) return BigDecimal.ZERO;
        if (n == 1) return sorted.get(0);

        double pos = p * (n - 1);
        int lower = (int) Math.floor(pos);
        int upper = (int) Math.ceil(pos);

        if (lower == upper) {
            return sorted.get(lower);
        }

        BigDecimal frac = BigDecimal.valueOf(pos - lower);
        BigDecimal range = sorted.get(upper).subtract(sorted.get(lower));
        return sorted.get(lower).add(range.multiply(frac)).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 计算 CR3（头部3品牌销量占比）。
     *
     * @return 0.0~1.0 的值
     */
    private static BigDecimal computeCr3(List<CompetitorProduct> group) {
        // 按 brand 分组求和 units
        Map<String, Long> brandUnits = new LinkedHashMap<>();
        for (CompetitorProduct p : group) {
            String brand = p.getBrand() != null ? p.getBrand() : "Unknown";
            long units = p.getUnits() != null ? p.getUnits() : 0;
            brandUnits.merge(brand, units, Long::sum);
        }

        long totalUnits = brandUnits.values().stream().mapToLong(Long::longValue).sum();
        if (totalUnits == 0) return BigDecimal.ZERO;

        // 取前3品牌
        long top3Units = brandUnits.values().stream()
                .sorted(Comparator.reverseOrder())
                .limit(3)
                .mapToLong(Long::longValue)
                .sum();

        return BigDecimal.valueOf((double) top3Units / totalUnits)
                .setScale(4, RoundingMode.HALF_UP);
    }
}
