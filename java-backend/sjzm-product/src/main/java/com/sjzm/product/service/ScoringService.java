package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.entity.GradeThreshold;
import com.sjzm.product.entity.ScoringConfig;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.mapper.GradeThresholdMapper;
import com.sjzm.product.mapper.ScoringConfigMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.WeekFields;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ScoringConfigMapper configMapper;
    private final GradeThresholdMapper gradeMapper;
    private final CompetitorProductMapper productMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 获取评分配置
     */
    public Map<String, Object> getConfig() {
        List<ScoringConfig> dimensions = configMapper.selectList(null);
        List<GradeThreshold> grades = gradeMapper.selectList(
                new LambdaQueryWrapper<GradeThreshold>().orderByDesc(GradeThreshold::getMinScore));

        // 解析 thresholds JSON
        List<Map<String, Object>> dimList = new ArrayList<>();
        for (ScoringConfig d : dimensions) {
            Map<String, Object> dim = new HashMap<>();
            dim.put("id", d.getId());
            dim.put("dimensionKey", d.getDimensionKey());
            dim.put("displayName", d.getDisplayName());
            dim.put("weight", d.getWeight());
            dim.put("isActive", d.getIsActive());
            dim.put("updatedAt", d.getUpdatedAt());
            try {
                dim.put("thresholds", objectMapper.readValue(d.getThresholds(),
                        new TypeReference<List<Map<String, Object>>>() {}));
            } catch (Exception e) {
                dim.put("thresholds", List.of());
            }
            dimList.add(dim);
        }

        List<Map<String, Object>> gradeList = new ArrayList<>();
        for (GradeThreshold g : grades) {
            Map<String, Object> grade = new HashMap<>();
            grade.put("id", g.getId());
            grade.put("grade", g.getGrade());
            grade.put("minScore", g.getMinScore());
            grade.put("maxScore", g.getMaxScore());
            grade.put("color", g.getColor());
            grade.put("updatedAt", g.getUpdatedAt());
            gradeList.add(grade);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("dimensions", dimList);
        result.put("gradeThresholds", gradeList);
        return result;
    }

    /**
     * 更新评分配置（全量替换）
     */
    @Transactional
    public void updateConfig(List<ScoringConfig> dimensions, List<GradeThreshold> grades) {
        if (dimensions != null && !dimensions.isEmpty()) {
            configMapper.delete(new LambdaQueryWrapper<>());
            for (ScoringConfig d : dimensions) {
                configMapper.insert(d);
            }
        }
        if (grades != null && !grades.isEmpty()) {
            gradeMapper.delete(new LambdaQueryWrapper<>());
            for (GradeThreshold g : grades) {
                gradeMapper.insert(g);
            }
        }
        log.info("评分配置已更新: {} 维度, {} 等级",
                dimensions != null ? dimensions.size() : 0,
                grades != null ? grades.size() : 0);
    }

    /**
     * 一键计算本周评级
     */
    @Transactional
    public Map<String, Object> scoreCurrentWeek() {
        updateWeekTags();

        List<CompetitorProduct> products = productMapper.selectList(
                new LambdaQueryWrapper<CompetitorProduct>()
                        .isNotNull(CompetitorProduct::getTitle)
                        .eq(CompetitorProduct::getIsCurrent, 1)
                        .and(w -> w.isNull(CompetitorProduct::getScore).or().isNull(CompetitorProduct::getGrade)));

        if (products.isEmpty()) {
            return Map.of("totalScored", 0, "gradeStats", getGradeStats("current_week"));
        }

        return doScore(products, "current_week");
    }

    /**
     * 重新评分所有数据
     */
    @Transactional
    public Map<String, Object> recalculateScores(String scope) {
        updateWeekTags();

        List<CompetitorProduct> products;
        if ("current_week".equals(scope)) {
            products = productMapper.selectList(
                    new LambdaQueryWrapper<CompetitorProduct>()
                            .isNotNull(CompetitorProduct::getTitle)
                            .eq(CompetitorProduct::getIsCurrent, 1));
        } else {
            products = productMapper.selectList(
                    new LambdaQueryWrapper<CompetitorProduct>()
                            .isNotNull(CompetitorProduct::getTitle));
        }

        if (products.isEmpty()) {
            return Map.of("totalScored", 0, "gradeStats", getGradeStats(scope));
        }

        return doScore(products, scope);
    }

    /**
     * 获取等级统计
     */
    public List<Map<String, Object>> getGradeStats(String scope) {
        List<GradeThreshold> grades = gradeMapper.selectList(null);
        Map<String, String> colorMap = new LinkedHashMap<>();
        for (GradeThreshold g : grades) {
            colorMap.put(g.getGrade(), g.getColor());
        }

        List<Map<String, Object>> stats = new ArrayList<>();
        for (String g : new String[]{"S", "A", "B", "C", "D"}) {
            LambdaQueryWrapper<CompetitorProduct> w = new LambdaQueryWrapper<CompetitorProduct>()
                    .isNotNull(CompetitorProduct::getTitle)
                    .eq(CompetitorProduct::getGrade, g);
            if ("current_week".equals(scope)) {
                w.eq(CompetitorProduct::getIsCurrent, 1);
            }
            long count = productMapper.selectCount(w);
            Map<String, Object> item = new HashMap<>();
            item.put("grade", g);
            item.put("count", count);
            item.put("color", colorMap.getOrDefault(g, ""));
            stats.add(item);
        }
        return stats;
    }

    // ---- 内部方法 ----

    private Map<String, Object> doScore(List<CompetitorProduct> products, String scope) {
        List<ScoringConfig> configs = configMapper.selectList(
                new LambdaQueryWrapper<ScoringConfig>().eq(ScoringConfig::getIsActive, true));
        List<GradeThreshold> gradeThresholds = gradeMapper.selectList(
                new LambdaQueryWrapper<GradeThreshold>().orderByDesc(GradeThreshold::getMinScore));

        // 解析 thresholds JSON
        List<DimConfig> dims = new ArrayList<>();
        for (ScoringConfig c : configs) {
            try {
                List<ThresholdItem> items = objectMapper.readValue(c.getThresholds(),
                        new TypeReference<List<ThresholdItem>>() {});
                dims.add(new DimConfig(c.getDimensionKey(), c.getWeight(), items));
            } catch (Exception e) {
                log.warn("解析阈值配置失败: {}", c.getDimensionKey());
            }
        }

        int totalScored = 0;
        List<CompetitorProduct> toUpdate = new ArrayList<>();
        for (CompetitorProduct p : products) {
            ScoreResult sr = scoreProduct(p, dims, gradeThresholds);
            p.setScore(sr.score);
            p.setGrade(sr.grade);
            toUpdate.add(p);
            totalScored++;
        }

        // 批量更新（BaseMapper 没有 updateBatchById，逐条更新）
        for (CompetitorProduct p : toUpdate) {
            productMapper.updateById(p);
        }

        log.info("评分完成: {} 条", totalScored);
        return Map.of("totalScored", totalScored, "gradeStats", getGradeStats(scope));
    }

    private ScoreResult scoreProduct(CompetitorProduct p, List<DimConfig> dims, List<GradeThreshold> gradeThresholds) {
        // FBM 特殊规则
        String fulfillment = p.getFulfillment();
        if (fulfillment != null && "FBM".equalsIgnoreCase(fulfillment.trim())) {
            return new ScoreResult(100, "S");
        }

        double weightedSum = 0.0;
        double totalWeight = 0.0;

        for (DimConfig dim : dims) {
            Double rawValue = getDimValue(dim.key, p);
            if (rawValue == null) continue;

            int dimScore = lookupScore(dim.key, rawValue, dim.thresholds);
            weightedSum += dimScore * (dim.weight / 100.0);
            totalWeight += dim.weight;
        }

        int score = 0;
        if (totalWeight > 0) {
            score = (int) Math.round(weightedSum * 100 / totalWeight);
        }
        score = Math.max(0, Math.min(100, score));

        String grade = determineGrade(score, gradeThresholds);
        return new ScoreResult(score, grade);
    }

    private Double getDimValue(String key, CompetitorProduct p) {
        return switch (key) {
            case "listing_age" -> {
                Long availableDate = p.getAvailableDate();
                if (availableDate == null || availableDate == 0) yield null;
                LocalDate listingDate = Instant.ofEpochMilli(availableDate)
                        .atZone(ZoneId.of("Asia/Shanghai")).toLocalDate();
                yield (double) Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(listingDate, LocalDate.now()));
            }
            case "sales_volume" -> p.getUnits() != null ? p.getUnits().doubleValue() : null;
            case "bsr_rank" -> p.getBsr() != null ? p.getBsr().doubleValue() : null;
            case "price" -> p.getPrice() != null ? p.getPrice().doubleValue() : null;
            default -> null;
        };
    }

    private int lookupScore(String key, double value, List<ThresholdItem> thresholds) {
        if (thresholds == null || thresholds.isEmpty()) return 0;

        if ("listing_age".equals(key) || "bsr_rank".equals(key)) {
            // 越小越好：value <= max
            for (ThresholdItem t : thresholds) {
                if (value <= (t.max != null ? t.max : Double.MAX_VALUE)) {
                    return t.score;
                }
            }
            return thresholds.get(thresholds.size() - 1).score;
        }

        if ("sales_volume".equals(key) || "price".equals(key)) {
            // 区间匹配：min <= value < max
            for (ThresholdItem t : thresholds) {
                double tMin = t.min != null ? t.min : 0;
                double tMax = t.max != null ? t.max : Double.MAX_VALUE;
                if (tMin <= value && value < tMax) {
                    return t.score;
                }
            }
            return thresholds.get(thresholds.size() - 1).score;
        }

        return 0;
    }

    private String determineGrade(int score, List<GradeThreshold> gradeThresholds) {
        if (gradeThresholds != null) {
            for (GradeThreshold g : gradeThresholds) {
                if (g.getMinScore() != null && g.getMaxScore() != null
                        && g.getMinScore() <= score && score <= g.getMaxScore()) {
                    return g.getGrade();
                }
            }
        }
        // 默认阈值
        if (score >= 90) return "S";
        if (score >= 80) return "A";
        if (score >= 65) return "B";
        if (score >= 50) return "C";
        return "D";
    }

    /**
     * 更新周标记：使用 created_at 或 updated_at 判断
     * 如果时间字段为 NULL，视为本周新数据
     */
    public void updateWeekTags() {
        String weekTag = getCurrentWeekTag();
        LocalDate now = LocalDate.now();
        LocalDate monday = now.with(WeekFields.ISO.dayOfWeek(), 1);
        String mondayStr = monday.toString();

        // 全部置为旧周
        CompetitorProduct reset = new CompetitorProduct();
        reset.setIsCurrent(0);
        productMapper.update(reset, new LambdaQueryWrapper<CompetitorProduct>().eq(CompetitorProduct::getIsCurrent, 1));

        // 本周标记：created_at/updated_at >= 周一，或两者均为 NULL（刚导入的数据）
        CompetitorProduct mark = new CompetitorProduct();
        mark.setWeekTag(weekTag);
        mark.setIsCurrent(1);
        productMapper.update(mark, new LambdaQueryWrapper<CompetitorProduct>()
                .and(w -> w.apply("created_at >= {0}", mondayStr)
                        .or().apply("updated_at >= {0}", mondayStr)
                        .or().isNull(CompetitorProduct::getCreatedAt)));

        log.info("周标记已更新: week_tag={}", weekTag);
    }

    private String getCurrentWeekTag() {
        java.time.LocalDate now = java.time.LocalDate.now();
        int year = now.get(java.time.temporal.IsoFields.WEEK_BASED_YEAR);
        int week = now.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        return String.format("%d-W%02d", year, week);
    }

    // ---- 内部类 ----

    @lombok.AllArgsConstructor
    private static class DimConfig {
        String key;
        double weight;
        List<ThresholdItem> thresholds;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ThresholdItem {
        private Double min;
        private Double max;
        private int score;
    }

    @lombok.AllArgsConstructor
    public static class ScoreResult {
        public int score;
        public String grade;
    }
}
