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

import asyncio
import logging
import os
import time
from typing import Any, AsyncGenerator, Dict, List

from selection.state import SelectionState
from selection.graph import get_screening_graph, get_deep_graph
from selection.java_client import get_java_client
from selection.nodes.data_fetch import data_fetch_node
from selection.algorithms.opportunity_scorer import calculate_opportunity_score

logger = logging.getLogger(__name__)

# SSE 心跳间隔（秒）
HEARTBEAT_INTERVAL = 15

# 分批处理阈值：初筛分数 >= 该值才跑深度分析
SCREENING_SCORE_THRESHOLD = int(os.getenv("SCREENING_SCORE_THRESHOLD", "60"))

# 并发控制
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_SUBS", "3"))


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
        category_health={},
        burst_signals={},
        seller_profiling={},
        seller_heat_signal="",
        seller_recommendations=[],
        raw_data_other_marketplace={},
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
        raw_data_other_marketplace=base_state.get("raw_data_other_marketplace", {}),
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
        category_health={},
        burst_signals={},
        seller_profiling={},
        seller_heat_signal="",
        seller_recommendations=[],
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
    "seller_profiling": "能力7-卖家行为画像",
    "cross_line_discovery": "能力8-跨品线关联",
    "burst_signal_detection": "能力9-新品爆发信号",
    "final_verdict": "能力10-最终裁决",
}


def _record_decision_if_qualified(
    final_state: Dict[str, Any],
    sub: Dict[str, Any],
    marketplace: str,
) -> None:
    """对 S1/S2 级产品记录决策快照到 SQLite（非阻塞，失败仅记日志）。

    触发条件: recommend_level 为 STRONG_BUY 或 RECOMMEND。
    映射关系见计划 Task 2.2 — final_state 字段 → record_decision_snapshot 参数。
    """
    recommend_level = final_state.get("recommend_level", "WATCH")
    if recommend_level not in ("STRONG_BUY", "RECOMMEND"):
        return

    try:
        verdict = final_state.get("final_verdict", {})

        # 决策标识（品类级: bsrId 优先, 回退到 nodeId）
        identifier = sub.get("_bsr_id", "") or str(sub.get("nodeId", ""))
        category_label = sub.get("nodeName", "")
        category_prototype = final_state.get("current_archetype", "UNKNOWN")

        # L2 8维评分: 从 verdict.l2ScoreBreakdown.dimensions 提取
        l2_breakdown = verdict.get("l2ScoreBreakdown", {})
        l2_dimensions = l2_breakdown.get("dimensions", {})
        l2_scores: Dict[str, int] = {}
        if isinstance(l2_dimensions, dict):
            for dim, d in l2_dimensions.items():
                if isinstance(d, dict):
                    l2_scores[dim] = int(d.get("raw_score", d.get("score", 50)))
                elif isinstance(d, (int, float)):
                    l2_scores[dim] = int(d)

        # Fallback: 如果没有维度分解（screeningOnly），用 l2_total 均分
        if not l2_scores:
            l2_total = final_state.get("l2_score", 0)
            dim_names = ["size", "volume", "profit", "emotion", "decor", "fission", "culture", "market"]
            l2_scores = {k: int(l2_total * 100 / 8) for k in dim_names}

        # 决策信息
        decision_score = float(final_state.get("opportunity_score", 0))
        decision_status = "LAUNCH" if recommend_level == "STRONG_BUY" else "CONDITIONAL"

        # 信号加成
        signal_boosts = verdict.get("signalBoosts", verdict.get("signal_boosts", {}))
        if not isinstance(signal_boosts, dict):
            signal_boosts = {}

        # 基线数据
        baseline_bsr = sub.get("avgBsr")
        baseline_units = sub.get("totalUnits")
        baseline_price = sub.get("avgPrice")
        baseline_ratings = sub.get("totalRatings")

        from selection.algorithms.feedback_service import record_decision_snapshot
        from selection.storage.decision_store import get_decision_store

        snapshot = record_decision_snapshot(
            asin=identifier,
            marketplace=marketplace,
            category_label=category_label,
            category_prototype=category_prototype,
            l2_scores=l2_scores,
            decision_score=decision_score,
            decision_status=decision_status,
            signal_boosts=signal_boosts,
            baseline_bsr=baseline_bsr,
            baseline_units=baseline_units,
            baseline_price=baseline_price,
            baseline_ratings=baseline_ratings,
        )
        get_decision_store().insert_snapshot(snapshot)
    except Exception as e:
        logger.warning(
            f"[runner] 决策记录失败({sub.get('nodeName', '?')}): {e}"
        )


def _quick_screening_score(state: SelectionState) -> tuple:
    """基于能力1-4的输出，快速计算初筛分数（不调用LLM）。

    Returns:
        (score: int, recommend_level: str)
    """
    lifecycle = state.get("lifecycle_stage", {})
    comp = state.get("competition_structure", {})

    lifecycle_stage = lifecycle.get("stage", lifecycle.get("algorithmStage", "MATURITY_STABLE"))
    window = lifecycle.get("windowOfOpportunity", lifecycle.get("algorithmWindow", "CLOSING"))
    cr3_val = float(comp.get("cr3_computed", {}).get("cr3", comp.get("cr3", 0)))
    entry_barrier = comp.get("cr3_computed", {}).get("entry_barrier", comp.get("entryBarrier", ""))
    typical_margin = float(state.get("profit_margin_typical", 0))
    archetype = state.get("current_archetype", "UNKNOWN")

    # 用最保守的差异化估计（无策略）
    score_result = calculate_opportunity_score(
        archetype=archetype,
        lifecycle_stage=lifecycle_stage,
        units_growth_rate=float(state.get("sub_categories", [{}])[0].get("unitsGrowthRate", 0)),
        total_units=int(state.get("sub_categories", [{}])[0].get("totalUnits", 0)),
        typical_margin=typical_margin,
        cr3=cr3_val,
        entry_barrier=entry_barrier,
        brand_count=int(state.get("sub_categories", [{}])[0].get("brandCount", 0)),
        diff_strategies_count=0,  # 初筛不假设差异化
        diff_effort="HIGH",
        window_of_opportunity=window,
        go_no_go=state.get("go_no_go", "WAIT_AND_SEE"),
        high_risk_count=0,
    )
    return score_result.total, score_result.recommend_level


def _generate_brief_report(state: SelectionState, score: int, level: str) -> Dict[str, Any]:
    """为低分小类生成简要报告（跳过深度分析）。

    完全基于确定性算法，不调用LLM。
    """
    lifecycle = state.get("lifecycle_stage", {})
    comp = state.get("competition_structure", {})
    archetype = state.get("current_archetype", "UNKNOWN")
    sub = state.get("sub_categories", [{}])[0]

    return {
        "recommendLevel": level,
        "opportunityScore": score,
        "screeningOnly": True,
        "oneLineSummary": f"初筛评分{score}分，评级{level}，跳过深度分析以节省资源",
        "archetype": archetype,
        "lifecycleStage": lifecycle.get("stage", "UNKNOWN"),
        "cr3": comp.get("cr3_computed", {}).get("cr3", 0),
        "profitMargin": state.get("profit_margin_typical", 0),
        "blueOcean": comp.get("blueOcean", {}),
        "nodeName": sub.get("nodeName", ""),
        # 与深度分析路径对齐的结构化字段
        "l2Total": 0,
        "l2ScoreBreakdown": {},
        "categoryHealth": {},
        "opportunityClassification": {},
        "compositePercentile": None,
        "confidence": 0.30,
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

    # ── 并行预取对站数据（跨站套利用） ──
    _other_mp_map = {"UK": "DE", "DE": "UK", "US": "UK"}
    other_marketplace = _other_mp_map.get(marketplace, "UK")
    try:
        client = get_java_client()
        other_batch_id = batch_id.replace(marketplace, other_marketplace, 1)
        other_data = await client.get_aggregated_data(other_batch_id)
        base_state["raw_data_other_marketplace"] = other_data
        logger.info(f"[runner] 对站数据预取成功: {other_marketplace}, "
                    f"{len(other_data.get('productLines', []))} 品线")
    except Exception as e:
        logger.warning(f"[runner] 对站数据预取失败({other_marketplace}): {e}")
        base_state["raw_data_other_marketplace"] = {}

    # ── 步骤2: 分批处理小类（初筛 + 深度分析） ──
    # 品类原型缓存（Task 2.2: 同批次复用 semantic_understanding 结果）
    archetype_cache: Dict[str, Dict] = {}

    # 并发控制（Task 2.4）
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def _process_sub(idx: int, sub: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """处理单个小类（两阶段: 初筛→深度分析）。"""
        async with semaphore:
            sub_name = sub.get("nodeName", f"小类#{idx+1}")
            bsr_id = sub.get("bsrId", sub.get("_bsr_id", ""))

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
            sub_errors: List[str] = []

            # ── 获取品类基线（百分位评分用，final_verdict 消费） ──
            try:
                client = get_java_client()
                baseline = await client.get_category_baseline(
                    marketplace=marketplace,
                    category_label=sub_name,
                )
                sub_state["category_baseline"] = baseline
                logger.info(
                    f"[runner] 品类基线: {sub_name} hasBaseline={baseline.get('hasBaseline', False)}"
                )
            except Exception as e:
                logger.warning(f"[runner] 获取品类基线失败({sub_name}): {e}")
                # 非致命：百分位评分在 final_verdict 中优雅降级

            # ── Phase 1: 初筛（能力1-4） ──
            screening_graph = get_screening_graph()
            final_state = sub_state

            try:
                # 复用 archetype 缓存（Task 2.2）
                if bsr_id and bsr_id in archetype_cache:
                    cached = archetype_cache[bsr_id]
                    sub_state["category_understanding"] = cached.get("category_understanding", {})
                    sub_state["current_archetype"] = cached.get("current_archetype", "UNKNOWN")
                    logger.info(f"[runner] 复用原型缓存: {bsr_id} → {cached.get('current_archetype')}")

                stream = screening_graph.astream(sub_state, stream_mode="updates")
                stream_iter = stream.__aiter__()

                while True:
                    try:
                        event = await asyncio.wait_for(
                            stream_iter.__anext__(),
                            timeout=HEARTBEAT_INTERVAL,
                        )
                    except asyncio.TimeoutError:
                        yield {"event": "heartbeat", "data": {"nodeName": sub_name}}
                        continue
                    except StopAsyncIteration:
                        break

                    now = time.time()
                    for node_name, node_output in event.items():
                        elapsed = int((now - sub_start) * 1000)
                        display_name = NODE_DISPLAY_NAMES.get(node_name, node_name)

                        if isinstance(node_output, dict):
                            final_state.update(node_output)
                            errors = node_output.get("analysis_errors", [])
                            if errors:
                                sub_errors.extend(errors)
                                yield {
                                    "event": "node_error",
                                    "data": {
                                        "node": node_name, "display": display_name,
                                        "nodeName": sub_name, "error": errors[-1],
                                        "elapsed_ms": elapsed,
                                    },
                                }
                            else:
                                progress_data: Dict[str, Any] = {
                                    "node": node_name, "display": display_name,
                                    "nodeName": sub_name, "elapsed_ms": elapsed,
                                    "phase": "screening",
                                }
                                if node_name == "semantic_understanding":
                                    progress_data["archetype"] = node_output.get("current_archetype", "?")
                                elif node_name == "profit_estimation":
                                    progress_data["margin"] = node_output.get("profit_margin_typical", 0)
                                yield {"event": "progress", "data": progress_data}

            except Exception as e:
                sub_errors.append(f"初筛执行失败: {e}")
                logger.error(f"[runner] 小类 {sub_name} 初筛失败: {e}")

            # 缓存原型理解结果（Task 2.2）
            if bsr_id and final_state.get("current_archetype", "UNKNOWN") != "UNKNOWN":
                archetype_cache[bsr_id] = {
                    "category_understanding": final_state.get("category_understanding", {}),
                    "current_archetype": final_state.get("current_archetype", "UNKNOWN"),
                }

            # ── 快速评分 ──
            screening_score, screening_level = _quick_screening_score(final_state)
            logger.info(
                f"[runner] {sub_name} 初筛: score={screening_score}, level={screening_level}"
            )

            # ── Phase 2: 深度分析（能力5-8）或简要报告 ──
            if screening_score >= SCREENING_SCORE_THRESHOLD or screening_level in ("STRONG_BUY", "RECOMMEND"):
                # 跑深度分析
                yield {
                    "event": "progress",
                    "data": {
                        "node": "screening_pass",
                        "display": f"初筛通过(score={screening_score})，进入深度分析",
                        "nodeName": sub_name,
                        "elapsed_ms": int((time.time() - sub_start) * 1000),
                        "phase": "screening_result",
                    },
                }

                deep_graph = get_deep_graph()
                try:
                    stream = deep_graph.astream(final_state, stream_mode="updates")
                    stream_iter = stream.__aiter__()

                    while True:
                        try:
                            event = await asyncio.wait_for(
                                stream_iter.__anext__(),
                                timeout=HEARTBEAT_INTERVAL,
                            )
                        except asyncio.TimeoutError:
                            yield {"event": "heartbeat", "data": {"nodeName": sub_name}}
                            continue
                        except StopAsyncIteration:
                            break

                        now = time.time()
                        for node_name, node_output in event.items():
                            elapsed = int((now - sub_start) * 1000)
                            display_name = NODE_DISPLAY_NAMES.get(node_name, node_name)

                            if isinstance(node_output, dict):
                                final_state.update(node_output)
                                errors = node_output.get("analysis_errors", [])
                                if errors:
                                    sub_errors.extend(errors)
                                    yield {
                                        "event": "node_error",
                                        "data": {
                                            "node": node_name, "display": display_name,
                                            "nodeName": sub_name, "error": errors[-1],
                                            "elapsed_ms": elapsed,
                                        },
                                    }
                                else:
                                    progress_data = {
                                        "node": node_name, "display": display_name,
                                        "nodeName": sub_name, "elapsed_ms": elapsed,
                                        "phase": "deep",
                                    }
                                    if node_name == "risk_radar":
                                        progress_data["goNoGo"] = node_output.get("go_no_go", "?")
                                    elif node_name == "final_verdict":
                                        progress_data["recommendLevel"] = node_output.get("recommend_level", "?")
                                        progress_data["opportunityScore"] = node_output.get("opportunity_score", 0)
                                    yield {"event": "progress", "data": progress_data}

                except Exception as e:
                    sub_errors.append(f"深度分析失败: {e}")
                    logger.error(f"[runner] 小类 {sub_name} 深度分析失败: {e}")
                    # 深度分析失败 → 降级为简报并标记 screeningOnly
                    brief = _generate_brief_report(final_state, screening_score, screening_level)
                    brief["oneLineSummary"] = f"深度分析失败({e})，使用初筛结果"
                    final_state["final_verdict"] = brief
                    final_state["recommend_level"] = screening_level
                    final_state["opportunity_score"] = screening_score

            else:
                # 生成简要报告，跳过深度分析
                brief = _generate_brief_report(final_state, screening_score, screening_level)
                final_state["final_verdict"] = brief
                final_state["recommend_level"] = screening_level
                final_state["opportunity_score"] = screening_score

                yield {
                    "event": "progress",
                    "data": {
                        "node": "screening_skip",
                        "display": f"初筛评分{screening_score}分，评级{screening_level}，跳过深度分析",
                        "nodeName": sub_name,
                        "elapsed_ms": int((time.time() - sub_start) * 1000),
                        "phase": "screening_result",
                    },
                }

            sub_elapsed = int((time.time() - sub_start) * 1000)

            # 收集该小类的分析结果
            verdict = final_state.get("final_verdict", {})
            result_item = {
                "nodeId": sub.get("nodeId"),
                "bsrId": sub.get("_bsr_id", ""),
                "nodeName": sub_name,
                "recommendLevel": final_state.get("recommend_level", "WATCH"),
                "opportunityScore": final_state.get("opportunity_score", 0),
                "l2Score": final_state.get("l2_score", 0),
                "analysisReport": verdict,
                "confidence": verdict.get("confidence", 0),
                "screeningOnly": verdict.get("screeningOnly", False),
                "errors": sub_errors,
                # Java 结构化查询所需的顶层字段
                "archetype": final_state.get("current_archetype", "UNKNOWN"),
                "lifecycleStage": verdict.get("lifecycleStage") or final_state.get("lifecycle_stage", {}).get("stage", "UNKNOWN"),
                "cr3": verdict.get("cr3") or final_state.get("competition_structure", {}).get("cr3_computed", {}).get("cr3", 0),
                "profitMargin": final_state.get("profit_margin_typical", 0),
                "goNoGo": final_state.get("go_no_go", "WAIT_AND_SEE"),
                "categoryHealth": verdict.get("categoryHealth", {}),
            }
            all_results.append(result_item)

            # ── 决策反馈闭环: 记录 S1/S2 级产品决策快照 ──
            _record_decision_if_qualified(final_state, sub, marketplace)

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
                    "screeningOnly": result_item.get("screeningOnly", False),
                },
            }

    # 顺序执行每个小类（并发由 semaphore 控制，但 SSE 输出需顺序 yield）
    for idx, sub in enumerate(sub_categories):
        async for event in _process_sub(idx, sub):
            yield event

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

    # ── 并行预取对站数据（跨站套利用） ──
    _other_mp_map = {"UK": "DE", "DE": "UK", "US": "UK"}
    other_marketplace = _other_mp_map.get(marketplace, "UK")
    try:
        client = get_java_client()
        other_batch_id = batch_id.replace(marketplace, other_marketplace, 1)
        other_data = await client.get_aggregated_data(other_batch_id)
        base_state["raw_data_other_marketplace"] = other_data
        logger.info(f"[runner-sync] 对站数据预取成功: {other_marketplace}")
    except Exception as e:
        logger.warning(f"[runner-sync] 对站数据预取失败({other_marketplace}): {e}")
        base_state["raw_data_other_marketplace"] = {}

    # 2. 分批处理小类（初筛 + 深度分析）
    all_results: List[Dict[str, Any]] = []
    all_errors: List[str] = []
    archetype_cache: Dict[str, Dict] = {}
    screening_graph = get_screening_graph()
    deep_graph = get_deep_graph()

    for idx, sub in enumerate(sub_categories):
        sub_name = sub.get("nodeName", f"小类#{idx+1}")
        bsr_id = sub.get("bsrId", sub.get("_bsr_id", ""))
        logger.info(f"[runner-sync] 分析 [{idx+1}/{len(sub_categories)}]: {sub_name}")

        sub_state = create_sub_state(base_state, sub, idx, len(sub_categories))

        # 复用原型缓存
        if bsr_id and bsr_id in archetype_cache:
            cached = archetype_cache[bsr_id]
            sub_state["category_understanding"] = cached.get("category_understanding", {})
            sub_state["current_archetype"] = cached.get("current_archetype", "UNKNOWN")

        # ── 获取品类基线（百分位评分用，final_verdict 消费） ──
        try:
            client = get_java_client()
            baseline = await client.get_category_baseline(
                marketplace=marketplace,
                category_label=sub_name,
            )
            sub_state["category_baseline"] = baseline
            logger.info(
                f"[runner-sync] 品类基线: {sub_name} hasBaseline={baseline.get('hasBaseline', False)}"
            )
        except Exception as e:
            logger.warning(f"[runner-sync] 获取品类基线失败({sub_name}): {e}")
            # 非致命：百分位评分在 final_verdict 中优雅降级

        # Phase 1: 初筛
        try:
            final_state = await screening_graph.ainvoke(sub_state)
        except Exception as e:
            all_errors.append(f"{sub_name}: 初筛失败 - {e}")
            continue

        # 缓存原型
        if bsr_id and final_state.get("current_archetype", "UNKNOWN") != "UNKNOWN":
            archetype_cache[bsr_id] = {
                "category_understanding": final_state.get("category_understanding", {}),
                "current_archetype": final_state.get("current_archetype", "UNKNOWN"),
            }

        # 快速评分
        score, level = _quick_screening_score(final_state)

        # Phase 2: 深度分析或简要报告
        if score >= SCREENING_SCORE_THRESHOLD or level in ("STRONG_BUY", "RECOMMEND"):
            try:
                final_state = await deep_graph.ainvoke(final_state)
            except Exception as e:
                all_errors.append(f"{sub_name}: 深度分析失败 - {e}")
                # 深度分析失败 → 降级为简报并标记 screeningOnly
                brief = _generate_brief_report(final_state, score, level)
                brief["oneLineSummary"] = f"深度分析失败({e})，使用初筛结果"
                final_state["final_verdict"] = brief
                final_state["recommend_level"] = level
                final_state["opportunity_score"] = score
        else:
            brief = _generate_brief_report(final_state, score, level)
            final_state["final_verdict"] = brief
            final_state["recommend_level"] = level
            final_state["opportunity_score"] = score

        sub_errors = final_state.get("analysis_errors", [])
        all_errors.extend(sub_errors)

        verdict = final_state.get("final_verdict", {})
        all_results.append({
            "nodeId": sub.get("nodeId"),
            "bsrId": sub.get("_bsr_id", ""),
            "nodeName": sub_name,
            "recommendLevel": final_state.get("recommend_level", "WATCH"),
            "opportunityScore": final_state.get("opportunity_score", 0),
            "l2Score": final_state.get("l2_score", 0),
            "analysisReport": verdict,
            "confidence": verdict.get("confidence", 0),
            "screeningOnly": verdict.get("screeningOnly", False),
            "errors": sub_errors,
            # Java 结构化查询所需的顶层字段
            "archetype": final_state.get("current_archetype", "UNKNOWN"),
            "lifecycleStage": verdict.get("lifecycleStage") or final_state.get("lifecycle_stage", {}).get("stage", "UNKNOWN"),
            "cr3": verdict.get("cr3") or final_state.get("competition_structure", {}).get("cr3_computed", {}).get("cr3", 0),
            "profitMargin": final_state.get("profit_margin_typical", 0),
            "goNoGo": final_state.get("go_no_go", "WAIT_AND_SEE"),
            "categoryHealth": verdict.get("categoryHealth", {}),
        })

        # ── 决策反馈闭环: 记录 S1/S2 级产品决策快照 ──
        _record_decision_if_qualified(final_state, sub, marketplace)

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
