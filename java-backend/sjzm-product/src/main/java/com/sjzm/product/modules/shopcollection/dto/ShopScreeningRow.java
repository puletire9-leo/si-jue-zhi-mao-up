package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

@Data
public class ShopScreeningRow {
    private String marketplace;
    private String sellerName;
    private String sellerId;
    private Long productCount;
    private Long passedProductCount;
    private Long m01HitCount;
    private Double m01HitRatio;
    private Double avgListingDays;
    private Double avgUnits;
    private Long new30Count;
    private Long new90Count;
    private Long aCount;
    private Long bCount;
    private Long cCount;
    private Long dCount;
    private Long abcCount;
    private Double abcRatio;
    private String topCategory;
    private String latestBatchCode;

    private Long watchlistId;
    private String watchlistStatus;
    private String sourceType;
    private String sourceCode;
    private String reason;
    private Integer sourceHitCount;

    private Long totalRows;
    private Long totalProductCount;
    private Long totalPassedProductCount;
    private Long totalM01HitCount;
}
