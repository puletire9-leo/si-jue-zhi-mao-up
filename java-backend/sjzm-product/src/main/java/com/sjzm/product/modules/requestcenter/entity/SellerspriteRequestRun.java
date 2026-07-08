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

    /** SHOP_FULL_LOOKUP / ASIN_LOOKUP / CANDIDATE_BATCH / PREMIUM_REFRESH */
    private String requestType;

    /** 站点（任务级，item 可覆盖） */
    private String marketplace;

    /** CANDIDATE_CONFIRM / WATCHLIST / PREMIUM_REFRESH / MANUAL */
    private String triggerType;

    /** 来源引用（如 premium 池 id 列表 JSON） */
    private String triggerRef;

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

    /** PENDING / RUNNING / PAUSED / STOPPED / SUCCESS / FAILED / PARTIAL_SUCCESS */
    private String status;

    private String lastErrorMessage;
    private String operator;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
