package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 品线选品指导意见表 — 存储Agent分析结果。
 */
@Data
@TableName("product_line_guidance")
public class ProductLineGuidance {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String batchId;
    private String marketplace;

    /** BSR品类节点ID */
    private String bsrId;
    private String nodeName;
    private String nodeFullPath;

    // ── 算法层确定性结果 ──
    private String archetype;
    private String archetypeMethod;

    private String lifecycleStage;
    private String lifecycleWindow;

    /** CR3竞争集中度 (0-1) */
    private BigDecimal cr3;
    private String competitionPattern;
    private String entryBarrier;

    /** 典型利润率(%) */
    private BigDecimal profitMargin;
    private String profitVerdict;

    /** 机会评分(0-100) */
    private Integer opportunityScore;
    private String recommendLevel;

    /** Go/NoGo判定 */
    private String goNoGo;

    /** 价格带分析JSON */
    private String priceBandJson;

    /** 评分分项明细JSON */
    private String scoreBreakdownJson;

    /** 风险硬规则JSON */
    private String riskRulesJson;

    /** 完整分析结果JSON */
    private String fullAnalysisJson;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
