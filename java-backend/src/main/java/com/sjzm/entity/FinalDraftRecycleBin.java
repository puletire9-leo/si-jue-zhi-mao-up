package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 定稿回收站实体（对齐 Python 的 final_draft_recycle_bin 表）
 */
@Data
@TableName("final_draft_recycle_bin")
public class FinalDraftRecycleBin implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 原定稿ID */
    private Long draftId;

    /** 定稿SKU */
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

    /** 侵权标签 */
    private String infringementLabel;

    /** 图片列表（JSON） */
    private String images;

    /** 参考图列表（JSON） */
    private String referenceImages;

    /** 状态 */
    private String status;

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
