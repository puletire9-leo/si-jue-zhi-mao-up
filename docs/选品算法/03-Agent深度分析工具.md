# Agent深度分析工具 — 选品第3层（v2 接口契约版）

> **版本说明**：
> - **v1 原始设计**：Java后端内置3个Tool函数 + Python Celery任务 + LLM调用
> - **v2 当前架构**（2026-06-08）：L2+L3全部移交 **SuperMew Selection Graph**（基于LangGraph的选品分析工作流）
> - 本文档从"Java实现方案"转变为 **"Agent接口契约"** —— 定义Agent应该产出什么，不规定Agent怎么实现
> - 完整架构见 [图.md](./图.md) §0 和 §2，技术实现见 [supermew-选品接入方案.md](../ai结合分析/03-Agent架构/supermew-选品接入方案.md)

---

## 一、定位变更

### v1 定位（原始）

Java内部的第3层分析模块，通过内置Tool函数调用LLM。

### v2 定位（当前）

**SuperMew Selection Graph 的核心能力域。** Java后端不再内置任何AI推理逻辑。

```
v1:  Java → Tool函数 → LLM API → 结果写入DB
v2:  Java提供聚合数据API → SuperMew Selection Graph(9节点LangGraph) 分析 → 回写结果API → Java存储+推送
```

**Agent需要覆盖的分析能力（原3大Tool + 扩展）**：

| 能力 | 原Tool名 | v2中Agent的职责 | Java提供的输入 |
|------|---------|----------------|--------------|
| 竞品格局分析 | `analyze_competition` | 分析每个小类的竞争态势 | 聚合数据中的品牌/销量/BSR分布 |
| 跨月趋势分析 | `analyze_product_trend` | 判断商品/品类生命周期阶段 | 多月数据（如有） |
| 蓝海信号发现 | `discover_blue_ocean` | 识别蓝海/红海缝隙/利基/观望 | 全品类聚合统计 |
| **品线综合评估** | **★ 新增 ★** | 对郑总店铺每个小类给出推荐等级 | deng_zong_shop聚合数据 |
| 差异化切入分析 | `analyze_differentiation` | 给出价格带空白和切入点 | 价格区间/Listing质量数据 |
| 爆发信号评估 | `detect_explosion_signals` | 评估信号的紧急程度和行动建议 | unitsGr/bsrCr等变化指标 |

---

## 二、工具1：竞品格局分析（analyze_competition）

### 输入

```
- category_path: 品类路径（如 "Home & Kitchen:Home Décor:Wall Art"）
- marketplace: 站点
- month: 月份
```

### 执行逻辑

**Step 1：SQL聚合查询**

```sql
-- 同类目TOP商品
SELECT asin, title, price, units, bsr, ratings, seller_name, brand,
       listing_days, weight_g, profit
FROM competitor_products
WHERE marketplace = #{mp} AND month = #{month}
  AND node_label_path LIKE CONCAT(#{category}, '%')
  AND filter_mode != 'FAIL'
ORDER BY units DESC
LIMIT 50
```

**Step 2：Python脚本计算指标**

| 指标 | 计算方式 | 选品意义 |
|------|---------|---------|
| 头部集中度 | TOP10销量 / 类目总销量 | >60%说明被垄断，进入难 |
| 评论门槛 | TOP10平均评论数 | >2000说明有评论壁垒 |
| 新品机会 | listing_days≤90的占比 | >30%说明新品有空间 |
| 中国品牌占比 | 中国卖家/总卖家 | >50%说明适合中国卖家 |
| 价格分布 | 各价格带商品数 | 找到空白价格带 |
| 品牌分散度 | unique_brands / total | 高=未固化，低=垄断 |

**Step 3：LLM解读**

```
你是跨境电商选品专家。以下是品类"{category}"在UK站{month}月的竞争格局数据：

[指标数据]

请分析：
1. 进入难度评估（容易/中等/困难）
2. 主要风险点
3. 切入策略建议
4. 是否存在价格带空白点

输出JSON格式：
{
  "entry_difficulty": "easy/medium/hard",
  "concentration_risk": "low/medium/high",
  "review_barrier": 0,
  "price_gaps": "描述空白价格带",
  "risks": ["风险1", "风险2"],
  "entry_strategy": "建议",
  "confidence": 0.0-1.0
}
```

### 与现有系统对接

- 复用 `CompetitorProductMapper.queryByCategory` 查询基础
- 新增品类聚合统计SQL（Mapper层新增1个方法）
- Python侧新增 `competition_analysis` Celery任务
- 结果写入 `product_analysis` 表（`analysis_type = 'competition'`）

---

## 三、工具2：跨月趋势分析（analyze_product_trend）

### 输入

```
- asin: 目标商品ASIN
- marketplace: 站点
- months: 可选月份范围（默认最近6个月）
```

### 执行逻辑

**Step 1：获取跨月数据**

```sql
SELECT month, price, units, bsr, ratings, listing_days
FROM competitor_products
WHERE marketplace = #{mp} AND asin = #{asin}
ORDER BY month ASC
```

**Step 2：趋势计算**

| 指标 | 计算方式 | 含义 |
|------|---------|------|
| 销量趋势 | 线性回归斜率 | 正=增长，负=下滑 |
| 销量加速度 | 斜率的变化率 | 正=加速增长，负=增速放缓 |
| BSR走势 | BSR均值变化 | 下降=排名变好 |
| 价格变化 | 首月 vs 末月 | 判断是否被卷价格 |
| 评论增长 | 末月ratings - 首月ratings | 自然增长速率 |
| 生命周期阶段 | 综合判断 | 导入期/成长期/成熟期/衰退期 |

**生命周期判定规则**：

| 阶段 | 特征 |
|------|------|
| 导入期 | listing_days<90，销量低但增长 |
| 成长期 | 销量持续上升，BSR下降（排名变好） |
| 成熟期 | 销量稳定，BSR波动小 |
| 衰退期 | 销量下降，BSR上升（排名变差） |

**Step 3：LLM解读**

```
以下是商品ASIN={asin}在UK站最近{N}个月的表现趋势：

[月度数据表]

请分析：
1. 当前处于什么生命周期阶段？
2. 销量趋势是否健康？
3. 价格是否在被卷（持续下降）？
4. 如果是新品（<90天），表现是否符合预期？
5. 建议：值得跟进 / 观望 / 放弃

输出JSON：
{
  "lifecycle_phase": "introduction/growth/maturity/decline",
  "sales_health": "accelerating/stable/slowing/declining",
  "price_war_risk": "low/medium/high",
  "recommendation": "follow/watch/abandon",
  "reasoning": "分析推理",
  "confidence": 0.0-1.0
}
```

### 关键依赖

此工具**完全依赖数据的跨月积累**。系统每月导入新数据后，趋势分析才有意义。当前系统已有 `month` 字段，历史数据天然存在。

---

## 四、工具3：蓝海信号发现（discover_blue_ocean）

> **⚠️ 本工具已升级为V2版本**：[09-蓝海发现算法升级.md](./09-蓝海发现算法升级.md)
>
> V1（4因子单指数）→ V2（10维雷达+品类分型+测品推荐）。以下内容为历史版本，以09文档为准。

### 输入

```
- marketplace: 站点
- month: 当前月份
- min_products: 品类最小商品数（默认5）
```

### 蓝海指数计算

```
蓝海指数 = 新品占比 × (1 / 品类商品数的对数) × BSR健康度 × 卖家分散度
```

各因子定义：

| 因子 | 计算方式 | 范围 |
|------|---------|------|
| 新品占比 | listing_days≤90的商品数 / 品类总商品数 | 0-1 |
| 品类规模 | 1 / log(品类商品数+1) | 品类越小值越大，说明竞争少 |
| BSR健康度 | 品类均BSR的倒数归一化 | BSR越低（排名越好）值越高 |
| 卖家分散度 | unique_sellers / total_products | 越分散说明未垄断 |

### 执行逻辑

**Step 1：SQL聚合**

```sql
SELECT
  SUBSTRING_INDEX(SUBSTRING_INDEX(node_label_path, ':', 3), ':', -1) AS category,
  COUNT(*) AS total,
  AVG(CASE WHEN listing_days <= 90 THEN 1.0 ELSE 0.0 END) AS new_ratio,
  AVG(bsr) AS avg_bsr,
  COUNT(DISTINCT seller_name) AS unique_sellers,
  COUNT(DISTINCT brand) AS unique_brands,
  AVG(units) AS avg_units,
  AVG(profit) AS avg_profit,
  AVG(price) AS avg_price
FROM competitor_products
WHERE marketplace = #{mp} AND month = #{month}
  AND filter_mode != 'FAIL'
GROUP BY category
HAVING total >= #{min_products}
```

**Step 2：Python计算蓝海指数**

```python
import math

def calc_blue_ocean_index(row):
    new_ratio = row['new_ratio']
    size_factor = 1.0 / math.log(row['total'] + 1)
    bsr_health = 1.0 / (1 + row['avg_bsr'] / 100000)  # 归一化
    seller_diversity = row['unique_sellers'] / max(row['total'], 1)

    return new_ratio * size_factor * bsr_health * seller_diversity
```

**Step 3：排序取TOP20，LLM解读**

```
你是跨境电商选品专家。以下是UK站当前蓝海指数最高的20个品类：

[蓝海品类数据表]

请分析：
1. 哪些是真正的蓝海机会（vs 只是品类小）？
2. 哪些与我们"轻小件+情绪价值+裂变"的选品DNA匹配？
3. 建议优先切入的TOP5品类及理由

输出：TOP5蓝海品类推荐，每个附切入建议。
```

### 与现有系统对接

- 复用 `CompetitorProductMapper` 的品类查询能力
- 新增蓝海指数计算Python脚本（`scripts/` 或 `backend/app/tasks/`）
- 结果可写入新表 `blue_ocean_signals` 或复用 `product_analysis`
- 定时触发：每周一次（Celery Beat），数据导入后自动执行

---

## 五、分析报告存储（v2更新）

### v1 存储：product_analysis 表

> 原设计：Agent分析结果写入 `product_analysis` 表。DDL 见本节原内容（保留参考）。

### v2 存储：product_line_guidance 表

> **当前架构**：SuperMew Selection Graph 分析结果通过 `POST /api/v1/product-line/analysis-results` 回写，
> 存入 `product_line_guidance` 表。完整 DDL 见 [图.md](./图.md) §3.1。

**v2 vs v1 存储对比**：

| 维度 | v1 (product_analysis) | v2 (product_line_guidance) |
|------|----------------------|---------------------------|
| 分析粒度 | 单商品(ASIN) 或 单品类 | **小类(nodeId)** 为核心单位 |
| 数据来源 | competitor_products | **deng_zong_shop** (郑总店铺) |
| 输出字段 | report_json + llm_summary | analysis_report(JSON) + recommendLevel + opportunityScore |
| 批次管理 | 无 | **有 batchId**，支持历史追溯 |
| 推送机制 | 无 | **有**，写入库后自动推送前端+消息 |

### product_analysis 表设计（v1参考，保留）

> ⚠️ 以下为v1原始设计。v2架构下如需单商品级分析，可复用此表结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| analysis_type | VARCHAR | competition / trend / blue_ocean |
| target_asin | VARCHAR | 关联商品（蓝海分析时为NULL） |
| target_category | VARCHAR | 关联品类（竞品/蓝海分析时） |
| marketplace | VARCHAR | 站点 |
| month | VARCHAR | 分析基准月 |
| report_json | JSON | 结构化分析报告 |
| llm_summary | TEXT | LLM生成的文本摘要 |
| confidence | DECIMAL | 置信度 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

---

## 六、触发机制

### 6.1 用户触发（实时）

在商品树页面或选品列表中，每条S1/S2商品旁边显示"AI分析"按钮：
- 点击后调用Agent分析工具
- 显示分析报告弹窗
- 报告持久化到 `product_analysis` 表

### 6.2 定时触发（批量）

| 任务 | 频率 | 范围 |
|------|------|------|
| 蓝海信号发现 | 每周一凌晨 | 全品类扫描 |
| S1商品竞品分析 | 每日凌晨 | 新增S1商品 |
| S1商品趋势分析 | 每日凌晨 | 新增S1商品（需≥2月数据） |
| 品类级LLM评估 | 每月初 | 全品类画像更新 |

### 6.3 对话触发（AI对话）

未来接入Agent对话系统后：

```
用户："帮我分析一下Wall Art品类的蓝海机会"
Agent：自动调用 discover_blue_ocean + analyze_competition
Agent："Wall Art品类共有1247条商品，新品占比18%...蓝海指数中等..."
```

这与已有的 `AI 选品 Agent — 实施方案.md` 中的Pipeline执行器设计一致。

---

## 七、三大工具的协同关系

```
蓝海信号发现（每周）
    │
    │ 发现TOP20蓝海品类
    │
    ▼
竞品格局分析（按需/定时）
    │
    │ 对蓝海品类深入分析竞争格局
    │
    ▼
跨月趋势分析（按需/定时）
    │
    │ 对蓝海品类中的具体商品分析趋势
    │
    ▼
最终决策：是否开品 + 怎么切
```

**从品类到商品，从宏观到微观，逐层聚焦。**

---

## 八、工具4：新品爆发信号检测（detect_explosion_signals）

> **完整设计见：[12-新品爆发信号检测.md](./12-新品爆发信号检测.md)**
>
> 检测月内实时变化：BSR骤降、销量增速、品类密度突变、郑总同步上新。解决“快不快”的问题。

### 输入

```
- marketplace: 站点
- month: 当前月份
- signal_types: 可选信号类型过滤（默认全部）
```

### 输出

```
{
  "critical_signals": [...],   // 🔴 立即行动
  "important_signals": [...],  // 🟡 重点关注
  "watch_signals": [...],      // 🟢 持续观察
  "category_heat_map": [...],  // 品类热度突变TOP
  "zheng_sync_alerts": [...]   // 郑总多店同步上新警报
}
```

### 与其他工具的关系

```
蓝海信号发现(09) → “哪个品类有机会”（静态）
爆发信号检测(12) → “现在正在发生什么”（动态）← 本工具
卖家画像(10)    → “谁在做，做得好不好”（静态）
竞品差异化(11)  → “怎么切进去”（策略）
跨站套利(13)   → “UK↔DE哪个站更赚钱”（套利）
```

---

## 九、工具5：跨站点套利发现（cross_marketplace）

> **完整设计见：[13-跨站点套利发现.md](./13-跨站点套利发现.md)**
>
> UK↔DE信息差套利：品类成熟度对比、同ASIN跨站空白发现、跨站利润对比。

### 输入

```
- source_marketplace: 源站点（已验证的市场）
- target_marketplace: 目标站点（机会市场）
- month: 当前月份
```

### 输出

```
{
  "category_arbitrage": [...],   // 品类级套利机会
  "product_gaps": [...],          // 产品空白（同ASIN跨站缺失）
  "profit_comparison": [...],     // 同品跨站利润对比
  "dual_shop_signals": [...]      // 跨站店铺联动信号
}
```

---

_回到：[01-选品算法总体设计.md](./01-选品算法总体设计.md)_
