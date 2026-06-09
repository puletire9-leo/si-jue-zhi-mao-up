"""季度权重校准任务 — 每季度初自动执行，需人工审批生效。

流程:
  1. 按品类原型分组读取已验证的决策记录
  2. 每组调用 weight_calibrator.calibrate_weights()
  3. 校准结果写入 WeightStore（is_approved=0 待审批）
  4. 生成 Markdown 校准报告 → data/calibration/

审批: 管理员通过 POST /selection/calibrate/approve 审批后生效。
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from selection.algorithms.weight_calibrator import calibrate_weights, CalibrationResult
from selection.storage.decision_store import get_decision_store
from selection.storage.weight_store import get_weight_store

logger = logging.getLogger(__name__)

# 报告输出目录
_REPORT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "calibration",
)

# 按优先级排序的品类原型列表
_ALL_ARCHETYPES = ["DA", "FH", "FP", "TN", "PE", "PS", "BASIC"]


async def run_calibration(
    archetype: Optional[str] = None,
    min_samples: int = 30,
) -> Dict[str, Any]:
    """执行季度权重校准。

    按原型分组对已验证决策进行权重校准，结果存储到 WeightStore 等待审批。

    Args:
        archetype:  指定原型（None=全部）
        min_samples: 最小样本数（不足则跳过该原型）

    Returns:
        校准摘要 {"total": N, "calibrated": N, "details": [...]}
    """
    store = get_decision_store()
    weight_store = get_weight_store()

    archetypes = [archetype] if archetype else _ALL_ARCHETYPES
    results: List[CalibrationResult] = []
    details: List[Dict] = []

    for arch in archetypes:
        # 获取该原型下已验证的决策记录
        records = store.get_verified_by_archetype(arch, min_count=min_samples)

        if not records:
            logger.info(
                f"[calibration_task] {arch}: 已验证样本不足(<{min_samples})，跳过"
            )
            details.append({
                "archetype": arch,
                "status": "skipped",
                "reason": f"样本不足（需要 {min_samples}，实际 {len(records) if records else 0}）",
            })
            continue

        logger.info(f"[calibration_task] {arch}: {len(records)} 条样本，开始校准")

        try:
            result = calibrate_weights(arch, records)
            calibration_id = weight_store.insert(result)
            results.append(result)
            details.append({
                "archetype": arch,
                "status": "calibrated",
                "calibration_id": calibration_id,
                "sample_size": result.sample_size,
                "accuracy_before": result.accuracy_before,
                "accuracy_after": result.accuracy_after,
                "adjustments": {
                    dim: f"{result.original_weights.get(dim, 0)}→{result.calibrated_weights.get(dim, 0)}"
                    for dim in result.original_weights
                    if result.original_weights.get(dim) != result.calibrated_weights.get(dim)
                },
                "reason": result.adjustment_reason,
            })
            logger.info(
                f"[calibration_task] {arch}: "
                f"准确率 {result.accuracy_before:.1%}→{result.accuracy_after:.1%}, "
                f"id={calibration_id}"
            )
        except Exception as e:
            logger.error(f"[calibration_task] {arch} 校准失败: {e}")
            details.append({
                "archetype": arch,
                "status": "error",
                "error": str(e),
            })

    # ── 生成报告 ──
    os.makedirs(_REPORT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path_json = os.path.join(
        _REPORT_DIR, f"calibration_{timestamp}.json"
    )

    report = {
        "generated_at": datetime.now().isoformat(),
        "total_archetypes": len(archetypes),
        "calibrated_count": len(results),
        "details": details,
    }

    with open(report_path_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # 同时生成 Markdown 报告（可读版本）
    md_path = os.path.join(_REPORT_DIR, f"calibration_{timestamp}.md")
    _generate_markdown_report(report, md_path)

    logger.info(
        f"[calibration_task] 完成: {len(results)}/{len(archetypes)} 原型已校准, "
        f"报告: {report_path_json}"
    )

    return {
        "status": "ok",
        "total_archetypes": len(archetypes),
        "calibrated_count": len(results),
        "details": details,
        "report_path": report_path_json,
    }


def _generate_markdown_report(report: Dict, path: str) -> None:
    """生成 Markdown 格式校准报告。"""
    lines = [
        "# 权重校准报告",
        "",
        f"**生成时间**: {report['generated_at']}",
        f"**总原型数**: {report['total_archetypes']}",
        f"**已校准**: {report['calibrated_count']}",
        "",
        "---",
        "",
    ]

    for d in report.get("details", []):
        arch = d["archetype"]
        status = d["status"]
        if status == "skipped":
            lines.append(f"## {arch} — ⏭️ 跳过")
            lines.append(f"- **原因**: {d.get('reason', '')}")
        elif status == "error":
            lines.append(f"## {arch} — ❌ 失败")
            lines.append(f"- **错误**: {d.get('error', '')}")
        elif status == "calibrated":
            lines.append(f"## {arch} — ✅ 已校准 (id={d['calibration_id']})")
            lines.append(f"- **样本数**: {d['sample_size']}")
            lines.append(f"- **校准前准确率**: {d['accuracy_before']:.1%}")
            lines.append(f"- **校准后准确率**: {d['accuracy_after']:.1%}")
            adjustments = d.get("adjustments", {})
            if adjustments:
                lines.append("- **调整项**:")
                for dim, adj in adjustments.items():
                    lines.append(f"  - {dim}: {adj}")
            else:
                lines.append("- **调整项**: 无（无需调整）")
            lines.append(f"- **原因**: {d.get('reason', '')}")
        lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
