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
    private String batchDate;
    private LocalDateTime createdAt;
}
