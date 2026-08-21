package com.sjzm.product.rds.finance.model;

import lombok.Data;

import java.time.LocalDate;

/** 财务日报 ASIN 状态快照；用于继承上一周期断货状态并冻结标签/归属时点。 */
@Data
public class FinanceStatusSnapshotRow {

    private LocalDate snapshotDate;
    private String marketplace;
    private String asin;
    private Integer outOfStock;
    private String tagNames;
    private LocalDate productCreateDate;
    private String principalNames;
    private String developerNames;
    private String sourceType;
}
