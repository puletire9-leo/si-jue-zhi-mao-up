"""节点2: competition_analysis — 竞争格局解剖。

对应能力: §三.2 市场竞争格局分析
输入: topBrands, sampleProducts, avgPrice, BSR/评价数据
输出: State.competition_structure
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import COMPETITION_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


async def competition_analysis_node(state: SelectionState) -> Dict[str, Any]:
    """分析竞争格局、价格带分布、品牌集中度。"""
    logger.info("[能力2] 竞争格局 — 开始")

    sub = state.get("sub_categories", [{}])[0]
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "productCount": sub.get("productCount", 0),
        "avgPrice": sub.get("avgPrice", 0),
        "priceMin": sub.get("priceMin", 0),
        "priceMax": sub.get("priceMax", 0),
        "avgBsr": sub.get("avgBsr", 0),
        "avgRating": sub.get("avgRating", 0),
        "avgRatings": sub.get("avgRatings", 0),
        "topBrands": sub.get("topBrands", []),
        "storeNames": sub.get("storeNames", []),
        "bestSellerCount": sub.get("bestSellerCount", 0),
        "amazonChoiceCount": sub.get("amazonChoiceCount", 0),
        "sampleProducts": sub.get("sampleProducts", [])[:10],
    }

    result = await call_llm_json(
        COMPETITION_ANALYSIS_PROMPT, input_data, "competition_analysis"
    )

    if result is None:
        return {
            "competition_structure": {},
            "analysis_errors": state.get("analysis_errors", [])
            + ["竞争格局分析 LLM 调用失败"],
        }

    return {"competition_structure": result}
