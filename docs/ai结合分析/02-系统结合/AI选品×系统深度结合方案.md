# AI 选品 × 系统深度结合方案

> 本文档不是抽象的AI设计，而是逐一对应系统现有的每个环节，
> 说明AI如何嵌入现有流程，不替代、不重写，只增强。

> **本文档定位**：AI与现有系统的对接设计（嵌入点、数据流、字段、优先级）。  
> 品类分析的方法论原理见 `01-品类分析/AI选品系统-设计思考.md`，本文档不重复方法。  
> 反馈闭环、三来源策略、历史智能见同目录《AI选品×系统深度结合-第二卷.md》。

---

## 一、系统现有全貌（先看清楚再设计）

### 1.1 两条并行的数据管道

```
管道A：ASIN导入 → 竞品池 (Java后端)
═══════════════════════════════════════════
AsinImport页面(4步)
  → 上传八爪鱼Excel
  → InitialFilter(价格4.99-19.99/评论≤5/去重) → ~800个PASS
  → 调卖家精灵API(40个/批,异步)
  → CompetitorFilter(模式一硬条件+模式二软条件) → ~300个PASS
  → ScoringService评分 → S/A/B/C/D
  → 数据落入 competitor_products 表
  
管道B：Excel导入 → 选品池 (Python后端)
═══════════════════════════════════════════
AllSelection页面(3个tab)
  → Excel导入(三种类型: new新品榜 / reference竞品店铺 / zheng整店)
  → ScoringEngine评分 → S/A/B/C/D
  → 数据落入 selection_products 表
  → 用户手动选 → 推入 final_drafts → 生产
```

### 1.2 四个核心数据表

| 表 | 后端 | 角色 | 关键字段 |
|----|------|------|---------|
| `competitor_products` | Java | 竞品池（原始大数据池） | filter_mode, score, grade, node_label_path, brand, seller_name, seller_nation, fba/fbm |
| `selection_products` | Python | 选品池（用户筛选后的候选） | product_type(new/reference/zheng), score, grade, main_category_name, source |
| `final_drafts` | Python | 终稿池（确定要做的） | product_id, status |
| `skip_asins` | Java | 淘汰黑名单（被精筛淘汰的） | asin, filter_reasons |

### 1.3 前端页面与用户动线

```
用户动线:
  
  AsinImport页面 ──(管道A)──→ competitor_products(竞品池,~300个)
       │                          │
       │                          │ (用户挑选)
       │                          ↓
  AllSelection页面 ──(管道B)──→ selection_products(选品池,~30-80个)
   (3个tab: 新品榜/竞品店铺/总选品)
       │
       │ (用户挑选)
       ↓
  FinalDraft页面 ──→ final_drafts(终稿池,~5-15个)
       │
       ↓
     生产
```

### 1.4 当前评分体系

**ScoringEngine（Python）对selection_products评分：**
- 维度：listing_age(上架天数)、sales_volume(销量)、bsr_rank(BSR排名)、price(价格)
- 权重可配置（存在scoring_config表）
- 特殊规则：FBM直接100分S级
- 等级：S(≥90) / A(≥80) / B(≥65) / C(≥50) / D(<50)
- 周标记：is_current=1标记本周数据，week_tag标记ISO周

**ScoringService（Java）对competitor_products评分：**
- 逻辑基本一致
- 额外支持"一键重新评分"

### 1.5 关键事实

- **两条管道数据不完全互通**：管道A的数据(competitor_products)和管道B的数据(selection_products)是不同的表，有各自的后端管理
- **选品池来源多元**：selection_products不仅来自竞品池，还有大量直接Excel导入的数据（新品榜/竞品店铺/整店）
- **品类信息差异**：competitor_products有详细的`node_label_path`（三级品类路径），selection_products只有`main_category_name`（大类榜单名）
- **评分是产品级的**：当前评分只考虑单个产品的数值指标，完全不知道品类环境
- **用户操作全靠手动**：从300个竞品中挑选、从选品池中挑选、推入终稿，全部手动

---

## 二、AI嵌入点总图

```
┌────────────────────────────────────────────────────────────────┐
│                     系统现有流程 × AI嵌入点                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  AsinImport页面                                                │
│  ┌──────────────────┐                                          │
│  │ ① 上传前预分析   │ ← AI: 快速预览Excel数据分布              │
│  │   (新增按钮)      │    品类分布/价格分布/去重后数量预估       │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ② 初筛参数建议   │ ← AI: 根据历史选品结果动态建议阈值       │
│  │   (增强现有面板)  │    "上次price_max=25的通过率只有12%"      │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ③ 初筛+API+精筛  │ (现有流程不变)                           │
│  │   (不改)          │                                          │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ④ 品类级深度分析 │ ← AI核心: 六层品类分析                   │
│  │   (新增面板/报告) │    品类评级+价格带+卖家力量+风险         │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ⑤ AI推荐选品     │ ← AI: 从竞品池推荐Top30到选品池          │
│  │   (新增按钮)      │    带品类评分+机会模式+推荐理由           │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  AllSelection页面 (3个tab)                                     │
│  ┌──────────────────┐                                          │
│  │ ⑥ 品类评级列     │ ← AI: 在列表中增加品类评级标签            │
│  │   (增强现有列表)  │    "Kitchen>Small Appliances: ★★★★推荐"  │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ⑦ 品类视角切换   │ ← AI: 新增"品类视图"tab                  │
│  │   (新增视图)      │    先选品类，再看品类内的产品             │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
│  ┌──────────────────┐                                          │
│  │ ⑧ 用户偏好学习   │ ← AI: 记录用户"选/不选"行为              │
│  │   (后台静默运行)  │    逐渐学习偏好，优化推荐                 │
│  └────────┬─────────┘                                          │
│           ↓                                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FinalDraft页面                                                │
│  ┌──────────────────┐                                          │
│  │ ⑨ 终稿风险审查   │ ← AI: 推入终稿前做一次风险扫描           │
│  │   (新增确认步骤)  │    季节性/合规/供应链风险提醒             │
│  └──────────────────┘                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 三、各嵌入点深度设计

### ① 上传前预分析（AsinImport页面新增按钮）

**现状**：用户上传Excel后，只看到"总行数5000，初筛后800个PASS"，不知道数据长什么样就点了"开始API调用"。

**AI增强**：上传Excel后、点"开始"前，增加一个**"数据预览"按钮**。

**做的事情**：
```
用户点击"数据预览"
  ↓
后端快速扫描Excel数据（不调API，纯本地分析）
  ↓
输出：
  - ASIN总数 / 去重后数量 / 已在竞品池数量 / 已在黑名单数量
  - 价格分布直方图（min/p25/median/p75/max）
  - 预估通过率（基于历史数据的初筛阈值匹配率）
  - 品类分布预估（如果Excel有品类列的话）
  - 建议：
    "本批数据有2340个ASIN已在竞品池中，建议去重后实际调用约2660个"
    "价格中位数£12.5，80%的产品在£5-25区间"
    "预估初筛通过率约35%（约930个），建议确认是否继续"
```

**价值**：避免用户盲目调用API浪费配额。如果数据质量差，可以提前调整或换数据源。

**技术**：纯前端+Python脚本，不需要LLM，秒级响应。

### ② 初筛参数智能建议（增强FilterConfigPanel）

**现状**：FilterConfigPanel有固定的阈值（priceMin=4.99, priceMax=19.99, reviewMax=5），用户手动调。

**AI增强**：在FilterConfigPanel旁边加一个**"AI建议"按钮**。

**做的事情**：
```
用户点击"AI建议"
  ↓
后端分析：
  1. 历史选品结果：过去3个月，从competitor_products进入selection_products的产品特征
     - 最终被选入final_drafts的产品，初筛时的价格/评论分布
     - 被精筛淘汰的产品，有多少后来被证明"其实可以做"
  2. 当前数据分布：本次上传的Excel数据的价格/评论分布
  3. 品类特征：如果数据品类集中，根据品类特点建议阈值
  
输出：
  "基于历史数据建议：
   - 价格上限建议调至£25（历史选品中23%的终稿产品价格在£20-25）
   - 评论数上限建议调至10（历史选品中15%的终稿产品评论在5-10之间）
   - 预计调整后通过率：45%（当前设置35%）
   - 预计多获取约270个候选产品"
```

**价值**：让阈值不再凭感觉设，而是有数据支撑。特别是新用户不知道怎么设阈值时非常有用。

**技术**：SQL查历史数据+Python统计，不需要LLM。但**解释建议理由**可以用LLM（1次调用）。

### ③ 初筛+API+精筛（不改）

现有流程已经很成熟，不需要AI介入。保持原样。

### ④ 品类级深度分析（核心新增）

**现状**：精筛后300个产品，每个有score和grade，但用户不知道这300个产品分布在哪些品类、哪些品类好做。

**AI增强**：精筛完成后，自动（或手动触发）运行品类分析。

**与现有数据的具体结合**：

```
数据来源：competitor_products表中当前month的MODE1+MODE2产品

品类聚合SQL（利用现有的node_label_path字段）：
  SELECT 
    SUBSTRING_INDEX(node_label_path, ':', 2) AS category,  -- 取前两级
    COUNT(DISTINCT parent_asin) AS product_count,
    COUNT(DISTINCT seller_name) AS seller_count,
    COUNT(DISTINCT brand) AS brand_count,
    AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price,
    AVG(units) AS avg_sales, SUM(CASE WHEN units > 100 THEN 1 ELSE 0 END) AS high_sales_count,
    AVG(bsr) AS avg_bsr,
    AVG(ratings) AS avg_ratings,
    AVG(DATEDIFF(NOW(), available_date)) AS avg_listing_days,
    SUM(CASE WHEN seller_nation = 'CN' THEN 1 ELSE 0 END) AS cn_count,
    SUM(CASE WHEN fulfillment = 'FBA' THEN 1 ELSE 0 END) AS fba_count,
    SUM(CASE WHEN fulfillment = 'FBM' THEN 1 ELSE 0 END) AS fbm_count,
    SUM(CASE WHEN grade IN ('S','A') THEN 1 ELSE 0 END) AS high_grade_count,
    SUM(CASE WHEN ebc = 1 THEN 1 ELSE 0 END) AS ebc_count,
    SUM(CASE WHEN video = 1 THEN 1 ELSE 0 END) AS video_count
  FROM competitor_products
  WHERE marketplace = 'UK' AND month = '202606'
    AND filter_mode IN ('MODE1', 'MODE2')
  GROUP BY category
  HAVING product_count >= 3
  ORDER BY product_count DESC

→ 输出20-50个品类，每个品类有17个统计字段
```

**品类指标计算（Python，利用现有字段）**：

```python
# 直接利用competitor_products的现有字段
brand_concentration = brand_count / product_count  # 品牌数/品数
cn_ratio = cn_count / seller_count                  # CN卖家比
review_barrier = avg_ratings                         # 评论壁垒
market_activity = high_sales_count / product_count   # 市场活跃度
price_spread = (max_price - min_price) / avg_price   # 价格带宽
freshness = 1 - min(avg_listing_days / 365, 1)       # 新鲜度
listing_quality = (ebc_count + video_count) / (product_count * 2)  # 运营水平

# 品类综合分（规则引擎，不需要LLM）
category_score = (
    (brand_concentration > 0.7) * 15 +    # 品牌分散 → 好进入
    (cn_ratio < 0.4) * 15 +                # 不内卷
    (avg_ratings < 80) * 15 +              # 低评论壁垒
    (market_activity > 0.2) * 15 +         # 市场活跃
    (price_spread > 0.8) * 10 +            # 价格带宽
    (freshness > 0.5) * 15 +              # 新品能活
    (listing_quality < 0.4) * 15           # 对手弱
)
# 满分100，和现有产品的score体系对齐
```

**品类评级输出（与现有grade体系对齐）**：
```
品类评分 → 品类评级
≥ 80 → A级（强烈推荐）
≥ 65 → B级（推荐）
≥ 50 → C级（中性）
< 50 → D级（不推荐）
```

**品类评级反写到competitor_products**：
```sql
-- 每个产品继承其所属品类的评级
UPDATE competitor_products cp
JOIN category_ratings cr 
  ON SUBSTRING_INDEX(cp.node_label_path, ':', 2) = cr.category
SET cp.category_rating = cr.recommendation,
    cp.category_score = cr.score
WHERE cp.marketplace = 'UK' AND cp.month = '202606'
```

**价值**：从此每个产品不仅有自身的score/grade，还有所属品类的评级。一个A级产品如果在一个D级品类里，说明"产品数据好但品类环境差"。

### ⑤ AI推荐选品（竞品池→选品池的AI桥梁）

**现状**：用户手动浏览300个竞品，凭经验挑选。这是整个流程中**最耗时、最依赖经验**的环节。

**AI增强**：在AsinImport页面的"完成"状态，新增**"AI推荐选品"按钮**。

**做的事情**：
```
用户点击"AI推荐选品"
  ↓
Step 1：品类分析（步骤④，如果还没做过）
  ↓
Step 2：在推荐品类（A/B级品类）内，识别机会产品
  ↓
  6种模式匹配（利用competitor_products现有字段）：
  
  快速起量: listing_days < 60 AND bsr < 2000
  低配高卖: ebc = 0 AND video = 0 AND ratings < 50 AND units > 50
  FBM可行:  fulfillment = 'FBM' AND units > 30
  高溢价:   price > (品类均价 × 1.4) AND units > 20
  评分洼地: rating < 4.0 AND units > 30
  无品牌:   (brand IS NULL OR brand = '' OR brand = 'unbranded')
  
  ↓
Step 3：组合最终排序
  ↓
  final_score = product_score × 0.6 + category_score × 0.4
  
  排序后取Top 30
  ↓
Step 4：写入 ai_recommend_log 新表（v2 方案，**不写入 selection_products**）
  ↓
  用户到AllSelection页面，后端 JOIN ai_recommend_log 自动展示"🤖 AI 推荐"标记
  可以通过 ai_recommend_log.status 或 recommend_batch 过滤
```

**与 selection_products 的对接**（v2）：
- **不写入** `selection_products`（避免污染主表）
- AI 推荐结果写入 `ai_recommend_log` 新表
- 字段：`asin, recommend_batch, final_score, category_rating, opportunity_patterns, ai_reason, status`
- 用户在 AllSelection 看到的是"普通产品 + 🤖 AI 推荐徽章 + 悬浮显示推荐理由"
- 用户点击"采纳"→ 在 `selection_products` 中创建对应记录（沿用现有选择流程）
- 同一 ASIN 可被多次推荐，状态在 `ai_recommend_log` 累积

**价值**：用户从"翻300个产品"变成"看AI推荐的30个"。决策时间从30分钟降到5分钟。

### ⑥ 品类评级列（增强AllSelection列表）

**现状**：AllSelection列表显示产品的score、grade、main_category_name。但品类只是一个名字，用户不知道这个品类好不好。

**AI增强**：在列表中增加品类评级展示（**通过 JOIN，不改表结构**）。

```
现有列表列: 图片 | ASIN | 标题 | 价格 | 销量 | 评分 | 等级 | 品类名
增加后:     图片 | ASIN | 标题 | 价格 | 销量 | 评分 | 等级 | 品类名[品类评级] [🤖 AI推荐]

品类名后面追加品类评级标签：
  Kitchen & Dining ★★★★ → A级推荐品类
  Phone Accessories ★★   → C级中性品类
  Clothing ★              → D级不推荐品类

AI推荐徽章（来自 ai_recommend_log JOIN）：
  🤖 AI 推荐 [final_score=85] (悬浮显示 ai_reason)
```

**技术**（v2 方案）：
- **不修改** `selection_products` 表结构
- 后端 `selection.py` 列表查询 `LEFT JOIN ai_recommend_log ON asin`
- 同时 `LEFT JOIN category_ratings ON category_l1:l2`
- 前端列表渲染时追加两个标签：品类评级 + AI 推荐徽章

### ⑦ 品类视角切换（AllSelection新增视图）

**现状**：用户看到的是一个扁平的产品列表，只能按产品维度浏览。

**AI增强**：新增"品类视图"模式。

```
产品视图（现有）:  产品1 → 产品2 → 产品3 → ... → 产品300
品类视图（新增）:  
  Kitchen & Dining (A级, 28个产品)
    └─ 产品A1 (score:92, 快速起量)
    └─ 产品A2 (score:85, 低配高卖)
    └─ ...
  Pet Supplies (B级, 15个产品)
    └─ 产品B1 (score:88)
    └─ ...
  Phone Accessories (C级, 45个产品)
    └─ ...
```

**价值**：用户先决定"做哪个品类"，再在品类内挑选具体产品。这和人类选品的真实思维一致。

**前端实现思路**：
- 在AllSelection页面增加一个"品类视图/产品视图"切换
- 品类视图下，先展示品类卡片（品类名+评级+关键指标+产品数）
- 点击品类卡片展开，显示品类内的产品列表
- 品类内的产品按final_score排序

### ⑧ 用户偏好学习（后台静默运行）

**现状**：系统不知道用户喜欢什么品类的产品，每次推荐都是"冷启动"。

**AI增强**：记录用户在选品池中的行为，学习偏好。

**记录什么**：
```
用户行为记录表 (user_selection_behavior):
  - user_id
  - asin
  - action: 'viewed' / 'added_to_selection' / 'added_to_final' / 'deleted' / 'skipped'
  - product_category (产品所属品类)
  - product_grade (产品评级)
  - product_price (产品价格)
  - timestamp
```

**学习什么**：
```
经过3-5次选品周期后，可以分析：
  - 用户偏好品类：用户总是选Kitchen & Dining的产品 → 偏好此品类
  - 用户偏好价格带：用户从不选£5以下的产品 → 低价格不感兴趣
  - 用户偏好模式：用户总是选"快速起量"类型的产品 → 偏好确定性高的
  - 用户风险偏好：用户从不选D级品类的产品 → 风险厌恶型
```

**如何影响推荐**：
```
next_recommendation_score = 
  base_score × 0.5 +
  category_match_score × 0.3 +   # 品类偏好匹配度
  pattern_match_score × 0.2      # 模式偏好匹配度
```

**价值**：推荐越来越精准，3个月后AI推荐的产品命中率可能从30%提升到70%。

### ⑨ 终稿风险审查（FinalDraft新增确认步骤）

**现状**：用户把产品推入终稿后直接进入生产，没有风险检查环节。

**AI增强**：推入终稿时，自动进行风险扫描。

```
用户点击"推入终稿"
  ↓
AI风险扫描（利用品类分析中已有的风险数据）：
  - 季节性风险：该品类是否有季节性？当前是否是备货期？
  - 合规风险：品类是否需要认证？
  - 竞争风险：品类内是否有强势卖家？
  - 侵权风险：品类/品牌是否涉及IP？
  - 历史风险：该品类在历史选品中的表现如何？
  ↓
弹出确认框：
  "⚠️ 风险提醒：
   - Kitchen & Dining品类当前处于旺季末期，建议确认备货时机
   - 该品类有2个产品涉及品牌擦边风险
   是否仍要推入终稿？"
```

---

## 四、数据流闭环

### 4.1 AI推荐如何连接两条管道

> **关键设计调整（v2）**：原方案试图给 `selection_products` 扩 4 个字段。  
> **新方案**：**`selection_products` 不扩字段**。AI 推荐结果写入新建的轻量表 `ai_recommend_log`，前端通过关联查询展示。  
> 原因：
> - `selection_products` 是 Python 端用户选品结果表，扩字段会污染主表语义
> - 该表缺 `node_label_path/brand/seller_name/ebc/video`，AI 维度无法直接落表
> - AI 推荐是**瞬时事件**，不应与用户的选品结果长期共存

```
管道A (Java)                    AI分析层                    跨服务                      管道B (Python)
─────────────                   ──────────                  ──────                      ──────────────

competitor_products
  │
  │ 品类聚合(SQL)
  │ 指标计算(Python)
  │ 机会识别(Python)
  │ LLM评估(1-2次)
  │
  ↓
  品类评级 + 机会产品
  │
  │ 写入 competitor_products 新字段
  │ (category_score/category_rating/opportunity_patterns/final_score)
  │
  ↓
  ┌────────────────────────────────────────┐
  │ ai_recommend_log（新表）                 │
  │ 推荐批次(asin, marketplace, month,      │
  │   final_score, category_rating,         │
  │   opportunity_patterns, ai_reason)      │
  └────────────────────────────────────────┘
       │
       │ 用户在 AllSelection 通过 source 过滤查看
       │ （或后端 JOIN 展示）
       ↓
                                  selection_products
                                    -- 主表不变
                                    -- AI 推荐通过 ai_recommend_log 关联展示
```

### 4.2 新字段设计（只扩展 competitor_products，不动 selection_products）

**competitor_products 新增字段**（与现有 entity 对齐，参考 `entity/CompetitorProduct.java:11`）：
```
category_score        DECIMAL(5,2)  -- 品类评分(0-100)
category_rating       VARCHAR(1)    -- 品类评级(A/B/C/D)
opportunity_patterns  JSON          -- 匹配的机会模式 ["快速起量","低配高卖"]
final_score           DECIMAL(5,2)  -- 最终分 = 产品分×0.6 + 品类分×0.4
```

**`selection_products` 不增字段**。原方案中 4 个字段（`category_score/category_rating/opportunity_patterns/ai_recommendation/ai_reason`）取消。

> **为什么不用 ai_recommendation 字段**：
> - 与现有 `grade` (S/A/B/C/D) 体系重叠
> - 复用 `final_score` + `grade` 即可表达推荐度
> - 推荐理由放在 `ai_recommend_log` 中更易追溯

### 4.3 品类评级表（新建，但很轻量）

```
category_ratings
  id, marketplace, data_month,
  category_l1, category_l2, category_l3  -- 与 competitor_products.node_label_path 对齐
  product_count, seller_count, brand_count,
  -- 17个统计字段（与 competitor_products 字段一一对应）--
  -- 7个指标字段 --
  score, rating, reason,
  risk_tags JSON,
  price_band_map JSON,
  analyzed_at
```

每月每站点约 30-50 条记录，一年不到 1000 条，非常轻量。

### 4.4 AI 推荐记录表（新表，替代给 selection_products 扩字段）

```
ai_recommend_log
  id, marketplace, data_month, recommend_batch,  -- 批次标识（如 ai_recommend_202606）
  asin,                                          -- 推荐的产品 ASIN
  final_score,                                   -- 排序分
  category_rating,                               -- 所属品类评级
  opportunity_patterns JSON,                      -- 机会模式
  ai_reason TEXT,                                -- AI 推荐理由
  ai_risk TEXT,                                  -- AI 风险提示
  status VARCHAR(20) DEFAULT 'pending',          -- pending/viewed/accepted/rejected
  created_at, created_by
```

> **用途**：
> - 前端 AllSelection 通过 `JOIN ai_recommend_log ON asin` 展示 AI 推荐标记（不修改主表）
> - 同一 ASIN 可被多次推荐（不同月份），用 `data_month` 区分
> - `status` 字段记录用户后续行为（采纳/拒绝/忽略），可累积为偏好数据

---

## 五、实施优先级

### P0（立即做，价值最大）

| 序号 | 嵌入点 | 改动范围 | 预期效果 |
|------|--------|---------|---------|
| 1 | ④品类级深度分析 | Python新增品类分析服务 + competitor_products加4个字段（Java端迁移脚本） + category_ratings新表 | 从"看300个产品"变成"看20个品类" |
| 2 | ⑤AI推荐选品 | Python新增推荐逻辑 + 写入 ai_recommend_log 新表 + AllSelection前端 JOIN 展示 | 直接输出 Top30 候选，**不污染 selection_products** |
| 0 | 扩展 LLM 文本能力 | `tencent_llm_vision_service.py` 新增 `analyze_text()` 方法 | P0/P1 的 AI 功能前置条件 |

### P1（第二批，增强体验）

| 序号 | 嵌入点 | 改动范围 | 预期效果 |
|------|--------|---------|---------|
| 3 | ⑥品类评级列 | AllSelection 列表增加列（JOIN ai_recommend_log + category_ratings） | 浏览时直观看到品类环境 |
| 4 | ⑦品类视角切换 | AllSelection 前端新增视图 | 先选品类再选产品 |

### P2（第三批，长期价值）

| 序号 | 嵌入点 | 改动范围 | 预期效果 |
|------|--------|---------|---------|
| 5 | ①上传前预分析 | AsinImport 页面新增按钮 | 避免浪费 API 配额 |
| 6 | ②初筛参数建议 | FilterConfigPanel 增强 | 阈值不再凭感觉 |
| 7 | ⑧用户偏好学习 | ai_recommend_log.status 累积 + 偏好模型 | 推荐越来越准 |
| 8 | ⑨终稿风险审查 | FinalDraft 页面新增确认 | 减少踩坑 |

---

## 六、与现有评分体系的关系

### 不是替代，是叠加

```
现有评分（产品级）:  score = f(listing_age, sales_volume, bsr_rank, price)
                     → 只看产品自己的数值

AI品类评分（品类级）: category_score = f(7个品类指标)
                     → 看产品所在的品类环境

最终排序:            final_score = score × 0.6 + category_score × 0.4
                     → 产品好 + 品类好 = 真正值得做
```

### 具体场景

```
场景1: 产品score=92(S级) + 品类rating=D级
  → final_score = 92×0.6 + 35×0.4 = 55.2+14 = 69.2
  → 产品数据很好但品类很差（比如红海手机壳里的一个爆款）
  → AI建议: "产品本身数据出色，但品类竞争烈度极高，谨慎进入"

场景2: 产品score=65(C级) + 品类rating=A级
  → final_score = 65×0.6 + 85×0.4 = 39+34 = 73
  → 产品数据一般但品类环境很好
  → AI建议: "产品目前数据平平，但所在品类竞争低、新品活跃，值得观察"

场景3: 产品score=80(A级) + 品类rating=A级
  → final_score = 80×0.6 + 85×0.4 = 48+34 = 82
  → 产品和品类都好
  → AI建议: "强烈推荐"
```

### FBM特殊规则保持不变

现有规则"FBM直接100分S级"不变。但品类分析可以额外标注：
- FBM产品如果在一个FBM占比>50%的品类里 → "FBM友好品类，物流成本低"
- FBM产品如果在一个FBM占比<10%的品类里 → "品类以FBA为主，FBM可能是差异化策略"

---

## 七、关键约束与决策

### 7.1 品类分析的数据源选择

**决策：以competitor_products为主数据源**

理由：
- competitor_products有完整的node_label_path（三级品类），可以做精确品类聚合
- selection_products只有main_category_name（大类），品类粒度太粗
- 品类分析的对象是"市场上的竞品"，不是"用户已选的品"

### 7.2 品类分析的触发时机

**决策：精筛完成后自动触发 + 支持手动重新分析**

理由：
- 自动触发：精筛完成 → 品类分析 → 品类评级写入 → 用户直接看结果
- 手动触发：用户改了筛选配置后重新筛选，需要重新分析
- 月度触发：每月初对上月的竞品数据做全量分析

### 7.3 LLM调用策略

**决策：规则引擎优先，LLM只在不确定时介入**

```
规则引擎能判断的（~70%品类）:
  - 品类指标明确好/明确差 → 直接评级
  - 风险标签匹配（季节性/侵权/合规） → 直接标记

LLM需要判断的（~30%品类）:
  - 指标模糊（中等品牌集中度+中等CN比）→ LLM综合判断
  - 跨品类关联发现 → LLM独有
  - 品类推荐文案生成 → LLM生成可读性更好的描述
```

**LLM调用量控制**：1-2次调用，每次处理10-15个"不确定"品类。

**前置依赖**（与 `01-设计思考.md §五` 对齐）：
- 必须先在 `tencent_llm_vision_service.py` 新增 `analyze_text()` 方法
- 现有 `hunyuan-vision` 模型只支持图像，文本需用 `hunyuan-pro` 或 `hunyuan-standard`
- OpenAI 兼容 client、API Key、base_url 已具备

### 7.4 数据隔离

**决策**：v2 方案下，**`selection_products.source` 字段不再承载 AI 推荐**。AI 推荐通过独立表 `ai_recommend_log` 表达。

**selection_products.source 现有值保持不变**（仅描述导入来源）：
```
'new_product_list'     → 新品榜导入
'competitor_store'     → 竞品店铺导入
'shop_import'          → 整店导入
'manual'               → 手动添加
```

**AI 推荐隔离**：
- `ai_recommend_log.recommend_batch` 区分批次（如 `ai_recommend_202606`）
- `ai_recommend_log.status` 区分用户后续行为（pending/viewed/accepted/rejected）
- 前端通过 `LEFT JOIN ai_recommend_log ON asin` 展示"🤖 AI 推荐"标签和推荐理由

用户可以在AllSelection页面通过source过滤，只看AI推荐的或只看手动导入的。
