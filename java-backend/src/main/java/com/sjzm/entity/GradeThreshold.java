package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 等级阈值实体（对齐 Python 的 grade_thresholds 表）
 * 
 * 用于存储评分等级的分数范围配置
 * 默认配置：
 * - S: 90-100 分
 * - A: 80-89 分
 * - B: 65-79 分
 * - C: 50-64 分
 * - D: 0-49 分
 */
@Data
@TableName("grade_thresholds")
public class GradeThreshold implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 等级：S/A/B/C/D */
    private String grade;

    /** 最低分 */
    private Integer minScore;

    /** 最高分 */
    private Integer maxScore;

    /** 显示颜色（如 #67C23A） */
    private String color;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
