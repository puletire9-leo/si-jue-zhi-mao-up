package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ShopCategoryInsight {
    private String salesTier;
    private String categoryKey;
    private String nodeLabelPath;
    private Long productCount;
    private Long unitsSum;
    private Double unitsAvg;
    private Double avgListingDays;
    private Long m01HitCount;
    private Double m01HitRatio;

    /**
     * Compatibility aliases for the first frontend draft. New code should read attentionLevel/attentionReason.
     */
    private String riskLevel;
    private String riskReason;

    private String attentionLevel;
    private String attentionReason;
    private String labelMeaning;
    private List<String> attentionTags = new ArrayList<>();
    private List<String> tendencyTags = new ArrayList<>();
}
