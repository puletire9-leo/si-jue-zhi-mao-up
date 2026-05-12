package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 标签实体
 */
@Data
@TableName("tags")
public class Tag implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 标签名称 */
    private String name;

    /** 标签颜色 */
    private String color;

    /** 标签类型 */
    private String type;

    /** 排序 */
    private Integer sortOrder;

    /** 状态 */
    private String status;

    /** 删除标记 */
    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
