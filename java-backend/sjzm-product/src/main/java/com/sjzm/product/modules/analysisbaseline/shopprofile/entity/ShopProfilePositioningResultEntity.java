package com.sjzm.product.modules.analysisbaseline.shopprofile.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
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
    @TableField("abc_count")
    private Integer abcCount;
    private BigDecimal aRatio;
    private BigDecimal abRatio;
    @TableField("abc_ratio")
    private BigDecimal abcRatio;
    private BigDecimal dRatio;
    private String topACategory;
    @TableField("top_abc_category")
    private String topABCCategory;
    private String topDCategory;
    private String profileType;
    private Integer baselineShopCount;
    private BigDecimal baselineAvgProductCount;
    private BigDecimal baselineAvgARatio;
    private BigDecimal baselineAvgAbRatio;
    @TableField("baseline_avg_abc_ratio")
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
