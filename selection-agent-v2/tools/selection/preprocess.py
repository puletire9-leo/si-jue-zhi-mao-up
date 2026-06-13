"""
选品预处理 — 变体归组去重 / 信号标签打标 / 基础统计

从 MySQL deng_zong_shop 读取原始商品 → 去重取样 → 信号标签 → 输出分析就绪数据

流程:
1. 按 node_id 拉取全量商品
2. 变体归组去重: parent_asin 分组取销量最高；无 parent_asin 按标题前10词分组
3. 取样: 去重后 Top 畅销品 + 新星商品 (listing_days<=90, units>=10), 最多40个
4. 信号标签: BURST / RISING / STABLE / DECLINING / DEAD / VARIANT / SWEET_SPOT
5. 基础统计: 新品占比 / 信号分布 / 价格分布 / 品牌分布
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# ── 常量 ──────────────────────────────────────────────────────

MAX_SAMPLE_SIZE = 40
NEW_STAR_LISTING_DAYS = 90
NEW_STAR_MIN_UNITS = 10
MIN_VARIANT_COUNT = 3

# 信号标签定义（无 emoji）
SIGNAL_LABELS = {
    "BURST":       "爆发型 — 高销量+短上架或高增速",
    "RISING":      "上升型 — 增速显著或BSR改善",
    "STABLE":      "稳健型 — 销量稳定",
    "DECLINING":   "衰退型 — 销量或BSR恶化",
    "DEAD":        "僵尸型 — 几乎无销量",
    "VARIANT":     "多变体 — 3+变体组",
    "SWEET_SPOT":  "甜点区 — 价格5-20 + 高评分 + 有销量",
}

# 郑总已验证品类（无需AI再判断是否可行，直接按商品数降序）
# Zheng already validated these — pure product count sorting

# ── 工具函数 ──────────────────────────────────────────────────

def _safe_float(v: Any) -> float:
    """安全转 float，失败返回 0."""
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        logger.debug(f"_safe_float failed for value: {v!r}")
        return 0.0


def _safe_int(v: Any, default: int = 0) -> int:
    """安全转 int，失败返回 default."""
    try:
        return int(v) if v is not None else default
    except (ValueError, TypeError):
        logger.debug(f"_safe_int failed for value: {v!r}")
        return default


def _title_first_n_words(title: str, n: int = 10) -> str:
    """提取标题前 n 个词（小写+去标点），用于变体归组."""
    if not title:
        return ""
    clean = re.sub(r"[^\w\s]", "", title.lower())
    words = clean.split()
    return " ".join(words[:n])


def _parse_weight_grams(weight_str: str) -> float:
    """解析重量字符串 '50 g' / '0.15 kg' → 克数."""
    if not weight_str:
        return 0.0
    s = str(weight_str).strip().lower()
    try:
        # "50 g" or "50g"
        if "kg" in s:
            return float(s.replace("kg", "").strip()) * 1000
        elif "g" in s:
            return float(s.replace("g", "").strip())
        else:
            return float(s)
    except (ValueError, TypeError):
        return 0.0


def _compute_listing_days(available_date: Any) -> int:
    """计算上架天数。available_date 可能是 Unix 时间戳(秒)或 ISO 日期字符串."""
    if available_date is None:
        return 9999
    try:
        val = int(available_date)
        if val > 1_000_000_000_000:  # Unix 时间戳（毫秒，13位）
            listing_date = datetime.fromtimestamp(val / 1000)
        elif val > 1_000_000_000:  # Unix 时间戳（秒，10位）
            listing_date = datetime.fromtimestamp(val)
        else:
            return 9999
        return max(0, (datetime.now() - listing_date).days)
    except (ValueError, TypeError, OSError):
        return 9999


# ── 数据模型 ──────────────────────────────────────────────────

@dataclass
class ProductRow:
    """原始商品行."""
    asin: str
    title: str = ""
    parent_asin: str = ""
    node_id: int = 0
    bsr_id: str = ""
    units: int = 0
    units_gr: float = 0.0
    bsr: int = 0
    bsr_cr: float = 0.0
    price: float = 0.0
    rating: float = 0.0
    ratings: int = 0
    revenue: float = 0.0
    profit: float = 0.0
    brand: str = ""
    seller_name: str = ""
    listing_days: int = 9999
    variations: int = 0   # 同组变体数
    individual_units: int = 0  # 单品原始销量（去重前的个人销量）
    image_url: str = ""
    pkg_weight: str = ""
    pkg_dimensions: str = ""
    fba_fee: float = 0.0
    best_seller: str = ""
    amazon_choice: str = ""


@dataclass
class SubCategoryAnalysis:
    """单个小类的预处理结果."""
    node_id: int
    node_name: str
    node_full_path: str
    bsr_id: str

    # 统计
    stats: dict = field(default_factory=dict)
    # 取样后的商品（最多40）
    sampled_products: list = field(default_factory=list)
    # 信号分布
    signal_distribution: dict = field(default_factory=dict)

    def to_ai_context(self) -> dict:
        """转为 AI 分析用的 JSON 结构，含脚本预计算数据，AI 聚焦判断而非算数."""
        products = self.sampled_products

        # ── 预计算：价格带 ──
        prices = [p.price for p in products if p.price > 0]
        weights = [_parse_weight_grams(p.pkg_weight) for p in products if p.pkg_weight]
        fbas = [p.fba_fee for p in products if p.fba_fee > 0]
        bsrs = [p.bsr for p in products if p.bsr and p.bsr > 0]
        ratings_list = [p.rating for p in products if p.rating and p.rating > 0]
        ratings_counts = [p.ratings for p in products if p.ratings and p.ratings > 0]

        price_band = {
            "min": round(min(prices), 2) if prices else 0,
            "max": round(max(prices), 2) if prices else 0,
            "avg": round(sum(prices) / len(prices), 2) if prices else 0,
            "sweet_spot_min": 5.99, "sweet_spot_max": 8.99,
            "sweet_spot_ratio": round(sum(1 for p in prices if 5.99 <= p <= 8.99) / len(prices), 2) if prices else 0,
        }

        # ── 预计算：质量基准 ──
        sorted_bsrs = sorted(bsrs) if bsrs else []
        sorted_ratings = sorted(ratings_list) if ratings_list else []
        bsr_p50 = sorted_bsrs[len(sorted_bsrs) // 2] if sorted_bsrs else 0
        bsr_p90 = sorted_bsrs[int(len(sorted_bsrs) * 0.9)] if len(sorted_bsrs) > 1 else bsr_p50
        rating_min = round(sorted_ratings[max(0, len(sorted_ratings) // 4)], 1) if len(sorted_ratings) >= 4 else 4.0
        quality_benchmark = {
            "bsr_p50": bsr_p50,
            "bsr_p90": bsr_p90,
            "rating_min": rating_min,
            "ratings_min": 10,
            "weight_g_median": round(sorted(weights)[len(weights) // 2], 1) if weights else 0,
            "weight_g_max": round(sorted(weights)[int(len(weights) * 0.9)], 1) if weights else 0,
            "fba_median": round(sorted(fbas)[len(fbas) // 2], 2) if fbas else 0,
            "fba_max": round(sorted(fbas)[int(len(fbas) * 0.9)], 2) if fbas else 0,
            "listing_days_median": sorted([p.listing_days for p in products])[len(products) // 2] if products else 0,
        }

        # ── 预计算：评论壁垒 ──
        review_moats = [
            {"asin": p.asin, "ratings": p.ratings,
             "level": "high" if p.ratings >= 500 else "medium" if p.ratings >= 100 else "low"}
            for p in products if p.ratings and p.ratings >= 50
        ]

        # ── 预计算：卖家统计 ──
        seller_nations: dict[str, int] = {}
        for p in products:
            n = (p.seller_name or "").split("-")[-1] if "-" in (p.seller_name or "") else "unknown"
            seller_nations[n] = seller_nations.get(n, 0) + 1
        seller_count = len({p.seller_name for p in products if p.seller_name})

        return {
            "nodeId": self.node_id,
            "nodeName": self.node_name,
            "nodeFullPath": self.node_full_path,
            "bsrId": self.bsr_id,
            "stats": self.stats,
            "signalDistribution": self.signal_distribution,
            # 脚本预计算数据 — AI 直接引用，不要重新计算
            "priceBand": price_band,
            "qualityBenchmark": quality_benchmark,
            "reviewMoats": review_moats,
            "sellerStats": {"count": seller_count, "nations": seller_nations},
            # 商品列表
            "products": [
                {
                    "asin": p.asin,
                    "title": p.title,
                    "price": p.price,
                    "units": p.units,
                    "rating": p.rating,
                    "ratings": p.ratings,
                    "bsr": p.bsr,
                    "listingDays": p.listing_days,
                    "brand": p.brand,
                    "sellerName": p.seller_name,
                    "weightG": _parse_weight_grams(p.pkg_weight),
                    "fba": p.fba_fee,
                    "variations": p.variations,
                    "signals": getattr(p, "signals", []),
                }
                for p in products
            ],
        }


# ── 预处理核心逻辑 ──────────────────────────────────────────────

def fetch_products_by_node(db_conn, marketplace: str, month: str, node_id: int) -> list[ProductRow]:
    """从 deng_zong_shop 拉取指定小类的全量商品."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT asin, title, parent_asin, node_id, bsr_id,
               units, units_gr, bsr, bsr_cr, price, rating, ratings,
               revenue, profit, brand, seller_name,
               available_date, pkg_weight, pkg_dimensions,
               image_url, fba, best_seller, amazon_choice
        FROM deng_zong_shop
        WHERE marketplace = %s AND month = %s AND node_id = %s
        ORDER BY units DESC
    """, (marketplace, month, node_id))
    rows = []
    for r in cur.fetchall():
        rows.append(ProductRow(
            asin=r[0], title=r[1] or "", parent_asin=r[2] or "", node_id=_safe_int(r[3]), bsr_id=r[4] or "",
            units=_safe_int(r[5]), units_gr=_safe_float(r[6]), bsr=_safe_int(r[7]), bsr_cr=_safe_float(r[8]),
            price=_safe_float(r[9]), rating=_safe_float(r[10]), ratings=_safe_int(r[11]),
            revenue=_safe_float(r[12]), profit=_safe_float(r[13]), brand=r[14] or "", seller_name=r[15] or "",
            listing_days=_compute_listing_days(r[16]),
            pkg_weight=r[17] or "", pkg_dimensions=r[18] or "",
            image_url=r[19] or "", fba_fee=_safe_float(r[20]),
            best_seller=r[21] or "", amazon_choice=r[22] or "",
        ))
    cur.close()
    return rows


def dedup_variants(products: list[ProductRow]) -> list[ProductRow]:
    """
    变体归组去重:
    1. 有 parent_asin → 按 parent_asin 分组，每组取 units 最高
    2. 无 parent_asin → 按标题前10词分组，每组取 units 最高
    3. 单变体产品直接保留
    """
    groups: dict[str, list[ProductRow]] = defaultdict(list)

    for p in products:
        if p.parent_asin and p.parent_asin.strip():
            key = f"parent:{p.parent_asin}"
        else:
            key = f"title:{_title_first_n_words(p.title)}"
        groups[key].append(p)

    deduped = []
    for key, group in groups.items():
        # 取销量最高的为代表品
        group.sort(key=lambda x: x.units, reverse=True)
        representative = group[0]

        # 标记变体数
        variant_count = len(group)
        if variant_count >= MIN_VARIANT_COUNT:
            representative.variations = variant_count

        # 保存单品原始销量（用于信号判断），再用组总销量重排序
        representative.individual_units = representative.units
        total_group_units = sum(p.units for p in group)
        representative.units = total_group_units

        deduped.append(representative)

    # 按销量降序
    deduped.sort(key=lambda x: x.units, reverse=True)
    return deduped


def sample_products(deduped: list[ProductRow]) -> list[ProductRow]:
    """
    取样: Top 畅销品 + 新星商品取并集，最多 MAX_SAMPLE_SIZE 个.

    策略: 保留 Top N-1 按销量，最后一个位置给优先级最高的新星。
    如果新星已在 Top N 中，则全部取 Top N 畅销品。
    """
    if len(deduped) <= MAX_SAMPLE_SIZE:
        return deduped

    # 新星商品: listing_days <= 90 AND individual_units >= 10
    new_stars = [
        p for p in deduped
        if p.listing_days <= NEW_STAR_LISTING_DAYS
        and getattr(p, "individual_units", p.units) >= NEW_STAR_MIN_UNITS
    ]

    # 取 Top N 畅销品
    sampled = list(deduped[:MAX_SAMPLE_SIZE])
    star_asins = {p.asin for p in new_stars}

    # 如果新星不在 Top N 中，替换最后一个非新星位置
    if new_stars and not any(s.asin in star_asins for s in sampled):
        # 找优先级最高的新星（units 最高的）
        best_star = max(new_stars, key=lambda p: p.units)
        # 替换最后一个位置
        sampled[-1] = best_star

    return sampled[:MAX_SAMPLE_SIZE]


def tag_signals(products: list[ProductRow]) -> None:
    """
    给每个商品打信号标签（原地修改）.
    信号互斥优先级: BURST > RISING > STABLE > DECLINING > DEAD
    VARIANT 和 SWEET_SPOT 是叠加标签
    """
    for p in products:
        signals: list[str] = []

        # 单品原始销量（M2: 信号判断用单品销量，非组总销量）
        iu = getattr(p, "individual_units", 0) or p.units

        # ── 主信号（互斥，取第一个匹配的）──
        if iu <= 5:
            signals.append("DEAD")
        elif iu >= 100 and (p.listing_days <= 180 or p.units_gr >= 50):
            signals.append("BURST")
        elif p.units_gr >= 20 or (p.bsr_cr <= -10 and iu >= 30):
            signals.append("RISING")
        elif p.units_gr <= -20 or p.bsr_cr >= 20:
            signals.append("DECLINING")
        else:
            signals.append("STABLE")

        # ── 叠加标签 ──
        if p.variations >= MIN_VARIANT_COUNT:
            signals.append("VARIANT")
        if 5 <= p.price <= 20 and p.rating >= 4.0 and p.units >= 10:
            signals.append("SWEET_SPOT")

        p.signals = signals  # type: ignore


def compute_stats(products: list[ProductRow], deduped_count: int) -> dict:
    """计算小类基础统计."""
    if not products:
        return {}

    total = len(products)
    prices = [p.price for p in products if p.price > 0]
    ratings = [p.rating for p in products if p.rating > 0]
    units_list = [p.units for p in products]

    # 信号分布
    signal_counts = Counter()
    for p in products:
        for s in getattr(p, "signals", []):
            signal_counts[s] += 1

    # 新品占比
    new_count = sum(1 for p in products if p.listing_days <= NEW_STAR_LISTING_DAYS)

    # 品牌分布
    brand_counts = Counter(p.brand for p in products if p.brand)

    return {
        "raw": deduped_count,        # 原始商品数
        "total": total,              # 去重后商品数
        "sampled": min(total, MAX_SAMPLE_SIZE),
        "avgPrice": round(sum(prices) / len(prices), 2) if prices else 0,
        "priceMin": round(min(prices), 2) if prices else 0,
        "priceMax": round(max(prices), 2) if prices else 0,
        "avgRating": round(sum(ratings) / len(ratings), 2) if ratings else 0,
        "totalUnits": sum(units_list),
        "avgUnits": round(sum(units_list) / total, 1) if total else 0,
        "newRatio": round(new_count / total, 4) if total else 0,
        "newCount": new_count,
        "bestSellerCount": sum(1 for p in products if p.best_seller in ("1", "Y", "yes")),
        "amazonChoiceCount": sum(1 for p in products if p.amazon_choice in ("1", "Y", "yes")),
        "brandCount": len(brand_counts),
        "topBrands": [{"name": k, "count": v} for k, v in brand_counts.most_common(5)],
        "signalDistribution": dict(signal_counts),
        "storeCount": len({p.seller_name for p in products if p.seller_name}),
        # 重量/FBA统计
        "avgWeightG": round(sum(_parse_weight_grams(p.pkg_weight) for p in products) / total, 1) if total else 0,
        "avgFba": round(sum(p.fba_fee for p in products if p.fba_fee > 0) / max(1, sum(1 for p in products if p.fba_fee > 0)), 2),
        "avgVariations": round(sum(p.variations for p in products) / total, 1) if total else 0,
    }


# ── 主流程 ────────────────────────────────────────────────────

def preprocess_sub_category(
    db_conn,
    marketplace: str,
    month: str,
    node_id: int,
    node_name: str = "",
    node_full_path: str = "",
    bsr_id: str = "",
) -> SubCategoryAnalysis | None:
    """
    单小类预处理主流程.

    Returns:
        SubCategoryAnalysis or None if <10 products after dedup
    """
    # 1. 拉取全量商品
    raw = fetch_products_by_node(db_conn, marketplace, month, node_id)
    logger.info(f"  [{node_name}] raw={len(raw)}")

    if len(raw) < 10:
        logger.info(f"  [{node_name}] SKIP: <10 raw products")
        return None

    # 2. 变体归组去重
    deduped = dedup_variants(raw)
    logger.info(f"  [{node_name}] deduped={len(deduped)}")

    if len(deduped) < 10:
        logger.info(f"  [{node_name}] SKIP: <10 after dedup")
        return None

    # 3. 取样
    sampled = sample_products(deduped)

    # 4. 信号标签
    tag_signals(deduped)  # FIXED: MED-3 sampled objects are from deduped, no second call needed

    # 5. 统计
    stats = compute_stats(deduped, len(raw))

    result = SubCategoryAnalysis(
        node_id=node_id,
        node_name=node_name,
        node_full_path=node_full_path,
        bsr_id=bsr_id,
        stats=stats,
        sampled_products=sampled,
        signal_distribution=stats.get("signalDistribution", {}),
    )

    logger.info(
        f"  [{node_name}] done: raw={len(raw)} deduped={len(deduped)} "
        f"sampled={len(sampled)} signals={result.signal_distribution}"
    )
    return result


def preprocess_batch(db_conn, marketplace: str, month: str, batch_data: dict) -> list[SubCategoryAnalysis]:
    """
    全品类预处理.

    Args:
        db_conn: pymysql connection
        marketplace: UK/DE
        month: 202605
        batch_data: Java 聚合 API 返回的 data 对象

    Returns:
        List of SubCategoryAnalysis, sorted by priority (product count desc)
    """
    results: list[SubCategoryAnalysis] = []

    product_lines = batch_data.get("productLines", [])
    total_sub = sum(pl.get("subCategoryCount", 0) for pl in product_lines)

    logger.info(f"预处理开始: {len(product_lines)} L1品线, {total_sub} L2小类")

    for pl in product_lines:
        bsr_id = pl["bsrId"]
        for sub in pl.get("subCategories", []):
            node_id = int(sub["nodeId"])
            node_name = sub.get("nodeName", "")
            node_full_path = sub.get("nodeFullPath", "")

            analysis = preprocess_sub_category(
                db_conn, marketplace, month,
                node_id=node_id,
                node_name=node_name,
                node_full_path=node_full_path,
                bsr_id=bsr_id,
            )
            if analysis:
                results.append(analysis)

    # 按商品数降序（郑总已验证，不需要AI重新判断品线可行性）
    results.sort(key=lambda x: x.stats.get("total", 0), reverse=True)

    logger.info(f"预处理完成: {len(results)} 小类通过阈值")
    return results
