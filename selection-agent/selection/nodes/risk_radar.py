"""节点6: risk_radar — 风险雷达扫描。

对应能力: §三.6 6类风险评估 + GoNoGo判断
输入: 前面所有节点的输出
输出: State.risk_radar, State.go_no_go
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import RISK_RADAR_PROMPT

logger = logging.getLogger(__name__)


async def risk_radar_node(state: SelectionState) -> Dict[str, Any]:
    """扫描6大类风险，给出Go/NoGo判断。"""
    logger.info("[能力6] 风险雷达 — 开始")

    input_data = {
        "categoryUnderstanding": state.get("category_understanding", {}),
        "competitionStructure": state.get("competition_structure", {}),
        "lifecycleStage": state.get("lifecycle_stage", {}),
        "profitFeasibility": state.get("profit_feasibility", {}),
        "differentiation": state.get("differentiation_result", {}),
    }

    result = await call_llm_json(RISK_RADAR_PROMPT, input_data, "risk_radar")

    if result is None:
        return {
            "risk_radar": {},
            "go_no_go": "WAIT_AND_SEE",
            "analysis_errors": state.get("analysis_errors", [])
            + ["风险雷达 LLM 调用失败"],
        }

    return {
        "risk_radar": result,
        "go_no_go": result.get("goNoGo", "WAIT_AND_SEE"),
    }
