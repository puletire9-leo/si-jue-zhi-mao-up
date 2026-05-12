package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 分类实体
 */
@Data
@TableName("categories")
public class Category implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 分类名称 */
    private String name;

    /** 分类描述 */
    private String description;

    /** 父分类ID */
    private Long parentId;

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
