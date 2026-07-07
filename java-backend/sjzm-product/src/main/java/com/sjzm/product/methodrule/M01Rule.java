package com.sjzm.product.methodrule;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * M01「新品榜加速法」合格标准 —— 数据基础筛选的共享定义。
 *
 * <p>阈值分站点（UK/DE/US），是"什么是合格 M01 新品"的唯一权威定义，供多处复用：
 * <ul>
 *   <li>MethodCardServiceImpl —— M01 选品列表查询 / 命中原因</li>
 *   <li>CompetitorFilterService —— 导入时给 competitor_products 打 m01_active 标记</li>
 *   <li>每日摘标任务 —— 上架超期后摘标</li>
 *   <li>未来 M02/M03 卡片或其他程序 —— 照此模式扩展</li>
 * </ul>
 *
 * <p>判定逻辑（{@link #matches}）与 MethodCardMapper.xml 的 M01Where 分档语义严格一致，
 * 保证"店铺命中数"与"方法卡选品数"同口径，避免逻辑漂移。
 */
public record M01Rule(String marketplace,
                      BigDecimal priceMin,
                      BigDecimal priceMax,
                      BigDecimal weightMax,
                      Integer listingDaysMax,
                      Integer sales30,
                      Integer sales60,
                      Integer sales90,
                      Integer bsrMax) {

    /**
     * 新品榜数据缺 available_date 时的上架天数兜底。
     *
     * <p>缺日期不等于老品；按 89 天处理可进入 M01 的 90 天窗口，仍需通过价格、重量、
     * 销量或 BSR 门槛。
     */
    public static final int UNKNOWN_LISTING_DAYS_DEFAULT = 89;

    public static String normalizeMarketplace(String marketplace) {
        return marketplace != null && !marketplace.isBlank()
                ? marketplace.trim().toUpperCase(Locale.ROOT)
                : "UK";
    }

    /**
     * 站点 M01 阈值定义（唯一权威）。UK/DE/US 与 M01 方法卡文档一致。
     * US 站 BSR 阈值文档标注为 —，故 bsrMax=null（判定时跳过 BSR 分支）。
     */
    public static M01Rule forMarketplace(String marketplace) {
        return switch (normalizeMarketplace(marketplace)) {
            case "DE" -> new M01Rule("DE", new BigDecimal("5.99"), new BigDecimal("18.99"),
                    new BigDecimal("300"), 90, 4, 20, 50, 25000);
            case "UK" -> new M01Rule("UK", new BigDecimal("4.99"), new BigDecimal("17.99"),
                    new BigDecimal("300"), 90, 2, 10, 30, 20000);
            case "US" -> new M01Rule("US", new BigDecimal("6.99"), new BigDecimal("25.99"),
                    new BigDecimal("300"), 90, 50, 120, 200, null);
            default -> throw new IllegalArgumentException("M01 暂只支持 UK / DE / US");
        };
    }

    /**
     * 判定一个品是否命中 M01 合格标准（与 M01Where 分档语义一致）。
     *
     * @param listingDays 上架天数（调用方传实时或存量值；打标时应传实时值）
     * @param price       售价
     * @param weightG     重量克数
     * @param units       月销量
     * @param bsr         BSR 排名
     * @return true=命中合格
     */
    public boolean matches(Integer listingDays, BigDecimal price, BigDecimal weightG, Integer units, Integer bsr) {
        // 价格区间
        if (price == null || price.compareTo(priceMin) < 0 || price.compareTo(priceMax) > 0) return false;
        // 重量
        if (weightG == null || weightG.compareTo(weightMax) >= 0) return false;
        // 上架天数上限
        if (listingDays == null || listingDays >= listingDaysMax) return false;
        // 分档销量：上架≤30/60/90 各对应门槛，满足任一即可；或 BSR 达标
        boolean pass = false;
        if (units != null) {
            if (listingDays <= 30 && units >= sales30) pass = true;
            else if (listingDays <= 60 && units >= sales60) pass = true;
            else if (listingDays <= 90 && units >= sales90) pass = true;
        }
        if (!pass && bsrMax != null && bsr != null && bsr > 0 && bsr < bsrMax) {
            pass = true;
        }
        return pass;
    }
}
