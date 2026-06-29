package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import com.sjzm.product.modules.bazhuayu.config.BazhuayuConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 八爪鱼凭证 + 任务映射配置服务。
 * 密钥/账号优先读 api_config 表，缺失时回退 BazhuayuConfig（环境变量）。
 * 仿 SellerspriteConfigService 的 DB 覆盖 env 模式。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BazhuayuConfigService {

    private final BazhuayuConfig config;
    private final ApiConfigMapper apiConfigMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String KEY_USERNAME = "bazhuayu_username";
    private static final String KEY_PASSWORD = "bazhuayu_password";
    /** 任务组→站点→任务ID 映射，JSON：{"<groupId>":{"US":"<taskId>","UK":"...","DE":"..."}} */
    private static final String KEY_TASK_MAPPING = "bazhuayu_taskgroup_mapping";

    public String getUsername() {
        String db = readConfig(KEY_USERNAME);
        return (db != null && !db.isBlank()) ? db : config.getUsername();
    }

    public String getPassword() {
        String db = readConfig(KEY_PASSWORD);
        return (db != null && !db.isBlank()) ? db : config.getPassword();
    }

    /**
     * 解析任务映射。返回 marketplace → taskId 的扁平映射。
     * 配置形如 {"<groupId>":{"US":"<taskId>","UK":"<taskId>","DE":"<taskId>"}}，
     * 多个任务组的站点条目会合并（同站点后者覆盖前者）。
     */
    public Map<String, String> getMarketplaceTaskMap() {
        // DB(api_config) 优先，缺失时回退配置文件(env)
        String json = readConfig(KEY_TASK_MAPPING);
        if (json == null || json.isBlank()) {
            json = config.getTaskMappingJson();
        }
        Map<String, String> flat = new LinkedHashMap<>();
        if (json == null || json.isBlank()) {
            log.warn("八爪鱼任务映射未配置（api_config.{} 或 BAZHUAYU_TASKGROUP_MAPPING），无法自动采集", KEY_TASK_MAPPING);
            return flat;
        }
        try {
            Map<String, Map<String, String>> byGroup =
                    objectMapper.readValue(json, new TypeReference<>() {});
            for (Map<String, String> siteMap : byGroup.values()) {
                if (siteMap != null) flat.putAll(siteMap);
            }
        } catch (Exception e) {
            log.error("解析八爪鱼任务映射失败: {}", e.getMessage());
        }
        return flat;
    }

    public void updateCredentials(String username, String password) {
        if (username != null && !username.isBlank()) saveConfig(KEY_USERNAME, username, "八爪鱼登录账号");
        if (password != null && !password.isBlank()) saveConfig(KEY_PASSWORD, password, "八爪鱼登录密码");
        log.info("八爪鱼凭证已更新");
    }

    public void updateTaskMapping(String json) {
        // 校验是合法 JSON
        try {
            objectMapper.readValue(json, new TypeReference<Map<String, Map<String, String>>>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("任务映射不是合法 JSON: " + e.getMessage());
        }
        saveConfig(KEY_TASK_MAPPING, json, "八爪鱼任务组→站点→任务ID 映射");
        log.info("八爪鱼任务映射已更新");
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
        try {
            ApiConfig existing = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, key));
            if (existing != null) {
                existing.setConfigValue(value);
                apiConfigMapper.updateById(existing);
            } else {
                ApiConfig c = new ApiConfig();
                c.setConfigKey(key);
                c.setConfigValue(value);
                c.setDescription(desc);
                apiConfigMapper.insert(c);
            }
        } catch (Exception e) {
            log.warn("持久化配置 {} 失败: {}", key, e.getMessage());
        }
    }
}
