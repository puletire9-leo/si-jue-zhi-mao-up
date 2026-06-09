"""L2 品类专属8维评分 — 按原型权重加权，纯函数。

来自 08-品类专属评分模型.md §3.1:
- 8个维度: size/volume/profit/emotion/decor/fission/culture/market
- 每个原型有独立的权重配置（总和100%）
- 权重<5%的维度跳过LLM评分，赋默认50分

公开函数:
    calculate_l2_score
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

from selection.algorithms.constants import ARCHETYPE_WEIGHTS, ARCHETYPE_SKIP_DIMS

logger = logging.getLogger(__name__)


# ═══ 软维度原型倾向分（LLM 缺失时的确定性推算基准） ═══
# 基于品类原型的固有情感/装饰/裂变/文化属性倾向，
# 来源：08-品类专属评分模型 §4.4 情绪价值变体 + 原型定义
_ARCHETYPE_SOFT_DIMS: Dict[str, Dict[str, int]] = {
    "DA": {"emotion": 70, "decor": 85, "fission": 55, "culture": 40},  # 装饰/艺术
    "FH": {"emotion": 35, "decor": 30, "fission": 30, "culture": 35},  # 功能/家居
    "FP": {"emotion": 70, "decor": 50, "fission": 55, "culture": 50},  # 时尚/个人
    "TN": {"emotion": 55, "decor": 35, "fission": 50, "culture": 40},  # 科技/新奇
    "PE": {"emotion": 80, "decor": 65, "fission": 55, "culture": 70},  # 派对/节日
    "PS": {"emotion": 50, "decor": 30, "fission": 65, "culture": 40},  # 宠物/运动
    "BASIC": {"emotion": 50, "decor": 50, "fission": 50, "culture": 50},
    "UNKNOWN": {"emotion": 50, "decor": 50, "fission": 50, "culture": 50},
}


@dataclass
class L2DimensionScore:
    """单维度评分。"""
    name: str
    raw_score: int          # 原始分 0-100
    weight: int             # 权重 %
    weighted_score: float   # 加权分 = raw_score * weight / 100
    source: str             # "algorithm" / "llm" / "default"


@dataclass
class L2ScoreBreakdown:
    """L2 评分分项明细。"""
    archetype: str
    dimensions: Dict[str, L2DimensionScore]
    total: float            # 加权总分 0-100
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["dimensions"] = {k: asdict(v) for k, v in self.dimensions.items()}
        return d


def _score_size(shipping_profile: str = "", weight_category: str = "") -> int:
    """体积友好性评分（0-100）。

    小体积=高分（FBA成本低、头程便宜、退货率低）。
    """
    if weight_category:
        mapping = {
            "VERY_LIGHT": 95,    # <500g
            "LIGHT_SMALL": 80,   # 500g-2kg
            "MEDIUM": 50,        # 2-10kg
            "HEAVY": 20,         # >10kg
        }
        return mapping.get(weight_category, 50)

    # 从 shipping_profile 推断
    if shipping_profile:
        sp = shipping_profile.upper()
        if "VERY_LIGHT" in sp or "LIGHT" in sp:
            return 80
        elif "MEDIUM" in sp:
            return 50
        elif "HEAVY" in sp:
            return 20

    return 50  # 默认


def _score_volume(total_units: int = 0, units_growth_rate: float = 0) -> int:
    """销量/市场容量评分（0-100）。

    高销量+高增速=高分。
    """
    # 基础分（基于总销量）
    if total_units >= 50000:
        base = 80
    elif total_units >= 20000:
        base = 65
    elif total_units >= 5000:
        base = 50
    elif total_units >= 1000:
        base = 35
    elif total_units > 0:
        base = 20
    else:
        base = 30  # 无数据，保守估计

    # 增速加成
    if units_growth_rate > 30:
        bonus = 20
    elif units_growth_rate > 15:
        bonus = 10
    elif units_growth_rate > 0:
        bonus = 5
    elif units_growth_rate > -15:
        bonus = 0
    else:
        bonus = -10  # 负增长扣分

    return max(0, min(100, base + bonus))


def _score_profit(typical_margin: float = 0) -> int:
    """利润率评分（0-100）。"""
    if typical_margin >= 50:
        return 95
    elif typical_margin >= 40:
        return 85
    elif typical_margin >= 30:
        return 70
    elif typical_margin >= 20:
        return 55
    elif typical_margin >= 15:
        return 40
    elif typical_margin >= 10:
        return 25
    elif typical_margin > 0:
        return 15
    else:
        return 10  # 无数据或负利润


def _score_market(
    cr3: float = 0,
    units_growth_rate: float = 0,
    lifecycle_stage: str = "",
    entry_barrier: str = "",
) -> int:
    """市场指标综合评分（0-100）。

    分散市场+高增速+早期生命周期=高分。
    """
    # CR3 部分（越低越好）
    if cr3 < 0.3:
        cr3_score = 90
    elif cr3 < 0.5:
        cr3_score = 70
    elif cr3 < 0.7:
        cr3_score = 50
    elif cr3 < 0.85:
        cr3_score = 30
    else:
        cr3_score = 10

    # 生命周期部分
    lifecycle_scores = {
        "EMERGING": 90,
        "GROWTH": 75,
        "MATURITY_STABLE": 50,
        "MATURITY_WITH_DECLINE": 35,
        "SATURATION": 20,
        "DECLINE": 10,
    }
    lc_score = lifecycle_scores.get(lifecycle_stage, 40)

    # 进入壁垒部分（越低越好）
    barrier_scores = {
        "LOW": 85,
        "MEDIUM": 60,
        "HIGH": 35,
        "VERY_HIGH": 15,
    }
    barrier_score = barrier_scores.get(entry_barrier, 50)

    # 加权平均（CR3 40%, 生命周期 35%, 壁垒 25%）
    return int(cr3_score * 0.4 + lc_score * 0.35 + barrier_score * 0.25)


def _estimate_soft_dimensions(
    archetype: str,
    avg_price: float = 0,
    review_count: int = 0,
    brand_count: int = 0,
) -> Dict[str, int]:
    """基于原型+数据推算4个软维度分数，替代硬编码默认值50。

    推算策略：
    1. 原型倾向分（主信号）：每个原型有固有的 emotion/decor/fission/culture 倾向
    2. 价格区间修正（辅助，±10）：高客单价(>30£)→emotion↑(礼物属性)；低客单价(<10£)→fission↑(易分享)
    3. 评论密度修正（辅助，±5）：高评论量(>500)→fission↑(社交传播)；低评论(<50)→fission↓
    4. 品牌集中度修正（辅助，±5）：品牌多(>20)→culture↑(亚文化丰富)；品牌少(<5)→decor↓(标准化)
    """
    # Step 1: 原型基准分
    base = _ARCHETYPE_SOFT_DIMS.get(archetype, _ARCHETYPE_SOFT_DIMS["UNKNOWN"])
    scores = dict(base)  # copy

    # Step 2: 价格区间修正（±10）
    if avg_price > 30:
        scores["emotion"] = min(100, scores["emotion"] + 10)   # 高价→礼物属性↑
    elif avg_price < 10 and avg_price > 0:
        scores["fission"] = min(100, scores["fission"] + 10)   # 低价→易分享↑

    # Step 3: 评论密度修正（±5）
    if review_count > 500:
        scores["fission"] = min(100, scores["fission"] + 5)    # 高评论→社交传播↑
    elif review_count < 50 and review_count > 0:
        scores["fission"] = max(0, scores["fission"] - 5)      # 低评论→社交传播↓

    # Step 4: 品牌集中度修正（±5）
    if brand_count > 20:
        scores["culture"] = min(100, scores["culture"] + 5)    # 品牌多→亚文化丰富↑
    elif brand_count < 5 and brand_count > 0:
        scores["decor"] = max(0, scores["decor"] - 5)          # 品牌少→标准化↓

    # clamp 0-100
    return {k: max(0, min(100, v)) for k, v in scores.items()}


def _get_effective_weights(archetype: str) -> Dict[str, int]:
    """获取品类的有效评分权重。

    优先读取 WeightStore 中已审批的校准权重，
    否则回退到 ARCHETYPE_WEIGHTS 静态默认值。

    这是决策反馈闭环的关键环节：
    已校准的原型使用数据驱动的优化权重，未校准的保持原始权重。

    Args:
        archetype: 品类原型 DA/FH/FP/...

    Returns:
        权重 dict {"size": 10, "volume": 15, ...}
    """
    try:
        from selection.storage.weight_store import get_weight_store
        store = get_weight_store()
        approved = store.get_approved_weights(archetype)
        if approved:
            logger.debug(f"[l2_scorer] 使用校准权重: {archetype} {approved}")
            return approved
    except Exception as e:
        logger.debug(f"[l2_scorer] 读取校准权重失败，回退默认: {e}")

    return ARCHETYPE_WEIGHTS.get(archetype, ARCHETYPE_WEIGHTS["BASIC"])


def calculate_l2_score(
    archetype: str = "UNKNOWN",
    shipping_profile: str = "",
    weight_category: str = "",
    total_units: int = 0,
    units_growth_rate: float = 0,
    typical_margin: float = 0,
    cr3: float = 0,
    lifecycle_stage: str = "",
    entry_barrier: str = "",
    emotion_score: Optional[int] = None,
    decor_score: Optional[int] = None,
    fission_score: Optional[int] = None,
    culture_score: Optional[int] = None,
    avg_price: float = 0,
    review_count: int = 0,
    brand_count: int = 0,
) -> L2ScoreBreakdown:
    """计算 L2 品类专属8维评分。

    Args:
        archetype:          品类原型 DA/FH/FP/TN/PE/PS/BASIC
        shipping_profile:   运输类型（推断体积）
        weight_category:    重量类别 VERY_LIGHT/LIGHT_SMALL/MEDIUM/HEAVY
        total_units:        品类总销量
        units_growth_rate:  销量增速百分比
        typical_margin:     典型利润率百分比
        cr3:                CR3竞争集中度（0-1）
        lifecycle_stage:    生命周期阶段
        entry_barrier:      进入壁垒 LOW/MEDIUM/HIGH/VERY_HIGH
        emotion_score:      LLM情绪价值评分（0-100），None=算法推算
        decor_score:        LLM装饰性评分（0-100），None=算法推算
        fission_score:      LLM裂变潜力评分（0-100），None=算法推算
        culture_score:      LLM文化适应性评分（0-100），None=算法推算
        avg_price:          品类平均价格（软维度推算辅助）
        review_count:       品类平均评论数（软维度推算辅助）
        brand_count:        品类品牌数量（软维度推算辅助）

    Returns:
        L2ScoreBreakdown
    """
    weights = _get_effective_weights(archetype)
    skip_dims = ARCHETYPE_SKIP_DIMS.get(archetype, [])

    # 计算各维度原始分
    raw_scores = {
        "size": _score_size(shipping_profile, weight_category),
        "volume": _score_volume(total_units, units_growth_rate),
        "profit": _score_profit(typical_margin),
        "market": _score_market(cr3, units_growth_rate, lifecycle_stage, entry_barrier),
    }

    # LLM 维度：优先用 LLM 评分，否则用确定性推算（基于原型+品类数据）
    estimated_dims = _estimate_soft_dimensions(archetype, avg_price, review_count, brand_count)
    llm_input = {
        "emotion": emotion_score,
        "decor": decor_score,
        "fission": fission_score,
        "culture": culture_score,
    }
    llm_scores = {
        k: v if v is not None else estimated_dims[k] for k, v in llm_input.items()
    }
    raw_scores.update(llm_scores)

    # 构建维度明细
    dimensions = {}
    total = 0.0

    for dim_name in ["size", "volume", "profit", "emotion", "decor", "fission", "culture", "market"]:
        raw = raw_scores.get(dim_name, 50)
        weight = weights.get(dim_name, 0)

        # 来源标记（根据参数是否为 None 判定，而非值是否等于默认值）
        if dim_name in ("emotion", "decor", "fission", "culture"):
            if dim_name in skip_dims:
                # 跳过维度强制用默认分（权重<5%，不值得调LLM）
                source = "default"
                raw = 50
            else:
                source = "llm" if llm_input.get(dim_name) is not None else "estimated"
        else:
            source = "algorithm"

        weighted = round(raw * weight / 100, 2)

        dimensions[dim_name] = L2DimensionScore(
            name=dim_name,
            raw_score=raw,
            weight=weight,
            weighted_score=weighted,
            source=source,
        )
        total += weighted

    total = round(total, 2)

    # 置信度：算法维度100%，LLM维度有数据时80%，算法推算时70%
    has_llm_scores = any(
        s is not None for s in [emotion_score, decor_score, fission_score, culture_score]
    )
    # 跳过维度越多，置信度越低（因为默认分占比高）
    skip_ratio = len(skip_dims) / 8.0
    confidence = 0.85 if has_llm_scores else (0.70 - skip_ratio * 0.15)
    confidence = round(max(0.50, min(0.95, confidence)), 2)

    logger.info(f"[l2_scorer] archetype={archetype}, total={total:.1f}, "
                f"confidence={confidence:.2f}, skip_dims={skip_dims}")

    return L2ScoreBreakdown(
        archetype=archetype,
        dimensions=dimensions,
        total=total,
        confidence=confidence,
    )
