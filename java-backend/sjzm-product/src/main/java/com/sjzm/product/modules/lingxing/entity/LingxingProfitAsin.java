package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星利润统计-ASIN（profit/statistics/open/asin/list 落库）。
 *
 * 只保留常用结构化列。raw_json 已删除（2026-07 数据库整理）。
 *
 * 幂等：返回按 dataDate 逐日拆行，
 * {@link #bizKey} = asin | sid | dataDate | currency，逐日唯一，反复同步可重跑。
 */
@Data
@TableName("lingxing_profit_asin")
public class LingxingProfitAsin {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 业务幂等键：asin|sid|dataDate|currency */
    private String bizKey;

    private String asin;
    private String parentAsin;

    /** 店铺 ID */
    private String sid;

    /** 店铺名 */
    private String storeName;

    /** 数据日期（逐日一行） */
    private LocalDate dataDate;

    /** 国家简码 */
    private String countryCode;

    /** SKU */
    private String localSku;

    /** 品名 */
    private String localName;

    /** 标题 */
    private String itemName;

    /** 币种 */
    private String currencyCode;

    // ---- 结构化指标 ----

    /** 销量 */
    private Integer totalSalesQuantity;

    /** 销售额 */
    private BigDecimal totalSalesAmount;

    /** 广告费 */
    private BigDecimal totalAdsCost;

    /** 采购成本 */
    private BigDecimal cgPrice;

    /** 头程运费 */
    private BigDecimal cgTransportCosts;

    /** 合计成本 */
    private BigDecimal totalCost;

    /** 毛利润 */
    private BigDecimal grossProfit;

    /** 毛利率 */
    private BigDecimal grossRate;

    /** 本地同步入库时间 */
    private LocalDateTime syncedAt;
}
