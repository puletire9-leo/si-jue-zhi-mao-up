"""节点3: lifecycle_judgment — 生命周期判断。

对应能力: §三.3 品类生命周期阶段判定
输入: unitsGrowthRate, bsrChangeRate, avgRatings, listingAge
输出: State.lifecycle_stage
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import LIFECYCLE_JUDGMENT_PROMPT

logger = logging.getLogger(__name__)


async def lifecycle_judgment_node(state: SelectionState) -> Dict[str, Any]:
    """根据增速信号判断品类生命周期阶段。"""
    logger.info("[能力3] 生命周期判断 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "productCount": sub.get("productCount", 0),
        "totalUnits": sub.get("totalUnits", 0),
        "totalRevenue": sub.get("totalRevenue", 0),
        "unitsGrowthRate": sub.get("unitsGrowthRate", 0),
        "bsrChangeRate": sub.get("bsrChangeRate", 0),
        "avgRatings": sub.get("avgRatings", 0),
        "avgRating": sub.get("avgRating", 0),
        "sampleProducts": sub.get("sampleProducts", [])[:5],
    }

    result = await call_llm_json(
        LIFECYCLE_JUDGMENT_PROMPT, input_data, "lifecycle_judgment"
    )

    if result is None:
        return {
            "lifecycle_stage": {},
            "analysis_errors": state.get("analysis_errors", [])
            + ["生命周期判断 LLM 调用失败"],
        }

    return {"lifecycle_stage": result}
