"""百分位评分器 — 将产品指标转换为品类内相对百分位得分。

从 Java 后端获取品类基线数据，计算产品在品类中的相对位置。
用于动态评分：相同指标在不同品类中获得不同评价。

公开函数:
    score_percentile
    score_dimensions_percentile
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PercentileResult:
    """单维度百分位评分结果。"""
    dimension: str
    raw_value: float           # 原始值
    percentile: float          # 百分位 0-100
    band: str                  # TOP/Q1/MEDIAN/Q3/BOTTOM
    vs_median: float           # 与中位数的偏差（正=高于中位数）

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DimensionPercentiles:
    """品类基线百分位数据（P25/P50/P75）。"""
    p25: float
    p50: float  # 中位数
    p75: float

    @classmethod
    def from_dict(cls, data: Dict[str, float]) -> "DimensionPercentiles":
        return cls(
            p25=float(data.get("p25", 0)),
            p50=float(data.get("p50", 50)),
            p75=float(data.get("p75", 100)),
        )


def score_percentile(
    raw_value: float,
    percentiles: DimensionPercentiles,
) -> PercentileResult:
    """计算单个维度的百分位得分。

    基于品类基线的 P25/P50/P75 将原始值映射到百分位。

    Args:
        raw_value:   产品的原始指标值（0-100 分）
        percentiles: 品类基线的百分位数据

    Returns:
        PercentileResult
    """
    p25, p50, p75 = percentiles.p25, percentiles.p50, percentiles.p75

    # 计算百分位（线性插值）
    if raw_value <= p25:
        # 低于 P25 → 0-25 分位
        if p25 > 0:
            percentile = (raw_value / p25) * 25
        else:
            percentile = 12.5
    elif raw_value <= p50:
        # P25-P50 → 25-50 分位
        range_val = p50 - p25
        if range_val > 0:
            percentile = 25 + ((raw_value - p25) / range_val) * 25
        else:
            percentile = 37.5
    elif raw_value <= p75:
        # P50-P75 → 50-75 分位
        range_val = p75 - p50
        if range_val > 0:
            percentile = 50 + ((raw_value - p50) / range_val) * 25
        else:
            percentile = 62.5
    else:
        # 高于 P75 → 75-100 分位
        # 使用 P75 到 P75*1.5 的范围映射到 75-100
        upper_bound = p75 * 1.5 if p75 > 0 else 100
        range_val = upper_bound - p75
        if range_val > 0:
            percentile = 75 + min(((raw_value - p75) / range_val) * 25, 25)
        else:
            percentile = 87.5

    percentile = max(0, min(100, percentile))

    # 判定分位带
    if percentile >= 80:
        band = "TOP"
    elif percentile >= 60:
        band = "Q1"
    elif percentile >= 40:
        band = "MEDIAN"
    elif percentile >= 20:
        band = "Q3"
    else:
        band = "BOTTOM"

    # 与中位数偏差
    vs_median = raw_value - p50

    return PercentileResult(
        dimension="",
        raw_value=round(raw_value, 2),
        percentile=round(percentile, 1),
        band=band,
        vs_median=round(vs_median, 2),
    )


def score_dimensions_percentile(
    dimension_scores: Dict[str, float],
    baseline_percentiles: Dict[str, Dict[str, float]],
    dimensions: Optional[List[str]] = None,
) -> Dict[str, PercentileResult]:
    """批量计算多个维度的百分位得分。

    Args:
        dimension_scores:      产品的各维度原始分 {"size": 80, "volume": 60, ...}
        baseline_percentiles:  品类基线百分位数据 {"size": {"p25": 40, "p50": 50, "p75": 70}, ...}
        dimensions:            要计算的维度列表，默认全部8维

    Returns:
        各维度的百分位评分结果
    """
    if dimensions is None:
        dimensions = ["size", "volume", "profit", "emotion", "decor", "fission", "culture", "market"]

    results = {}
    for dim in dimensions:
        raw = dimension_scores.get(dim, 50)
        baseline = baseline_percentiles.get(dim, {"p25": 40, "p50": 50, "p75": 60})
        percentiles = DimensionPercentiles.from_dict(baseline)

        result = score_percentile(raw, percentiles)
        result.dimension = dim
        results[dim] = result

    return results


def compute_composite_percentile(
    dimension_results: Dict[str, PercentileResult],
    weights: Dict[str, int],
) -> float:
    """计算综合百分位得分（加权平均）。

    Args:
        dimension_results: 各维度百分位结果
        weights:           维度权重 {"size": 15, "volume": 10, ...}

    Returns:
        综合百分位得分 0-100
    """
    total_weight = sum(weights.values())
    if total_weight == 0:
        return 50.0

    weighted_sum = 0.0
    for dim, weight in weights.items():
        if dim in dimension_results:
            weighted_sum += dimension_results[dim].percentile * weight
        else:
            weighted_sum += 50 * weight  # 默认中位数

    return round(weighted_sum / total_weight, 1)


def classify_relative_position(
    composite_percentile: float,
) -> str:
    """根据综合百分位判定产品在品类中的相对位置。

    Returns:
        TOP/Q1/MEDIAN/Q3/BOTTOM
    """
    if composite_percentile >= 80:
        return "TOP"
    elif composite_percentile >= 60:
        return "Q1"
    elif composite_percentile >= 40:
        return "MEDIAN"
    elif composite_percentile >= 20:
        return "Q3"
    else:
        return "BOTTOM"
