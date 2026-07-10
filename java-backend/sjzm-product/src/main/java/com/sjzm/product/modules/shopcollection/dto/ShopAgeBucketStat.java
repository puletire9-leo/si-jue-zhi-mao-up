package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

/**
 * 互斥时间桶统计（模型分层用，区别于 new30/new90/new180 累计窗口）。
 * ageBucket: NEW(<=90) / GROWING(91-180) / MATURE(181-365) / OLD(>365) / UNKNOWN。
 */
@Data
public class ShopAgeBucketStat {
    private String ageBucket;
    private Long productCount;
    private Long unitsSum;
    private Double avgUnits;
    private Long m01HitCount;
    private Long abcCount;
}
