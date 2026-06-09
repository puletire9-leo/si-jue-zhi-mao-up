"""全品类蓝海扫描 Pipeline — 独立于 LangGraph 的批处理管道。

流程（§9.1）:
  1. Java API → 全品类10维原始指标（聚合SQL）
  2. Python → 百分位归一化 + 分型 + 排名
  3. 每品类 → 测品推荐（TOP20 品类）
  4. LLM → 品类机会卡（分批10个/批，可选）
  5. 回写 Java blue_ocean_snapshots 表

纯函数层（category_scanner.py）与本管道（I/O + 编排）分离。
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from selection.algorithms.category_scanner import (
    compute_10_dimension_radar,
    classify_opportunity_type,
    rank_categories,
    recommend_test_products,
    generate_category_opportunity_card,
    CategoryRadar,
    CategoryOpportunityRanking,
)
from selection.java_client import get_java_client
from selection.llm_utils import call_llm_json
from selection.prompt_templates import (
    BLUE_OCEAN_OPPORTUNITY_CARD_PROMPT,
    BLUE_OCEAN_OVERVIEW_PROMPT,
)
from selection.algorithms.blue_ocean_radar import enhance_with_seller_signals

logger = logging.getLogger(__name__)

# 默认测品品类数（只对 TOP N 品类做测品推荐以减少 Java 查询）
DEFAULT_TEST_PRODUCT_TOP_N = 20

# LLM 批量大小
LLM_BATCH_SIZE = 10


async def run_full_category_scan(
    marketplace: str = "UK",
    month: Optional[str] = None,
    call_llm: bool = True,
) -> Dict[str, Any]:
    """全品类蓝海扫描主流程。

    Args:
        marketplace: 站点 UK/DE/US
        month:       数据月份（默认当前月）
        call_llm:    是否调用 LLM 生成机会卡解读

    Returns:
        扫描结果摘要 {
            "marketplace", "month", "total_categories",
            "rankings": [...], "opportunity_cards": [...], ...
        }
    """
    if month is None:
        month = datetime.now().strftime("%Y-%m")

    client = get_java_client()

    # ── Step 1: 获取全品类10维原始指标 ──
    logger.info(f"[blue_ocean_scan] Step1: 获取品类聚合数据 {marketplace}/{month}")
    try:
        agg_data = await client.get_category_aggregation(marketplace, month)
    except AttributeError:
        logger.warning(
            "[blue_ocean_scan] JavaClient.get_category_aggregation 未实现，"
            "返回空结果"
        )
        return {
            "status": "error",
            "message": "Java 后端 /api/v1/blue-ocean/category-aggregation 未就绪",
            "marketplace": marketplace,
            "month": month,
        }

    if not agg_data:
        return {
            "status": "empty",
            "message": "无品类聚合数据",
            "marketplace": marketplace,
            "month": month,
        }

    logger.info(f"[blue_ocean_scan] 获取到 {len(agg_data)} 个品类聚合数据")

    # ── Step 2: Python 10维雷达 + 分型 + 排名 ──
    radars: List[CategoryRadar] = []
    for cat_metrics in agg_data:
        try:
            radar = compute_10_dimension_radar(cat_metrics, agg_data)
            radars.append(radar)
        except Exception as e:
            logger.warning(
                f"[blue_ocean_scan] 雷达计算失败 "
                f"({cat_metrics.get('category', '?')}): {e}"
            )

    rankings = rank_categories(radars)
    logger.info(
        f"[blue_ocean_scan] Step2: {len(rankings)} 品类排名完成, "
        f"TOP3: {[r.category_name for r in rankings[:3]]}"
    )

    # ── Step 3: 测品推荐（TOP20品类） ──
    opportunity_cards = []
    top_n = rankings[:DEFAULT_TEST_PRODUCT_TOP_N]

    for ranking in top_n:
        try:
            # 获取品类内商品
            cat_products = await client.get_category_products(
                marketplace=marketplace,
                month=month,
                category=ranking.category_name,
            )
        except AttributeError:
            # Java 端点未实现，跳过测品推荐
            cat_products = []
        except Exception as e:
            logger.warning(
                f"[blue_ocean_scan] 获取品类商品失败 "
                f"({ranking.category_name}): {e}"
            )
            cat_products = []

        test_products = recommend_test_products(
            cat_products, ranking.radar
        ) if cat_products else []

        card = generate_category_opportunity_card(ranking, test_products)
        card["rank"] = rankings.index(ranking) + 1
        opportunity_cards.append(card)

    # ── Step 4: LLM 解读（可选） ──
    if call_llm:
        await _generate_llm_cards(opportunity_cards, marketplace, month)
        await _generate_llm_overview(rankings, marketplace, month)

    # ── Step 5: 卖家信号增强 ──
    seller_profiles = await _fetch_seller_profiles(client, marketplace)
    for card in opportunity_cards:
        cat_name = card.get("category_name", "")
        if cat_name in seller_profiles:
            _inject_seller_signals(card, seller_profiles[cat_name])

    # ── Step 6: 回写 Java ──
    try:
        await client.post_blue_ocean_results({
            "marketplace": marketplace,
            "month": month,
            "rankings": [r.to_dict() for r in rankings],
            "opportunity_cards": opportunity_cards,
            "generated_at": datetime.now().isoformat(),
        })
        writeback_ok = True
    except AttributeError:
        logger.info("[blue_ocean_scan] Java post_blue_ocean_results 未实现，跳过回写")
        writeback_ok = False
    except Exception as e:
        logger.error(f"[blue_ocean_scan] 回写失败: {e}")
        writeback_ok = False

    # ── 统计 ──
    type_counts: Dict[str, int] = {}
    for r in rankings:
        t = r.opportunity_type
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "status": "ok",
        "marketplace": marketplace,
        "month": month,
        "total_categories": len(rankings),
        "type_counts": type_counts,
        "top5": [
            {
                "category": r.category_name,
                "type": r.opportunity_label,
                "score": r.composite_score,
            }
            for r in rankings[:5]
        ],
        "writeback_ok": writeback_ok,
        "opportunity_cards": opportunity_cards,
    }


async def _generate_llm_cards(
    cards: List[Dict],
    marketplace: str,
    month: str,
) -> None:
    """分批调用 LLM 为品类机会卡生成解读。"""
    for i in range(0, len(cards), LLM_BATCH_SIZE):
        batch = cards[i:i + LLM_BATCH_SIZE]
        tasks = [
            _generate_single_card(card, marketplace, month)
            for card in batch
        ]
        await asyncio.gather(*tasks, return_exceptions=True)


async def _generate_single_card(
    card: Dict,
    marketplace: str,
    month: str,
) -> None:
    """为单个品类机会卡调用 LLM。"""
    dims = card.get("radar", {})
    test_products = card.get("test_products", [])

    # 构建测品表格
    if test_products:
        rows = [
            f"| {p['asin']} | {p['listing_days']}天 | {p['monthly_units']}单 | "
            f"£{p['profit']} | {p['ratings']}评 | {', '.join(p['reasons'])} |"
            for p in test_products
        ]
        product_table = (
            "| ASIN | 上架 | 月销 | 利润 | 评论 | 理由 |\n"
            "|------|------|------|------|------|------|\n"
            + "\n".join(rows)
        )
    else:
        product_table = "（无测品推荐数据）"

    # 原型描述
    archetype_descs = {
        "DA": "装饰艺术 — 视觉驱动、图案裂变",
        "FH": "功能家居 — 实用驱动、性价比",
        "FP": "时尚个人 — 风格驱动、身份认同",
        "TN": "趋势潮流 — 热度驱动、快速迭代",
        "PE": "派对活动 — 文化驱动、高销量",
        "PS": "纸品文具 — 极轻、图案裂变",
        "BASIC": "通用原型",
        "UNKNOWN": "未分类",
    }
    archetype = card.get("archetype", "UNKNOWN")

    prompt = BLUE_OCEAN_OPPORTUNITY_CARD_PROMPT.format(
        marketplace=marketplace,
        month=month,
        category_name=card.get("category_name", ""),
        archetype=archetype,
        archetype_desc=archetype_descs.get(archetype, "未知"),
        total=card.get("total_products", 0),
        new_count=0,  # 待 Java 聚合提供
        opportunity_type=card.get("opportunity_label", ""),
        d1=dims.get("D1", 50),
        d2=dims.get("D2", 50),
        d3=dims.get("D3", 50),
        d4=dims.get("D4", 50),
        d5=dims.get("D5", 50),
        d6=dims.get("D6", 50),
        d7=dims.get("D7", 50),
        d8=dims.get("D8", 50),
        d9=dims.get("D9", 50),
        d10=dims.get("D10", 50),
        test_product_table=product_table,
    )

    try:
        result = await call_llm_json(prompt, {}, "blue_ocean_card")
        if result:
            card["llm_summary"] = result.get("summary", "")
            card["entry_difficulty"] = result.get("entry_difficulty", "")
            card["entry_angle"] = result.get("entry_angle", "")
            card["top_pick"] = result.get("top_pick", "")
            card["risks"] = result.get("risks", [])
            card["llm_confidence"] = result.get("confidence", 0)
    except Exception as e:
        logger.warning(
            f"[blue_ocean_scan] LLM 机会卡失败 "
            f"({card.get('category_name', '?')}): {e}"
        )


async def _generate_llm_overview(
    rankings: List[CategoryOpportunityRanking],
    marketplace: str,
    month: str,
) -> Optional[Dict]:
    """调用 LLM 生成全品类概览。"""
    # 按分型分组
    groups: Dict[str, List[str]] = {
        "blue_ocean": [],
        "red_seam": [],
        "niche": [],
        "watch": [],
        "neutral": [],
    }
    archetype_dist: Dict[str, int] = {}

    for r in rankings:
        groups.setdefault(r.opportunity_type, []).append(r.category_name)

    prompt = BLUE_OCEAN_OVERVIEW_PROMPT.format(
        marketplace=marketplace,
        month=month,
        blue_ocean_count=len(groups.get("blue_ocean", [])),
        blue_ocean_list=", ".join(groups.get("blue_ocean", [])[:10]),
        red_seam_count=len(groups.get("red_seam", [])),
        red_seam_list=", ".join(groups.get("red_seam", [])[:10]),
        niche_count=len(groups.get("niche", [])),
        niche_list=", ".join(groups.get("niche", [])[:5]),
        watch_count=len(groups.get("watch", [])),
        watch_list=", ".join(groups.get("watch", [])[:5]),
        neutral_count=len(groups.get("neutral", [])),
        neutral_list=", ".join(groups.get("neutral", [])[:5]),
        archetype_distribution="(待 Java 聚合提供品类-原型映射)",
    )

    try:
        result = await call_llm_json(prompt, {}, "blue_ocean_overview")
        logger.info("[blue_ocean_scan] 全品类概览 LLM 生成完成")
        return result
    except Exception as e:
        logger.warning(f"[blue_ocean_scan] LLM 概览失败: {e}")
        return None


async def _fetch_seller_profiles(
    client,
    marketplace: str,
) -> Dict[str, Dict[str, Any]]:
    """从 Java 拉取卖家画像数据（按品类分组）。降级返回空。"""
    try:
        raw = await client.get_seller_profiles_by_category(
            marketplace=marketplace,
            category="__all__",
        )
        if isinstance(raw, dict):
            return raw
        return {}
    except AttributeError:
        return {}
    except Exception as e:
        logger.warning(f"[blue_ocean_scan] 拉取卖家画像失败（忽略）: {e}")
        return {}


def _inject_seller_signals(
    card: Dict[str, Any],
    profiling: Dict[str, Any],
) -> None:
    """将卖家信号注入单个品类机会卡（原地修改）。"""
    dengzong = profiling.get("dengzong_count", 0)
    ext_s = profiling.get("external_s_count", 0)
    total = profiling.get("total_sellers", 0)
    heat = profiling.get("heat_signal", "")
    recs = profiling.get("recommendations", [])

    seller_diversity_score = min(100, (dengzong + ext_s) * 15 + 20)
    if total == 0:
        seller_diversity_score = 0

    card["seller_diversity"] = seller_diversity_score
    card["seller_heat_signal"] = heat

    for r in recs[:2]:
        rec_type = r.get("rec_type", "")
        reason = r.get("reason", "")
        if rec_type == "dengzong_validated":
            card.setdefault("recommendations", []).append(
                f"卖家交叉验证: {reason}"
            )
        elif rec_type == "blind_spot":
            card.setdefault("recommendations", []).append(
                f"卖家盲区: {reason}"
            )

    card["seller_signal"] = {
        "sellerDensityScore": seller_diversity_score,
        "heatSignal": heat,
        "dengzongCount": dengzong,
        "externalSmartCount": ext_s,
        "topRecommendation": recs[0] if recs else None,
    }
