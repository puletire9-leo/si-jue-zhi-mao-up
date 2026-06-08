"""机会分类器 — 将选品机会分为不同等级和类型。

分类维度：
1. 紧急度：NOW/SOON/WATCH/LATER
2. 利润类型：HIGH_MARGIN/VOLUME_PLAY/BALANCED/LOW_MARGIN
3. 风险等级：LOW_RISK/MEDIUM_RISK/HIGH_RISK/VERY_HIGH_RISK
4. 综合等级：S1/S2/S3/S4

公开函数:
    classify_opportunity
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict

logger = logging.getLogger(__name__)


@dataclass
class OpportunityClassification:
    """机会分类结果。"""
    urgency: str            # NOW/SOON/WATCH/LATER
    profit_type: str        # HIGH_MARGIN/VOLUME_PLAY/BALANCED/LOW_MARGIN
    risk_level: str         # LOW_RISK/MEDIUM_RISK/HIGH_RISK/VERY_HIGH_RISK
    overall_grade: str      # S1/S2/S3/S4
    score: int              # 综合评分 0-100
    reason: str             # 分类依据
    action: str             # 建议行动

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def classify_opportunity(
    opportunity_score: int = 0,
    l2_score: float = 0,
    lifecycle_stage: str = "",
    window_of_opportunity: str = "",
    go_no_go: str = "",
    typical_margin: float = 0,
    units_growth_rate: float = 0,
    blue_ocean_class: str = "",
) -> OpportunityClassification:
    """综合分类选品机会。

    Args:
        opportunity_score:    L1机会评分 0-100
        l2_score:             L2品类专属评分 0-100
        lifecycle_stage:      生命周期阶段
        window_of_opportunity: 切入窗口
        go_no_go:             Go/NoGo判定
        typical_margin:       典型利润率
        units_growth_rate:    销量增速
        blue_ocean_class:     蓝海分类

    Returns:
        OpportunityClassification
    """
    # 综合评分（L1 40% + L2 30% + 蓝海加成 30%）
    blue_ocean_bonus = {
        "BLUE_OCEAN": 30,
        "LIGHT_BLUE": 20,
        "PURPLE_OCEAN": 10,
        "RED_OCEAN": 0,
    }.get(blue_ocean_class, 0)

    composite_score = int(opportunity_score * 0.4 + l2_score * 0.3 + blue_ocean_bonus * 0.3)
    composite_score = max(0, min(100, composite_score))

    # 紧急度
    urgency = _classify_urgency(window_of_opportunity, lifecycle_stage, units_growth_rate)

    # 利润类型
    profit_type = _classify_profit_type(typical_margin, units_growth_rate)

    # 风险等级
    risk_level = _classify_risk(go_no_go, lifecycle_stage)

    # 综合等级
    overall_grade = _classify_grade(composite_score, risk_level)

    # 建议行动
    action = _generate_action(urgency, profit_type, risk_level, overall_grade)
    reason = f"综合评分{composite_score}，{urgency}紧急度，{profit_type}利润型，{risk_level}风险"

    logger.info(f"[classifier] grade={overall_grade}, urgency={urgency}, "
                f"profit={profit_type}, risk={risk_level}")

    return OpportunityClassification(
        urgency=urgency,
        profit_type=profit_type,
        risk_level=risk_level,
        overall_grade=overall_grade,
        score=composite_score,
        reason=reason,
        action=action,
    )


def _classify_urgency(
    window: str,
    lifecycle: str,
    growth_rate: float,
) -> str:
    """分类紧急度。"""
    if window == "BEST" or lifecycle == "EMERGING":
        return "NOW"
    elif window == "GOOD" or lifecycle == "GROWTH":
        return "SOON"
    elif window == "CLOSING" or lifecycle == "MATURITY_STABLE":
        return "WATCH"
    else:
        return "LATER"


def _classify_profit_type(
    margin: float,
    growth_rate: float,
) -> str:
    """分类利润类型。"""
    if margin >= 35:
        return "HIGH_MARGIN"
    elif margin >= 25 and growth_rate > 15:
        return "BALANCED"
    elif growth_rate > 20:
        return "VOLUME_PLAY"
    else:
        return "LOW_MARGIN"


def _classify_risk(
    go_no_go: str,
    lifecycle: str,
) -> str:
    """分类风险等级。"""
    if go_no_go == "NO_GO" or lifecycle == "DECLINE":
        return "VERY_HIGH_RISK"
    elif go_no_go == "WAIT_AND_SEE" or lifecycle == "SATURATION":
        return "HIGH_RISK"
    elif go_no_go == "CONDITIONAL_GO" or lifecycle == "MATURITY_WITH_DECLINE":
        return "MEDIUM_RISK"
    else:
        return "LOW_RISK"


def _classify_grade(
    score: int,
    risk_level: str,
) -> str:
    """分类综合等级。"""
    # 高风险降级
    risk_penalty = {
        "LOW_RISK": 0,
        "MEDIUM_RISK": 5,
        "HIGH_RISK": 15,
        "VERY_HIGH_RISK": 30,
    }.get(risk_level, 0)

    adjusted = score - risk_penalty

    if adjusted >= 75:
        return "S1"
    elif adjusted >= 55:
        return "S2"
    elif adjusted >= 35:
        return "S3"
    else:
        return "S4"


def _generate_action(
    urgency: str,
    profit_type: str,
    risk_level: str,
    grade: str,
) -> str:
    """生成建议行动。"""
    if grade == "S1":
        if urgency == "NOW":
            return "立即启动选品，快速切入市场"
        else:
            return "重点跟进，制定选品计划"
    elif grade == "S2":
        if risk_level == "LOW_RISK":
            return "值得投入，建议小批量测试"
        else:
            return "谨慎评估，控制风险后再行动"
    elif grade == "S3":
        return "观望为主，持续跟踪市场变化"
    else:
        return "暂不建议投入，等待市场信号改善"
