package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

@Data
public class ShopProfilePositioningComputeResult {
    private String baselineCode;
    private String marketplace;
    private String batchDate;
    private String variationMode;
    private Integer deletedResults;
    private Integer insertedResults;
    private Boolean requiresSqlMigration;
    private String resultTable;
}
