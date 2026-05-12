package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 选品实体（对齐 Python 的 selection_products 表）
 * 
 * 软删除机制：
 * - 不使用 @TableLogic
 * - 删除时：将数据保存到 selection_recycle_bin 表，然后物理删除原记录
 * - 恢复时：从 selection_recycle_bin 恢复到 selection_products
 */
@Data
@TableName("selection_products")
public class Selection implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

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

    /** 上架天数（计算字段） */
    private Integer listingDays;

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

    /** 产品类型：new(新品榜)/reference(竞品店铺)/zheng(正选) */
    private String productType;

    /** 评分（0-100） */
    private Integer score;

    /** 等级（S/A/B/C/D） */
    private String grade;

    /** 周标记（如2026-W19） */
    private String weekTag;

    /** 是否本周数据（1=本周, 0=往期） */
    private Integer isCurrent;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    // ==================== 业务常量 ====================
    
    /** 新品榜 */
    public static final String TYPE_NEW = "new";
    
    /** 竞品店铺 */
    public static final String TYPE_REFERENCE = "reference";
    
    /** 正选 */
    public static final String TYPE_ZHENG = "zheng";
}
