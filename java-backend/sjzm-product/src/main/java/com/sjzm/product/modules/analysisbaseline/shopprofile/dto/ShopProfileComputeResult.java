package com.sjzm.product.modules.analysisbaseline.shopprofile.dto;

import lombok.Data;

@Data
public class ShopProfileComputeResult {
    private String marketplace;
    private String batchDate;
    private String variationMode;
    private Integer deletedSnapshots;
    private Integer insertedSnapshots;
    private Integer deletedCategories;
    private Integer insertedCategories;
    private Boolean requiresSqlMigration;
    private String sourceTable;
}
