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
@TableName("automation_record_binding")
public class AutomationRecordBinding {
    @TableId(type = IdType.ASSIGN_ID)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    private String jobCode;
    private String businessKey;
    private String targetType;
    private String targetResource;
    private String targetRecordId;
    private String lastSourceHash;
    private String lastBusinessStatus;
    private Integer terminal;
    private LocalDateTime lastSyncedAt;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
