"""节点8: final_verdict — 最终裁决。

对应能力: §三.8 推荐等级 + 机会评分 + 行动计划
输入: 节点1-7的全部输出
输出: State.final_verdict, State.recommend_level, State.opportunity_score
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import FINAL_VERDICT_PROMPT

logger = logging.getLogger(__name__)


async def final_verdict_node(state: SelectionState) -> Dict[str, Any]:
    """综合所有分析结果，给出最终裁决。"""
    logger.info("[能力8] 最终裁决 — 开始")

    input_data = {
        "categoryUnderstanding": state.get("category_understanding", {}),
        "archetype": state.get("current_archetype", "UNKNOWN"),
        "competitionStructure": state.get("competition_structure", {}),
        "lifecycleStage": state.get("lifecycle_stage", {}),
        "profitFeasibility": state.get("profit_feasibility", {}),
        "differentiation": state.get("differentiation_result", {}),
        "riskRadar": state.get("risk_radar", {}),
        "goNoGo": state.get("go_no_go", "WAIT_AND_SEE"),
        "crossLineInsights": state.get("cross_line_insights", {}),
    }

    result = await call_llm_json(FINAL_VERDICT_PROMPT, input_data, "final_verdict")

    if result is None:
        return {
            "final_verdict": {},
            "recommend_level": "WATCH",
            "opportunity_score": 0,
            "analysis_errors": state.get("analysis_errors", [])
            + ["最终裁决 LLM 调用失败"],
        }

    return {
        "final_verdict": result,
        "recommend_level": result.get("recommendLevel", "WATCH"),
        "opportunity_score": result.get("opportunityScore", 0),
    }
