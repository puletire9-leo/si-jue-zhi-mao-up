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
    /** 通过来源拆分：新品重取放行(已采过<30天,重新取)。 */
    private Integer passRefetchCount;
    /** 通过来源拆分：全新通过(从没见过的 ASIN)。 */
    private Integer passNewCount;
    private Integer priceFailCount;
    private Integer reviewFailCount;
    private Integer duplicateCount;
    /** 跳过总数 = skipMainCount + skipBlacklistCount（保留合并列，兼容旧数据/汇总）。 */
    private Integer skipCount;
    /** 主表已有（competitor_products 已入库，去重跳过）。 */
    private Integer skipMainCount;
    /** 已采过淘汰（skip_asins 命中且非新品重取候选，如上架≥30天）。 */
    private Integer skipBlacklistCount;
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
    /** 八爪鱼云端批次身份；与 mappingId 组合后构成一次导入的幂等键。 */
    private String bazhuayuBatchNo;
    private LocalDateTime bazhuayuBatchStartTime;
    private LocalDateTime bazhuayuBatchEndTime;
    private Integer bazhuayuBatchCount;
    private String bazhuayuLotNo;
    private String taskName;
    private String taskCategory;
    private Boolean initialFilter;
    private String targetTable;

    private String errorMessage;
    private String progressLog;

    /**
     * 八爪鱼导入断点检查点：已处理的云端原始行 offset。
     * 暂停时落盘，resume 时从此 offset 续拉，避免重拉已导行 / 重复写 asin_import_results。
     * null / 0 = 从头开始。
     */
    private Integer resumeOffset;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    /** 任务终态完成时间。仅在 READY/DONE/ERROR/REJECTED/CANCELLED 等终态写入，与 updatedAt 区分。 */
    private LocalDateTime completedAt;
}
