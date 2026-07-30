package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 领星产品统一表（ASIN 维度宽表，每 ASIN 一行）。
 *
 * <p>把领星多张表按 ASIN 汇总的产出物，产出从 CSV 升级为 MySQL 表，供模型页/选品直接查。
 * 纯读库加工（月表聚合 + listing.open_date + baseline），每周产品表现同步后全量重算。</p>
 *
 * <p>上架日双口径并列存：{@link #fbaFirstAvailableMonth}（模型口径）+ {@link #listingOpenDate}（真实上架日）
 * + {@link #modelStartMonth}（4 级兜底起算月）。</p>
 *
 * 见 java-backend/sql/create_lingxing_product_unified.sql
 */
@Data
@TableName("lingxing_product_unified")
public class LingxingProductUnified {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** ASIN（业务唯一键） */
    private String asin;

    // ── 身份信息 ──
    private String parentAsin;
    private String baseSku;
    private String baseMsku;
    private String baseStore;
    private String country;
    private String developer;
    private String principal;
    private String title;
    private String listingTags;
    private String productCreateTime;

    // ── 上架日双口径 ──
    /** FBA 可售首现月（模型口径，来自 baseline） */
    private String fbaFirstAvailableMonth;
    private String fbaFirstAvailableBasis;
    /** 亚马逊真实商品创建时间（来自 lingxing_listing.open_date） */
    private LocalDateTime listingOpenDate;
    /** 模型分析起算月（可售首现月优先，无则库存首现月） */
    private String modelStartMonth;
    private String modelStartBasis;

    // ── FBA 首现（从周表按时间序算，不依赖 baseline）──
    /** FBA 库存首现月 */
    private String fbaInventoryFirstMonth;
    private String inventoryFirstStore;
    private String inventoryFirstCountry;
    private String inventoryFirstSku;
    private Integer inventoryFirstQty;
    /** FBA 可售首现的店铺/国家/SKU/数量（首现月见 fbaFirstAvailableMonth） */
    private String availableFirstStore;
    private String availableFirstCountry;
    private String availableFirstSku;
    private Integer availableFirstQty;
    /** FBA 观测状态 */
    private String fbaObservationStatus;

    // ── 经营指标汇总（全期累计） ──
    private Long totalVolume;
    private BigDecimal totalAmount;
    private Long totalOrderItems;
    private BigDecimal totalGrossProfit;
    private BigDecimal avgGrossMargin;
    private Integer activeMonths;
    private String firstSaleMonth;
    private String lastSaleMonth;

    // ── 最近月快照 ──
    private String latestMonth;
    private Long latestVolume;
    private BigDecimal latestAmount;
    private Long latestFbaAvailable;
    private String latestCateRank;
    private BigDecimal latestAvgStar;
    private Integer latestReviewsCount;

    // ── 元数据 ──
    private String dataCutoffMonth;
    private String unifiedVersion;
    private LocalDateTime syncedAt;
}