"""选品分析 SSE 路由 — 前端直连的核心端点。

前端通过 SSE 建立长连接，实时接收每个节点的分析进度。

SSE 事件类型：
  - start:        分析开始
  - data_ready:   数据拉取完成，知道要分析多少个小类
  - sub_start:    某个小类开始分析
  - progress:     节点完成（含摘要信息）
  - node_error:   节点失败（不阻断流程）
  - sub_complete:  某个小类分析完成
  - heartbeat:    心跳保活
  - writeback:    正在回写 Java
  - complete:     全部分析完成
  - error:        图执行整体失败
"""

import json
import logging
import os
from typing import Any, Dict, List

from fastapi import APIRouter, Body, Query
from sse_starlette.sse import EventSourceResponse

from selection.runner import run_selection_stream, run_and_writeback

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/selection", tags=["选品分析"])


@router.get("/analyze")
async def analyze_selection(
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
    month: str = Query(..., description="数据月份 如 202605"),
):
    """SSE 端点 — 郑总店铺品线分析（从deng_zong_shop聚合→多小类循环+回写Java）。

    前端调用方式:
    ```
    const evtSource = new EventSource(
      '/selection/analyze?marketplace=UK&month=202605'
    );
    ```

    典型事件流:
    1. start       → 分析开始
    2. data_ready  → "共N个小类待分析"
    3. sub_start   → "开始分析 Nail Tips"
    4. progress ×N → "能力1完成..."
    5. complete    → "全部完成"
    """
    logger.info(f"[SSE] 新分析请求: marketplace={marketplace}, month={month}")

    async def event_generator():
        async for event in run_selection_stream(marketplace, month):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"], ensure_ascii=False),
            }

    return EventSourceResponse(event_generator())


@router.post("/analyze-sync")
async def analyze_selection_sync(
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
    month: str = Query(..., description="数据月份 如 202605"),
):
    """同步端点 — 对郑总店铺品线做全量分析并回写。

    数据源: deng_zong_shop → L1品线(bsr_id) → L2小类(node_id)
    """
    logger.info(f"[sync] 新分析请求: marketplace={marketplace}, month={month}")
    result = await run_and_writeback(marketplace, month)
    return result


# ── 决策验证端点 ───────────────────────────────────────────

@router.post("/verify")
async def verify_decisions(
    decisions: List[Dict[str, Any]] = Body(..., description="决策列表"),
):
    """批量验证历史选品决策准确性。"""
    from selection.algorithms.decision_verifier import batch_verify_decisions
    verify_month = datetime.now().strftime("%Y-%m")
    results = batch_verify_decisions(decisions, verify_month)
    return {
        "verified": len(results),
        "results": [r.__dict__ for r in results],
    }


# ── 反馈闭环端点（重构: SQLite pipeline 替代 JSONL 直写） ──

from datetime import datetime


@router.post("/feedback")
async def record_feedback(
    feedback: Dict[str, Any] = Body(..., description="选品决策反馈"),
):
    """记录选品决策反馈 — 走算法验证 pipeline 写入 SQLite。

    请求体:
      - identifier:    决策标识 (bsrId/nodeId)
      - marketplace:   站点
      - outcome:       人工判定结果 CONFIRMED/EXCEEDED/STABLE/DISAPPOINTED
      - detail:        说明 (可选)
      - verifyBsr:     验证时 BSR (可选)
      - verifyUnits:   验证时月销 (可选)
      - verifyPrice:   验证时均价 (可选)
      - verifyRatings: 验证时评论数 (可选)
    """
    from selection.storage.decision_store import get_decision_store
    from selection.algorithms.decision_verifier import verify_decision

    store = get_decision_store()
    identifier = feedback.get("identifier", "")
    marketplace = feedback.get("marketplace", "UK")

    if not identifier:
        return {"status": "error", "message": "缺少 identifier 字段"}

    # 尝试获取原始决策快照
    snapshot = store.get_snapshot(identifier, marketplace)

    if snapshot and feedback.get("verifyBsr") is not None:
        # 有原始快照 + 验证数据 → 走 algorithm pipeline
        verify_month = feedback.get("verifyMonth") or datetime.now().strftime("%Y-%m")
        result = verify_decision(
            asin=identifier,
            marketplace=marketplace,
            decision_month=snapshot.get("decision_month", ""),
            verify_month=verify_month,
            decision_status=snapshot.get("decision_status", "WATCH"),
            baseline_bsr=snapshot.get("baseline_bsr"),
            baseline_units=snapshot.get("baseline_units"),
            baseline_price=snapshot.get("baseline_price"),
            baseline_ratings=snapshot.get("baseline_ratings"),
            verify_bsr=feedback.get("verifyBsr"),
            verify_units=feedback.get("verifyUnits"),
            verify_price=feedback.get("verifyPrice"),
            verify_ratings=feedback.get("verifyRatings"),
        )
        store.update_verification(identifier, result)
        return {
            "status": "ok",
            "outcome": result.outcome,
            "outcome_detail": result.outcome_detail,
            "confidence": result.confidence,
        }
    else:
        # 手动录入（无原始快照或仅有人工判定）
        outcome = feedback.get("outcome", "DATA_MISSING")
        detail = feedback.get("detail", "人工录入反馈")
        ok = store.update_verification_manual(identifier, marketplace, outcome, detail)
        if ok:
            return {"status": "ok", "outcome": outcome, "source": "manual"}
        else:
            return {
                "status": "not_found",
                "message": f"未找到待验证记录: {identifier}/{marketplace}",
            }


@router.get("/feedback/stats")
async def feedback_stats(
    archetype: str = Query(None, description="品类原型过滤（可选）"),
):
    """查询反馈统计 — 使用 compute_accuracy_stats() 算法统计。"""
    from selection.storage.decision_store import get_decision_store
    from selection.algorithms.feedback_service import compute_accuracy_stats

    store = get_decision_store()
    records = store.get_all_verified(archetype=archetype)

    # 转换为 feedback_service 期望的字段名
    normalized = [
        {
            "outcome": r.get("outcome", "DATA_MISSING"),
            "decisionStatus": r.get("decision_status", "WATCH"),
            "selectionScore": r.get("selection_score", 0),
        }
        for r in records
    ]
    stats = compute_accuracy_stats(normalized)

    return {
        "total_decisions": store.get_summary_stats()["total"],
        "verified_count": len(records),
        "accuracy": stats.to_dict(),
    }


# ── 验证管理端点 ───────────────────────────────────────────

@router.post("/verification/run")
async def trigger_verification(
    marketplace: str = Query("UK", description="站点"),
    decision_month: str = Query(None, description="决策月份（默认上月）"),
):
    """手动触发月度决策验证任务。"""
    from selection.tasks.verification_task import run_verification
    result = await run_verification(marketplace, decision_month)
    return result


@router.get("/verification/report")
async def verification_report(
    marketplace: str = Query("UK", description="站点"),
    decision_month: str = Query(..., description="决策月份 如 2026-06"),
):
    """查看指定月份的验证报告。"""
    import os as _os
    report_dir = _os.path.join(
        _os.path.dirname(_os.path.dirname(__file__)),
        "data", "verification",
    )
    report_path = _os.path.join(
        report_dir, f"verification_{marketplace}_{decision_month}.json"
    )
    if not _os.path.exists(report_path):
        return {"status": "not_found", "message": f"报告不存在: {report_path}"}
    with open(report_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── 权重校准端点 ───────────────────────────────────────────

@router.post("/calibrate")
async def trigger_calibration(
    archetype: str = Query(None, description="指定原型（None=全部）"),
    min_samples: int = Query(30, description="最小样本数"),
):
    """手动触发权重校准任务。

    校准结果写入 WeightStore（is_approved=0 待审批），
    需通过 /calibrate/approve 审批后生效。
    """
    from selection.tasks.calibration_task import run_calibration
    result = await run_calibration(
        archetype=archetype if archetype else None,
        min_samples=min_samples,
    )
    return result


@router.post("/calibrate/approve")
async def approve_calibration(
    calibration_id: int = Body(..., embed=True, description="校准记录ID"),
    approved_by: str = Body("admin", embed=True, description="审批人"),
):
    """审批通过校准结果 — 同原型旧审批自动废弃。"""
    from selection.storage.weight_store import get_weight_store
    store = get_weight_store()
    ok = store.approve(calibration_id, approved_by)
    if ok:
        return {"status": "ok", "message": f"校准 id={calibration_id} 已审批通过"}
    return {"status": "not_found", "message": f"校准记录不存在: {calibration_id}"}


@router.get("/calibrate/history")
async def calibration_history():
    """查看全部校准历史（含审批状态）。"""
    from selection.storage.weight_store import get_weight_store
    store = get_weight_store()
    records = store.get_all()
    # JSON 字符串反序列化
    for r in records:
        for key in ("weights_json", "original_weights_json", "dimension_correlations_json"):
            if key in r and isinstance(r[key], str):
                try:
                    r[key] = json.loads(r[key])
                except (json.JSONDecodeError, TypeError):
                    pass
    return {"total": len(records), "records": records}
