package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("scoring_config")
public class ScoringConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String dimensionKey;
    private String displayName;
    private Double weight;
    private String thresholds;
    private Boolean isActive;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
