package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ShopProfileProduct {
    private Long id;
    private String marketplace;
    private String sellerName;
    private String sellerId;
    private String asin;
    private String parentAsin;
    private String salesTier;
    private String title;
    private String brand;
    private String imageUrl;
    private String productUrl;
    private String similarUrl;
    private Long nodeId;
    private String nodeLabelPath;
    private String categoryLeaf;
    private String bsrId;
    private Integer units;
    private Integer bsr;
    private BigDecimal price;
    private BigDecimal rating;
    private Integer ratings;
    private String fulfillment;
    private Long availableDate;
    private Integer listingDays;
    private String batchDate;
    private LocalDateTime createdAt;

    /** 店铺三维画像时间层：NEW/GROWING/MATURE/OLD/UNKNOWN，仅 shop_products 三维明细返回。 */
    private String ageBucket;

    /** 是否命中 M01 方法卡商品规则，1=命中，0=未命中，仅 shop_products 三维明细返回。 */
    private Integer m01Hit;

    /** 注意/倾向层：ATTENTION_STRONG/ATTENTION_REVIEW/GOOD_TENDENCY/NEUTRAL/UNKNOWN。 */
    private String attentionLevel;
    private String attentionReason;
    private String labelMeaning;
}
