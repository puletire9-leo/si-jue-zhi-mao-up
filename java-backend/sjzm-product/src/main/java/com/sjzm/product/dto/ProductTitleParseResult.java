package com.sjzm.product.dto;

public record ProductTitleParseResult(String carrier, String element) {

    public static ProductTitleParseResult empty() {
        return new ProductTitleParseResult(null, null);
    }

    public boolean hasCarrier() {
        return carrier != null && !carrier.isBlank();
    }
}
