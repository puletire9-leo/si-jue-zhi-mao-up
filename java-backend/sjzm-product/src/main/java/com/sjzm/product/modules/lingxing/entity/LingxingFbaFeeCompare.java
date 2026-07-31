package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * FBA 配送费对比表（开发人预测 vs 亚马逊实际/预估）。
 * 每合格 ASIN×MSKU 一行。资格 = 统一表目标 ASIN ∩ 近3月合计销量>30 ∩ 近3月合计正利润。
 */
@Data
@TableName("lingxing_fba_fee_compare")
public class LingxingFbaFeeCompare {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String asin;
    private String msku;
    private Long sid;
    private String localSku;
    private String developer;
    private String country;

    /** 亚马逊FBA预估费-API */
    private BigDecimal amazonFbaFee;
    /** 亚马逊FBA预估费-报表 */
    private BigDecimal amazonFbaFeeReport;
    private String feeCurrency;

    /** 开发人预测FBA配送费 */
    private BigDecimal devFbaFee;

    /** 差异：实际-预测 */
    private BigDecimal diff;
    /** 差异率 = diff / dev_fba_fee */
    private BigDecimal diffRate;

    /** 近3月合计销量 */
    private Long recent3mVolume;
    /** 近3月合计利润 */
    private BigDecimal recent3mProfit;

    /** TACOS：近3月广告费占比(spend/amount) */
    private BigDecimal tacos;

    /** 开发人预估售价 */
    private BigDecimal devPrice;
    /** 实际售价(amount/volume) */
    private BigDecimal actualPrice;
    /** 售价差额(实际-预估) */
    private BigDecimal priceDiff;
    /** 售价差额率 */
    private BigDecimal priceDiffRate;

    private LocalDateTime syncedAt;
}
