"""确定性算法层 — 纯函数，不依赖 LLM/网络，可独立单测。

15个算法模块：
1. profit_calculator    — 利润计算（4输入精确公式）
2. archetype_mapper     — 品类原型映射（51→6）
3. cr3_calculator       — CR3竞争集中度
4. lifecycle_detector   — 生命周期信号检测（4信号×6阶段）
5. price_band           — 价格带分析（4档固定区间）
6. opportunity_scorer   — 机会评分公式（L1层6维）
7. risk_rules           — 风险硬规则
8. l2_scorer            — 品类专属8维评分（L2层）
9. percentile_scorer    — 百分位评分器（动态基线）
10. category_health     — 品类健康度评估
11. blue_ocean_radar    — 蓝海雷达检测
12. opportunity_classifier — 机会分类器
13. decision_verifier   — 决策验证器
14. feedback_service    — 反馈服务
15. weight_calibrator   — 权重校准器
"""

from selection.algorithms.profit_calculator import (
    calculate_profit,
    calculate_batch_profit,
    parse_weight,
    parse_dimension,
    ProfitResult,
)
from selection.algorithms.archetype_mapper import map_archetype, ArchetypeMatch
from selection.algorithms.cr3_calculator import calculate_cr3, CR3Result
from selection.algorithms.lifecycle_detector import detect_lifecycle, LifecycleResult
from selection.algorithms.price_band import analyze_price_band, PriceBandResult
from selection.algorithms.opportunity_scorer import (
    calculate_opportunity_score,
    ScoreBreakdown,
)
from selection.algorithms.risk_rules import evaluate_hard_risks, RiskRuleResult
from selection.algorithms.l2_scorer import calculate_l2_score, L2ScoreBreakdown
from selection.algorithms.percentile_scorer import (
    score_percentile,
    score_dimensions_percentile,
    compute_composite_percentile,
    classify_relative_position,
    PercentileResult,
)
from selection.algorithms.category_health import assess_category_health, CategoryHealthResult
from selection.algorithms.blue_ocean_radar import detect_blue_ocean, BlueOceanResult
from selection.algorithms.opportunity_classifier import classify_opportunity, OpportunityClassification
from selection.algorithms.decision_verifier import verify_decision, batch_verify_decisions, VerificationResult
from selection.algorithms.feedback_service import record_decision_snapshot, compute_accuracy_stats, DecisionSnapshot, AccuracyStats
from selection.algorithms.weight_calibrator import calibrate_weights, CalibrationResult
