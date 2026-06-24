# 选品模型创建指南 (Model Creation Guide)

> **本文件是一份自包含的"创建契约 + SOP"。** 模型创建在本项目之外、由另一个
> Hermes 助手完成；本项目 `selection-agent-v2` 只负责**消费**模型。两边唯一的耦合
> 点就是本文件定义的 JSON Schema。**外部助手看不到项目代码，凡需要的字段、取值、
> 范围本文件全部写死，不得依赖项目源码。**

- 文档版本: `guide-v1`
- 对应 Schema 版本: `schemaVersion = 1`
- 最后更新批次: 见各模型文件 `meta.lastBatch`

---

## 0. 核心概念：模型可插拔 + 模型间物理隔离

1. **可插拔**：每个模型是一棵**独立目录树**，新增/更换一个模型 = 增删一个目录，
   不影响其它模型，也不需要改消费端代码。
2. **物理隔离（铁律）**：郑总就是郑总，我们就是我们，其它新增来源就是其它。
   **绝不在数据内部混合不同来源。** 模型身份 = 目录本身，不靠字段区分来源。
3. **生产者/消费者分离**：创建方（外部 Hermes）产出符合本 Schema 的 JSON；
   消费方（本项目）读取并把 `rules.filterRules` 回灌前端筛选竞品。

---

## 1. 目录结构

```
selection-agent-v2/
├── zheng_model_v1/          # 模型1：郑总店铺冷启模型（已存在）
│   ├── <SITE>/              # 站点：UK / DE / US
│   │   ├── INDEX.md         # 该站点批量分析汇总（人读）
│   │   └── <CATEGORY>/      # 大类：beauty / kitchen ...
│   │       ├── <Subcat>.json    # ★ 模型主文件（机器消费，本文档核心）
│   │       ├── <Subcat>.md      # 人读报告（可选）
│   │       └── by_node_id/
│   │           └── <nodeId>.json  # 同一小类按 nodeId 的索引副本（可选）
├── self_model_v1/           # 模型2：我们自己验证的好品（后续，结构同上）
└── <other>_model_v1/        # 模型N：其它来源（再后续，结构同上）
```

**命名规则**
- 模型根目录：`<来源>_model_v<大版本>`，来源用英文小写（`zheng`/`self`/...）。
- 站点：`UK` / `DE` / `US`（大写，ISO 国家码）。
- 大类目录：英文小写榜单名（`beauty`/`kitchen`/...）。
- 小类文件：英文小类名，空格转下划线，首字母大写（`Cosmetic_Bags.json`）。
- **同一份模型内不得出现其它来源的数据。**

**版本双层策略**
- 目录 `_v1`/`_v2`：结构大改、整模型换代时升级。
- 文件内 `meta.schemaVersion`：消费端读取时做兼容性校验。

---

## 2. 模型主文件 Schema (`<Subcat>.json`)

单文件，顶层分 4 个命名空间。**按"更新节奏"分块**——这是整个设计的核心：

| 块 | 内容 | 谁产生 | 更新方式 |
|----|------|--------|----------|
| `meta` | 身份与版本 | 创建时写 | 每批刷新 |
| `benchmark` | 统计基准（分位值/价格带/轻小件） | 从数据算 | **每批全量重算**，禁止手改 |
| `rules` | `filterRules` 筛选规则 | 半自动 | 人工微调阈值 |
| `knowledge` | 验证好品/元素/组合/关键词 | agent+人 | **只增不删**，旧的降级不删除 |

> **为何这样分**：三块写入语义不同。重刷数据只覆盖 `benchmark`，你积累在
> `knowledge` 的好品一个都不丢；调阈值只碰 `rules`，不会误伤统计值。

### 2.1 顶层骨架

```json
{
  "meta": {
    "schemaVersion": 1,
    "model": "zheng",
    "site": "UK",
    "category": "beauty",
    "subcategory": "Cosmetic Bags",
    "nodeId": 3099640031,
    "nodeName": "Cosmetic Bags",
    "lastBatch": "UK_202605_v1_20260615-040522",
    "overallHealth": "stable",
    "healthReason": "RISING品占比最高..."
  },
  "benchmark": { "...": "见 2.2" },
  "rules":     { "filterRules": [] },
  "knowledge": { "...": "见 2.4" }
}
```

`meta.model` 必须等于所在模型根目录的来源名，且**全文件内来源唯一**。

### 2.2 `benchmark` 块（统计基准，全量重算）

```json
"benchmark": {
  "stats": { "raw": 132, "total": 104, "sampled": 40 },
  "qualityBenchmark": {
    "bsr_p50": 54129, "bsr_p90": 121505,
    "rating_min": 4.0, "ratings_min": 10,
    "weight_g_median": 40.0, "weight_g_max": 140.0,
    "fba_median": 1.52, "fba_max": 2.69,
    "listing_days_median": 273
  },
  "priceBand": {
    "min": 3.39, "max": 11.99, "avg": 5.83,
    "sweet_spot_min": 5.99, "sweet_spot_max": 8.99, "sweet_spot_ratio": 0.33
  },
  "carrierDetail": [
    { "name": "Cosmetic Bag", "count": 26, "avg_price": 5.76,
      "avg_weight_g": 40.0, "avg_fba": 1.52, "avg_variants": 4.2,
      "variant_strategy": "中等(4-9)", "lightweight": true,
      "lightweight_reason": "中位重量40g，符合轻小件" }
  ],
  "lightweightSummary": "平均重量73g，绝大多数为轻小件(<150g)..."
}
```

- 所有数值从"好品样本"统计得出，`_p50`/`_p90` 为分位值，`_median`/`_max` 同理。
- `carrierDetail`：每种载体（包型）一条聚合。`count=0` 表示该载体无好品样本，保留占位。
- `lightweight`: `true`/`false`/`"unknown"`/`"?"`（无数据）。

### 2.3 `rules` 块（筛选规则）—— ★ 权威契约，必须严格遵守

消费端会把 `filterRules` 直接回灌前端筛选竞品。字段名/运算符/上限**必须完全一致**，
否则筛出空结果。

```json
"rules": {
  "filterRules": [
    { "conditions": [
        { "field": "listingDays", "op": "le", "value": 90 },
        { "field": "units",       "op": "gt", "value": 50 }
    ]},
    { "conditions": [
        { "field": "weightG", "op": "le", "value": 150 }
    ]}
  ]
}
```

**字段白名单（仅这 4 个，不得新增/改名）**

| field | 含义 | 单位 |
|-------|------|------|
| `listingDays` | 上架天数 | 天 |
| `units` | 销量 | 单 |
| `bsr` | BRS 排名 | 名次 |
| `weightG` | 重量 | 克(g) |

**运算符白名单（仅这 5 个）**：`lt`(<) `le`(≤) `eq`(=) `ge`(≥) `gt`(>)

**结构约束**
- `value` 必须是 **number**（不带单位、不加引号）。
- 一条 rule 内多个 condition 是 **AND**（同时满足）。
- 多条 rule 之间是 **OR**（满足任一即合格）。
- **最多 5 条 rule，每条最多 4 个 condition。** 同一 rule 内字段不应重复。

### 2.4 `knowledge` 块（创意知识，只增不删）

这是模型的"血肉"，持续累积。**每条记录必须带 `id` / `status` / `updatedBatch`**
三个治理字段——这是"方便新增/更换/插入/修改单条"的前提。

```json
"knowledge": {
  "goodProducts": [
    { "id": "B0FL7BK1RR", "status": "active", "updatedBatch": "UK_202605_v1_...",
      "asin": "B0FL7BK1RR",
      "elements": ["Emergency Snack", "Funny"],
      "carriers": ["Canvas Zipper Pouch", "Makeup Bag"],
      "scenes": ["Travel", "Unisex"],
      "keywordsEn": ["emergency snack bag", "funny makeup bag"],
      "keywordsCn": ["应急零食袋", "搞笑化妆包"],
      "lightweight": "True" }
  ],
  "provenElements": [
    { "id": "el-racing", "status": "active", "updatedBatch": "...",
      "name": "Racing", "frequency": 3,
      "carriers": ["Cosmetic Bag", "Makeup Bag", "Zipper Pouch"],
      "signalTags": ["RISING", "STABLE"],
      "insight": "赛车主题已验证3次，可扩展到笔袋、洗漱包" }
  ],
  "elementSaturation": [
    { "id": "el-racing", "element": "Racing", "frequency": 3,
      "saturation": "medium", "insight": "出现在3个商品，值得观察" }
  ],
  "emergingElements": [
    { "id": "B0G7Z4QW47", "element": "Colorful Canvas", "asin": "B0G7Z4QW47",
      "signal": "BURST", "opportunity": "彩色医疗收纳袋需求激增，可推多色系" }
  ],
  "recommendedCombos": [
    { "id": "combo-racing-f1", "status": "active", "updatedBatch": "...",
      "elements": ["Racing", "Funny F1"],
      "carriers": ["Makeup Bag", "Pencil Case"],
      "scenes": ["Racing Fans", "Gift for Men"],
      "keywordsEn": ["f1 makeup bag"], "keywordsCn": ["F1化妆包"],
      "heat": "已验证", "reason": "RISING+STABLE，多载体成功" }
  ],
  "searchKeywords": { "en": ["funny makeup bag"], "cn": ["搞笑化妆包"] },
  "priceGaps": [
    { "id": "gap-7-8.5", "range": "£7.00 - £8.50",
      "opportunity": "甜蜜点上限，可开发£7.99-8.49礼盒装" }
  ]
}
```

**治理字段取值**
- `id`：稳定唯一标识。好品/新兴品直接用 ASIN；元素/组合用语义 slug（`el-racing`）。
- `status`：`active`(生效) / `observing`(观察) / `deprecated`(已淘汰，**保留不删**)。
- `updatedBatch`：写入或最后修改它的批次号，用于追溯。
- `signalTags` / `signal` 枚举：`RISING` / `STABLE` / `DECLINING` / `BURST` / `SWEET_SPOT`。
- `heat` 枚举：`已验证` / `待观察` / `新兴`。
- `saturation` 枚举：`low` / `medium` / `high`。

### 2.5 增删改插的标准操作（依赖 `id`）

| 动作 | 操作 | 影响 |
|------|------|------|
| **新增** | 对应数组 append 一条带新 `id` 的记录 | 单块单条 |
| **更换** | 老记录 `status` 改 `deprecated`，新记录 append | 单条，留痕 |
| **插入** | 同新增（如需排序另加 `order` 字段） | 单条 |
| **修改** | 按 `id` 定位改字段，更新 `updatedBatch` | 单条 |
| **重刷统计** | 整块覆盖 `benchmark`，`knowledge` 不动 | 仅 benchmark |

**禁止物理删除 `knowledge` 记录**，只允许置 `deprecated`（符合不可变/可追溯原则）。

<!--CURSOR-->
