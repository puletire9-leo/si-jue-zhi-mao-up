"""品类健康度评估 — 基于基线数据的品类整体质量评估。

从 Java 后端获取品类基线数据，评估品类的综合健康度。
健康度影响选品推荐的置信度和风险等级。

健康度维度:
1. 市场活力（增速+产品数量）
2. 竞争质量（CR3+品牌分散度）
3. 利润空间（平均利润率）
4. 消费者满意度（平均评分）

公开函数:
    assess_category_health
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class HealthIndicator:
    """单项健康指标。"""
    name: str
    value: float           # 原始值
    score: int             # 评分 0-100
    status: str            # HEALTHY/WARNING/CRITICAL
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CategoryHealthResult:
    """品类健康度评估结果。"""
    category_label: str
    marketplace: str
    overall_score: int            # 综合健康分 0-100
    overall_status: str           # HEALTHY/WARNING/CRITICAL
    indicators: Dict[str, HealthIndicator]
    confidence: float             # 置信度
    has_baseline: bool            # 是否有基线数据
    baseline_month: Optional[str] # 基线月份
    sample_size: Optional[int]    # 基线样本量

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["indicators"] = {k: v.to_dict() for k, v in self.indicators.items()}
        return d


def _score_vitality(avg_growth_rate: float, total_products: int) -> HealthIndicator:
    """市场活力评分。

    高增速+适度产品数量 = 健康活力。
    """
    # 增速评分
    if avg_growth_rate > 30:
        growth_score = 90
        growth_status = "HEALTHY"
        growth_desc = f"品类增速{avg_growth_rate:.1f}%，市场活跃"
    elif avg_growth_rate > 10:
        growth_score = 70
        growth_status = "HEALTHY"
        growth_desc = f"品类增速{avg_growth_rate:.1f}%，稳步增长"
    elif avg_growth_rate > 0:
        growth_score = 50
        growth_status = "WARNING"
        growth_desc = f"品类增速{avg_growth_rate:.1f}%，增长放缓"
    elif avg_growth_rate > -15:
        growth_score = 30
        growth_status = "WARNING"
        growth_desc = f"品类增速{avg_growth_rate:.1f}%，轻微下滑"
    else:
        growth_score = 10
        growth_status = "CRITICAL"
        growth_desc = f"品类增速{avg_growth_rate:.1f}%，严重下滑"

    # 产品数量修正（过多=饱和，过少=不成熟）
    if total_products > 500:
        growth_score = max(growth_score - 10, 0)
        growth_desc += "，但SKU过多可能饱和"
    elif total_products < 30:
        growth_score = max(growth_score - 15, 0)
        growth_desc += "，但样本量不足"

    return HealthIndicator(
        name="vitality",
        value=avg_growth_rate,
        score=growth_score,
        status=growth_status,
        description=growth_desc,
    )


def _score_competition_quality(avg_cr3: float) -> HealthIndicator:
    """竞争质量评分。

    适度分散（CR3 0.3-0.6）= 最佳竞争环境。
    """
    if avg_cr3 < 0.2:
        score = 60
        status = "WARNING"
        desc = f"CR3={avg_cr3:.2f}，市场极度分散，可能缺乏明确需求"
    elif avg_cr3 < 0.4:
        score = 90
        status = "HEALTHY"
        desc = f"CR3={avg_cr3:.2f}，竞争格局健康，有进入空间"
    elif avg_cr3 < 0.6:
        score = 75
        status = "HEALTHY"
        desc = f"CR3={avg_cr3:.2f}，适度集中，需差异化切入"
    elif avg_cr3 < 0.8:
        score = 45
        status = "WARNING"
        desc = f"CR3={avg_cr3:.2f}，集中度较高，进入壁垒中等"
    else:
        score = 15
        status = "CRITICAL"
        desc = f"CR3={avg_cr3:.2f}，寡头/垄断格局，进入困难"

    return HealthIndicator(
        name="competition_quality",
        value=avg_cr3,
        score=score,
        status=status,
        description=desc,
    )


def _score_profit_potential(avg_margin: float) -> HealthIndicator:
    """利润潜力评分。"""
    if avg_margin >= 40:
        score = 90
        status = "HEALTHY"
        desc = f"平均利润率{avg_margin:.1f}%，利润空间充足"
    elif avg_margin >= 30:
        score = 75
        status = "HEALTHY"
        desc = f"平均利润率{avg_margin:.1f}%，利润空间良好"
    elif avg_margin >= 20:
        score = 55
        status = "WARNING"
        desc = f"平均利润率{avg_margin:.1f}%，利润空间一般"
    elif avg_margin >= 10:
        score = 30
        status = "WARNING"
        desc = f"平均利润率{avg_margin:.1f}%，利润空间紧张"
    else:
        score = 10
        status = "CRITICAL"
        desc = f"平均利润率{avg_margin:.1f}%，几乎无利润空间"

    return HealthIndicator(
        name="profit_potential",
        value=avg_margin,
        score=score,
        status=status,
        description=desc,
    )


def _score_consumer_satisfaction(avg_rating: float) -> HealthIndicator:
    """消费者满意度评分。

    高评分 = 产品质量好 = 新品有参考标准。
    """
    if avg_rating >= 4.3:
        score = 85
        status = "HEALTHY"
        desc = f"平均评分{avg_rating:.1f}，消费者满意度高"
    elif avg_rating >= 4.0:
        score = 70
        status = "HEALTHY"
        desc = f"平均评分{avg_rating:.1f}，消费者满意度良好"
    elif avg_rating >= 3.5:
        score = 50
        status = "WARNING"
        desc = f"平均评分{avg_rating:.1f}，产品质量有提升空间"
    elif avg_rating >= 3.0:
        score = 30
        status = "WARNING"
        desc = f"平均评分{avg_rating:.1f}，产品质量一般"
    else:
        score = 10
        status = "CRITICAL"
        desc = f"平均评分{avg_rating:.1f}，产品质量问题严重"

    return HealthIndicator(
        name="consumer_satisfaction",
        value=avg_rating,
        score=score,
        status=status,
        description=desc,
    )


def assess_category_health(
    category_label: str = "",
    marketplace: str = "UK",
    avg_growth_rate: float = 0,
    avg_cr3: float = 0,
    avg_margin: float = 0,
    avg_rating: float = 0,
    total_products: int = 0,
    has_baseline: bool = False,
    baseline_month: Optional[str] = None,
    sample_size: Optional[int] = None,
) -> CategoryHealthResult:
    """评估品类健康度。

    Args:
        category_label:   品类名称
        marketplace:      站点
        avg_growth_rate:  品类平均增速（%）
        avg_cr3:          品类平均CR3
        avg_margin:       品类平均利润率（%）
        avg_rating:       品类平均评分（1-5）
        total_products:   品类总产品数
        has_baseline:     是否有基线数据
        baseline_month:   基线月份
        sample_size:      基线样本量

    Returns:
        CategoryHealthResult
    """
    # 计算各维度健康指标
    indicators = {
        "vitality": _score_vitality(avg_growth_rate, total_products),
        "competition_quality": _score_competition_quality(avg_cr3),
        "profit_potential": _score_profit_potential(avg_margin),
        "consumer_satisfaction": _score_consumer_satisfaction(avg_rating),
    }

    # 综合健康分（加权平均）
    weights = {
        "vitality": 30,
        "competition_quality": 25,
        "profit_potential": 25,
        "consumer_satisfaction": 20,
    }

    total_weight = sum(weights.values())
    weighted_sum = sum(
        indicators[k].score * weights[k] for k in weights if k in indicators
    )
    overall_score = int(weighted_sum / total_weight) if total_weight > 0 else 50

    # 综合状态
    critical_count = sum(1 for ind in indicators.values() if ind.status == "CRITICAL")
    warning_count = sum(1 for ind in indicators.values() if ind.status == "WARNING")

    if critical_count >= 2:
        overall_status = "CRITICAL"
    elif critical_count >= 1 or warning_count >= 3:
        overall_status = "WARNING"
    else:
        overall_status = "HEALTHY"

    # 置信度（有基线数据时更高）
    confidence = 0.85 if has_baseline else 0.60
    if total_products < 30:
        confidence *= 0.8  # 样本量不足降低置信度

    logger.info(f"[category_health] {category_label}: score={overall_score}, "
                f"status={overall_status}, confidence={confidence:.2f}")

    return CategoryHealthResult(
        category_label=category_label,
        marketplace=marketplace,
        overall_score=overall_score,
        overall_status=overall_status,
        indicators=indicators,
        confidence=round(confidence, 2),
        has_baseline=has_baseline,
        baseline_month=baseline_month,
        sample_size=sample_size,
    )
