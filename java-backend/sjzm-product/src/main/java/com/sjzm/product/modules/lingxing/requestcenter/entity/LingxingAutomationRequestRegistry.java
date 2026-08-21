package com.sjzm.product.modules.lingxing.requestcenter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 领星自动化请求注册项。
 *
 * <p>本表只决定何时向 {@code lingxing_request_task} 生成一次请求，不直接调用领星。</p>
 */
@Data
@TableName("lingxing_automation_request_registry")
public class LingxingAutomationRequestRegistry {

    @TableId(type = IdType.ASSIGN_ID)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    private String registrationCode;
    private String automationJobCode;
    private String taskType;
    private String taskName;
    private Integer enabled;
    /** MANUAL / DAILY / WEEKLY / FIXED_DELAY */
    private String scheduleType;
    private LocalTime runTime;
    /** ISO 星期：1=周一，7=周日；仅 WEEKLY 使用。 */
    private Integer dayOfWeek;
    private Integer fixedDelaySeconds;
    private String timezone;
    private Integer priority;
    private String slotGroup;
    private Integer slotOrder;
    private Integer minimumGapSeconds;
    private String payloadTemplateJson;
    private LocalDateTime nextRunAt;
    private LocalDateTime lastEnqueuedAt;
    private String lastTaskId;
    private String lastStatus;
    private String lastError;
    private Integer retryLimit;
    private String remark;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
