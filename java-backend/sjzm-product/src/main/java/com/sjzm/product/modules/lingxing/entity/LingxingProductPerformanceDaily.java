package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星产品表现日表（productPerformance/asinList 单日落库）。
 *
 * <p>与 {@link LingxingProductPerformance}（周窗口）不同，本表 {@link #dataDate} 固定为单日，
 * 只落理实团队开发人的 ASIN。是财务日报 5 维度的当日事实来源。</p>
 *
 * <p>业务键 {@link #bizKey} = summaryField:summaryValue | sidScope | dataDate | currency。
 * 财务日报把首次成功日事实视为不可变快照；目标日期已有数据时拒绝重复拉取和覆盖。</p>
 *
 * <p>见 java-backend/sql/create_lingxing_product_performance_daily.sql。
 * 主键使用 AUTO_INCREMENT，故 {@code IdType.AUTO}。</p>
 */
@Data
@TableName("lingxing_product_performance_daily")
public class LingxingProductPerformanceDaily {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 业务幂等键：summary:value|sidScope|dataDate|currency */
    private String bizKey;

    private String summaryField;
    private String summaryValue;
    private String sidScope;
    private String asin;
    private String parentAsin;
    private String msku;
    private String sku;
    private String itemName;
    private String currencyCode;
    /** UK / DE；财务禁止跨币种合并。历史未拆分数据可为空。 */
    private String marketplace;

    /** 数据日期（单日） */
    private LocalDate dataDate;

    private String principalNames;
    private String developerNames;
    private String storeNames;
    private String tagNames;
    private String productCreateTime;

    private Integer volume;
    private Integer orderItems;
    private BigDecimal amount;
    private BigDecimal grossProfit;
    private BigDecimal grossMargin;
    private Integer sessionsTotal;
    private Integer clicks;
    private Integer impressions;
    private Integer adOrderQuantity;
    private BigDecimal adSalesAmount;
    private BigDecimal spend;
    private BigDecimal tacos;
    private Integer afnFulfillableQuantity;
    private Integer availableInventory;
    private BigDecimal returnAmount;
    private BigDecimal avgCustomPrice;

    /** 领星原始行 JSON 整包留底 */
    private String rawJson;

    private LocalDateTime syncedAt;
}
