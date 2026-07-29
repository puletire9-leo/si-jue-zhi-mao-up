package com.sjzm.product.modules.shopcollection.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 店铺选品「按店铺聚合画像」物化快照。
 *
 * <p>是 ShopProfileSummary 的扁平落库：刷新时由 ShopCollectionService 跑一次实时 CTE 聚合 + Java
 * 派生字段(completeSummary + enrichSummary3d)，把结果整站替换进本表；selectionShops/summary 常规
 * 列表路径读本表，退化为单表 SELECT + LIMIT，避免每次打开筛选抽屉都跑 7 层 CTE 全量聚合。</p>
 *
 * <p>粒度：一行 = 一个 (marketplace, seller_name) 在最新批次的聚合。DDL 见
 * java-backend/sql/create_shop_seller_summary.sql，主键 AUTO_INCREMENT，故 IdType.AUTO。</p>
 */
@Data
@TableName("shop_seller_summary")
public class ShopSellerSummary {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String sellerName;
    private String sellerId;

    private Long productCount;
    private Long aCount;
    private Long bCount;
    private Long cCount;
    private Long dCount;
    private Long unknownCount;
    private Long abCount;
    private Long abcCount;
    private Double aRatio;
    private Double abRatio;
    private Double abcRatio;
    private Double dRatio;

    private String topACategory;
    @TableField("top_abc_category")
    private String topABCCategory;
    private String topDCategory;
    private String profileType;
    private String latestBatchDate;
    private String variationMode;

    private Long m01HitCount;
    private Double m01HitRatio;
    private Double avgListingDays;
    private Double avgUnits;
    private Long earliestAvailableDate;
    private String earliestAvailableDateText;
    private Integer maxListingDays;
    private Long new30Count;
    private Long new90Count;
    private Long new180Count;
    private Long old180Count;
    private Long unknownListingDaysCount;

    private Long newProductCount;
    @TableField("new_abc_count")
    private Long newABCCount;
    @TableField("new_abc_ratio")
    private Double newABCRatio;
    private Long oldDCount;
    private Double oldDRatio;

    private Long goodTendencyCount;
    private Long attentionStrongCount;
    private Long attentionReviewCount;

    @TableField("shop_profile_3d_type")
    private String shopProfile3dType;
    @TableField("shop_profile_3d_explanation")
    private String shopProfile3dExplanation;

    private LocalDateTime refreshedAt;
}
