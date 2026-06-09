"""节点9: burst_signal_detection — 新品爆发信号检测。

对应能力: §三.9 新品爆发信号检测（doc 12 Phase 1）
输入: sub_categories[0].products 中的月内变化字段
输出: State.burst_signals

三步架构: 确定性算法 → LLM增强解读 → 降级兜底
"""

import logging
from typing import Any, Dict

from selection.state import SelectionState
from selection.llm_utils import call_llm_json
from selection.prompt_templates import BURST_SIGNAL_PROMPT
from selection.algorithms.burst_detector import detect_burst_signals

logger = logging.getLogger(__name__)


async def burst_signal_detection_node(state: SelectionState) -> Dict[str, Any]:
    """检测品类内新品爆发信号，综合三信号加权评分。"""
    logger.info("[能力9] 爆发信号检测 — 开始")

    # ── Step 1: 确定性算法 ──
    sub = state.get("sub_categories", [{}])[0]
    products = sub.get("products", [])
    sub_name = sub.get("nodeName", "")

    detection = detect_burst_signals(products, sub_name)

    logger.info(
        f"[能力9] 扫描{detection.total_products_scanned}产品, "
        f"信号{detection.products_with_signals}个, "
        f"紧急{detection.urgency_distribution.get('critical', 0)}个"
    )

    # ── Step 2: LLM 增强解读 ──
    alg_result = detection.to_dict()

    input_data = {
        "categoryName": sub_name,
        "marketplace": state.get("marketplace", "UK"),
        "algorithmPrecompute": alg_result,
        "categoryContext": {
            "archetype": state.get("current_archetype", ""),
            "lifecycleStage": state.get("lifecycle_stage", {}).get("stage", ""),
            "totalUnits": sub.get("totalUnits", 0),
            "avgPrice": sub.get("avgPrice", 0),
        },
    }

    result = await call_llm_json(BURST_SIGNAL_PROMPT, input_data, "burst_signal")

    # ── Step 3: 降级兜底 ──
    if result is None:
        logger.warning("[能力9] LLM 调用失败，返回确定性算法结果")
        return {
            "burst_signals": {
                "algorithmOnly": True,
                "topBursts": alg_result.get("topBursts", []),
                "categoryBurstScore": detection.category_burst_score,
                "urgencyDistribution": detection.urgency_distribution,
                "hasCritical": detection.has_critical,
                "totalScanned": detection.total_products_scanned,
                "productsWithSignals": detection.products_with_signals,
            },
            "analysis_errors": state.get("analysis_errors", [])
            + ["爆发信号检测 LLM 调用失败，使用确定性算法结果"],
        }

    return {"burst_signals": result}
