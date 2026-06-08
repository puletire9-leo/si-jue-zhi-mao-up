"""生命周期信号检测器 — 4信号×6阶段，纯函数，不依赖LLM/网络。

4个信号维度：
- Speed(速度): 销量增速方向和幅度
- Density(密度): SKU/卖家集中度
- Follow(关注): 多店铺进入=积极信号
- Quality(质量): 评分和评论成熟度

6个阶段（按优先级判定）：
DECLINE → SATURATION → EMERGING → GROWTH → MATURE_DECLINE → MATURE_STABLE

公开函数:
    detect_lifecycle
"""

import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import LIFECYCLE_THRESHOLDS, SIGNAL_THRESHOLDS

logger = logging.getLogger(__name__)


@dataclass
class Signal:
    """单个信号。"""
    name: str
    value: float
    direction: str   # UP / DOWN / FLAT
    urgency: str     # HIGH / MEDIUM / LOW


@dataclass
class LifecycleResult:
    """生命周期检测结果。"""
    stage: str                    # 6阶段之一
    stage_reason: str             # 判定依据
    signals: List[Signal]         # 4信号详情
    window_of_opportunity: str    # BEST / GOOD / CLOSING / CLOSED
    confidence: float             # 0.0-1.0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


def _compute_signals(
    units_growth_rate: float,
    cr3: float,
    avg_ratings: float,
    avg_rating: float,
    product_count: int,
    bsr_change_rate: float,
    listing_days: int = 0,
) -> List[Signal]:
    """计算4个信号维度。listing_days为品类平均上架天数，用于新兴信号确认。"""
    signals = []

    # 1. Speed(速度信号) — 销量增速
    growth_abs = abs(units_growth_rate)
    if units_growth_rate > 10:
        speed_dir = "UP"
        # listing_days短+增速快 → 紧急度更早提升到HIGH（降低阈值）
        if 0 < listing_days <= 60 and growth_abs > 15:
            speed_urgency = "HIGH"
        else:
            speed_urgency = "HIGH" if growth_abs > 30 else "MEDIUM"
    elif units_growth_rate < -10:
        speed_dir = "DOWN"
        speed_urgency = "HIGH" if growth_abs > 20 else "MEDIUM"
    else:
        speed_dir = "FLAT"
        speed_urgency = "LOW"

    signals.append(Signal(
        name="Speed", value=round(units_growth_rate, 2),
        direction=speed_dir, urgency=speed_urgency,
    ))

    # 2. Density(密度信号) — 产品数量和CR3集中度
    density_t = SIGNAL_THRESHOLDS["density"]
    if product_count > density_t["high_product_count"]:
        density_dir = "UP"
        density_urgency = "HIGH" if product_count > density_t["very_high_product_count"] else "MEDIUM"
    elif product_count < density_t["low_product_count"]:
        density_dir = "DOWN"
        density_urgency = "MEDIUM"
    else:
        density_dir = "FLAT"
        density_urgency = "LOW"

    signals.append(Signal(
        name="Density", value=round(cr3, 4),
        direction=density_dir, urgency=density_urgency,
    ))

    # 3. Follow(关注信号) — BSR变化率（负=更多关注）
    follow_t = SIGNAL_THRESHOLDS["follow"]
    if bsr_change_rate < follow_t["bsr_change_high"]:
        follow_dir = "UP"
        follow_urgency = "HIGH" if bsr_change_rate < follow_t["bsr_change_very_high"] else "MEDIUM"
    elif bsr_change_rate > follow_t["bsr_change_decline"]:
        follow_dir = "DOWN"
        follow_urgency = "MEDIUM"
    else:
        follow_dir = "FLAT"
        follow_urgency = "LOW"

    signals.append(Signal(
        name="Follow", value=round(bsr_change_rate, 2),
        direction=follow_dir, urgency=follow_urgency,
    ))

    # 4. Quality(质量壁垒信号) — 评论数=新品切入的壁垒高度
    # 评论越多 = 头部卖家壁垒越高 = 对新品越不利
    quality_t = SIGNAL_THRESHOLDS["quality"]
    if avg_ratings > quality_t["high_avg_ratings"]:
        quality_dir = "DOWN"      # 壁垒高 → 对新品不利
        quality_urgency = "HIGH" if avg_ratings > quality_t["very_high_avg_ratings"] else "MEDIUM"
    elif avg_ratings < quality_t["low_avg_ratings"]:
        quality_dir = "UP"        # 壁垒低 → 对新品有利
        quality_urgency = "MEDIUM"
    else:
        quality_dir = "FLAT"
        quality_urgency = "LOW"

    signals.append(Signal(
        name="Quality", value=round(avg_ratings, 0),
        direction=quality_dir, urgency=quality_urgency,
    ))

    return signals


def _classify_stage(
    units_growth_rate: float,
    cr3: float,
    avg_ratings: float,
    listing_days: int = 0,
) -> tuple:
    """按优先级判定6阶段。listing_days用于EMERGING阶段的辅助确认。返回 (stage, reason)。"""
    g = units_growth_rate

    # Priority 1: DECLINE — 增速 < -30%
    if g <= LIFECYCLE_THRESHOLDS["DECLINE"]["unitsGrowthRate_max"]:
        return "DECLINE", f"销量增速{g}%严重下滑(<-30%)，品类进入衰退期"

    # Priority 2: SATURATION — 增速 < -20% 且 CR3 > 0.8
    if (g <= LIFECYCLE_THRESHOLDS["SATURATION"]["unitsGrowthRate_max"]
            and cr3 >= LIFECYCLE_THRESHOLDS["SATURATION"].get("cr3_min", 0.8)):
        return "SATURATION", f"增速{g}%下滑且CR3={cr3:.2f}>0.8，市场饱和"

    # Priority 3: EMERGING — 增速 > 30% 且评论 < 50
    if (g >= LIFECYCLE_THRESHOLDS["EMERGING"]["unitsGrowthRate_min"]
            and avg_ratings <= LIFECYCLE_THRESHOLDS["EMERGING"].get("avgRatings_max", 50)):
        reason = f"增速{g}%爆发且评论仅{avg_ratings:.0f}条，新兴品类信号"
        if 0 < listing_days <= 60:
            reason += f"，上架仅{listing_days}天，新兴强信号"
        return "EMERGING", reason

    # Priority 4: GROWTH — 增速 > 10%
    if g >= LIFECYCLE_THRESHOLDS["GROWTH"]["unitsGrowthRate_min"]:
        return "GROWTH", f"增速{g}%稳健增长，品类处于成长期"

    # Priority 5: MATURE_DECLINE — 增速 -20% ~ -10%
    if (g >= LIFECYCLE_THRESHOLDS["MATURITY_WITH_DECLINE"]["unitsGrowthRate_min"]
            and g < LIFECYCLE_THRESHOLDS["MATURITY_WITH_DECLINE"]["unitsGrowthRate_max"]):
        return "MATURITY_WITH_DECLINE", f"增速{g}%温和下滑，成熟期进入衰退"

    # Default: MATURITY_STABLE — 增速 -10% ~ +10%
    return "MATURITY_STABLE", f"增速{g}%波动在±10%以内，成熟稳定期"


def _window_of_opportunity(stage: str) -> str:
    """根据生命周期阶段推断切入窗口。"""
    mapping = {
        "EMERGING": "BEST",
        "GROWTH": "GOOD",
        "MATURITY_STABLE": "CLOSING",
        "MATURITY_WITH_DECLINE": "CLOSING",
        "SATURATION": "CLOSED",
        "DECLINE": "CLOSED",
    }
    return mapping.get(stage, "CLOSING")


def _confidence(stage: str, signal_count_high: int) -> float:
    """置信度计算：HIGH紧急度信号越多，置信度越高。"""
    base = {"EMERGING": 0.75, "GROWTH": 0.80, "MATURITY_STABLE": 0.85,
            "MATURITY_WITH_DECLINE": 0.75, "SATURATION": 0.80, "DECLINE": 0.85}
    c = base.get(stage, 0.70)
    # 每个HIGH信号加0.05，上限0.95
    bonus = min(signal_count_high * 0.05, 0.15)
    return min(c + bonus, 0.95)


def detect_lifecycle(
    units_growth_rate: float = 0,
    cr3: float = 0,
    avg_ratings: float = 0,
    avg_rating: float = 0,
    product_count: int = 0,
    bsr_change_rate: float = 0,
    listing_days: int = 0,
) -> LifecycleResult:
    """检测品类生命周期阶段。

    Args:
        units_growth_rate: 销量增速百分比（如 15.0 表示+15%）
        cr3:               CR3竞争集中度（0-1）
        avg_ratings:       平均评论数
        avg_rating:        平均评分（1-5）
        product_count:     品类商品总数
        bsr_change_rate:   BSR变化率（负=改善）
        listing_days:      品类平均上架天数（0=未知，<60天=新兴信号）

    Returns:
        LifecycleResult
    """
    # 计算4信号
    signals = _compute_signals(
        units_growth_rate, cr3, avg_ratings, avg_rating, product_count, bsr_change_rate,
        listing_days=listing_days,
    )

    # 判定阶段
    stage, reason = _classify_stage(units_growth_rate, cr3, avg_ratings, listing_days=listing_days)

    # 切入窗口
    window = _window_of_opportunity(stage)

    # 置信度
    high_count = sum(1 for s in signals if s.urgency == "HIGH")
    conf = _confidence(stage, high_count)

    logger.info(f"[lifecycle] stage={stage}, window={window}, confidence={conf:.2f}")

    return LifecycleResult(
        stage=stage,
        stage_reason=reason,
        signals=signals,
        window_of_opportunity=window,
        confidence=round(conf, 2),
    )
