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

    /** 互斥时间层列表摘要：NEW 商品数（listing_days <= 90）。 */
    private Long newProductCount;
    private Long newABCCount;
    private Double newABCRatio;
    private Long oldDCount;
    private Double oldDRatio;

    /** 注意/倾向层列表摘要，由 ShopProfileLabelRule 在 Java 侧基于类目补算。 */
    private Long goodTendencyCount;
    private Long attentionStrongCount;
    private Long attentionReviewCount;

    /** 三维店铺类型（解释标签，非最终评级）。 */
    private String shopProfile3dType;
    private String shopProfile3dExplanation;
}
