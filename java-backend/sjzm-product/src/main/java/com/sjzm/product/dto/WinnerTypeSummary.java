package com.sjzm.product.dto;

import lombok.Data;

@Data
public class WinnerTypeSummary {

    private String canonicalKey;
    private String canonicalName;
    private Long winnerCount;
    private Long greenCount;
    private Long eliminatedCount;
    private String winnerMarketplaces;
    private String topArchetypes;
    private String topCarriers;
    private String topElements;
}
