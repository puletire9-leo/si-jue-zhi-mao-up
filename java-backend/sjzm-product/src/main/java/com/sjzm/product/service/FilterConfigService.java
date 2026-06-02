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
 * 精筛配置管理：读写 api_config 表，key 前缀 filter_
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FilterConfigService {

    private final ApiConfigMapper apiConfigMapper;

    private static final String PREFIX = "filter_";

    // 默认值
    private volatile BigDecimal priceMin = new BigDecimal("4.99");
    private volatile BigDecimal priceMax = new BigDecimal("30.00");
    private volatile int listingDaysMax = 90;
    private volatile int bsrMax = 50000;
    private volatile int salesMin = 5;
    private volatile int salesMax = 200;
    private volatile int weightMax = 300;
    private volatile int deadDays = 30;
    // 模式二
    private volatile int mode2SalesMin = 50;
    private volatile int mode2BsrMax = 20000;

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
                        case "listing_days_max" -> listingDaysMax = Integer.parseInt(val);
                        case "bsr_max" -> bsrMax = Integer.parseInt(val);
                        case "sales_min" -> salesMin = Integer.parseInt(val);
                        case "sales_max" -> salesMax = Integer.parseInt(val);
                        case "weight_max" -> weightMax = Integer.parseInt(val);
                        case "dead_days" -> deadDays = Integer.parseInt(val);
                        case "mode2_sales_min" -> mode2SalesMin = Integer.parseInt(val);
                        case "mode2_bsr_max" -> mode2BsrMax = Integer.parseInt(val);
                    }
                } catch (Exception ignored) {}
            }
            log.info("精筛配置加载完成: {}", getConfig());
        } catch (Exception e) {
            log.warn("加载精筛配置失败，使用默认值: {}", e.getMessage());
        }
    }

    public Map<String, Object> getConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("priceMin", priceMin);
        config.put("priceMax", priceMax);
        config.put("listingDaysMax", listingDaysMax);
        config.put("bsrMax", bsrMax);
        config.put("salesMin", salesMin);
        config.put("salesMax", salesMax);
        config.put("weightMax", weightMax);
        config.put("deadDays", deadDays);
        config.put("mode2SalesMin", mode2SalesMin);
        config.put("mode2BsrMax", mode2BsrMax);
        return config;
    }

    public void updateConfig(Map<String, Object> updates) {
        if (updates.containsKey("priceMin")) {
            priceMin = new BigDecimal(updates.get("priceMin").toString());
            saveKey("price_min", priceMin.toString(), "精筛价格下限(£)");
        }
        if (updates.containsKey("priceMax")) {
            priceMax = new BigDecimal(updates.get("priceMax").toString());
            saveKey("price_max", priceMax.toString(), "精筛价格上限(£)");
        }
        if (updates.containsKey("listingDaysMax")) {
            listingDaysMax = ((Number) updates.get("listingDaysMax")).intValue();
            saveKey("listing_days_max", String.valueOf(listingDaysMax), "精筛最大上架天数");
        }
        if (updates.containsKey("bsrMax")) {
            bsrMax = ((Number) updates.get("bsrMax")).intValue();
            saveKey("bsr_max", String.valueOf(bsrMax), "精筛最大BSR");
        }
        if (updates.containsKey("salesMin")) {
            salesMin = ((Number) updates.get("salesMin")).intValue();
            saveKey("sales_min", String.valueOf(salesMin), "精筛销量下限");
        }
        if (updates.containsKey("salesMax")) {
            salesMax = ((Number) updates.get("salesMax")).intValue();
            saveKey("sales_max", String.valueOf(salesMax), "精筛销量上限");
        }
        if (updates.containsKey("weightMax")) {
            weightMax = ((Number) updates.get("weightMax")).intValue();
            saveKey("weight_max", String.valueOf(weightMax), "精筛最大重量(g)");
        }
        if (updates.containsKey("deadDays")) {
            deadDays = ((Number) updates.get("deadDays")).intValue();
            saveKey("dead_days", String.valueOf(deadDays), "精筛无销量排名判定天数");
        }
        if (updates.containsKey("mode2SalesMin")) {
            mode2SalesMin = ((Number) updates.get("mode2SalesMin")).intValue();
            saveKey("mode2_sales_min", String.valueOf(mode2SalesMin), "模式二销量下限");
        }
        if (updates.containsKey("mode2BsrMax")) {
            mode2BsrMax = ((Number) updates.get("mode2BsrMax")).intValue();
            saveKey("mode2_bsr_max", String.valueOf(mode2BsrMax), "模式二BSR上限");
        }
        log.info("精筛配置已更新: {}", getConfig());
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
            log.warn("保存精筛配置 {} 失败: {}", key, e.getMessage());
        }
    }

    // ---- getters for CompetitorFilterService ----

    public BigDecimal getPriceMin() { return priceMin; }
    public BigDecimal getPriceMax() { return priceMax; }
    public int getListingDaysMax() { return listingDaysMax; }
    public int getBsrMax() { return bsrMax; }
    public int getSalesMin() { return salesMin; }
    public int getSalesMax() { return salesMax; }
    public int getWeightMax() { return weightMax; }
    public int getDeadDays() { return deadDays; }
    public int getMode2SalesMin() { return mode2SalesMin; }
    public int getMode2BsrMax() { return mode2BsrMax; }
}
