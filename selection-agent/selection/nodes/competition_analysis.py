"""节点2: competition_analysis — 竞争格局解剖。

对应能力: §三.2 市场竞争格局分析
输入: topBrands, sampleProducts, avgPrice, BSR/评价数据
输出: State.competition_structure

改造: 先跑 calculate_cr3() + analyze_price_band()，注入算法结果，LLM 只做品牌定位分析。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import COMPETITION_ANALYSIS_PROMPT
from selection.algorithms.cr3_calculator import calculate_cr3
from selection.algorithms.price_band import analyze_price_band
from selection.algorithms.blue_ocean_radar import detect_blue_ocean

logger = logging.getLogger(__name__)


async def competition_analysis_node(state: SelectionState) -> Dict[str, Any]:
    """分析竞争格局、价格带分布、品牌集中度。"""
    logger.info("[能力2] 竞争格局 — 开始")

    sub = state.get("sub_categories", [{}])[0]

    # ── Step 1: 确定性算法 ──
    top_brands = sub.get("topBrands", [])
    product_count = sub.get("productCount", 0)
    cr3_result = calculate_cr3(top_brands, product_count)
    logger.info(f"[能力2] CR3={cr3_result.cr3}, pattern={cr3_result.pattern}")

    price_min = sub.get("priceMin", 0)
    price_max = sub.get("priceMax", 0)
    avg_price = sub.get("avgPrice", 0)
    price_band_result = analyze_price_band(
        price_min, price_max, avg_price,
        band_counts=sub.get("priceBandCounts"),
        marketplace=state.get("marketplace", "UK"),
    )
    logger.info(f"[能力2] 价格带: dominant={price_band_result.dominant_band}, "
                f"gaps={len(price_band_result.price_gaps)}")

    # ── Step 1b: 蓝海雷达 ──
    blue_ocean_result = detect_blue_ocean(
        category_label=sub.get("nodeName", ""),
        marketplace=state.get("marketplace", "UK"),
        cr3=cr3_result.cr3,
        entry_barrier=cr3_result.entry_barrier,
        units_growth_rate=float(sub.get("unitsGrowthRate", 0)),
        avg_ratings=float(sub.get("avgRatings", 0)),
        avg_rating=float(sub.get("avgRating", 0)),
        avg_price=float(avg_price),
        price_range=float(price_max) - float(price_min) if price_max and price_min else 0,
        price_gaps=price_band_result.price_gaps,
        product_count=product_count,
    )
    logger.info(f"[能力2] 蓝海: score={blue_ocean_result.overall_score}, class={blue_ocean_result.classification}")

    # ── Step 2: LLM 解读（注入算法结果） ──
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "productCount": product_count,
        "avgPrice": avg_price,
        "priceMin": price_min,
        "priceMax": price_max,
        "avgBsr": sub.get("avgBsr", 0),
        "avgRating": sub.get("avgRating", 0),
        "avgRatings": sub.get("avgRatings", 0),
        "topBrands": top_brands,
        "storeNames": sub.get("storeNames", []),
        "bestSellerCount": sub.get("bestSellerCount", 0),
        "amazonChoiceCount": sub.get("amazonChoiceCount", 0),
        "sampleProducts": sub.get("sampleProducts", [])[:10],
        # 注入确定性算法结果
        "algorithmPrecompute": {
            "cr3": cr3_result.to_dict(),
            "priceBand": price_band_result.to_dict(),
            "blueOcean": blue_ocean_result.to_dict(),
        },
    }

    result = await call_llm_json(
        COMPETITION_ANALYSIS_PROMPT, input_data, "competition_analysis"
    )

    if result is None:
        # LLM 失败，算法结果仍可用
        return {
            "competition_structure": {
                "pattern": cr3_result.pattern,
                "cr3": cr3_result.cr3,
                "topBrands": cr3_result.top3_brands,
                "priceGaps": price_band_result.price_gaps,
                "entryBarrier": cr3_result.entry_barrier,
                "priceBand": price_band_result.to_dict(),
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["竞争格局分析 LLM 调用失败，使用确定性算法结果"],
        }

    # 合并：LLM 解读 + 算法硬数据
    result["cr3_computed"] = cr3_result.to_dict()
    result["priceBand_computed"] = price_band_result.to_dict()
    return {"competition_structure": result}
