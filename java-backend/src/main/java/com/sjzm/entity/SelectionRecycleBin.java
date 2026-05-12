package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 选品回收站实体（对齐 Python 的 selection_recycle_bin 表）
 * 
 * 软删除流程：
 * 1. 删除选品时，将选品数据保存到此表
 * 2. 从 selection_products 表物理删除该记录
 * 3. 恢复时，从 selection_recycle_bin 读取数据恢复到 selection_products
 */
@Data
@TableName("selection_recycle_bin")
public class SelectionRecycleBin implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 原选品ID */
    private Long originalId;

    /** 产品ASIN */
    private String asin;

    /** 商品标题 */
    private String productTitle;

    /** 商品价格 */
    private BigDecimal price;

    /** 商品图片URL */
    private String imageUrl;

    /** 本地图片路径 */
    private String localPath;

    /** 缩略图路径 */
    private String thumbPath;

    /** 店铺名称 */
    private String storeName;

    /** 店铺URL */
    private String storeUrl;

    /** 店铺ID */
    private String shopId;

    /** 大类榜单名 */
    private String mainCategoryName;

    /** 榜单排名 */
    private Integer mainCategoryRank;

    /** 大类BSR增长数 */
    private BigDecimal mainCategoryBsrGrowth;

    /** 大类BSR增长率 */
    private BigDecimal mainCategoryBsrGrowthRate;

    /** 产品标签列表（JSON） */
    private String tags;

    /** 备注信息 */
    private String notes;

    /** 商品链接 */
    private String productLink;

    /** 销量 */
    private Integer salesVolume;

    /** 上架时间 */
    private LocalDateTime listingDate;

    /** 配送方式 */
    private String deliveryMethod;

    /** 相似商品 */
    private String similarProducts;

    /** 来源 */
    private String source;

    /** 国家 */
    private String country;

    /** 数据筛选模式 */
    private String dataFilterMode;

    /** 产品类型：new/reference/zheng */
    private String productType;

    /** 评分（0-100） */
    private Integer score;

    /** 等级（S/A/B/C/D） */
    private String grade;

    /** 周标记 */
    private String weekTag;

    /** 是否本周数据 */
    private Integer isCurrent;

    /** 删除时间 */
    private LocalDateTime deletedAt;

    /** 过期时间 */
    private LocalDateTime expiresAt;

    /** 删除操作人ID */
    private Long deletedBy;

    /** 原始数据（JSON格式） */
    private String originalData;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
