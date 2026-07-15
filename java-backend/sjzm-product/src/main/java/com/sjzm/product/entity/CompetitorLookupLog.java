package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("competitor_lookup_log")
public class CompetitorLookupLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String month;
    private Integer asinsCount;
    private Integer tookMs;
    private Integer pages;
    private Integer total;
    private String apiStatus;
    private String errorMessage;

    /** 请求中心关联；兼容旧直连日志时允许为空。 */
    private String runId;
    private Long itemId;
    private String requestType;
    /** 脱敏后的请求范围摘要，不保存完整密钥或整页请求参数。 */
    private String requestScope;
    private Integer attemptNo;
    private Boolean requestDispatched;
    private Boolean usageConfirmed;
    private String errorCode;
    private String errorSummary;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
