package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.entity.GradeThreshold;
import com.sjzm.entity.ScoringConfig;
import com.sjzm.entity.Selection;
import com.sjzm.mapper.GradeThresholdMapper;
import com.sjzm.mapper.ScoringConfigMapper;
import com.sjzm.mapper.SelectionMapper;
import com.sjzm.service.ScoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 评分服务实现（对齐 Python scoring_engine.py）
 * <p>
 * 核心逻辑：
 * 1. FBM 特殊规则：delivery_method == 'FBM' 直接返回 score=100, grade='S'
 * 2. 配置从数据库读取：scoring_config 表（维度配置）和 grade_thresholds 表（等级阈值）
 * 3. 查表评分：每个维度根据 thresholds 配置查表得分，然后加权平均
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScoringServiceImpl implements ScoringService {

    private final SelectionMapper selectionMapper;
    private final ScoringConfigMapper scoringConfigMapper;
    private final GradeThresholdMapper gradeThresholdMapper;
    private final ObjectMapper objectMapper;

    /** 维度配置缓存 */
    private volatile List<ScoringConfig> configCache = null;

    /** 等级阈值缓存 */
    private volatile List<GradeThreshold> gradeCache = null;

    /** 缓存更新时间 */
    private volatile long cacheUpdateTime = 0;

    /** 缓存有效期（5分钟） */
    private static final long CACHE_TTL_MS = 5 * 60 * 1000;

    // ==================== 配置加载 ====================

    /**
     * 加载评分配置（带缓存）
     * <p>
     * 对齐 Python: load_config()
     */
    private synchronized void loadConfigIfNeeded() {
        long now = System.currentTimeMillis();
        if (configCache != null && gradeCache != null && (now - cacheUpdateTime) < CACHE_TTL_MS) {
            return;
        }

        // 加载维度配置
        configCache = scoringConfigMapper.selectList(
                new LambdaQueryWrapper<ScoringConfig>().orderByAsc(ScoringConfig::getId)
        );

        // 加载等级阈值
        gradeCache = gradeThresholdMapper.selectList(
                new LambdaQueryWrapper<GradeThreshold>().orderByDesc(GradeThreshold::getMinScore)
        );

        cacheUpdateTime = now;
        log.info("评分配置已加载: 维度数={}, 等级数={}", 
                configCache != null ? configCache.size() : 0,
                gradeCache != null ? gradeCache.size() : 0);
    }

    /**
     * 清除配置缓存（配置更新时调用）
     */
    public void invalidateCache() {
        configCache = null;
        gradeCache = null;
        cacheUpdateTime = 0;
        log.info("评分配置缓存已清除");
    }

    // ==================== 获取评分配置 ====================

    @Override
    public Map<String, Object> getScoringConfig() {
        log.info("获取评分配置");
        loadConfigIfNeeded();

        Map<String, Object> result = new HashMap<>();

        // 维度配置
        List<Map<String, Object>> dimensions = new ArrayList<>();
        if (configCache != null) {
            for (ScoringConfig config : configCache) {
                Map<String, Object> dim = new HashMap<>();
                dim.put("id", config.getId());
                dim.put("dimensionKey", config.getDimensionKey());
                dim.put("displayName", config.getDisplayName());
                dim.put("weight", config.getWeight());
                dim.put("thresholds", parseThresholds(config.getThresholds()));
                dim.put("isActive", config.getIsActive());
                dim.put("updatedAt", config.getUpdatedAt());
                dimensions.add(dim);
            }
        }

        // 等级阈值
        List<Map<String, Object>> gradeThresholds = new ArrayList<>();
        if (gradeCache != null) {
            for (GradeThreshold threshold : gradeCache) {
                Map<String, Object> g = new HashMap<>();
                g.put("id", threshold.getId());
                g.put("grade", threshold.getGrade());
                g.put("minScore", threshold.getMinScore());
                g.put("maxScore", threshold.getMaxScore());
                g.put("color", threshold.getColor());
                g.put("updatedAt", threshold.getUpdatedAt());
                gradeThresholds.add(g);
            }
        }

        result.put("dimensions", dimensions);
        result.put("gradeThresholds", gradeThresholds);
        return result;
    }

    // ==================== 更新评分配置 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> updateScoringConfig(Map<String, Object> config) {
        log.info("更新评分配置: {}", config);

        if (config == null) {
            throw new IllegalArgumentException("配置不能为空");
        }

        // 更新维度配置
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> dimensions = (List<Map<String, Object>>) config.get("dimensions");
        if (dimensions != null) {
            for (Map<String, Object> dim : dimensions) {
                ScoringConfig scoringConfig = new ScoringConfig();
                scoringConfig.setDimensionKey((String) dim.get("dimensionKey"));
                scoringConfig.setDisplayName((String) dim.get("displayName"));
                
                Object weight = dim.get("weight");
                if (weight instanceof Number) {
                    scoringConfig.setWeight(((Number) weight).doubleValue());
                }
                
                // thresholds 序列化为 JSON
                Object thresholds = dim.get("thresholds");
                if (thresholds != null) {
                    try {
                        scoringConfig.setThresholds(objectMapper.writeValueAsString(thresholds));
                    } catch (JsonProcessingException e) {
                        log.warn("序列化 thresholds 失败: {}", e.getMessage());
                    }
                }
                
                Object isActive = dim.get("isActive");
                scoringConfig.setIsActive(isActive == null || Boolean.TRUE.equals(isActive));

                // 使用 insertOrUpdate
                scoringConfigMapper.insertOrUpdate(scoringConfig);
            }
        }

        // 更新等级阈值
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> gradeThresholds = (List<Map<String, Object>>) config.get("gradeThresholds");
        if (gradeThresholds != null) {
            for (Map<String, Object> g : gradeThresholds) {
                GradeThreshold threshold = new GradeThreshold();
                threshold.setGrade((String) g.get("grade"));
                
                Object minScore = g.get("minScore");
                if (minScore instanceof Number) {
                    threshold.setMinScore(((Number) minScore).intValue());
                }
                
                Object maxScore = g.get("maxScore");
                if (maxScore instanceof Number) {
                    threshold.setMaxScore(((Number) maxScore).intValue());
                }
                
                threshold.setColor((String) g.get("color"));

                // 使用 insertOrUpdate
                gradeThresholdMapper.insertOrUpdate(threshold);
            }
        }

        // 清除缓存
        invalidateCache();

        log.info("评分配置更新完成");
        return getScoringConfig();
    }

    // ==================== 重新计算所有选品评分 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> recalculateScores() {
        log.info("重新计算所有选品评分");

        loadConfigIfNeeded();

        // 先更新周标记
        updateWeekTags();

        // 查询所有选品
        List<Selection> selections = selectionMapper.selectList(
                new LambdaQueryWrapper<Selection>()
        );

        return calculateAndUpdateScores(selections);
    }

    // ==================== 评分本周数据 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> scoreCurrentWeek() {
        log.info("评分本周数据");

        loadConfigIfNeeded();

        // 先更新周标记
        updateWeekTags();

        // 查询本周数据
        List<Selection> currentWeekSelections = selectionMapper.selectList(
                new LambdaQueryWrapper<Selection>()
                        .eq(Selection::getIsCurrent, 1)
        );

        return calculateAndUpdateScores(currentWeekSelections);
    }

    // ==================== 获取等级统计 ====================

    @Override
    public List<Map<String, Object>> getGradeStats() {
        log.info("获取等级统计");

        loadConfigIfNeeded();

        // 查询所有选品
        List<Selection> selections = selectionMapper.selectList(
                new LambdaQueryWrapper<Selection>()
        );

        // 构建颜色映射
        Map<String, String> colorMap = new HashMap<>();
        if (gradeCache != null) {
            for (GradeThreshold threshold : gradeCache) {
                colorMap.put(threshold.getGrade(), threshold.getColor());
            }
        }

        // 按等级分组统计
        Map<String, Integer> gradeCountMap = new LinkedHashMap<>();
        // 初始化所有等级
        if (gradeCache != null) {
            for (GradeThreshold threshold : gradeCache) {
                gradeCountMap.put(threshold.getGrade(), 0);
            }
        }
        if (gradeCountMap.isEmpty()) {
            // 默认等级
            gradeCountMap.put("S", 0);
            gradeCountMap.put("A", 0);
            gradeCountMap.put("B", 0);
            gradeCountMap.put("C", 0);
            gradeCountMap.put("D", 0);
        }

        int noGradeCount = 0;
        for (Selection selection : selections) {
            String grade = selection.getGrade();
            if (grade != null && gradeCountMap.containsKey(grade)) {
                gradeCountMap.put(grade, gradeCountMap.get(grade) + 1);
            } else if (grade != null) {
                gradeCountMap.put(grade, gradeCountMap.getOrDefault(grade, 0) + 1);
            } else {
                noGradeCount++;
            }
        }

        // 构建结果列表
        List<Map<String, Object>> stats = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : gradeCountMap.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("grade", entry.getKey());
            item.put("count", entry.getValue());
            item.put("color", colorMap.get(entry.getKey()));
            stats.add(item);
        }

        // 如果有未分级的选品，也加入统计
        if (noGradeCount > 0) {
            Map<String, Object> noGradeItem = new HashMap<>();
            noGradeItem.put("grade", "N/A");
            noGradeItem.put("count", noGradeCount);
            noGradeItem.put("color", null);
            stats.add(noGradeItem);
        }

        log.info("等级统计完成: {}", stats);
        return stats;
    }

    // ==================== 核心评分算法（对齐 Python） ====================

    /**
     * 批量计算并更新评分
     */
    private Map<String, Object> calculateAndUpdateScores(List<Selection> selections) {
        int total = selections.size();
        int success = 0;
        int failed = 0;

        for (Selection selection : selections) {
            try {
                calculateAndUpdateScore(selection);
                success++;
            } catch (Exception e) {
                failed++;
                log.warn("计算选品评分失败: id={}, asin={}, error={}",
                        selection.getId(), selection.getAsin(), e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("success", success);
        result.put("failed", failed);

        log.info("评分计算完成: 总数={}, 成功={}, 失败={}", total, success, failed);
        return result;
    }

    /**
     * 计算单个选品的评分并更新到数据库
     * <p>
     * 对齐 Python: score_product()
     */
    private void calculateAndUpdateScore(Selection selection) {
        Map<String, Object> result = scoreProduct(selection);

        int score = (Integer) result.get("score");
        String grade = (String) result.get("grade");

        selection.setScore(score);
        selection.setGrade(grade);
        selectionMapper.updateById(selection);

        log.debug("选品评分更新: id={}, asin={}, score={}, grade={}",
                selection.getId(), selection.getAsin(), score, grade);
    }

    /**
     * 计算单个商品的评分
     * <p>
     * 对齐 Python ScoringEngine.score_product()
     * 
     * 核心逻辑：
     * 1. FBM 特殊规则：直接给 S 级 100 分
     * 2. 计算各维度得分（查表）
     * 3. 加权平均
     * 4. 确定等级
     *
     * @param selection 选品实体
     * @return {"score": int, "grade": str}
     */
    private Map<String, Object> scoreProduct(Selection selection) {
        Map<String, Object> result = new HashMap<>();

        // ==================== FBM 特殊规则（对齐 Python） ====================
        // Python: if delivery_method == 'FBM': return {"score": 100, "grade": "S"}
        String deliveryMethod = selection.getDeliveryMethod();
        if (deliveryMethod != null && "FBM".equalsIgnoreCase(deliveryMethod.trim())) {
            result.put("score", 100);
            result.put("grade", "S");
            log.debug("FBM 商品直接评分: asin={}, score=100, grade=S", selection.getAsin());
            return result;
        }

        // ==================== 计算各维度得分 ====================
        double weightedSum = 0.0;
        double totalWeight = 0.0;

        if (configCache != null) {
            for (ScoringConfig dim : configCache) {
                if (dim.getIsActive() != null && !dim.getIsActive()) {
                    continue;
                }

                String key = dim.getDimensionKey();
                double weight = dim.getWeight() != null ? dim.getWeight() : 0.0;
                List<Map<String, Object>> thresholds = parseThresholds(dim.getThresholds());

                // 获取维度原始值
                Double rawValue = getDimensionValue(key, selection);
                if (rawValue == null) {
                    continue;
                }

                // 查表得分
                int dimScore = lookupScore(key, rawValue, thresholds);
                weightedSum += dimScore * (weight / 100.0);
                totalWeight += weight;
            }
        }

        // ==================== 计算综合得分 ====================
        int score;
        if (totalWeight > 0) {
            score = (int) Math.round(weightedSum * 100 / totalWeight);
        } else {
            score = 0;
        }

        score = Math.max(0, Math.min(100, score));

        // ==================== 确定等级 ====================
        String grade = determineGrade(score);

        result.put("score", score);
        result.put("grade", grade);
        return result;
    }

    /**
     * 获取维度原始值
     * <p>
     * 对齐 Python: _get_dimension_value()
     */
    private Double getDimensionValue(String key, Selection selection) {
        switch (key) {
            case "listing_age":
                // 上架天数（越小越好）
                LocalDateTime listingDate = selection.getListingDate();
                if (listingDate == null) {
                    return null;
                }
                long days = Duration.between(listingDate, LocalDateTime.now()).toDays();
                return Math.max(0.0, (double) days);

            case "sales_volume":
                // 销量
                Integer salesVolume = selection.getSalesVolume();
                return salesVolume != null ? salesVolume.doubleValue() : null;

            case "bsr_rank":
                // BSR 排名（越小越好）
                Integer mainCategoryRank = selection.getMainCategoryRank();
                return mainCategoryRank != null ? mainCategoryRank.doubleValue() : null;

            case "price":
                // 价格
                BigDecimal price = selection.getPrice();
                return price != null ? price.doubleValue() : null;

            default:
                return null;
        }
    }

    /**
     * 根据阈值配置查表得分数
     * <p>
     * 对齐 Python: _lookup_score()
     */
    private int lookupScore(String key, double value, List<Map<String, Object>> thresholds) {
        if (thresholds == null || thresholds.isEmpty()) {
            return 0;
        }

        switch (key) {
            case "listing_age":
            case "bsr_rank":
                // 越小越好：value <= max
                for (Map<String, Object> t : thresholds) {
                    Double max = getDoubleFromMap(t, "max");
                    if (max != null && value <= max) {
                        return getIntFromMap(t, "score", 0);
                    }
                }
                // 超出范围取最后一个
                return getIntFromMap(thresholds.get(thresholds.size() - 1), "score", 0);

            case "sales_volume":
            case "price":
                // 区间匹配：min <= value < max
                for (Map<String, Object> t : thresholds) {
                    Double min = getDoubleFromMap(t, "min");
                    Double max = getDoubleFromMap(t, "max");
                    double minVal = min != null ? min : 0.0;
                    double maxVal = max != null ? max : Double.MAX_VALUE;
                    if (minVal <= value && value < maxVal) {
                        return getIntFromMap(t, "score", 0);
                    }
                }
                // 超出范围取最后一个
                return getIntFromMap(thresholds.get(thresholds.size() - 1), "score", 0);

            default:
                return 0;
        }
    }

    /**
     * 根据分数确定等级
     * <p>
     * 对齐 Python: _determine_grade()
     */
    private String determineGrade(int score) {
        if (gradeCache != null && !gradeCache.isEmpty()) {
            for (GradeThreshold g : gradeCache) {
                int minScore = g.getMinScore() != null ? g.getMinScore() : 0;
                int maxScore = g.getMaxScore() != null ? g.getMaxScore() : 100;
                if (minScore <= score && score <= maxScore) {
                    return g.getGrade();
                }
            }
        }

        // 默认阈值（对齐 Python）
        if (score >= 90) {
            return "S";
        } else if (score >= 80) {
            return "A";
        } else if (score >= 65) {
            return "B";
        } else if (score >= 50) {
            return "C";
        } else {
            return "D";
        }
    }

    // ==================== 周标记更新 ====================

    /**
     * 更新周标记
     * <p>
     * 对齐 Python: _update_week_tags()
     */
    private void updateWeekTags() {
        // 获取当前 ISO 周标记
        String weekTag = getCurrentWeekTag();

        // 计算本周一的日期
        LocalDate monday = getMondayOfCurrentWeek();

        // 先将所有 is_current 重置为 0
        selectionMapper.resetAllCurrentFlag();

        // 根据 created_at 标记本周产品
        int updated = selectionMapper.updateWeekTag(weekTag, monday.atStartOfDay());

        log.info("周标记更新完成：{} 条产品标记为本周 ({})", updated, weekTag);
    }

    /**
     * 获取当前 ISO 周标记，格式: 2026-W19
     * <p>
     * 对齐 Python: get_current_week_tag()
     */
    private String getCurrentWeekTag() {
        LocalDate now = LocalDate.now();
        int isoYear = now.get(IsoFields.WEEK_BASED_YEAR);
        int isoWeek = now.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        return String.format("%d-W%02d", isoYear, isoWeek);
    }

    /**
     * 获取本周一的日期
     */
    private LocalDate getMondayOfCurrentWeek() {
        LocalDate now = LocalDate.now();
        int dayOfWeek = now.getDayOfWeek().getValue(); // Monday = 1, Sunday = 7
        return now.minusDays(dayOfWeek - 1);
    }

    // ==================== 辅助方法 ====================

    /**
     * 解析 thresholds JSON
     */
    private List<Map<String, Object>> parseThresholds(String thresholdsJson) {
        if (thresholdsJson == null || thresholdsJson.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(thresholdsJson, new TypeReference<List<Map<String, Object>>>() {});
        } catch (JsonProcessingException e) {
            log.warn("解析 thresholds 失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private Double getDoubleFromMap(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }

    private int getIntFromMap(Map<String, Object> map, String key, int defaultValue) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return defaultValue;
    }
}
