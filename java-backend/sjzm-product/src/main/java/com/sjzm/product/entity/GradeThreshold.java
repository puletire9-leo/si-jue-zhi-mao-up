package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("grade_thresholds")
public class GradeThreshold {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String grade;
    private Integer minScore;
    private Integer maxScore;
    private String color;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
