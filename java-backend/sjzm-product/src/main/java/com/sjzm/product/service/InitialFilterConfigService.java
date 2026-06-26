package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 初筛配置管理：读写 api_config 表，key 格式 initial_filter_{marketplace}_{field}
 * 兼容旧格式 initial_filter_{field}（视为 UK 配置）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InitialFilterConfigService {

    private final ApiConfigMapper apiConfigMapper;

    private static final String PREFIX = "initial_filter_";
    private static final String DEFAULT_MARKETPLACE = "UK";

    // 默认值
    private static final BigDecimal DEFAULT_PRICE_MIN = new BigDecimal("4.99");
    private static final BigDecimal DEFAULT_PRICE_MAX = new BigDecimal("19.99");
    private static final int DEFAULT_REVIEW_MAX = 5;

    /** 按 marketplace 存储配置 */
    private final ConcurrentHashMap<String, MarketplaceInitialConfig> configMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        loadFromDb();
    }

    private void loadFromDb() {
        try {
            List<ApiConfig> configs = apiConfigMapper.selectList(
                    new LambdaQueryWrapper<ApiConfig>().likeRight(ApiConfig::getConfigKey, PREFIX));
            for (ApiConfig c : configs) {
                String rawKey = c.getConfigKey().substring(PREFIX.length());
                String val = c.getConfigValue();

                // 兼容旧格式：initial_filter_price_min → 视为 UK
                // 新格式：initial_filter_UK_price_min
                String marketplace;
                String field;
                if (rawKey.matches("^[A-Z]{2}_.+")) {
                    int idx = rawKey.indexOf('_');
                    marketplace = rawKey.substring(0, idx);
                    field = rawKey.substring(idx + 1);
                } else {
                    marketplace = DEFAULT_MARKETPLACE;
                    field = rawKey;
                }

                MarketplaceInitialConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig());
                try {
                    switch (field) {
                        case "price_min" -> cfg.priceMin = new BigDecimal(val);
                        case "price_max" -> cfg.priceMax = new BigDecimal(val);
                        case "review_max" -> cfg.reviewMax = Integer.parseInt(val);
                    }
                } catch (Exception ignored) {}
            }
            log.info("初筛配置加载完成: {} 个市场", configMap.size());
            for (var entry : configMap.entrySet()) {
                log.info("  {} -> {}", entry.getKey(), getConfig(entry.getKey()));
            }
        } catch (Exception e) {
            log.warn("加载初筛配置失败，使用默认值: {}", e.getMessage());
        }
    }

    public Map<String, Object> getConfig(String marketplace) {
        MarketplaceInitialConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig());
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("priceMin", cfg.priceMin);
        config.put("priceMax", cfg.priceMax);
        config.put("reviewMax", cfg.reviewMax);
        config.put("marketplace", marketplace);
        return config;
    }

    /** 向后兼容：无参版本返回默认市场配置 */
    public Map<String, Object> getConfig() {
        return getConfig(DEFAULT_MARKETPLACE);
    }

    public void updateConfig(Map<String, Object> updates, String marketplace) {
        MarketplaceInitialConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig());

        if (updates.containsKey("priceMin")) {
            cfg.priceMin = new BigDecimal(updates.get("priceMin").toString());
            saveKey(marketplace, "price_min", cfg.priceMin.toString(), "初筛价格下限");
        }
        if (updates.containsKey("priceMax")) {
            cfg.priceMax = new BigDecimal(updates.get("priceMax").toString());
            saveKey(marketplace, "price_max", cfg.priceMax.toString(), "初筛价格上限");
        }
        if (updates.containsKey("reviewMax")) {
            cfg.reviewMax = ((Number) updates.get("reviewMax")).intValue();
            saveKey(marketplace, "review_max", String.valueOf(cfg.reviewMax), "初筛评论数上限");
        }
        log.info("初筛配置已更新 [{}]: {}", marketplace, getConfig(marketplace));
    }

    /** 向后兼容：无参版本更新默认市场 */
    public void updateConfig(Map<String, Object> updates) {
        updateConfig(updates, DEFAULT_MARKETPLACE);
    }

    private void saveKey(String marketplace, String field, String value, String desc) {
        try {
            String fullKey = PREFIX + marketplace + "_" + field;
            ApiConfig existing = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, fullKey));
            if (existing != null) {
                existing.setConfigValue(value);
                apiConfigMapper.updateById(existing);
            } else {
                ApiConfig c = new ApiConfig();
                c.setConfigKey(fullKey);
                c.setConfigValue(value);
                c.setDescription(desc + "(" + marketplace + ")");
                apiConfigMapper.insert(c);
            }
        } catch (Exception e) {
            log.warn("保存初筛配置 {} [{}] 失败: {}", field, marketplace, e.getMessage());
        }
    }

    // ---- getters with marketplace ----

    public BigDecimal getPriceMin(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig()).priceMin;
    }

    public BigDecimal getPriceMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig()).priceMax;
    }

    public int getReviewMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceInitialConfig()).reviewMax;
    }

    // ---- 向后兼容：无参版本返回默认市场 ----

    public BigDecimal getPriceMin() { return getPriceMin(DEFAULT_MARKETPLACE); }
    public BigDecimal getPriceMax() { return getPriceMax(DEFAULT_MARKETPLACE); }
    public int getReviewMax() { return getReviewMax(DEFAULT_MARKETPLACE); }

    /** 单个市场的初筛配置 */
    private static class MarketplaceInitialConfig {
        volatile BigDecimal priceMin = DEFAULT_PRICE_MIN;
        volatile BigDecimal priceMax = DEFAULT_PRICE_MAX;
        volatile int reviewMax = DEFAULT_REVIEW_MAX;
    }
}
