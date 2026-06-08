"""风险硬规则 — 7条确定性规则+自动GoNoGo，纯函数。

7条硬规则：
1. CR3 > 0.8         → 竞争风险 HIGH（寡头/垄断）
2. 增速 < -30%       → 市场风险 HIGH（快速衰退）
3. 评分 < 3.0        → 品质风险 HIGH（品类口碑差）
4. 价格带 <£1        → 价格风险 HIGH（价格战概率大）
5. 利润率 < 10%      → 财务风险 HIGH（盈亏不平衡）
6. 生命周期=DECLINE  → 时机风险 HIGH（品类衰退）
7. CR3>0.8 且 增速<-20% → 自动 NO_GO（垄断+衰退双重打击）

公开函数:
    evaluate_hard_risks
"""

import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class RiskRule:
    """单条触发的风险规则。"""
    rule_id: int
    category: str       # SUPPLY_CHAIN/COMPETITION/OPERATION/COMPLIANCE/MARKET/FINANCIAL
    severity: str       # HIGH / MEDIUM / LOW
    description: str
    threshold: str      # 触发的阈值描述
    actual_value: str   # 实际值


@dataclass
class RiskRuleResult:
    """风险硬规则评估结果。"""
    triggered_rules: List[RiskRule]
    auto_go_no_go: str            # GO / CONDITIONAL_GO / NO_GO（仅硬规则判定）
    high_risk_count: int
    total_rules_checked: int
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


def evaluate_hard_risks(
    cr3: float = 0,
    avg_rating: float = 0,
    units_growth_rate: float = 0,
    price_range: float = 0,
    lifecycle_stage: str = "",
    typical_margin: float = 0,
    marketplace: str = "UK",
) -> RiskRuleResult:
    """评估7条风险硬规则。

    Args:
        cr3:              CR3竞争集中度（0-1）
        avg_rating:       品类平均评分（1-5）
        units_growth_rate: 销量增速百分比
        price_range:      品类价格幅度（max-min，当地货币）
        lifecycle_stage:  生命周期阶段
        typical_margin:   典型利润率百分比

        marketplace:  站点 UK/DE/US

    Returns:
        RiskRuleResult
    """
    # 价格窄幅阈值（按站点动态调整）
    from selection.algorithms.constants import RISK_NARROW_PRICE_THRESHOLDS
    narrow_threshold = RISK_NARROW_PRICE_THRESHOLDS.get(marketplace, 1.0)

    triggered: List[RiskRule] = []

    # Rule 1: CR3 > 0.8 — 垄断/寡头风险
    if cr3 >= 0.8:
        triggered.append(RiskRule(
            rule_id=1, category="COMPETITION", severity="HIGH",
            description="市场高度集中（CR3≥0.8），头部品牌垄断严重",
            threshold="CR3 ≥ 0.8",
            actual_value=f"CR3 = {cr3:.4f}",
        ))

    # Rule 2: 增速 < -30% — 快速衰退
    if units_growth_rate < -30:
        triggered.append(RiskRule(
            rule_id=2, category="MARKET", severity="HIGH",
            description="销量增速严重下滑(<-30%)，品类快速萎缩",
            threshold="unitsGrowthRate < -30%",
            actual_value=f"growth = {units_growth_rate:.1f}%",
        ))

    # Rule 3: 评分 < 3.0 — 品类口碑差
    if 0 < avg_rating < 3.0:
        triggered.append(RiskRule(
            rule_id=3, category="OPERATION", severity="HIGH",
            description="品类平均评分<3.0，消费者满意度低，退货风险大",
            threshold="avgRating < 3.0",
            actual_value=f"avgRating = {avg_rating:.1f}",
        ))

    # Rule 4: 价格带窄幅 — 价格战风险（按站点动态阈值）
    if 0 < price_range < narrow_threshold:
        triggered.append(RiskRule(
            rule_id=4, category="MARKET", severity="HIGH",
            description="价格带过窄(<£1)，极易引发价格战",
            threshold="priceRange < 1.0",
            actual_value=f"priceRange = {price_range:.2f}",
        ))

    # Rule 5: 利润率 < 10% — 盈亏不平衡
    if typical_margin < 10 and typical_margin != 0:
        severity = "HIGH" if typical_margin < 5 else "MEDIUM"
        triggered.append(RiskRule(
            rule_id=5, category="FINANCIAL", severity=severity,
            description=f"典型利润率{typical_margin:.1f}%偏低，盈亏平衡困难",
            threshold="typicalMargin < 10%",
            actual_value=f"margin = {typical_margin:.1f}%",
        ))

    # Rule 6: 生命周期=DECLINE — 品类衰退
    if lifecycle_stage == "DECLINE":
        triggered.append(RiskRule(
            rule_id=6, category="MARKET", severity="HIGH",
            description="品类处于衰退期，市场持续萎缩",
            threshold="lifecycleStage = DECLINE",
            actual_value=f"stage = {lifecycle_stage}",
        ))

    # Rule 7: CR3 > 0.8 且 增速 < -20% → 自动 NO_GO
    auto_go_no_go = "GO"
    if cr3 >= 0.8 and units_growth_rate < -20:
        triggered.append(RiskRule(
            rule_id=7, category="COMPETITION", severity="HIGH",
            description="垄断市场(CR3≥0.8)叠加增速下滑(>-20%)，自动判定NO_GO",
            threshold="CR3 ≥ 0.8 AND growth < -20%",
            actual_value=f"CR3={cr3:.4f}, growth={units_growth_rate:.1f}%",
        ))
        auto_go_no_go = "NO_GO"

    # 自动GoNoGo判定（非Rule 7触发时）
    high_count = sum(1 for r in triggered if r.severity == "HIGH")
    if auto_go_no_go != "NO_GO":
        if high_count >= 3:
            auto_go_no_go = "NO_GO"
        elif high_count >= 2:
            auto_go_no_go = "CONDITIONAL_GO"
        elif high_count >= 1:
            auto_go_no_go = "CONDITIONAL_GO"
        else:
            auto_go_no_go = "GO"

    # 置信度（硬规则100%确定）
    confidence = 1.0

    logger.info(f"[risk_rules] triggered={len(triggered)}, HIGH={high_count}, "
                f"go_no_go={auto_go_no_go}")

    return RiskRuleResult(
        triggered_rules=triggered,
        auto_go_no_go=auto_go_no_go,
        high_risk_count=high_count,
        total_rules_checked=7,
        confidence=confidence,
    )
