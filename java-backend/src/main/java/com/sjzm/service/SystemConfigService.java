package com.sjzm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 系统配置服务
 * <p>
 * 对齐 Python system_config.py：
 * 1. 开发人列表 CRUD
 * 2. 载体列表 CRUD
 * 3. 图片设置 CRUD
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final JdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ==================== 开发人列表 ====================

    public Map<String, Object> getDeveloperList() {
        log.info("获取开发人列表");

        Map<String, Object> result = new HashMap<>();

        try {
            List<Map<String, Object>> configs = jdbcTemplate.queryForList(
                    "SELECT config_value FROM system_config WHERE config_key = 'developer_list'");

            List<String> developerList = new ArrayList<>();
            if (!configs.isEmpty()) {
                String configValue = (String) configs.get(0).get("config_value");
                if (configValue != null && !configValue.isEmpty()) {
                    developerList = Arrays.asList(configValue.split(","));
                }
            }

            result.put("developerList", developerList);
            return result;
        } catch (Exception e) {
            log.error("获取开发人列表失败", e);
            throw new RuntimeException("获取开发人列表失败: " + e.getMessage());
        }
    }

    public Map<String, Object> updateDeveloperList(List<String> developerList, String updatedBy) {
        log.info("更新开发人列表: {}", developerList.size());

        Map<String, Object> result = new HashMap<>();

        try {
            List<String> filteredList = new ArrayList<>();
            for (String dev : developerList) {
                String trimmed = dev.trim();
                if (!trimmed.isEmpty()) {
                    filteredList.add(trimmed);
                }
            }

            if (filteredList.isEmpty()) {
                throw new RuntimeException("开发人列表不能为空");
            }

            String configValue = String.join(",", filteredList);

            String sql = """
                    INSERT INTO system_config (config_key, config_value, description, is_system, updated_by, updated_at)
                    VALUES ('developer_list', ?, '开发人列表，用于定稿管理页面的开发人筛选和选择', FALSE, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        config_value = VALUES(config_value),
                        updated_by = VALUES(updated_by),
                        updated_at = NOW()
                    """;

            jdbcTemplate.update(sql, configValue, updatedBy);

            result.put("developerList", filteredList);
            return result;
        } catch (Exception e) {
            log.error("更新开发人列表失败", e);
            throw new RuntimeException("更新开发人列表失败: " + e.getMessage());
        }
    }

    // ==================== 载体列表 ====================

    public Map<String, Object> getCarrierList() {
        log.info("获取载体列表");

        Map<String, Object> result = new HashMap<>();

        try {
            List<Map<String, Object>> configs = jdbcTemplate.queryForList(
                    "SELECT config_value FROM system_config WHERE config_key = 'carrier_list'");

            List<String> carrierList = new ArrayList<>();
            if (!configs.isEmpty()) {
                String configValue = (String) configs.get(0).get("config_value");
                if (configValue != null && !configValue.isEmpty()) {
                    carrierList = Arrays.asList(configValue.split(","));
                }
            }

            result.put("carrierList", carrierList);
            return result;
        } catch (Exception e) {
            log.error("获取载体列表失败", e);
            throw new RuntimeException("获取载体列表失败: " + e.getMessage());
        }
    }

    public Map<String, Object> updateCarrierList(List<String> carrierList, String updatedBy) {
        log.info("更新载体列表: {}", carrierList.size());

        Map<String, Object> result = new HashMap<>();

        try {
            List<String> filteredList = new ArrayList<>();
            for (String carrier : carrierList) {
                String trimmed = carrier.trim();
                if (!trimmed.isEmpty()) {
                    filteredList.add(trimmed);
                }
            }

            String configValue = String.join(",", filteredList);

            String sql = """
                    INSERT INTO system_config (config_key, config_value, description, is_system, updated_by, updated_at)
                    VALUES ('carrier_list', ?, '载体列表，用于系统配置', FALSE, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        config_value = VALUES(config_value),
                        updated_by = VALUES(updated_by),
                        updated_at = NOW()
                    """;

            jdbcTemplate.update(sql, configValue, updatedBy);

            result.put("carrierList", filteredList);
            return result;
        } catch (Exception e) {
            log.error("更新载体列表失败", e);
            throw new RuntimeException("更新载体列表失败: " + e.getMessage());
        }
    }

    // ==================== 图片设置 ====================

    public Map<String, Object> getImageSettings() {
        log.info("获取图片设置");

        Map<String, Object> result = new HashMap<>();
        Map<String, String> configMap = new HashMap<>();

        try {
            List<Map<String, Object>> configs = jdbcTemplate.queryForList(
                    "SELECT config_key, config_value FROM system_config WHERE config_key IN ('max_image_size', 'product_card_width', 'product_card_height')");

            for (Map<String, Object> config : configs) {
                configMap.put((String) config.get("config_key"), (String) config.get("config_value"));
            }

            result.put("maxImageSize", configMap.getOrDefault("max_image_size", "10"));
            result.put("productCardWidth", configMap.getOrDefault("product_card_width", "200"));
            result.put("productCardHeight", configMap.getOrDefault("product_card_height", "200"));

            return result;
        } catch (Exception e) {
            log.error("获取图片设置失败", e);
            throw new RuntimeException("获取图片设置失败: " + e.getMessage());
        }
    }

    public Map<String, Object> updateImageSettings(int maxImageSize, int productCardWidth, int productCardHeight, String updatedBy) {
        log.info("更新图片设置: maxImageSize={}, productCardWidth={}, productCardHeight={}",
                maxImageSize, productCardWidth, productCardHeight);

        Map<String, Object> result = new HashMap<>();

        if (maxImageSize < 1 || maxImageSize > 200) {
            throw new RuntimeException("最大图片大小必须在1-200MB之间");
        }
        if (productCardWidth < 100 || productCardWidth > 500) {
            throw new RuntimeException("产品卡片宽度必须在100-500px之间");
        }
        if (productCardHeight < 100 || productCardHeight > 500) {
            throw new RuntimeException("产品卡片高度必须在100-500px之间");
        }

        try {
            String sql = """
                    INSERT INTO system_config (config_key, config_value, description, is_system, updated_by, updated_at)
                    VALUES (?, ?, ?, FALSE, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        config_value = VALUES(config_value),
                        updated_by = VALUES(updated_by),
                        updated_at = NOW()
                    """;

            jdbcTemplate.update(sql, "max_image_size", String.valueOf(maxImageSize),
                    "最大图片大小（MB）", updatedBy);
            jdbcTemplate.update(sql, "product_card_width", String.valueOf(productCardWidth),
                    "产品卡片宽度（px）", updatedBy);
            jdbcTemplate.update(sql, "product_card_height", String.valueOf(productCardHeight),
                    "产品卡片高度（px）", updatedBy);

            result.put("maxImageSize", maxImageSize);
            result.put("productCardWidth", productCardWidth);
            result.put("productCardHeight", productCardHeight);

            return result;
        } catch (Exception e) {
            log.error("更新图片设置失败", e);
            throw new RuntimeException("更新图片设置失败: " + e.getMessage());
        }
    }

    // ==================== 通用配置 ====================

    public Map<String, Object> getConfig(String configKey) {
        log.info("获取配置: key={}", configKey);

        try {
            List<Map<String, Object>> configs = jdbcTemplate.queryForList(
                    "SELECT config_value FROM system_config WHERE config_key = ?", configKey);

            Map<String, Object> result = new HashMap<>();
            if (!configs.isEmpty()) {
                result.put("configValue", configs.get(0).get("config_value"));
            }
            return result;
        } catch (Exception e) {
            log.error("获取配置失败: key={}", configKey, e);
            throw new RuntimeException("获取配置失败: " + e.getMessage());
        }
    }

    public Map<String, Object> setConfig(String configKey, String configValue, String description, String updatedBy) {
        log.info("设置配置: key={}", configKey);

        try {
            String sql = """
                    INSERT INTO system_config (config_key, config_value, description, is_system, updated_by, updated_at)
                    VALUES (?, ?, ?, FALSE, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        config_value = VALUES(config_value),
                        description = COALESCE(VALUES(description), description),
                        updated_by = VALUES(updated_by),
                        updated_at = NOW()
                    """;

            jdbcTemplate.update(sql, configKey, configValue, description, updatedBy);

            Map<String, Object> result = new HashMap<>();
            result.put("configKey", configKey);
            result.put("configValue", configValue);
            return result;
        } catch (Exception e) {
            log.error("设置配置失败: key={}", configKey, e);
            throw new RuntimeException("设置配置失败: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> listConfigs(String category) {
        log.info("列出配置: category={}", category);

        try {
            String sql = "SELECT config_key, config_value, description, is_system, updated_by, updated_at FROM system_config";
            List<Object> params = new ArrayList<>();

            if (category != null && !category.isEmpty()) {
                sql += " WHERE config_key LIKE ?";
                params.add(category + "%");
            }

            sql += " ORDER BY config_key";

            return jdbcTemplate.queryForList(sql, params.toArray());
        } catch (Exception e) {
            log.error("列出配置失败: category={}", category, e);
            throw new RuntimeException("列出配置失败: " + e.getMessage());
        }
    }
}
