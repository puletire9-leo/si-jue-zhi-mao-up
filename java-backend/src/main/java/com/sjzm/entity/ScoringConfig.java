package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 评分配置实体（对齐 Python 的 scoring_config 表）
 * 
 * 用于存储各评分维度的权重和阈值配置
 */
@Data
@TableName("scoring_config")
public class ScoringConfig implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 维度标识：listing_age / sales_volume / bsr_rank / price */
    private String dimensionKey;

    /** 显示名称 */
    private String displayName;

    /** 权重百分比（如 30.00 表示 30%） */
    private Double weight;

    /** 阈值配置（JSON格式） */
    private String thresholds;

    /** 是否启用：true=启用, false=禁用 */
    private Boolean isActive;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
