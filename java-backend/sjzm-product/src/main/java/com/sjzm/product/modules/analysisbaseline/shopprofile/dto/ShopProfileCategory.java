package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ShopProfileCategory {
    private String marketplace;
    private String sellerName;
    private String salesTier;
    private String categoryKey;
    private Long productCount;
    private Long unitsSum;
    private BigDecimal unitsAvg;
}
