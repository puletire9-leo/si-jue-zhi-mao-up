"""蓝海全品类扫描 API 路由。

端点:
  POST /blue-ocean/scan               — 触发全品类扫描
  GET  /blue-ocean/scan-results       — 最新扫描结果
  GET  /blue-ocean/scan-results/{month} — 历史扫描结果
  GET  /blue-ocean/category/{name}/opportunity-card — 单品类机会卡
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query, BackgroundTasks

from selection.category_scan_pipeline import run_full_category_scan
from selection.algorithms.category_scanner import (
    compute_10_dimension_radar,
    classify_opportunity_type,
    recommend_test_products,
    generate_category_opportunity_card,
    rank_categories,
    CategoryOpportunityRanking,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blue-ocean", tags=["蓝海扫描"])

# 结果缓存目录
_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data", "blue_ocean",
)


@router.post("/scan")
async def trigger_scan(
    marketplace: str = Query("UK", description="站点"),
    month: Optional[str] = Query(None, description="数据月份（默认当前月）"),
    call_llm: bool = Query(True, description="是否调用LLM生成解读"),
    background_tasks: BackgroundTasks = None,
):
    """触发全品类蓝海扫描。

    扫描是异步的（可能耗时数分钟），结果缓存到 data/blue_ocean/ 目录。
    可通过 GET /scan-results 查询最新结果。
    """
    result = await run_full_category_scan(
        marketplace=marketplace,
        month=month,
        call_llm=call_llm,
    )

    # 缓存结果
    os.makedirs(_CACHE_DIR, exist_ok=True)
    actual_month = month or datetime.now().strftime("%Y-%m")
    cache_path = os.path.join(
        _CACHE_DIR, f"scan_{marketplace}_{actual_month}.json"
    )

    # 移除过大的 detail 数据以减小缓存文件
    cache_result = {
        k: v for k, v in result.items()
        if k != "opportunity_cards"
    }
    cache_result["cards_count"] = len(result.get("opportunity_cards", []))

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache_result, f, ensure_ascii=False, indent=2)

    return result


@router.get("/scan-results")
async def latest_scan_results(
    marketplace: str = Query("UK", description="站点"),
    month: Optional[str] = Query(None, description="数据月份"),
):
    """查询最新扫描结果。"""
    if month is None:
        month = datetime.now().strftime("%Y-%m")

    cache_path = os.path.join(
        _CACHE_DIR, f"scan_{marketplace}_{month}.json"
    )

    if not os.path.exists(cache_path):
        # 尝试找最近的文件
        if os.path.exists(_CACHE_DIR):
            files = sorted(
                [f for f in os.listdir(_CACHE_DIR) if f.startswith(f"scan_{marketplace}_")],
                reverse=True,
            )
            if files:
                cache_path = os.path.join(_CACHE_DIR, files[0])
            else:
                return {"status": "not_found", "message": "无扫描缓存"}
        else:
            return {"status": "not_found", "message": "无扫描缓存"}

    with open(cache_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/scan-results/{month}")
async def history_scan_results(
    month: str,
    marketplace: str = Query("UK", description="站点"),
):
    """查询指定月份的历史扫描结果。"""
    cache_path = os.path.join(
        _CACHE_DIR, f"scan_{marketplace}_{month}.json"
    )
    if not os.path.exists(cache_path):
        return {"status": "not_found", "message": f"无 {marketplace}/{month} 扫描缓存"}
    with open(cache_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/category/{category_name}/opportunity-card")
async def category_opportunity_card(
    category_name: str,
    marketplace: str = Query("UK", description="站点"),
    month: Optional[str] = Query(None, description="数据月份"),
):
    """查询单品类机会卡（实时计算，无LLM）。"""
    if month is None:
        month = datetime.now().strftime("%Y-%m")

    # 尝试从 Java 拉取该品类数据
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        agg_data = await client.get_category_aggregation(marketplace, month)
        cat_metrics = next(
            (c for c in agg_data if c.get("category") == category_name),
            None,
        )

        if not cat_metrics:
            return {
                "status": "not_found",
                "message": f"品类 {category_name} 不在 {marketplace}/{month} 聚合数据中",
            }

        radar = compute_10_dimension_radar(cat_metrics, agg_data)
        opp_type = classify_opportunity_type(radar)

        # 获取商品做测品推荐
        try:
            cat_products = await client.get_category_products(
                marketplace, month, category_name
            )
            test_products = recommend_test_products(cat_products, radar)
        except Exception:
            test_products = []

        # 构建单品类排名
        ranking = CategoryOpportunityRanking(
            category_name=category_name,
            marketplace=marketplace,
            month=month,
            radar=radar,
            opportunity_type=opp_type["type"],
            opportunity_label=opp_type["label"],
            composite_score=sum(
                radar.dimensions.values()
            ) / len(radar.dimensions),
            group_scores={
                "entry_barrier": (
                    radar.dimensions.get("D3", 50) +
                    radar.dimensions.get("D4", 50) +
                    radar.dimensions.get("D5", 50)
                ) / 3,
                "opportunity_quality": (
                    radar.dimensions.get("D1", 50) +
                    radar.dimensions.get("D2", 50) +
                    radar.dimensions.get("D7", 50) +
                    radar.dimensions.get("D10", 50)
                ) / 4,
                "profit_feasibility": (
                    radar.dimensions.get("D6", 50) +
                    radar.dimensions.get("D8", 50) +
                    radar.dimensions.get("D9", 50)
                ) / 3,
            },
        )

        return generate_category_opportunity_card(ranking, test_products)

    except AttributeError:
        return {
            "status": "not_ready",
            "message": "Java 蓝海扫描 API 未就绪",
        }
    except Exception as e:
        logger.error(f"单品类机会卡失败({category_name}): {e}")
        return {
            "status": "error",
            "message": str(e),
        }
