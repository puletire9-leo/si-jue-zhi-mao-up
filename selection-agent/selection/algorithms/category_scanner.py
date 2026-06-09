"""品类蓝海扫描器（V2）— 10维雷达 + 4类分型 + 测品推荐。

与 blue_ocean_radar.py (V1 单品类) 互补:
  - blue_ocean_radar.py: 单品类快速检查（competition_analysis 节点）
  - category_scanner.py: 全品类批量扫描 + 排名（独立 pipeline）

纯函数设计（无 I/O），可独立单测。

参考文档: docs/选品算法/09-蓝海发现算法升级.md
"""

import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── 数据类 ────────────────────────────────────────────────


@dataclass
class CategoryRadar:
    """单品类10维雷达结果。"""
    category_name: str
    marketplace: str
    month: str
    total_products: int
    dimensions: Dict[str, int]  # {"D1": 72, "D2": 65, ...}

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CategoryOpportunityRanking:
    """品类机会排名（含分型和综合评分）。"""
    category_name: str
    marketplace: str
    month: str
    radar: CategoryRadar
    opportunity_type: str         # blue_ocean / red_seam / niche / watch
    opportunity_label: str        # 🌊蓝海机会 / 🔥红海有缝 / 💎小众精品 / ⏳观望区
    composite_score: float        # 加权综合分 0-100
    group_scores: Dict[str, float]  # 分组分: entry_barrier, opportunity_quality, profit_feasibility

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["radar"] = self.radar.to_dict()
        return d


@dataclass
class TestProductRecommendation:
    """单个测品推荐。"""
    asin: str
    listing_days: int
    monthly_units: int
    profit: float
    ratings: int
    reasons: List[str]       # 推荐理由列表
    opportunity_score: int   # 机会评分 0-100

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── D1-D10 维度计算（纯函数） ───────────────────────────────


def _compute_d1_new_activity(new_ratio: float) -> int:
    """D1 新品活跃度: 新品占比 → 0-100。

    src: §3.3 D1
    线性映射: 0%→0, 100%→100。>40% 已经是高活跃。
    """
    return min(100, max(0, int(new_ratio * 100)))


def _compute_d2_new_success_rate(new_success_rate: float) -> int:
    """D2 新品成功率: 新品中 BSR<100k 的比例 → 0-100。

    src: §3.3 D2
    >70% → 90-100分 (绝大多数新品能活)
    40-70% → 60-90分
    <20% → <30分 (伪蓝海警告)
    """
    return min(100, max(0, int(new_success_rate * 100)))


def _compute_d3_review_barrier(avg_top10_ratings: float) -> int:
    """D3 评论壁垒（反向）: TOP10 均评论数 → 0-100。

    src: §3.3 D3
    归一化: 100 * 1/(1 + avg_ratings/1000)
    - avg_ratings=0   → 100 (无壁垒)
    - avg_ratings=500 → 67
    - avg_ratings=2000→ 33
    - avg_ratings=10000→ 9
    """
    if avg_top10_ratings < 0:
        avg_top10_ratings = 0
    return min(100, max(0, int(100 / (1 + avg_top10_ratings / 1000))))


def _compute_d4_brand_diversity(brand_diversity: float) -> int:
    """D4 品牌分散度: unique_brands/total → 0-100。

    src: §3.3 D4
    线性映射: 0→0 (1个品牌垄断), 1.0→100 (每家一个品牌)。
    """
    return min(100, max(0, int(brand_diversity * 100)))


def _compute_d5_seller_diversity(seller_diversity: float) -> int:
    """D5 卖家分散度: unique_sellers/total → 0-100。

    src: §3.3 D5
    同品牌分散度逻辑。
    """
    return min(100, max(0, int(seller_diversity * 100)))


def _compute_d6_profit_margin(avg_profit_rate: float) -> int:
    """D6 利润空间: 品类利润率 → 0-100。

    src: §3.3 D6
    利润率<30% 警告，线性映射: 0%→0, 100%→100。
    """
    return min(100, max(0, int(avg_profit_rate * 100)))


def _compute_d7_demand_intensity(avg_units: float, all_avg_units: List[float]) -> int:
    """D7 需求强度: 品类均月销量的百分位 → 0-100。

    src: §3.3 D7
    需要全品类数据做百分位排名。
    """
    if not all_avg_units or avg_units <= 0:
        return 50
    sorted_units = sorted(all_avg_units)
    rank = sum(1 for u in sorted_units if u < avg_units)
    return min(100, max(0, int(rank / len(sorted_units) * 100)))


def _compute_d8_price_war_risk(new_avg_price: float, old_avg_price: float) -> int:
    """D8 价格战风险（反向）: 新品均价/老品均价 → 0-100。

    src: §3.3 D8
    ratio > 0.9 → 80-100 (新品不需要降价)
    ratio 0.7-0.9 → 50-80
    ratio < 0.7 → <50 (价格战风险高)
    """
    if old_avg_price <= 0 or new_avg_price <= 0:
        return 50
    ratio = new_avg_price / old_avg_price
    return min(100, max(0, int(ratio * 100)))


def _compute_d9_listing_quality_gap(low_quality_ratio: float) -> int:
    """D9 Listing质量差距: 低质Listing比例 → 0-100。

    src: §3.3 D9
    线性映射: >60% → 90-100 (大量低质, 运营优势明显)
    """
    return min(100, max(0, int(low_quality_ratio * 100)))


def _compute_d10_tag_momentum(tag_ratio: float) -> int:
    """D10 标签势能: bestSeller/amazonChoice/newRelease 占比 → 0-100。

    src: §3.3 D10
    线性映射: >20% 已经很高。
    """
    return min(100, max(0, int(tag_ratio * 100)))


# ── 核心编排 ──────────────────────────────────────────────


def compute_10_dimension_radar(
    category_metrics: Dict[str, Any],
    all_categories_metrics: List[Dict[str, Any]],
) -> CategoryRadar:
    """计算单品类10维雷达（百分位归一化 0-100）。

    Args:
        category_metrics:       Java 聚合返回的单品类原始指标
        all_categories_metrics: 全品类原始指标列表（用于 D7 百分位归一化）

    Returns:
        CategoryRadar
    """
    cat_name = category_metrics.get("category", category_metrics.get("category_name", ""))

    # 提取全品类均销量（用于 D7 百分位）
    all_avg_units = [
        c.get("avg_units", 0) or 0
        for c in all_categories_metrics
    ]

    dimensions = {
        "D1": _compute_d1_new_activity(
            category_metrics.get("new_ratio", 0) or 0
        ),
        "D2": _compute_d2_new_success_rate(
            category_metrics.get("new_success_rate_raw", 0) or 0
        ),
        "D3": _compute_d3_review_barrier(
            category_metrics.get("avg_ratings", 0) or 0
        ),
        "D4": _compute_d4_brand_diversity(
            category_metrics.get("brand_diversity", 0) or 0
        ),
        "D5": _compute_d5_seller_diversity(
            category_metrics.get("seller_diversity", 0) or 0
        ),
        "D6": _compute_d6_profit_margin(
            category_metrics.get("avg_profit_rate", 0) or 0
        ),
        "D7": _compute_d7_demand_intensity(
            category_metrics.get("avg_units", 0) or 0,
            all_avg_units,
        ),
        "D8": _compute_d8_price_war_risk(
            category_metrics.get("new_avg_price", 0) or 0,
            category_metrics.get("old_avg_price", 0) or 0,
        ),
        "D9": _compute_d9_listing_quality_gap(
            category_metrics.get("low_quality_ratio", 0) or 0
        ),
        "D10": _compute_d10_tag_momentum(
            category_metrics.get("tag_ratio", 0) or 0
        ),
    }

    return CategoryRadar(
        category_name=cat_name,
        marketplace=category_metrics.get("marketplace", "UK"),
        month=category_metrics.get("month", ""),
        total_products=category_metrics.get("total_products", 0) or 0,
        dimensions=dimensions,
    )


# ── 4类分型 ───────────────────────────────────────────────


def classify_opportunity_type(radar: CategoryRadar) -> Dict[str, str]:
    """4类机会分型。

    src: §4.1

    Returns:
        {"type": "blue_ocean", "label": "🌊蓝海机会"}

    | type       | label       | 条件                                              |
    |------------|-------------|---------------------------------------------------|
    | blue_ocean | 🌊蓝海机会   | D3≥60 AND D4≥50 AND D6≥50 AND D7≥40              |
    | red_seam   | 🔥红海有缝   | D3<60 AND (D9≥50 OR D8≥70)                        |
    | niche      | 💎小众精品   | D7<40 AND D6≥70 AND D2≥50                         |
    | watch      | ⏳观望区     | D2<30 AND D3<30                                    |
    | neutral    | 🔍关注区     | 不满足上述任何条件                                  |
    """
    dims = radar.dimensions
    d2 = dims.get("D2", 50)
    d3 = dims.get("D3", 50)
    d4 = dims.get("D4", 50)
    d6 = dims.get("D6", 50)
    d7 = dims.get("D7", 50)
    d8 = dims.get("D8", 50)
    d9 = dims.get("D9", 50)

    if d3 >= 60 and d4 >= 50 and d6 >= 50 and d7 >= 40:
        return {"type": "blue_ocean", "label": "🌊蓝海机会"}
    elif d3 < 60 and (d9 >= 50 or d8 >= 70):
        return {"type": "red_seam", "label": "🔥红海有缝"}
    elif d7 < 40 and d6 >= 70 and d2 >= 50:
        return {"type": "niche", "label": "💎小众精品"}
    elif d2 < 30 and d3 < 30:
        return {"type": "watch", "label": "⏳观望区"}
    else:
        return {"type": "neutral", "label": "🔍关注区"}


# ── 综合排名 ──────────────────────────────────────────────


def rank_categories(
    radars: List[CategoryRadar],
) -> List[CategoryOpportunityRanking]:
    """全品类按综合机会分排名。

    综合分 = 各维度加权求和（权重见 §4.3 原型偏好，这里用默认均权）。
    D1*10% + D2*15% + D3*15% + D4*10% + D5*10% + D6*10% + D7*10% + D8*5% + D9*10% + D10*5%
    """
    weights = {
        "D1": 0.10, "D2": 0.15, "D3": 0.15,
        "D4": 0.10, "D5": 0.10, "D6": 0.10,
        "D7": 0.10, "D8": 0.05, "D9": 0.10, "D10": 0.05,
    }

    results = []
    for radar in radars:
        dims = radar.dimensions
        composite = sum(dims.get(d, 50) * w for d, w in weights.items())

        # 3组评分
        entry_barrier = (
            dims.get("D3", 50) * 0.5 +
            dims.get("D4", 50) * 0.25 +
            dims.get("D5", 50) * 0.25
        )
        opportunity_quality = (
            dims.get("D1", 50) * 0.25 +
            dims.get("D2", 50) * 0.35 +
            dims.get("D7", 50) * 0.25 +
            dims.get("D10", 50) * 0.15
        )
        profit_feasibility = (
            dims.get("D6", 50) * 0.40 +
            dims.get("D8", 50) * 0.30 +
            dims.get("D9", 50) * 0.30
        )

        opp_type = classify_opportunity_type(radar)

        results.append(CategoryOpportunityRanking(
            category_name=radar.category_name,
            marketplace=radar.marketplace,
            month=radar.month,
            radar=radar,
            opportunity_type=opp_type["type"],
            opportunity_label=opp_type["label"],
            composite_score=round(composite, 1),
            group_scores={
                "entry_barrier": round(entry_barrier, 1),
                "opportunity_quality": round(opportunity_quality, 1),
                "profit_feasibility": round(profit_feasibility, 1),
            },
        ))

    # 按综合分降序
    results.sort(key=lambda r: r.composite_score, reverse=True)
    return results


# ── 测品推荐 ──────────────────────────────────────────────


def recommend_test_products(
    category_products: List[Dict[str, Any]],
    radar: CategoryRadar,
    max_recommendations: int = 5,
) -> List[TestProductRecommendation]:
    """从品类商品中筛选 2-5 个测品 ASIN。

    src: §5.2 6信号加分制

    Args:
        category_products: 品类内商品列表（含 asin, listing_days, bsr, units, profit, ratings, ...）
        radar:             该品类的10维雷达
        max_recommendations: 最多推荐几个

    Returns:
        推荐列表（按机会分降序）
    """
    if not category_products:
        return []

    # 计算品类中位数指标
    units_list = [p.get("units", 0) or 0 for p in category_products]
    profit_list = [p.get("profit", 0) or 0 for p in category_products]
    median_units = _median(units_list) if units_list else 0
    profit_75pct = _percentile(profit_list, 75) if profit_list else 0

    # 品类均价
    prices = [p.get("price", 0) or 0 for p in category_products]
    avg_price = sum(prices) / len(prices) if prices else 0

    # 价格区间商品数（用于价格带空白检测）
    price_band_counts: Dict[str, int] = {}
    for p in category_products:
        price = p.get("price", 0) or 0
        if avg_price > 0:
            band_key = f"{int(price / (avg_price * 0.2))}"
            price_band_counts[band_key] = price_band_counts.get(band_key, 0) + 1
    median_band_count = _median(list(price_band_counts.values())) if price_band_counts else 1

    scored: List[tuple] = []

    for product in category_products:
        score = 0
        reasons: List[str] = []

        listing_days = product.get("listing_days", 999) or 999
        bsr = product.get("bsr", 999999) or 999999
        units = product.get("units", 0) or 0
        profit = product.get("profit", 0) or 0
        ratings = product.get("ratings", 999) or 999
        price = product.get("price", 0) or 0
        rating_val = product.get("rating", 5.0) or 5.0
        has_video = product.get("video") or product.get("hasVideo", False)
        variations = product.get("variations", 0) or 0

        # 基础门槛
        weight_g = product.get("weight_g", 0) or 0
        filter_mode = product.get("filter_mode", "")
        if filter_mode == "FAIL" or weight_g >= 1000:
            continue
        if avg_price > 0 and (price < avg_price * 0.5 or price > avg_price * 2):
            continue

        # 信号1: 新品快速起量 (+3)
        if listing_days <= 90 and bsr < 50000:
            score += 3
            reasons.append("新品快速起量")

        # 信号2: 低评论高销量 (+2)
        if ratings < 50 and units > median_units:
            score += 2
            reasons.append("低评论高销量")

        # 信号3: 高利润 (+2)
        if profit > profit_75pct:
            score += 2
            reasons.append("高利润")

        # 信号4: 运营差距大 (+1)
        if rating_val < 4.0 or not has_video:
            score += 1
            reasons.append("运营差距大")

        # 信号5: 价格带空白 (+2)
        if avg_price > 0:
            band_key = f"{int(price / (avg_price * 0.2))}"
            band_count = price_band_counts.get(band_key, 0)
            if band_count < max(1, median_band_count * 0.3):
                score += 2
                reasons.append("价格带空白")

        # 信号6: 变体少 (+1)
        if variations <= 3:
            score += 1
            reasons.append("变体竞争少")

        scored.append((score, reasons, product))

    # 按机会分降序取 TOP N
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:max_recommendations]

    return [
        TestProductRecommendation(
            asin=p.get("asin", p.get("identifier", "")),
            listing_days=p.get("listing_days", 0) or 0,
            monthly_units=p.get("units", 0) or 0,
            profit=p.get("profit", 0) or 0,
            ratings=p.get("ratings", 0) or 0,
            reasons=reasons,
            opportunity_score=min(100, int(score * 10)),  # 6信号 max=11, *10≈110, clamp
        )
        for score, reasons, p in top
    ]


# ── 结构化机会卡 ───────────────────────────────────────────


def generate_category_opportunity_card(
    ranking: CategoryOpportunityRanking,
    test_products: List[TestProductRecommendation],
) -> Dict[str, Any]:
    """组装结构化机会卡（无 LLM 版本，供 LLM 解读前的结构数据）。

    Args:
        ranking:       品类排名
        test_products: 测品推荐

    Returns:
        机会卡 dict
    """
    return {
        "category_name": ranking.category_name,
        "marketplace": ranking.marketplace,
        "month": ranking.month,
        "opportunity_type": ranking.opportunity_type,
        "opportunity_label": ranking.opportunity_label,
        "composite_score": ranking.composite_score,
        "rank": None,  # 由调用方填充
        "radar": ranking.radar.dimensions,
        "group_scores": ranking.group_scores,
        "total_products": ranking.radar.total_products,
        "test_products": [tp.to_dict() for tp in test_products],
    }


# ── 辅助 ──────────────────────────────────────────────────


def _median(values: List[float]) -> float:
    """中位数。"""
    if not values:
        return 0
    s = sorted(values)
    n = len(s)
    if n % 2 == 0:
        return (s[n // 2 - 1] + s[n // 2]) / 2
    return s[n // 2]


def _percentile(values: List[float], pct: float) -> float:
    """百分位数。"""
    if not values:
        return 0
    s = sorted(values)
    k = (len(s) - 1) * pct / 100
    f = int(k)
    c = k - f
    if f + 1 < len(s):
        return s[f] + c * (s[f + 1] - s[f])
    return s[-1]
