"""节点3: lifecycle_judgment — 生命周期判断。

对应能力: §三.3 品类生命周期阶段判定
输入: unitsGrowthRate, bsrChangeRate, avgRatings, listingAge
输出: State.lifecycle_stage

改造: 先跑 detect_lifecycle() 确定性算法，LLM 只做解读和跟品策略建议。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import LIFECYCLE_JUDGMENT_PROMPT
from selection.algorithms.lifecycle_detector import detect_lifecycle

logger = logging.getLogger(__name__)


async def lifecycle_judgment_node(state: SelectionState) -> Dict[str, Any]:
    """根据增速信号判断品类生命周期阶段。"""
    logger.info("[能力3] 生命周期判断 — 开始")

    sub = state.get("sub_categories", [{}])[0]

    # ── Step 1: 确定性生命周期检测 ──
    # 从 competition_structure 获取 CR3（节点2已计算）
    comp = state.get("competition_structure", {})
    cr3_val = comp.get("cr3_computed", {}).get("cr3", comp.get("cr3", 0))

    lifecycle_result = detect_lifecycle(
        units_growth_rate=float(sub.get("unitsGrowthRate", 0)),
        cr3=float(cr3_val),
        avg_ratings=float(sub.get("avgRatings", 0)),
        avg_rating=float(sub.get("avgRating", 0)),
        product_count=int(sub.get("productCount", 0)),
        bsr_change_rate=float(sub.get("bsrChangeRate", 0)),
        listing_days=int(sub.get("avgListingDays", 0)),
    )
    logger.info(f"[能力3] 生命周期: stage={lifecycle_result.stage}, "
                f"window={lifecycle_result.window_of_opportunity}")

    # ── Step 2: LLM 解读 + 跟品策略 ──
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
        # 注入确定性算法结果
        "algorithmPrecompute": {
            "stage": lifecycle_result.stage,
            "stageReason": lifecycle_result.stage_reason,
            "signals": [s.__dict__ for s in lifecycle_result.signals],
            "windowOfOpportunity": lifecycle_result.window_of_opportunity,
            "confidence": lifecycle_result.confidence,
        },
    }

    result = await call_llm_json(
        LIFECYCLE_JUDGMENT_PROMPT, input_data, "lifecycle_judgment"
    )

    if result is None:
        # LLM 失败，确定性结果仍可用
        return {
            "lifecycle_stage": {
                "stage": lifecycle_result.stage,
                "stageReason": lifecycle_result.stage_reason,
                "signals": [s.__dict__ for s in lifecycle_result.signals],
                "windowOfOpportunity": lifecycle_result.window_of_opportunity,
                "confidence": lifecycle_result.confidence,
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["生命周期判断 LLM 调用失败，使用确定性算法结果"],
        }

    # LLM 成功：合并算法结果 + LLM解读
    result["algorithmStage"] = lifecycle_result.stage
    result["algorithmWindow"] = lifecycle_result.window_of_opportunity
    result["signals"] = [s.__dict__ for s in lifecycle_result.signals]
    result["algorithmConfidence"] = lifecycle_result.confidence
    return {"lifecycle_stage": result}
