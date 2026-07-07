package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

@Data
public class ShopProfilePositioningResult {
    private String baselineCode;
    private String baselineName;
    private String marketplace;
    private String sellerName;
    private String sellerId;
    private String batchDate;
    private String variationMode;

    private Integer productCount;
    private Integer aCount;
    private Integer bCount;
    private Integer cCount;
    private Integer dCount;
    private Integer unknownCount;
    private Integer abCount;
    private Integer abcCount;
    private Double aRatio;
    private Double abRatio;
    private Double abcRatio;
    private Double dRatio;
    private String topACategory;
    private String topABCCategory;
    private String topDCategory;
    private String profileType;

    private Integer baselineShopCount;
    private Double baselineAvgProductCount;
    private Double baselineAvgARatio;
    private Double baselineAvgAbRatio;
    private Double baselineAvgAbcRatio;
    private Double baselineAvgDRatio;
    private Double categoryMatchScore;
    private Double similarityScore;
    private String positioningLabel;
    private String profileAdvice;
}
