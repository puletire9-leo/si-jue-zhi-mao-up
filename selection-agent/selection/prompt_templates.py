"""选品分析提示词模板 — 9个LLM提示词集中管理。

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
    "analyzed": false,
    "reason": "当前版本不分析跨站套利"
  }},
  "confidence": 0.65
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
