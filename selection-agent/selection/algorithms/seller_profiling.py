"""卖家行为画像 — 聪明卖家3维评分 + 品类热度矩阵 + 跟品信号。

核心思想（§一）:
  从"这个品好不好"升级到"聪明人在做什么"。

数据源:
  - 郑总店铺名单（deng_zong_shops 表，由 Java 维护）
  - competitor_products 表（外部卖家数据）

纯函数设计（无 I/O），可独立单测。

参考文档: docs/选品算法/10-卖家行为画像.md
"""

import logging
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── 数据类 ────────────────────────────────────────────────


@dataclass
class ProductStrengthScore:
    """商品实力分 — 同一 marketplace + nodeLabelLevel2 内标准化。"""
    asin: str
    seller_name: str
    bsr_percentile: float       # BSR 百分位（0-100，越低越好已反转）
    units_percentile: float     # 月销量百分位（0-100）
    composite: float            # 综合 = bsr*0.4 + units*0.6


@dataclass
class SellerProfile:
    """卖家画像 — 月度快照。"""
    seller_name: str
    marketplace: str
    month: str
    is_dengzong: bool
    smart_score: float          # 综合聪明卖家分 0-100
    vision_score: float         # A: 选品眼光分
    new_success_rate: float     # B: 新品成功率
    profit_percentile: float    # C: 利润百分位
    grade: str                  # S/A/B/C
    archetype: str              # 最擅长的品类原型
    product_count: int
    new_product_count: int
    avg_units: float
    avg_bsr: float
    category_focus: Dict[str, float]  # 品类专注度 {category: ratio}

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # category_focus 序列化为 JSON 字符串
        if isinstance(d.get("category_focus"), dict):
            import json
            d["category_focus"] = json.dumps(d["category_focus"])
        # is_dengzong 序列化为 1/0（Java 期望整数）
        d["is_dengzong"] = 1 if d.get("is_dengzong") else 0
        return d


@dataclass
class CategoryHeatRow:
    """品类热度矩阵行。"""
    category: str
    marketplace: str
    month: str
    dengzong_count: int         # 郑总店铺数
    external_s_count: int       # 外部 S/A 级卖家数
    total_seller_count: int
    dengzong_ratio: float       # 郑总占比
    smart_density: float        # 聪明卖家密度
    heat_signal: str            # 🔥/🌊/⚡/❄️

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FollowSignal:
    """跟品信号。"""
    marketplace: str
    month: str
    category: str
    first_seller: str
    first_asin: str
    first_listing_days: int
    followers: List[Dict[str, Any]]     # [{seller, asin, delay_days, grade}]
    signal_strength: str                # strong/moderate/weak
    smart_follower_count: int           # S/A 级跟进数

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SmartRecommendation:
    """智能推荐（交叉分析产物）。"""
    rec_type: str               # smart_consensus / dengzong_validated / blind_spot / follow_accel
    category: str
    sellers: List[str]
    reason: str
    score: float                # 推荐度 0-100

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── 商品实力分 ─────────────────────────────────────────────


def compute_product_strength_score(
    products: List[Dict[str, Any]],
    min_samples: int = 5,
) -> Dict[str, ProductStrengthScore]:
    """计算每个商品在同 marketplace+品类组 内的实力分 (§3.1 修正版)。

    先按 marketplace+category 分组，组内计算百分位（≥min_samples）。
    小品类回退到全局百分位，避免小样本偏误。

    Args:
        products: 商品列表 [{asin, seller_name, bsr, units, node_label_path?}, ...]
        min_samples: 品类内最少商品数，低于此数用全局百分位

    Returns:
        {asin: ProductStrengthScore}
    """
    if not products:
        return {}

    # ── 分组 key: marketplace + 品类标签 ──
    def _group_key(p):
        mp = p.get("marketplace", "")
        cat = p.get("category")
        if not cat:
            node_path = p.get("node_label_path") or p.get("nodeLabelPath") or ""
            parts = node_path.split(":") if node_path else [""]
            cat = parts[0].strip() if len(parts) > 0 else "OTHER"
        return f"{mp}|{cat}"

    groups: Dict[str, List[int]] = {}  # key -> list of indices
    for i, p in enumerate(products):
        key = _group_key(p)
        groups.setdefault(key, []).append(i)

    # ── 全局百分位（小品类兜底） ──
    all_bsrs = [(p.get("bsr", 999999) or 999999) for p in products]
    all_units = [(p.get("units", 0) or 0) for p in products]
    global_bsr_pcts = _percentile_rank_list(all_bsrs, reverse=True)
    global_units_pcts = _percentile_rank_list(all_units, reverse=False)

    result = {}
    bsr_pcts = [0.0] * len(products)
    units_pcts = [0.0] * len(products)

    for key, indices in groups.items():
        if len(indices) >= min_samples:
            # ── 品类内百分位 ──
            group_bsrs = [all_bsrs[i] for i in indices]
            group_units = [all_units[i] for i in indices]
            g_bsr_pcts = _percentile_rank_list(group_bsrs, reverse=True)
            g_units_pcts = _percentile_rank_list(group_units, reverse=False)
            for j, gi in enumerate(indices):
                bsr_pcts[gi] = g_bsr_pcts[j]
                units_pcts[gi] = g_units_pcts[j]
        else:
            # ── 小品类用全局兜底 ──
            for gi in indices:
                bsr_pcts[gi] = global_bsr_pcts[gi]
                units_pcts[gi] = global_units_pcts[gi]

    for i, p in enumerate(products):
        asin = p.get("asin", p.get("identifier", f"unknown_{i}"))
        composite = bsr_pcts[i] * 0.4 + units_pcts[i] * 0.6
        result[asin] = ProductStrengthScore(
            asin=asin,
            seller_name=p.get("seller_name", p.get("sellerName", "")),
            bsr_percentile=round(bsr_pcts[i], 1),
            units_percentile=round(units_pcts[i], 1),
            composite=round(composite, 1),
        )

    return result


# ── 聪明卖家评分 ───────────────────────────────────────────


def compute_smart_seller_score(
    seller_name: str,
    seller_products: List[Dict[str, Any]],
    strength_scores: Dict[str, ProductStrengthScore],
    all_seller_profits: List[float],
    is_dengzong: bool = False,
) -> SellerProfile:
    """计算单个卖家的聪明卖家3维评分。

    §3.2:
      A 选品眼光 (35%): 店铺商品中实力分 TOP25% 的比例
      B 新品成功率 (35%): 新品中 BSR<100k 的比例
      C 盈利能力 (30%): 店铺均利润率的百分位排名

    Args:
        seller_name:         卖家名
        seller_products:     该卖家的所有商品
        strength_scores:     全局商品实力分映射
        all_seller_profits:  所有卖家的平均利润率（用于 C 维百分位）
        is_dengzong:         是否郑总店铺

    Returns:
        SellerProfile
    """
    if not seller_products:
        return SellerProfile(
            seller_name=seller_name,
            marketplace="", month="",
            is_dengzong=is_dengzong,
            smart_score=0, vision_score=0, new_success_rate=0,
            profit_percentile=0, grade="C",
            archetype="UNKNOWN", product_count=0, new_product_count=0,
            avg_units=0, avg_bsr=0, category_focus={},
        )

    # A: 选品眼光 — 商品实力分 TOP25% 的比例
    product_scores = []
    for p in seller_products:
        asin = p.get("asin", p.get("identifier", ""))
        score = strength_scores.get(asin)
        if score:
            product_scores.append(score.composite)

    if product_scores:
        threshold = _percentile(product_scores, 75)
        top25_count = sum(1 for s in product_scores if s >= threshold)
        vision_score = (top25_count / len(product_scores)) * 100
    else:
        vision_score = 0

    # B: 新品成功率 — 新品(listing_days≤90)中 BSR<100k 的比例
    new_products = [
        p for p in seller_products
        if (p.get("listing_days", 999) or 999) <= 90
    ]
    if new_products:
        new_success_count = sum(
            1 for p in new_products
            if (p.get("bsr", 999999) or 999999) < 100000
        )
        new_success_rate = (new_success_count / len(new_products)) * 100
    else:
        new_success_rate = 0

    # C: 盈利能力 — 店铺均利润率的百分位
    profits = [
        p.get("profit", 0) or 0
        for p in seller_products
    ]
    prices = [
        p.get("price", 1) or 1
        for p in seller_products
    ]
    profit_rates = [
        pf / pr if pr > 0 else 0
        for pf, pr in zip(profits, prices)
    ]
    avg_profit_rate = sum(profit_rates) / len(profit_rates) if profit_rates else 0

    if all_seller_profits:
        profit_percentile = _single_percentile_rank(avg_profit_rate, all_seller_profits)
    else:
        profit_percentile = 50.0

    # 综合评分
    smart_score = vision_score * 0.35 + new_success_rate * 0.35 + profit_percentile * 0.30

    # 等级
    grade = grade_seller(smart_score)

    # 品类专注度
    category_counts: Dict[str, int] = {}
    for p in seller_products:
        cat = p.get("category", p.get("nodeName", "Unknown"))
        category_counts[cat] = category_counts.get(cat, 0) + 1
    total = sum(category_counts.values()) or 1
    category_focus = {
        cat: round(cnt / total, 3)
        for cat, cnt in sorted(category_counts.items(), key=lambda x: -x[1])[:5]
    }

    # 最擅长的原型：根据最大品类自动推断
    top_category = list(category_focus.keys())[0] if category_focus else ""
    try:
        from selection.algorithms.archetype_mapper import map_archetype
        result = map_archetype(top_category)
        archetype = result.archetype if result else "UNKNOWN"
    except Exception:
        archetype = "UNKNOWN"

    avg_units = (
        sum(p.get("units", 0) or 0 for p in seller_products) / len(seller_products)
    )
    avg_bsr = (
        sum(p.get("bsr", 999999) or 999999 for p in seller_products) / len(seller_products)
    )

    return SellerProfile(
        seller_name=seller_name,
        marketplace=seller_products[0].get("marketplace", ""),
        month=seller_products[0].get("month", ""),
        is_dengzong=is_dengzong,
        smart_score=round(smart_score, 2),
        vision_score=round(vision_score, 2),
        new_success_rate=round(new_success_rate, 2),
        profit_percentile=round(profit_percentile, 2),
        grade=grade,
        archetype=archetype,
        product_count=len(seller_products),
        new_product_count=len(new_products),
        avg_units=round(avg_units, 1),
        avg_bsr=round(avg_bsr, 1),
        category_focus=category_focus,
    )


def grade_seller(score: float) -> str:
    """卖家分级 (§3.3)。

    S ≥ 80, A ≥ 60, B ≥ 40, C < 40
    """
    if score >= 80:
        return "S"
    elif score >= 60:
        return "A"
    elif score >= 40:
        return "B"
    else:
        return "C"


# ── 品类热度矩阵 ───────────────────────────────────────────


def build_category_heat_matrix(
    dengzong_profiles: List[SellerProfile],
    external_profiles: List[SellerProfile],
    products_by_category: Dict[str, List[Dict[str, Any]]],
) -> List[CategoryHeatRow]:
    """构建品类×卖家交叉热度矩阵 (§4.2)。

    Args:
        dengzong_profiles:     郑总卖家画像列表
        external_profiles:     外部卖家画像列表
        products_by_category:  {category: [products]}

    Returns:
        品类热度行列表
    """
    all_profiles = dengzong_profiles + external_profiles
    dengzong_names = {p.seller_name for p in dengzong_profiles}
    external_sellers = {
        p.seller_name: p.grade
        for p in external_profiles if p.grade in ("S", "A")
    }

    rows = []
    for category, products in products_by_category.items():
        # 统计该品类下的卖家
        sellers_in_cat = set()
        for p in products:
            sn = p.get("seller_name", p.get("sellerName", ""))
            if sn:
                sellers_in_cat.add(sn)

        dengzong_count = len(sellers_in_cat & dengzong_names)
        external_s_count = len(sellers_in_cat & set(external_sellers.keys()))
        total_count = len(sellers_in_cat)
        dengzong_ratio = dengzong_count / total_count if total_count > 0 else 0
        smart_density = (dengzong_count + external_s_count) / total_count if total_count > 0 else 0

        # 热度信号
        if dengzong_count >= 5 and smart_density >= 0.5:
            heat_signal = "🔥"  # 郑总重仓+竞争激烈
        elif dengzong_count <= 2 and external_s_count <= 1:
            heat_signal = "🌊"  # 冷门品类
        elif external_s_count >= 3 and dengzong_count <= 2:
            heat_signal = "⚡"  # 外部聪明卖家多
        else:
            heat_signal = "📊"  # 一般

        rows.append(CategoryHeatRow(
            category=category,
            marketplace=products[0].get("marketplace", ""),
            month=products[0].get("month", ""),
            dengzong_count=dengzong_count,
            external_s_count=external_s_count,
            total_seller_count=total_count,
            dengzong_ratio=round(dengzong_ratio, 3),
            smart_density=round(smart_density, 3),
            heat_signal=heat_signal,
        ))

    # 按热度降序
    rows.sort(key=lambda r: r.smart_density, reverse=True)
    return rows


# ── 跟品信号 ───────────────────────────────────────────────


def detect_follow_signals(
    products_by_category: Dict[str, List[Dict[str, Any]]],
    seller_grades: Dict[str, str],
    dengzong_names: Optional[set] = None,
) -> List[FollowSignal]:
    """跨店铺 ASIN 追踪 — 识别跟品信号 (§5)。

    通过 category 内 listing_days 差异追踪：
    - 首发店铺（listing_days 最大）
    - 跟进延迟
    - 跟进者质量

    Args:
        products_by_category: {category: [products]}
        seller_grades:        {seller_name: grade}
        dengzong_names:       郑总店铺名集合

    Returns:
        跟品信号列表（仅返回有意义的信号）
    """
    if dengzong_names is None:
        dengzong_names = set()

    signals = []

    for category, products in products_by_category.items():
        if len(products) < 2:
            continue

        # 按 listing_days 降序（最早上的排前面）
        sorted_products = sorted(
            products,
            key=lambda p: p.get("listing_days", 0) or 0,
            reverse=True,
        )

        first = sorted_products[0]
        first_seller = first.get("seller_name", first.get("sellerName", ""))
        first_asin = first.get("asin", first.get("identifier", ""))
        first_days = first.get("listing_days", 0) or 0

        # 找跟进者（listing_days 差异 ≥ 7天）
        followers = []
        smart_count = 0

        for p in sorted_products[1:]:
            sn = p.get("seller_name", p.get("sellerName", ""))
            if sn == first_seller:
                continue

            delay = first_days - (p.get("listing_days", 0) or 0)
            if delay < 7:
                continue  # 几乎同时上，不算跟进

            grade = seller_grades.get(sn, "C")
            followers.append({
                "seller": sn,
                "asin": p.get("asin", p.get("identifier", "")),
                "delay_days": delay,
                "grade": grade,
            })
            if grade in ("S", "A"):
                smart_count += 1

        if not followers:
            continue

        # 信号强度判定 (§5.3)
        recent_followers = [f for f in followers if f["delay_days"] <= 60]
        smart_recent = sum(1 for f in recent_followers if f["grade"] in ("S", "A"))
        dengzong_recent = sum(
            1 for f in recent_followers
            if f["seller"] in dengzong_names
        )

        if smart_recent >= 3:
            signal_strength = "strong"
        elif smart_recent >= 2 or (dengzong_recent >= 3 and len(recent_followers) >= 3):
            signal_strength = "moderate"
        else:
            signal_strength = "weak"

        signals.append(FollowSignal(
            marketplace=products[0].get("marketplace", ""),
            month=products[0].get("month", ""),
            category=category,
            first_seller=first_seller,
            first_asin=first_asin,
            first_listing_days=first_days,
            followers=followers,
            signal_strength=signal_strength,
            smart_follower_count=smart_count,
        ))

    # 按信号强度排序
    strength_order = {"strong": 0, "moderate": 1, "weak": 2}
    signals.sort(key=lambda s: strength_order.get(s.signal_strength, 3))

    return signals


# ── 产品级跟品信号（parent_asin匹配）─────────────────────────


def detect_product_follow_signals(
    all_products: List[Dict[str, Any]],
    seller_grades: Dict[str, str],
    dengzong_names: Optional[set] = None,
    min_delay_days: int = 7,
) -> List[FollowSignal]:
    """产品级跟品检测 — 通过 parent_asin 匹配追踪同一产品跨店铺传播。

    与 detect_follow_signals 的区别:
      - 品类级: 检测"多个卖家进入同一品类"→ 市场热度信号
      - 产品级: 检测"同一个 ASIN 在不同店铺出现"→ 直接跟品行为

    使用 parent_asin 匹配：同一 parent_asin 出现在不同 seller_name 下即视为跟品。

    Args:
        all_products:  全量商品列表（不按品类分组）
        seller_grades: {seller_name: grade}
        dengzong_names: 郑总店铺名集合
        min_delay_days: 最小跟进延迟（天），<此值视为同时上架

    Returns:
        产品级跟品信号列表
    """
    if dengzong_names is None:
        dengzong_names = set()

    # ── Step 1: 按 parent_asin 分组，只保留跨店铺的 ──
    by_parent: Dict[str, List[Dict]] = {}
    for p in all_products:
        parent = p.get("parent_asin") or p.get("parentAsin") or p.get("asin", "")
        if not parent:
            continue
        by_parent.setdefault(parent, []).append(p)

    # ── Step 2: 对每个 parent_asin，检测首发和跟进者 ──
    signals = []
    for parent_asin, products in by_parent.items():
        # 需要至少2个不同卖家
        sellers = set(
            p.get("seller_name", p.get("sellerName", "")) for p in products
        )
        if len(sellers) < 2:
            continue

        # 按 listing_days 降序找首发
        sorted_products = sorted(
            products,
            key=lambda p: p.get("listing_days", 0) or 0,
            reverse=True,
        )

        first = sorted_products[0]
        first_seller = first.get("seller_name", first.get("sellerName", ""))
        first_asin = first.get("asin", "")
        first_days = first.get("listing_days", 0) or 0
        category = first.get("node_label_path") or first.get("nodeLabelPath") or first.get("category", "")

        # 找跟进者
        followers = []
        smart_count = 0
        for p in sorted_products[1:]:
            sn = p.get("seller_name", p.get("sellerName", ""))
            if sn == first_seller:
                continue

            delay = first_days - (p.get("listing_days", 0) or 0)
            if delay < min_delay_days:
                continue

            grade = seller_grades.get(sn, "C")
            followers.append({
                "seller": sn,
                "asin": p.get("asin", ""),
                "delay_days": delay,
                "grade": grade,
            })
            if grade in ("S", "A"):
                smart_count += 1

        if not followers:
            continue

        # 信号强度
        recent = [f for f in followers if f["delay_days"] <= 60]
        smart_recent = sum(1 for f in recent if f["grade"] in ("S", "A"))
        dengzong_recent = sum(1 for f in recent if f["seller"] in dengzong_names)
        total_recent = len(recent)

        if smart_recent >= 3:
            strength = "strong"
        elif smart_recent >= 2 or dengzong_recent >= 3:
            strength = "moderate"
        else:
            strength = "weak"

        signals.append(FollowSignal(
            marketplace=products[0].get("marketplace", ""),
            month=products[0].get("month", ""),
            category=f"[产品级] {category}",
            first_seller=first_seller,
            first_asin=first_asin,
            first_listing_days=first_days,
            followers=followers,
            signal_strength=strength,
            smart_follower_count=smart_count,
        ))

    strength_order = {"strong": 0, "moderate": 1, "weak": 2}
    signals.sort(key=lambda s: strength_order.get(s.signal_strength, 3))
    return signals


# ── 智能推荐 ───────────────────────────────────────────────


def generate_smart_recommendations(
    heat_matrix: List[CategoryHeatRow],
    follow_signals: List[FollowSignal],
    blue_ocean_results: Optional[List[Dict[str, Any]]] = None,
) -> List[SmartRecommendation]:
    """交叉分析生成智能推荐 (§6.2)。

    推荐类型:
      - smart_consensus:  ≥2个S级卖家同月在同品类上新
      - dengzong_validated: 郑总≥3店 + 蓝海
      - blind_spot:       外部S级卖家 + 郑总0店
      - follow_accel:     跟品加速

    Args:
        heat_matrix:          品类热度矩阵
        follow_signals:       跟品信号列表
        blue_ocean_results:   09蓝海雷达结果（可选，用于交叉验证）

    Returns:
        智能推荐列表
    """
    recommendations = []

    # 蓝海品类集合（如有）
    blue_ocean_categories = set()
    if blue_ocean_results:
        for r in blue_ocean_results:
            if r.get("opportunity_type") == "blue_ocean":
                blue_ocean_categories.add(r.get("category_name", ""))

    # 聪明人共识：从跟品信号中提取
    for sig in follow_signals:
        if sig.signal_strength == "strong":
            recommendations.append(SmartRecommendation(
                rec_type="smart_consensus",
                category=sig.category,
                sellers=[f["seller"] for f in sig.followers[:3]],
                reason=f"{sig.smart_follower_count}个S/A级卖家在{sig.first_listing_days}天内跟进{sig.category}",
                score=min(100, sig.smart_follower_count * 25),
            ))

    # 郑总验证 + 蓝海
    for row in heat_matrix:
        if row.dengzong_count >= 3 and row.category in blue_ocean_categories:
            recommendations.append(SmartRecommendation(
                rec_type="dengzong_validated",
                category=row.category,
                sellers=[],  # 具体店铺名需 Java 提供
                reason=f"郑总{row.dengzong_count}店在做的{row.category}，同时被蓝海雷达识别为蓝海机会",
                score=90,
            ))

    # 外部发现盲区
    for row in heat_matrix:
        if row.dengzong_count == 0 and row.external_s_count >= 3:
            recommendations.append(SmartRecommendation(
                rec_type="blind_spot",
                category=row.category,
                sellers=[],
                reason=f"外部{row.external_s_count}个S/A级卖家在做{row.category}，郑总尚未布局",
                score=75,
            ))

    # 跟品加速：moderate 强度信号（有聪明卖家跟进但未达 strong 阈值）
    for sig in follow_signals:
        if sig.signal_strength == "moderate":
            seller_names = [f["seller"] for f in sig.followers[:3]]
            recommendations.append(SmartRecommendation(
                rec_type="follow_accel",
                category=sig.category,
                sellers=seller_names,
                reason=f"{sig.smart_follower_count}个S/A级卖家在{sig.first_listing_days}天内跟进{sig.category}，信号正在加速",
                score=min(80, sig.smart_follower_count * 25 + 15),
            ))

    # 去重 + 按推荐度降序
    seen = set()
    unique_recs = []
    for rec in recommendations:
        key = (rec.rec_type, rec.category)
        if key not in seen:
            seen.add(key)
            unique_recs.append(rec)
    unique_recs.sort(key=lambda r: r.score, reverse=True)

    return unique_recs[:10]


# ── 辅助函数 ───────────────────────────────────────────────


def _percentile_rank_list(values: List[float], reverse: bool = False) -> List[float]:
    """计算列表中每个值的百分位排名（0-100）。

    Args:
        values:  数值列表
        reverse: True=值越小排名越高(用于BSR), False=值越大排名越高
    """
    if not values:
        return []
    n = len(values)
    if n == 1:
        return [100.0]

    sorted_vals = sorted(values)
    result = []
    for v in values:
        if reverse:
            # BSR: 值越小排名越高
            rank = sum(1 for sv in sorted_vals if sv > v)
        else:
            rank = sum(1 for sv in sorted_vals if sv < v)
        result.append(round(rank / (n - 1) * 100, 1))
    return result


def _single_percentile_rank(value: float, all_values: List[float]) -> float:
    """单值在列表中的百分位排名。"""
    if not all_values:
        return 50.0
    rank = sum(1 for v in all_values if v < value)
    return round(rank / len(all_values) * 100, 1)


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
