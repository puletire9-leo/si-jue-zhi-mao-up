package com.sjzm.product.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class CompetitorProductResponse {

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
    private BigDecimal deliveryPrice;
    private BigDecimal profit;
    private BigDecimal fba;

    private String sellerName;
    private String sellerNation;
    private Integer sellers;

    private String fulfillment;
    private Integer variations;
    private String weight;
    private String dimension;
    private String availableDate;

    private String bestSeller;
    private String amazonChoice;
    private String newRelease;
    private String ebc;
    private String video;

    // 筛选衍生字段
    private String filterMode;
    private String filterReasons;
    private Integer listingDays;
    private java.math.BigDecimal weightG;
    private String productUrl;
    private String similarUrl;
    private String source;

    // 评分字段
    private Integer score;
    private String grade;
    private String weekTag;
    private Integer isCurrent;

    // 兼容旧前端
    private String sellerId;
    private String shopLink;

    private Integer variantCount;

    /** 入库时间（yyyy-MM-dd HH:mm:ss） */
    private String createdAt;

    private List<SubcategoryDto> subcategories;

    @Data
    @Builder
    public static class SubcategoryDto {
        private String code;
        @com.fasterxml.jackson.annotation.JsonProperty("rank")
        private Integer rankValue;
        private String label;
    }
}
