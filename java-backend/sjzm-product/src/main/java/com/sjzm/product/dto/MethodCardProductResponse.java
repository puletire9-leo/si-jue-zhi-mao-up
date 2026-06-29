package com.sjzm.product.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class MethodCardProductResponse {

    private String methodId;
    private String methodName;

    private Long id;
    private String marketplace;
    private String asin;
    private String parentAsin;
    private String dedupeKey;
    private String month;
    private String effectiveWeekTag;
    private String createdWeek;

    private String title;
    private String brand;
    private String imageUrl;
    private Long nodeId;
    private String nodeLabelPath;
    private String bsrId;

    private Integer units;
    private Integer bsr;
    private BigDecimal price;
    private Integer listingDays;
    private BigDecimal weightG;
    private BigDecimal rating;
    private Integer ratings;
    private String fulfillment;
    private String source;
    private String productUrl;
    private String similarUrl;
    private LocalDateTime createdAt;

    private List<String> hitReasons;
    private Map<String, Object> ruleSnapshot;
}
