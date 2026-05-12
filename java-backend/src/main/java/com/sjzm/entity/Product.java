package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 产品实体（对齐 Python 的 products 表）
 * 
 * 软删除机制：
 * - 不使用 @TableLogic，而是通过 status='deleted' 标记删除
 * - 删除时同时将数据保存到 recycle_bin 表
 * - 恢复时从 recycle_bin 恢复
 */
@Data
@TableName("product")
public class Product implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 产品SKU */
    private String sku;

    /** 产品名称 */
    private String name;

    /** 产品描述 */
    private String description;

    /** 产品分类 */
    private String category;

    /** 产品标签（JSON数组格式） */
    private String tags;

    /** 产品价格 */
    private BigDecimal price;

    /** 库存数量 */
    private Integer stock;

    /** 产品状态：active/normal/deleted */
    private String status;

    /** 产品类型：普通产品/组合产品/定制产品 */
    private String type;

    /** 产品图片URL */
    private String image;

    /** 开发负责人 */
    private String developer;

    /** 本地图片路径 */
    private String localPath;

    /** 缩略图路径 */
    private String thumbPath;

    /** 包含单品 */
    private String includedItems;

    /** 删除时间（软删除时设置） */
    private LocalDateTime deleteTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    // ==================== 业务常量 ====================
    
    /** 正常状态 */
    public static final String STATUS_ACTIVE = "active";
    
    /** 正常状态（Python 兼容） */
    public static final String STATUS_NORMAL = "normal";
    
    /** 已删除状态 */
    public static final String STATUS_DELETED = "deleted";
    
    /** 普通产品 */
    public static final String TYPE_STANDARD = "普通产品";
    
    /** 组合产品 */
    public static final String TYPE_COMBO = "组合产品";
    
    /** 定制产品 */
    public static final String TYPE_CUSTOM = "定制产品";
}
