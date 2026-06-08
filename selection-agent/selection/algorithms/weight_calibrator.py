"""权重校准器 — 根据验证结果自动调整评分权重。

校准逻辑：
1. 分析验证结果中哪些维度与成功/失败最相关
2. 增强预测准确的维度权重，降低预测不准的维度权重
3. 保持权重总和为100%，单维度变化不超过±5%

公开函数:
    calibrate_weights
    compute_dimension_correlation
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import ARCHETYPE_WEIGHTS

logger = logging.getLogger(__name__)


@dataclass
class CalibrationResult:
    """校准结果。"""
    archetype: str
    original_weights: Dict[str, int]
    calibrated_weights: Dict[str, int]
    dimension_correlations: Dict[str, float]  # 各维度与成功的相关性
    adjustment_reason: str
    sample_size: int
    accuracy_before: float
    accuracy_after: float  # 模拟准确率

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def compute_dimension_correlation(
    decisions: List[Dict[str, Any]],
    dimension: str,
) -> float:
    """计算单个维度与决策成功的相关性。

    Args:
        decisions: 验证结果列表（含8维评分和outcome）
        dimension: 维度名称

    Returns:
        相关系数 -1.0 到 1.0（正=该维度高分与成功正相关）
    """
    if not decisions:
        return 0.0

    # 提取该维度分数和结果
    scores = []
    outcomes = []

    for d in decisions:
        score = d.get(f"sel_{dimension}_score", d.get("selectionScore", 50))
        outcome = d.get("outcome", "DATA_MISSING")

        if outcome == "DATA_MISSING":
            continue

        scores.append(float(score) if score else 50)
        # 成功=1, 稳定=0.5, 失败=0
        if outcome in ("CONFIRMED", "EXCEEDED"):
            outcomes.append(1.0)
        elif outcome == "STABLE":
            outcomes.append(0.5)
        else:
            outcomes.append(0.0)

    if len(scores) < 5:
        return 0.0  # 样本太少

    # 简化的相关系数计算（Pearson）
    n = len(scores)
    mean_x = sum(scores) / n
    mean_y = sum(outcomes) / n

    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(scores, outcomes))
    denom_x = sum((x - mean_x) ** 2 for x in scores) ** 0.5
    denom_y = sum((y - mean_y) ** 2 for y in outcomes) ** 0.5

    if denom_x == 0 or denom_y == 0:
        return 0.0

    correlation = numerator / (denom_x * denom_y)
    return round(correlation, 4)


def calibrate_weights(
    archetype: str,
    verification_results: List[Dict[str, Any]],
    max_adjustment: int = 5,
) -> CalibrationResult:
    """根据验证结果校准权重。

    Args:
        archetype:            品类原型
        verification_results: 验证结果列表
        max_adjustment:       单维度最大调整幅度（±）

    Returns:
        CalibrationResult
    """
    original = ARCHETYPE_WEIGHTS.get(archetype, ARCHETYPE_WEIGHTS["BASIC"]).copy()

    if len(verification_results) < 10:
        logger.info(f"[calibrator] 样本不足({len(verification_results)}条)，跳过校准")
        return CalibrationResult(
            archetype=archetype,
            original_weights=original,
            calibrated_weights=original,
            dimension_correlations={dim: 0.0 for dim in original},
            adjustment_reason="样本不足，保持原始权重",
            sample_size=len(verification_results),
            accuracy_before=0,
            accuracy_after=0,
        )

    # 计算各维度相关性
    dimensions = ["size", "volume", "profit", "emotion", "decor", "fission", "culture", "market"]
    correlations = {}
    for dim in dimensions:
        correlations[dim] = compute_dimension_correlation(verification_results, dim)

    # 基于相关性调整权重
    calibrated = original.copy()
    adjustments = {}

    for dim in dimensions:
        corr = correlations.get(dim, 0)
        current_weight = original.get(dim, 10)

        if corr > 0.3:
            # 正相关强 → 增加权重
            adjustment = min(int(corr * max_adjustment), max_adjustment)
        elif corr < -0.3:
            # 负相关强 → 减少权重
            adjustment = max(int(corr * max_adjustment), -max_adjustment)
        else:
            # 弱相关 → 保持
            adjustment = 0

        new_weight = max(0, min(40, current_weight + adjustment))
        calibrated[dim] = new_weight
        if adjustment != 0:
            adjustments[dim] = adjustment

    # 归一化到100%
    total = sum(calibrated.values())
    if total > 0:
        calibrated = {dim: round(w / total * 100) for dim, w in calibrated.items()}

        # 修正舍入误差
        diff = 100 - sum(calibrated.values())
        if diff != 0:
            # 将差值加到权重最大的维度
            max_dim = max(calibrated, key=calibrated.get)
            calibrated[max_dim] += diff

    # 计算模拟准确率
    accuracy_before = _simulate_accuracy(verification_results, original)
    accuracy_after = _simulate_accuracy(verification_results, calibrated)

    reason = f"基于{len(verification_results)}条验证记录校准"
    if adjustments:
        adj_str = ", ".join(f"{d}{'+' if a > 0 else ''}{a}" for d, a in adjustments.items())
        reason += f"，调整: {adj_str}"
    else:
        reason += "，无需调整"

    logger.info(f"[calibrator] {archetype}: {original} → {calibrated}")

    return CalibrationResult(
        archetype=archetype,
        original_weights=original,
        calibrated_weights=calibrated,
        dimension_correlations=correlations,
        adjustment_reason=reason,
        sample_size=len(verification_results),
        accuracy_before=round(accuracy_before, 4),
        accuracy_after=round(accuracy_after, 4),
    )


def _simulate_accuracy(
    verification_results: List[Dict[str, Any]],
    weights: Dict[str, int],
) -> float:
    """模拟使用新权重的准确率。

    简化逻辑：用加权分数预测成功/失败，与实际结果对比。
    """
    correct = 0
    total = 0

    for result in verification_results:
        outcome = result.get("outcome", "DATA_MISSING")
        if outcome == "DATA_MISSING":
            continue

        total += 1

        # 计算加权分
        weighted_score = 0
        for dim, weight in weights.items():
            score = result.get(f"sel_{dim}_score", 50)
            weighted_score += (score or 50) * weight / 100

        # 预测：加权分>60 → 成功
        predicted_success = weighted_score > 60
        actual_success = outcome in ("CONFIRMED", "EXCEEDED")

        if predicted_success == actual_success:
            correct += 1

    return correct / total if total > 0 else 0
