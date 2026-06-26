package com.sjzm.product.dto;

import lombok.Data;

import java.util.List;

@Data
public class SubcategoryAliasBatchReviewRequest {

    private String action;
    private String sourceType;
    private String marketplace;
    private String canonicalKey;
    private String canonicalName;
    private String carrierHint;
    private String notes;
    private List<String> rawSubcategories;
}
