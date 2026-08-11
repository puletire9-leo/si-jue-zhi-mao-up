package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星产品统一表（ASIN 维度宽表，每 ASIN 一行）。
 *
 * <p>把领星多张表按 ASIN 汇总的产出物，供模型页/选品直接查。
 * 纯读库加工（周表聚合 + listing.open_date），每周产品表现同步后刷新经营指标。</p>
 *
 * <p>上架时间 {@link #listingTime} 采用三级兜底（FBA可售首现月 →
 * listing真实上架日 → 商品创建时间兜底），首次写入后永久锁定，后续周不再变更。</p>
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

    // ── 真实上架日期（首次写入后锁定）──
    /** 真实上架日期（新ASIN优先listing.open_date，老ASIN用FBA首现。首次写入后不变） */
    private LocalDate listingDate;

    // ── FBA 首现（从周表按时间序算，每周刷新）──
    /** FBA 库存首现月 */
    private String fbaInventoryFirstMonth;
    private String inventoryFirstStore;
    private String inventoryFirstCountry;
    private String inventoryFirstSku;
    private Integer inventoryFirstQty;
    /** FBA 可售首现的店铺/国家/SKU/数量 */
    private String availableFirstStore;
    private String availableFirstCountry;
    private String availableFirstSku;
    private Integer availableFirstQty;
    /** FBA 观测状态 */
    private String fbaObservationStatus;

    // ── 经营指标汇总（全期累计，每周刷新）──
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