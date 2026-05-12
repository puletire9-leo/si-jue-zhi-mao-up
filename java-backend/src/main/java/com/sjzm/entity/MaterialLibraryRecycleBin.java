package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 素材库回收站实体（对齐 Python 的 material_library_recycle_bin 表）
 */
@Data
@TableName("material_library_recycle_bin")
public class MaterialLibraryRecycleBin implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 原素材ID */
    private Long materialId;

    /** 素材SKU */
    private String sku;

    /** 批次 */
    private String batch;

    /** 开发人 */
    private String developer;

    /** 载体 */
    private String carrier;

    /** 元素 */
    private String element;

    /** 修改要求 */
    private String modificationRequirement;

    /** 图片列表（JSON） */
    private String images;

    /** 参考图列表（JSON） */
    private String referenceImages;

    /** 设计稿图片列表（JSON） */
    private String finalDraftImages;

    /** 状态 */
    private String status;

    /** 本地缩略图路径 */
    private String localThumbnailPath;

    /** 删除操作人ID */
    private Long deletedBy;

    /** 删除操作人姓名 */
    private String deletedByName;

    /** 删除时间 */
    private LocalDateTime deleteTime;

    /** 过期时间（默认30天后过期） */
    private LocalDateTime expiresAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
