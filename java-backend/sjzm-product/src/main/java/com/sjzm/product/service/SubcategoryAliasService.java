package com.sjzm.product.service;

import com.sjzm.product.dto.SubcategoryAliasBatchReviewRequest;
import com.sjzm.product.dto.SubcategoryAliasResolution;

import java.util.List;
import java.util.Map;

public interface SubcategoryAliasService {

    Map<String, Object> bootstrap(String month, String marketplace);

    SubcategoryAliasResolution resolve(String marketplace, String rawOrCanonical);

    List<Map<String, Object>> listPending(String sourceType, String marketplace, int limit);

    Map<String, Object> approve(String sourceType,
                                String marketplace,
                                String rawSubcategory,
                                String canonicalKey,
                                String canonicalName,
                                String carrierHint,
                                String notes);

    Map<String, Object> batchReview(SubcategoryAliasBatchReviewRequest request);
}
