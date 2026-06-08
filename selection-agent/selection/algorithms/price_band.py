"""价格带分析器 — 4档固定区间+空白检测，纯函数。

4档价格带（UK站£/DE站€）：
- BUDGET:  £4.99 - £5.99
- LOW:     £5.99 - £7.99
- MID:     £7.99 - £9.99
- PREMIUM: £9.99 - £16.99

公开函数:
    analyze_price_band
"""

import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import PRICE_BANDS, PRICE_BANDS_US

logger = logging.getLogger(__name__)


@dataclass
class PriceBandResult:
    """价格带分析结果。"""
    dominant_band: str           # 均价所在档位
    price_range: float           # 价格幅度 (max - min)
    is_narrow: bool              # 窄幅判断 (<£2)
    price_spread_ratio: float    # 幅度/均价比
    band_distribution: List[Dict[str, Any]]  # 各档分布
    price_gaps: List[Dict[str, Any]]         # 空白区间
    avg_price: float             # 传入的均价
    confidence: float            # 置信度

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _find_band(price: float, bands: list = None) -> str:
    """找到价格所在的档位。"""
    if bands is None:
        bands = PRICE_BANDS
    for band in bands:
        if band["min"] <= price < band["max"]:
            return band["label"]
    # 超出范围
    if price < bands[0]["min"]:
        return "BELOW_BUDGET"
    return "ABOVE_PREMIUM"


def _detect_gaps(
    price_min: float,
    price_max: float,
    band_labels: List[str],
    band_counts: Optional[Dict[str, int]] = None,
    bands: list = None,
) -> List[Dict[str, Any]]:
    """检测未被覆盖或实质上稀疏的价格带（空白机会）。

    band_counts为各价格带的实际产品数，用于区分EMPTY和SPARSE。
    少于3个产品视为实质空白（SPARSE）。
    """
    if bands is None:
        bands = PRICE_BANDS
    currency_symbol = "$" if any(b["min"] >= 5 for b in bands) else "\u00a3"
    gaps = []
    for band in bands:
        label = band["label"]
        count = band_counts.get(label, 0) if band_counts else 0
        # 未被覆盖，或实际产品极少
        if label not in band_labels:
            gaps.append({
                "range": f"{currency_symbol}{band['min']:.2f}-{band['max']:.2f}",
                "label": label,
                "density": "EMPTY" if count == 0 else "SPARSE",
                "productCount": count,
                "opportunity": True,
            })
        elif band_counts is not None and count < 3:
            # 被覆盖但产品极少（<3个），视为实质稀疏
            gaps.append({
                "range": f"{currency_symbol}{band['min']:.2f}-{band['max']:.2f}",
                "label": label,
                "density": "SPARSE",
                "productCount": count,
                "opportunity": True,
            })
    return gaps


def analyze_price_band(
    price_min: float = 0,
    price_max: float = 0,
    avg_price: float = 0,
    band_counts: Optional[Dict[str, int]] = None,
    marketplace: str = "UK",
) -> PriceBandResult:
    """分析价格带分布。

    Args:
        price_min:   品类最低价
        price_max:   品类最高价
        avg_price:   品类均价
        band_counts: 各价格带的实际产品数（Java聚合）
        marketplace:  站点 UK/DE/US

    Returns:
        PriceBandResult
    """
    # 根据站点选择价格带
    if marketplace == "US":
        bands = PRICE_BANDS_US
    else:
        bands = PRICE_BANDS
    currency = {"UK": "\u00a3", "DE": "\u20ac", "US": "$"}.get(marketplace, "\u00a3")

    # 价格幅度
    price_range = price_max - price_min if price_max > price_min else 0
    is_narrow = price_range < 2.0  # 窄幅判断
    spread_ratio = (price_range / avg_price) if avg_price > 0 else 0

    # 各档位判定
    min_band = _find_band(price_min, bands)
    max_band = _find_band(price_max, bands)
    avg_band = _find_band(avg_price, bands)

    # 档位分布（模拟：基于min/max/avg推算覆盖范围）
    covered_labels = set()
    band_dist = []

    for band in bands:
        label = band["label"]
        b_min = band["min"]
        b_max = band["max"]

        # 判断该档位是否被品类价格范围覆盖
        if price_max >= b_min and price_min <= b_max:
            covered_labels.add(label)
            # 估算密度（基于重叠比例）
            overlap_min = max(price_min, b_min)
            overlap_max = min(price_max, b_max)
            overlap_ratio = (overlap_max - overlap_min) / (b_max - b_min) if b_max > b_min else 0
            density = "HIGH" if overlap_ratio > 0.6 else ("MEDIUM" if overlap_ratio > 0.3 else "LOW")
        else:
            density = "EMPTY"

        band_dist.append({
            "label": label,
            "range": f"{currency}{b_min:.2f}-{b_max:.2f}",
            "density": density,
            "is_avg_here": label == avg_band,
        })

    # 空白检测
    price_gaps = _detect_gaps(price_min, price_max, list(covered_labels), band_counts=band_counts, bands=bands)

    # 置信度（价格范围越宽、数据越多，置信度越高）
    confidence = 0.70
    if price_range > 5.0:
        confidence = 0.85
    elif price_range > 2.0:
        confidence = 0.80
    elif price_range == 0:
        confidence = 0.50

    logger.info(f"[price_band] dominant={avg_band}, range={price_range:.2f}, "
                f"narrow={is_narrow}, gaps={len(price_gaps)}")

    return PriceBandResult(
        dominant_band=avg_band,
        price_range=round(price_range, 2),
        is_narrow=is_narrow,
        price_spread_ratio=round(spread_ratio, 4),
        band_distribution=band_dist,
        price_gaps=price_gaps,
        avg_price=round(avg_price, 2),
        confidence=round(confidence, 2),
    )
