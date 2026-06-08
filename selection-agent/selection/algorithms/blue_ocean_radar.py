"""蓝海雷达 — 识别品类中的蓝海机会。

蓝海特征：
1. 价格带空白（存在未被充分覆盖的价格区间）
2. 竞争分散但增速高（CR3低+增长率高）
3. 评论壁垒低（头部卖家评论数少）
4. 差异化空间大（产品同质化严重）

蓝海信号评分：
- BLUE_OCEAN:   蓝海机会明显，建议快速切入
- LIGHT_BLUE:   浅蓝海，有机会但需差异化
- PURPLE_OCEAN: 紫海（红海中的蓝点），需细分切入
- RED_OCEAN:    红海，不建议进入

公开函数:
    detect_blue_ocean
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class BlueOceanSignal:
    """单个蓝海信号。"""
    name: str
    score: int              # 0-100（越高=蓝海特征越明显）
    status: str             # STRONG/MODERATE/WEAK/ABSENT
    description: str
    evidence: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BlueOceanResult:
    """蓝海雷达检测结果。"""
    category_label: str
    marketplace: str
    overall_score: int              # 综合蓝海分 0-100
    classification: str             # BLUE_OCEAN/LIGHT_BLUE/PURPLE_OCEAN/RED_OCEAN
    signals: Dict[str, BlueOceanSignal]
    recommendations: List[str]
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["signals"] = {k: v.to_dict() for k, v in self.signals.items()}
        return d


def _detect_price_gap_signal(
    price_gaps: List[Dict[str, Any]],
    price_range: float,
) -> BlueOceanSignal:
    """价格带空白信号。

    存在空白价格带 = 蓝海机会。
    price_range: 价格带总宽度（最高价-最低价），用于评估空白区的定价空间大小。
    """
    if not price_gaps:
        return BlueOceanSignal(
            name="price_gap",
            score=20,
            status="ABSENT",
            description="价格带无明显空白",
            evidence="所有价格带均有产品覆盖",
        )

    empty_count = sum(1 for g in price_gaps if g.get("density") == "EMPTY")
    sparse_count = sum(1 for g in price_gaps if g.get("density") == "SPARSE")
    # 宽价格带（>50）时空白更有价值，给予额外加分
    wide_range_bonus = 10 if price_range > 50 else 0

    if empty_count >= 2:
        score = min(90 + wide_range_bonus, 100)
        status = "STRONG"
        desc = f"发现{empty_count}个空白价格带，定价空间充足"
        evidence = ", ".join(f"{g.get('label', '')}({g.get('range', '')})" for g in price_gaps if g.get("density") == "EMPTY")
    elif empty_count >= 1:
        score = min(70 + wide_range_bonus, 100)
        status = "MODERATE"
        desc = f"发现{empty_count}个空白价格带"
        evidence = f"空白带: {price_gaps[0].get('range', '')}"
    elif sparse_count >= 2:
        score = 55
        status = "MODERATE"
        desc = f"发现{sparse_count}个稀疏价格带，有渗透机会"
        evidence = ", ".join(f"{g.get('label', '')}" for g in price_gaps if g.get("density") == "SPARSE")
    else:
        score = 30
        status = "WEAK"
        desc = "价格带分布较均匀"
        evidence = "无明显定价空间"

    return BlueOceanSignal(
        name="price_gap",
        score=score,
        status=status,
        description=desc,
        evidence=evidence,
    )


def _detect_competition_gap_signal(
    cr3: float,
    entry_barrier: str,
    units_growth_rate: float,
) -> BlueOceanSignal:
    """竞争分散+高增速信号。

    低CR3 + 高增速 = 蓝海典型特征。
    """
    # CR3评分（越低越好）
    if cr3 < 0.3:
        cr3_score = 85
    elif cr3 < 0.5:
        cr3_score = 65
    elif cr3 < 0.7:
        cr3_score = 40
    else:
        cr3_score = 15

    # 增速评分
    if units_growth_rate > 30:
        growth_score = 90
    elif units_growth_rate > 15:
        growth_score = 70
    elif units_growth_rate > 0:
        growth_score = 50
    else:
        growth_score = 20

    combined = int(cr3_score * 0.6 + growth_score * 0.4)

    if combined >= 75:
        status = "STRONG"
        desc = f"竞争分散(CR3={cr3:.2f})且增速高({units_growth_rate:.1f}%)"
        evidence = f"CR3={cr3:.3f}, growth={units_growth_rate:.1f}%, barrier={entry_barrier}"
    elif combined >= 50:
        status = "MODERATE"
        desc = f"竞争适中，有一定增长空间"
        evidence = f"CR3={cr3:.3f}, growth={units_growth_rate:.1f}%"
    else:
        status = "WEAK"
        desc = f"竞争激烈或增长乏力"
        evidence = f"CR3={cr3:.3f}, growth={units_growth_rate:.1f}%"

    return BlueOceanSignal(
        name="competition_gap",
        score=combined,
        status=status,
        description=desc,
        evidence=evidence,
    )


def _detect_barrier_signal(
    avg_ratings: float,
    avg_rating: float,
) -> BlueOceanSignal:
    """评论壁垒信号。

    低评论数 = 新品容易切入 = 蓝海。
    """
    if avg_ratings < 50:
        score = 90
        status = "STRONG"
        desc = f"评论壁垒极低(均{avg_ratings:.0f}条)，新品易切入"
        evidence = f"avgRatings={avg_ratings:.0f}, avgRating={avg_rating:.1f}"
    elif avg_ratings < 150:
        score = 65
        status = "MODERATE"
        desc = f"评论壁垒中等(均{avg_ratings:.0f}条)"
        evidence = f"avgRatings={avg_ratings:.0f}"
    elif avg_ratings < 300:
        score = 40
        status = "WEAK"
        desc = f"评论壁垒较高(均{avg_ratings:.0f}条)"
        evidence = f"avgRatings={avg_ratings:.0f}"
    else:
        score = 15
        status = "ABSENT"
        desc = f"评论壁垒很高(均{avg_ratings:.0f}条)，新品难以突围"
        evidence = f"avgRatings={avg_ratings:.0f}"

    return BlueOceanSignal(
        name="barrier",
        score=score,
        status=status,
        description=desc,
        evidence=evidence,
    )


def _detect_homogeneity_signal(
    avg_price: float,
    price_range: float,
    product_count: int,
) -> BlueOceanSignal:
    """产品同质化信号。

    窄价格带+多产品 = 产品同质化严重 = 差异化空间大。
    """
    if avg_price <= 0:
        return BlueOceanSignal(
            name="homogeneity",
            score=40,
            status="WEAK",
            description="数据不足",
            evidence="无价格数据",
        )

    spread_ratio = price_range / avg_price if avg_price > 0 else 0

    if spread_ratio < 0.3 and product_count > 100:
        score = 85
        status = "STRONG"
        desc = f"产品高度同质化(价差比{spread_ratio:.1%})，差异化空间大"
        evidence = f"spread_ratio={spread_ratio:.2f}, products={product_count}"
    elif spread_ratio < 0.5 and product_count > 50:
        score = 60
        status = "MODERATE"
        desc = f"产品有一定同质化(价差比{spread_ratio:.1%})"
        evidence = f"spread_ratio={spread_ratio:.2f}"
    else:
        score = 30
        status = "WEAK"
        desc = f"产品差异化程度较高(价差比{spread_ratio:.1%})"
        evidence = f"spread_ratio={spread_ratio:.2f}"

    return BlueOceanSignal(
        name="homogeneity",
        score=score,
        status=status,
        description=desc,
        evidence=evidence,
    )


def detect_blue_ocean(
    category_label: str = "",
    marketplace: str = "UK",
    cr3: float = 0,
    entry_barrier: str = "",
    units_growth_rate: float = 0,
    avg_ratings: float = 0,
    avg_rating: float = 0,
    avg_price: float = 0,
    price_range: float = 0,
    price_gaps: Optional[List[Dict[str, Any]]] = None,
    product_count: int = 0,
) -> BlueOceanResult:
    """检测蓝海机会。

    Args:
        category_label:    品类名称
        marketplace:       站点
        cr3:               CR3竞争集中度
        entry_barrier:     进入壁垒
        units_growth_rate: 销量增速
        avg_ratings:       平均评论数
        avg_rating:        平均评分
        avg_price:         均价
        price_range:       价格幅度
        price_gaps:        价格带空白
        product_count:     产品数量

    Returns:
        BlueOceanResult
    """
    signals = {
        "price_gap": _detect_price_gap_signal(price_gaps or [], price_range),
        "competition_gap": _detect_competition_gap_signal(cr3, entry_barrier, units_growth_rate),
        "barrier": _detect_barrier_signal(avg_ratings, avg_rating),
        "homogeneity": _detect_homogeneity_signal(avg_price, price_range, product_count),
    }

    # 综合蓝海分（加权平均）
    weights = {
        "price_gap": 25,
        "competition_gap": 35,
        "barrier": 25,
        "homogeneity": 15,
    }
    total_weight = sum(weights.values())
    weighted_sum = sum(signals[k].score * weights[k] for k in weights)
    overall_score = int(weighted_sum / total_weight)

    # 分类
    if overall_score >= 75:
        classification = "BLUE_OCEAN"
    elif overall_score >= 55:
        classification = "LIGHT_BLUE"
    elif overall_score >= 35:
        classification = "PURPLE_OCEAN"
    else:
        classification = "RED_OCEAN"

    # 推荐建议
    recommendations = _generate_recommendations(classification, signals)

    # 置信度
    confidence = 0.75
    if product_count < 30:
        confidence *= 0.8

    logger.info(f"[blue_ocean] {category_label}: score={overall_score}, "
                f"class={classification}")

    return BlueOceanResult(
        category_label=category_label,
        marketplace=marketplace,
        overall_score=overall_score,
        classification=classification,
        signals=signals,
        recommendations=recommendations,
        confidence=round(confidence, 2),
    )


def _generate_recommendations(
    classification: str,
    signals: Dict[str, BlueOceanSignal],
) -> List[str]:
    """生成推荐建议。"""
    recs = []

    if classification == "BLUE_OCEAN":
        recs.append("蓝海机会明显，建议快速切入，抢占先发优势")
    elif classification == "LIGHT_BLUE":
        recs.append("浅蓝海机会，建议差异化定位后进入")
    elif classification == "PURPLE_OCEAN":
        recs.append("紫海市场，需找到细分切入点")
    else:
        recs.append("红海市场，不建议正面竞争")
        return recs

    # 针对性建议
    if signals["price_gap"].score >= 60:
        recs.append("利用价格带空白，定位差异化价格区间")

    if signals["barrier"].score >= 70:
        recs.append("评论壁垒低，可通过快速积累评论建立优势")

    if signals["homogeneity"].score >= 60:
        recs.append("产品同质化严重，差异化设计是关键竞争点")

    if signals["competition_gap"].score >= 70:
        recs.append("竞争分散，适合多SKU策略覆盖")

    return recs
