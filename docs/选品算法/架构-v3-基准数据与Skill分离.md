# 选品系统架构 v3 — 基准数据层与 Agent Skill 层分离

> 日期：2026-06-10
> 状态：设计讨论中，逐步实施

---

## 核心理念

**Java 后端准备标准化"分析包"，Agent 提供独立 Skill 消费分析包。两者通过 `batch_id` 解耦。**

**郑总模型 = 亚马逊商品树**：从 `deng_zong_shop` 聚合出郑总在做的品线树（L1品线 → L2小类），AI 分析每个小类的好卖元素/载体/组合。这套模型是**筛选层**，告诉选品表"该找什么"。

```
郑总模型（品线树）                      选品表（competitor_products）
─────────────────                      ──────────────────────────
产出筛选维度                              存量数据，不做改动
                                         
kitchen / Signs & Plaques              按 元素=heart + 载体=ceramic-plaque
  → 元素: heart, thank-you, capybara      → 筛选出匹配的 ASIN
  → 载体: ceramic-plaque, canvas-sign
  → 组合: 爱心陶瓷牌, 卡皮巴拉帆布牌
```

```
原始数据                 基准数据层 (Java)               Agent Skill 层 (Python)
────────                ──────────────                 ──────────────────────
deng_zong_shop    →     预处理+聚合+过滤        →      skill_analyze_product_lines
                        按batch_type打包存表     →      逐品线AI分析
                        按时间+站点分批次               产出元素/载体/组合
                                                       回写product_line_elements表
                                                       生成MD报告
                                                           ↓
                                                   选品页按元素/载体/组合筛选
```

三层关系：
- **基准数据** = 预处理好的结构化数据，Agent 直接消费，不需要理解原始表结构
- **Skill** = 独立的分析能力单元，接收 batch_id → 拉数据 → 分析 → 回写结果
- **选品表** = 不受影响，郑总模型提供筛选维度叠加到现有筛选体系上

---

## 一、基准数据层 (Java)

### 1.1 analysis_batches 表（统一分析包存储）

```sql
CREATE TABLE analysis_batches (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id        VARCHAR(64)  NOT NULL COMMENT '批次ID（如 UK_202605_zheng_model_20260610-120000）',
    batch_type      VARCHAR(32)  NOT NULL COMMENT '批次类型枚举',
    marketplace     VARCHAR(8)   NOT NULL COMMENT '站点 UK/DE/US',
    month           VARCHAR(8)   NOT NULL COMMENT '数据月份 202605',
    
    -- 元数据
    source_table    VARCHAR(64)  COMMENT '数据源表（deng_zong_shop/competitor_products）',
    total_products  INT DEFAULT 0 COMMENT '原始数据总量',
    total_items     INT DEFAULT 0 COMMENT '聚合后的条目数（如小类数）',
    
    -- 核心数据
    data_json       MEDIUMTEXT   NOT NULL COMMENT '结构化分析数据 JSON',
    
    -- 状态
    status          VARCHAR(16)  DEFAULT 'ready' COMMENT 'ready/analyzing/done/error',
    analyzed_at     DATETIME     COMMENT 'Agent 分析完成时间',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_batch (batch_id),
    INDEX idx_type_marketplace_month (batch_type, marketplace, month),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析批次表 — 基准数据包 + Agent 分析结果';
```

### 1.2 batch_type 枚举

| batch_type | 数据源 | 聚合逻辑 | 用途 |
|------------|--------|----------|------|
| `zheng_model` | deng_zong_shop | L1品线(bsr_id) → L2小类(node_id)，过滤 ≥10 商品，按商品数降序排列 | [V1] 建立郑总品线树，产出待分析小类优先级列表 |
| `product_line` | competitor_products | 按 node_id 聚合单小类，含样本商品 top10 | [后续] 单品线深度 AI 分析 |
| `category_scan` | competitor_products | 全品类 10 维聚合 | [后续] 蓝海扫描 |
| `seller_scan` | competitor_products | 按 seller_name 分组 | [后续] 卖家画像分析 |
| `new_products` | competitor_products | 新品(≤90天)，按品类分组 | [后续] 新品发现 |

### 1.3 zheng_model 批次的 data_json 结构

```json
{
  "sourceTable": "deng_zong_shop",
  "totalProducts": 5582,
  "productLines": [
    {
      "bsrId": "kitchen",
      "productCount": 2481,
      "storeCount": 28,
      "totalUnits": 123400,
      "totalRevenue": 456000.00,
      "avgProfitRate": 32.5,
      "subCategories": [
        {
          "nodeId": 4245783031,
          "nodeName": "Signs & Plaques",
          "nodeFullPath": "Home & Kitchen:...:Signs & Plaques",
          "productCount": 257,
          "storeCount": 18,
          "totalUnits": 8500,
          "avgPrice": 6.59,
          "avgBsr": 13863,
          "unitsGrowthRate": 12.5,
          "storeNames": ["SDGHJZ", "CLX-UK"],
          "sampleProducts": [{ "asin": "...", "title": "...", ... }]
        }
      ]
    }
  ],
  "priorityOrder": [
    {"bsrId": "kitchen", "nodeId": 4245783031, "rank": 1, "reason": "257品+18店+增速12.5%"},
    {"bsrId": "kitchen", "nodeId": 4245783032, "rank": 2, "reason": "202品+15店"}
  ]
}
```

### 1.4 Java 端点和预处理脚本

**新增端点**：

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/v1/batches/zheng-model?marketplace=UK&month=202605` | 触发生成 zheng_model 批次，返回 batch_id |
| GET | `/api/v1/batches/{batch_id}` | 获取批次完整 data_json |
| GET | `/api/v1/batches/{batch_id}/sub/{node_id}` | 获取单小类数据（按需加载） |

**预处理方法**：

```
ProductLineBatchService:
  prepare_zheng_model(marketplace, month) → batch_id
  get_batch(batch_id) → 完整 data_json
  get_sub_category(batch_id, node_id) → 单小类数据
```

**过滤规则（zheng_model）**：
- 小类商品数 ≥ 10（硬过滤，噪声品类跳过）
- L1 品线按商品总数降序排列
- L2 小类按商品数降序排列
- 排序逻辑：纯商品数，不做加权。郑总已经在这些品类验证过，商品多=重仓=值得跟

**利润计算（zheng_model 基准数据）**：
- 方案A：直接使用 deng_zong_shop 的 `profit` 字段
- 取小类内非 NULL profit 的平均值，NULL 跳过
- 公式：avg_profit_margin = AVG(profit) WHERE profit IS NOT NULL
- 注意：`profit` 是卖家精灵估算的利润率（如 32.5 表示 32.5%），不是绝对金额
- FBA 字段：9.2% 缺失，基准数据阶段不做处理，留给 Agent 深度分析时按算法估算

---

## 二、Agent Skill 层 (Python)

### 2.1 Skill 定义

每个 Skill 是一个独立函数，遵循统一接口：

```python
async def skill_analyze_product_lines(batch_id: str, **options) -> SkillResult:
    """
    Args:
        batch_id: zheng_model 批次ID
        options: {max_concurrent: 3, top_n: 106}
    
    Returns:
        SkillResult {status, batch_id, total, succeeded, failed, skipped}
    
    Flow:
        1. POST /api/v1/batches/{batch_id} → 获取完整 zheng_model 数据
        2. 按 priority_order 遍历小类:
           脚本预处理（Top25+新星、信号标签、统计）
             → AI 分析（Prompt + DeepSeek）
             → 保存（MD + product_line_elements + batch状态）
        3. 返回汇总
    """
```

### 2.2 Skill 清单

| Skill | 消费 batch_type | 核心逻辑 | 产出 |
|-------|-----------------|----------|------|
| `skill_zheng_model` | `zheng_model` | 对品线树做交叉分析：郑总重仓 vs 外部竞争 → 标记优先级 | 郑总品线树 + 优先级排序 + 盲区发现 |
| `skill_product_line` | `product_line` | 11节点 LangGraph 深度分析单小类 | 品线分析报告（推荐等级+机会分+切入策略） |
| `skill_blue_ocean` | `category_scan` | 10维雷达+LLM机会卡+品类分型 | 蓝海机会排名+每品类LLM解读 |
| `skill_seller_profile` | `seller_scan` | 聪明卖家3维评分+跟品信号+热度矩阵 | 卖家画像+跟品信号+智能推荐 |
| `skill_cross_market` | `product_line` | UK↔DE跨站价格/品类对比 | 套利机会发现 |

### 2.3 Skill 编排流程（Agent 层）

```
触发"郑总模型分析"
  │
  ├─ Step 1: Java prepare_zheng_model(marketplace, month) → batch_id
  │         产出: analysis_batches 表 zheng_model 批次
  │         data_json 含品线树 + 106个小类 + priority_order
  │
  ├─ Step 2: Agent 按 priority_order 逐个小类分析
  │         对每个小类:
  │           脚本预处理（取Top25+新星、打信号标签、统计）
  │             → AI 分析（提取元素/载体、判断好品、推荐组合）
  │             → 保存（MD文件 + product_line_elements表 + 更新batch状态）
  │         concurrent=3，分析完一个保存一个
  │
  └─ Step 3: 汇总报告（成功N个、失败N个、跳过N个）
```

### 2.4 增量保存

分析一个大类的一个小类 → 立即 POST 回写 → 用户可以看到实时进度。

Agent 回写端点：
```
POST /api/v1/product-line/analysis-results
Body: {"batchId": "...", "results": [单条分析结果]}
```

不要求凑齐所有结果再保存。每次 POST 可以只有 1 条。

---

## 三、品线 AI 分析 Skill（skill_product_line_analysis）

### 3.1 目标

对郑总模型筛选出的每个小类，AI 判断哪些 ASIN 是好品 → 提取好品的元素/载体/场景 → 生成推荐组合和中文关键词。

**触发方式**：Agent 内部循环 `priority_order`，逐个小类处理（脚本预处理 → AI分析 → 保存），前端不需要逐个触发。

**版本管理**：每次全量分析生成新 batch_id（如 `UK_202605_zheng_model_v2`）。旧版本数据保留不覆盖，MD 文件存在独立文件夹（`zheng_model_v2/`），数据库按 batch_id 区分。

**数据清洗**：
- `listing_days`：Java 端根据 `available_date` 计算好天数（当前时间 - 时间戳 / 86400000），Python 直接用
- MD 文件名：空格转下划线，移除 `&` `/` `!` 等特殊字符
- 目录结构：`zheng_model_v1/{marketplace}/{bsr_id}/{node_name_safe}.md`

**注意**：
- weight/dimension 字段不可信（卖家故意写低），轻小件由 AI 基于载体类型判断，不属于信号标签
- 一个商品可同时挂多个信号标签，JSON 数组天然支持，不互斥
- 大品线变体归组：按 parent_asin 或标题前10词分组，每组取销量最高代表品
- 去重后取 Top 畅销品 + 新星（≤90天 + units≥10），送 AI 的商品最多 40 个，可少不可多
- 保存失败不重试：记日志，跳过，最后汇总列出失败小类，手动重跑
- bsr_id 用原始关键词（如 `kitchen`），中文映射留到前端

### 3.2 脚本层：数据提取 + 信号标记（无 AI）

脚本只做数值计算和数据整理，不做语义判断。元素/载体/场景分类完全交给 AI。

**步骤**：
1. 从 `deng_zong_shop` 按 node_id 拉取全量商品（Python 直接查 DB）
2. 变体归组去重：按 parent_asin 分组，每组取销量最高代表品；无 parent_asin 的按标题前 10 词分组
3. 取样：去重后的 Top 畅销品 + 新星商品（listing_days <= 90, units >= 10）取并集，最多 40 个
4. 信号标签打标
5. 基础统计（新品占比、信号分布、价格分布）

**信号标签定义**：

| 信号 | 标签 | 条件 |
|------|------|------|
| 新品即爆 | BURST | listing_days <= 15 AND BSR < 100k AND units > 0 |
| 上升期 | RISING | listing_days <= 90 AND BSR < 300k AND units >= 10 |
| 稳定出单 | STABLE | listing_days > 90 AND units > 50 |
| 衰退中 | DECLINING | listing_days > 365 AND BSR > 500k AND units < 10 |
| 已死 | DEAD | listing_days > 90 AND units=0 AND (BSR IS NULL OR BSR=0) |
| 可裂变 | VARIANT | variations >= 4 |
| 理想价格 | SWEET_SPOT | price BETWEEN 5.99 AND 8.99 |

注意：LIGHT 不在信号标签中。轻小件判断在好品筛选之后，由 AI 根据载体类型 + 数据综合判断。

**产出分析卡示例**（元素/载体/场景字段留空，AI 自己判断）：

```json
{
  "sub_category": "Signs & Plaques",
  "bsr_id": "kitchen",
  "marketplace": "UK",
  "stats": { "total":257, "deduped":68, "sampled":32, "new_ratio":"12%", "sweet_spot_ratio":"68%" },
  "signals": { "BURST":2, "RISING":8, "STABLE":15, "DECLINING":12, "DEAD":3 },
  "products": [
    {
      "asin": "B0F6YGS2Q9",
      "title": "Thank You Gift, Ceramic Plaque...",
      "listing_days": 386, "units": 269, "bsr": 31652,
      "price": 4.16, "variations": 6,
      "signals": ["STABLE", "VARIANT", "SWEET_SPOT"]
    },
    {
      "asin": "B0XXNEW01",
      "title": "Capybara Canvas Sign...",
      "listing_days": 12, "units": 45, "bsr": 89000,
      "price": 5.99, "variations": 0,
      "signals": ["BURST", "SWEET_SPOT"]
    }
  ]
}
```

注意：分析卡中**不包含** elements/carriers/scenes 字段。这些由 AI 从标题中自行提取和分类。

### 3.3 AI 层：好品判断 + 组合推荐（V1 Prompt）

**角色定位**：
你是郑总选品模型的品线分析专家。上一步系统已经从郑总28家亚马逊店铺中按商品数聚合出了值得分析的小类清单。你的任务是从当前小类的TOP商品标题中自行提取元素、载体、场景，然后判断哪些商品好、哪些组合值得做。

**数据说明**：
商品数据来自 `deng_zong_shop`（郑总店铺真实数据）。每个商品带有信号标签——脚本根据数据自动打的线索，不是绝对结论。商品标题是亚马逊原始标题，你需要从中提取元素（图案/主题/情绪词）、载体（产品物理形态）、场景（使用场合/人群）。

信号标签定义：
- BURST: 上架 <= 15天就有BSR和销量，可能踩中需求热点
- RISING: 上架 <= 90天，BSR < 30万，月销 >= 10，新品在增长
- STABLE: 上架 > 90天，月销 > 50，已验证的长期爆款
- DECLINING: 上架 > 365天，BSR > 50万，月销 < 10，已衰退
- DEAD: 上架 > 90天，无销量无BSR，已失效
- VARIANT: 变体 >= 4，说明有裂变操作
- SWEET_SPOT: 价格在5.99-8.99之间

**判断任务**：

任务1 - 判断好品：
- 综合分析每个商品的价格、上架天数、BSR、销量、变体数、信号标签
- 不要只看销量排序，要结合上架时间。上架12天销量45的商品比上架300天销量200的更值得关注
- 给每个商品 is_good: true/false

任务2 - 判断元素+载体：
- 从好品中提取元素，看这个元素在多个载体上表现如何
- 如果同一个元素在ceramic-plaque上爆了，在canvas-sign上也有STABLE，那元素本身是好的，概念可复用
- 如果只有一个载体上成功，其他载体都没人做——可能是载体小众，也可能是新机会

任务3 - 判断载体的轻小件属性：
- 在筛选出好品和载体之后，对每个载体判断是否为轻小件
- 判断依据：载体天然属性（帆布袋轻、长椅重）+ 数据库中的重量/体积数据（注意：卖家常造假，如帆布袋标500g明显不合理）
- 载体天然轻小的例子：wall-art, sticker, bag, pouch, ornament, keychain, magnet, patch, badge, card
- 输出 lightweight: true/false/uncertain，附判断理由

任务4 - 推荐组合：
- 基于好品的元素+载体+场景，给出值得做的组合
- 中文关键词由你生成，要自然、像买家会搜的词，不要太长（2-5个字）
- 标记每个组合的热度：已验证 / 新兴 / 待观察

**约束**：
- 不使用利润相关判断
- 元素/载体存储原标题词（英文/德文），中文关键词是独立字段
- 只有 is_good=true 的商品才输出元素/载体/关键词
- 只在DEAD商品中出现的元素不要推荐
- 轻小件判断在好品筛选之后，基于载体类型 + 数据交叉判断
- 输出严格JSON格式

**AI 输出 JSON 格式**：
```json
{
  "sub_category": "Signs & Plaques",
  "bsr_id": "kitchen",
  "marketplace": "UK",
  "overall_health": "healthy",
  "health_reason": "BURST=2, RISING=8, STABLE=15, DEAD=3, 新品活跃，死品少",

  "good_products": [
    {
      "asin": "B0F6YGS2Q9",
      "is_good": true,
      "reason": "稳定爆款，269单，6变体裂变中，心形陶瓷牌为已验证载体",
      "elements": ["heart", "thank-you"],
      "carriers": ["ceramic-plaque"],
      "scenes": ["women", "friend", "mom"],
      "keywords_cn": ["爱心陶瓷牌", "感谢纪念牌"]
    },
    {
      "asin": "B0XXNEW01",
      "is_good": true,
      "reason": "新品12天即出45单，BURST信号，卡皮巴拉元素新兴，裂变空间大",
      "elements": ["capybara"],
      "carriers": ["canvas-sign"],
      "scenes": ["bedroom"],
      "keywords_cn": ["卡皮巴拉帆布牌", "卡皮巴拉装饰牌"]
    }
  ],

  "element_analysis": [
    {
      "element": "heart",
      "language": "en",
      "total_products": 12,
      "good_count": 8,
      "carriers_used": ["ceramic-plaque", "metal-sign", "wooden-sign"],
      "verdict": "已验证强元素",
      "verdict_reason": "在3种载体上均有好品，陶瓷牌上表现最强(6变体稳定出单)",
      "keyword_cn": "爱心"
    },
    {
      "element": "capybara",
      "language": "en",
      "total_products": 1,
      "good_count": 1,
      "carriers_used": ["canvas-sign"],
      "verdict": "新兴元素",
      "verdict_reason": "仅1个商品但BURST信号强(12天45单)，冷门IP有爆发潜力，建议多载体铺开测试",
      "keyword_cn": "卡皮巴拉"
    }
  ],

  "carrier_analysis": [
    {
      "carrier": "ceramic-plaque",
      "language": "en",
      "total_products": 15,
      "good_count": 10,
      "top_elements": ["heart", "thank-you", "sympathy"],
      "lightweight": true,
      "lightweight_reason": "陶瓷牌单件<200g，体积扁平，FBA运费低，属于郑总核心轻小载体",
      "verdict": "主力载体",
      "verdict_reason": "产品数最多，情感主题适配度高，变体裂变活跃",
      "keyword_cn": "陶瓷牌"
    }
  ],

  "recommended_combos": [
    {
      "element": "heart",
      "carrier": "ceramic-plaque",
      "scene": "women gift",
      "heat": "已验证",
      "reason": "6变体稳定出单269/月，可继续裂变不同场景(教师/母亲/闺蜜)",
      "keyword_cn": "爱心陶瓷牌"
    },
    {
      "element": "capybara",
      "carrier": "canvas-sign",
      "scene": "bedroom decor",
      "heat": "新兴",
      "reason": "BURST信号，冷门IP竞争少，建议快速裂变多尺寸/多场景",
      "keyword_cn": "卡皮巴拉帆布牌"
    }
  ],

  "summary": "Signs & Plaques 是 kitchen 品线下最大小类，以情感主题+陶瓷/金属载体为核心。heart元素已验证(8/12好品)，capybara为新兴机会(12天起量)。建议: 1) 继续裂变爱心陶瓷牌的情感场景 2) 快速测试卡皮巴拉的多载体适配 3) 关注highland-cow在canvas-sign上的表现(跨小类元素验证)",
  "analysis_version": "v1"
}
```

### 3.4 语言规则

- UK 站标题为英文，元素/载体存英文原文
- DE 站标题为德文，元素/载体存德文原文
- 不翻译，保持原标题语言。跨站元素关联后续版本再做
- 中文关键词由 AI 生成（如 `Dackel → "腊肠犬"`, `Ceramic Plaque → "陶瓷牌"`）

### 3.5 元素关联表

只保存 AI 判定为 `is_winner=1` 的 ASIN：

```sql
CREATE TABLE product_line_elements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  marketplace VARCHAR(8) NOT NULL,
  month VARCHAR(8) NOT NULL,
  bsr_id VARCHAR(64),
  node_id BIGINT,
  node_name VARCHAR(128),
  asin VARCHAR(20),
  title VARCHAR(512),
  -- 基准数值（前端筛选排序用）
  listing_days INT,
  units INT,
  bsr INT,
  price DECIMAL(8,2),
  variations INT,
  -- AI 分析结果
  signal_tags JSON,         -- ["STABLE","VARIANT","SWEET_SPOT"]
  elements JSON,            -- ["heart","thank-you"] (原标题语言)
  carriers JSON,            -- ["ceramic-plaque"]
  scenes JSON,              -- ["women","friend"]
  is_winner TINYINT DEFAULT 0,
  ai_keywords JSON,         -- ["爱心陶瓷牌"] (AI生成的中文关键词)
  analysis_batch_id VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bsr_node (bsr_id, node_id),
  INDEX idx_batch (analysis_batch_id)
);
```

垃圾元素不存 —— 只有 AI 判定好品才写入。

### 3.6 MD 报告输出

每个小类生成独立 MD 文件。**AI 只输出 JSON，脚本按统一模板填充 MD**，保证格式一致性。

**目录结构**：
```
zheng_model_v1/
  UK/
    kitchen/
      Signs_and_Plaques.md
      Posters_and_Prints.md
    fashion/
      Women.md
  DE/
    ...
```

**MD 模板**：
```markdown
# {node_name} ({marketplace})

> {bsr_id} / {node_full_path}
> {product_count}品 | {store_count}店 | 新品占比{new_ratio} | 理想价格占比{sweet_spot_ratio}
> 分析时间: {analyzed_at} | batch: {batch_id}

## 品类健康度
{health_reason}

## 好品列表
| ASIN | 标题 | 上架天 | 月销 | BSR | 价格 | 变体 | 信号 |
|------|------|--------|------|-----|------|------|------|
{good_products_rows}

## 爆款元素
| 元素 | 原文 | 商品数 | 好品数 | 使用载体 | 判断 |
|------|------|--------|--------|----------|------|
{element_rows}

## 主流载体
| 载体 | 原文 | 商品数 | 好品数 | 轻小件 | 判断 |
|------|------|--------|--------|--------|------|
{carrier_rows}

## 推荐组合
| 元素 | 载体 | 场景 | 热度 | 理由 | 关键词 |
|------|------|------|------|------|--------|
{combo_rows}

## AI 小结
{summary}
```

| 维度 | v2 (图.md) | v3 (本文档) |
|------|-----------|-------------|
| 数据源 | agent 直接从 Java 拉，Java 不知道具体内容 | Java 预处理打包，agent 按 batch_id 拉 |
| 分析组织 | 一个 pipeline 分析所有 | 独立 Skill，可组合 |
| 结果保存 | 全部分析完一次性回写 | 分析完一个保存一个 |
| 批次管理 | batch_id 只是标识 | batch_id + batch_type 分类管理 |
| 数据复用 | 无 | 同一 batch 可被多个 Skill 消费 |

---

## 四、当前状态 (2026-06-10)

### V2 已有（仅供参考，V3 以本文档为准）
- DeepSeek V4 LLM 集成可用
- `deng_zong_shop` 表数据完整（UK 5582 + DE 1409）
- Java 端 `DengZongShopMapper` / `DengZongShop` Entity 已存在

### V3 待实现
- [ ] `analysis_batches` 表（统一分析包存储）
- [ ] `product_line_elements` 表（元素关联表）
- [ ] Java `ProductLineBatchService` — `prepare_zheng_model()` 方法
- [ ] Python 脚本预处理（Top25提取 + 信号标签打标 + 统计）
- [ ] Python AI 分析 Skill（Prompt + DeepSeek调用 + 结果解析）
- [ ] Python 保存（MD生成 + product_line_elements写入 + 状态更新）
- [ ] 逐品线循环 + 并发控制 + 失败汇总

### 已决策 (2026-06-10)
- [x] **analysis_batches 表**：一张通用表，`batch_type` 字段区分类型，JSON 存数据
- [x] **郑总模型排序**：纯商品数降序。郑总已经验证过品类，商品多=重仓=值得跟
- [x] **利润**：基准数据保留 `avg_profit_margin`，AI 不使用利润做判断
- [x] **轻小件**：不属于信号标签，由 AI 基于载体类型 + 数据交叉判断
- [x] **元素/载体**：AI 从标题自行提取和分类，不做词典预处理
- [x] **商品数据源**：Python 按 node_id 自行查 `deng_zong_shop`，Java batch 保留 Top10 做概览
- [x] **≥10 商品全分析**：商品少的小类可能是试水新方向，照常分析
- [x] **AI 失败处理**：跳过+日志，最后汇总失败列表，不自动重试
- [x] **MD 生成**：AI 只输出 JSON，脚本按统一模板填充 MD
- [x] **数据更新策略**：每月全量重新分析，旧版本保留
- [ ] batch 数据 JSON 版本化：暂不实施，后续按需添加 `schema_version` 字段

---

## 五、实施优先级

```
P0: analysis_batches 表 + product_line_elements 表（建表）
P1: Java ProductLineBatchService.prepare_zheng_model()（聚合→写入batch）
P2: Python 脚本预处理（Top25+新星提取、信号标签打标、统计）
P3: Python AI 分析 Skill（Prompt + DeepSeek + 结果解析）
P4: Python 保存（MD + DB + 状态更新）+ 循环编排
```

