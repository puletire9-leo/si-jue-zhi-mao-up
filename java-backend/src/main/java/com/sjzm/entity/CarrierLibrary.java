package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 运营商库实体
 */
@Data
@TableName("carrier_library")
public class CarrierLibrary implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** SKU编号 */
    private String sku;

    /** 图片列表（JSON） */
    private String images;

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

    /** 参考图列表（JSON） */
    private String referenceImages;

    /** 产品尺寸 */
    private String productSize;

    /** 载体名称 */
    private String carrierName;

    /** 材质 */
    private String material;

    /** 工艺 */
    private String process;

    /** 克重 */
    private Integer weight;

    /** 打包方式 */
    private String packagingMethod;

    /** 包装尺寸 */
    private String packagingSize;

    /** 价格 */
    private BigDecimal price;

    /** 起订量 */
    private Integer minOrderQuantity;

    /** 供应商 */
    private String supplier;

    /** 供应商下单链接 */
    private String supplierLink;

    /** 状态：pending/approved/rejected */
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
