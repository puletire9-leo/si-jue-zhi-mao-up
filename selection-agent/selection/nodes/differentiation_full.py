"""节点5a: differentiation_full — 差异化切入点（完整版）。

触发条件: profit_margin_typical >= 30%
输出: State.differentiation_result（3个完整方案）
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import DIFFERENTIATION_FULL_PROMPT

logger = logging.getLogger(__name__)


async def differentiation_full_node(state: SelectionState) -> Dict[str, Any]:
    """高利润品类 — 生成3个差异化切入方案。"""
    logger.info("[能力5-full] 差异化（完整版） — 开始")

    sub = state.get("sub_categories", [{}])[0]
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": sub.get("avgPrice", 0),
        "priceMin": sub.get("priceMin", 0),
        "priceMax": sub.get("priceMax", 0),
        "archetype": state.get("current_archetype", "UNKNOWN"),
        "competition": state.get("competition_structure", {}),
        "lifecycle": state.get("lifecycle_stage", {}),
        "profitMargin": state.get("profit_margin_typical", 0),
    }

    result = await call_llm_json(
        DIFFERENTIATION_FULL_PROMPT, input_data, "differentiation_full"
    )

    if result is None:
        return {
            "differentiation_result": {},
            "analysis_errors": state.get("analysis_errors", [])
            + ["差异化完整分析 LLM 调用失败"],
        }

    return {"differentiation_result": result}
