# 选品Agent — 完整功能设计 v2.1

> **定位**：独立项目 `sijue-selection-agent`（与 SuperMew RAG 完全分离）。
> **架构归属**：[选品算法图.md](../选品算法/图.md) §0 定义的「项目B: 选品Agent」角色。
> **触发方式**：前端直连（Vue:5173 → Agent:8001 SSE），Java完全不参与调度。
> **职责**：从Java拉取聚合数据 → LLM 深度推理 → 输出结构化分析报告 → 回写Java。
>
> **与算法文档的关系**：
> - 本文档是 Agent 的“功能规格书”，定义 Agent **必须具备哪些能力**
> - 算法文档是 Agent 的“知识库”，定义 Agent **应该用什么方法论**
> - [图.md](../选品算法/图.md) 是 Agent 的“接口契约”，定义 Agent **如何与Java/前端交互**

---

## 一、Agent 在系统中的位置（v2.1 三项目解耦）

```
┌──────────────────────┐
│  项目C: Vue前端 :5173 │  ← 唯一的调度者
│  [开始分析]按钮        │
│    ↓ ① 调Java聚合     │
│    ↓ ② 调Agent分析    │
│    ↓ ③ SSE实时进度    │
└───────┬───────────────────┬───────────────────┐
        │                   │                   │
        ▼                   │                   ▼
┌──────────────────────┐  │  ┌──────────────────────────────────────┐
│  项目A: Java :8080   │  │  │  项目B: 选品Agent :8001 (本文档)    │
│                      │  │  │                                      │
│  deng_zong_shop 表    │  │  │  触发: 前端SSE长连接                │
│       │               │  │  │  ① data_fetch: GET /aggregated-data │
│       ▼               │  │  │     → 从Java拉取聚合数据          │
│  品线聚合引擎         │◄───┘  │  ② 8大核心能力(§三) LLM推理        │
│       │               │     │  ③ SSE推送每步进度给前端           │
│       ▼               │     │  ④ POST /analysis-results          │
│  product_line_guidance │◄─────│     → 回写结果到Java               │
│                      │     │                                      │
│  ★ Java不知道Agent存在 │     │  ★ 内部实现由Agent自行决定 ★        │
└──────────────────────┘     └──────────────────────────────────────┘
```

> **核心原则**：Java 只负责“存数据”和“存结果”，Agent 通过前端触发，直接和 Java 的数据API交互。
> 三个项目可独立部署、独立扩缩、独立迭代。

---

## 二、输入数据契约

### 2.1 数据来源

Agent 从 Java `GET /api/v1/product-line/aggregated-data?batchId=xxx` 拉取的原始数据（由 data_fetch 节点主动请求，非 Java 推送）。

以下以 **Nail Tips (nodeId=2909187031)** 为实例展示完整数据包结构：

```json
{
  "batchId": "20260608_001",
  "generatedAt": "2026-06-08T10:00:00",
  "marketplace": "UK",
  "month": "202606",
  "totalProducts": 6991,
  "sourceTable": "deng_zong_shop",

  "productLines": [{
    "bsrId": "beauty",
    "productCount": 520,
    "totalUnits": 15800,
    "totalRevenue": 98540.00,
    "avgProfitRate": 32.5,
    "storeCount": 8,
    "subCategoryCount": 24,

    "subCategories": [{
      "nodeId": 2909187031,
      "nodeName": "Nail Tips",
      "nodeFullPath": "Beauty:Manicure & Pedicure:Nail Design:False Nails & Accessories:Nail Tips",
      "productCount": 35,
      "totalUnits": 2850,
      "totalRevenue": 18780.00,
      "avgPrice": 6.59,
      "priceMin": 4.99,
      "priceMax": 12.99,
      "avgBsr": 13863,
      "avgRating": 4.2,
      "avgRatings": 89,
      "unitsGrowthRate": -13.26,
      "bsrChangeRate": 28.4,
      "topBrands": ["Cunegra", "Makartt", "Beetles"],
      "storeNames": ["SDGHJZ"],
      "bestSellerCount": 3,
      "amazonChoiceCount": 1,

      "sampleProducts": [
        {
          "asin": "B0F3J71BB1",
          "title": "96PCS Stick on Nails, Short Fake Nails for Girls Women with 4 Sheets Jelly Glue...",
          "brand": "Cunegra",
          "price": 5.99,
          "units": 892,
          "bsr": 4521,
          "rating": 4.0,
          "ratingsTotal": 156,
          "listingAge": 180,
          "isBestSeller": true,
          "isAmazonChoice": false
        },
        {
          "asin": "B0Dxxxxx",
          "title": "240pcs Short Press on Nails, Glossy Fake Nails...",
          "brand": "Makartt",
          "price": 7.49,
          "units": 654,
          "bsr": 8234,
          "rating": 4.3,
          "ratingsTotal": 342,
          "listingAge": 320,
          "isBestSeller": false,
          "isAmazonChoice": false
        },
        {
          "asin": "B0Exxxx",
          "title": "French Tip Press on Nails Set, 288 pcs...",
          "brand": "Beetles",
          "price": 9.99,
          "units": 421,
          "bsr": 12456,
          "rating": 4.5,
          "ratingsTotal": 518,
          "listingAge": 450,
          "isBestSeller": false,
          "isAmazonChoice": true
        }
      ]
    }]
  }]
}
```

### 2.2 字段说明

| 字段 | 来源表 | 含义 | Agent使用场景 |
|------|--------|------|-------------|
| `bsrId` | deng_zong_shop.bsr_id | L1品线ID（Best Seller根目录） | 能力1品类理解、能力7跨品线关联 |
| `nodeId` | deng_zong_shop.node_id | L2小类叶子节点ID | 唯一标识一个小类 |
| `nodeName` | node_label_path最后段 | 小类可读名 | 能力1语义理解 |
| `nodeFullPath` | deng_zong_shop.node_label_path | 完整类目路径（冒号分隔） | 能力1层级理解 |
| `totalUnits` | SUM(units) | 该小类总销量 | 能力2竞争格局、能力4利润推算 |
| `avgPrice/MIN/MAX` | AVG/MIN/MAX(price) | 价格区间 | 能力2价格空白、能力4成本推断 |
| `avgBsr` | AVG(bsr) | 平均BSR排名 | 能力2头部判断、能力3生命周期 |
| `avgRating/Ratings` | AVG(rating/ratings_total) | 平均评分和评论数 | 能力2Listing质量、能力3阶段判断 |
| `unitsGrowthRate` | AVG(units_gr) | 销量增速% | **能力3生命周期**（核心信号）、**能力12爆发信号** |
| `bsrChangeRate` | AVG(bsr_cr) | BSR变化率% | **能力3生命周期**（核心信号） |
| `topBrands` | GROUP_CONCAT(DISTINCT brand) | 头部品牌列表 | **能力2竞争格局**（核心输入） |
| `sampleProducts` | Top3 by units | 代表商品详情 | 所有能力的细粒度输入源 |
| `listingAge` | 商品上架天数 | 上架时长 | **能力3生命周期**（辅助信号） |
| `bestSellerCount` | COUNT(is_best_seller) | BS标签数量 | 能力2竞争格局（官方认证指标） |
| `amazonChoiceCount` | COUNT(is_amazon_choice) | AC标签数量 | 能力2竞争格局（平台推荐指标） |

### 2.3 Java额外提供的参考数据（可选）

Agent 还可以请求以下增强数据（通过API参数或单独接口）：

| 数据 | 对应算法文档 | 用途 |
|------|------------|------|
| **品类原型映射** | [08-品类专属评分模型](../选品算法/08-品类专属评分模型.md) | 52个类目→6原型的映射关系，Agent用于调整分析侧重点 |
| **郑总公司子类目排名** | 郑总公司可做子类目.md | 1109个子类目的月销量排名，用于交叉验证 |
| **历史批次对比** | product_line_guidance 历史记录 | 同小类上一次的分析结果，用于趋势对比 |
| **跨站点对照数据** | [13-跨站点套利发现](../选品算法/13-跨站点套利发现.md) | UK↔DE同品类数据，用于空间套利判断 |

---

## 三、8大核心能力（深度定义）

> 每个能力包含：输入 → 处理逻辑 → 输出JSON Schema → 与算法文档的对应关系 → 难度评估。

---

### 能力1：语义品类理解（Category Semantics）

#### 1.1 功能定义

不是简单的分类匹配，而是通过LLM"看懂"这个品类的商业本质。对应算法文档：**[08-品类专属评分模型](../选品算法/08-品类专属评分模型.md)** 的品类原型分类。

#### 1.2 输入

```
nodeName="Nail Tips"
nodeFullPath="Beauty:Manicure & Pedicure:Nail Design:False Nails & Accessories:Nail Tips"
bsrId="beauty"
sampleProducts[].title（3-5条商品标题）
```

#### 1.3 处理逻辑

```
Step 1: 翻译+本地化 → 得到中文品类名和行业术语
Step 2: 消费者画像推理 → 从title中的关键词推断who/why/buyFrequency
Step 3: 产品属性判定 → 判断consumable/visualDriven/giftPotential/trendSensitivity
Step 4: 品类原型匹配 → 映射到6大原型之一（见下方原型体系）
Step 5: 分析权重调整 → 根据原型确定后续分析的侧重点
```

#### 1.4 品类原型体系（来自08文档）

| 原型代码 | 名称 | 代表特征 | Nail Tips 匹配结果 | 分析侧重点调整 |
|---------|------|---------|-------------------|--------------|
| **DA** | 装饰艺术 | 视觉驱动、图案裂变 | 部分匹配（视觉驱动✅ 但非家居装饰） | 装饰价值权重↑ |
| **FH** | 功能家居 | 实用驱动、性价比 | 不匹配 | — |
| **FP** | 时尚个人 | 风格驱动、身份认同 | **★ 最佳匹配 ★** | 文化匹配↑ 裂变能力↑ |
| **TN** | 趋势潮流 | 热度驱动、快速迭代 | 部分匹配（款式迭代快✅） | 时间敏感度↑ |
| **PE** | 派对活动 | 文化驱动、高销量 | 不匹配 | — |
| **PS** | 纸品文具 | 极轻、图案裂变 | 不匹配 | — |

**Nail Tips 判定结果**：主原型 = **FP（时尚个人）**，副原型 = **TN（趋势潮流）**

这意味着后续分析中：
- **情绪价值**和**裂变能力**维度应给予更高关注（FP特性）
- **时间窗口**估计应更保守（TN特性=快迭代=短红利期）
- **文化匹配**需关注英伦审美偏好（FP特性=风格认同）

#### 1.5 输出 JSON

```json
{
  "categoryUnderstanding": {
    "zhName": "美甲贴片/假指甲",
    "categoryType": "时尚美容-美甲-假指甲配件",
    "consumerProfile": {
      "who": "18-35岁女性为主，DIY美妆爱好者，学生/年轻白领",
      "whyBuy": "省去美甲店费用(£30-60/次)，在家自己操作，追求性价比+个性化",
      "buyFrequency": "复购类，每2-4周更换一次款式",
      "seasonality": "夏季(露手季节)+节日季(圣诞/万圣节/情人节)为旺季",
      "channelPreference": "TikTok/Instagram/YouTube美妆博主种草为主"
    },
    "productNature": {
      "isConsumable": true,
      "visualDriven": true,
      "giftPotential": "medium",
      "trendSensitivity": "high",
      "shippingProfile": "LIGHT_SMALL",       // 极轻小件（影响FBA费用估算）
      "complianceLevel": "MEDIUM"              // 涉及化妆品接触，需注意成分安全
    },
    "archetypeMatch": {
      "primary": "FP",                        // 时尚个人
      "secondary": "TN",                       // 趋势潮流
      "confidence": 0.88,
      "analysisBias": {
        "emphasizeDimensions": ["情绪价值", "裂变能力", "文化匹配"],
        "deemphasizeDimensions": ["体积成本"],   // 小件产品此项天然有利
        "timeHorizon": "SHORT_TO_MEDIUM"        // FP+TN组合 → 红利期较短
      }
    }
  }
}
```

#### 1.6 与算法文档的关系

| 算法文档 | 本能力使用方式 |
|---------|--------------|
| **08 品类原型** | 直接使用6原型分类体系和52类目映射表作为先验知识 |
| **02 AI软评分** | 原设计用LLM打"情绪价值/装饰价值/裂变能力/文化匹配"4个软维度 → 本能力是这4个维度的**前置基础** |
| **重要思想.md** | "品类是分析单位（不是逐商品）"——本能力确立的就是品类级的理解 |

---

### 能力2：竞争格局解剖（Competition Anatomy）

#### 2.1 功能定义

不是数品牌个数，而是画出完整的竞争结构地图。对应算法文档：**[11-竞品差异化分析](../选品算法/11-竞品差异化分析.md)** 的价格带分析 + **[10-卖家行为画像](../选品算法/10-卖家行为画像.md)** 的卖家评分。

#### 2.2 输入

```
topBrands: ["Cunegra", "Makartt", "Beetles"]
sampleProducts: [{brand, price, units, bsr, rating, ratingsTotal, isBestSeller, isAmazonChoice} × 3]
avgPrice / priceMin / priceMax
bestSellerCount / amazonChoiceCount
```

#### 2.3 处理逻辑

```
Step 1: 价格带划分 → 按11文档的5档切分当前市场
Step 2: 品牌定位 → 每个品牌落在哪个价格带？什么定位？
Step 3: 市场份额估算 → 用units占比近似市场份额
Step 4: 格局类型判断 → 一超多强? 双寡头? 碎片化?
Step 5: 集中度计算 → CR3 / CR5 / HHI指数
Step 6: 入门难度综合评估 → 评论门槛+价格壁垒+品牌护城河
Step 7: 价格空白扫描 → 哪个价格带有需求但供给不足？
```

#### 2.4 价格带体系（来自11文档）

| 价格带 | 区间(UK) | 特征 | Nail Tips 分布 |
|--------|---------|------|---------------|
| 低端 | £4.99-5.99 | 走量型，利润薄 | Cunegra 主阵地 ⚠️拥挤 |
| 中低 | £5.99-7.99 | 性价比，主流战场 | Makartt + 部分 Cunegra |
| **中高** | **£7.99-9.99** | **⭐ 关键价格带** | **仅Beetles一家 → 空白机会** |
| 高端 | £9.99-16.99 | 品牌/品质溢价 | Beetles 高价位款，量少 |
| 奢侈 | >£16.99 | 设计师/IP联名 | **完全空白** |

#### 2.5 输出 JSON

```json
{
  "competitionStructure": {
    "pattern": "DOMINANT_CHALLENGERS",
    // 枚举: DOMINANT_CHALLENGER(一超多强) / DUOPOLY(双寡头)
    //       FRAGMENTED(碎片化) / LONG_TAIL(长尾分散) / EMERGING_BLUE_OCEAN(新兴蓝海)

    "topPlayerAnalysis": [
      {
        "brand": "Cunegra",
        "marketShareEstimate": "35%",
        "positioning": "VOLUME_LEADER",          // 低价走量型
        "priceBand": "£4.99-6.99",
        "band": "LOW",                            // 对应11文档价格带
        "strengths": ["SKU丰富度高", "BSR领先(4521)", "性价比突出", "BestSeller认证"],
        "weaknesses": ["评分偏低(4.0)", "评论量中等(156)", "缺少高端产品线"],
        "moatAnalysis": "先发优势+供应链规模效应，但无专利/品牌强护城河",
        "threatLevel": "HIGH"                      // 对新进入者的威胁程度
      },
      {
        "brand": "Makartt",
        "marketShareEstimate": "26%",
        "positioning": "QUALITY_MID_RANGE",
        "priceBand": "£6.99-9.99",
        "band": "MID_LOW_to_MID_HIGH",
        "strengths": ["评分高(4.3)", "评论多(342)→信任度高", "覆盖中高档"],
        "weaknesses": ["BSR落后Cunegra近一倍", "价格偏高导致转化率可能偏低"],
        "moatAnalysis": "品质口碑积累，但可被超越",
        "threatLevel": "MEDIUM"
      },
      {
        "brand": "Beetles",
        "marketShareEstimate": "17%",
        "positioning": "PREMIUM_NICHE",
        "priceBand": "£9.99-12.99",
        "band": "MID_HIGH_to_HIGH",
        "strengths": ["评分最高(4.5)", "评论最多(518)", "AmazonChoice认证"],
        "weaknesses": ["价高量少", "市场占有率有限"],
        "moatAnalysis": "高品质形象+AC标签，但 niche 定位不构成全面威胁",
        "threatLevel": "LOW"
      }
    ],

    "concentrationMetrics": {
      "cr3": 0.78,                             // TOP3占78%份额
      "hhi": 1850,                             // HHI指数（<1500分散, 1500-2500适度集中, >2500高度集中）
      "interpretation": "适度集中市场，有挑战者空间但头部优势明显"
    },

    "entryDifficulty": {
      "level": "MEDIUM",
      // EASY / MEDIUM / HARD / VERY_HARD
      "score": 62,                              // 0-100,越高越难
      "factors": [
        {"factor": "评论门槛", "score": 55, "detail": "平均89条，新品需积累但门槛不高"},
        {"factor": "价格竞争", "score": 70, "detail": "低端有Cunegra把守，不宜直接价格战"},
        {"factor": "品牌壁垒", "score": 50, "detail": "无绝对强势品牌，消费者品牌忠诚度一般"},
        {"factor": "合规门槛", "score": 40, "detail": "化妆品标准可控"},
        {"factor": "供应链", "score": 45, "detail": "美甲贴片供应链成熟，1688可选多"}
      ]
    },

    "priceGapOpportunity": {
      "hasGap": true,
      "gapBand": "MID_HIGH",                     // £7.99-9.99
      "gapDescription": "关键价格带仅Beetles一家且销量偏低(17%份额)，Cunegra未进入此带",
      "gapSize": "estimated £12000-18000/month potential",
      "entryPrice": "£7.99-8.99",
      "gapConfidence": 0.75,
      "riskNote": "若成功切入可能引发Makartt降价跟进"
    },

    "listingQualityGap": {                       // 来自11文档 §Listing质量差距
      "hasGap": true,
      "observation": "头部产品主图质量一般，A+ Content 利用率低，视频展示不足",
      "opportunity": "通过提升Listing质量获取自然流量优势"
    }
  }
}
```

#### 2.6 与算法文档的关系

| 算法文档 | 本能力使用方式 |
|---------|--------------|
| **11 差异化分析** | 直接使用5价格带体系 + Listing质量差距分析 + 5切入点框架 |
| **10 卖家画像** | 参考3维卖家评分模型来评价每个竞争对手的"聪明程度" |
| **09 蓝海V2** | 如果格局类型判定为 EMERGING_BLUE_OCEAN，触发蓝海雷达分析（能力2扩展） |

---

### 能力3：生命周期阶段判断（Lifecycle Assessment）

#### 3.1 功能定义

判断该品类当前处于生命周期的哪个阶段，给出时间视角的机会评估。对应算法文档：**[12-新品爆发信号检测](../选品算法/12-新品爆发信号检测.md)** 的信号检测 + **[09-蓝海发现算法升级](../选品算法/09-蓝海发现算法升级.md)** 的机会分型。

#### 3.2 输入

```
unitsGrowthRate: -13.26
bsrChangeRate: 28.4
avgRatings: 89
sampleProducts[].listingAge: [180, 320, 450]
productCount: 35
```

#### 3.3 信号体系（来自12文档）

| 信号类型 | 来源字段 | 当前值 | 解读 |
|---------|---------|--------|------|
| **速度信号 Speed** | unitsGrowthRate | **-13.26%** | 🔴 负增长 → 需求在收缩或被分流 |
| **密度信号 Density** | productCount / totalMarketSize | 35个SKU | 🟡 中等密度，不算拥挤也不算空白 |
| **关注信号 Follow** | storeNames 数量 | 1店(SDGHJZ) | 🟢 仅郑总一家在经营 → 外部关注度不高 |
| **质量信号 Quality** | avgRating + avgRatings | 4.2分/89条 | 🟢 质量尚可，新玩家有机会靠更高评分突围 |

#### 3.4 生命周期阶段枚举

| 阶段 | 代码 | 特征信号组合 | Nail Tips 匹配 |
|------|------|-------------|----------------|
| 新兴期 | EMERGING | unitsGr>+30%, bsrCr<-20%, ratings<50 | ❌ 不匹配 |
| 成长期 | GROWTH | unitsGr>+10%, bsrCr稳定, ratings增长中 | ❌ 不匹配 |
| 成熟稳定 | MATURITY_STABLE | unitsGr±10%, bsrCr±15%, ratings平稳 | ❌ 不匹配 |
| **成熟衰退** | **MATURITY_WITH_DECLINE** | **unitsGr<-10%, bsrCr>+20%, ratings平台期** | **★ 匹配 ★** |
| 饱和 | SATURATION | unitsGr<-20%, CR3>0.8, 价格战频发 | 接近但未达 |
| 衰退 | DECLINE | unitsGr<-30%, 多家退出, 评价下降 | ❌ 不匹配 |

#### 3.5 输出 JSON

```json
{
  "lifecycleStage": {
    "stage": "MATURITY_WITH_DECLINE",
    "stageLabel": "成熟衰退期",

    "evidenceChain": [
      {
        "signal": "销量增速",
        "value": -13.26,
        "sourceField": "unitsGrowthRate",
        "severity": "WARNING",
        "interpretation": "整体需求收缩或被竞品分流，非新品爆发特征"
      },
      {
        "signal": "BSR变化率",
        "value": 28.4,
        "sourceField": "bsrChangeRate",
        "severity": "WARNING",
        "interpretation": "排名持续下滑，说明有竞品在抢占位置或品类整体降温"
      },
      {
        "signal": "评论成熟度",
        "value": "平均89条，最高518条",
        "sourceField": "avgRatings",
        "severity": "INFO",
        "interpretation": "非新品爆发期（爆发期通常<30条），已过快速增长窗口"
      },
      {
        "signal": "上架年龄分布",
        "value": "180/320/450天",
        "sourceField": "listingAge[]",
        "severity": "INFO",
        "interpretation": "头部商品上架6-15个月，属于稳定运营期非新品冲击期"
      }
    ],

    "explosionSignal": {                         // 来自12文档
      "detected": false,
      "signalType": null,
      // SPEED/DENSITY/FOLLOW/QUALITY
      "urgency": "NONE",
      // 🔴CRITICAL / 🟡IMPORTANT / 🟢WATCH / NONE
      "note": "无爆发信号，符合成熟衰退期特征"
    },

    "stageImplication": {
      "goodNews": "成熟品类=需求确定性高，不会突然消失；消费者教育已完成",
      "badNews": "增长空间有限，入场靠抢存量而非吃增量；红利期已过",
      "strategyFit": "适合精细化差异化切入，不适合大规模铺货赌增长",
      "timeWindow": {
        "estimateMonths": 18,
        "confidence": "MEDIUM",
        "reasoning": "美甲DIY趋势短期不会逆转，但替代品（如美甲笔/穿戴甲）可能在2年内侵蚀"
      }
    },

    "blueOceanTyping": {                        // 来自09文档
      "type": "RED_SEAM",
      // BLUE_OCEAN(🌊蓝海) / RED_SEAM(🔥红海缝隙) / NICHE(💎利基) / WATCH(⏳观望)
      "reasoning": "红海中的缝隙——整体红海但£7.99-9.99价格带有结构性空白",
      "radarScore": {
        "demand": 72,                           // 09文档10维雷达
        "competition": 78,
        "margin": 65,
        "barrier": 55,
        "trend": 58,
        "seasonality": 70,
        "supplyRisk": 62,
        "differentiationRoom": 80,             // ★ 最高分 = 最大机会点
        "sellerQuality": 68,
        "crossBorderPotential": 45
      }
    }
  }
}
```

#### 3.6 与算法文档的关系

| 算法文档 | 本能力使用方式 |
|---------|--------------|
| **12 爆发信号** | 使用4信号类型(Speed/Density/Follow/Quality) × 3紧急度(🔴🟡🟢)体系做信号检测 |
| **12 等级提升规则** | 如检测到🔴信号：S2+🔴→S1, X+🔴→S3（影响最终裁决能力8） |
| **09 蓝海V2** | 使用4机会分型(🌊🔥💎⏳) + 10维雷达图做品类定调 |
| **07 动态基线** | 百分位相对评分思维——不只看绝对数值，要看在同品类中的相对位置 |

---

### 能力4：利润可行性推算（Profit Feasibility）

#### 4.1 功能定义

不做精确会计计算（那是用户的事），而是基于品类特征的合理性区间判断。对应算法文档：**[01-选品算法总体设计](../选品算法/01-选品算法总体设计.md)** §3.2 利润率维度（原8维之一）。

#### 4.2 输入

```
avgPrice: 6.59 / priceMin: 4.99 / priceMax: 12.99
bsrId: "beauty" → 映射到品类成本知识库
totalUnits: 2850 / productCount: 35
shippingProfile: 来自能力1的 "LIGHT_SMALL"
```

#### 4.3 品类成本知识库（Agent内置）

Agent 应维护一个基于经验的品类成本参照表（随运行积累更新）：

| 品类特征 | 产品成本区间 | FBA费用 | 佣金 | 典型PPC | 退货率 |
|---------|------------|--------|------|---------|-------|
| 极轻小件(<50g) | £0.8-2.0 | £0.8-1.2 | 15% | £1-3 | 5-12% |
| 轻小件(50-200g) | £1.5-4.0 | £1.2-2.5 | 15% | £2-5 | 8-15% |
| 中件(200-500g) | £3-8 | £2.5-5 | 15% | £3-8 | 10-18% |
| 重件(>500g) | £8-20 | £5-15 | 15% | £5-15 | 12-25% |

Nail Tips 属于 **极轻小件** → 使用第一行参数。

#### 4.4 输出 JSON

```json
{
  "profitFeasibility": {
    "marginEstimate": {
      "pessimistic": {"margin": 22, "scenario": "高PPC(ACOS 35%) + 高退(12%) + 季节性淡季"},
      "typical": {"margin": 32, "scenario": "正常PPC(ACOS 20%) + 正常退(8%) + 正常季"},
      "optimistic": {"margin": 41, "scenario": "低PPC(ACOS 12%) + 低退(5%) + 旺季自然流量"}
    },

    "costStructure": {
      "cogsRange": "£1.20-1.80",                // 采购成本（极轻小件经验值）
      "fbaFeeRange": "£0.95-1.40",
      "amazonCommission": {"rate": 0.15, "example": "£0.99 @ £6.59"},
      "prepAndPack": "£0.15-0.30",
      "ppcPerOrder": {"low": 1.50, "high": 3.00},
      "returnRateRange": "0.08-0.12",
      "currency": "GBP"
    },

    "breakEven": {
      "monthlyUnitsRequired": 180,
      "calculationBasis": "固定成本£900/月 ÷ 单件贡献利润£5.00",
      "vsTopSeller": {
        "top1Units": 892,
        "top1Brand": "Cunegra",
        "breakEvenRatio": 0.20,                  // 只需TOP1的20%
        "verdict": "盈亏平衡门槛不高，但盈利需要做到TOP3水平(~400件/月)"
      }
    },

    "profitRiskFactors": [
      {"factor": "PPC竞价上升", "probability": "HIGH", "impactOnMargin": "-3~5%", "triggerCondition": "旺季CPC可能翻倍"},
      {"factor": "季节性淡季", "probability": "MEDIUM", "impactOnMargin": "可能转亏", "triggerCondition": "1-3月销量可能腰斩"},
      {"factor": "头部价格战", "probability": "MEDIUM", "impactOnMargin": "-8~15%", "triggerCondition": "Cunegra降至£4.99以下"},
      {"factor": "退货率超预期", "probability": "LOW", "impactOnMargin": "-3~6%", "triggerCondition": "颜色/尺寸不符预期"}
    ],

    "profitModelVerdict": {
      "feasible": true,
      "keyCondition": "必须控制PPC ACOS <25% 且 定价 ≥£7.99（避开低端价格战）",
      "recommendedTargetPrice": "£7.99-9.99",
      "expectedMonthlyProfitAtTarget": "£2400-4800 (基于300-600件/月预估)"
    }
  }
}
```

---

### 能力5：差异化切入点生成（Differentiation Strategy）

#### 5.1 功能定义

这是**最核心的能力**——不只是说"要差异化"，而是生成至少3个可执行的具体方案并推荐最优解。对应算法文档：**[11-竞品差异化分析](../选品算法/11-竞品差异化分析.md)** §五（5切入角度）+ **[09-蓝海V2](../选品算法/09-蓝海发现算法升级.md)** 的测品推荐。

#### 5.2 输入

```
能力1-4的全部输出（品类理解 + 竞争格局 + 生命周期 + 利润可行性）
```

#### 5.3 5切入角度框架（来自11文档）

| 切入角度 | 定义 | 适用条件 | Nail Tips 适用性 |
|---------|------|---------|----------------|
| **价格空白** | 进入竞争对手忽略的价格带 | 存在明显价格空隙 | ✅ £7.99-9.99有空隙 |
| **运营卓越** | 通过Listing/服务/物流体验胜出 | 竞品Listing质量普遍差 | ✅ 头部Listing质量一般 |
| **低评快起** | 针对竞品低评分弱点推出更优产品 | 有竞品评分<4.0 | ✅ Cunegra仅4.0分 |
| **变体差异化** | 提供竞品没有的变体组合 | 变体覆盖不全 | ✅ 缺少套装/工具组合 |
| **白牌替代** | 替代高价白牌/大牌 | 存在高价低质空间 | ⚠️ 暂不明显 |

#### 5.4 输出 JSON

```json
{
  "differentiationAngles": [
    {
      "angleCode": "VARIANT_BUNDLE",
      "angleName": "变体差异化 - 工具套装化路线",
      "frameworkMatch": "变体差异化（11文档§五）",
      "description": "当前市场全是纯指甲片+胶水单品，缺少'一站式工具包'（含打磨条/酒精棉/卸甲包/教程卡/收纳盒）",
      "targetCustomer": {
        "profile": "新手小白，怕麻烦，想要开箱即用的完整方案",
        "painPoint": "买了指甲片后发现还需要另外买工具，体验断裂"
      },
      "productConcept": {
        "name": "Nail Tips Complete Starter Kit",
        "components": ["96pcs Assorted Nail Tips", "Jelly Glue ×2 sheets", "Mini Nail File", "Alcohol Prep Pads ×10", "Cuticle Stick", "Remover Wipes ×5", "Instruction Card (QR Video)"],
        "packaging": "硬纸盒+内衬分区，开箱仪式感",
        "skuComplexity": "MEDIUM"                    // 组装复杂度
      },
      "pricing": {
        "suggestedRange": "£9.99-13.99",
        "vsMarketAvg": "+52%~112%",
        "expectedMargin": "35-42%",
        "priceBandPosition": "MID_HIGH"              // 对应11文档价格带
      },
      "execution": {
        "difficulty": "LOW",
        "difficultyScore": 35,                       // 0-100
        "keyRequirements": ["配件供应链(1688可解决)", "包装设计", "组装质检"],
        "competitiveMoat": "便利性组合壁垒（竞品需重新设计包装线才能复制）",
        "timeToMarket": "2-3周",
        "investmentEstimate": "¥3000-5000（首批备货+包装开模）"
      },
      "riskFactors": ["套装定价可能超出部分客户预算", "组件多=退货原因增多"],
      "successProbability": 0.76
    },
    {
      "angleCode": "DESIGN_PREMIUM",
      "angleName": "视觉差异化 - 设计师联名路线",
      "frameworkMatch": "运营卓越 + 价格空白混合（11文档§五）",
      "description": "主流产品偏基础纯色/法式，缺少设计师联名/艺术IP/限量款",
      "targetCustomer": {
        "profile": "25-35岁都市女性，追求个性表达，愿意为设计付溢价",
        "painPoint": "市面产品'都长一样'，无法体现个人品味"
      },
      "productConcept": {
        "name": "Art Series Press-on Nails",
        "components": ["设计师图案系列(春日花园/几何抽象/波普艺术)", "升级胶水(更强持久度)", "精致包装(礼盒感)"],
        "packaging": "磁吸礼盒+艺术画册式说明书",
        "skuComplexity": "HIGH"
      },
      "pricing": {
        "suggestedRange": "£11.99-16.99",
        "vsMarketAvg": "+82%~158%",
        "expectedMargin": "42-52%",
        "priceBandPosition": "HIGH"
      },
      "execution": {
        "difficulty": "MEDIUM-HIGH",
        "difficultyScore": 68,
        "keyRequirements": ["设计师资源或IP授权", "高品质印刷工艺", "品牌故事包装"],
        "competitiveMoat": "设计版权 + IP独占 + 品牌认知",
        "timeToMarket": "4-6周",
        "investmentEstimate": "¥8000-15000（设计费+IP授权+首批）"
      },
      "riskFactors": ["设计审美主观性强，可能不讨好所有客群", "IP授权有持续性成本"],
      "successProbability": 0.62
    },
    {
      "angleCode": "OCCASIONAL_THEME",
      "angleName": "场景细分 - 特殊场合系列",
      "frameworkMatch": "变体差异化 + 运营卓越（11文档§五）",
      "description": "缺少针对婚礼/毕业季/派对/节日主题的专用款",
      "targetCustomer": {
        "profile": "活动策划人群 + 准新娘 + 派对组织者",
        "painPoint": "通用款不够'应景'，需要场合专用但不值得去美甲店"
      },
      "productConcept": {
        "name": "Occasion Collection Press-on Nails",
        "components": ["场合主题图案(婚礼白金/毕业学士蓝/派对亮片)", "长效胶水(7-14天)", "场合搭配建议卡"],
        "packaging": "场合主题信封式包装",
        "skuComplexity": "MEDIUM"
      },
      "pricing": {
        "suggestedRange": "£12.99-16.99",
        "vsMarketAvg": "+97%~158%",
        "expectedMargin": "44-53%",
        "priceBandPosition": "HIGH"
      },
      "execution": {
        "difficulty": "MEDIUM",
        "difficultyScore": 55,
        "keyRequirements": ["季节性提前备货(提前2个月)", "多主题并行开发", "时机营销素材"],
        "competitiveMoat": "时机敏感性（错过窗口=库存积压但也意味着先行者优势）",
        "timeToMarket": "3-4周",
        "investmentEstimate": "¥5000-8000（多主题备货）"
      },
      "riskFactors": ["强季节性=淡季风险", "备货时机错误=全盘亏损"],
      "successProbability": 0.58
    }
  ],

  "recommendedAngle": {
    "choice": "VARIANT_BUNDLE",
    "choiceName": "工具套装化路线",
    "reasoning": [
      "难度最低(score 35)，上市最快(2-3周)",
      "溢价合理(+52~112%)，不脱离主流客群支付意愿",
      "对手难以快速复制（需重新设计包装供应链）",
      "利用了Cunegra(低评分)和Beetles(高价少量)之间的空白地带",
      "符合FP原型'身份认同'属性——套装=完整体验=身份升级"
    ],
    "fallbackOption": "如果套装测试效果不佳，第二选择 DESIGN_PREMIUM 走设计路线"
  }
}
```

---

### 能力6：风险雷达（Risk Radar）

#### 6.1 功能定义

不只说机会，更要说清楚会死在哪里以及怎么防。对应算法文档：**[12-新品爆发信号检测](../选品算法/12-新品爆发信号检测.md)** 的风险评估 + **[15-实施问题清单](../选品算法/15-实施问题清单与解决思路.md)** 的已知陷阱。

#### 6.2 风险分类体系

| 风险类别 | 代码 | 说明 | 数据来源 |
|---------|------|------|---------|
| 供应链 | SUPPLY_CHAIN | 备货/周转/缺货/积压 | 经验知识库 |
| 竞争 | COMPETITION | 价格战/模仿/排挤 | 能力2的竞争格局 |
| 运营 | OPERATION | PPC/Listing/库存/客服 | 行业经验 |
| 合规 | COMPLIANCE | 认证/标准/知识产权 | 品类特征 |
| 市场 | MARKET | 需求萎缩/替代品/政策 | 能力3的生命周期 |
| 财务 | FINANCIAL | 汇率/资金周转/现金流 | 宏观环境 |

#### 6.3 输出 JSON

```json
{
  "riskRadar": {
    "risks": [
      {
        "category": "COMPETITION",
        "name": "头部品牌价格战反制",
        "severity": "CRITICAL",
        "probability": "MEDIUM-HIGH",
        "score": 82,                              // 0-100 风险分
        "description": "Cunegra(低价走量型)可能感知新进入者威胁后主动降价至£4.99以下封杀",
        "triggerCondition": "我方产品进入TOP10 BSR 或 月销超过300件",
        "mitigation": [
          "保持≥30%定价间距（我方£7.99+ vs Cunegra £5.99）",
          "走差异化路线避免直接可比（套装 vs 单品）",
          "建立品牌认知而非依赖价格竞争力"
        ],
        "impactIfHappened": "整个价格带被拉低，利润空间压缩至<15%，可能被迫退出",
        "detectionMethod": "监控Cunegra价格变动（每周检查）",
        "relatedAlgorithmDoc": "11-竞品差异化分析 §价格带策略"
      },
      {
        "category": "SUPPLY_CHAIN",
        "name": "款式迭代速度 vs 库存周转",
        "severity": "HIGH",
        "probability": "MEDIUM",
        "score": 68,
        "description": "美甲贴片属TN原型（趋势潮流），款式每季度迭代。供应链反应慢则积压过时库存",
        "triggerCondition": "从下单到上架超过4周",
        "mitigation": [
          "采用小批量快返模式：首单≤200件，补单≤500件",
          "选择支持7天急单的供应商",
          "设计模块化（底色通用+图案贴片可换）减少SKU压力"
        ],
        "impactIfHappened": "库存积压3个月以上→资金占用+降价清仓→毛利率下降15-20%",
        "detectionMethod": "追踪同行新品上架频率（每月统计）"
      },
      {
        "category": "OPERATION",
        "name": "PPC成本失控",
        "severity": "MEDIUM",
        "probability": "HIGH",
        "score": 72,
        "description": "美甲关键词CPC可能高达£0.8-1.2（UK站）。新品零自然流量初期100%依赖PPC",
        "triggerCondition": "上线前30天内自然订单占比<10%",
        "mitigation": [
          "预留前3个月PPC预算=预计销售额的25-30%",
          "同步启动TikTok/Instagram内容引流降低PPC依赖",
          "设置ACOS硬顶25%，超限自动降预算",
          "优先长尾词（低CPC高转化）而非大词"
        ],
        "impactIfHappened": "ACOS>35%→单品亏损运营→越卖越亏",
        "detectionMethod": "每日监控ACOS和广告花费"
      },
      {
        "category": "COMPLIANCE",
        "name": "化妆品安全合规",
        "severity": "LOW",
        "probability": "LOW",
        "score": 28,
        "description": "美甲贴片的胶水成分需符合EU化妆品法规(EC) No 1223/2009",
        "triggerCondition": "使用未知来源胶水或含甲醛等禁用成分",
        "mitigation": [
          "选用已有CPNP注册的供应商",
          "胶水成分送检第三方实验室",
          "保留COA(分析证书)备查"
        ],
        "impactIfHappened": "产品下架+罚款£5000-20000+账号警告",
        "detectionMethod": "供应商审核时索取合规文件"
      },
      {
        "category": "MARKET",
        "name": "替代品侵蚀（穿戴甲/甲油胶/美甲笔）",
        "severity": "MEDIUM",
        "probability": "MEDIUM",
        "score": 55,
        "description": "半永久穿戴甲(hard gel nails)正在蚕食传统贴片市场份额",
        "triggerCondition": "穿戴甲相关关键词搜索量增速>贴片",
        "mitigation": [
          "关注穿戴甲赛道发展（季度review）",
          "若侵蚀加速，考虑转型或双线布局",
          "当前无需过度担忧（贴片仍有价格优势和便捷性优势）"
        ],
        "impactIfHappened": "中长期(12-24月)市场需求结构性下降",
        "detectionMethod": "Google Trends 监控相关搜索词趋势"
      }
    ],

    "overallRiskAssessment": {
      "level": "MEDIUM-HIGH",
      // LOW / MEDIUM / MEDIUM-HIGH / HIGH / CRITICAL
      "score": 64,                              // 综合风险分
      "topRisks": ["头部价格战反制(82)", "PPC失控(72)", "库存周转(68)"],
      "manageable": true,                       // 是否在可控范围内
      "managementCost": "需要投入中等精力进行风险监控和预案执行"
    },

    "goNoGoVerdict": {
      "verdict": "CONDITIONAL_GO",
      // GO / CONDITIONAL_GO / NO_GO / WAIT_AND_SEE
      "conditions": [
        "供应链必须支持小批快返（首单≤200件，补货周期≤14天）",
        "必须走差异化路线（套装/设计），禁止纯跟卖基础款",
        "PPC预算储备≥首月预计销售额的30%",
        "供应商必须提供合规文件（CPNP/COA）"
      ],
      "dealBreakers": [
        "如果只能做纯色基础款跟卖 → NO_GO（必死无疑）",
        "如果首批备货要求>500件 → CONDITIONAL_GO（提高风险等级）",
        "如果没有PPC预算或内容引流能力 → WAIT_AND_SEE（先建能力再进场）"
      ]
    }
  }
}
```

---

### 能力7：跨品线关联与套利发现（Cross-Line Intelligence）

#### 7.1 功能定义

发现当前小类与其他品线的关联关系（捆绑/替代/向上销售），以及跨站点套利机会。对应算法文档：**[13-跨站点套利发现](../选品算法/13-跨站点套利发现.md)** + **[10-卖家行为画像](../选品算法/10-卖家行为画像.md)** 的关注信号。

#### 7.2 输入

```
当前小类的全部数据
同批次其他品线的概览数据（bsrId/nodeName/productCount/topBrands汇总）
可选：DE站点同品类对照数据（来自13文档的跨站数据）
```

#### 7.3 输出 JSON

```json
{
  "crossLineInsights": {
    "relatedCategories": [
      {
        "relatedNodeId": 2909188031,
        "relatedNodeName": "False Nails",
        "relationType": "DIRECT_SUBSTITUTE",
        // DIRECT_SUBSTITUTE(直接替代) / COMPLEMENTARY(互补) / UPSELL(向上销售)
        // CROSS_SELL(交叉销售) / INPUT_SUPPLY(上游供应)
        "overlapEvidence": "同一客户群（18-35女性DIY美妆），购买动机相同（省美甲店钱）",
        "actionableInsight": "可以捆绑销售（Nail Tips + False Nails 组合包）或做A/B测试看哪个转化更好",
        "dataSupport": {
          "theirProductCount": 28,
          "theirTopBrands": ["Cunegra", "Makartt"],
          "brandOverlap": "HIGH"                   // 品牌重合度高=同一批玩家
        }
      },
      {
        "relatedNodeId": 2909192031,
        "relatedNodeName": "Nail Art Equipment",
        "relationType": "UPSELL",
        "overlapEvidence": "买了入门级Nail Tips的客户，使用熟练后可能升级购买专业美甲工具",
        "actionableInsight": "可在套装中加入简易版工具作为'钩子'，引导后续购买专业工具",
        "dataSupport": {
          "theirProductCount": 15,
          "theirAvgPrice": "£12.50",               // 显著高于Nail Tips
          "priceGapOK": true
        }
      },
      {
        "relatedNodeBsrId": "home-uk",
        "relatedNodeName": "Makeup Organisers",
        "relationType": "CROSS_SELL",
        "overlapEvidence": "美妆人群的自然延伸需求——做了指甲的人通常也关注化妆收纳",
        "actionableInsight": "可以在营销素材中暗示搭配使用，或在打包发货时放入catalog引导",
        "crossBsrLine": true                       // 跨品线关联（不同bsrId）
      }
    ],

    "bundleOpportunity": {
      "exists": true,
      "recommendedBundle": {
        "name": "DIY Manicure Starter Kit",
        "components": ["Nail Tips 96pcs", "Mini Nail File", "Jelly Glue ×2", "Cuticle Pusher", "Instruction Guide"],
        "bundlePrice": "£11.99-14.99",
        "componentCostIfSeparate": "£16-19",
        "customerSaving": "£4-6（感知优惠）",
        "marginBoost": "+8-12% compared to separate sales",
        "conversionLiftEstimate": "1.3-1.8x"        // 捆绑后转化率提升倍数
      }
    },

    "crossMarketplaceArbitrage": {                 // 来自13文档
      "analyzed": false,
      "reason": "当前批次仅有UK站点数据，需要DE站点数据才能做套利分析",
      "suggestion": "请求Java提供DE站点同品类(nodeId=2909187031)的聚合数据进行对比",
      "whatIfAvailable": [
        "比较UK vs DE的价格带分布差异",
        "查找UK有但DE缺失的ASIN（套利机会）",
        "比较两站点的成熟度和竞争强度"
      ]
    },

    "sellerFollowSignals": {                       // 来自10文档
      "observed": false,
      "note": "当前仅SDGHJZ一家店铺经营此小类，无外部智能卖家关注信号",
      "ifMultipleStoresObserved": "当出现多家店铺同时新增同类商品时，视为积极关注信号"
    }
  }
}
```

---

### 能力8：最终裁决（Final Verdict）

#### 8.1 功能定义

收敛能力1-7的全部结论，输出最终的推荐等级、行动指令和禁忌清单。这是Agent对外输出的**唯一决策结论**。

#### 8.2 裁决等级体系

| 等级 | 代码 | 含义 | 行动含义 | 对应04文档状态机 |
|------|------|------|---------|----------------|
| 强烈推荐 | STRONGLY_RECOMMEND | 高确信的高机会品线 | **立即行动(P1)** | LAUNCH |
| 推荐 | RECOMMEND | 有条件的高机会品线 | **本月行动(P2)** | CONDITIONAL |
| 观望 | WATCH | 机会存在但有显著不确定性 | **本季度观察(P3)** | WATCH |
| 避免 | AVOID | 风险高于收益或基本面不支持 | **不进入** | ABANDON |

#### 8.3 输出 JSON

```json
{
  "finalVerdict": {
    "recommendLevel": "RECOMMEND",
    "recommendLabel": "推荐（有条件）",

    "opportunityScore": 72,                        // 0-100 综合机会分
    "scoreBreakdown": {
      "demand": 18,                                // 满分25（来自09雷达）
      "profitability": 16,                          // 满分20（来自能力4）
      "competition": 14,                            // 满分20（来自能力2，反向：竞争越强分越低）
      "differentiation": 14,                         // 满分15（来自能力5）
      "timing": 10,                                 // 满分10（来自能力3，时间窗口尚存）
      "riskPenalty": -5                              // 扣分项（来自能力6，风险过高扣分）
    },
    "confidence": 0.82,                             // Agent对自己判断的置信度
    "confidenceReasoning": "竞争格局和利润空间数据充分，但缺乏实际运营验证",

    "oneLineSummary": "成熟美甲贴片品类( Beauty>Nail Tips )，头部Cunegra占据低端但£7.99-9.99价格带存在结构性空白。\n推荐以'工具套装化'差异化切入，需严格控制PPC和库存周转。适合有供应链快反能力的卖家。",

    "decisionRationale": {
      "whyNotStronglyRecommend": "处于成熟衰退期(能力3)，非红利期；需满足4个前提条件(能力6)",
      "whyNotWatch": "价格空白明确(能力2)、差异化路径清晰(能力5)、盈亏平衡门槛低(能力4)",
      "whyNotAvoid": "需求确定性高(能力3)、供应链成熟(能力6)、无致命合规风险(能力6)",
      "keyTippingFactor": "£7.99-9.99价格带的空白是决定性因素——填补它就能建立可持续定位"
    },

    "actionPlan": {
      "priority": "P2",
      // P1(本周立即) / P2(本月) / P3(本季度) / P4(下季度)

      "phase1_research": {
        "name": "调研验证",
        "timeline": "第1周",
        "tasks": [
          "深挖£7.99-9.99价格带竞品（找具体空白点：哪些款式/功能缺失）",
          "联系2-3家美甲贴片供应商报价（确认£1.2-1.8成本可行性）",
          "调研套装组合的市场接受度（查看竞品是否有人在做类似尝试）"
        ],
        "deliverables": "《Nail Tips 入场可行性验证报告》",
        "goNoGoGate": "如果成本>£2.5或价格带已被填充 → 降级为WATCH"
      },

      "phase2_prototype": {
        "name": "产品设计",
        "timeline": "第2-3周",
        "tasks": [
          "确定套装组件清单和包装设计方案",
          "打样1-2个版本（不同配色/配置）",
          "拍摄产品图和制作A+ Content草稿"
        ],
        "deliverables": "实物样品 + Listing素材包"
      },

      "phase3_test": {
        "name": "小批量测品",
        "timeline": "第4-6周",
        "tasks": [
          "首批备货100-200件（严格控量）",
          "上架并开启PPC（预算£300-500/周）",
          "同步发布TikTok/Instagram内容（3-5条/周）",
          "监控核心指标（见下方keyMetricsToTrack）"
        ],
        "deliverables": "测品数据报告（第6周末review）",
        "successCriteria": "月销>80件 AND ACOS<30% AND 自然订单占比>15%"
      },

      "phase4_decision": {
        "name": "放量决策",
        "timeline": "第7周",
        "decisionMatrix": {
          "if_data_good": "放量至500-1000件/月，扩大PPC预算",
          "if_data_marginal": "优化Listing和PPC后再观察2周",
          "if_data_bad": "止损清仓，总结教训，转向下一个品线"
        }
      }
    },

    "notToDo": [
      "❌ 不要做纯色基础款（Cunegra已在£4.99-6.99做到极致，正面交锋必败）",
      "❌ 不要定价低于£5.99（会触发Cunegra价格战反制，见能力6风险#1）",
      "❌ 不要首批备货超过300件（库存周转风险，见能力6风险#2）",
      "❌ 不要忽视PPC预算（新品前30天自然订单可能<5%，见能力6风险#3）",
      "❌ 不要跳过供应商合规审核（化妆品法规不可儿戏，见能力6风险#4）"
    ],

    "keyMetricsToTrack": [
      {"metric": "BSR排名", "target": "进入前50000", "timeframe": "上线后30天", "owner": "运营"},
      {"metric": "自然订单占比", "target": ">30%", "timeframe": "上线后60天", "owner": "运营+内容"},
      {"metric": "ACOS", "target": "<25%", "timeframe": "持续监控", "owner": "广告"},
      {"metric": "退货率", "target": "<10%", "timeframe": "持续监控", "owner": "供应链"},
      {"metric": "转化率(CVR)", "target": ">12%", "timeframe": "上线后14天后", "owner": "Listing"}
    ]
  },

  "algorithmDocReferences": {
    "usedDocs": [
      "01-总体设计（8维评分框架）",
      "03-Agent深度分析（接口契约）",
      "08-品类原型（FP+TN原型匹配）",
      "09-蓝海V2（RED_SEAM定调+10维雷达）",
      "10-卖家画像（关注信号概念）",
      "11-差异化分析（5价格带+5切入点框架）",
      "12-爆发信号（4信号×3紧急度）",
      "13-跨站套利（待补充DE数据后激活）",
      "14-反馈闭环（本次裁决将写入guidance表供未来校验）",
      "15-问题清单（规避已知陷阱）"
    ],
    "methodologyNotes": "本分析遵循'算法是排序器不是守门员'(重要思想.md)、'百分位相对评分'(07文档)、'尝试优先不保守'(重要思想.md)三大原则"
  }
}
```

---

## 四、Agent 执行流程（v2.1 前端直连模式）

### 4.1 单次分析流程

```
┌─────────────────────────────────────────────────────────┐
│  ① 前端点击 [开始分析]                                   │
│     ├─ 调Java聚合接口 → 拿到batchId                     │
│     └─ 带batchId调Agent /selection/analyze (SSE)          │
│                                                         │
│  ② Agent 收到请求，建立SSE长连接                       │
│     │                                                   │
│     ▼                                                   │
│  ③ data_fetch: GET /aggregated-data?batchId=xxx         │
│     从Java拉取完整批次JSON                                │
│     → SSE: "数据加载完成，开始分析..."                  │
│     │                                                   │
│     ▼                                                   │
│  ④ 预处理                                               │
│     ├─ 解析品线数(N)、小类总数(M)                         │
│     ├─ 加载内置知识库（品类成本、原型映射、风险模板）       │
│     └─ 初始化结果容器 results[]                          │
│     → SSE: "预处理完成，共{N}个品线/{M}个小类"           │
│     │                                                   │
│     ▼                                                   │
│  ⑤ FOR EACH subCategory IN batch:                       │
│     │                                                   │
│     ├─ 能力1: 语义品类理解 ──→ prototype, consumerProfile │
│     ├─ 能力2: 竞争格局解剖 ──→ pattern, priceGap, CR3     │
│     ├─ 能力3: 生命周期判断 ──→ stage, explosionSignal    │
│     ├─ 能力4: 利润可行性推算 ──→ marginRange, breakEven   │
│     ├─ 能力5: 差异化切入点 ──→ angles[], recommended     │
│     ├─ 能力6: 风险雷达 ──→ risks[], goNoGo              │
│     ├─ 能力7: 跨品线关联 ──→ relatedCategories[]         │
│     ├─ 能力8: 最终裁决 ──→ recommendLevel, actionPlan    │
│     │                                                   │
│     └─ 每个能力完成 → SSE推送进度                       │
│        "Nail Tips: 能力3/8 完成 (生命周期=成长期)"       │
│     └─ 将结果 push 到 results[]                          │
│     │                                                   │
│     ▼                                                   │
│  ⑥ 全局后处理                                            │
│     ├─ 跨小类一致性检验                                    │
│     ├─ 品线级汇总                                          │
│     └─ 生成批次摘要                                       │
│     │                                                   │
│     ▼                                                   │
│  ⑦ POST /api/v1/product-line/analysis-results           │
│     回写全部结果到Java                                    │
│     → SSE: "分析完成，结果已保存"                       │
│     → SSE: 关闭连接                                     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Token消耗估算

| 步骤 | 每小类Token消耗 | 100个小类批次总计 | 说明 |
|------|---------------|-----------------|------|
| 能力1-4（结构化分析） | ~800 tokens | ~80K | 主要为输入数据 |
| 能力5（差异化生成） | ~1500 tokens | ~150K | 最耗token的步骤 |
| 能力6（风险分析） | ~1000 tokens | ~100K | |
| 能力7（关联发现） | ~600 tokens | ~60K | 依赖全局上下文 |
| 能力8（最终裁决） | ~1200 tokens | ~120K | 收敛所有前序输出 |
| **单小类合计** | **~5100 tokens** | **~510K** | |
| 系统开销（prompt模板等） | — | ~20K | 固定成本 |
| **总估算** | — | **~530K tokens/100小类** | |

### 4.3 性能优化策略

| 策略 | 说明 | Token节省 |
|------|------|----------|
| **按原型跳过无关维度**（08文档思想） | FP原型跳过"体积成本"分析（小件天然有利）；PS原型跳过"装饰价值" | **~15%** |
| **分批处理** | 先跑能力1-4做初筛，只对初筛RECOMMEND+以上的跑能力5-8 | **~40%**（假设50%被初筛淘汰） |
| **缓存品类理解** | 同一bsrId下的小类共享能力1的部分结果（消费者画像相似） | **~10%** |
| **结构化输出压缩** | 最终回写时去掉中间推理过程，只保留结论 | **~20%** |

---

## 五、反馈闭环机制（Agent自进化）

### 5.1 闭环设计（来自14文档）

```
                    ┌──────────────────────┐
                    │   Agent 第N次分析      │
                    │   recommendLevel=RECOMMEND │
                    │   opportunityScore=72  │
                    └──────────┬───────────┘
                               │ POST analysis-results
                               ▼
                    ┌──────────────────────┐
                    │   Java: 写入guidance表  │
                    │   推送给用户            │
                    └──────────┬───────────┘
                               │ 用户执行 + 反馈
                               ▼
                    ┌──────────────────────┐
                    │   验证结果（1个月后）    │
                    │   CONFIRMED / STABLE   │
                    │   / EXCEEDED / DISAPPOINTED │
                    └──────────┬───────────┘
                               │ GET verification API
                               ▼
                    ┌──────────────────────┐
                    │   Agent 第N+1次分析     │
                    │   读取上次预测 vs 实际   │
                    │   校准内部判断权重       │
                    │   调整阈值和偏见         │
                    └──────────────────────┘
```

### 5.2 Agent自学习方向

| 学习目标 | 方法 | 数据来源 |
|---------|------|---------|
| **机会分准确性** | 对比 predicted score vs actual performance | guidance表的verification结果 |
| **推荐等级召回率** | 统计 AVOID 中有多少后来表现好（漏网之鱼） | 历史批次回溯 |
| **风险预警命中率** | 统计标记的风险中有多少真的发生了 | 用户反馈/运营记录 |
| **品类原型匹配准确度** | 根据实际运营数据修正原型映射 | 多轮验证后的模式发现 |
| **成本估算偏差** | 对比 estimated margin vs actual margin | 用户提供的真实财务数据（可选） |

### 5.3 权重校准规则（来自14文档）

- 每次校准幅度 **±5%/维度** 为上限（防止过度拟合）
- 至少积累 **10个验证样本** 后才触发自动校准
- 校准记录写入 Agent 自身的版本日志（agent_version 字段递增）

---

## 六、能力-算法文档映射矩阵

| Agent能力 | 使用的算法文档 | 从文档中获得什么 |
|-----------|--------------|----------------|
| ①语义品类理解 | **08** 品类原型 | 6原型分类体系 + 52类目映射 + 权重偏置规则 |
| | **02** AI软评分 | 4软维度（情绪/装饰/裂变/文化）的定义方法 |
| | 重要思想 | "品类是分析单位"原则 |
| ②竞争格局解剖 | **11** 差异化分析 | 5价格带 + 5切入点 + Listing质量差距 |
| | **10** 卖家画像 | 卖家评分模型（用来评价竞争对手） |
| | **09** 蓝海V2 | 如果判定为蓝海→触发10维雷达 |
| ③生命周期判断 | **12** 爆发信号 | 4信号类型 × 3紧急度体系 |
| | **09** 蓝海V2 | 4机会分型（🌊🔥💎⏳）+ 10维雷达 |
| | **07** 动态基线 | 相对评分思维（不跟绝对值比） |
| ④利润可行性推算 | **01** 总体设计 | 利润率维度定义（原8维之一，权重20%） |
| | **15** 问题清单 | 已知陷阱（如德语Gramm解析失败影响重量计算） |
| ⑤差异化切入点 | **11** 差异化分析 | 5切入角度的完整框架 |
| | **09** 蓝海V2 | 测品推荐的方法论 |
| | **08** 品类原型 | 不同原型的差异化方向偏好（FP→设计 FH→性价比） |
| ⑥风险雷达 | **12** 爆发信号 | 信号即风险的前兆 |
| | **15** 问题清单 | P1-P11已知技术/业务风险 |
| | **01** 总体设计 | 决策模型的保守原则 |
| ⑦跨品线关联 | **13** 跨站套利 | UK↔DE套利发现方法论 |
| | **10** 卖家画像 | 关注信号追踪（多店铺同时进入=积极信号） |
| ⑧最终裁决 | **04** 决策模型 | 5维决策分（利润30/容量25/竞争20/裂变15/差异10） |
| | **14** 反馈闭环 | 验证→校准循环机制 |
| | **06** 系统集成 | 推荐等级与推送机制的对接 |

---

## 七、已知限制与未来扩展

### 7.1 当前不做（v1范围边界）

| 能力 | 原因 | 未来可能性 |
|------|------|-----------|
| ASIN级精准推荐 | 当前只推送到小类(nodeId)级别 | v2：在用户选定小类后，Agent进一步推荐具体ASIN |
| 实时价格监控 | 需要Amazon API对接 | v2：接入MWS/API监控竞品价格变动 |
| 供应链难度评估 | 需要真实的供应商数据库 | v2：接入1688/阿里巴巴API获取供货信息 |
| 评论情感分析 | 需要爬取Review数据 | v2：接入Review API做NLP情感分析 |
| 广告词竞争分析 | 需要第三方工具(如Helium10) | v2：对接PPC数据源做关键词难度评估 |
| 图片/视频AI分析 | 需要多模态LLM能力 | v2：用CLIP/GPT-4V分析主图质量和差异化 |

### 7.2 Agent技术栈建议（仅供参考，Java不关心）

| 层面 | 建议 | 理由 |
|------|------|------|
| LLM主体 | GPT-4o / Claude 3.5 Sonnet | 商业推理能力强，支持长上下文 |
| 结构化输出 | Function Calling / JSON Mode | 保证输出格式稳定 |
| 向量检索（可选） | Qdrant + CLIP embeddings | 用于跨品线语义相似度匹配 |
| 任务调度 | Python asyncio / Celery | 支持并发处理多个小类 |
| 配置管理 | YAML + 环境变量 | 分离提示词模板和运行参数 |

---

## 八、LangGraph 实现映射（独立项目 sijue-selection-agent）

> **本节说明**：选品Agent 作为独立项目 `sijue-selection-agent`（Python :8001），
> 参考 SuperMew RAG 的代码组织模式（不合并），以 **LangGraph StateGraph** 形式实现。
> 本节建立「功能能力 → 代码节点」的完整映射关系。
>
> **与SuperMew RAG的关系**：参考模式，不共享代码。可复制 SuperMew 的
> `graph.py`单例锁、`runner.py`降级模式、`.env`配置方式到新项目。

### 8.1 整体架构对照

```
本文档定义的8大能力          sijue-selection-agent 实现
─────────────────────        ──────────────────────────────────

能力① 语义品类理解   ──→    semantic_understanding_node.py
能力② 竞争格局解剖   ──→    competition_analysis_node.py
能力③ 生命周期判断   ──→    lifecycle_judgment_node.py
能力④ 利润可行性推算 ──→    profit_estimation_node.py
能力⑤ 差异化切入点   ──→    differentiation_node.py     ◄── 条件分支入口
能力⑥ 风险雷达       ──→    risk_radar_node.py
能力⑦ 跨品线关联     ──→    cross_line_discovery_node.py
能力⑧ 最终裁决       ──→    final_verdict_node.py

+ 基础设施层：
  state.py              ← SelectionState (TypedDict, ~25字段)
  graph.py              ← StateGraph 构建 (10节点 + 1条件边)
  runner.py             ← 同步/异步执行入口 + SSE推送
  java_client.py        ← HTTP客户端 (拉取Java聚合API + 回写结果)
  prompt_templates.py   ← 所有LLM提示词模板集中管理
  routers/selection.py  ← FastAPI路由端点 (SSE StreamingResponse)
```

### 8.2 逐节点详细映射

#### 节点0: `data_fetch_node` （数据获取）

**对应流程**：本文档 §四.1 的步骤 ①-②

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/data_fetch_node.py` |
| **输入** | SelectionState.batch_id, SelectionState.marketplace |
| **输出** | SelectionState.raw_data (完整聚合JSON), SelectionState.product_lines[] |
| **核心逻辑** | 1. 调用 `java_client.get_aggregated_data()` <br> 2. 解析JSON填充State <br> 3. 统计品线数/小类数 |
| **LLM调用** | 无（纯数据操作） |
| **错误处理** | Java API失败 → 返回降级状态 + 错误信息 |

---

#### 节点1: `semantic_understanding_node` （语义品类理解）

**对应能力**：本文档 §三.1 能力1 — 语义品类理解（Category Semantics）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/semantic_understanding_node.py` |
| **输入** | State.product_lines[i].node_name, node_full_path, bsr_id, sample_products[].title |
| **输出** | State.category_understanding (完整JSON, 见§1.5) |
| **使用的提示词** | `prompt_templates.SEMANTIC_UNDERSTANDING_PROMPT` |
| **LLM调用方式** | `model.invoke()` 或 `model.structured_output()` |
| **关键实现细节** | 1. 加载08文档的6原型体系作为system context <br> 2. 输入nodeName + fullPath + 3条title <br> 3. 要求输出结构化JSON（原型匹配+消费者画像+产品属性） |
| **复用RAG模式** | 参考 `agentic_rag/graph.py` 的 `_summarize_query` 节点模式 |

---

#### 节点2: `competition_analysis_node` （竞争格局解剖）

**对应能力**：本文档 §三.2 能力2 — 竞争格局解剖（Competition Anatomy）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/competition_analysis_node.py` |
| **输入** | top_brands[], sample_products[], avg_price/min/max, bs/amazon_choice_count |
| **输出** | State.competition_structure (完整JSON, 见§2.5) |
| **使用的提示词** | `prompt_templates.COMPETITION_ANALYSIS_PROMPT` |
| **前置依赖** | 节点1的 category_understanding.archetype_match（影响分析侧重点） |
| **关键实现细节** | 1. 注入11文档的5价格带体系 <br> 2. 计算CR3/HHI（可用Python直接算，不需LLM）<br> 3. LLM负责品牌定位解读和价格空白发现 |
| **混合计算** | 数值计算(CR3/HHI/价格带分布)用Python，解读性分析用LLM |

---

#### 节点3: `lifecycle_judgment_node` （生命周期判断）

**对应能力**：本文档 §三.3 能力3 — 生命周期阶段判断（Lifecycle Assessment）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/lifecycle_judgment_node.py` |
| **输入** | units_growth_rate, bsr_change_rate, avg_ratings, listing_age[], product_count |
| **输出** | State.lifecycle_stage (完整JSON, 见§3.5) |
| **使用的提示词** | `prompt_templates.LIFECYCLE_JUDGMENT_PROMPT` |
| **信号检测逻辑** | 1. Python规则引擎做初步信号分类(Speed/Density/Follow/Quality) <br> 2. LLM做阶段判定和证据链生成 <br> 3. 注入12文档的4信号×3紧急度体系 |
| **特殊输出** | explosion_signal (是否检测到爆发信号 → 影响最终裁决等级提升) |

---

#### 节点4: `profit_estimation_node` （利润可行性推算）

**对应能力**：本文档 §三.4 能力4 — 利润可行性推算（Profit Feasibility）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/profit_estimation_node.py` |
| **输入** | avg_price, bsr_id, shipping_profile(来自节点1), total_units |
| **输出** | State.profit_feasibility (完整JSON, 见§4.4) |
| **使用的提示词** | `prompt_templates.PROFIT_ESTIMATION_PROMPT` |
| **成本知识库** | 内置品类成本参照表（极轻小件/轻小件/中件/重件 四档参数） |
| **计算逻辑** | 1. 根据shipping_profile查成本表 <br> 2. Python计算悲观/典型/乐观三场景利润率 <br> 3. LLM评估风险因素和给出盈利模型裁决 |
| **条件分支触发** | **若 typical.margin >= 30% → 进入深度差异化分支(节点5full)** <br> **若 typical.margin < 30% → 进入快速建议分支(节点5quick)** |

---

#### 节点5: `differentiation_node` （差异化切入点）★条件分支

**对应能力**：本文档 §三.5 能力5 — 差异化切入点生成（Differentiation Strategy）

这是Selection Graph中**唯一的条件分支节点**：

```
                 profit_margin ≥ 30%
           ┌──────────────────────────┐
           │                          │
           ▼                          ▼
  differentiation_full          differentiation_quick
  (3个完整方案+推荐)            (1个快速建议)
           │                          │
           └──────────┬───────────────┘
                      ▼
               (合并后继续节点6)
```

| 项目 | full分支 | quick分支 |
|------|---------|----------|
| **触发条件** | profit_margin >= 30% | profit_margin < 30% |
| **文件** | `nodes/differentiation_full_node.py` | `nodes/differentiation_quick_node.py` |
| **输出方案数** | 3个完整方案(见§5.4 JSON) | 1个精简方案(仅angle+定价+执行难度) |
| **Token消耗** | ~1500 tokens | ~500 tokens |
| **使用场景** | 高利润品线值得深度思考 | 低利润品线快速给建议即可 |
| **提示词** | `DIFFERENTIATION_FULL_PROMPT` | `DIFFERENTIATION_QUICK_PROMPT` |

**路由函数** (`route_differentiation`):
```python
def route_differentiation(state: SelectionState) -> str:
    """根据利润率决定走哪个差异化分支"""
    margin = state.profit_feasibility["marginEstimate"]["typical"]["margin"]
    return "differentiation_full" if margin >= 30 else "differentiation_quick"
```

---

#### 节点6: `risk_radar_node` （风险雷达）

**对应能力**：本文档 §三.6 能力6 — 风险雷达（Risk Radar）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/risk_radar_node.py` |
| **输入** | 前面所有节点的输出（竞争格局+生命周期+利润+差异化） |
| **输出** | State.risk_radar (完整JSON, 见§6.3) |
| **使用的提示词** | `prompt_templates.RISK_RADAR_PROMPT` |
| **风险分类** | 6大类: SUPPLY_CHAIN / COMPETITION / OPERATION / COMPLIANCE / MARKET / FINANCIAL |
| **知识注入** | 15文档的P1-P11已知陷阱清单作为检查基准 |
| **特殊输出** | go_no_go_verdict (有条件通过/否决/观望的硬性判断) |

---

#### 节点7: `cross_line_discovery_node` （跨品线关联发现）

**对应能力**：本文档 §三.7 能力7 — 跨品线关联与套利发现（Cross-Line Intelligence）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/cross_line_discovery_node.py` |
| **输入** | 当前小类数据 + 同批次其他品线概览 + 可选DE站点数据 |
| **输出** | State.cross_line_insights (完整JSON, 见§7.3) |
| **使用的提示词** | `prompt_templates.CROSS_LINE_DISCOVERY_PROMPT` |
| **关联类型检测** | DIRECT_SUBSTITUTE / COMPLEMENTARY / UPSELL / CROSS_SELL / INPUT_SUPPLY |
| **跨站套利** | 当前版本标记为 `analyzed: false`（需要DE数据），预留扩展接口 |
| **性能优化** | 此节点可并行处理（不依赖前序节点的细粒度输出）|

---

#### 节点8: `final_verdict_node` （最终裁决）

**对应能力**：本文档 §三.8 能力8 — 最终裁决（Final Verdict）

| 项目 | 说明 |
|------|------|
| **文件路径** | `nodes/final_verdict_node.py` |
| **输入** | 节点1-7的全部输出（最复杂的输入） |
| **输出** | State.final_verdict (完整JSON, 见§8.3) |
| **使用的提示词** | `prompt_templates.FINAL_VERDICT_PROMPT` |
| **裁决等级** | STRONGLY_RECOMMEND / RECOMMEND / WATCH / AVOID |
| **评分公式** | opportunityScore = demand(25) + profitability(20) - competition(20) + differentiation(15) + timing(10) - risk_penalty |
| **必含内容** | one_line_summary + actionPlan(4阶段) + notToDo(禁忌清单) + keyMetricsToTrack |
| **算法引用** | 自动列出本次分析使用的所有算法文档编号 |

---

### 8.3 State 字段与能力输出的对应关系

```python
# selection/state.py (SelectionState TypedDict)

class SelectionState(TypedDict):
    # === 节点0: 数据获取 ===
    batch_id: str                           # 批次ID
    marketplace: str                         # 站点 (UK/DE/...)
    raw_data: Dict[str, Any]                # Java返回的原始聚合JSON
    product_lines: List[Dict]               # 解析后的品线列表
    
    # === 节点1: 能力1 语义理解 ===
    category_understanding: Dict            # ← §1.5 JSON
    current_archetype: str                  # 主原型代码 (FP/TN/...)
    
    # === 节点2: 能力2 竞争格局 ===
    competition_structure: Dict             # ← §2.5 JSON
    concentration_metrics: Dict             # CR3, HHI等
    
    # === 节点3: 能力3 生命周期 ===
    lifecycle_stage: Dict                   # ← §3.5 JSON
    explosion_detected: bool                # 是否检测到爆发信号
    
    # === 节点4: 能力4 利润推算 ===
    profit_feasibility: Dict                # ← §4.4 JSON
    profit_margin_typical: float            # 典型利润率（用于条件分支判断）
    
    # === 节点5: 能力5 差异化（二选一）===
    differentiation_result: Dict            # ← §5.4 JSON (full或quick版)
    
    # === 节点6: 能力6 风险雷达 ===
    risk_radar: Dict                        # ← §6.3 JSON
    go_no_go: str                           # GO/CONDITIONAL_GO/NO_GO/WAIT_AND_SEE
    
    # === 节点7: 能力7 跨品线 ===
    cross_line_insights: Dict               # ← §7.3 JSON
    
    # === 节点8: 能力8 最终裁决 ===
    final_verdict: Dict                     # ← §8.3 JSON
    recommend_level: str                    # 推荐等级
    opportunity_score: int                  # 机会分(0-100)
    
    # === 元数据 ===
    analysis_errors: List[str]              # 错误日志
    processing_time_ms: int                 # 处理耗时
    model_version: str                      # LLM版本信息
```

### 8.4 提示词模板索引

所有提示词集中在 `selection/prompt_templates.py`：

| 模板常量名 | 对应节点 | 核心内容 |
|-----------|---------|---------|
| `SEMANTIC_UNDERSTANDING_PROMPT` | 节点1 | 6原型体系 + 消费者画像推理指令 |
| `COMPETITION_ANALYSIS_PROMPT` | 节点2 | 5价格带 + CR3/HHI计算框架 + 品牌定位解读 |
| `LIFECYCLE_JUDGMENT_PROMPT` | 节点3 | 4信号×3紧急度 + 6阶段枚举 + 证据链要求 |
| `PROFIT_ESTIMATION_PROMPT` | 节点4 | 4档成本表 + 三场景估算 + 盈亏平衡公式 |
| `DIFFERENTIATION_FULL_PROMPT` | 节点5-full | 5切入角度框架 + 完整方案JSON Schema |
| `DIFFERENTIATION_QUICK_PROMPT` | 节点5-quick | 精简版切入点 + 快速评估维度 |
| `RISK_RADAR_PROMPT` | 节点6 | 6类风险 + 严重度/概率评分 + 缓解措施 |
| `CROSS_LINE_DISCOVERY_PROMPT` | 节点7 | 5种关联类型 + 捆绑机会识别 |
| `FINAL_VERDICT_PROMPT` | 节点8 | 4级裁决体系 + 评分公式 + 行动计划模板 |

### 8.5 图结构与条件边

```python
# selection/graph.py (伪代码)

from langgraph.graph import StateGraph, END

graph = StateGraph(SelectionState)

# 添加节点
graph.add_node("data_fetch", data_fetch_node)
graph.add_node("semantic_understanding", semantic_understanding_node)
graph.add_node("competition_analysis", competition_analysis_node)
graph.add_node("lifecycle_judgment", lifecycle_judgment_node)
graph.add_node("profit_estimation", profit_estimation_node)
graph.add_node("differentiation_full", differentiation_full_node)
graph.add_node("differentiation_quick", differentiation_quick_node)
graph.add_node("risk_radar", risk_radar_node)
graph.add_node("cross_line_discovery", cross_line_discovery_node)
graph.add_node("final_verdict", final_verdict_node)

# 设置边（线性流）
graph.set_entry_point("data_fetch")
graph.add_edge("data_fetch", "semantic_understanding")
graph.add_edge("semantic_understanding", "competition_analysis")
graph.add_edge("competition_analysis", "lifecycle_judgment")
graph.add_edge("lifecycle_judgment", "profit_estimation")

# ★ 唯一的条件边：根据利润率选择差异化深度 ★
graph.add_conditional_edges(
    "profit_estimation",
    route_differentiation,                    # 路由函数
    {
        "differentiation_full": "differentiation_full",
        "differentiation_quick": "differentiation_quick"
    }
)

# 两个分支汇合后继续
graph.add_edge("differentiation_full", "risk_radar")
graph.add_edge("differentiation_quick", "risk_radar")
graph.add_edge("risk_radar", "cross_line_discovery")
graph.add_edge("cross_line_discovery", "final_verdict")
graph.add_edge("final_verdict", END)

# 编译图
selection_graph = graph.compile()
```

### 8.6 与现有RAG Graph的对比

| 维度 | RAG Graph (已有) | Selection Graph (新建) |
|------|-----------------|----------------------|
| **节点数量** | 18个 | 10个（含data_fetch） |
| **条件边数量** | 6个 | 1个 |
| **主要用途** | 问答式知识检索 | 批量品线分析 |
| **输入来源** | 用户自然语言查询 | 前端触发 + 主动拉取Java数据 |
| **输出形式** | 自然语言答案 + 来源引用 | 结构化JSON + SSE实时进度 |
| **状态复杂度** | ~50字段 (AgenticRAGState) | ~25字段 (SelectionState) |
| **LLM调用次数/次** | 3-5次 (检索+重排+生成) | 8-9次 (每个能力一次) |
| **向量库使用** | ✅ Milvus检索 | ❌ 不需要 |
| **并发模式** | 单用户会话 | 可并发多小类 |
| **项目归属** | SuperMew RAG (现有) | sijue-selection-agent (新建独立项目) |

### 8.7 实现优先级与文件创建顺序

参考 §8.2 节点映射的优先级定义：

**P0 - 核心骨架（必须首先完成）：**
1. ⬜ `state.py` — SelectionState 定义
2. ⬜ `graph.py` — StateGraph 构建与编译
3. ⬜ `runner.py` — 执行入口 (sync/async) + SSE进度推送
4. ⬜ `java_client.py` — Java API HTTP客户端 (GET拉取 + POST回写)

**P1 - 8个能力节点（核心逻辑）：**
5. ⬜ `nodes/data_fetch_node.py`
6. ⬜ `nodes/semantic_understanding_node.py`
7. ⬜ `nodes/competition_analysis_node.py`
8. ⬜ `nodes/lifecycle_judgment_node.py`
9. ⬜ `nodes/profit_estimation_node.py`
10. ⬜ `nodes/differentiation_full_node.py`
11. ⬜ `nodes/differentiation_quick_node.py`
12. ⬜ `nodes/risk_radar_node.py`
13. ⬜ `nodes/cross_line_discovery_node.py`
14. ⬜ `nodes/final_verdict_node.py`

**P2 - 提示词与集成：**
15. ⬜ `prompt_templates.py` — 9个提示词模板
16. ⬜ `routers/selection.py` — FastAPI路由端点 (SSE StreamingResponse)
17. ⬜ `main.py` — 应用入口 + 路由注册

**P3 - 测试与优化：**
18. ⬜ 单元测试 (tests/test_selection_nodes.py)
19. ⬜ 集成测试 (tests/test_selection_graph_e2e.py)
20. ⬜ 性能优化 (批量并发、Token缓存、SSE心跳)

---

### 8.8 关键实现注意事项

1. **单例锁机制**：参考 RAG Graph 的 `threading.Lock()` 模式，确保全局只有一个编译好的图实例
2. **懒加载**：节点函数采用懒导入（如 RAG Graph 所示），避免循环依赖
3. **错误降级**：任何节点失败不应阻断整个流程，应写入 `analysis_errors` 并继续后续节点
4. **Token监控**：在 runner.py 中记录每步 Token 消耗，便于成本核算和优化
5. **结构化输出**：优先使用 LLM 的 `structured_output` / `json_mode` 功能，减少解析失败率
6. **Java API超时**：java_client 需设置合理超时（建议30s），避免阻塞整个图执行

---

> **文档版本历史**：
> - v1: 初始版本（8大能力定义）
> - v2: 补充完整JSON Schema、Nail Tips实例、算法文档映射矩阵
> - **v2.1**: 架构升级为三项目解耦模式（Java+独立Agent+Vue前端），新增data_fetch节点、SSE实时进度、前端直连调度
