"""节点6: risk_radar — 风险雷达扫描。

对应能力: §三.6 6类风险评估 + GoNoGo判断
输入: 前面所有节点的输出
输出: State.risk_radar, State.go_no_go

改造: 先跑 evaluate_hard_risks()，若自动NO_GO则跳过LLM，否则LLM补充软风险。
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import RISK_RADAR_PROMPT
from selection.algorithms.risk_rules import evaluate_hard_risks

logger = logging.getLogger(__name__)


async def risk_radar_node(state: SelectionState) -> Dict[str, Any]:
    """扫描6大类风险，给出Go/NoGo判断。"""
    logger.info("[能力6] 风险雷达 — 开始")

    # ── Step 1: 确定性硬规则评估 ──
    comp = state.get("competition_structure", {})
    lifecycle = state.get("lifecycle_stage", {})
    profit = state.get("profit_feasibility", {})

    cr3_val = float(comp.get("cr3_computed", {}).get("cr3", comp.get("cr3", 0)))
    # 按名称查找Speed信号（不依赖位置，避免LLM覆盖signals顺序后取错值）
    signals_list = lifecycle.get("signals", []) or []
    speed_signal = next((s for s in signals_list if isinstance(s, dict) and s.get("name") == "Speed"), None)
    growth_val = float(speed_signal.get("value", 0)) if speed_signal else 0
    avg_rating_val = float(state.get("sub_categories", [{}])[0].get("avgRating", 0))
    price_range_val = float(
        comp.get("priceBand_computed", {}).get("price_range", 0)
    )
    lifecycle_stage = lifecycle.get("stage", lifecycle.get("algorithmStage", ""))
    typical_margin = float(state.get("profit_margin_typical", 0))

    hard_risk_result = evaluate_hard_risks(
        cr3=cr3_val,
        avg_rating=avg_rating_val,
        units_growth_rate=growth_val,
        price_range=price_range_val,
        lifecycle_stage=lifecycle_stage,
        typical_margin=typical_margin,
        marketplace=state.get("marketplace", "UK"),
    )
    logger.info(f"[能力6] 硬规则: triggered={len(hard_risk_result.triggered_rules)}, "
                f"go_no_go={hard_risk_result.auto_go_no_go}")

    # 若自动NO_GO，直接返回，跳过LLM
    if hard_risk_result.auto_go_no_go == "NO_GO":
        triggered_list = [r.__dict__ for r in hard_risk_result.triggered_rules]
        return {
            "risk_radar": {
                "risks": triggered_list,
                "goNoGo": "NO_GO",
                "goNoGoReason": "确定性硬规则触发自动NO_GO",
                "hardRules": triggered_list,
                "confidence": 1.0,
            },
            "go_no_go": "NO_GO",
        }

    # ── Step 2: LLM 补充软风险（仅硬规则未触发NO_GO时） ──
    input_data = {
        "categoryUnderstanding": state.get("category_understanding", {}),
        "competitionStructure": comp,
        "lifecycleStage": lifecycle,
        "profitFeasibility": profit,
        "differentiation": state.get("differentiation_result", {}),
        # 注入硬规则结果
        "algorithmPrecompute": {
            "hardRules": [r.__dict__ for r in hard_risk_result.triggered_rules],
            "autoGoNoGo": hard_risk_result.auto_go_no_go,
            "highRiskCount": hard_risk_result.high_risk_count,
        },
    }

    result = await call_llm_json(RISK_RADAR_PROMPT, input_data, "risk_radar")

    if result is None:
        # LLM 失败，硬规则结果仍可用
        return {
            "risk_radar": {
                "risks": [r.__dict__ for r in hard_risk_result.triggered_rules],
                "goNoGo": hard_risk_result.auto_go_no_go,
                "goNoGoReason": "基于硬规则判定",
                "hardRules": [r.__dict__ for r in hard_risk_result.triggered_rules],
                "confidence": hard_risk_result.confidence,
            },
            "go_no_go": hard_risk_result.auto_go_no_go,
            "analysis_errors": state.get("analysis_errors", [])
            + ["风险雷达 LLM 调用失败，使用硬规则结果"],
        }

    # LLM 成功：合并硬规则 + LLM软风险
    result["hardRules"] = [r.__dict__ for r in hard_risk_result.triggered_rules]
    result["hardRuleGoNoGo"] = hard_risk_result.auto_go_no_go

    # Go/NoGo: 硬规则优先级最高
    final_go_no_go = hard_risk_result.auto_go_no_go
    if final_go_no_go == "GO":
        # 允许 LLM 降级（如 LLM 发现软风险）
        final_go_no_go = result.get("goNoGo", "GO")

    return {
        "risk_radar": result,
        "go_no_go": final_go_no_go,
    }
