package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("shop_profile_positioning_result")
public class ShopProfilePositioningResultEntity {
    @TableId(type = IdType.AUTO)
    private Long id;

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
    private BigDecimal aRatio;
    private BigDecimal abRatio;
    private BigDecimal abcRatio;
    private BigDecimal dRatio;
    private String topACategory;
    private String topABCCategory;
    private String topDCategory;
    private String profileType;
    private Integer baselineShopCount;
    private BigDecimal baselineAvgProductCount;
    private BigDecimal baselineAvgARatio;
    private BigDecimal baselineAvgAbRatio;
    private BigDecimal baselineAvgAbcRatio;
    private BigDecimal baselineAvgDRatio;
    private BigDecimal categoryMatchScore;
    private BigDecimal similarityScore;
    private String positioningLabel;
    private String profileAdvice;
    private LocalDateTime computedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
