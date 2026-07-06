package com.sjzm.product.methodrule;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * M03「FBM 自发货简单道」合格标准 —— 数据基础筛选的共享定义。
 *
 * <p>与 M01（新品榜加速法）严格独立、平行存在：不共用 Rule、不共用 Mapper 参数、不共用 UI 触发。
 * 上一版曾把 M03 判定塞进 M01 路径导致卡片切换污染，本次严格 sibling 复制。
 *
 * <p>阈值分站点（UK/DE/US），只看三条：
 * <ul>
 *   <li>fulfillment = 'FBM'（M03 身份定义）</li>
 *   <li>上架 &lt; 90 天</li>
 *   <li>90 天销量单一门槛（UK=5 / DE=10 / US=20）</li>
 * </ul>
 * 不看 BSR，不看价格带，不看重量 —— 见 M03_FBM自发货简单道.md 的〔依据〕格。
 */
public record M03Rule(String marketplace,
                      Integer listingDaysMax,
                      Integer sales90) {

    public static String normalizeMarketplace(String marketplace) {
        return marketplace != null && !marketplace.isBlank()
                ? marketplace.trim().toUpperCase(Locale.ROOT)
                : "UK";
    }

    /**
     * 站点 M03 阈值定义（唯一权威）。UK/DE/US 与 M03 方法卡文档一致。
     * 90 天单段门槛：UK≥5、DE≥10、US≥20。
     */
    public static M03Rule forMarketplace(String marketplace) {
        return switch (normalizeMarketplace(marketplace)) {
            case "DE" -> new M03Rule("DE", 90, 10);
            case "UK" -> new M03Rule("UK", 90, 5);
            case "US" -> new M03Rule("US", 90, 20);
            default -> throw new IllegalArgumentException("M03 暂只支持 UK / DE / US");
        };
    }

    /**
     * 判定一个品是否命中 M03 合格标准。
     *
     * @param fulfillment 配送方式（必须是 FBM，大小写不敏感）
     * @param listingDays 上架天数
     * @param units       月销量（90 天累计）
     * @return true=命中合格
     */
    public boolean matches(String fulfillment, Integer listingDays, Integer units) {
        // 硬门槛 1: fulfillment = 'FBM'
        if (fulfillment == null || !"FBM".equalsIgnoreCase(fulfillment.trim())) return false;
        // 硬门槛 2: 上架 < 90 天
        if (listingDays == null || listingDays >= listingDaysMax) return false;
        // 达标: 90 天销量 ≥ 站点门槛
        return units != null && units >= sales90;
    }

    /**
     * 弱类型入口，方便 SQL 层直接传字段（避免上层强转）。
     */
    public boolean matches(String fulfillment, Integer listingDays, BigDecimal weightGnored, Integer units) {
        return matches(fulfillment, listingDays, units);
    }
}
