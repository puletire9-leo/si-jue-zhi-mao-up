"""选品分析提示词模板 — 10个LLM提示词集中管理。

每个模板对应 Selection Graph 中的一个节点。
所有模板使用 {input_data} 占位符，由各节点在调用LLM前填充。

后续实现时，每个模板需包含：
1. 角色定义（你是一个跨境电商选品分析师...）
2. 输入数据说明（以下是某品类的聚合数据...）
3. 输出格式要求（JSON Schema）
4. 分析方法论（引用对应的算法文档）
"""

# ═══ 节点1: 语义品类理解 ═══
SEMANTIC_UNDERSTANDING_PROMPT = """你是一位跨境电商品类分析专家。

## 任务
分析以下品类的商品数据，判断该品类属于哪种"品类原型"，并推断消费者画像。

## 品类原型体系（6类，来自08-品类专属评分模型）
- DA (装饰艺术): 视觉驱动、图案裂变，代表品类：家居装饰、墙贴、桌布
- FH (功能家居): 实用驱动、性价比，代表品类：收纳、清洁工具、厨房小件
- FP (时尚个人): 风格驱动、身份认同，代表品类：美甲、饰品、手机壳
- TN (趋势潮流): 热度驱动、快速迭代，代表品类：新奇玩具、网红同款、IP衍生
- PE (派对活动): 文化驱动、高销量，代表品类：派对用品、节日装饰、气球
- PS (纸品文具): 极轻、图案裂变，代表品类：贴纸、贺卡、文具

## 原型决策树（快速判定规则）
1. 产品是否视觉驱动 + 图案多变？ → DA
2. 产品是否纯实用 + 性价比导向？ → FH
3. 产品是否穿戴/个人风格？ → FP
4. 产品是否社交媒体热度驱动？ → TN
5. 产品是否与节日/庆祝/文化事件强关联？ → PE
6. 产品是否纸基/极轻 + 图案裂变？ → PS

## LLM维度评分参考基准
| 原型 | 情感分参考 | 装饰分参考 | 裂变分参考 | 文化分参考 |
|------|----------|----------|----------|----------|
| DA   | 60-80   | 80-95   | 40-60   | 30-50   |
| FH   | 20-40   | 10-25   | 20-40   | 10-25   |
| FP   | 65-85   | 30-50   | 45-65   | 55-75   |
| TN   | 70-90   | 10-25   | 55-75   | 40-60   |
| PE   | 60-80   | 50-70   | 45-65   | 70-90   |
| PS   | 30-50   | 10-25   | 70-90   | 30-50   |

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算的原型匹配结果。
请直接使用该原型值，重点放在消费者画像推理和使用场景分析上。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "archetype": "DA|FH|FP|TN|PE|PS",
  "archetypeReason": "判断理由（一句话）",
  "consumerProfile": {{
    "typicalBuyer": "典型买家描述",
    "purchaseMotivation": "购买动机",
    "priceExpectation": "价格敏感度（HIGH|MEDIUM|LOW）"
  }},
  "usageScenarios": ["场景1", "场景2"],
  "llmDimensionScores": {{
    "emotionScore": 65,
    "decorScore": 70,
    "fissionScore": 40,
    "cultureScore": 55
  }},
  "confidence": 0.85
}}

## LLM 维度评分说明（llmDimensionScores，每项 0-100）
- emotionScore: 情感价值 — 产品是否引发情感共鸣、礼物属性、美学享受
- decorScore: 装饰属性 — 产品是否用于空间装饰、视觉提升、氛围营造
- fissionScore: 裂变潜力 — 产品是否易于分享、DIY变体、用户创作内容
- cultureScore: 文化属性 — 产品是否与特定文化/节日/身份认同关联
"""

# ═══ 节点2: 竞争格局 ═══
COMPETITION_ANALYSIS_PROMPT = """你是一位跨境电商竞争分析专家。

## 任务
分析该品类的竞争格局，包括市场集中度、价格带分布、品牌定位空白。

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算的 CR3 值和价格带分析。
请直接引用 cr3 和 priceBand 的数值，重点放在品牌定位分析和竞争策略解读上。

## CR3策略矩阵
| CR3范围 | 市场类型 | 进入策略建议 |
|---------|---------|---------------|
| <0.3   | 分散市场 | 品牌化机会大，可通过差异化快速进入 |
| 0.3-0.6 | 适度集中 | 需明确切入角度，避免与中腰部品牌正面竞争 |
| 0.6-0.8 | 寡头市场 | 寻找头部忽略的细分价格带或变体空白 |
| ≥0.8   | 垄断市场 | 进入风险极高，仅考虑极窄利基市场 |

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "pattern": "FRAGMENTED|MODERATE_CONCENTRATION|OLIGOPOLY|MONOPOLY",
  "cr3": 0.25,
  "topBrands": [{{"name": "品牌名", "share": 0.10}}],
  "priceGaps": [{{"range": "£5-8", "density": "LOW", "opportunity": true}}],
  "brandPositioning": {{
    "premium": [],
    "mid": [],
    "budget": []
  }},
  "entryBarrier": "LOW|MEDIUM|HIGH",
  "confidence": 0.80
}}
"""

# ═══ 节点3: 生命周期 ═══
LIFECYCLE_JUDGMENT_PROMPT = """你是一位跨境电商市场趋势分析专家。

## 任务
根据销量增速、BSR变化、评论增长等信号，判断该品类所处的生命周期阶段。

## 生命周期阶段（来自12-新品爆发信号检测）
- EMERGING: 新兴期，销量增速>30%, BSR快降, 评论<50
- GROWTH: 成长期，销量增速>10%, BSR稳定降, 评论增长中
- MATURITY_STABLE: 成熟稳定，销量±10%, BSR±15%, 评论平稳
- MATURITY_WITH_DECLINE: 成熟衰退，销量<-10%, BSR>+20%, 评论平台期
- SATURATION: 饱和期，销量<-20%, CR3>0.8, 价格战频发
- DECLINE: 衰退期，销量<-30%, 多家退出, 评论下降

## 信号检测（4信号 × 3紧急度）
- Speed(速度信号): 销量增速方向和幅度
- Density(密度信号): SKU数量和卖家集中度
- Follow(关注信号): 多店铺同时进入=积极信号
- Quality(质量信号): 评分和评论数成熟度

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算的生命周期阶段和信号值。
请直接引用 stage 和 signals 的数值，重点放在跟品策略建议和市场窗口解读上。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "stage": "EMERGING|GROWTH|MATURITY_STABLE|MATURITY_WITH_DECLINE|SATURATION|DECLINE",
  "stageReason": "判断依据",
  "signals": [
    {{"name": "信号名", "value": 0.0, "direction": "UP|DOWN|FLAT", "urgency": "HIGH|MEDIUM|LOW"}}
  ],
  "windowOfOpportunity": "BEST|GOOD|CLOSING|CLOSED",
  "confidence": 0.75
}}
"""

# ═══ 节点4: 利润推算 ═══
PROFIT_ESTIMATION_PROMPT = """你是一位跨境电商利润分析专家。

## 任务
基于价格、成本结构、平台费用，估算该品类在三种场景下的利润率。

## 成本结构参考（四档）
- 极轻小件 (<100g): 头程£0.5-1.5, FBA £1.5-2.5
- 轻小件 (100g-500g): 头程£1-3, FBA £2.5-4
- 中件 (500g-2kg): 头程£2-5, FBA £4-7
- 重件 (>2kg): 头程£5+, FBA £7+

## 盈亏平衡公式
盈亏平衡月销量 = 月固定成本 / (售价 × 利润率)
其中：
- 月固定成本 ≈ £500（包含 PPC广告、仓储、工具订阅）
- 利润率 = (售价 - 采购成本 - 头程 - FBA费 - 佣金 - VAT) / 售价
- 安全边际: 实际月销量 / 盈亏平衡销量 > 2.0 为安全

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算的三场景利润率和盈亏平衡点。
请直接引用 marginEstimate 的数值，重点放在利润风险分析和成本优化建议上。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "marginEstimate": {{
    "pessimistic": {{"margin": 15.0, "breakEvenUnits": 200}},
    "typical": {{"margin": 30.0, "breakEvenUnits": 100}},
    "optimistic": {{"margin": 45.0, "breakEvenUnits": 50}}
  }},
  "shippingProfile": "LIGHT_SMALL|MEDIUM|HEAVY|VERY_LIGHT",
  "platformFees": {{"referralFee": 0.15, "fbaFee": 2.5}},
  "risks": ["利润率风险1", "利润率风险2"],
  "verdict": "PROFITABLE|MARGINAL|UNPROFITABLE",
  "confidence": 0.70
}}
"""

# ═══ 节点5a: 差异化（完整版，利润≥30%时使用） ═══
DIFFERENTIATION_FULL_PROMPT = """你是一位跨境电商差异化策略专家。

## 任务
该品类利润可行（≥30%），请提供3个差异化切入方案。

## 切入角度框架（5维度，来自11-竞品差异化分析）
1. PRICE_GAP: 价格空白 — 进入竞争对手忽略的价格带
2. OPERATIONAL_EXCELLENCE: 运营卓越 — 通过Listing/服务/物流体验胜出
3. LOW_REVIEW_EXPLOIT: 低评快起 — 针对竞品低评分弱点推出更优产品
4. VARIANT_DIFFERENTIATION: 变体差异化 — 提供竞品没有的变体组合
5. WHITE_LABEL_REPLACE: 白牌替代 — 替代高价白牌/大牌

## 切入角度成功率参考
| 角度 | 成功率 | 适用条件 | 典型利润提升 |
|------|-------|---------|-------------|
| PRICE_GAP | 60-75% | 存在明显价格空白带 | +5-15% |
| OPERATIONAL_EXCELLENCE | 40-55% | 现有卖家服务差/Listing质量低 | +3-8% |
| LOW_REVIEW_EXPLOIT | 50-65% | 头部产品评分<4.0 | +5-12% |
| VARIANT_DIFFERENTIATION | 55-70% | 变体覆盖不全/颜色图案缺失 | +5-10% |
| WHITE_LABEL_REPLACE | 35-50% | 白牌溢价>30% | +10-25% |

## 算法预计算结果（已确定，请基于此增强，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已分析的：
- 进入难度（entryDifficulty）+ 判定理由
- 推荐切入价格带（recommendedPriceTier）
- 价格空白机会列表（priceGapOpportunities）
- 策略候选排名（strategyCandidates，按品类原型匹配度+价格带适配+蓝海信号加权排序）
请基于这些结果做深入阐述和场景化建议，不要推翻算法结论。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "recommendation": "推荐的切入角度",
  "strategies": [
    {{
      "angle": "PRICE_GAP|OPERATIONAL_EXCELLENCE|LOW_REVIEW_EXPLOIT|VARIANT_DIFFERENTIATION|WHITE_LABEL_REPLACE",
      "title": "方案标题",
      "description": "详细描述",
      "estimatedEffort": "LOW|MEDIUM|HIGH",
      "expectedAdvantage": "预期优势描述"
    }}
  ],
  "notToDo": ["竞品做得好的不要碰", "无差异化的方向"],
  "confidence": 0.75
}}
"""

# ═══ 节点5b: 差异化（快速版，利润<30%时使用） ═══
DIFFERENTIATION_QUICK_PROMPT = """你是一位跨境电商选品分析师。

## 任务
该品类利润偏薄（<30%），请给出1个最可行的快速建议。

## 算法预计算结果（已确定，请基于此增强，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已分析的进入难度、推荐价格带和策略候选排名。请基于这些结果做简洁建议。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "recommendation": "一句话建议",
  "angle": "PRICE_GAP|OPERATIONAL_EXCELLENCE|LOW_REVIEW_EXPLOIT|VARIANT_DIFFERENTIATION|WHITE_LABEL_REPLACE",
  "estimatedEffort": "LOW|MEDIUM|HIGH",
  "confidence": 0.60
}}
"""

# ═══ 节点6: 风险雷达 ═══
RISK_RADAR_PROMPT = """你是一位跨境电商风险评估专家。

## 任务
对该品类进行全面风险扫描，识别6大类风险并给出 Go/NoGo 判断。

## 风险分类（6大类）
1. SUPPLY_CHAIN: 供应链风险（供应商集中度、季节性断货、物流时效）
2. COMPETITION: 竞争风险（垄断趋势、价格战、专利壁垒）
3. OPERATION: 运营风险（退货率、客服复杂度、listing维护难度）
4. COMPLIANCE: 合规风险（认证要求、禁售政策、知识产权）
5. MARKET: 市场风险（需求波动、替代品、季节性）
6. FINANCIAL: 财务风险（资金占用、汇率波动、平台扣款）

## 风险量化阈值参考
| 风险类别 | HIGH触发条件 | MEDIUM触发条件 | LOW条件 |
|---------|------------|---------------|-------|
| 竞争 | CR3≥0.8 或 头部品牌>50%份额 | CR3 0.6-0.8 | CR3<0.6 |
| 市场 | 增速<-30% 或 季节性波动>50% | 增速-10%~-30% | 增速>-10% |
| 财务 | 利润率<10% 或 盈亏平衡>500件/月 | 利润率10-20% | 利润率>20% |
| 运营 | 退货率>15% 或 评分<3.0 | 退货率5-15% | 退货率<5% |
| 供应链 | 单一供应商>80% 或 前置时间>60天 | 2-3个供应商 | 多源供应 |
| 合规 | 需强制认证 或 含知识产权风险 | 推荐认证 | 无特殊要求 |

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性硬规则已评估的风险项。
请直接引用 hardRules 的结果，重点放在补充软风险识别（合规、供应链、运营等）上。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "risks": [
    {{
      "category": "SUPPLY_CHAIN|COMPETITION|OPERATION|COMPLIANCE|MARKET|FINANCIAL",
      "description": "具体风险描述",
      "severity": "HIGH|MEDIUM|LOW",
      "probability": "HIGH|MEDIUM|LOW",
      "mitigation": "缓解措施"
    }}
  ],
  "goNoGo": "GO|CONDITIONAL_GO|NO_GO|WAIT_AND_SEE",
  "goNoGoReason": "判断理由",
  "confidence": 0.80
}}
"""

# ═══ 节点7: 跨品线关联 ═══
CROSS_LINE_DISCOVERY_PROMPT = """你是一位跨境电商选品组合专家。

## 任务
分析当前品类与其他品线的关联机会，发现替代、互补、捆绑等商机。

## 关联类型（5种）
1. DIRECT_SUBSTITUTE: 直接替代品（消费者二选一）
2. COMPLEMENTARY: 互补品（一起购买提升客单价）
3. UPSELL: 升级品（从低端品类升级到高端）
4. CROSS_SELL: 交叉销售（不同品类但相同消费者）
5. INPUT_SUPPLY: 供应链上下游（A品类是B的原材料）

## 算法预计算结果（已确定，请基于此增强，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算和检测的：
- competitionStructure / lifecycleStage / profitFeasibility: 前面节点的算法结果
- currentScore: 当前品类评分和 Go/NoGo 状态
- crossMarketArbitrage: 跨站套利检测结果（同ASIN跨站存在性检测）：
  - opportunities: 所有套利机会（含 STRONG/MODERATE/WEAK 强度分类）
  - strongOpportunities: 🔴 强信号列表
  - summary.direction: 套利方向（UK→DE / DE→UK）
  - summary.strongCount: 强信号数量
请基于这些结果做深度解读和策略建议，不要推翻算法结论。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "relatedCategories": [
    {{
      "categoryName": "关联品类名",
      "relationType": "DIRECT_SUBSTITUTE|COMPLEMENTARY|UPSELL|CROSS_SELL|INPUT_SUPPLY",
      "strength": "STRONG|MODERATE|WEAK",
      "opportunity": "机会描述",
      "bundleSuggestion": "捆绑建议（如适用）"
    }}
  ],
  "crossMarketArbitrage": {{
    "analyzed": true,
    "interpretation": "基于算法检测结果的深度解读",
    "topOpportunities": [
      {{
        "asin": "B0XXX",
        "direction": "UK→DE|DE→UK",
        "entryStrategy": "进入策略建议"
      }}
    ],
    "summary": "跨站套利总结"
  }},
  "confidence": 0.65
}}
"""

# ═══ 节点9: 新品爆发信号检测 ═══
BURST_SIGNAL_PROMPT = """你是一位跨境电商市场趋势分析专家。

## 任务
根据确定性算法检测到的新品爆发信号，解读爆发原因、可持续性和建议行动。

## 爆发信号解读框架
- 🔴 立即行动（composite ≥ 80）：30天内BSR骤降80%+或销量翻3倍，火箭式起飞
- 🟡 重点关注（composite ≥ 50）：月内增长显著，窗口期有限
- 🟢 持续观察（composite ≥ 30）：有改善趋势，但幅度一般

## 信号质量注意事项
- BSR骤降 + 销量增长 + 评论增长：三者一致 → 信号可信度高
- BSR骤降但评论零增长：可能广告推量 → 保持谨慎
- 销量高但listingDays≤3天：数据不稳定 → 建议观察7天

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已检测的：
- topBursts: Top 5 爆发产品（含综合分、BSR/销量/评论三维得分、紧急度）
- categoryBurstScore: 品类级爆发强度（0-100）
- urgencyDistribution: 紧急度分布（critical/important/watch/none 各多少个）
- hasCritical: 是否有 🔴 紧急信号

请基于这些结果做深度解读和策略建议，不要推翻算法结论。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "topBursts": [
    {{
      "asin": "B0XXX",
      "title": "商品标题",
      "compositeScore": 85.5,
      "urgency": "critical|important|watch",
      "interpretation": "爆发原因解读（基于三维信号分析）"
    }}
  ],
  "categoryBurstScore": 72.0,
  "hasCritical": true,
  "urgencyDistribution": {{"critical": 1, "important": 2, "watch": 3, "none": 50}},
  "categoryAnalysis": {{
    "isBursting": true,
    "burstDriver": "季节性需求爆发|趋势引领|事件驱动|正常增长",
    "sustainability": "可持续|短期热点|需继续观察",
    "windowEstimate": "1-2周|1个月|3个月"
  }},
  "followUpActions": ["建议行动1", "建议行动2"],
  "risks": ["风险提示1"],
  "confidence": 0.75
}}
"""

# ═══ 节点8: 最终裁决 ═══
FINAL_VERDICT_PROMPT = """你是一位资深跨境电商选品决策官。

## 任务
综合前面8项分析结果，给出最终裁决：推荐等级、机会评分、行动计划。

## 评分公式（总分100）
opportunityScore = demand(0-25) + profitability(0-20) + competition(0-20) + differentiation(0-15) + timing(0-10) - riskPenalty(0-10)

注：competition 表示竞争可进入性（越容易进入分越高），riskPenalty 表示风险扣分。

## 推荐等级
- STRONGLY_RECOMMEND: 强烈推荐，机会分≥80
- RECOMMEND: 推荐，机会分60-79
- WATCH: 观望，机会分40-59
- AVOID: 避免，机会分<40

## 算法预计算结果（已确定，请直接引用，不要重新计算）
输入数据中的 algorithmPrecompute 包含确定性算法已计算的评分结果：
- opportunityScore: L1层6维通用评分（总分100）
- scoreBreakdown: L1层6维明细
- l2Total: L2层8维品类专属评分（总分100，按品类原型权重加权）
- l2ScoreBreakdown: L2层8维明细
- compositePercentile: 百分位综合分（基于品类基线的P25/P50/P75）

请直接引用这些数值，重点放在一句话总结、行动计划和关键指标建议上。

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "recommendLevel": "STRONGLY_RECOMMEND|RECOMMEND|WATCH|AVOID",
  "opportunityScore": 75,
  "oneLineSummary": "一句话总结该品类的机会和风险",
  "scoreBreakdown": {{
    "demand": 20,
    "profitability": 18,
    "competition": 15,
    "differentiation": 12,
    "timing": 8,
    "riskPenalty": -5
  }},
  "actionPlan": {{
    "phase1_immediate": "立即行动项",
    "phase2_shortTerm": "短期行动（1-2周）",
    "phase3_midTerm": "中期行动（1-3月）",
    "phase4_longTerm": "长期策略"
  }},
  "notToDo": ["禁忌1", "禁忌2"],
  "keyMetricsToTrack": ["监控指标1", "监控指标2"],
  "confidence": 0.80
}}
"""


# ═══ 蓝海全品类扫描 Prompt（V2） — 来自 09-蓝海发现算法升级.md §7 ───

BLUE_OCEAN_OPPORTUNITY_CARD_PROMPT = """你是跨境电商选品专家。以下是{marketplace}站{month}月的品类机会分析数据。

## 品类：{category_name}
- 品类原型：{archetype}（{archetype_desc}）
- 商品总数：{total}，新品数：{new_count}
- 机会分型：{opportunity_type}

## 10维雷达数据（0-100分，百分位归一化，越高越好）
| 维度组 | 维度 | 得分 | 说明 |
|--------|------|------|------|
| 进入壁垒 | D3 评论壁垒 | {d3} | 评论门槛低=高分 |
| 进入壁垒 | D4 品牌分散度 | {d4} | 无品牌垄断=高分 |
| 进入壁垒 | D5 卖家分散度 | {d5} | 无卖家垄断=高分 |
| 机会质量 | D1 新品活跃度 | {d1} | 新品占比高=活跃 |
| 机会质量 | D2 新品成功率 | {d2} | 新品能活=高分 |
| 机会质量 | D7 需求强度 | {d7} | 月销量大=高分 |
| 机会质量 | D10 标签势能 | {d10} | 平台算法青睐=高分 |
| 盈利可行 | D6 利润空间 | {d6} | 利润率高=高分 |
| 盈利可行 | D8 价格战风险 | {d8} | 新品不降价=高分 |
| 盈利可行 | D9 Listing差距 | {d9} | 运营可超越=高分 |

## 测品推荐ASIN
{test_product_table}

请输出品类机会卡 JSON：
{{
  "summary": "一句话总结该品类的机会与风险",
  "entry_difficulty": "easy/medium/hard",
  "difficulty_reason": "进入难度理由",
  "entry_angle": "推荐切入角度（价格带/设计差异化/运营优势）",
  "top_pick": "最优测品ASIN",
  "top_pick_reason": "优先推荐理由",
  "risks": ["风险1", "风险2"],
  "confidence": 0.0-1.0
}}
"""


BLUE_OCEAN_OVERVIEW_PROMPT = """你是跨境电商选品专家。以下是{marketplace}站{month}月所有品类的机会分型汇总。

## 分型统计
- 🌊 蓝海机会（{blue_ocean_count}个）：{blue_ocean_list}
- 🔥 红海有缝（{red_seam_count}个）：{red_seam_list}
- 💎 小众精品（{niche_count}个）：{niche_list}
- ⏳ 观望区（{watch_count}个）：{watch_list}
- 🔍 关注区（{neutral_count}个）：{neutral_list}

## 品类原型分布
{archetype_distribution}

请输出：
1. 本月最值得投入的TOP5品类（跨分型，说明理由）
2. 红海有缝中最值得尝试的TOP3（体现"红海也测品"思想）
3. 整体市场趋势观察（竞争/需求/利润维度）

输出 JSON：
{{
  "top5": [
    {{"category": "品类名", "reason": "理由", "opportunity_type": "分型"}}
  ],
  "red_seam_top3": [
    {{"category": "品类名", "reason": "尝试理由"}}
  ],
  "market_trends": "整体趋势分析文字",
  "confidence": 0.0-1.0
}}
"""


# ═══ 卖家行为画像 ═══
SELLER_PROFILING_PROMPT = """你是一位跨境电商卖家行为分析专家。

## 任务
分析以下品类中活跃卖家的行为数据，生成卖家洞察摘要。

## 输入数据
{input_data}

## 分析框架

### 1. 品类热度解读
- 🔥 郑总重仓：多店同品类 = 内部验证信号强
- 🌊 冷门品类：聪明卖家少 = 先发优势窗口
- ⚡ 外部聪明卖家活跃：郑总暂未布局 = 盲区机会
- 📊 一般：各维度均无明显信号

### 2. 跟品信号解读
- 从首发→跟进的时间线判断赛道的紧迫性
- 聪明卖家集中跟进 = 早期信号

### 3. 推荐优先级
- smart_consensus（聪明人共识）> dengzong_validated（内部验证+蓝海）> blind_spot（盲区发现）> follow_accel（跟品加速）

## 输出要求
输出 JSON：
{{
  "summary": "200字以内的卖家洞察摘要，包含热度信号、跟品信号、推荐优先级",
  "insight": "同summary",
  "urgency": "high/medium/low",
  "key_findings": ["发现1", "发现2", "发现3"],
  "confidence": 0.0-1.0
}}
"""
