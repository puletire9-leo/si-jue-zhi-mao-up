package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("asin_import_tasks")
public class AsinImportTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String taskStatus;
    private Integer totalCount;
    private Integer passCount;
    private Integer priceFailCount;
    private Integer reviewFailCount;
    private Integer duplicateCount;
    private Integer skipCount;
    private Integer batchTotal;
    private Integer batchCurrent;
    private Integer apiSuccess;
    private Integer apiFail;
    private Integer apiRequestsUsed;
    private Integer parentAsinCount;
    private Integer variantAsinCount;
    private String dataMonth;

    private String errorMessage;
    private String progressLog;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
