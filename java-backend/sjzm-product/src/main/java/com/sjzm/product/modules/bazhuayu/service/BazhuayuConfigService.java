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
    /** 功能→站点→任务ID 映射，JSON：{"bangdan":{"US":"<taskId>",...},"yitushitu":{...}} */
    private static final String KEY_TASK_MAPPING = "bazhuayu_taskgroup_mapping";

    /** 榜单采集功能键（一条龙 drain 入库初筛 + 现有定时） */
    public static final String FUNC_BANGDAN = "bangdan";
    /** 以图识图功能键（本期仅启停/监控，数据管道下一步） */
    public static final String FUNC_YITUSHITU = "yitushitu";

    public String getUsername() {
        String db = readConfig(KEY_USERNAME);
        return (db != null && !db.isBlank()) ? db : config.getUsername();
    }

    public String getPassword() {
        String db = readConfig(KEY_PASSWORD);
        return (db != null && !db.isBlank()) ? db : config.getPassword();
    }

    /**
     * 解析任务映射。返回 marketplace → taskId 的扁平映射（**仅榜单功能**）。
     * 现有定时 drain / "读取已采数据" 只针对榜单，故只取 bangdan 组，
     * 避免以图识图同站点(US/UK/DE) taskId 覆盖榜单。
     */
    public Map<String, String> getMarketplaceTaskMap() {
        Map<String, String> bangdan = parseMapping().get(FUNC_BANGDAN);
        return bangdan != null ? new LinkedHashMap<>(bangdan) : new LinkedHashMap<>();
    }

    /**
     * 按功能 + 站点取 taskId。function 为 {@link #FUNC_BANGDAN}/{@link #FUNC_YITUSHITU}。
     * @return taskId，未配置返回 null
     */
    public String getTaskId(String function, String marketplace) {
        Map<String, String> siteMap = parseMapping().get(function);
        return siteMap != null ? siteMap.get(marketplace) : null;
    }

    /** 某功能下已配置的站点→taskId 映射（控制台按功能列任务用），未配置返回空。 */
    public Map<String, String> getFunctionTaskMap(String function) {
        Map<String, String> siteMap = parseMapping().get(function);
        return siteMap != null ? new LinkedHashMap<>(siteMap) : new LinkedHashMap<>();
    }

    /**
     * 解析整张映射 {function: {marketplace: taskId}}。DB(api_config) 优先，缺失回退 env。
     * 解析失败或未配置返回空 map（调用方各自兜底）。
     */
    private Map<String, Map<String, String>> parseMapping() {
        String json = readConfig(KEY_TASK_MAPPING);
        if (json == null || json.isBlank()) {
            json = config.getTaskMappingJson();
        }
        if (json == null || json.isBlank()) {
            log.warn("八爪鱼任务映射未配置（api_config.{} 或 BAZHUAYU_TASKGROUP_MAPPING）", KEY_TASK_MAPPING);
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("解析八爪鱼任务映射失败: {}", e.getMessage());
            return new LinkedHashMap<>();
        }
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
