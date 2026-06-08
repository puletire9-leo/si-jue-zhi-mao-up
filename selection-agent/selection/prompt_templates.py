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

## 品类原型体系（6类）
- FP (Fast Purchase): 快速消费品，低价高频，消费者追求便捷
- TN (Trend-Driven): 趋势驱动型，时尚敏感，消费者追逐新品
- PS (Problem Solver): 问题解决型，功能导向，消费者有明确痛点
- DC (Decorative Choice): 装饰选择型，审美驱动，消费者追求个性化
- SP (Specialist): 专业工具型，精度要求高，消费者为专业人士
- AS (Auto-Supply): 自动补给型，周期性消耗，消费者追求稳定

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "archetype": "FP|TN|PS|DC|SP|AS",
  "archetypeReason": "判断理由（一句话）",
  "consumerProfile": {{
    "typicalBuyer": "典型买家描述",
    "purchaseMotivation": "购买动机",
    "priceExpectation": "价格敏感度（HIGH|MEDIUM|LOW）"
  }},
  "usageScenarios": ["场景1", "场景2"],
  "confidence": 0.85
}}
"""

# ═══ 节点2: 竞争格局 ═══
COMPETITION_ANALYSIS_PROMPT = """你是一位跨境电商竞争分析专家。

## 任务
分析该品类的竞争格局，包括市场集中度、价格带分布、品牌定位空白。

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

## 生命周期阶段
- EMERGING: 新兴期，搜索量上升但卖家少
- GROWTH: 成长期，销量快速增长，新卖家涌入
- MATURE: 成熟期，增速放缓，格局稳定
- SATURATED: 饱和期，头部垄断，新卖家难获客
- DECLINE: 衰退期，销量持续下降
- SEASONAL: 季节性品类，需结合月份判断

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "stage": "EMERGING|GROWTH|MATURE|SATURATED|DECLINE|SEASONAL",
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

## 切入角度框架（5维度）
1. 功能差异化：解决竞品未覆盖的使用痛点
2. 设计差异化：外观/包装/颜色的审美突破
3. 定价差异化：价格空白带占位
4. 包装差异化：组合/套装/礼品装
5. 品牌差异化：品牌故事/定位/视觉体系

## 输入数据
{input_data}

## 输出要求（JSON）
{{
  "recommendation": "方案1标题",
  "strategies": [
    {{
      "angle": "FUNCTIONAL|DESIGN|PRICING|PACKAGING|BRANDING",
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
  "angle": "FUNCTIONAL|DESIGN|PRICING|PACKAGING|BRANDING",
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

## 评分公式
opportunityScore = demand(25) + profitability(20) - competition(20) + differentiation(15) + timing(10) - riskPenalty(10)

## 推荐等级
- STRONGLY_RECOMMEND: 强烈推荐，机会分≥80
- RECOMMEND: 推荐，机会分60-79
- WATCH: 观望，机会分40-59
- AVOID: 避免，机会分<40

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
