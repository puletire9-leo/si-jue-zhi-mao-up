"""月度决策验证任务 — 每月2号凌晨3点自动执行。

流程:
  1. 读取上月的决策快照（S1/S2级，outcome IS NULL）
  2. 尝试通过 Java API 查询竞品验证月数据
  3. 调用 decision_verifier.batch_verify_decisions() 批量验证
  4. 回写 DecisionStore.update_verification()
  5. 生成验证报告 JSON → data/verification/

降级: Java API 未就绪时仅输出待验证清单，不阻塞。
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from selection.algorithms.decision_verifier import (
    VerificationResult,
    verify_decision,
    batch_verify_decisions,
)
from selection.algorithms.feedback_service import compute_accuracy_stats
from selection.storage.decision_store import get_decision_store

logger = logging.getLogger(__name__)

# 报告输出目录（相对于 selection-agent 根目录）
_REPORT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "verification",
)


def _get_previous_month() -> str:
    """获取上个月（YYYY-MM 格式）。"""
    now = datetime.now()
    if now.month == 1:
        return f"{now.year - 1}-12"
    return f"{now.year}-{now.month - 1:02d}"


async def run_verification(
    marketplace: str = "UK",
    decision_month: Optional[str] = None,
) -> Dict[str, Any]:
    """执行月度决策验证。

    从 SQLite 读取上月待验证决策，尝试查询竞品数据并验证。

    Args:
        marketplace:     站点 UK/DE/US
        decision_month:  决策月份（默认上月）

    Returns:
        验证摘要 {"verified": N, "total": N, "outcomes": {...}, "report_path": "..."}
    """
    if decision_month is None:
        decision_month = _get_previous_month()

    store = get_decision_store()
    pending = store.get_pending_verifications(decision_month, marketplace)

    if not pending:
        logger.info(f"[verification_task] {marketplace}/{decision_month}: 无待验证记录")
        return {
            "status": "no_pending",
            "marketplace": marketplace,
            "decision_month": decision_month,
            "total": 0,
            "verified": 0,
        }

    logger.info(
        f"[verification_task] 开始验证: {marketplace}/{decision_month}, "
        f"共 {len(pending)} 条待验证"
    )

    # ── Step 1: 尝试从 Java 获取竞品验证月数据 ──
    verify_month = decision_month  # 初始: 同月数据对比
    verify_data_map: Dict[str, Dict] = {}

    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # 收集所有待验证的 identifier
        identifiers = [r["identifier"] for r in pending]

        # 尝试调用 Java 竞品查询 API（如未实现则优雅降级）
        # POST /api/v1/competitor/products 批量查询
        try:
            raw_products = await client.query_competitor_products(
                marketplace=marketplace,
                asins=identifiers,
                month=verify_month,
            )
            if raw_products:
                verify_data_map = {
                    p.get("asin", p.get("identifier", "")): p
                    for p in raw_products
                }
                logger.info(
                    f"[verification_task] Java 竞品数据: {len(verify_data_map)} 条"
                )
        except AttributeError:
            # query_competitor_products 方法尚未在 JavaClient 中实现
            logger.info(
                "[verification_task] JavaClient.query_competitor_products 未实现，"
                "使用手动验证模式"
            )
    except Exception as e:
        logger.warning(f"[verification_task] Java 查询失败（不阻塞）: {e}")

    # ── Step 2: 逐条验证 ──
    verified_count = 0
    outcomes: Dict[str, int] = {}

    for record in pending:
        identifier = record["identifier"]

        # 如果有 Java 数据，使用真实数据验证
        verify_data = verify_data_map.get(identifier)
        if verify_data:
            result = verify_decision(
                asin=record.get("identifier", ""),
                marketplace=marketplace,
                decision_month=record.get("decision_month", decision_month),
                verify_month=verify_month,
                decision_status=record.get("decision_status", "WATCH"),
                baseline_bsr=record.get("baseline_bsr"),
                baseline_units=record.get("baseline_units"),
                baseline_price=record.get("baseline_price"),
                baseline_ratings=record.get("baseline_ratings"),
                verify_bsr=verify_data.get("bsr"),
                verify_units=verify_data.get("units"),
                verify_price=verify_data.get("price"),
                verify_ratings=verify_data.get("ratings"),
            )
        else:
            # 无 Java 数据: 标记为 DATA_MISSING（等待后续手动录入）
            result = VerificationResult(
                asin=identifier,
                marketplace=marketplace,
                decision_month=record.get("decision_month", decision_month),
                verify_month=verify_month,
                outcome="DATA_MISSING",
                outcome_detail="验证数据未就绪（Java API 未响应或竞品数据缺失）",
                bsr_change_pct=0,
                units_change_pct=0,
                ratings_change=0,
                price_change_pct=0,
                confidence=0,
            )

        store.update_verification(identifier, result)
        verified_count += 1
        outcomes[result.outcome] = outcomes.get(result.outcome, 0) + 1

    # ── Step 3: 生成验证报告 ──
    os.makedirs(_REPORT_DIR, exist_ok=True)
    report_path = os.path.join(
        _REPORT_DIR,
        f"verification_{marketplace}_{decision_month}.json",
    )

    # 重新查询已验证的记录以获取完整统计
    verified_records = [
        r for r in store.get_all_verified()
        if r.get("verify_month") == verify_month
    ]
    stats = compute_accuracy_stats(verified_records)

    report = {
        "marketplace": marketplace,
        "decision_month": decision_month,
        "verify_month": verify_month,
        "total_pending": len(pending),
        "verified_count": verified_count,
        "outcomes": outcomes,
        "accuracy": stats.to_dict(),
        "generated_at": datetime.now().isoformat(),
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    logger.info(
        f"[verification_task] 验证完成: {verified_count} 条, "
        f"准确率={stats.accuracy_rate:.1%}, "
        f"报告: {report_path}"
    )

    return {
        "status": "ok",
        "marketplace": marketplace,
        "decision_month": decision_month,
        "total": len(pending),
        "verified": verified_count,
        "outcomes": outcomes,
        "accuracy": stats.accuracy_rate,
        "report_path": report_path,
    }
