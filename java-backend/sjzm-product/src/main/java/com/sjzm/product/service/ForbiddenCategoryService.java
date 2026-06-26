package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ForbiddenCategoryService {

    private static final String CONFIG_KEY = "forbidden_categories";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 19 类禁止类目硬编码兜底（来自 docs/选品算法/01-选品算法总体设计.md §3.1） */
    private static final Set<String> DEFAULT_FORBIDDEN = Set.of(
            "Apps & Games", "Digital Music", "Kindle Store", "Prime Video", "Software", "Gift Cards",
            "Electronics & Photo", "Computers & Accessories", "Amazon Devices & Accessories",
            "Large Appliances", "Lighting",
            "Books", "CDs & Vinyl", "DVD & Blu-ray",
            "Grocery", "Musical Instruments & DJ", "Amazon Renewed", "New Finds", "PC & Video Games"
    );

    private final ApiConfigMapper apiConfigMapper;

    /** 判断一级类目名是否禁止。配置缺失/非法时回退硬编码。 */
    public boolean isForbidden(String categoryL1) {
        if (categoryL1 == null || categoryL1.isBlank()) {
            return false;
        }
        return loadForbidden().contains(categoryL1);
    }

    private Set<String> loadForbidden() {
        try {
            ApiConfig cfg = apiConfigMapper.selectOne(
                    new LambdaQueryWrapper<ApiConfig>().eq(ApiConfig::getConfigKey, CONFIG_KEY));
            if (cfg != null && cfg.getConfigValue() != null && !cfg.getConfigValue().isBlank()) {
                List<String> list = MAPPER.readValue(cfg.getConfigValue(),
                        MAPPER.getTypeFactory().constructCollectionType(List.class, String.class));
                if (!list.isEmpty()) {
                    return Set.copyOf(list);
                }
            }
        } catch (Exception e) {
            log.warn("禁止类目配置解析失败，回退硬编码: {}", e.getMessage());
        }
        return DEFAULT_FORBIDDEN;
    }
}
