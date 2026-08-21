package com.sjzm.product.modules.automation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("automation_run")
public class AutomationRun {
    @TableId(type = IdType.ASSIGN_ID)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    private String runNo;
    private String jobCode;
    private String triggerType;
    private String requestedBy;
    private String correlationId;
    private String status;
    private String requestJson;
    private String resultJson;
    private Long totalCount;
    private Long successCount;
    private Long failedCount;
    private Long skippedCount;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
