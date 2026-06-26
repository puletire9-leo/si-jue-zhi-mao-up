package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 选品决策记录实体 — 反馈闭环核心。
 *
 * 记录每个S1/S2级ASIN的选品决策快照，3个月后验证预测准确性。
 */
@Data
@TableName("selection_decisions")
public class SelectionDecision {

    @TableId(type = IdType.AUTO)
    private Long id;

    // ═══ 产品标识 ═══
    private String marketplace;
    private String asin;
    private String decisionMonth;

    // ═══ 品类信息 ═══
    private String categoryLabel;
    private String categoryPrototype;

    // ═══ 评分快照（决策时刻的8维分数） ═══
    private Integer selectionScore;
    private String selectionGrade;
    private Byte selSizeScore;
    private Byte selVolumeScore;
    private Byte selProfitScore;
    private Byte selEmotionScore;
    private Byte selDecorScore;
    private Byte selFissionScore;
    private Byte selCultureScore;
    private Byte selMarketScore;

    // ═══ 决策快照 ═══
    private BigDecimal decisionScore;
    private String decisionStatus;
    private String signalBoosts;  // JSON

    // ═══ 决策时基线数据（3个月后对比用） ═══
    private Integer baselineBsr;
    private Integer baselineUnits;
    private BigDecimal baselinePrice;
    private Integer baselineRatings;

    // ═══ 验证结果（3个月后填充） ═══
    private String verifyMonth;
    private Integer verifyBsr;
    private Integer verifyUnits;
    private BigDecimal verifyPrice;
    private Integer verifyRatings;

    // ═══ 验证判定 ═══
    private String outcome;
    private String outcomeDetail;

    // ═══ 元数据 ═══
    private LocalDateTime createdAt;
    private LocalDateTime verifiedAt;
    private String verifiedBy;
}
