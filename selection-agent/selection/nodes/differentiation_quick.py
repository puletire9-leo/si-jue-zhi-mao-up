"""节点5b: differentiation_quick — 差异化切入点（快速版）。

触发条件: profit_margin_typical < 30%
输出: State.differentiation_result（1个快速建议）

架构: 确定性算法（价格带空白+策略排名）→ LLM增强 → 算法降级兜底
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import DIFFERENTIATION_QUICK_PROMPT
from selection.algorithms.differentiation_analyzer import analyze_differentiation, effort_from_score

logger = logging.getLogger(__name__)


async def differentiation_quick_node(state: SelectionState) -> Dict[str, Any]:
    """低利润品类 — 确定性分析先行，LLM增强，算法兜底。"""
    logger.info("[能力5-quick] 差异化（快速版） — 开始")

    sub = state.get("sub_categories", [{}])[0]
    comp = state.get("competition_structure", {})
    lifecycle = state.get("lifecycle_stage", {})
    archetype = state.get("current_archetype", "UNKNOWN")
    marketplace = state.get("marketplace", "UK")

    # ═══ Step 1: 确定性差异化分析 ═══
    price_band_data = comp.get("priceBand", {})
    blue_ocean_data = comp.get("blueOcean", {})

    diff_analysis = analyze_differentiation(
        price_band=price_band_data,
        archetype=archetype,
        lifecycle_stage=lifecycle.get("stage", lifecycle.get("algorithmStage", "")),
        profit_margin=float(state.get("profit_margin_typical", 0)),
        blue_ocean=blue_ocean_data,
        cr3=float(comp.get("cr3_computed", {}).get("cr3", comp.get("cr3", 0))),
        window=lifecycle.get("windowOfOpportunity", lifecycle.get("algorithmWindow", "")),
        marketplace=marketplace,
    )
    top_candidate = diff_analysis.strategy_candidates[0] if diff_analysis.strategy_candidates else None
    logger.info(
        f"[能力5-quick] 算法分析: difficulty={diff_analysis.entry_difficulty}, "
        f"top_strategy={top_candidate.angle if top_candidate else 'N/A'}"
    )

    # ═══ Step 2: LLM 增强 ═══
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": sub.get("avgPrice", 0),
        "archetype": archetype,
        "competition": comp,
        "profitMargin": state.get("profit_margin_typical", 0),
        # 注入确定性分析结果
        "algorithmPrecompute": diff_analysis.to_dict(),
    }

    result = await call_llm_json(
        DIFFERENTIATION_QUICK_PROMPT, input_data, "differentiation_quick"
    )

    # ═══ Step 3: 降级兜底 ═══
    if result is None:
        # LLM失败 → 使用算法结果（取top 1）
        fallback = {
            "strategies": [],
            "algorithmOnly": True,
            "llmFailed": True,
            "entryDifficulty": diff_analysis.entry_difficulty,
            "entryDifficultyReason": diff_analysis.entry_difficulty_reason,
            "recommendedPriceTier": diff_analysis.recommended_price_tier,
            "differentiationScore": diff_analysis.differentiation_score,
            "algorithmPrecompute": diff_analysis.to_dict(),
            "fallbackNote": "LLM调用失败，使用确定性算法结果",
        }
        if top_candidate:
            fallback["strategies"] = [{
                "angle": top_candidate.angle,
                "title": top_candidate.angle_label,
                "description": top_candidate.fit_reason,
                "estimatedEffort": effort_from_score(top_candidate.score),
                "score": top_candidate.score,
            }]
            fallback["recommendation"] = top_candidate.fit_reason
            fallback["angle"] = top_candidate.angle
        return {
            "differentiation_result": fallback,
            "analysis_errors": state.get("analysis_errors", [])
            + ["差异化快速分析 LLM 调用失败，已降级为算法结果"],
        }

    # LLM成功 → 合并算法元数据
    result["entryDifficulty"] = diff_analysis.entry_difficulty
    result["entryDifficultyReason"] = diff_analysis.entry_difficulty_reason
    result["recommendedPriceTier"] = diff_analysis.recommended_price_tier
    result["differentiationScore"] = diff_analysis.differentiation_score
    result["algorithmPrecompute"] = diff_analysis.to_dict()

    return {"differentiation_result": result}
