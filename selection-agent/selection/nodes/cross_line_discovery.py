"""节点7: cross_line_discovery — 跨品线关联发现。

对应能力: §三.7 跨品线关联与套利发现
输入: 当前小类 + 同批次其他品线概览
输出: State.cross_line_insights
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import CROSS_LINE_DISCOVERY_PROMPT

logger = logging.getLogger(__name__)


async def cross_line_discovery_node(state: SelectionState) -> Dict[str, Any]:
    """发现当前品类与其他品线的关联机会。"""
    logger.info("[能力7] 跨品线关联 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    raw_data = state.get("raw_data", {})

    # 构建其他品线概览（不含当前品类的详细数据）
    other_lines_overview = []
    for pl in raw_data.get("productLines", []):
        other_lines_overview.append({
            "bsrId": pl.get("bsrId", ""),
            "productCount": pl.get("productCount", 0),
            "totalUnits": pl.get("totalUnits", 0),
            "subCategoryCount": pl.get("subCategoryCount", 0),
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
    }

    result = await call_llm_json(
        CROSS_LINE_DISCOVERY_PROMPT, input_data, "cross_line_discovery"
    )

    if result is None:
        return {
            "cross_line_insights": {},
            "analysis_errors": state.get("analysis_errors", [])
            + ["跨品线关联 LLM 调用失败"],
        }

    return {"cross_line_insights": result}
