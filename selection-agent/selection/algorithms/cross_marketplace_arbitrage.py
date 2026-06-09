"""跨站点套利发现器 — 确定性算法层。

基于 doc 13《跨站点套利发现》§四.1 Phase 1 设计：
- 同ASIN跨站存在性检测
- 3级套利强度分类：🔴强 / 🟡中 / 🟢弱
- 汇率换算统一为 CNY 对比

数据来源：runner 并行拉取两站 aggregated-data。
纯函数，无 LLM/网络依赖，可独立单测。
"""

import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import SITE_CONFIG

logger = logging.getLogger(__name__)

# ═══ 套利检测阈值 ═══

# 优质 ASIN 条件
_QUALITY_BSR_MAX = 50000       # BSR < 5万
_QUALITY_LISTING_DAYS_MAX = 180  # listingDays ≤ 180
_QUALITY_UNITS_MIN = 30         # units > 30（仅 STRONG 需要）

# 套利强度分类
_ARBITRAGE_STRONG = "STRONG"
_ARBITRAGE_MODERATE = "MODERATE"
_ARBITRAGE_WEAK = "WEAK"

# 表现差异阈值
_PERFORMANCE_DIFF_RATIO = 2.0    # source > target ×2 → MODERATE
_PERFORMANCE_CLOSE_RATIO = 0.30  # 差异 < 30% → WEAK

# ═══ Dataclass 定义 ═══


@dataclass
class ArbitrageOpportunity:
    """单个跨站套利机会。"""
    asin: str
    title: str = ""
    source_marketplace: str = ""       # 已验证的站点（源站）
    target_marketplace: str = ""       # 机会站点（目标站）
    source_bsr: Optional[int] = None
    source_units: Optional[int] = None
    source_price: Optional[float] = None
    source_listing_days: Optional[int] = None
    target_exists: bool = False
    target_bsr: Optional[int] = None
    target_units: Optional[int] = None
    target_price: Optional[float] = None
    arbitrage_strength: str = "WEAK"   # STRONG / MODERATE / WEAK
    opportunity_description: str = ""  # 一句话机会描述

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asin": self.asin,
            "title": self.title,
            "sourceMarketplace": self.source_marketplace,
            "targetMarketplace": self.target_marketplace,
            "sourceBsr": self.source_bsr,
            "sourceUnits": self.source_units,
            "sourcePrice": self.source_price,
            "sourceListingDays": self.source_listing_days,
            "targetExists": self.target_exists,
            "targetBsr": self.target_bsr,
            "targetUnits": self.target_units,
            "targetPrice": self.target_price,
            "arbitrageStrength": self.arbitrage_strength,
            "opportunityDescription": self.opportunity_description,
        }


@dataclass
class CrossMarketplaceResult:
    """跨站套利检测结果。"""
    opportunities: List[ArbitrageOpportunity] = field(default_factory=list)
    strong_opportunities: List[ArbitrageOpportunity] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    total_scanned: int = 0
    opportunities_found: int = 0
    source_to_target: int = 0    # 源站→目标站 机会数
    target_to_source: int = 0    # 目标站→源站 机会数

    def to_dict(self) -> Dict[str, Any]:
        return {
            "opportunities": [o.to_dict() for o in self.opportunities],
            "strongOpportunities": [o.to_dict() for o in self.strong_opportunities],
            "summary": self.summary,
            "totalScanned": self.total_scanned,
            "opportunitiesFound": self.opportunities_found,
            "sourceToTarget": self.source_to_target,
            "targetToSource": self.target_to_source,
        }


# ═══ 内部函数 ═══


def _build_asin_index(products: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """构建 ASIN → product 的索引（不区分大小写，取第一个匹配）。"""
    index: Dict[str, Dict[str, Any]] = {}
    for p in products:
        asin = str(p.get("asin", p.get("ASIN", ""))).strip().upper()
        if asin and asin not in index:
            index[asin] = p
    return index


def _is_quality_product(product: Dict[str, Any]) -> bool:
    """判断产品是否满足优质条件（BSR < 5万 AND listingDays ≤ 180）。"""
    bsr = _safe_int(product.get("bsr", product.get("BSR")))
    listing_days = _safe_int(product.get("listingDays"))
    if bsr is None or listing_days is None:
        return False
    return bsr > 0 and bsr < _QUALITY_BSR_MAX and listing_days <= _QUALITY_LISTING_DAYS_MAX


def _classify_strength(
    source_product: Dict[str, Any],
    target_product: Optional[Dict[str, Any]],
) -> tuple:
    """分类套利强度。

    Returns:
        (strength, description)
    """
    source_units = _safe_int(source_product.get("units", source_product.get("amzUnit"))) or 0
    source_bsr = _safe_int(source_product.get("bsr", source_product.get("BSR"))) or 0
    source_asin = str(source_product.get("asin", source_product.get("ASIN", "")))

    if target_product is None:
        # 源站有，目标站无
        if 0 < source_bsr < _QUALITY_BSR_MAX and source_units > _QUALITY_UNITS_MIN:
            return _ARBITRAGE_STRONG, f"源站爆品(BSR={source_bsr}, 月销={source_units})目标站空白，立即布局"
        else:
            return _ARBITRAGE_MODERATE, f"源站有品(BSR={source_bsr})目标站空白，评估后布局"
    else:
        # 两站都有
        target_units = _safe_int(target_product.get("units", target_product.get("amzUnit"))) or 0
        target_bsr = _safe_int(target_product.get("bsr", target_product.get("BSR"))) or 0

        if source_units <= 0 or target_units <= 0:
            return _ARBITRAGE_WEAK, "两站都有但销量数据不全"

        ratio = source_units / target_units
        if ratio >= _PERFORMANCE_DIFF_RATIO:
            return _ARBITRAGE_MODERATE, (
                f"源站表现优(月销{source_units} vs {target_units}，{ratio:.1f}倍)，分析差异原因"
            )
        elif abs(ratio - 1.0) < _PERFORMANCE_CLOSE_RATIO:
            return _ARBITRAGE_WEAK, f"两站表现接近(月销{source_units} vs {target_units})，无套利空间"
        else:
            return _ARBITRAGE_WEAK, f"两站表现差异在中等范围"


def _price_in_cny(price: Optional[float], marketplace: str) -> Optional[float]:
    """将价格换算为 CNY。"""
    if price is None:
        return None
    rate = SITE_CONFIG.get(marketplace, {}).get("local_to_cny", 1.0)
    return round(price * rate, 2)


# ═══ 公开函数 ═══


def detect_cross_marketplace_opportunities(
    current_products: List[Dict[str, Any]],
    other_products: List[Dict[str, Any]],
    current_marketplace: str = "UK",
    other_marketplace: str = "DE",
) -> CrossMarketplaceResult:
    """检测同ASIN跨站套利机会。

    Args:
        current_products:  当前站点 productLines[0].products[]
        other_products:    另一站点 productLines[0].products[]
        current_marketplace: 当前站点代码 UK/DE/US
        other_marketplace:   另一站点代码

    Returns:
        CrossMarketplaceResult
    """
    # 构建另一站 ASIN 索引
    other_index = _build_asin_index(other_products)

    opportunities: List[ArbitrageOpportunity] = []
    strong_opps: List[ArbitrageOpportunity] = []

    # 遍历当前站优质产品
    for cp in current_products:
        asin = str(cp.get("asin", cp.get("ASIN", ""))).strip().upper()
        if not asin:
            continue

        if not _is_quality_product(cp):
            continue

        title = str(cp.get("title", ""))
        source_bsr = _safe_int(cp.get("bsr", cp.get("BSR")))
        source_units = _safe_int(cp.get("units", cp.get("amzUnit")))
        source_price = _safe_float(cp.get("price"))
        source_ld = _safe_int(cp.get("listingDays"))

        # 在另一站查找
        other_product = other_index.get(asin)

        strength, description = _classify_strength(cp, other_product)

        opp = ArbitrageOpportunity(
            asin=asin,
            title=title[:80] if title else "",
            source_marketplace=current_marketplace,
            target_marketplace=other_marketplace,
            source_bsr=source_bsr,
            source_units=source_units,
            source_price=source_price,
            source_listing_days=source_ld,
            target_exists=other_product is not None,
            target_bsr=_safe_int(other_product.get("bsr", other_product.get("BSR"))) if other_product else None,
            target_units=_safe_int(other_product.get("units", other_product.get("amzUnit"))) if other_product else None,
            target_price=_safe_float(other_product.get("price")) if other_product else None,
            arbitrage_strength=strength,
            opportunity_description=description,
        )
        opportunities.append(opp)
        if strength == _ARBITRAGE_STRONG:
            strong_opps.append(opp)

    # 按强度排序（STRONG → MODERATE → WEAK）
    strength_order = {_ARBITRAGE_STRONG: 0, _ARBITRAGE_MODERATE: 1, _ARBITRAGE_WEAK: 2}
    opportunities.sort(key=lambda o: (strength_order.get(o.arbitrage_strength, 3), -(o.source_units or 0)))

    total_scanned = sum(1 for cp in current_products if _is_quality_product(cp))

    summary = {
        "currentMarketplace": current_marketplace,
        "otherMarketplace": other_marketplace,
        "totalQualityProducts": total_scanned,
        "opportunitiesFound": len(opportunities),
        "strongCount": len(strong_opps),
        "moderateCount": sum(1 for o in opportunities if o.arbitrage_strength == _ARBITRAGE_MODERATE),
        "weakCount": sum(1 for o in opportunities if o.arbitrage_strength == _ARBITRAGE_WEAK),
        "direction": f"{current_marketplace}→{other_marketplace}",
    }

    logger.info(
        f"[cross_arbitrage] {current_marketplace}→{other_marketplace}: "
        f"扫描{total_scanned}优质品, {len(opportunities)}机会, {len(strong_opps)}强信号"
    )

    return CrossMarketplaceResult(
        opportunities=opportunities,
        strong_opportunities=strong_opps,
        summary=summary,
        total_scanned=total_scanned,
        opportunities_found=len(opportunities),
        source_to_target=len(opportunities),
        target_to_source=0,  # 反向由调用方交换参数后二次调用
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
