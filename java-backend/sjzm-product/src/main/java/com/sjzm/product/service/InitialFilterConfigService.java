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

/**
 * 初筛配置管理：读写 api_config 表，key 前缀 initial_filter_
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InitialFilterConfigService {

    private final ApiConfigMapper apiConfigMapper;

    private static final String PREFIX = "initial_filter_";

    // 默认值
    private volatile BigDecimal priceMin = new BigDecimal("4.99");
    private volatile BigDecimal priceMax = new BigDecimal("19.99");
    private volatile int reviewMax = 5;

    @PostConstruct
    public void init() {
        loadFromDb();
    }

    private void loadFromDb() {
        try {
            List<ApiConfig> configs = apiConfigMapper.selectList(
                    new LambdaQueryWrapper<ApiConfig>().likeRight(ApiConfig::getConfigKey, PREFIX));
            for (ApiConfig c : configs) {
                String key = c.getConfigKey().substring(PREFIX.length());
                String val = c.getConfigValue();
                try {
                    switch (key) {
                        case "price_min" -> priceMin = new BigDecimal(val);
                        case "price_max" -> priceMax = new BigDecimal(val);
                        case "review_max" -> reviewMax = Integer.parseInt(val);
                    }
                } catch (Exception ignored) {}
            }
            log.info("初筛配置加载完成: {}", getConfig());
        } catch (Exception e) {
            log.warn("加载初筛配置失败，使用默认值: {}", e.getMessage());
        }
    }

    public Map<String, Object> getConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("priceMin", priceMin);
        config.put("priceMax", priceMax);
        config.put("reviewMax", reviewMax);
        return config;
    }

    public void updateConfig(Map<String, Object> updates) {
        if (updates.containsKey("priceMin")) {
            priceMin = new BigDecimal(updates.get("priceMin").toString());
            saveKey("price_min", priceMin.toString(), "初筛价格下限");
        }
        if (updates.containsKey("priceMax")) {
            priceMax = new BigDecimal(updates.get("priceMax").toString());
            saveKey("price_max", priceMax.toString(), "初筛价格上限");
        }
        if (updates.containsKey("reviewMax")) {
            reviewMax = ((Number) updates.get("reviewMax")).intValue();
            saveKey("review_max", String.valueOf(reviewMax), "初筛评论数上限");
        }
        log.info("初筛配置已更新: {}", getConfig());
    }

    private void saveKey(String key, String value, String desc) {
        try {
            String fullKey = PREFIX + key;
            ApiConfig existing = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, fullKey));
            if (existing != null) {
                existing.setConfigValue(value);
                apiConfigMapper.updateById(existing);
            } else {
                ApiConfig c = new ApiConfig();
                c.setConfigKey(fullKey);
                c.setConfigValue(value);
                c.setDescription(desc);
                apiConfigMapper.insert(c);
            }
        } catch (Exception e) {
            log.warn("保存初筛配置 {} 失败: {}", key, e.getMessage());
        }
    }

    public BigDecimal getPriceMin() { return priceMin; }
    public BigDecimal getPriceMax() { return priceMax; }
    public int getReviewMax() { return reviewMax; }
}
