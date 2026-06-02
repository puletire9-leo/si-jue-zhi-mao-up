package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.config.SellerspriteConfig;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerspriteConfigService {

    private final SellerspriteConfig config;
    private final ApiConfigMapper apiConfigMapper;
    private final ApiRateLimitService apiRateLimitService;

    private volatile String secretKey; // null = fallback to YAML env var

    private static final String DB_KEY = "sellersprite_secret_key";

    @PostConstruct
    public void init() {
        try {
            ApiConfig dbConfig = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, DB_KEY));
            if (dbConfig != null && dbConfig.getConfigValue() != null
                    && !dbConfig.getConfigValue().isBlank()) {
                secretKey = dbConfig.getConfigValue();
                log.info("从 DB 加载卖家精灵密钥");
            } else {
                secretKey = null;
                log.info("使用环境变量中的卖家精灵密钥");
            }
        } catch (Exception e) {
            log.warn("加载卖家精灵密钥失败，使用 YAML 默认值: {}", e.getMessage());
        }
    }

    public String getSecretKey() {
        String key = secretKey;
        return key != null ? key : config.getSecretKey();
    }

    public void updateSecretKey(String newKey) {
        if (newKey == null || newKey.isBlank()) {
            throw new IllegalArgumentException("API Key 不能为空");
        }
        saveKeyToDb(newKey);
        secretKey = newKey;
        log.info("卖家精灵密钥已更新");
    }

    public Map<String, Object> getConfigInfo() {
        return Map.of(
                "apiUrl", config.getApiUrl(),
                "secretKeyMasked", maskKey(getSecretKey()),
                "maxPerMinute", apiRateLimitService.getMaxPerMinute(),
                "maxPerMonth", apiRateLimitService.getMaxPerMonth(),
                "maxAsinsPerRequest", apiRateLimitService.getMaxAsinsPerRequest()
        );
    }

    private String maskKey(String key) {
        if (key == null || key.isBlank()) return "未配置";
        if (key.length() <= 4) return "****";
        return "****" + key.substring(key.length() - 4);
    }

    private void saveKeyToDb(String value) {
        try {
            ApiConfig existing = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, DB_KEY));
            if (existing != null) {
                existing.setConfigValue(value);
                apiConfigMapper.updateById(existing);
            } else {
                ApiConfig c = new ApiConfig();
                c.setConfigKey(DB_KEY);
                c.setConfigValue(value);
                c.setDescription("卖家精灵 API 密钥");
                apiConfigMapper.insert(c);
            }
        } catch (Exception e) {
            log.warn("持久化卖家精灵密钥失败: {}", e.getMessage());
        }
    }
}
