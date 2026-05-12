package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 文件链接实体（用于图片代理服务）
 */
@Data
@TableName("file_links")
public class FileLink implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 文件链接 */
    private String linkUrl;

    /** COS对象键 */
    private String objectKey;

    /** 文件类型 */
    private String fileType;

    /** 原始文件名 */
    private String originalFilename;

    /** 文件大小 */
    private Long fileSize;

    /** 关联实体类型（product/material/final/carrier） */
    private String entityType;

    /** 关联实体ID */
    private Long entityId;

    /** 点击次数 */
    private Integer clickCount;

    /** 过期时间 */
    private LocalDateTime expiresAt;

    /** 状态（active/expired/disabled） */
    private String status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
