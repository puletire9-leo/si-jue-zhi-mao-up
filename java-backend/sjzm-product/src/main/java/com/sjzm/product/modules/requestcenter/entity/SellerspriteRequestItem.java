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

    /** PENDING / RUNNING / SUCCESS / PARTIAL_SUCCESS / FAILED / SKIPPED */
    private String status;

    private String shopFetchRunId;
    private Integer total;
    private Integer fetchedCount;
    private Integer writtenCount;
    private Integer failedCount;
    private Integer apiCalls;
    private String errorMessage;

    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
}
