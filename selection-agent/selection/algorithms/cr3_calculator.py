"""CR3竞争集中度计算器 — 纯函数，不依赖LLM/网络。

CR3 (Concentration Ratio 3) = Top 3 品牌的市场份额之和。
4档判定：FRAGMENTED / MODERATE / OLIGOPOLY / MONOPOLY

公开函数:
    calculate_cr3
"""

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from selection.algorithms.constants import CR3_THRESHOLDS

logger = logging.getLogger(__name__)


@dataclass
class CR3Result:
    """CR3计算结果。"""
    cr3: float              # 0.0-1.0，top3品牌份额之和
    pattern: str            # FRAGMENTED/MODERATE/OLIGOPOLY/MONOPOLY
    entry_barrier: str      # LOW/MEDIUM/HIGH/VERY_HIGH
    top3_brands: List[Dict[str, Any]]  # top3品牌详情
    brand_count: int        # 参与计算的品牌数
    method: str             # SHARE / COUNT / INSUFFICIENT

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# 进入壁垒映射
_BARRIER_MAP = {
    "FRAGMENTED": "LOW",
    "MODERATE": "MEDIUM",
    "OLIGOPOLY": "HIGH",
    "MONOPOLY": "VERY_HIGH",
}


def _classify_pattern(cr3: float) -> str:
    """根据CR3值判定竞争格局。"""
    if cr3 < CR3_THRESHOLDS["FRAGMENTED"]:
        return "FRAGMENTED"
    elif cr3 < CR3_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    elif cr3 < CR3_THRESHOLDS["OLIGOPOLY"]:
        return "OLIGOPOLY"
    else:
        return "MONOPOLY"


def calculate_cr3(
    top_brands: List[Dict[str, Any]],
    product_count: int = 0,
) -> CR3Result:
    """计算CR3竞争集中度。

    支持两种输入格式：
    - share格式: [{"name": "Brand A", "share": 0.25}, ...]
    - count格式: [{"name": "Brand A", "productCount": 50}, ...]

    自动检测格式，count格式需要 product_count 总量来计算份额。

    Args:
        top_brands:    品牌列表（按份额/数量降序排列）
        product_count: 品类总商品数（count格式时使用）

    Returns:
        CR3Result
    """
    if not top_brands:
        return CR3Result(
            cr3=0.0, pattern="FRAGMENTED", entry_barrier="LOW",
            top3_brands=[], brand_count=0, method="INSUFFICIENT",
        )

    # 检测格式：优先用 share，否则用 productCount
    has_share = any("share" in b for b in top_brands[:3])
    has_count = any("productCount" in b or "count" in b for b in top_brands[:3])

    # 标准化品牌数据
    brands: List[Dict[str, Any]] = []

    if has_share:
        # share 格式：直接使用份额
        for b in top_brands:
            name = b.get("name", b.get("brandName", "Unknown"))
            share = float(b.get("share", 0))
            brands.append({"name": name, "share": share})
        method = "SHARE"
    elif has_count and product_count > 0:
        # count 格式：份额 = 品牌商品数 / 总商品数
        for b in top_brands:
            name = b.get("name", b.get("brandName", "Unknown"))
            count = float(b.get("productCount", b.get("count", 0)))
            share = count / product_count if product_count else 0
            brands.append({"name": name, "share": round(share, 4)})
        method = "COUNT"
    else:
        # 无法计算
        logger.warning(f"[cr3] 数据不足: top_brands有{len(top_brands)}条但无share/count字段")
        return CR3Result(
            cr3=0.0, pattern="FRAGMENTED", entry_barrier="LOW",
            top3_brands=top_brands[:3], brand_count=len(top_brands),
            method="INSUFFICIENT",
        )

    # 按份额降序排列
    brands.sort(key=lambda x: x["share"], reverse=True)

    # 取 top3 计算 CR3
    top3 = brands[:3]
    cr3 = sum(b["share"] for b in top3)
    cr3 = min(cr3, 1.0)  # 上限1.0
    cr3 = round(cr3, 4)

    pattern = _classify_pattern(cr3)
    entry_barrier = _BARRIER_MAP.get(pattern, "MEDIUM")

    logger.info(f"[cr3] CR3={cr3:.4f}, pattern={pattern}, barrier={entry_barrier}, "
                f"brands={len(brands)}, method={method}")

    return CR3Result(
        cr3=cr3,
        pattern=pattern,
        entry_barrier=entry_barrier,
        top3_brands=top3,
        brand_count=len(brands),
        method=method,
    )
