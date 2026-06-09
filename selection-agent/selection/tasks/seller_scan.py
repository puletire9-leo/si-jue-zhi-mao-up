"""月度卖家行为画像全量扫描任务。

独立任务（不进 LangGraph），由 scheduler 每月触发：
  Step 1: Java API → 拉取所有产品 (按 seller_name 分组)
  Step 2: 计算所有商品实力分
  Step 3: 逐卖家计算聪明卖家评分
  Step 4: 品类热度矩阵
  Step 5: 跟品信号检测
  Step 6: 智能推荐
  Step 7: 回写 Java

参考: docs/选品算法/10-卖家行为画像.md §七
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from selection.algorithms.seller_profiling import (
    compute_product_strength_score,
    compute_smart_seller_score,
    build_category_heat_matrix,
    detect_follow_signals,
    generate_smart_recommendations,
    SellerProfile,
    CategoryHeatRow,
    FollowSignal,
    SmartRecommendation,
)

logger = logging.getLogger(__name__)


async def run_seller_scan(
    marketplace: str = "UK",
    month: Optional[str] = None,
) -> Dict[str, Any]:
    """月度全量卖家画像扫描。

    Args:
        marketplace: 站点 UK/DE/US
        month:       数据月份（默认取当前月份）

    Returns:
        扫描结果摘要
    """
    if month is None:
        month = datetime.now().strftime("%Y-%m")

    logger.info(f"[seller_scan] 开始月度扫描: {marketplace}/{month}")

    result: Dict[str, Any] = {
        "status": "ok",
        "marketplace": marketplace,
        "month": month,
        "total_products": 0,
        "total_sellers": 0,
        "profiled_count": 0,
        "s_grade_count": 0,
        "a_grade_count": 0,
        "heat_categories": 0,
        "follow_signals": 0,
        "recommendations": 0,
        "errors": [],
    }

    # ── Step 1: 从 Java 拉取原始数据 ──
    raw_data: Dict[str, List[Dict[str, Any]]] = {}
    dengzong_names: set = set()

    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # 获取郑总店铺名单
        try:
            dengzong_shops = await client.get_dengzong_shops(marketplace)
            dengzong_names = set(dengzong_shops)
            logger.info(f"[seller_scan] 郑总店铺: {len(dengzong_names)} 个")
        except Exception as e:
            logger.warning(f"[seller_scan] 无法获取郑总名单: {e}")

        # 获取全量卖家商品数据
        try:
            raw_data = await client.get_seller_raw_products(
                marketplace=marketplace,
                month=month,
            )
            logger.info(
                f"[seller_scan] 原始数据: {sum(len(v) for v in raw_data.values())} 商品, "
                f"{len(raw_data)} 卖家"
            )
        except Exception as e:
            logger.warning(f"[seller_scan] Java 卖家数据不可用: {e}")
            result["status"] = "degraded"
            result["errors"].append(f"Java 数据不可用: {e}")
            return result

    except Exception as e:
        result["status"] = "error"
        result["errors"].append(f"Java 客户端初始化失败: {e}")
        logger.error(f"[seller_scan] Java 客户端不可用: {e}")
        return result

    if not raw_data:
        result["status"] = "empty"
        result["errors"].append("无卖家数据")
        return result

    # ── Step 2: 计算所有商品实力分 ──
    all_products = []
    products_by_seller: Dict[str, List[Dict[str, Any]]] = {}
    products_by_category: Dict[str, List[Dict[str, Any]]] = {}

    for seller_name, products in raw_data.items():
        for p in products:
            p["_seller_name"] = seller_name
            all_products.append(p)

            if seller_name not in products_by_seller:
                products_by_seller[seller_name] = []
            products_by_seller[seller_name].append(p)

            cat = p.get("category", p.get("nodeName", "Unknown"))
            if cat not in products_by_category:
                products_by_category[cat] = []
            products_by_category[cat].append(p)

    result["total_products"] = len(all_products)
    result["total_sellers"] = len(products_by_seller)

    strength_scores = compute_product_strength_score(all_products)
    logger.info(f"[seller_scan] 商品实力分: {len(strength_scores)} 条")

    # ── Step 3: 逐卖家计算聪明卖家评分 ──
    all_profits: List[float] = []
    for seller_name, products in products_by_seller.items():
        profits = [
            (p.get("profit", 0) or 0) / (p.get("price", 1) or 1)
            for p in products
        ]
        if profits:
            all_profits.append(sum(profits) / len(profits))

    profiles: List[SellerProfile] = []
    dengzong_profiles: List[SellerProfile] = []
    external_profiles: List[SellerProfile] = []
    seller_grades: Dict[str, str] = {}

    for seller_name, products in products_by_seller.items():
        is_dz = seller_name in dengzong_names
        try:
            profile = compute_smart_seller_score(
                seller_name=seller_name,
                seller_products=products,
                strength_scores=strength_scores,
                all_seller_profits=all_profits,
                is_dengzong=is_dz,
            )
            profile.marketplace = marketplace
            profile.month = month
            profiles.append(profile)
            seller_grades[seller_name] = profile.grade

            if is_dz:
                dengzong_profiles.append(profile)
            else:
                external_profiles.append(profile)

            if profile.grade == "S":
                result["s_grade_count"] += 1
            elif profile.grade == "A":
                result["a_grade_count"] += 1

        except Exception as e:
            logger.warning(f"[seller_scan] 卖家 {seller_name} 评分失败: {e}")

    result["profiled_count"] = len(profiles)
    logger.info(
        f"[seller_scan] 卖家画像: {len(profiles)} 个 "
        f"(S:{result['s_grade_count']}, A:{result['a_grade_count']})"
    )

    # ── Step 4: 品类热度矩阵 ──
    heat_rows: List[CategoryHeatRow] = []
    try:
        heat_rows = build_category_heat_matrix(
            dengzong_profiles=dengzong_profiles,
            external_profiles=external_profiles,
            products_by_category=products_by_category,
        )
        result["heat_categories"] = len(heat_rows)
        logger.info(f"[seller_scan] 品类热度: {len(heat_rows)} 行")
    except Exception as e:
        result["errors"].append(f"热度矩阵构建失败: {e}")
        logger.error(f"[seller_scan] 热度矩阵失败: {e}")

    # ── Step 5: 跟品信号 ──
    follow_signals: List[FollowSignal] = []
    try:
        follow_signals = detect_follow_signals(
            products_by_category=products_by_category,
            seller_grades=seller_grades,
            dengzong_names=dengzong_names,
        )
        result["follow_signals"] = len(follow_signals)
        logger.info(f"[seller_scan] 跟品信号: {len(follow_signals)} 条")
    except Exception as e:
        result["errors"].append(f"跟品信号检测失败: {e}")
        logger.error(f"[seller_scan] 跟品信号失败: {e}")

    # ── Step 6: 智能推荐 ──
    recommendations: List[SmartRecommendation] = []
    try:
        recommendations = generate_smart_recommendations(
            heat_matrix=heat_rows,
            follow_signals=follow_signals,
        )
        result["recommendations"] = len(recommendations)
        logger.info(f"[seller_scan] 智能推荐: {len(recommendations)} 条")
    except Exception as e:
        result["errors"].append(f"智能推荐生成失败: {e}")
        logger.error(f"[seller_scan] 推荐失败: {e}")

    # ── Step 7: 回写 Java ──
    try:
        client = get_java_client()

        # 回写卖家画像
        profile_dicts = [p.to_dict() for p in profiles]
        await client.post_seller_profiles(profile_dicts)

        # 回写跟品信号
        signal_dicts = [s.to_dict() for s in follow_signals]
        await client.post_follow_signals(signal_dicts)

        logger.info(
            f"[seller_scan] 回写成功: "
            f"{len(profile_dicts)} 画像 + {len(signal_dicts)} 信号"
        )
    except Exception as e:
        result["errors"].append(f"回写失败: {e}")
        logger.warning(f"[seller_scan] 回写失败: {e}")

    logger.info(
        f"[seller_scan] 完成: {result['total_sellers']} 卖家, "
        f"{result['heat_categories']} 热度品类, "
        f"{result['follow_signals']} 信号, "
        f"{result['recommendations']} 推荐"
    )

    return result
