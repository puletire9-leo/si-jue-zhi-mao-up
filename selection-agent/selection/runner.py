"""Runner — Selection Graph 执行入口。

提供两种执行模式：
  1. run_selection_sync()  — 同步执行，返回完整结果
  2. run_selection_stream() — 异步流式执行，yield SSE 事件

参考 SuperMew RAG 的 runner.py 降级模式。
"""

import logging
import time
from typing import Any, AsyncGenerator, Dict

from selection.state import SelectionState
from selection.graph import get_selection_graph
from selection.java_client import get_java_client

logger = logging.getLogger(__name__)


def create_initial_state(batch_id: str, marketplace: str = "UK") -> SelectionState:
    """创建初始状态。"""
    return SelectionState(
        batch_id=batch_id,
        marketplace=marketplace,
        raw_data={},
        sub_categories=[],
        category_understanding={},
        current_archetype="UNKNOWN",
        competition_structure={},
        lifecycle_stage={},
        profit_feasibility={},
        profit_margin_typical=0.0,
        differentiation_result={},
        risk_radar={},
        go_no_go="WAIT_AND_SEE",
        cross_line_insights={},
        final_verdict={},
        recommend_level="WATCH",
        opportunity_score=0,
        analysis_errors=[],
        sse_events=[],
        processing_time_ms=0,
        model_version="",
    )


# 节点名称映射（用于 SSE 进度消息）
NODE_DISPLAY_NAMES = {
    "data_fetch": "数据拉取",
    "semantic_understanding": "能力1-语义品类理解",
    "competition_analysis": "能力2-竞争格局",
    "lifecycle_judgment": "能力3-生命周期判断",
    "profit_estimation": "能力4-利润推算",
    "differentiation_full": "能力5-差异化(完整版)",
    "differentiation_quick": "能力5-差异化(快速版)",
    "risk_radar": "能力6-风险雷达",
    "cross_line_discovery": "能力7-跨品线关联",
    "final_verdict": "能力8-最终裁决",
}


async def run_selection_stream(
    batch_id: str,
    marketplace: str = "UK",
) -> AsyncGenerator[Dict[str, Any], None]:
    """异步流式执行 Selection Graph，yield SSE 事件。

    每个节点完成后 yield 一个进度事件，前端可实时展示。

    Yields:
        SSE 事件字典: {"event": "progress|complete|error", "data": {...}}
    """
    start_time = time.time()
    initial_state = create_initial_state(batch_id, marketplace)
    graph = get_selection_graph()

    # 开始事件
    yield {
        "event": "start",
        "data": {"batch_id": batch_id, "marketplace": marketplace},
    }

    try:
        # 使用 LangGraph 的 stream 模式，每个节点完成后触发
        async for event in graph.astream(initial_state, stream_mode="updates"):
            for node_name, node_output in event.items():
                elapsed = int((time.time() - start_time) * 1000)
                display_name = NODE_DISPLAY_NAMES.get(node_name, node_name)

                # 检查是否有错误
                errors = node_output.get("analysis_errors", [])
                if errors:
                    yield {
                        "event": "node_error",
                        "data": {
                            "node": node_name,
                            "display": display_name,
                            "error": errors[-1] if errors else "unknown",
                            "elapsed_ms": elapsed,
                        },
                    }
                else:
                    # 正常完成事件
                    progress_data = {
                        "node": node_name,
                        "display": display_name,
                        "elapsed_ms": elapsed,
                    }

                    # 特定节点附加摘要信息
                    if node_name == "semantic_understanding":
                        progress_data["archetype"] = node_output.get(
                            "current_archetype", "?"
                        )
                    elif node_name == "profit_estimation":
                        progress_data["margin"] = node_output.get(
                            "profit_margin_typical", 0
                        )
                    elif node_name == "risk_radar":
                        progress_data["goNoGo"] = node_output.get("go_no_go", "?")
                    elif node_name == "final_verdict":
                        progress_data["recommendLevel"] = node_output.get(
                            "recommend_level", "?"
                        )
                        progress_data["opportunityScore"] = node_output.get(
                            "opportunity_score", 0
                        )

                    yield {"event": "progress", "data": progress_data}

        # 分析完成，回写 Java
        total_elapsed = int((time.time() - start_time) * 1000)
        yield {
            "event": "complete",
            "data": {
                "batch_id": batch_id,
                "total_elapsed_ms": total_elapsed,
                "errors_count": len(
                    initial_state.get("analysis_errors", [])
                ),
            },
        }

    except Exception as e:
        total_elapsed = int((time.time() - start_time) * 1000)
        logger.error(f"[runner] Selection Graph 执行失败: {e}")
        yield {
            "event": "error",
            "data": {
                "error": str(e),
                "elapsed_ms": total_elapsed,
            },
        }


async def run_and_writeback(batch_id: str, marketplace: str = "UK") -> Dict[str, Any]:
    """执行分析并将结果回写 Java（非流式，用于内部调用/定时任务）。

    Returns:
        执行结果摘要
    """
    start_time = time.time()
    initial_state = create_initial_state(batch_id, marketplace)
    graph = get_selection_graph()

    try:
        final_state = await graph.ainvoke(initial_state)
        elapsed = int((time.time() - start_time) * 1000)

        # 回写 Java
        results = [{
            "nodeId": sub.get("nodeId"),
            "bsrId": sub.get("_bsr_id"),
            "nodeName": sub.get("nodeName"),
            "recommendLevel": final_state.get("recommend_level", "WATCH"),
            "opportunityScore": final_state.get("opportunity_score", 0),
            "analysisReport": final_state.get("final_verdict", {}),
            "confidence": final_state.get("final_verdict", {}).get("confidence", 0),
        } for sub in final_state.get("sub_categories", [])]

        client = get_java_client()
        await client.post_analysis_results(batch_id, results)

        return {
            "status": "ok",
            "batch_id": batch_id,
            "elapsed_ms": elapsed,
            "recommend_level": final_state.get("recommend_level"),
            "opportunity_score": final_state.get("opportunity_score"),
            "errors": final_state.get("analysis_errors", []),
        }

    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        return {
            "status": "error",
            "batch_id": batch_id,
            "elapsed_ms": elapsed,
            "error": str(e),
        }
