package com.sjzm.product.modules.developerselection.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class DeveloperSelectionLibraryQuery {

    private String bucket;
    private String marketplace;
    private String keyword;
    private Long developerId;
    private Long batchId;
    private Boolean unassigned;
    private Integer page = 1;
    private Integer size = 60;
    private List<String> createdWeeks;
    private BigDecimal priceMin;
    private BigDecimal priceMax;
    private Integer unitsMin;
    private Integer unitsMax;
    private Integer listingDaysMin;
    private Integer listingDaysMax;
    private Integer bsrMax;
    private BigDecimal weightMax;
    private Integer variantCountMax;
    private List<String> fulfillment;
}
