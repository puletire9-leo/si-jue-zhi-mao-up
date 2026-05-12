package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 下载任务实体
 */
@Data
@TableName("download_tasks")
public class DownloadTask implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 任务名称 */
    private String name;

    /** 任务来源（final_draft/material_library/carrier_library） */
    private String source;

    /** SKU列表（JSON） */
    private String skus;

    /** 状态（pending/processing/completed/failed） */
    private String status;

    /** 文件路径 */
    private String filePath;

    /** 文件名 */
    private String filename;

    /** 文件大小 */
    private Long fileSize;

    /** 处理进度 */
    private Integer progress;

    /** 错误信息 */
    private String errorMessage;

    /** 创建用户ID */
    private Long userId;

    /** 创建用户名 */
    private String username;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
