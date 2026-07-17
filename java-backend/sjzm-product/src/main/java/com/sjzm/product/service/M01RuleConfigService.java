package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.ApiConfig;
import com.sjzm.product.mapper.ApiConfigMapper;
import com.sjzm.product.methodrule.M01Rule;
import com.sjzm.product.methodrule.M01RuleConfigHolder;
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
 * M01「新品榜加速法」阈值配置管理：读写 api_config 表，key 格式 {@code m01_rule_{marketplace}_{field}}。
 *
 * <p>阈值来源优先级：DB 配置 &gt; {@link M01Rule#forMarketplace} 的硬编码默认。
 * 未在 DB 配置过的字段回退到硬编码默认值，保证首次上线零数据也能正常工作。</p>
 *
 * <p>通过 {@link M01RuleConfigHolder} 把本 service 暴露给 {@link M01Rule#forMarketplace} 的静态调用，
 * 使 8 处 {@code M01Rule.forMarketplace} 调用点零改动即可读到最新配置。改配置只影响之后的查询/打标口径，
 * 已落库的 m01_active 标不重算（按需另行手动重打）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class M01RuleConfigService implements com.sjzm.product.methodrule.M01RuleConfigHolder.M01RuleConfigProvider {

    private final ApiConfigMapper apiConfigMapper;

    private static final String PREFIX = "m01_rule_";

    /** 支持的字段名（与 M01Rule record 分量对应）。 */
    private static final String F_PRICE_MIN = "price_min";
    private static final String F_PRICE_MAX = "price_max";
    private static final String F_WEIGHT_MAX = "weight_max";
    private static final String F_LISTING_DAYS_MAX = "listing_days_max";
    private static final String F_SALES30 = "sales30";
    private static final String F_SALES60 = "sales60";
    private static final String F_SALES90 = "sales90";
    private static final String F_SALES_MAX = "sales_max";
    private static final String F_BSR_MAX = "bsr_max";

    /** 按 marketplace 存储 DB 覆盖值；仅存被显式配置过的字段，其余取硬编码默认。 */
    private final ConcurrentHashMap<String, MarketplaceM01Override> overrideMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        loadFromDb();
        M01RuleConfigHolder.register(this);
    }

    private void loadFromDb() {
        try {
            List<ApiConfig> configs = apiConfigMapper.selectList(
                    new LambdaQueryWrapper<ApiConfig>().likeRight(ApiConfig::getConfigKey, PREFIX));
            for (ApiConfig c : configs) {
                String rawKey = c.getConfigKey().substring(PREFIX.length());
                // 格式：{MARKETPLACE}_{field}，marketplace 为 2 位大写国家码
                if (!rawKey.matches("^[A-Z]{2}_.+")) continue;
                int idx = rawKey.indexOf('_');
                String marketplace = rawKey.substring(0, idx);
                String field = rawKey.substring(idx + 1);
                MarketplaceM01Override ov = overrideMap.computeIfAbsent(marketplace, k -> new MarketplaceM01Override());
                applyField(ov, field, c.getConfigValue());
            }
            log.info("M01 阈值配置加载完成: {} 个市场有覆盖", overrideMap.size());
        } catch (Exception e) {
            log.warn("加载 M01 阈值配置失败，全部使用硬编码默认: {}", e.getMessage());
        }
    }

    private void applyField(MarketplaceM01Override ov, String field, String val) {
        if (val == null || val.isBlank()) return;
        try {
            switch (field) {
                case F_PRICE_MIN -> ov.priceMin = new BigDecimal(val.trim());
                case F_PRICE_MAX -> ov.priceMax = new BigDecimal(val.trim());
                case F_WEIGHT_MAX -> ov.weightMax = new BigDecimal(val.trim());
                case F_LISTING_DAYS_MAX -> ov.listingDaysMax = Integer.parseInt(val.trim());
                case F_SALES30 -> ov.sales30 = Integer.parseInt(val.trim());
                case F_SALES60 -> ov.sales60 = Integer.parseInt(val.trim());
                case F_SALES90 -> ov.sales90 = Integer.parseInt(val.trim());
                case F_SALES_MAX -> ov.salesMax = Integer.parseInt(val.trim());
                // bsrMax 允许空字符串表示"不使用 BSR 判定"（如 US 站），故用 NONE 标记
                case F_BSR_MAX -> {
                    ov.bsrMax = "NONE".equalsIgnoreCase(val.trim()) ? null : Integer.parseInt(val.trim());
                    ov.bsrMaxSet = true;
                }
                default -> { }
            }
        } catch (Exception e) {
            log.warn("M01 阈值字段解析失败(忽略): field={}, val={}, err={}", field, val, e.getMessage());
        }
    }

    /**
     * 返回指定市场的有效 M01Rule：DB 覆盖值优先，缺省字段回退硬编码默认。
     * 该方法不递归调用 M01Rule.forMarketplace（避免与 holder 形成环），而是直接取硬编码 baseline。
     */
    public M01Rule effectiveRule(String marketplace) {
        String mp = M01Rule.normalizeMarketplace(marketplace);
        M01Rule base = M01Rule.baseline(mp);
        MarketplaceM01Override ov = overrideMap.get(mp);
        if (ov == null) return base;
        return new M01Rule(
                mp,
                ov.priceMin != null ? ov.priceMin : base.priceMin(),
                ov.priceMax != null ? ov.priceMax : base.priceMax(),
                ov.weightMax != null ? ov.weightMax : base.weightMax(),
                ov.listingDaysMax != null ? ov.listingDaysMax : base.listingDaysMax(),
                ov.sales30 != null ? ov.sales30 : base.sales30(),
                ov.sales60 != null ? ov.sales60 : base.sales60(),
                ov.sales90 != null ? ov.sales90 : base.sales90(),
                ov.salesMax != null ? ov.salesMax : base.salesMax(),
                ov.bsrMaxSet ? ov.bsrMax : base.bsrMax()
        );
    }

    /** 返回配置视图（含当前生效值 + 是否为默认），供前端展示与编辑。 */
    public Map<String, Object> getConfig(String marketplace) {
        M01Rule rule = effectiveRule(marketplace);
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("marketplace", rule.marketplace());
        config.put("priceMin", rule.priceMin());
        config.put("priceMax", rule.priceMax());
        config.put("weightMax", rule.weightMax());
        config.put("listingDaysMax", rule.listingDaysMax());
        config.put("sales30", rule.sales30());
        config.put("sales60", rule.sales60());
        config.put("sales90", rule.sales90());
        config.put("salesMax", rule.salesMax());
        config.put("bsrMax", rule.bsrMax());
        return config;
    }

    /**
     * 更新指定市场的 M01 阈值并持久化。只更新传入的字段，其余保持不变。
     * bsrMax 传 null 或 "NONE" 表示不使用 BSR 判定。
     */
    public void updateConfig(Map<String, Object> updates, String marketplace) {
        String mp = M01Rule.normalizeMarketplace(marketplace);
        MarketplaceM01Override ov = overrideMap.computeIfAbsent(mp, k -> new MarketplaceM01Override());

        if (updates.containsKey("priceMin")) {
            ov.priceMin = new BigDecimal(updates.get("priceMin").toString());
            saveKey(mp, F_PRICE_MIN, ov.priceMin.toString(), "M01价格下限");
        }
        if (updates.containsKey("priceMax")) {
            ov.priceMax = new BigDecimal(updates.get("priceMax").toString());
            saveKey(mp, F_PRICE_MAX, ov.priceMax.toString(), "M01价格上限");
        }
        if (updates.containsKey("weightMax")) {
            ov.weightMax = new BigDecimal(updates.get("weightMax").toString());
            saveKey(mp, F_WEIGHT_MAX, ov.weightMax.toString(), "M01重量上限(克)");
        }
        if (updates.containsKey("listingDaysMax")) {
            ov.listingDaysMax = ((Number) updates.get("listingDaysMax")).intValue();
            saveKey(mp, F_LISTING_DAYS_MAX, String.valueOf(ov.listingDaysMax), "M01上架天数上限");
        }
        if (updates.containsKey("sales30")) {
            ov.sales30 = ((Number) updates.get("sales30")).intValue();
            saveKey(mp, F_SALES30, String.valueOf(ov.sales30), "M01 30天销量门槛");
        }
        if (updates.containsKey("sales60")) {
            ov.sales60 = ((Number) updates.get("sales60")).intValue();
            saveKey(mp, F_SALES60, String.valueOf(ov.sales60), "M01 60天销量门槛");
        }
        if (updates.containsKey("sales90")) {
            ov.sales90 = ((Number) updates.get("sales90")).intValue();
            saveKey(mp, F_SALES90, String.valueOf(ov.sales90), "M01 90天销量门槛");
        }
        if (updates.containsKey("salesMax")) {
            ov.salesMax = ((Number) updates.get("salesMax")).intValue();
            saveKey(mp, F_SALES_MAX, String.valueOf(ov.salesMax), "M01 销量上限");
        }
        if (updates.containsKey("bsrMax")) {
            Object raw = updates.get("bsrMax");
            if (raw == null || "NONE".equalsIgnoreCase(raw.toString()) || raw.toString().isBlank()) {
                ov.bsrMax = null;
                ov.bsrMaxSet = true;
                saveKey(mp, F_BSR_MAX, "NONE", "M01 BSR上限(NONE=不判定)");
            } else {
                ov.bsrMax = ((Number) raw).intValue();
                ov.bsrMaxSet = true;
                saveKey(mp, F_BSR_MAX, String.valueOf(ov.bsrMax), "M01 BSR上限");
            }
        }
        log.info("M01 阈值配置已更新 [{}]: {}", mp, getConfig(mp));
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
            log.warn("保存 M01 阈值 {} [{}] 失败: {}", field, marketplace, e.getMessage());
        }
    }

    /** 单市场 M01 阈值覆盖值；null 表示该字段未配置、走硬编码默认。 */
    private static class MarketplaceM01Override {
        volatile BigDecimal priceMin;
        volatile BigDecimal priceMax;
        volatile BigDecimal weightMax;
        volatile Integer listingDaysMax;
        volatile Integer sales30;
        volatile Integer sales60;
        volatile Integer sales90;
        volatile Integer salesMax;
        volatile Integer bsrMax;
        /** bsrMax 允许显式设为 null（不判定），故需单独标记是否配置过。 */
        volatile boolean bsrMaxSet;
    }
}
