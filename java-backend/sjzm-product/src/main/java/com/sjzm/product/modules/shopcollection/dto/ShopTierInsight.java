package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

@Data
public class ShopTierInsight {
    private String salesTier;
    private Long productCount;
    private Long m01HitCount;
    private Double m01HitRatio;
    private Double avgListingDays;
    private Double avgUnits;
    private Long earliestAvailableDate;
    private String earliestAvailableDateText;
    private Integer maxListingDays;
    private Long new30Count;
    private Long new90Count;
    private Long new180Count;
    private Long old180Count;
    private Long unknownListingDaysCount;
}
