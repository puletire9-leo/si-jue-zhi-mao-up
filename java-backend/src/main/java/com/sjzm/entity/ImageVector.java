package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 图片向量实体（用于 Qdrant 向量数据库的元数据管理）
 */
@Data
@TableName("image_vectors")
public class ImageVector implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 图片ID */
    private Long imageId;

    /** 图片SKU */
    private String sku;

    /** 图片分类 */
    private String category;

    /** 标签 */
    private String tags;

    /** 开发者 */
    private String developer;

    /** 向量维度 */
    private Integer dimensions;

    /** 向量模型 */
    private String model;

    /** Qdrant 点ID */
    private String pointId;

    /** 向量状态（pending/indexed/error） */
    private String status;

    /** 错误信息 */
    private String errorMessage;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
