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
@TableName("automation_job")
public class AutomationJobConfig {
    @TableId(type = IdType.ASSIGN_ID)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    private String jobCode;
    private String jobName;
    private String description;
    private Integer enabled;
    private String scheduleType;
    private String cronExpression;
    private Integer fixedDelaySeconds;
    private String parametersJson;
    private LocalDateTime nextRunAt;
    private LocalDateTime lastRunAt;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
