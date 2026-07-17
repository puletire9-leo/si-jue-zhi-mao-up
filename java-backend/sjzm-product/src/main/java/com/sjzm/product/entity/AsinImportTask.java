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
    private String importType;
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

    /** 八爪鱼命名任务来源，用于任务列表展示及卖家精灵结果分流。 */
    private Long bazhuayuMappingId;
    private String bazhuayuTaskId;
    private String taskName;
    private String taskCategory;
    private Boolean initialFilter;
    private String targetTable;

    private String errorMessage;
    private String progressLog;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
