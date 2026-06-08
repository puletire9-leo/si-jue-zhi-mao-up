"""节点4: profit_estimation — 利润可行性推算。

对应能力: §三.4 三场景利润估算 + 盈亏平衡
输入: avgPrice, bsrId, shippingProfile, totalUnits
输出: State.profit_feasibility, State.profit_margin_typical
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import PROFIT_ESTIMATION_PROMPT

logger = logging.getLogger(__name__)


async def profit_estimation_node(state: SelectionState) -> Dict[str, Any]:
    """估算三场景利润率，确定盈亏平衡点。"""
    logger.info("[能力4] 利润推算 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    archetype = state.get("current_archetype", "UNKNOWN")

    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": sub.get("avgPrice", 0),
        "priceMin": sub.get("priceMin", 0),
        "priceMax": sub.get("priceMax", 0),
        "totalUnits": sub.get("totalUnits", 0),
        "bsrId": sub.get("_bsr_id", ""),
        "archetype": archetype,
    }

    result = await call_llm_json(
        PROFIT_ESTIMATION_PROMPT, input_data, "profit_estimation"
    )

    if result is None:
        return {
            "profit_feasibility": {},
            "profit_margin_typical": 0.0,
            "analysis_errors": state.get("analysis_errors", [])
            + ["利润推算 LLM 调用失败"],
        }

    # 提取典型利润率（用于条件分支判断）
    typical_margin = (
        result.get("marginEstimate", {})
        .get("typical", {})
        .get("margin", 0.0)
    )

    return {
        "profit_feasibility": result,
        "profit_margin_typical": typical_margin,
    }
