package com.sjzm.product.modules.lingxing.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星店铺数据选品卡片 VO。
 * 来源 lingxing_product_unified（每 ASIN 一行）+ 图片 LEFT JOIN
 * lingxing_listing.small_image_url（缺则 lingxing_local_product.pic_url）。
 * 只读展示，字段面向 UniversalCard 卡片：图片/销量/上架时间/店铺等。
 */
@Data
public class LingxingShopProductVO {

    private String asin;
    private String parentAsin;
    private String title;
    /** 主图（listing 优先，local_product 兜底），mapper JOIN 出来 */
    private String imageUrl;

    /** 基准店铺（周表 store_name），用于"按店铺分类" */
    private String baseStore;
    private String country;
    private String developer;
    private String principal;

    // ── 销量/销售额（卡片主用最近月）──
    private Long latestVolume;
    private Long totalVolume;
    private BigDecimal latestAmount;
    private BigDecimal totalAmount;

    // ── 真实上架日期 ──
    /** 真实上架日期（首次写入后锁定） */
    private LocalDate listingDate;

    // ── 其它卡片信息 ──
    private Long latestFbaAvailable;
    private String latestCateRank;
    private Integer latestReviewsCount;
    private BigDecimal latestAvgStar;
    private String latestMonth;
    private String listingTags;

    // ── 实时字段（查询时 JOIN lingxing_listing，按 asin 取一行；统一表/listing 各自同步后天然最新）──
    /** 实时价格（listing.price，不含促销/运费/积分） */
    private BigDecimal price;
    /** 币种（GBP/EUR…） */
    private String currencyCode;
    /** 实时排名（listing.seller_rank，作 BSR 展示） */
    private Long sellerRank;
    /** 实时评论数（listing.review_num，比月快照更新） */
    private Integer reviewNum;
    /** 实时星级（listing.last_star） */
    private BigDecimal lastStar;
    /** 配送方式（FBM/FBA） */
    private String fulfillmentChannelType;
    /** 30 天销量（listing.thirty_volume） */
    private Integer thirtyVolume;
    /** 品牌（listing.seller_brand） */
    private String sellerBrand;
}
