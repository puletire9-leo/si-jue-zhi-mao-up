package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ShopCategoryRiskInsight {
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
    private Long productCount = 0L;
    private Long unitsSum = 0L;
    private Double unitsAvg = 0.0;
    private Double avgListingDays = 0.0;
    private Long m01HitCount = 0L;
    private Long categoryCount = 0L;
    private List<String> topCategories = new ArrayList<>();
}
