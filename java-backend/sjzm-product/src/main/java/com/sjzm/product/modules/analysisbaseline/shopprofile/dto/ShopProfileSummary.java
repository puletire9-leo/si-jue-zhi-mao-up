package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

@Data
public class ShopProfileSummary {
    private String marketplace;
    private String sellerName;
    private String sellerId;
    private Long productCount;
    private Long aCount;
    private Long bCount;
    private Long cCount;
    private Long dCount;
    private Long unknownCount;
    private Long abCount;
    private Long abcCount;
    private Double aRatio;
    private Double abRatio;
    private Double abcRatio;
    private Double dRatio;
    private String topACategory;
    private String topABCCategory;
    private String topDCategory;
    private String profileType;
    private String latestBatchDate;
    private String variationMode;
}
