package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("competitor_products")
public class CompetitorProduct {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String marketplace;
    private String asin;
    private String month;

    private String title;
    private String brand;
    private String brandUrl;
    private String imageUrl;
    private String parentAsin;
    private String sku;
    private Long nodeId;
    private String nodeIdPath;
    private String nodeLabelPath;
    private String symbol;

    private Integer units;
    private String salesTier;
    private BigDecimal unitsGr;
    private Integer amzUnit;
    private BigDecimal amzSales;
    private Long amzUnitDate;
    private BigDecimal revenue;

    private String bsrId;
    private Integer bsr;
    private BigDecimal bsrCr;
    private Integer bsrCv;

    private Integer ratings;
    private BigDecimal rating;
    private BigDecimal ratingsRate;
    private Integer ratingsCv;
    private Integer ratingDelta;

    private BigDecimal price;
    private BigDecimal primePrice;
    private BigDecimal profit;
    private BigDecimal fba;
    private BigDecimal deliveryPrice;

    private String sellerName;
    private String sellerId;
    private String sellerNation;
    private Integer sellers;

    private String fulfillment;
    private Integer variations;
    private String weight;
    private String dimension;
    private String dimensionsType;
    private String pkgDimensions;
    private String pkgDimensionType;
    private String pkgWeight;

    private BigDecimal lqs;
    private Long availableDate;

    private String bestSeller;
    private String amazonChoice;
    private String newRelease;
    private String ebc;
    private String video;

    // 筛选衍生字段
    private String filterMode;
    private String filterReasons;
    private Integer listingDays;
    private BigDecimal weightG;
    private String productUrl;
    private String similarUrl;
    private String source;

    // 评分字段
    private Integer score;
    private String grade;
    private String weekTag;
    private Integer isCurrent;

    /**
     * M01 合格标记：1=当前命中 M01 合格标准（够新且达标），0=否。
     * 导入时按 M01Rule 补标；每日 0 点摘标上架超 90 天的过期品。
     * 供竞品店铺品级（方法卡命中数）复用，避免每次全表实时算。
     */
    private Integer m01Active;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private Integer variantCount;
}
