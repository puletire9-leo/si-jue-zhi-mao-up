package com.sjzm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 统计分析服务
 * <p>
 * 对齐 Python statistics 相关功能：
 * 1. 仪表板统计
 * 2. 图片趋势
 * 3. 存储统计
 * 4. 用户活动
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> getDashboardStats() {
        log.info("获取仪表板统计");

        Map<String, Object> stats = new HashMap<>();

        try {
            Long productCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM products WHERE status = 'normal'", Long.class);
            stats.put("productCount", productCount != null ? productCount : 0);

            Long selectionCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM selection_products", Long.class);
            stats.put("selectionCount", selectionCount != null ? selectionCount : 0);

            Long finalDraftCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM final_drafts", Long.class);
            stats.put("finalDraftCount", finalDraftCount != null ? finalDraftCount : 0);

            Long materialCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM material_library", Long.class);
            stats.put("materialCount", materialCount != null ? materialCount : 0);

            Long carrierCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM carrier_library", Long.class);
            stats.put("carrierCount", carrierCount != null ? carrierCount : 0);

            return stats;
        } catch (Exception e) {
            log.error("获取仪表板统计失败", e);
            throw new RuntimeException("获取仪表板统计失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getImageTrend(int days) {
        log.info("获取图片趋势: days={}", days);

        Map<String, Object> result = new HashMap<>();

        try {
            String sql = """
                    SELECT DATE(created_at) as date, COUNT(*) as count
                    FROM image_library
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY DATE(created_at)
                    ORDER BY date
                    """;

            List<Map<String, Object>> trendData = jdbcTemplate.queryForList(sql, days);

            List<String> dates = new ArrayList<>();
            List<Integer> counts = new ArrayList<>();

            for (Map<String, Object> row : trendData) {
                dates.add(String.valueOf(row.get("date")));
                counts.add(((Number) row.get("count")).intValue());
            }

            result.put("dates", dates);
            result.put("counts", counts);
            result.put("total", counts.stream().mapToInt(Integer::intValue).sum());

            return result;
        } catch (Exception e) {
            log.error("获取图片趋势失败", e);
            throw new RuntimeException("获取图片趋势失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getStorageStats() {
        log.info("获取存储统计");

        Map<String, Object> stats = new HashMap<>();

        try {
            Long totalImages = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM image_library", Long.class);
            stats.put("totalImages", totalImages != null ? totalImages : 0);

            stats.put("cosUsedBytes", 0L);
            stats.put("cosQuotaBytes", 10737418240L);
            stats.put("localUsedBytes", 0L);

            return stats;
        } catch (Exception e) {
            log.error("获取存储统计失败", e);
            throw new RuntimeException("获取存储统计失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getUserActivity(int days) {
        log.info("获取用户活动统计: days={}", days);

        Map<String, Object> result = new HashMap<>();

        try {
            String loginSql = """
                    SELECT COUNT(*) FROM users
                    WHERE last_login_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    """;
            Long activeUsers = jdbcTemplate.queryForObject(loginSql, Long.class);
            result.put("activeUsers", activeUsers != null ? activeUsers : 0);

            String totalSql = "SELECT COUNT(*) FROM users";
            Long totalUsers = jdbcTemplate.queryForObject(totalSql, Long.class);
            result.put("totalUsers", totalUsers != null ? totalUsers : 0);

            return result;
        } catch (Exception e) {
            log.error("获取用户活动统计失败", e);
            throw new RuntimeException("获取用户活动统计失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getImageQualityStats() {
        log.info("获取图片质量统计");

        Map<String, Object> stats = new HashMap<>();

        try {
            Long totalImages = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM image_library", Long.class);
            stats.put("totalImages", totalImages != null ? totalImages : 0);

            stats.put("highQuality", 0);
            stats.put("mediumQuality", 0);
            stats.put("lowQuality", 0);
            stats.put("untested", totalImages != null ? totalImages : 0);

            return stats;
        } catch (Exception e) {
            log.error("获取图片质量统计失败", e);
            throw new RuntimeException("获取图片质量统计失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getProductTypeStats() {
        log.info("获取产品类型统计");

        Map<String, Object> stats = new HashMap<>();

        try {
            String sql = """
                    SELECT type, COUNT(*) as count
                    FROM products
                    WHERE status = 'normal'
                    GROUP BY type
                    """;

            List<Map<String, Object>> typeData = jdbcTemplate.queryForList(sql);

            Map<String, Integer> typeDistribution = new HashMap<>();
            for (Map<String, Object> row : typeData) {
                String type = (String) row.get("type");
                int count = ((Number) row.get("count")).intValue();
                typeDistribution.put(type != null ? type : "未知", count);
            }

            stats.put("distribution", typeDistribution);

            return stats;
        } catch (Exception e) {
            log.error("获取产品类型统计失败", e);
            throw new RuntimeException("获取产品类型统计失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getSelectionGradeStats() {
        log.info("获取选品等级统计");

        Map<String, Object> stats = new HashMap<>();

        try {
            String sql = """
                    SELECT grade, COUNT(*) as count
                    FROM selection_products
                    WHERE grade IS NOT NULL
                    GROUP BY grade
                    """;

            List<Map<String, Object>> gradeData = jdbcTemplate.queryForList(sql);

            Map<String, Integer> gradeDistribution = new HashMap<>();
            for (Map<String, Object> row : gradeData) {
                String grade = (String) row.get("grade");
                int count = ((Number) row.get("count")).intValue();
                gradeDistribution.put(grade != null ? grade : "未评分", count);
            }

            stats.put("distribution", gradeDistribution);

            return stats;
        } catch (Exception e) {
            log.error("获取选品等级统计失败", e);
            throw new RuntimeException("获取选品等级统计失败: " + e.getMessage());
        }
    }
}
