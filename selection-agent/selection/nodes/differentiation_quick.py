"""节点5b: differentiation_quick — 差异化切入点（快速版）。

触发条件: profit_margin_typical < 30%
输出: State.differentiation_result（1个快速建议）
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import DIFFERENTIATION_QUICK_PROMPT

logger = logging.getLogger(__name__)


async def differentiation_quick_node(state: SelectionState) -> Dict[str, Any]:
    """低利润品类 — 生成1个快速建议。"""
    logger.info("[能力5-quick] 差异化（快速版） — 开始")

    sub = state.get("sub_categories", [{}])[0]
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": sub.get("avgPrice", 0),
        "archetype": state.get("current_archetype", "UNKNOWN"),
        "competition": state.get("competition_structure", {}),
        "profitMargin": state.get("profit_margin_typical", 0),
    }

    result = await call_llm_json(
        DIFFERENTIATION_QUICK_PROMPT, input_data, "differentiation_quick"
    )

    if result is None:
        return {
            "differentiation_result": {
                "strategies": [],
                "llmFailed": True,
                "fallbackNote": "LLM调用失败，差异化快速分析不可用，评分已降级",
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["差异化快速分析 LLM 调用失败"],
        }

    return {"differentiation_result": result}
