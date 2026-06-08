"""节点1: semantic_understanding — 语义品类理解。

对应能力: §三.1 品类原型匹配 + 消费者画像推理
输入: 当前小类的 node_name, node_full_path, sample_products
输出: State.category_understanding, State.current_archetype
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import SEMANTIC_UNDERSTANDING_PROMPT

logger = logging.getLogger(__name__)


async def semantic_understanding_node(state: SelectionState) -> Dict[str, Any]:
    """分析品类语义，判断原型和消费者画像。"""
    logger.info("[能力1] 语义品类理解 — 开始")

    sub = state.get("sub_categories", [{}])[0]  # 当前小类
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "nodeFullPath": sub.get("nodeFullPath", ""),
        "bsrId": sub.get("_bsr_id", ""),
        "productCount": sub.get("productCount", 0),
        "avgPrice": sub.get("avgPrice", 0),
        "avgRating": sub.get("avgRating", 0),
        "topBrands": sub.get("topBrands", []),
        "sampleProducts": sub.get("sampleProducts", [])[:5],  # 最多5个样本
    }

    result = await call_llm_json(
        SEMANTIC_UNDERSTANDING_PROMPT, input_data, "semantic_understanding"
    )

    if result is None:
        return {
            "category_understanding": {},
            "current_archetype": "UNKNOWN",
            "analysis_errors": state.get("analysis_errors", [])
            + ["语义品类理解 LLM 调用失败"],
        }

    return {
        "category_understanding": result,
        "current_archetype": result.get("archetype", "UNKNOWN"),
    }
