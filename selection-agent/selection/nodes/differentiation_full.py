"""节点5a: differentiation_full — 差异化切入点（完整版）。

触发条件: profit_margin_typical >= 30%
输出: State.differentiation_result（3个完整方案）

架构: 确定性算法（价格带空白+策略排名）→ LLM增强 → 算法降级兜底
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import DIFFERENTIATION_FULL_PROMPT
from selection.algorithms.differentiation_analyzer import analyze_differentiation, effort_from_score

logger = logging.getLogger(__name__)


async def differentiation_full_node(state: SelectionState) -> Dict[str, Any]:
    """高利润品类 — 确定性分析先行，LLM增强，算法兜底。"""
    logger.info("[能力5-full] 差异化（完整版） — 开始")

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
    logger.info(
        f"[能力5-full] 算法分析: difficulty={diff_analysis.entry_difficulty}, "
        f"rec_tier={diff_analysis.recommended_price_tier.get('label', '?')}, "
        f"top_strategy={diff_analysis.strategy_candidates[0].angle if diff_analysis.strategy_candidates else 'N/A'}"
    )

    # ═══ Step 2: LLM 增强 ═══
    input_data = {
        "nodeName": sub.get("nodeName", ""),
        "avgPrice": sub.get("avgPrice", 0),
        "priceMin": sub.get("priceMin", 0),
        "priceMax": sub.get("priceMax", 0),
        "archetype": archetype,
        "competition": comp,
        "lifecycle": lifecycle,
        "profitMargin": state.get("profit_margin_typical", 0),
        # 注入确定性分析结果，LLM基于此增强
        "algorithmPrecompute": diff_analysis.to_dict(),
    }

    result = await call_llm_json(
        DIFFERENTIATION_FULL_PROMPT, input_data, "differentiation_full"
    )

    # ═══ Step 3: 降级兜底 ═══
    if result is None:
        # LLM失败 → 使用算法结果
        return {
            "differentiation_result": {
                "strategies": [
                    {"angle": s.angle, "title": s.angle_label, "description": s.fit_reason,
                     "estimatedEffort": effort_from_score(s.score), "score": s.score}
                    for s in diff_analysis.strategy_candidates[:3]
                ],
                "algorithmOnly": True,
                "llmFailed": True,
                "entryDifficulty": diff_analysis.entry_difficulty,
                "entryDifficultyReason": diff_analysis.entry_difficulty_reason,
                "recommendedPriceTier": diff_analysis.recommended_price_tier,
                "differentiationScore": diff_analysis.differentiation_score,
                "algorithmPrecompute": diff_analysis.to_dict(),
                "fallbackNote": "LLM调用失败，使用确定性算法结果",
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["差异化完整分析 LLM 调用失败，已降级为算法结果"],
        }

    # LLM成功 → 合并算法元数据
    result["entryDifficulty"] = diff_analysis.entry_difficulty
    result["entryDifficultyReason"] = diff_analysis.entry_difficulty_reason
    result["recommendedPriceTier"] = diff_analysis.recommended_price_tier
    result["differentiationScore"] = diff_analysis.differentiation_score
    result["algorithmPrecompute"] = diff_analysis.to_dict()

    return {"differentiation_result": result}
