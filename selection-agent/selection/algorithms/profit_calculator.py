"""利润计算器 — 4输入精确公式，纯函数，不依赖LLM/网络。

核心公式（来自 docs/选品算法/补充/利润计算器_最终版.py）：
- 体积重量 = (L × W × H) / 6000
- 计费重量 = max(体积重量, 实重)
- 佣金 = price × 15%
- VAT = price / 1.2 × 0.2（含税价倒算）
- 头程 = 计费重量 × 运费费率(¥/kg) / 汇率
- 利润 = price - 佣金 - VAT - FBA - 成本 - 头程

公开函数:
    parse_weight, parse_dimension, classify_shipping_profile,
    calculate_profit, calculate_profit_from_sample, calculate_batch_profit
"""

import logging
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

from selection.algorithms.constants import SITE_CONFIG, PROFIT_THRESHOLDS, FBA_DEFAULTS

logger = logging.getLogger(__name__)


@dataclass
class ProfitResult:
    """单品利润计算结果。"""
    marketplace: str
    price_local: float
    weight_kg: float
    volume_weight_kg: float
    chargeable_weight_kg: float
    cost_cny: float
    commission_local: float
    vat_local: float
    fba_fee_local: float
    shipping_air_local: float
    shipping_sea_local: float
    profit_air_local: float
    profit_sea_local: float
    margin_air_pct: float
    margin_sea_local_pct: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ─── 辅助解析函数 ─────────────────────────────────────────────────────────────

def parse_weight(raw: Any) -> Optional[float]:
    """解析重量字符串 → 千克。
    例: '180 Gramm'→0.18, '2.5 kg', '500g'→0.5, None→None, 0.18→0.18
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw > 0 else None
    s = str(raw).lower().strip()
    if not s:
        return None
    # kg
    m = re.search(r"([\d.]+)\s*k?g?", s)
    if "kg" in s:
        try:
            return float(m.group(1))
        except (ValueError, AttributeError):
            return None
    # g / gramm
    if any(u in s for u in ("g", "gram")):
        try:
            return float(m.group(1)) / 1000.0
        except (ValueError, AttributeError):
            return None
    # 纯数字，假设kg
    try:
        return float(s)
    except ValueError:
        return None


def parse_dimension(raw: Any) -> Optional[Tuple[float, float, float]]:
    """解析尺寸字符串 → (L, W, H) cm。
    例: '20x15x3cm'→(20,15,3), '20 x 15 x 3'→(20,15,3), None→None
    """
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)) and len(raw) >= 3:
        try:
            return (float(raw[0]), float(raw[1]), float(raw[2]))
        except (ValueError, TypeError):
            return None
    s = str(raw).lower().strip()
    if not s:
        return None
    nums = re.findall(r"[\d.]+", s)
    if len(nums) >= 3:
        try:
            return (float(nums[0]), float(nums[1]), float(nums[2]))
        except ValueError:
            return None
    return None


# ─── 物流档案分类 ─────────────────────────────────────────────────────────────

def classify_shipping_profile(weight_kg: float, L: float = 0, W: float = 0, H: float = 0) -> str:
    """根据重量/尺寸判断物流档案类型。"""
    volume_weight = (L * W * H) / 6000.0 if L and W and H else 0
    effective_weight = max(weight_kg, volume_weight)
    if effective_weight < 0.1:
        return "VERY_LIGHT"
    elif effective_weight < 0.5:
        return "LIGHT_SMALL"
    elif effective_weight < 2.0:
        return "MEDIUM"
    else:
        return "HEAVY"


# ─── 核心利润计算 ─────────────────────────────────────────────────────────────

def calculate_profit(
    price_local: float,
    weight_kg: float,
    L_cm: float = 0,
    W_cm: float = 0,
    H_cm: float = 0,
    fba_fee: Optional[float] = None,
    cost_cny: float = 0,
    marketplace: str = "UK",
) -> ProfitResult:
    """精确利润计算（4输入公式）。

    Args:
        price_local: 售价（当地货币，如£/€）
        weight_kg:   实际重量（kg）
        L_cm, W_cm, H_cm: 尺寸（cm）
        fba_fee:     FBA费用（当地货币），None则按物流档案估算
        cost_cny:    采购成本（人民币）
        marketplace: 站点 UK/DE

    Returns:
        ProfitResult（含空运/海运双场景）
    """
    cfg = SITE_CONFIG.get(marketplace, SITE_CONFIG["UK"])
    vat_rate = cfg["vat_rate"]
    comm_rate = cfg["comm_rate"]
    local_to_cny = cfg["local_to_cny"]
    air_rate = cfg["air_freight_rate"]
    sea_rate = cfg["sea_freight_rate"]

    # 体积重量 & 计费重量
    volume_weight = (L_cm * W_cm * H_cm) / 6000.0 if L_cm and W_cm and H_cm else 0.0
    chargeable_weight = max(volume_weight, weight_kg)

    # 平台费用
    commission = price_local * comm_rate
    vat = price_local / (1 + vat_rate) * vat_rate

    # FBA费用估算（如未提供）
    if fba_fee is None:
        profile = classify_shipping_profile(weight_kg, L_cm, W_cm, H_cm)
        fba_fee = FBA_DEFAULTS.get(profile, FBA_DEFAULTS["_fallback"])

    # 头程运费（CNY→当地货币）
    shipping_air = (chargeable_weight * air_rate) / local_to_cny
    shipping_sea = (chargeable_weight * sea_rate) / local_to_cny

    # 成本转换
    cost_local = cost_cny / local_to_cny if local_to_cny else 0

    # 利润（双场景）
    profit_air = price_local - commission - vat - fba_fee - cost_local - shipping_air
    profit_sea = price_local - commission - vat - fba_fee - cost_local - shipping_sea

    margin_air = (profit_air / price_local * 100) if price_local else 0.0
    margin_sea = (profit_sea / price_local * 100) if price_local else 0.0

    return ProfitResult(
        marketplace=marketplace,
        price_local=round(price_local, 2),
        weight_kg=round(weight_kg, 4),
        volume_weight_kg=round(volume_weight, 4),
        chargeable_weight_kg=round(chargeable_weight, 4),
        cost_cny=round(cost_cny, 2),
        commission_local=round(commission, 4),
        vat_local=round(vat, 4),
        fba_fee_local=round(fba_fee, 2),
        shipping_air_local=round(shipping_air, 4),
        shipping_sea_local=round(shipping_sea, 4),
        profit_air_local=round(profit_air, 4),
        profit_sea_local=round(profit_sea, 4),
        margin_air_pct=round(margin_air, 2),
        margin_sea_local_pct=round(margin_sea, 2),
    )


# ─── 从样本商品计算 ────────────────────────────────────────────────────────────

def calculate_profit_from_sample(
    sample: Dict[str, Any],
    avg_price: float,
    marketplace: str = "UK",
) -> Optional[ProfitResult]:
    """从样本商品字典提取字段并计算利润。

    支持的字段名（宽松匹配）:
        price/avgPrice, weightG/weight/itemWeight, dimensions/L×W×H,
        fbaFee, cost/costCny, profit（用于倒推成本）
    """
    cfg = SITE_CONFIG.get(marketplace, SITE_CONFIG["UK"])
    vat_rate = cfg["vat_rate"]
    comm_rate = cfg["comm_rate"]
    local_to_cny = cfg["local_to_cny"]

    price = sample.get("price") or sample.get("avgPrice") or avg_price

    # 重量解析：优先使用精确的weightG（BigDecimal），再回退到字符串解析
    weight = None
    weight_g = sample.get("weightG")
    if weight_g is not None:
        try:
            wg = float(weight_g)
            if wg > 0:
                weight = wg / 1000.0  # 克→千克
        except (ValueError, TypeError):
            pass
    if weight is None:
        weight = parse_weight(sample.get("weight") or sample.get("itemWeight"))
    if weight is None:
        weight = 0.1  # 默认100g

    dims = parse_dimension(sample.get("dimensions") or sample.get("packageDimensions"))
    L, W, H = dims if dims else (0, 0, 0)

    fba = sample.get("fbaFee") or sample.get("fba_fee")
    cost_cny = sample.get("cost") or sample.get("costCny") or 0

    try:
        price = float(price)
        cost_cny = float(cost_cny)
    except (ValueError, TypeError):
        return None

    # 从profit字段倒推采购成本（避免cost_cny=0导致利润虚高）
    # 已知: 卖家精灵profit = price - commission - VAT - FBA - cost_local
    # 反推: cost_local = price - commission - VAT - FBA - profit
    profit_val = sample.get("profit")
    if cost_cny == 0 and profit_val is not None:
        try:
            profit_local = float(profit_val)
            if profit_local > 0:
                commission = price * comm_rate
                vat = price / (1 + vat_rate) * vat_rate
                # fba_fee: 如果为None，先估算一个默认值用于倒推
                fba_for_reverse = fba
                if fba_for_reverse is None:
                    profile = classify_shipping_profile(weight, L, W, H)
                    fba_for_reverse = FBA_DEFAULTS.get(profile, FBA_DEFAULTS["_fallback"])
                cost_local = price - commission - vat - float(fba_for_reverse) - profit_local
                if cost_local > 0 and local_to_cny > 0:
                    cost_cny = cost_local * local_to_cny
                    logger.info(f"[profit] 从profit字段倒推 cost_cny={cost_cny:.2f}")
                elif cost_local < 0:
                    logger.warning(f"[profit] 倒推cost_local={cost_local:.2f}<0，数据可能不一致")
        except (ValueError, TypeError):
            pass

    return calculate_profit(
        price_local=price,
        weight_kg=weight,
        L_cm=L, W_cm=W, H_cm=H,
        fba_fee=fba,
        cost_cny=cost_cny,
        marketplace=marketplace,
    )


# ─── 批量利润计算（三场景聚合） ─────────────────────────────────────────────────

def calculate_batch_profit(
    sample_products: List[Dict[str, Any]],
    avg_price: float,
    marketplace: str = "UK",
) -> Dict[str, Any]:
    """批量计算样本利润，输出三场景聚合。

    Returns:
        {
            "marginEstimate": {
                "pessimistic": {"margin": float, "breakEvenUnits": int},
                "typical":     {"margin": float, "breakEvenUnits": int},
                "optimistic":  {"margin": float, "breakEvenUnits": int}
            },
            "shippingProfile": str,
            "platformFees": {"referralFee": 0.15, "fbaFee": float},
            "sampleCount": int,
            "computedCount": int,
            "allMargins": [{"air": float, "sea": float}, ...],
            "verdict": "PROFITABLE|MARGINAL|UNPROFITABLE",
        }
    """
    if not sample_products:
        return {
            "marginEstimate": {
                "pessimistic": {"margin": 0, "breakEvenUnits": 999},
                "typical":     {"margin": 0, "breakEvenUnits": 999},
                "optimistic":  {"margin": 0, "breakEvenUnits": 999},
            },
            "shippingProfile": "UNKNOWN",
            "platformFees": {"referralFee": 0.15, "fbaFee": 0},
            "sampleCount": 0,
            "computedCount": 0,
            "allMargins": [],
            "verdict": "UNPROFITABLE",
        }

    results: List[ProfitResult] = []
    for sample in sample_products:
        r = calculate_profit_from_sample(sample, avg_price, marketplace)
        if r is not None:
            results.append(r)

    if not results:
        return {
            "marginEstimate": {
                "pessimistic": {"margin": 0, "breakEvenUnits": 999},
                "typical":     {"margin": 0, "breakEvenUnits": 999},
                "optimistic":  {"margin": 0, "breakEvenUnits": 999},
            },
            "shippingProfile": "UNKNOWN",
            "platformFees": {"referralFee": 0.15, "fbaFee": 0},
            "sampleCount": len(sample_products),
            "computedCount": 0,
            "allMargins": [],
            "verdict": "UNPROFITABLE",
        }

    # 聚合各场景利润率
    air_margins = [r.margin_air_pct for r in results]
    sea_margins = [r.margin_sea_local_pct for r in results]
    fba_fees = [r.fba_fee_local for r in results]

    # 悲观=空运最低, 典型=海运中位, 乐观=海运最高
    air_sorted = sorted(air_margins)
    sea_sorted = sorted(sea_margins)
    mid = len(results) // 2

    pessimistic_margin = air_sorted[0]
    typical_margin = sea_sorted[mid]
    optimistic_margin = sea_sorted[-1]

    # 盈亏平衡估算
    monthly_fixed = PROFIT_THRESHOLDS["monthly_fixed_cost"]
    avg_price_val = avg_price or 1.0

    def _break_even(margin_pct: float) -> int:
        if margin_pct <= 0:
            return 999
        return max(1, int(monthly_fixed / (avg_price_val * margin_pct / 100)))

    # 物流档案（取中位重量）
    weights = sorted([r.weight_kg for r in results])
    median_weight = weights[mid]
    shipping_profile = classify_shipping_profile(median_weight)

    # 利润判定
    if typical_margin >= PROFIT_THRESHOLDS["profitable_margin"]:
        verdict = "PROFITABLE"
    elif typical_margin >= PROFIT_THRESHOLDS["marginal_margin"]:
        verdict = "MARGINAL"
    else:
        verdict = "UNPROFITABLE"

    all_margins = [
        {"air": round(r.margin_air_pct, 2), "sea": round(r.margin_sea_local_pct, 2)}
        for r in results
    ]

    return {
        "marginEstimate": {
            "pessimistic": {"margin": round(pessimistic_margin, 2), "breakEvenUnits": _break_even(pessimistic_margin)},
            "typical":     {"margin": round(typical_margin, 2),     "breakEvenUnits": _break_even(typical_margin)},
            "optimistic":  {"margin": round(optimistic_margin, 2),  "breakEvenUnits": _break_even(optimistic_margin)},
        },
        "shippingProfile": shipping_profile,
        "platformFees": {
            "referralFee": 0.15,
            "fbaFee": round(sum(fba_fees) / len(fba_fees), 2),
        },
        "sampleCount": len(sample_products),
        "computedCount": len(results),
        "allMargins": all_margins,
        "verdict": verdict,
    }
