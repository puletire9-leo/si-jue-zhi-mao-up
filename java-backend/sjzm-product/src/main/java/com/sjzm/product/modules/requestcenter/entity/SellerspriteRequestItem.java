package com.sjzm.product.modules.requestcenter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 请求中心任务子项：每条店铺/ASIN 子项，逐条消费。
 */
@Data
@TableName("sellersprite_request_item")
public class SellerspriteRequestItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String runId;
    private Integer seq;

    private String marketplace;
    private String sellerName;
    private Long triggerId;

    /** 来源初筛任务 ID (asin_import_tasks.id)，仅 ASIN_BATCH_LOOKUP 类型使用 */
    private Long sourceTaskId;

    /** ASIN 批次载荷：JSON 数组文本，最多 40 个 ASIN（ASIN_BATCH_LOOKUP 类型使用） */
    private String asinList;

    /** 显式请求载荷 JSON，避免消费端根据任务类型隐式推断请求参数。 */
    private String payloadJson;

    /** PENDING / RUNNING / WAITING_RETRY / SUCCESS / PARTIAL_SUCCESS / FAILED / SKIPPED */
    private String status;

    private String shopFetchRunId;
    private Integer total;
    private Integer fetchedCount;
    private Integer writtenCount;
    private Integer failedCount;
    private Integer apiCalls;
    private String errorMessage;
    private Integer attemptCount;
    private LocalDateTime nextRetryAt;
    private LocalDateTime lastAttemptAt;
    private String errorCode;
    private String errorSummary;
    /** HTTP 请求是否已经真正离开本服务。 */
    private Boolean requestDispatched;
    /** 是否已收到足以确认卖家精灵使用次数的响应。 */
    private Boolean usageConfirmed;

    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
}
