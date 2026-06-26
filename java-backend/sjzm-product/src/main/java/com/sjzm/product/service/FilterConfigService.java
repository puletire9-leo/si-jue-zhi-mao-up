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
 * 精筛配置管理：读写 api_config 表，key 格式 filter_{marketplace}_{field}
 * 兼容旧格式 filter_{field}（视为 UK 配置）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FilterConfigService {

    private final ApiConfigMapper apiConfigMapper;

    private static final String PREFIX = "filter_";
    private static final String DEFAULT_MARKETPLACE = "UK";

    // 默认值常量
    private static final BigDecimal DEFAULT_PRICE_MIN = new BigDecimal("4.99");
    private static final BigDecimal DEFAULT_PRICE_MAX = new BigDecimal("30.00");
    private static final int DEFAULT_LISTING_DAYS_MAX = 90;
    private static final int DEFAULT_BSR_MAX = 50000;
    private static final int DEFAULT_SALES_MIN = 5;
    private static final int DEFAULT_SALES_MAX = 200;
    private static final int DEFAULT_WEIGHT_MAX = 300;
    private static final int DEFAULT_DEAD_DAYS = 30;
    private static final int DEFAULT_MODE2_SALES_MIN = 50;
    private static final int DEFAULT_MODE2_BSR_MAX = 20000;

    /** 按 marketplace 存储配置 */
    private final ConcurrentHashMap<String, MarketplaceFilterConfig> configMap = new ConcurrentHashMap<>();

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

                // 兼容旧格式：filter_price_min → 视为 UK
                // 新格式：filter_UK_price_min
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

                MarketplaceFilterConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig());
                try {
                    switch (field) {
                        case "price_min" -> cfg.priceMin = new BigDecimal(val);
                        case "price_max" -> cfg.priceMax = new BigDecimal(val);
                        case "listing_days_max" -> cfg.listingDaysMax = Integer.parseInt(val);
                        case "bsr_max" -> cfg.bsrMax = Integer.parseInt(val);
                        case "sales_min" -> cfg.salesMin = Integer.parseInt(val);
                        case "sales_max" -> cfg.salesMax = Integer.parseInt(val);
                        case "weight_max" -> cfg.weightMax = Integer.parseInt(val);
                        case "dead_days" -> cfg.deadDays = Integer.parseInt(val);
                        case "mode2_sales_min" -> cfg.mode2SalesMin = Integer.parseInt(val);
                        case "mode2_bsr_max" -> cfg.mode2BsrMax = Integer.parseInt(val);
                    }
                } catch (Exception ignored) {}
            }
            log.info("精筛配置加载完成: {} 个市场", configMap.size());
            for (var entry : configMap.entrySet()) {
                log.info("  {} -> {}", entry.getKey(), getConfig(entry.getKey()));
            }
        } catch (Exception e) {
            log.warn("加载精筛配置失败，使用默认值: {}", e.getMessage());
        }
    }

    public Map<String, Object> getConfig(String marketplace) {
        MarketplaceFilterConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig());
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("priceMin", cfg.priceMin);
        config.put("priceMax", cfg.priceMax);
        config.put("listingDaysMax", cfg.listingDaysMax);
        config.put("bsrMax", cfg.bsrMax);
        config.put("salesMin", cfg.salesMin);
        config.put("salesMax", cfg.salesMax);
        config.put("weightMax", cfg.weightMax);
        config.put("deadDays", cfg.deadDays);
        config.put("mode2SalesMin", cfg.mode2SalesMin);
        config.put("mode2BsrMax", cfg.mode2BsrMax);
        config.put("marketplace", marketplace);
        return config;
    }

    /** 向后兼容：无参版本返回默认市场配置 */
    public Map<String, Object> getConfig() {
        return getConfig(DEFAULT_MARKETPLACE);
    }

    public void updateConfig(Map<String, Object> updates, String marketplace) {
        MarketplaceFilterConfig cfg = configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig());

        if (updates.containsKey("priceMin")) {
            cfg.priceMin = new BigDecimal(updates.get("priceMin").toString());
            saveKey(marketplace, "price_min", cfg.priceMin.toString(), "精筛价格下限");
        }
        if (updates.containsKey("priceMax")) {
            cfg.priceMax = new BigDecimal(updates.get("priceMax").toString());
            saveKey(marketplace, "price_max", cfg.priceMax.toString(), "精筛价格上限");
        }
        if (updates.containsKey("listingDaysMax")) {
            cfg.listingDaysMax = ((Number) updates.get("listingDaysMax")).intValue();
            saveKey(marketplace, "listing_days_max", String.valueOf(cfg.listingDaysMax), "精筛最大上架天数");
        }
        if (updates.containsKey("bsrMax")) {
            cfg.bsrMax = ((Number) updates.get("bsrMax")).intValue();
            saveKey(marketplace, "bsr_max", String.valueOf(cfg.bsrMax), "精筛最大BSR");
        }
        if (updates.containsKey("salesMin")) {
            cfg.salesMin = ((Number) updates.get("salesMin")).intValue();
            saveKey(marketplace, "sales_min", String.valueOf(cfg.salesMin), "精筛销量下限");
        }
        if (updates.containsKey("salesMax")) {
            cfg.salesMax = ((Number) updates.get("salesMax")).intValue();
            saveKey(marketplace, "sales_max", String.valueOf(cfg.salesMax), "精筛销量上限");
        }
        if (updates.containsKey("weightMax")) {
            cfg.weightMax = ((Number) updates.get("weightMax")).intValue();
            saveKey(marketplace, "weight_max", String.valueOf(cfg.weightMax), "精筛最大重量(g)");
        }
        if (updates.containsKey("deadDays")) {
            cfg.deadDays = ((Number) updates.get("deadDays")).intValue();
            saveKey(marketplace, "dead_days", String.valueOf(cfg.deadDays), "精筛无销量排名判定天数");
        }
        if (updates.containsKey("mode2SalesMin")) {
            cfg.mode2SalesMin = ((Number) updates.get("mode2SalesMin")).intValue();
            saveKey(marketplace, "mode2_sales_min", String.valueOf(cfg.mode2SalesMin), "模式二销量下限");
        }
        if (updates.containsKey("mode2BsrMax")) {
            cfg.mode2BsrMax = ((Number) updates.get("mode2BsrMax")).intValue();
            saveKey(marketplace, "mode2_bsr_max", String.valueOf(cfg.mode2BsrMax), "模式二BSR上限");
        }
        log.info("精筛配置已更新 [{}]: {}", marketplace, getConfig(marketplace));
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
            log.warn("保存精筛配置 {} [{}] 失败: {}", field, marketplace, e.getMessage());
        }
    }

    // ---- getters with marketplace ----

    public BigDecimal getPriceMin(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).priceMin;
    }

    public BigDecimal getPriceMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).priceMax;
    }

    public int getListingDaysMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).listingDaysMax;
    }

    public int getBsrMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).bsrMax;
    }

    public int getSalesMin(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).salesMin;
    }

    public int getSalesMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).salesMax;
    }

    public int getWeightMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).weightMax;
    }

    public int getDeadDays(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).deadDays;
    }

    public int getMode2SalesMin(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).mode2SalesMin;
    }

    public int getMode2BsrMax(String marketplace) {
        return configMap.computeIfAbsent(marketplace, k -> new MarketplaceFilterConfig()).mode2BsrMax;
    }

    // ---- 向后兼容：无参版本返回默认市场 ----

    public BigDecimal getPriceMin() { return getPriceMin(DEFAULT_MARKETPLACE); }
    public BigDecimal getPriceMax() { return getPriceMax(DEFAULT_MARKETPLACE); }
    public int getListingDaysMax() { return getListingDaysMax(DEFAULT_MARKETPLACE); }
    public int getBsrMax() { return getBsrMax(DEFAULT_MARKETPLACE); }
    public int getSalesMin() { return getSalesMin(DEFAULT_MARKETPLACE); }
    public int getSalesMax() { return getSalesMax(DEFAULT_MARKETPLACE); }
    public int getWeightMax() { return getWeightMax(DEFAULT_MARKETPLACE); }
    public int getDeadDays() { return getDeadDays(DEFAULT_MARKETPLACE); }
    public int getMode2SalesMin() { return getMode2SalesMin(DEFAULT_MARKETPLACE); }
    public int getMode2BsrMax() { return getMode2BsrMax(DEFAULT_MARKETPLACE); }

    /** 单个市场的精筛配置 */
    private static class MarketplaceFilterConfig {
        volatile BigDecimal priceMin = DEFAULT_PRICE_MIN;
        volatile BigDecimal priceMax = DEFAULT_PRICE_MAX;
        volatile int listingDaysMax = DEFAULT_LISTING_DAYS_MAX;
        volatile int bsrMax = DEFAULT_BSR_MAX;
        volatile int salesMin = DEFAULT_SALES_MIN;
        volatile int salesMax = DEFAULT_SALES_MAX;
        volatile int weightMax = DEFAULT_WEIGHT_MAX;
        volatile int deadDays = DEFAULT_DEAD_DAYS;
        volatile int mode2SalesMin = DEFAULT_MODE2_SALES_MIN;
        volatile int mode2BsrMax = DEFAULT_MODE2_BSR_MAX;
    }
}
