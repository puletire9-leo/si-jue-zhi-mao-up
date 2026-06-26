package com.sjzm.product.dto;

public record SubcategoryAliasResolution(
        String canonicalKey,
        String canonicalName,
        String sourceType,
        String matchedRawSubcategory,
        String matchMethod
) {
}
