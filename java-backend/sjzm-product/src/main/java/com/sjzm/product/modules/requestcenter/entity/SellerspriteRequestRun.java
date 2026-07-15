package com.sjzm.product.modules.requestcenter.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 卖家精灵请求中心任务：一次批量请求（精品池复抓/候选池大批量/ASIN 补数等）。
 *
 * <p>统一承接 ASIN、店铺全集、候选池批量、精品复抓的实况、暂停、停止、失败重试和使用次数统计。
 * 子项 {@link SellerspriteRequestItem} 逐条消费，记录每条的使用次数和成功失败。</p>
 */
@Data
@TableName("sellersprite_request_run")
public class SellerspriteRequestRun {

    @TableId
    private String runId;

    /** SHOP_FULL_LOOKUP / ASIN_LOOKUP / ASIN_BATCH_LOOKUP / CANDIDATE_BATCH / PREMIUM_REFRESH */
    private String requestType;

    /** 站点（任务级，item 可覆盖） */
    private String marketplace;

    /** CANDIDATE_CONFIRM / WATCHLIST / PREMIUM_REFRESH / MANUAL */
    private String triggerType;

    /** 来源引用（如 premium 池 id 列表 JSON） */
    private String triggerRef;

    /** 来源初筛任务 ID（仅 ASIN_BATCH_LOOKUP 使用，用于防止重复创建活跃任务） */
    private Long sourceTaskId;

    /** 业务来源的活跃任务幂等键，避免迁移期重复发起并重复扣费。 */
    private String idempotencyKey;

    private String fetchReason;

    private String batchCode;
    private String batchDate;

    private Integer totalCount;
    private Integer pendingCount;
    private Integer runningCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer skippedCount;
    private Integer apiCalls;

    /** PENDING / RUNNING / PAUSED / PAUSED_SYSTEM / STOPPED / SUCCESS / FAILED / PARTIAL_SUCCESS */
    private String status;

    private String lastErrorMessage;
    /** 系统门禁、熔断或结果未知导致的自动暂停原因。 */
    private String systemPauseReason;
    /** 系统预计允许恢复执行的时间；为空时需要人工确认。 */
    private LocalDateTime systemResumeAt;
    private String operator;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
