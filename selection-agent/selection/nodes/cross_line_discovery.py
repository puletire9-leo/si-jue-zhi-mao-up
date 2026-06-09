"""节点7: cross_line_discovery — 跨品线关联发现。

对应能力: §三.7 跨品线关联与套利发现
输入: 当前小类 + 同批次其他品线概览
输出: State.cross_line_insights

改造: 增加确定性跨站套利算法层（doc 13 Phase 1），
      先检测同ASIN跨站空白，LLM 再做深度解读。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import CROSS_LINE_DISCOVERY_PROMPT
from selection.algorithms.cross_marketplace_arbitrage import (
    detect_cross_marketplace_opportunities,
)

logger = logging.getLogger(__name__)


async def cross_line_discovery_node(state: SelectionState) -> Dict[str, Any]:
    """发现当前品类与其他品线的关联机会。

    三步架构:
      1. 确定性跨站套利算法（同ASIN跨站存在性检测）
      2. LLM 增强解读（跨品线 + 跨站点综合）
      3. 降级兜底（返回纯算法结果）
    """
    logger.info("[能力7] 跨品线关联 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    raw_data = state.get("raw_data", {})
    marketplace = state.get("marketplace", "UK")
    _other_mp_map = {"UK": "DE", "DE": "UK", "US": "UK"}
    other_mp = _other_mp_map.get(marketplace, "UK")

    # ═══ Step 1: 确定性跨站点套利分析 ═══
    current_products = sub.get("products", [])
    other_raw = state.get("raw_data_other_marketplace", {})
    other_product_lines = other_raw.get("productLines", [])
    other_products = other_product_lines[0].get("products", []) if other_product_lines else []

    arbitrage_result = None
    if other_products:
        try:
            arbitrage_result = detect_cross_marketplace_opportunities(
                current_products=current_products,
                other_products=other_products,
                current_marketplace=marketplace,
                other_marketplace=other_mp,
            )
            logger.info(
                f"[能力7] 跨站套利: {arbitrage_result.opportunities_found} 机会, "
                f"{len(arbitrage_result.strong_opportunities)} 强信号"
            )
        except Exception as e:
            logger.warning(f"[能力7] 跨站套利算法异常: {e}")
    else:
        logger.info(f"[能力7] 无对站数据，跳过跨站套利分析")

    # ═══ Step 2: LLM 增强（原有逻辑 + 注入套利结果） ═══
    # 构建其他品线概览（包含更多可用字段）
    other_lines_overview = []
    for pl in raw_data.get("productLines", []):
        other_lines_overview.append({
            "bsrId": pl.get("bsrId", ""),
            "nodeName": pl.get("nodeName", ""),
            "productCount": pl.get("productCount", 0),
            "totalUnits": pl.get("totalUnits", 0),
            "totalRevenue": pl.get("totalRevenue", 0),
            "avgPrice": pl.get("avgPrice", 0),
            "unitsGrowthRate": pl.get("unitsGrowthRate", 0),
        })

    input_data = {
        "currentCategory": {
            "nodeName": sub.get("nodeName", ""),
            "bsrId": sub.get("_bsr_id", ""),
            "archetype": state.get("current_archetype", "UNKNOWN"),
            "avgPrice": sub.get("avgPrice", 0),
            "topBrands": sub.get("topBrands", []),
        },
        "otherProductLines": other_lines_overview,
        # 跨站点套利数据
        "crossMarketData": {
            "currentMarketplace": marketplace,
            "availableMarketplaces": ["UK", "DE", "US"],
            "currentAvgPrice": sub.get("avgPrice", 0),
            "currentTotalUnits": sub.get("totalUnits", 0),
            "currentGrowthRate": sub.get("unitsGrowthRate", 0),
        },
        # 注入确定性算法结果（原有 + 新增跨站套利）
        "algorithmPrecompute": {
            "competitionStructure": state.get("competition_structure", {}),
            "lifecycleStage": state.get("lifecycle_stage", {}),
            "profitFeasibility": state.get("profit_feasibility", {}),
            "currentScore": {
                "typicalMargin": state.get("profit_margin_typical", 0),
                "goNoGo": state.get("go_no_go", "WAIT_AND_SEE"),
            },
            # 新增: 跨站套利检测结果
            "crossMarketArbitrage": (
                arbitrage_result.to_dict() if arbitrage_result else None
            ),
        },
    }

    result = await call_llm_json(
        CROSS_LINE_DISCOVERY_PROMPT, input_data, "cross_line_discovery"
    )

    # ═══ Step 3: 降级兜底 ──
    if result is None:
        return {
            "cross_line_insights": {
                "algorithmOnly": True,
                "crossMarketArbitrage": (
                    arbitrage_result.to_dict() if arbitrage_result else {}
                ),
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["跨品线关联 LLM 调用失败"],
        }

    return {"cross_line_insights": result}
