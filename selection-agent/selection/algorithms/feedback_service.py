"""反馈服务 — 管理选品决策的反馈闭环。

职责：
1. 记录选品决策快照（决策时刻的数据）
2. 收集验证结果
3. 计算准确率统计

公开函数:
    record_decision_snapshot
    compute_accuracy_stats
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class DecisionSnapshot:
    """决策快照 — 记录决策时刻的完整数据。"""
    asin: str
    marketplace: str
    decision_month: str
    category_label: str
    category_prototype: str

    # 8维评分
    selection_score: int
    selection_grade: str            # S1/S2
    sel_size_score: int
    sel_volume_score: int
    sel_profit_score: int
    sel_emotion_score: int
    sel_decor_score: int
    sel_fission_score: int
    sel_culture_score: int
    sel_market_score: int

    # 决策信息
    decision_score: float           # 0-10
    decision_status: str            # LAUNCH/CONDITIONAL/WATCH
    signal_boosts: Dict[str, Any]   # 信号加成

    # 基线数据
    baseline_bsr: Optional[int] = None
    baseline_units: Optional[int] = None
    baseline_price: Optional[float] = None
    baseline_ratings: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AccuracyStats:
    """准确率统计。"""
    total_decisions: int
    verified_count: int
    pending_count: int

    # 按结果分类
    confirmed_count: int
    exceeded_count: int
    stable_count: int
    disappointed_count: int
    data_missing_count: int

    # 准确率（CONFIRMED + EXCLUDED）/ 总验证数
    accuracy_rate: float

    # 按决策状态统计
    launch_accuracy: float
    conditional_accuracy: float
    watch_accuracy: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def record_decision_snapshot(
    asin: str,
    marketplace: str,
    category_label: str,
    category_prototype: str,
    l2_scores: Dict[str, int],
    decision_score: float,
    decision_status: str,
    signal_boosts: Optional[Dict[str, Any]] = None,
    baseline_bsr: Optional[int] = None,
    baseline_units: Optional[int] = None,
    baseline_price: Optional[float] = None,
    baseline_ratings: Optional[int] = None,
) -> DecisionSnapshot:
    """记录决策快照。

    Args:
        asin:              ASIN
        marketplace:       站点
        category_label:    品类名称
        category_prototype: 品类原型
        l2_scores:         L2 8维评分 {"size": 80, "volume": 60, ...}
        decision_score:    决策评分 0-10
        decision_status:   决策状态 LAUNCH/CONDITIONAL/WATCH
        signal_boosts:     信号加成
        baseline_*:        基线数据

    Returns:
        DecisionSnapshot
    """
    # 计算选品等级
    selection_score = sum(l2_scores.values()) // len(l2_scores) if l2_scores else 50
    selection_grade = _compute_grade(selection_score)

    now = datetime.now()
    decision_month = f"{now.year}-{now.month:02d}"

    snapshot = DecisionSnapshot(
        asin=asin,
        marketplace=marketplace,
        decision_month=decision_month,
        category_label=category_label,
        category_prototype=category_prototype,
        selection_score=selection_score,
        selection_grade=selection_grade,
        sel_size_score=l2_scores.get("size", 50),
        sel_volume_score=l2_scores.get("volume", 50),
        sel_profit_score=l2_scores.get("profit", 50),
        sel_emotion_score=l2_scores.get("emotion", 50),
        sel_decor_score=l2_scores.get("decor", 50),
        sel_fission_score=l2_scores.get("fission", 50),
        sel_culture_score=l2_scores.get("culture", 50),
        sel_market_score=l2_scores.get("market", 50),
        decision_score=decision_score,
        decision_status=decision_status,
        signal_boosts=signal_boosts or {},
        baseline_bsr=baseline_bsr,
        baseline_units=baseline_units,
        baseline_price=baseline_price,
        baseline_ratings=baseline_ratings,
    )

    logger.info(f"[feedback] 记录决策: {asin}, grade={selection_grade}, "
                f"status={decision_status}, score={selection_score}")

    return snapshot


def _compute_grade(score: int) -> str:
    """计算选品等级（验证标准，比 opportunity_classifier 更严格）。

    设计意图：初始评估用较低门槛（75/55/35）捕获更多机会，
    验证时用更高门槛（80/60）确认“真正优秀”的选品，
    避免“刚好及格”的选品被统计为成功案例。
    """
    if score >= 80:
        return "S1"
    elif score >= 60:
        return "S2"
    else:
        return "S3"


def compute_accuracy_stats(
    verification_results: List[Dict[str, Any]],
) -> AccuracyStats:
    """计算准确率统计。

    Args:
        verification_results: 验证结果列表

    Returns:
        AccuracyStats
    """
    total = len(verification_results)
    if total == 0:
        return AccuracyStats(
            total_decisions=0, verified_count=0, pending_count=0,
            confirmed_count=0, exceeded_count=0, stable_count=0,
            disappointed_count=0, data_missing_count=0,
            accuracy_rate=0, launch_accuracy=0, conditional_accuracy=0,
            watch_accuracy=0,
        )

    # 按结果分类
    outcomes = [r.get("outcome", "DATA_MISSING") for r in verification_results]
    confirmed = outcomes.count("CONFIRMED")
    exceeded = outcomes.count("EXCEEDED")
    stable = outcomes.count("STABLE")
    disappointed = outcomes.count("DISAPPOINTED")
    data_missing = outcomes.count("DATA_MISSING")

    verified = total - data_missing
    accuracy = (confirmed + exceeded) / verified if verified > 0 else 0

    # 按决策状态统计
    launch_results = [r for r in verification_results if r.get("decisionStatus") == "LAUNCH"]
    conditional_results = [r for r in verification_results if r.get("decisionStatus") == "CONDITIONAL"]
    watch_results = [r for r in verification_results if r.get("decisionStatus") == "WATCH"]

    def calc_accuracy(results):
        if not results:
            return 0
        verified = [r for r in results if r.get("outcome") != "DATA_MISSING"]
        if not verified:
            return 0
        correct = sum(1 for r in verified if r.get("outcome") in ("CONFIRMED", "EXCEEDED"))
        return correct / len(verified)

    return AccuracyStats(
        total_decisions=total,
        verified_count=verified,
        pending_count=data_missing,
        confirmed_count=confirmed,
        exceeded_count=exceeded,
        stable_count=stable,
        disappointed_count=disappointed,
        data_missing_count=data_missing,
        accuracy_rate=round(accuracy, 4),
        launch_accuracy=round(calc_accuracy(launch_results), 4),
        conditional_accuracy=round(calc_accuracy(conditional_results), 4),
        watch_accuracy=round(calc_accuracy(watch_results), 4),
    )
