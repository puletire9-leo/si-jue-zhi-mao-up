"""新品爆发信号检测器 — 确定性算法层。

基于 doc 12《新品爆发信号检测》§三 Phase 1 设计：
- 单品速度信号：BSR骤降 / 销量增速 / 评论增速
- 3级紧急度：🔴立即行动 / 🟡重点关注 / 🟢持续观察
- 综合爆发分加权融合

纯函数，无 LLM/网络依赖，可独立单测。
"""

import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ═══ 信号分数映射 ═══

# BSR骤降分 (raw score, before quality multiplier)
_BSR_SURGE_SCORES = {
    "extreme": 100,   # bsrCr ≤ -80% + listingDays ≤ 30
    "strong": 80,     # bsrCr ≤ -60% + listingDays ≤ 60
    "moderate": 60,   # bsrCr ≤ -40% + listingDays ≤ 90
    "weak": 25,       # bsrCr < 0 + bsrCv ≤ -5000
}

# BSR质量系数
_BSR_QUALITY_MULTIPLIER = [
    (10000, 2.0),    # bsr < 10k → ×2.0 极强
    (50000, 1.5),    # bsr < 50k → ×1.5 强
    (100000, 1.0),   # bsr < 100k → ×1.0 一般
    (float("inf"), 0.5),  # bsr ≥ 100k → ×0.5 信号弱
]

# 销量增速分
_UNITS_GROWTH_SCORES = {
    "extreme": 100,   # unitsGr ≥ 200% + listingDays ≤ 30
    "strong": 80,     # unitsGr ≥ 100% + listingDays ≤ 60
    "moderate": 60,   # unitsGr ≥ 50% + listingDays ≤ 90
    "weak": 25,       # unitsGr > 0
}

# 评论增速分
_RATINGS_GROWTH_SCORES = {
    "strong": 100,    # ratingsCv ≥ 30 + listingDays ≤ 60
    "moderate": 60,   # ratingsCv ≥ 15 + listingDays ≤ 90
    "weak": 30,       # ratingsCv ≥ 5 + listingDays ≤ 90
}

# 综合爆发分权重
_BURST_WEIGHTS = {
    "bsr_surge": 0.45,
    "units_growth": 0.35,
    "reviews_growth": 0.20,
}

# 紧急度阈值
_URGENCY_THRESHOLDS = [
    (80, "critical"),
    (50, "important"),
    (30, "watch"),
]

# ═══ Dataclass 定义 ═══


@dataclass
class ProductBurstSignal:
    """单个产品的爆发信号。"""
    asin: str
    title: str = ""
    bsr_surge_score: float = 0.0       # BSR骤降分（0-100，归一化）
    units_growth_score: float = 0.0    # 销量增速分
    reviews_growth_score: float = 0.0  # 评论增速分
    composite_score: float = 0.0        # 综合爆发分（加权）
    urgency: str = "none"               # critical / important / watch / none
    signals: List[str] = field(default_factory=list)  # 触发的信号描述
    # 原始字段（便于前端展示）
    bsr: Optional[int] = None
    bsrCr: Optional[float] = None
    units: Optional[int] = None
    unitsGr: Optional[float] = None
    ratings: Optional[int] = None
    ratingsCv: Optional[int] = None
    listingDays: Optional[int] = None
    price: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BurstDetectionResult:
    """品类爆发信号检测结果。"""
    products: List[ProductBurstSignal] = field(default_factory=list)
    top_bursts: List[ProductBurstSignal] = field(default_factory=list)
    category_burst_score: float = 0.0
    total_products_scanned: int = 0
    products_with_signals: int = 0
    urgency_distribution: Dict[str, int] = field(default_factory=dict)
    has_critical: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topBursts": [p.to_dict() for p in self.top_bursts],
            "categoryBurstScore": self.category_burst_score,
            "totalProductsScanned": self.total_products_scanned,
            "productsWithSignals": self.products_with_signals,
            "urgencyDistribution": self.urgency_distribution,
            "hasCritical": self.has_critical,
            "allBursts": [p.to_dict() for p in self.products],
        }


# ═══ 信号检测函数 ═══


def _check_bsr_surge(
    bsr: Optional[int],
    bsrCr: Optional[float],
    bsrCv: Optional[int],
    listingDays: Optional[int],
) -> tuple:
    """BSR骤降信号检测。

    Returns:
        (score, signal_description)
    """
    if bsrCr is None or bsrCr >= 0:
        return 0.0, None

    abs_bsrCr = abs(bsrCr)
    ld = listingDays or 999

    raw_score = 0.0
    desc = None

    if abs_bsrCr >= 80 and ld <= 30:
        raw_score = float(_BSR_SURGE_SCORES["extreme"])
        desc = f"BSR骤降{abs_bsrCr:.0f}%（{ld}天新品），火箭式起飞"
    elif abs_bsrCr >= 60 and ld <= 60:
        raw_score = float(_BSR_SURGE_SCORES["strong"])
        desc = f"BSR骤降{abs_bsrCr:.0f}%（{ld}天），快速起量"
    elif abs_bsrCr >= 40 and ld <= 90:
        raw_score = float(_BSR_SURGE_SCORES["moderate"])
        desc = f"BSR改善{abs_bsrCr:.0f}%（{ld}天），稳步增长"
    elif bsrCv is not None and bsrCv <= -5000:
        raw_score = float(_BSR_SURGE_SCORES["weak"])
        desc = f"BSR在改善（变化值={bsrCv}），幅度一般"
    else:
        return 0.0, None

    # BSR质量系数
    quality = 0.5  # 默认最低
    for threshold, multiplier in _BSR_QUALITY_MULTIPLIER:
        if (bsr or 999999) < threshold:
            quality = multiplier
            break

    final_score = min(100.0, raw_score * quality)
    return final_score, desc


def _check_units_growth(
    unitsGr: Optional[float],
    units: Optional[int],
    listingDays: Optional[int],
) -> tuple:
    """销量增速信号检测。

    Returns:
        (score, signal_description)
    """
    if unitsGr is None or unitsGr <= 0:
        return 0.0, None

    ld = listingDays or 999

    # 绝对值过滤：排除噪音（"1单→100单"的虚假增速）
    if unitsGr >= 50 and (units or 0) < 10:
        return 0.0, None

    if unitsGr >= 200 and ld <= 30:
        return float(_UNITS_GROWTH_SCORES["extreme"]), f"销量增{unitsGr:.0f}%（{ld}天），翻3倍"
    elif unitsGr >= 100 and ld <= 60:
        return float(_UNITS_GROWTH_SCORES["strong"]), f"销量增{unitsGr:.0f}%（{ld}天），翻倍"
    elif unitsGr >= 50 and ld <= 90:
        return float(_UNITS_GROWTH_SCORES["moderate"]), f"销量增{unitsGr:.0f}%（{ld}天），稳步增长"
    elif unitsGr > 0:
        return float(_UNITS_GROWTH_SCORES["weak"]), f"销量正增长+{unitsGr:.0f}%"

    return 0.0, None


def _check_reviews_growth(
    ratingsCv: Optional[int],
    listingDays: Optional[int],
) -> tuple:
    """评论增速信号检测。

    Returns:
        (score, signal_description)
    """
    if ratingsCv is None or ratingsCv <= 0:
        return 0.0, None

    ld = listingDays or 999

    if ratingsCv >= 30 and ld <= 60:
        return float(_RATINGS_GROWTH_SCORES["strong"]), f"评论+{ratingsCv}（{ld}天），爆品特征"
    elif ratingsCv >= 15 and ld <= 90:
        return float(_RATINGS_GROWTH_SCORES["moderate"]), f"评论+{ratingsCv}（{ld}天），活跃品"
    elif ratingsCv >= 5 and ld <= 90:
        return float(_RATINGS_GROWTH_SCORES["weak"]), f"评论+{ratingsCv}，自然积累"

    return 0.0, None


def _classify_urgency(composite_score: float) -> str:
    """综合爆发分→紧急度分类。"""
    for threshold, urgency in _URGENCY_THRESHOLDS:
        if composite_score >= threshold:
            return urgency
    return "none"


# ═══ 公开函数 ═══


def detect_burst_signals(
    products: List[Dict[str, Any]],
    node_name: str = "",
) -> BurstDetectionResult:
    """检测品类内所有产品的爆发信号。

    扫描每个产品的 bsrCr/unitsGr/ratingsCv/listingDays，
    按 doc12 §三 规则打分，返回综合爆发分和紧急度。

    Args:
        products:   raw_data.productLines[].products[] 列表
        node_name:  品类名（仅用于日志）

    Returns:
        BurstDetectionResult
    """
    burst_products: List[ProductBurstSignal] = []

    for product in products:
        asin = str(product.get("asin", product.get("ASIN", "")))
        if not asin:
            continue

        title = str(product.get("title", ""))
        bsr = product.get("bsr", product.get("BSR"))
        bsrCr = _safe_float(product.get("bsrCr"))
        bsrCv = _safe_int(product.get("bsrCv"))
        unitsGr = _safe_float(product.get("unitsGr"))
        units = _safe_int(product.get("units", product.get("amzUnit")))
        ratingsCv = _safe_int(product.get("ratingsCv"))
        listingDays = _safe_int(product.get("listingDays"))
        ratings = _safe_int(product.get("ratings"))
        price = _safe_float(product.get("price"))

        if listingDays is None and bsrCr is None and unitsGr is None and ratingsCv is None:
            continue  # 无任何可用信号字段

        # 三信号检测
        bsr_score, bsr_desc = _check_bsr_surge(bsr, bsrCr, bsrCv, listingDays)
        units_score, units_desc = _check_units_growth(unitsGr, units, listingDays)
        reviews_score, reviews_desc = _check_reviews_growth(ratingsCv, listingDays)

        # 加权综合
        composite = (
            _BURST_WEIGHTS["bsr_surge"] * bsr_score
            + _BURST_WEIGHTS["units_growth"] * units_score
            + _BURST_WEIGHTS["reviews_growth"] * reviews_score
        )

        if composite == 0.0:
            continue  # 无任何爆发信号

        urgency = _classify_urgency(composite)
        signals = [d for d in (bsr_desc, units_desc, reviews_desc) if d]

        burst_product = ProductBurstSignal(
            asin=asin,
            title=title[:80] if title else "",
            bsr_surge_score=round(bsr_score, 1),
            units_growth_score=round(units_score, 1),
            reviews_growth_score=round(reviews_score, 1),
            composite_score=round(composite, 1),
            urgency=urgency,
            signals=signals,
            bsr=bsr if isinstance(bsr, int) else None,
            bsrCr=bsrCr,
            units=units,
            unitsGr=unitsGr,
            ratings=ratings,
            ratingsCv=ratingsCv,
            listingDays=listingDays,
            price=price,
        )
        burst_products.append(burst_product)

    # 按综合分降序
    burst_products.sort(key=lambda p: p.composite_score, reverse=True)

    # Top 5
    top_bursts = burst_products[:5]

    # 品类级爆发强度：取 top 5 平均分
    category_score = 0.0
    if top_bursts:
        category_score = round(
            sum(p.composite_score for p in top_bursts) / len(top_bursts), 1
        )

    # 紧急度分布
    urgency_dist: Dict[str, int] = {"critical": 0, "important": 0, "watch": 0, "none": 0}
    for p in burst_products:
        urgency_dist[p.urgency] = urgency_dist.get(p.urgency, 0) + 1

    has_critical = urgency_dist.get("critical", 0) > 0

    logger.info(
        f"[burst_detector] {node_name}: 扫描{len(products)}产品, "
        f"信号{len(burst_products)}个, "
        f"紧急{urgency_dist['critical']}个, "
        f"品类强度={category_score}"
    )

    return BurstDetectionResult(
        products=burst_products,
        top_bursts=top_bursts,
        category_burst_score=category_score,
        total_products_scanned=len(products),
        products_with_signals=len(burst_products),
        urgency_distribution=urgency_dist,
        has_critical=has_critical,
    )


# ═══ 辅助函数 ═══


def _safe_float(value: Any) -> Optional[float]:
    """安全转换为 float，失败返回 None。"""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    """安全转换为 int，失败返回 None。"""
    if value is None:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None
