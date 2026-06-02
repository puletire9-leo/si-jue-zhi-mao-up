package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_filter_presets")
public class UserFilterPreset {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String presetName;

    private Integer presetIndex;

    private Integer isDefault;

    private String filterConfig;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
