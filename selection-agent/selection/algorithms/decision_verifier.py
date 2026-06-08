"""决策验证器 — 3个月后验证选品决策准确性。

验证逻辑：
1. 对比决策时的基线数据与当前数据
2. 根据 BSR/销量/评论变化判定结果
3. 计算预测准确率

验证结果分类：
- CONFIRMED:  预测正确，产品表现符合预期
- EXCEEDED:   超出预期，表现优于预测
- STABLE:     表现稳定，无明显变化
- DISAPPOINTED: 低于预期，表现不佳
- DATA_MISSING: 数据不足，无法验证

公开函数:
    verify_decision
    batch_verify_decisions
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class VerificationResult:
    """单个决策验证结果。"""
    asin: str
    marketplace: str
    decision_month: str
    verify_month: str
    outcome: str                    # CONFIRMED/EXCEEDED/STABLE/DISAPPOINTED/DATA_MISSING
    outcome_detail: str
    bsr_change_pct: float           # BSR变化百分比（负=改善）
    units_change_pct: float         # 销量变化百分比
    ratings_change: int             # 评论数变化
    price_change_pct: float         # 价格变化百分比
    confidence: float               # 验证置信度

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def verify_decision(
    asin: str,
    marketplace: str,
    decision_month: str,
    verify_month: str,
    decision_status: str,           # LAUNCH/CONDITIONAL/WATCH
    # 决策时基线
    baseline_bsr: Optional[int] = None,
    baseline_units: Optional[int] = None,
    baseline_price: Optional[float] = None,
    baseline_ratings: Optional[int] = None,
    # 验证时数据
    verify_bsr: Optional[int] = None,
    verify_units: Optional[int] = None,
    verify_price: Optional[float] = None,
    verify_ratings: Optional[int] = None,
) -> VerificationResult:
    """验证单个选品决策。

    Args:
        asin:              ASIN
        marketplace:       站点
        decision_month:    决策月份
        verify_month:      验证月份
        decision_status:   决策状态 LAUNCH/CONDITIONAL/WATCH
        baseline_*:        决策时基线数据
        verify_*:          验证时当前数据

    Returns:
        VerificationResult
    """
    # 数据完整性检查
    if all(v is None for v in [baseline_bsr, baseline_units, baseline_price]):
        return VerificationResult(
            asin=asin,
            marketplace=marketplace,
            decision_month=decision_month,
            verify_month=verify_month,
            outcome="DATA_MISSING",
            outcome_detail="决策时基线数据缺失",
            bsr_change_pct=0,
            units_change_pct=0,
            ratings_change=0,
            price_change_pct=0,
            confidence=0,
        )

    if all(v is None for v in [verify_bsr, verify_units, verify_price]):
        return VerificationResult(
            asin=asin,
            marketplace=marketplace,
            decision_month=decision_month,
            verify_month=verify_month,
            outcome="DATA_MISSING",
            outcome_detail="验证时数据缺失",
            bsr_change_pct=0,
            units_change_pct=0,
            ratings_change=0,
            price_change_pct=0,
            confidence=0,
        )

    # 计算变化
    bsr_change_pct = 0
    if baseline_bsr and verify_bsr and baseline_bsr > 0:
        bsr_change_pct = ((verify_bsr - baseline_bsr) / baseline_bsr) * 100

    units_change_pct = 0
    if baseline_units and verify_units and baseline_units > 0:
        units_change_pct = ((verify_units - baseline_units) / baseline_units) * 100

    ratings_change = 0
    if baseline_ratings is not None and verify_ratings is not None:
        ratings_change = verify_ratings - baseline_ratings

    price_change_pct = 0
    if baseline_price and verify_price and baseline_price > 0:
        price_change_pct = ((verify_price - baseline_price) / baseline_price) * 100

    # 判定结果
    outcome, detail, confidence = _classify_outcome(
        decision_status=decision_status,
        bsr_change_pct=bsr_change_pct,
        units_change_pct=units_change_pct,
        ratings_change=ratings_change,
        price_change_pct=price_change_pct,
    )

    return VerificationResult(
        asin=asin,
        marketplace=marketplace,
        decision_month=decision_month,
        verify_month=verify_month,
        outcome=outcome,
        outcome_detail=detail,
        bsr_change_pct=round(bsr_change_pct, 2),
        units_change_pct=round(units_change_pct, 2),
        ratings_change=ratings_change,
        price_change_pct=round(price_change_pct, 2),
        confidence=round(confidence, 2),
    )


def _classify_outcome(
    decision_status: str,
    bsr_change_pct: float,
    units_change_pct: float,
    ratings_change: int,
    price_change_pct: float,
) -> tuple:
    """根据数据变化判定验证结果。

    Returns:
        (outcome, detail, confidence)
    """
    # BSR改善 = 负值（排名下降=更好）
    bsr_improved = bsr_change_pct < -10
    bsr_stable = -10 <= bsr_change_pct <= 10
    bsr_worsened = bsr_change_pct > 10

    # 销量增长
    units_grew = units_change_pct > 20
    units_stable = -20 <= units_change_pct <= 20
    units_declined = units_change_pct < -20

    # 评论增长 = 市场验证
    ratings_grew = ratings_change > 10

    # 综合判定
    positive_signals = sum([bsr_improved, units_grew, ratings_grew])
    negative_signals = sum([bsr_worsened, units_declined])

    if positive_signals >= 2:
        if decision_status == "LAUNCH":
            return "CONFIRMED", f"LAUNCH决策正确：BSR变化{bsr_change_pct:.1f}%，销量变化{units_change_pct:.1f}%", 0.85
        elif decision_status == "CONDITIONAL":
            return "EXCEEDED", f"CONDITIONAL决策超出预期：BSR改善{abs(bsr_change_pct):.1f}%", 0.80
        else:
            return "EXCEEDED", f"WATCH类产品表现优异：应更早介入", 0.75

    elif negative_signals >= 2:
        if decision_status == "LAUNCH":
            return "DISAPPOINTED", f"LAUNCH决策未达预期：BSR变化{bsr_change_pct:.1f}%，销量变化{units_change_pct:.1f}%", 0.80
        elif decision_status == "CONDITIONAL":
            return "DISAPPOINTED", f"CONDITIONAL决策验证：产品表现不佳", 0.75
        else:
            return "CONFIRMED", f"WATCH决策正确：产品确需观望", 0.70

    else:
        # 表现稳定
        if decision_status == "LAUNCH":
            return "STABLE", f"LAUNCH产品表现稳定：无明显波动", 0.70
        elif decision_status == "CONDITIONAL":
            return "STABLE", f"CONDITIONAL产品表现平稳", 0.65
        else:
            return "STABLE", f"WATCH产品无明显变化", 0.60


def batch_verify_decisions(
    decisions: List[Dict[str, Any]],
    verify_month: str,
) -> List[VerificationResult]:
    """批量验证决策。

    Args:
        decisions:    决策记录列表（含基线和验证数据）
        verify_month: 验证月份

    Returns:
        验证结果列表
    """
    results = []

    for decision in decisions:
        result = verify_decision(
            asin=decision.get("asin", ""),
            marketplace=decision.get("marketplace", "UK"),
            decision_month=decision.get("decisionMonth", ""),
            verify_month=verify_month,
            decision_status=decision.get("decisionStatus", "WATCH"),
            baseline_bsr=decision.get("baselineBsr"),
            baseline_units=decision.get("baselineUnits"),
            baseline_price=decision.get("baselinePrice"),
            baseline_ratings=decision.get("baselineRatings"),
            verify_bsr=decision.get("verifyBsr"),
            verify_units=decision.get("verifyUnits"),
            verify_price=decision.get("verifyPrice"),
            verify_ratings=decision.get("verifyRatings"),
        )
        results.append(result)

    logger.info(f"[decision_verifier] 批量验证: {len(results)}条, "
                f"CONFIRMED={sum(1 for r in results if r.outcome == 'CONFIRMED')}, "
                f"DISAPPOINTED={sum(1 for r in results if r.outcome == 'DISAPPOINTED')}")

    return results
