package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 图片实体（对齐 Python 的 images 表）
 */
@Data
@TableName("images")
public class Image implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 文件名 */
    private String filename;

    /** 文件路径 */
    private String filepath;

    /** 分类（final/material/carrier/product） */
    private String category;

    /** 标签（逗号分隔） */
    private String tags;

    /** 图片描述 */
    private String description;

    /** 产品SKU */
    private String sku;

    /** 开发负责人 */
    private String developer;

    /** 宽度 */
    private Integer width;

    /** 高度 */
    private Integer height;

    /** 格式 */
    private String format;

    /** 文件大小（字节） */
    private Long fileSize;

    /** 缩略图路径 */
    private String thumbnailPath;

    /** 原始文件名 */
    private String originalFilename;

    /** 原始格式 */
    private String originalFormat;

    /** 原始ZIP文件路径 */
    private String originalZipFilepath;

    /** 图片类型（final/material/carrier/product） */
    private String imageType;

    /** 缩略图URL */
    private String thumbnailUrl;

    /** 访问URL */
    private String url;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
