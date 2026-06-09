"""差异化切入点分析器 — 确定性算法层。

基于 doc 11《竞品差异化分析》设计，在 LLM 增强前先做：
- 价格带空白检测
- 进入难度评估
- 原型×切入角度适配推荐
- 策略候选排序

纯函数，无 LLM/网络依赖，可独立单测。
"""

import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import PRICE_BANDS, PRICE_BANDS_US

logger = logging.getLogger(__name__)

# ═══ 5种切入角度定义 ═══

STRATEGY_ANGLES = {
    "PRICE_GAP": "价格空白 — 进入竞争对手忽略的价格带",
    "OPERATIONAL_EXCELLENCE": "运营卓越 — 通过Listing/服务/物流体验胜出",
    "LOW_REVIEW_EXPLOIT": "低评快起 — 针对竞品低评分弱点推出更优产品",
    "VARIANT_DIFFERENTIATION": "变体差异化 — 提供竞品没有的变体组合",
    "WHITE_LABEL_REPLACE": "白牌替代 — 替代高价白牌/大牌",
}


# ═══ 原型×切入角度适配矩阵 ═══
# 每个原型有 preferred（首选）、secondary（次选）、avoid（回避）三种策略关系
# 得分: preferred=90, secondary=75, normal=50, avoided=20

_ARCHETYPE_STRATEGY_MATRIX: Dict[str, Dict[str, int]] = {
    "DA": {  # 装饰艺术型 — 图案裂变天然优势
        "VARIANT_DIFFERENTIATION": 90,
        "PRICE_GAP": 75,
        "LOW_REVIEW_EXPLOIT": 50,
        "WHITE_LABEL_REPLACE": 50,
        "OPERATIONAL_EXCELLENCE": 20,   # 装饰品运营不是核心
    },
    "FH": {  # 功能家居型 — 实用品靠运营
        "OPERATIONAL_EXCELLENCE": 90,
        "PRICE_GAP": 75,
        "LOW_REVIEW_EXPLOIT": 50,
        "VARIANT_DIFFERENTIATION": 50,
        "WHITE_LABEL_REPLACE": 20,       # 功能性白牌替代难
    },
    "FP": {  # 时尚个人型 — 风格评分敏感
        "LOW_REVIEW_EXPLOIT": 90,
        "VARIANT_DIFFERENTIATION": 75,
        "PRICE_GAP": 50,
        "OPERATIONAL_EXCELLENCE": 50,
        "WHITE_LABEL_REPLACE": 50,
    },
    "TN": {  # 趋势潮流型 — 热度驱动价格敏感
        "PRICE_GAP": 90,
        "VARIANT_DIFFERENTIATION": 75,
        "LOW_REVIEW_EXPLOIT": 50,
        "OPERATIONAL_EXCELLENCE": 50,
        "WHITE_LABEL_REPLACE": 20,       # 趋势品白牌替代窗口短
    },
    "PE": {  # 派对活动型 — 节日品牌溢价
        "WHITE_LABEL_REPLACE": 90,
        "PRICE_GAP": 75,
        "VARIANT_DIFFERENTIATION": 50,
        "LOW_REVIEW_EXPLOIT": 50,
        "OPERATIONAL_EXCELLENCE": 50,
    },
    "PS": {  # 纸品文具型 — 图案裂变
        "VARIANT_DIFFERENTIATION": 90,
        "PRICE_GAP": 75,
        "LOW_REVIEW_EXPLOIT": 50,
        "WHITE_LABEL_REPLACE": 50,
        "OPERATIONAL_EXCELLENCE": 20,    # 文具运营不是核心
    },
    "UNKNOWN": {  # 未识别原型 → 均等
        "PRICE_GAP": 70,
        "VARIANT_DIFFERENTIATION": 70,
        "LOW_REVIEW_EXPLOIT": 70,
        "OPERATIONAL_EXCELLENCE": 70,
        "WHITE_LABEL_REPLACE": 70,
    },
}


# ═══ 原型回避策略的友好解释 ═══

_ARCHETYPE_AVOID_REASONS: Dict[str, Dict[str, str]] = {
    "DA": {"OPERATIONAL_EXCELLENCE": "装饰品类消费者重图案轻运营，运营投入ROI低"},
    "FH": {"WHITE_LABEL_REPLACE": "功能性品类白牌替代依赖品牌信任建立"},
    "TN": {"WHITE_LABEL_REPLACE": "趋势品迭代快，白牌替代窗口期过短"},
    "PS": {"OPERATIONAL_EXCELLENCE": "文具品类运营差异化空间小"},
}


# ═══ Dataclass 定义 ═══


@dataclass
class StrategyCandidate:
    """策略候选 — 一个切入角度及其评分。"""
    angle: str
    angle_label: str          # 中文描述
    score: int                # 0-100
    fit_reason: str           # 适配该品类的理由

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DifferentiationAnalysis:
    """差异化分析结果。"""
    entry_difficulty: str                                      # EASY / MODERATE / HARD
    entry_difficulty_reason: str                               # 判定理由
    recommended_price_tier: Dict[str, Any]                     # {label, range, reason}
    price_gap_opportunities: List[Dict[str, Any]]              # 空白价格带列表
    strategy_candidates: List[StrategyCandidate]               # 策略候选（按得分降序）
    differentiation_score: int                                 # 0-100 综合差异化机会分
    archetype: str                                             # 镜像输入，便于前端展示

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entryDifficulty": self.entry_difficulty,
            "entryDifficultyReason": self.entry_difficulty_reason,
            "recommendedPriceTier": self.recommended_price_tier,
            "priceGapOpportunities": self.price_gap_opportunities,
            "strategyCandidates": [s.to_dict() for s in self.strategy_candidates],
            "differentiationScore": self.differentiation_score,
            "archetype": self.archetype,
        }


# ═══ 规则1: 进入难度判定 ═══


def _assess_entry_difficulty(
    cr3: float,
    lifecycle_stage: str,
    window: str,
    blue_ocean_class: str,
) -> tuple:
    """评估品类进入难度。

    Returns:
        (difficulty, reason)
    """
    reasons = []

    # CR3 基准判断
    if cr3 < 0.3 and lifecycle_stage in ("EMERGING", "GROWTH"):
        difficulty = "EASY"
        reasons.append(f"CR3={cr3:.0%}分散市场+{lifecycle_stage}阶段")
    elif cr3 < 0.6 and window in ("OPENING", "NOW"):
        difficulty = "MODERATE"
        reasons.append(f"CR3={cr3:.0%}适度集中，窗口期={window}")
    elif cr3 >= 0.8 or window == "CLOSING":
        difficulty = "HARD"
        if cr3 >= 0.8:
            reasons.append(f"CR3={cr3:.0%}高度集中")
        if window == "CLOSING":
            reasons.append("窗口期已关闭")
    else:
        difficulty = "MODERATE"
        reasons.append(f"CR3={cr3:.0%}，窗口={window}")

    # 蓝海/红海调整
    if blue_ocean_class in ("BLUE", "LIGHT"):
        difficulty = "EASY"
        reasons.append(f"蓝海信号={blue_ocean_class}（+1优惠）")
    elif blue_ocean_class == "RED":
        difficulty = "HARD"
        reasons.append(f"红海信号（+1惩罚）")

    return difficulty, "; ".join(reasons)


# ═══ 规则2: 推荐切入价格带 ═══


def _recommend_price_tier(
    price_band: Dict[str, Any],
    profit_margin: float,
    marketplace: str = "UK",
) -> Dict[str, Any]:
    """基于价格带空白检测推荐切入价格带。

    优先级：MID空白 > LOW空白(薄利) > PREMIUM空白(高利) > 均价所在档
    """
    bands = PRICE_BANDS_US if marketplace == "US" else PRICE_BANDS
    currency = {"UK": "\u00a3", "DE": "\u20ac", "US": "$"}.get(marketplace, "\u00a3")

    gap_opps = price_band.get("price_gaps", [])
    band_dist = price_band.get("band_distribution", [])
    dominant_band = price_band.get("dominant_band", "")

    # 构建空白带 map
    gap_map: Dict[str, Dict] = {}
    for g in gap_opps:
        gap_map[g["label"]] = g

    # 构建密度 map
    density_map: Dict[str, str] = {}
    for bd in band_dist:
        density_map[bd["label"]] = bd.get("density", "UNKNOWN")

    # 优先级1: MID 空白或稀疏
    if density_map.get("MID") in ("EMPTY", "SPARSE", "LOW"):
        return {
            "label": "MID",
            "range": f"{currency}7.99-9.99",
            "reason": "黄金价位有空白/稀疏，利润空间最大，优先切入",
        }

    # 优先级2: LOW 空白 + 薄利品类
    if density_map.get("LOW") in ("EMPTY", "SPARSE") and profit_margin < 30:
        return {
            "label": "LOW",
            "range": f"{currency}5.99-7.99",
            "reason": "低利润品类做低价带，薄利多销，控制成本",
        }

    # 优先级3: PREMIUM 空白 + 高利润
    if density_map.get("PREMIUM") in ("EMPTY", "SPARSE") and profit_margin >= 30:
        return {
            "label": "PREMIUM",
            "range": f"{currency}9.99-16.99",
            "reason": "高利润品类可做高端带，走高客单价路线",
        }

    # 优先级4: BUDGET 空白
    if density_map.get("BUDGET") in ("EMPTY", "SPARSE"):
        return {
            "label": "BUDGET",
            "range": f"{currency}4.99-5.99",
            "reason": "低价带空白，但利润最薄，需成本优势",
        }

    # 默认: 均价所在档同档切入
    default_band = next((b for b in bands if b["label"] == dominant_band), bands[1])
    return {
        "label": default_band["label"],
        "range": f"{currency}{default_band['min']:.2f}-{default_band['max']:.2f}",
        "reason": f"价格带已被覆盖，建议同档（{dominant_band}）差异化切入",
    }


# ═══ 规则3+4: 策略候选评分与排序 ═══


def _rank_strategies(
    archetype: str,
    price_band: Dict[str, Any],
    blue_ocean_class: str,
    difficulty: str,
) -> List[StrategyCandidate]:
    """基于原型适配、价格带空白、蓝海信号、难度惩罚计算策略得分并排序。"""
    matrix = _ARCHETYPE_STRATEGY_MATRIX.get(
        archetype, _ARCHETYPE_STRATEGY_MATRIX["UNKNOWN"]
    )

    # 检查哪些价格带有空白/稀疏
    gap_labels = {g["label"] for g in price_band.get("price_gaps", [])}
    band_dist = price_band.get("band_distribution", [])
    sparse_labels = {
        bd["label"]
        for bd in band_dist
        if bd.get("density") in ("LOW", "EMPTY", "SPARSE")
    }
    all_gap_labels = gap_labels | sparse_labels

    # 蓝海加分
    blue_ocean_bonus = {"BLUE": 10, "LIGHT": 5, "PURPLE": 0, "RED": -5}.get(
        blue_ocean_class, 0
    )

    # 难度惩罚
    difficulty_penalty = {"EASY": 0, "MODERATE": -5, "HARD": -15}.get(difficulty, -5)

    # 价格带空白加分（按档位价值）
    price_gap_bonus_per_angle: Dict[str, int] = {}
    for angle in matrix:
        bonus = 0
        if "MID" in all_gap_labels:
            bonus += 10  # 黄金价位空白最有价值
        elif "LOW" in all_gap_labels or "PREMIUM" in all_gap_labels:
            bonus += 5
        elif "BUDGET" in all_gap_labels:
            bonus += 3
        price_gap_bonus_per_angle[angle] = bonus

    candidates = []
    for angle, base_score in matrix.items():
        score = base_score + price_gap_bonus_per_angle.get(angle, 0) + blue_ocean_bonus + difficulty_penalty
        score = max(0, min(100, score))

        # 生成适配理由
        angle_desc = STRATEGY_ANGLES.get(angle, angle)
        avoid_reasons = _ARCHETYPE_AVOID_REASONS.get(archetype, {})
        if base_score >= 90:
            fit_reason = f"首选策略：{angle_desc}（原型={archetype}天然优势，基础分={base_score}）"
        elif base_score >= 75:
            fit_reason = f"次选策略：{angle_desc}（原型={archetype}较适配，基础分={base_score}）"
        elif angle in avoid_reasons:
            fit_reason = f"回避策略：{avoid_reasons[angle]}"
        else:
            fit_reason = f"备选策略：{angle_desc}（基础分={base_score}）"

        candidates.append(
            StrategyCandidate(
                angle=angle,
                angle_label=angle_desc,
                score=score,
                fit_reason=fit_reason,
            )
        )

    # 按得分降序
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# ═══ 公开函数 ═══


def effort_from_score(score: int) -> str:
    """根据策略得分推导实施难度。得分越高→难度越低。"""
    if score >= 70:
        return "LOW"
    if score >= 40:
        return "MEDIUM"
    return "HIGH"


def analyze_differentiation(
    price_band: Optional[Dict[str, Any]] = None,
    archetype: str = "UNKNOWN",
    lifecycle_stage: str = "",
    profit_margin: float = 0.0,
    blue_ocean: Optional[Dict[str, Any]] = None,
    cr3: float = 0.0,
    window: str = "CLOSING",
    marketplace: str = "UK",
) -> DifferentiationAnalysis:
    """确定性差异化分析 — 纯函数，无LLM/网络依赖。

    Args:
        price_band:      PriceBandResult.to_dict()，含 band_distribution + price_gaps
        archetype:       品类原型 DA/FH/FP/TN/PE/PS
        lifecycle_stage: 生命周期阶段 EMERGING/GROWTH/MATURITY_STABLE/SATURATION/DECLINE
        profit_margin:   典型利润率（百分比，如 35.0 表示 35%）
        blue_ocean:      蓝海雷达结果 {"classification": "BLUE", "score": 78}
        cr3:             CR3集中度（0.0-1.0）
        window:          机会窗口 OPENING/NOW/CLOSING/CLOSED
        marketplace:     站点 UK/DE/US

    Returns:
        DifferentiationAnalysis
    """
    if price_band is None:
        price_band = {}
    if blue_ocean is None:
        blue_ocean = {}

    bo_class = blue_ocean.get("classification", "")
    gap_opps = price_band.get("price_gaps", [])

    # 规则1: 进入难度
    difficulty, difficulty_reason = _assess_entry_difficulty(
        cr3, lifecycle_stage, window, bo_class,
    )

    # 规则2: 推荐切入价格带
    rec_tier = _recommend_price_tier(price_band, profit_margin, marketplace)

    # 规则3+4: 策略候选评分排序
    strategy_candidates = _rank_strategies(
        archetype, price_band, bo_class, difficulty,
    )

    # 综合差异化机会评分
    best_score = strategy_candidates[0].score if strategy_candidates else 50
    gap_bonus = min(20, len(gap_opps) * 5)
    differentiation_score = min(100, best_score + gap_bonus)

    logger.info(
        f"[diff_analyzer] archetype={archetype}, difficulty={difficulty}, "
        f"rec_tier={rec_tier['label']}, top_strategy={strategy_candidates[0].angle if strategy_candidates else 'N/A'}, "
        f"diff_score={differentiation_score}"
    )

    return DifferentiationAnalysis(
        entry_difficulty=difficulty,
        entry_difficulty_reason=difficulty_reason,
        recommended_price_tier=rec_tier,
        price_gap_opportunities=gap_opps,
        strategy_candidates=strategy_candidates,
        differentiation_score=differentiation_score,
        archetype=archetype,
    )
