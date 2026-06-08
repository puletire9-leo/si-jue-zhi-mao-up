"""节点4: profit_estimation — 利润可行性推算。

对应能力: §三.4 三场景利润估算 + 盈亏平衡
输入: avgPrice, bsrId, shippingProfile, totalUnits
输出: State.profit_feasibility, State.profit_margin_typical

改造: 先跑 calculate_batch_profit()，提取 typical_margin，LLM 只做风险分析。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import PROFIT_ESTIMATION_PROMPT
from selection.algorithms.profit_calculator import calculate_batch_profit

logger = logging.getLogger(__name__)


async def profit_estimation_node(state: SelectionState) -> Dict[str, Any]:
    """估算三场景利润率，确定盈亏平衡点。"""
    logger.info("[能力4] 利润推算 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    archetype = state.get("current_archetype", "UNKNOWN")
    marketplace = state.get("marketplace", "UK")

    # ── Step 1: 确定性利润计算 ──
    avg_price = float(sub.get("avgPrice", 0))
    sample_products = sub.get("sampleProducts", [])[:10]
    batch_result = calculate_batch_profit(sample_products, avg_price, marketplace)
    typical_margin = batch_result["marginEstimate"]["typical"]["margin"]
    logger.info(f"[能力4] 批量利润: typical_margin={typical_margin}%, "
                f"verdict={batch_result['verdict']}")

    # ── Step 2: LLM 风险分析（注入算法结果） ──
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": avg_price,
        "priceMin": sub.get("priceMin", 0),
        "priceMax": sub.get("priceMax", 0),
        "totalUnits": sub.get("totalUnits", 0),
        "bsrId": sub.get("_bsr_id", ""),
        "archetype": archetype,
        # 注入确定性算法结果
        "algorithmPrecompute": {
            "marginEstimate": batch_result["marginEstimate"],
            "shippingProfile": batch_result["shippingProfile"],
            "platformFees": batch_result["platformFees"],
            "verdict": batch_result["verdict"],
            "sampleCount": batch_result["sampleCount"],
            "computedCount": batch_result["computedCount"],
            "allMargins": batch_result["allMargins"],
        },
    }

    result = await call_llm_json(
        PROFIT_ESTIMATION_PROMPT, input_data, "profit_estimation"
    )

    if result is None:
        # LLM 失败，算法结果仍可用
        return {
            "profit_feasibility": {
                "marginEstimate": batch_result["marginEstimate"],
                "shippingProfile": batch_result["shippingProfile"],
                "platformFees": batch_result["platformFees"],
                "verdict": batch_result["verdict"],
            },
            "profit_margin_typical": typical_margin,
            "analysis_errors": state.get("analysis_errors", [])
            + ["利润推算 LLM 调用失败，使用确定性算法结果"],
        }

    # LLM 成功：保留 LLM 的风险分析，但利润率用算法值
    result["marginEstimate_computed"] = batch_result["marginEstimate"]
    result["verdict_computed"] = batch_result["verdict"]
    return {
        "profit_feasibility": result,
        "profit_margin_typical": typical_margin,
    }
