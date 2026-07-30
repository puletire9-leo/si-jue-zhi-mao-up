package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 领星产品表现（productPerformance/asinList 落库）。
 *
 * 双写（张总蓝本 §一.1）：少量结构化关键列供查询/聚合 + {@link #rawJson} 整包留底。
 * 产品表现 200+ 指标（销量/利润/库存/流量/广告…），只把最常用的落成列，其余走 raw_json。
 *
 * 幂等（张总蓝本 §一.2，报表类用「维度 + 查询时间窗」组合唯一键）：
 * {@link #bizKey} = summaryField:summaryValue | sidScope | startDate | endDate | currency，
 * 同一时间窗反复同步只更新不堆积、天然可重跑。
 *
 * 见 java-backend/sql/create_lingxing_product_performance.sql
 * （2026-07 清理时误删同步链路，2026-07-30 按 git d4d9650 蓝本恢复，用于每周自动同步）
 */
@Data
@TableName("lingxing_product_performance")
public class LingxingProductPerformance {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 业务幂等键：summaryField:value|sidScope|start|end|currency */
    private String bizKey;

    /** 汇总维度：asin / parent_asin / msku / sku */
    private String summaryField;

    /** 汇总维度值（对应 summaryField 的取值） */
    private String summaryValue;

    /** 查询的店铺集合（排序后逗号拼接，行按此店铺集合聚合） */
    private String sidScope;

    private String asin;
    private String parentAsin;
    private String msku;
    private String sku;

    /** 标题 */
    private String itemName;

    /** 币种编码（USD/CNY/原币种） */
    private String currencyCode;

    /** 查询时间窗-开始（双闭区间） */
    private LocalDate startDate;

    /** 查询时间窗-结束（双闭区间） */
    private LocalDate endDate;

    // ---- 常用指标（其余 200+ 指标见 raw_json）----

    /** 销量 */
    private Integer volume;

    /** 订单量 */
    private Integer orderItems;

    /** 销售额 */
    private BigDecimal amount;

    /** 结算毛利润 */
    private BigDecimal grossProfit;

    /** 结算毛利率 */
    private BigDecimal grossMargin;

    /** Sessions-Total */
    private Integer sessionsTotal;

    /** 广告花费 */
    private BigDecimal spend;

    /** TACOS（广告花费/销售额） */
    private BigDecimal tacos;

    /** 领星原始行 JSON 整包留底 */
    private String rawJson;

    /** 本地同步入库时间 */
    private LocalDateTime syncedAt;
}