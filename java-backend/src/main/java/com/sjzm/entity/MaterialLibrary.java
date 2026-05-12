package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 素材库实体
 */
@Data
@TableName("material_library")
public class MaterialLibrary implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

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

    /** 侵权标注 */
    private String infringementLabel;

    /** 设计稿图片列表（JSON） */
    private String finalDraftImages;

    /** 状态：finalized/optimizing/concept */
    private String status;

    /** 本地缩略图路径 */
    private String localThumbnailPath;

    /** 本地缩略图状态 */
    private String localThumbnailStatus;

    /** 本地缩略图更新时间 */
    private LocalDateTime localThumbnailUpdatedAt;

    /** 本地缩略图大小 */
    private Long localThumbnailSize;

    /** 本地缩略图MD5 */
    private String localThumbnailMd5;

    /** 删除标记 */
    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
