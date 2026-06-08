"""Runner — Selection Graph 执行入口。

执行流程：
  1. data_fetch: 从Java拉取一次聚合数据（所有小类）
  2. FOR EACH sub_category: 运行分析图（9节点），收集结果
  3. POST 回写Java

提供两种执行模式：
  1. run_selection_stream()  — 异步流式，yield SSE事件（前端直连主路径）
  2. run_and_writeback()     — 非流式，内部调用/定时任务

参考 SuperMew RAG 的 runner.py 降级模式。
"""

import logging
import time
from typing import Any, AsyncGenerator, Dict, List

from selection.state import SelectionState
from selection.graph import get_selection_graph
from selection.java_client import get_java_client
from selection.nodes.data_fetch import data_fetch_node

logger = logging.getLogger(__name__)

# SSE 心跳间隔（秒）
HEARTBEAT_INTERVAL = 15


def create_initial_state(batch_id: str, marketplace: str = "UK") -> SelectionState:
    """创建初始状态（空壳，data_fetch 填充数据）。"""
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
        l2_score=0.0,
        category_baseline={},
        analysis_errors=[],
        sse_events=[],
        processing_time_ms=0,
        model_version="",
    )


def create_sub_state(
    base_state: SelectionState,
    current_sub: Dict[str, Any],
    current_index: int,
    total_count: int,
) -> SelectionState:
    """基于 base_state 创建分析单个小类的状态。

    保留 raw_data 和 sub_categories 不变，
    重置所有能力节点的输出字段。
    """
    return SelectionState(
        batch_id=base_state["batch_id"],
        marketplace=base_state.get("marketplace", "UK"),
        raw_data=base_state["raw_data"],
        sub_categories=[current_sub],  # 当前小类放在首位
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
        l2_score=0.0,
        category_baseline={},
        analysis_errors=[],
        sse_events=[],
        processing_time_ms=0,
        model_version="",
    )


# 节点名称映射（用于 SSE 进度消息）
NODE_DISPLAY_NAMES = {
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

    执行流程：
    1. data_fetch 一次拉取所有小类
    2. 循环每个小类，运行分析图，yield 每个节点进度
    3. 全部完成后回写 Java

    Yields:
        SSE 事件字典: {"event": "start|data_ready|sub_start|progress|
                        node_error|sub_complete|heartbeat|writeback|
                        complete|error", "data": {...}}
    """
    overall_start = time.time()
    graph = get_selection_graph()
    all_results: List[Dict[str, Any]] = []

    # ── 开始事件 ──
    yield {
        "event": "start",
        "data": {"batch_id": batch_id, "marketplace": marketplace},
    }

    # ── 步骤1: data_fetch（一次拉取全部小类） ──
    base_state = create_initial_state(batch_id, marketplace)
    try:
        fetch_result = await data_fetch_node(base_state)
        base_state.update(fetch_result)
    except Exception as e:
        logger.error(f"[runner] data_fetch 失败: {e}")
        yield {"event": "error", "data": {"error": f"data_fetch 失败: {e}"}}
        return

    sub_categories = base_state.get("sub_categories", [])
    if not sub_categories:
        yield {
            "event": "error",
            "data": {"error": "无小类数据可分析", "batch_id": batch_id},
        }
        return

    yield {
        "event": "data_ready",
        "data": {
            "batch_id": batch_id,
            "total_sub_categories": len(sub_categories),
            "marketplace": marketplace,
        },
    }

    # ── 步骤2: 逐小类运行分析图 ──
    for idx, sub in enumerate(sub_categories):
        sub_name = sub.get("nodeName", f"小类#{idx+1}")
        logger.info(
            f"[runner] 分析小类 [{idx+1}/{len(sub_categories)}]: {sub_name}"
        )

        yield {
            "event": "sub_start",
            "data": {
                "index": idx + 1,
                "total": len(sub_categories),
                "nodeName": sub_name,
                "nodeId": sub.get("nodeId", ""),
            },
        }

        sub_state = create_sub_state(base_state, sub, idx, len(sub_categories))
        sub_start = time.time()
        final_state = sub_state
        sub_errors: List[str] = []

        # 心跳计时
        last_heartbeat = time.time()

        try:
            async for event in graph.astream(sub_state, stream_mode="updates"):
                now = time.time()

                # 心跳检查（防止LLM长时间推理时SSE超时）
                if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                    yield {"event": "heartbeat", "data": {"nodeName": sub_name}}
                    last_heartbeat = now

                for node_name, node_output in event.items():
                    elapsed = int((now - sub_start) * 1000)
                    display_name = NODE_DISPLAY_NAMES.get(node_name, node_name)

                    # 累积 state + 检查错误 + 推送进度
                    if isinstance(node_output, dict):
                        final_state.update(node_output)

                        errors = node_output.get("analysis_errors", [])
                        if errors:
                            sub_errors.extend(errors)
                            yield {
                                "event": "node_error",
                                "data": {
                                    "node": node_name,
                                    "display": display_name,
                                    "nodeName": sub_name,
                                    "error": errors[-1],
                                    "elapsed_ms": elapsed,
                                },
                            }
                        else:
                            # 进度事件（附加摘要信息）
                            progress_data: Dict[str, Any] = {
                                "node": node_name,
                                "display": display_name,
                                "nodeName": sub_name,
                                "elapsed_ms": elapsed,
                            }
                            if node_name == "semantic_understanding":
                                progress_data["archetype"] = node_output.get(
                                    "current_archetype", "?"
                                )
                            elif node_name == "profit_estimation":
                                progress_data["margin"] = node_output.get(
                                    "profit_margin_typical", 0
                                )
                            elif node_name == "risk_radar":
                                progress_data["goNoGo"] = node_output.get(
                                    "go_no_go", "?"
                                )
                            elif node_name == "final_verdict":
                                progress_data["recommendLevel"] = node_output.get(
                                    "recommend_level", "?"
                                )
                                progress_data["opportunityScore"] = node_output.get(
                                    "opportunity_score", 0
                                )
                            yield {"event": "progress", "data": progress_data}

        except Exception as e:
            sub_errors.append(f"图执行失败: {e}")
            logger.error(f"[runner] 小类 {sub_name} 图执行失败: {e}")

        sub_elapsed = int((time.time() - sub_start) * 1000)

        # 收集该小类的分析结果
        result_item = {
            "nodeId": sub.get("nodeId"),
            "bsrId": sub.get("_bsr_id", ""),
            "nodeName": sub_name,
            "recommendLevel": final_state.get("recommend_level", "WATCH"),
            "opportunityScore": final_state.get("opportunity_score", 0),
            "analysisReport": final_state.get("final_verdict", {}),
            "confidence": final_state.get("final_verdict", {}).get("confidence", 0),
            "errors": sub_errors,
        }
        all_results.append(result_item)

        yield {
            "event": "sub_complete",
            "data": {
                "index": idx + 1,
                "total": len(sub_categories),
                "nodeName": sub_name,
                "recommendLevel": result_item["recommendLevel"],
                "opportunityScore": result_item["opportunityScore"],
                "elapsed_ms": sub_elapsed,
                "errors_count": len(sub_errors),
            },
        }

    # ── 步骤3: 回写 Java ──
    overall_elapsed = int((time.time() - overall_start) * 1000)
    total_errors = sum(len(r.get("errors", [])) for r in all_results)

    yield {
        "event": "writeback",
        "data": {"results_count": len(all_results)},
    }

    try:
        client = get_java_client()
        await client.post_analysis_results(batch_id, all_results)
        writeback_ok = True
        logger.info(f"[runner] 回写成功: {len(all_results)} 条结果")
    except Exception as e:
        writeback_ok = False
        logger.error(f"[runner] 回写失败: {e}")

    # ── 完成事件 ──
    yield {
        "event": "complete",
        "data": {
            "batch_id": batch_id,
            "total_sub_categories": len(sub_categories),
            "total_elapsed_ms": overall_elapsed,
            "errors_count": total_errors,
            "writeback_ok": writeback_ok,
            "processing_time_ms": overall_elapsed,
            "results_summary": [
                {
                    "nodeName": r["nodeName"],
                    "recommendLevel": r["recommendLevel"],
                    "opportunityScore": r["opportunityScore"],
                }
                for r in all_results
            ],
        },
    }


async def run_and_writeback(batch_id: str, marketplace: str = "UK") -> Dict[str, Any]:
    """执行分析并将结果回写 Java（非流式，用于内部调用/定时任务）。

    Returns:
        执行结果摘要
    """
    overall_start = time.time()
    graph = get_selection_graph()

    # 1. data_fetch
    base_state = create_initial_state(batch_id, marketplace)
    try:
        fetch_result = await data_fetch_node(base_state)
        base_state.update(fetch_result)
    except Exception as e:
        return {"status": "error", "batch_id": batch_id, "error": f"data_fetch 失败: {e}"}

    sub_categories = base_state.get("sub_categories", [])
    if not sub_categories:
        return {"status": "error", "batch_id": batch_id, "error": "无小类数据"}

    # 2. 逐小类运行分析图
    all_results: List[Dict[str, Any]] = []
    all_errors: List[str] = []

    for idx, sub in enumerate(sub_categories):
        sub_name = sub.get("nodeName", f"小类#{idx+1}")
        logger.info(f"[runner-sync] 分析 [{idx+1}/{len(sub_categories)}]: {sub_name}")

        sub_state = create_sub_state(base_state, sub, idx, len(sub_categories))

        try:
            final_state = await graph.ainvoke(sub_state)
        except Exception as e:
            all_errors.append(f"{sub_name}: 图执行失败 - {e}")
            continue

        sub_errors = final_state.get("analysis_errors", [])
        all_errors.extend(sub_errors)

        all_results.append({
            "nodeId": sub.get("nodeId"),
            "bsrId": sub.get("_bsr_id", ""),
            "nodeName": sub_name,
            "recommendLevel": final_state.get("recommend_level", "WATCH"),
            "opportunityScore": final_state.get("opportunity_score", 0),
            "analysisReport": final_state.get("final_verdict", {}),
            "confidence": final_state.get("final_verdict", {}).get("confidence", 0),
            "errors": sub_errors,
        })

    # 3. 回写 Java
    elapsed = int((time.time() - overall_start) * 1000)

    try:
        client = get_java_client()
        await client.post_analysis_results(batch_id, all_results)
        writeback_ok = True
    except Exception as e:
        all_errors.append(f"回写失败: {e}")
        writeback_ok = False

    return {
        "status": "ok" if not all_errors else "partial",
        "batch_id": batch_id,
        "elapsed_ms": elapsed,
        "processing_time_ms": elapsed,
        "total_sub_categories": len(sub_categories),
        "analyzed_count": len(all_results),
        "writeback_ok": writeback_ok,
        "errors": all_errors,
        "results_summary": [
            {
                "nodeName": r["nodeName"],
                "recommendLevel": r["recommendLevel"],
                "opportunityScore": r["opportunityScore"],
            }
            for r in all_results
        ],
    }
