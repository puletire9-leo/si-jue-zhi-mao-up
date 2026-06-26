package com.sjzm.product.dto;

public record ProductTitleParseResult(String carrier, String element, String matchedCarrierAnchor) {

    public ProductTitleParseResult(String carrier, String element) {
        this(carrier, element, null);
    }

    public static ProductTitleParseResult empty() {
        return new ProductTitleParseResult(null, null, null);
    }

    public boolean hasCarrier() {
        return carrier != null && !carrier.isBlank();
    }
}
