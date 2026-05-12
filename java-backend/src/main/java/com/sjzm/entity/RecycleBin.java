package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 产品回收站实体（对齐 Python 的 recycle_bin 表）
 * 
 * 软删除流程：
 * 1. 删除产品时，将产品数据保存到此表
 * 2. 更新 products 表的 status='deleted', delete_time=NOW()
 * 3. 恢复时，从 recycle_bin 读取数据恢复到 products，并删除 recycle_bin 记录
 */
@Data
@TableName("recycle_bin")
public class RecycleBin implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 产品SKU */
    private String productSku;

    /** 原始数据（JSON格式存储完整产品信息） */
    private String originalData;

    /** 删除时间 */
    private LocalDateTime deletedAt;

    /** 过期时间（默认30天后过期） */
    private LocalDateTime expiresAt;

    /** 删除操作人ID */
    private Long deletedBy;

    /** 产品名称（冗余字段，便于查询） */
    private String productName;

    /** 产品分类（冗余字段） */
    private String category;

    /** 产品价格（冗余字段） */
    private BigDecimal price;

    /** 开发负责人（冗余字段） */
    private String developer;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
