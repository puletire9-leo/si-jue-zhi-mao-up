package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 定稿实体
 */
@Data
@TableName("final_drafts")
public class FinalDraft implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 产品SKU */
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

    /** 侵权标注 */
    private String infringementLabel;

    /** 图片列表（JSON） */
    private String images;

    /** 参考图列表（JSON） */
    private String referenceImages;

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
