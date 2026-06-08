"""节点1: semantic_understanding — 语义品类理解。

对应能力: §三.1 品类原型匹配 + 消费者画像推理
输入: 当前小类的 node_name, node_full_path, sample_products
输出: State.category_understanding, State.current_archetype

改造: 先跑 map_archetype() 确定性匹配，再让 LLM 做验证+消费者画像。
LLM 失败时，确定性原型结果仍可用。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import SEMANTIC_UNDERSTANDING_PROMPT
from selection.algorithms.archetype_mapper import map_archetype

logger = logging.getLogger(__name__)


async def semantic_understanding_node(state: SelectionState) -> Dict[str, Any]:
    """分析品类语义，判断原型和消费者画像。"""
    logger.info("[能力1] 语义品类理解 — 开始")

    sub = state.get("sub_categories", [{}])[0]  # 当前小类
    node_name = sub.get("nodeName", "")
    node_full_path = sub.get("nodeFullPath", "")

    # ── Step 1: 确定性原型匹配 ──
    archetype_match = map_archetype(node_name, node_full_path)
    deterministic_archetype = archetype_match.archetype
    logger.info(f"[能力1] 原型映射: {node_name} → {deterministic_archetype} "
                f"(method={archetype_match.match_method}, conf={archetype_match.confidence})")

    # ── Step 2: LLM 验证 + 消费者画像 ──
    input_data = {
        "nodeName": node_name,
        "nodeFullPath": node_full_path,
        "bsrId": sub.get("_bsr_id", ""),
        "productCount": sub.get("productCount", 0),
        "avgPrice": sub.get("avgPrice", 0),
        "avgRating": sub.get("avgRating", 0),
        "topBrands": sub.get("topBrands", []),
        "sampleProducts": sub.get("sampleProducts", [])[:5],
        # 注入确定性算法结果
        "algorithmPrecompute": {
            "archetype": deterministic_archetype,
            "archetypeMethod": archetype_match.match_method,
            "archetypeConfidence": archetype_match.confidence,
            "matchedKeyword": archetype_match.matched_keyword,
        },
    }

    result = await call_llm_json(
        SEMANTIC_UNDERSTANDING_PROMPT, input_data, "semantic_understanding"
    )

    if result is None:
        # LLM 失败时，确定性原型仍可用
        return {
            "category_understanding": {
                "archetype": deterministic_archetype,
                "archetypeMethod": archetype_match.match_method,
                "consumerProfile": {},
                "usageScenarios": [],
                "llmDimensionScores": {},  # LLM失败时无维度评分，L2评分器将使用默认值
            },
            "current_archetype": deterministic_archetype,
            "analysis_errors": state.get("analysis_errors", [])
            + ["语义品类理解 LLM 调用失败，使用确定性原型映射"],
        }

    # LLM 成功：优先用确定性原型（除非 LLM 有强理由覆盖）
    llm_archetype = result.get("archetype", "UNKNOWN")
    final_archetype = deterministic_archetype if deterministic_archetype != "UNKNOWN" else llm_archetype

    return {
        "category_understanding": result,
        "current_archetype": final_archetype,
    }
