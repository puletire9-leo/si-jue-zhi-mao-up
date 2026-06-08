"""机会评分公式 — 加权求和+推荐等级判定，纯函数。

评分公式（总分100）：
opportunityScore = demand(0-25) + profitability(0-20) + competition(0-20)
                 + differentiation(0-15) + timing(0-10) - riskPenalty(0-10)

推荐等级：
- STRONGLY_RECOMMEND: ≥80
- RECOMMEND:         60-79
- WATCH:             40-59
- AVOID:             <40

公开函数:
    calculate_opportunity_score
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

from selection.algorithms.constants import SCORE_DIMENSIONS, AGENT_SCORE_WEIGHTS

logger = logging.getLogger(__name__)


@dataclass
class ScoreBreakdown:
    """评分分项明细。"""
    demand: int              # 0-25
    profitability: int       # 0-20
    competition: int         # 0-20
    differentiation: int     # 0-15
    timing: int              # 0-10
    risk_penalty: int        # 0-10（扣分项）
    total: int               # 总分（0-100）
    recommend_level: str     # STRONGLY_RECOMMEND / RECOMMEND / WATCH / AVOID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _score_demand(lifecycle_stage: str, units_growth_rate: float = 0, total_units: int = 0) -> int:
    """需求/市场容量评分（0-25）。

    逻辑：生命周期阶段决定基础分，增速提供微调，市场容量提供规模修正。
    """
    base_scores = {
        "EMERGING": 25,
        "GROWTH": 20,
        "MATURITY_STABLE": 12,
        "MATURITY_WITH_DECLINE": 8,
        "SATURATION": 5,
        "DECLINE": 2,
    }
    score = base_scores.get(lifecycle_stage, 10)
    # 增速加成：高增速+2，严重下滑-2
    if units_growth_rate > 30:
        score = min(score + 2, 25)
    elif units_growth_rate < -30:
        score = max(score - 2, 0)
    # 市场容量修正（total_units>10000 加分，<500 减分）
    if total_units > 10000:
        score = min(score + 3, 25)
    elif total_units > 0 and total_units < 500:
        score = max(score - 3, 0)
    return score


def _score_profitability(typical_margin: float) -> int:
    """利润率评分（0-20）。"""
    if typical_margin >= 40:
        return 20
    elif typical_margin >= 30:
        return 16
    elif typical_margin >= 20:
        return 12
    elif typical_margin >= 10:
        return 6
    else:
        return 2


def _score_competition(cr3: float, entry_barrier: str = "", brand_count: int = 0) -> int:
    """竞争可进入性评分（0-20）。CR3越低=越容易进入=分越高。

    brand_count用于粒度修正：低CR3+多品牌=真分散，低CR3+少品牌=隐性垄断。
    """
    if cr3 < 0.3:
        base = 20  # 分散市场，容易进入
    elif cr3 < 0.6:
        base = 15  # 适度集中
    elif cr3 < 0.8:
        base = 8   # 寡头，进入困难
    else:
        base = 3   # 垄断，很难进入

    # brand_count粒度修正
    if brand_count > 3:
        tail_count = brand_count - 3
        tail_ratio = (1 - cr3) / tail_count if tail_count > 0 else 0
        if tail_ratio > 0.05:
            base = min(base + 2, 20)  # 长尾分散，实际可进入
        elif tail_ratio < 0.01 and brand_count < 10:
            base = max(base - 2, 0)   # 品牌极少且集中，隐性垄断
    return base


def _score_differentiation(
    diff_strategies_count: int = 0,
    diff_effort: str = "MEDIUM",
) -> int:
    """差异化机会评分（0-15）。"""
    if diff_strategies_count >= 3:
        base = 15
    elif diff_strategies_count >= 2:
        base = 12
    elif diff_strategies_count >= 1:
        base = 8
    else:
        base = 4

    # 努力程度调整：LOW effort = 更好
    if diff_effort == "LOW":
        return min(base + 1, 15)
    elif diff_effort == "HIGH":
        return max(base - 2, 0)
    return base


def _score_timing(window_of_opportunity: str) -> int:
    """时机评分（0-10）。"""
    mapping = {"BEST": 10, "GOOD": 7, "CLOSING": 4, "CLOSED": 1}
    return mapping.get(window_of_opportunity, 4)


def _score_risk(go_no_go: str, high_risk_count: int = 0) -> int:
    """风险扣分（0-10）。"""
    base_penalties = {
        "GO": 0,
        "CONDITIONAL_GO": 3,
        "WAIT_AND_SEE": 5,
        "NO_GO": 8,
    }
    penalty = base_penalties.get(go_no_go, 5)
    # 每个高风险+1，上限10
    penalty = min(penalty + high_risk_count, 10)
    return penalty


def _recommend_level(total: int) -> str:
    """根据总分判定推荐等级。"""
    if total >= 80:
        return "STRONGLY_RECOMMEND"
    elif total >= 60:
        return "RECOMMEND"
    elif total >= 40:
        return "WATCH"
    else:
        return "AVOID"


def calculate_opportunity_score(
    archetype: str = "BASIC",
    lifecycle_stage: str = "MATURITY_STABLE",
    units_growth_rate: float = 0,
    total_units: int = 0,
    typical_margin: float = 0,
    cr3: float = 0,
    entry_barrier: str = "",
    brand_count: int = 0,
    diff_strategies_count: int = 0,
    diff_effort: str = "MEDIUM",
    window_of_opportunity: str = "CLOSING",
    go_no_go: str = "WAIT_AND_SEE",
    high_risk_count: int = 0,
) -> ScoreBreakdown:
    """计算机会评分（L1层6维，按原型权重加权）。

    评分逻辑:
    1. 各维度先算原始分（0-维度满分）
    2. 归一化到 0-1
    3. 乘以原型权重（AGENT_SCORE_WEIGHTS）
    4. 加总 = 最终分（0-100）

    Args:
        archetype:             品类原型 DA/FH/FP/TN/PE/PS/BASIC
        lifecycle_stage:       生命周期阶段
        units_growth_rate:     销量增速百分比
        total_units:           品类总销量（市场容量）
        typical_margin:        典型利润率百分比
        cr3:                   CR3竞争集中度（0-1）
        entry_barrier:         进入壁垒（LOW/MEDIUM/HIGH/VERY_HIGH）
        brand_count:           唯一品牌数（市场粒度修正）
        diff_strategies_count: 差异化策略数量
        diff_effort:           差异化努力程度（LOW/MEDIUM/HIGH）
        window_of_opportunity: 切入窗口（BEST/GOOD/CLOSING/CLOSED）
        go_no_go:              Go/NoGo判断
        high_risk_count:       高风险项数量

    Returns:
        ScoreBreakdown
    """
    # ── Step 1: 各维度原始分 ──
    demand_raw = _score_demand(lifecycle_stage, units_growth_rate, total_units=total_units)
    profitability_raw = _score_profitability(typical_margin)
    competition_raw = _score_competition(cr3, entry_barrier, brand_count=brand_count)
    differentiation_raw = _score_differentiation(diff_strategies_count, diff_effort)
    timing_raw = _score_timing(window_of_opportunity)
    risk_raw = _score_risk(go_no_go, high_risk_count)

    # ── Step 2: 归一化到 0-1（除以维度满分） ──
    dims_max = SCORE_DIMENSIONS
    demand_norm = demand_raw / dims_max["demand"] if dims_max["demand"] else 0
    profitability_norm = profitability_raw / dims_max["profitability"] if dims_max["profitability"] else 0
    competition_norm = competition_raw / dims_max["competition"] if dims_max["competition"] else 0
    differentiation_norm = differentiation_raw / dims_max["differentiation"] if dims_max["differentiation"] else 0
    timing_norm = timing_raw / dims_max["timing"] if dims_max["timing"] else 0
    risk_norm = risk_raw / dims_max["riskPenalty"] if dims_max["riskPenalty"] else 0

    # ── Step 3: 乘以原型权重 ──
    weights = AGENT_SCORE_WEIGHTS.get(archetype, AGENT_SCORE_WEIGHTS["BASIC"])
    demand = round(demand_norm * weights["demand"])
    profitability = round(profitability_norm * weights["profitability"])
    competition = round(competition_norm * weights["competition"])
    differentiation = round(differentiation_norm * weights["differentiation"])
    timing = round(timing_norm * weights["timing"])
    risk = round(risk_norm * weights["riskPenalty"])

    # ── Step 4: 加总 ──
    total = demand + profitability + competition + differentiation + timing - risk
    total = max(0, min(total, 100))  # 夹到 0-100

    level = _recommend_level(total)

    logger.info(f"[scorer] archetype={archetype}, total={total}, level={level}, "
                f"d={demand}/p={profitability}/c={competition}/"
                f"diff={differentiation}/t={timing}/r={risk}")

    return ScoreBreakdown(
        demand=demand,
        profitability=profitability,
        competition=competition,
        differentiation=differentiation,
        timing=timing,
        risk_penalty=risk,
        total=total,
        recommend_level=level,
    )
