package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("deng_zong_shop")
public class DengZongShop {

    @TableId(type = IdType.AUTO)
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

    private String productUrl;
    private String similarUrl;
    private String source;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
