package com.sjzm.product.modules.shopcollection.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 店铺商品全集：卖家精灵"店铺名查询"返回的店铺商品，固定 variation=Y（不含变体父体口径）。
 * 字段能力完整复制 competitor_products（表由 CREATE TABLE LIKE 建），再补店铺抓取专用元信息。
 * 与新品榜 competitor_products、郑总盘子 deng_zong_shop 三条数据源分开，分析证据统一。
 */
@Data
@TableName("shop_products")
public class ShopProduct {

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

    // 筛选衍生字段（复制自 competitor_products 结构，店铺全集也做基础标准化）
    private String filterMode;
    private String filterReasons;
    private Integer listingDays;
    private BigDecimal weightG;
    private String productUrl;
    private String similarUrl;
    private String source;

    // 评分字段（继承自 competitor_products 结构，店铺全集不评分，保留列避免映射缺失）
    private Integer score;
    private String grade;
    private String weekTag;
    private Integer isCurrent;
    private Integer m01Active;

    // 店铺抓取专用元信息
    private String batchDate;
    private String batchCode;
    private String sourceRunId;
    private String fetchSource;
    private String fetchReason;
    private Long watchlistId;
    private String variationMode;
    private String rawJson;
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastSeenAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private Integer variantCount;
}
