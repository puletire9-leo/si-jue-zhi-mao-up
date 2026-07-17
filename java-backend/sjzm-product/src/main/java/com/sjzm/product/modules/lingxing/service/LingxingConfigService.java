package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import com.sjzm.product.modules.lingxing.config.LingxingConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 领星凭证配置服务。
 * AppId/AppSecret 优先读 api_config 表，缺失时回退 LingxingConfig（环境变量）。
 * 仿 BazhuayuConfigService 的 DB 覆盖 env 模式。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingConfigService {

    private final LingxingConfig config;
    private final ApiConfigMapper apiConfigMapper;

    private static final String KEY_APP_ID = "lingxing_app_id";
    private static final String KEY_APP_SECRET = "lingxing_app_secret";

    public String getAppId() {
        String db = readConfig(KEY_APP_ID);
        return (db != null && !db.isBlank()) ? db : config.getAppId();
    }

    public String getAppSecret() {
        String db = readConfig(KEY_APP_SECRET);
        return (db != null && !db.isBlank()) ? db : config.getAppSecret();
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateCredentials(String appId, String appSecret) {
        if (appId != null && !appId.isBlank()) saveConfig(KEY_APP_ID, appId, "领星开放平台 AppId");
        if (appSecret != null && !appSecret.isBlank()) saveConfig(KEY_APP_SECRET, appSecret, "领星开放平台 AppSecret");
        log.info("领星凭证已更新");
    }

    private String readConfig(String key) {
        try {
            ApiConfig c = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, key));
            return c != null ? c.getConfigValue() : null;
        } catch (Exception e) {
            log.warn("读取配置 {} 失败: {}", key, e.getMessage());
            return null;
        }
    }

    private void saveConfig(String key, String value, String desc) {
        ApiConfig existing = apiConfigMapper.selectOne(
                new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, key));
        int affectedRows;
        if (existing != null) {
            existing.setConfigValue(value);
            affectedRows = apiConfigMapper.updateById(existing);
        } else {
            ApiConfig created = new ApiConfig();
            created.setConfigKey(key);
            created.setConfigValue(value);
            created.setDescription(desc);
            affectedRows = apiConfigMapper.insert(created);
        }
        if (affectedRows != 1) {
            throw new IllegalStateException("持久化配置 " + key + " 失败，影响行数=" + affectedRows);
        }
    }
}
