package com.sjzm.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.user.entity.SystemConfig;
import com.sjzm.user.mapper.SystemConfigMapper;
import com.sjzm.user.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigServiceImpl implements SystemConfigService {

    private final SystemConfigMapper systemConfigMapper;

    @Override
    public List<SystemConfig> listAll() {
        return systemConfigMapper.selectList(
                new LambdaQueryWrapper<SystemConfig>()
                        .orderByAsc(SystemConfig::getCategory)
                        .orderByAsc(SystemConfig::getConfigKey)
        );
    }

    @Override
    public List<SystemConfig> listByCategory(String category) {
        return systemConfigMapper.selectList(
                new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getCategory, category)
                        .orderByAsc(SystemConfig::getConfigKey)
        );
    }

    @Override
    public String getValue(String configKey) {
        SystemConfig config = getByKey(configKey);
        return config == null ? null : config.getConfigValue();
    }

    @Override
    public SystemConfig getByKey(String configKey) {
        return systemConfigMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, configKey)
        );
    }

    @Override
    public void upsert(String configKey, String configValue, String category, String description) {
        SystemConfig existing = getByKey(configKey);
        if (existing == null) {
            SystemConfig config = new SystemConfig();
            config.setConfigKey(configKey);
            config.setConfigValue(configValue);
            config.setCategory(category);
            config.setDescription(description);
            systemConfigMapper.insert(config);
            log.info("[SystemConfig] 新增配置: key={}, category={}", configKey, category);
        } else {
            existing.setConfigValue(configValue);
            if (category != null) existing.setCategory(category);
            if (description != null) existing.setDescription(description);
            systemConfigMapper.updateById(existing);
            log.info("[SystemConfig] 更新配置: key={}", configKey);
        }
    }
}
