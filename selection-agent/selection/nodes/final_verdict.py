"""节点8: final_verdict — 最终裁决。

对应能力: §三.8 推荐等级 + 机会评分 + 行动计划
输入: 节点1-7的全部输出
输出: State.final_verdict, State.recommend_level, State.opportunity_score

改造: 先跑 calculate_opportunity_score()，评分完全由代码决定，LLM 只做总结和行动计划。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import FINAL_VERDICT_PROMPT
from selection.algorithms.opportunity_scorer import calculate_opportunity_score
from selection.algorithms.l2_scorer import calculate_l2_score
from selection.algorithms.percentile_scorer import score_dimensions_percentile, compute_composite_percentile

logger = logging.getLogger(__name__)


async def final_verdict_node(state: SelectionState) -> Dict[str, Any]:
    """综合所有分析结果，给出最终裁决。"""
    logger.info("[能力8] 最终裁决 — 开始")

    # ── Step 1: 确定性评分计算 ──
    lifecycle = state.get("lifecycle_stage", {})
    comp = state.get("competition_structure", {})
    diff = state.get("differentiation_result", {})

    lifecycle_stage = lifecycle.get("stage", lifecycle.get("algorithmStage", "MATURITY_STABLE"))
    window = lifecycle.get("windowOfOpportunity", lifecycle.get("algorithmWindow", "CLOSING"))
    cr3_val = float(comp.get("cr3_computed", {}).get("cr3", comp.get("cr3", 0)))
    entry_barrier = comp.get("cr3_computed", {}).get("entry_barrier", comp.get("entryBarrier", ""))
    typical_margin = float(state.get("profit_margin_typical", 0))
    go_no_go = state.get("go_no_go", "WAIT_AND_SEE")

    # 差异化策略数量
    diff_strategies = diff.get("strategies", [])
    diff_count = len(diff_strategies) if isinstance(diff_strategies, list) else 0
    diff_effort = diff.get("strategies", [{}])[0].get("estimatedEffort", "MEDIUM") if diff_strategies else "MEDIUM"
    # LLM失败时diff维度降级为最保守估计
    if diff.get("llmFailed"):
        diff_count = 0
        diff_effort = "HIGH"

    # 高风险数量
    risk_radar = state.get("risk_radar", {})
    hard_rules = risk_radar.get("hardRules", [])
    high_risk_count = sum(1 for r in hard_rules if isinstance(r, dict) and r.get("severity") == "HIGH")

    # 获取品类基线数据（如有）
    baseline_data = state.get("category_baseline", {})
    baseline_percentiles = baseline_data.get("percentiles", {})
    archetype = state.get("current_archetype", "UNKNOWN")

    # L1 评分（6维通用）
    score_result = calculate_opportunity_score(
        archetype=archetype,
        lifecycle_stage=lifecycle_stage,
        units_growth_rate=float(state.get("sub_categories", [{}])[0].get("unitsGrowthRate", 0)),
        total_units=int(state.get("sub_categories", [{}])[0].get("totalUnits", 0)),
        typical_margin=typical_margin,
        cr3=cr3_val,
        entry_barrier=entry_barrier,
        brand_count=int(state.get("sub_categories", [{}])[0].get("brandCount", 0)),
        diff_strategies_count=diff_count,
        diff_effort=diff_effort,
        window_of_opportunity=window,
        go_no_go=go_no_go,
        high_risk_count=high_risk_count,
    )
    logger.info(f"[能力8] L1评分: total={score_result.total}, level={score_result.recommend_level}")

    # L2 评分（8维品类专属）
    # LLM维度评分从 category_understanding.llmDimensionScores 提取（如未生成则使用默认值50）
    cat_understanding = state.get("category_understanding", {})
    llm_dims = cat_understanding.get("llmDimensionScores", {})
    l2_result = calculate_l2_score(
        archetype=archetype,
        shipping_profile=state.get("sub_categories", [{}])[0].get("shippingProfile", ""),
        total_units=int(state.get("sub_categories", [{}])[0].get("totalUnits", 0)),
        units_growth_rate=float(state.get("sub_categories", [{}])[0].get("unitsGrowthRate", 0)),
        typical_margin=typical_margin,
        cr3=cr3_val,
        lifecycle_stage=lifecycle_stage,
        entry_barrier=entry_barrier,
        emotion_score=llm_dims.get("emotionScore"),
        decor_score=llm_dims.get("decorScore"),
        fission_score=llm_dims.get("fissionScore"),
        culture_score=llm_dims.get("cultureScore"),
    )
    logger.info(f"[能力8] L2评分: total={l2_result.total:.1f}, archetype={archetype}")

    # 百分位评分（如有基线数据）
    percentile_results = None
    composite_percentile = None
    if baseline_percentiles:
        # 将 L2 维度原始分传入百分位评分
        l2_dimension_scores = {dim: score.raw_score for dim, score in l2_result.dimensions.items()}
        from selection.algorithms.constants import ARCHETYPE_WEIGHTS
        weights = ARCHETYPE_WEIGHTS.get(archetype, ARCHETYPE_WEIGHTS["BASIC"])

        percentile_results = score_dimensions_percentile(
            l2_dimension_scores, baseline_percentiles
        )
        composite_percentile = compute_composite_percentile(percentile_results, weights)
        logger.info(f"[能力8] 百分位评分: composite={composite_percentile}")

    # ── Step 2: LLM 总结 + 行动计划 ──
    input_data = {
        "categoryUnderstanding": state.get("category_understanding", {}),
        "archetype": archetype,
        "competitionStructure": comp,
        "lifecycleStage": lifecycle,
        "profitFeasibility": state.get("profit_feasibility", {}),
        "differentiation": diff,
        "riskRadar": risk_radar,
        "goNoGo": go_no_go,
        "crossLineInsights": state.get("cross_line_insights", {}),
        # 注入确定性评分结果
        "algorithmPrecompute": {
            "scoreBreakdown": score_result.to_dict(),
            "recommendLevel": score_result.recommend_level,
            "opportunityScore": score_result.total,
            "l2ScoreBreakdown": l2_result.to_dict(),
            "l2Total": l2_result.total,
            "compositePercentile": composite_percentile,
        },
    }

    result = await call_llm_json(FINAL_VERDICT_PROMPT, input_data, "final_verdict")

    if result is None:
        # LLM 失败，评分仍可用
        return {
            "final_verdict": {
                "recommendLevel": score_result.recommend_level,
                "opportunityScore": score_result.total,
                "scoreBreakdown": score_result.to_dict(),
                "l2ScoreBreakdown": l2_result.to_dict(),
                "l2Total": l2_result.total,
                "compositePercentile": composite_percentile,
                "oneLineSummary": "",
                "actionPlan": {},
            },
            "recommend_level": score_result.recommend_level,
            "opportunity_score": score_result.total,
            "l2_score": l2_result.total,
            "analysis_errors": state.get("analysis_errors", [])
            + ["最终裁决 LLM 调用失败，使用确定性评分"],
        }

    # LLM 成功：评分用代码值，其余用 LLM 的
    result["opportunityScore"] = score_result.total
    result["recommendLevel"] = score_result.recommend_level
    result["scoreBreakdown"] = score_result.to_dict()
    result["l2ScoreBreakdown"] = l2_result.to_dict()
    result["l2Total"] = l2_result.total
    result["compositePercentile"] = composite_percentile

    return {
        "final_verdict": result,
        "recommend_level": score_result.recommend_level,
        "opportunity_score": score_result.total,
        "l2_score": l2_result.total,
    }
