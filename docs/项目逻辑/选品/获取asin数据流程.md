# 获取 ASIN 数据流程

## 总体架构

```
前端 AsinImport/index.vue + HistorySidebar.vue
  │
  ├─ ① POST /api/v1/asin-import/upload     → 上传 Excel/JSON → 初筛 → 返回预览
  ├─ ② POST /api/v1/asin-import/execute    → 异步启动分块 API 调用
  ├─ ③ GET  /api/v1/asin-import/progress   → 轮询进度（每 3s）
  ├─ ④ POST /api/v1/asin-import/cancel     → 暂停/停止
  ├─ ⑤ GET  /api/v1/asin-import/history    → 导入历史（按月分组）
  └─ ⑥ GET  /api/v1/competitor/quota       → 卖家精灵使用次数查询
          │
          ▼
Java sjzm-product (端口 8002)
  │
  ├─ AsinImportController       → 上传/执行/进度/取消/历史 5 端点
  ├─ CompetitorController       → 竞品查询/使用次数/筛选配置 4 端点
  ├─ FilterConfigController     → 精筛配置读写
  ├─ ScoringController          → 评分管理
  ├─ AsinImportService          → 解析文件 / 初筛 / 分块编排 / 去重
  ├─ CompetitorService          → 调 API（含翻页） / 数据持久化 / 父ASIN追踪
  ├─ CompetitorFilterService    → 精筛（双层评分） / 黑名单入库 / 店铺提取 / 30天追踪
  ├─ FilterConfigService        → 精筛配置管理（DB持久化，实时生效）
  ├─ ScoringService             → 评分引擎（FBM特殊规则 + 4维度加权）
  ├─ SellerspriteApiService     → HTTP 调用卖家精灵
  ├─ ApiRateLimitService        → 速率限制（分钟 / 月）
  └─ MySQL (sijuelishi_dev)
       ├─ asin_import_tasks          → 任务进度（含 API 请求次数/父ASIN数/变体数/月份）
       ├─ asin_import_results        → 每条 ASIN 的初筛结果
       ├─ competitor_products        → 竞品数据（56 API 字段 + 评分字段）
       ├─ competitor_subcategories   → 竞品子类目排名
       ├─ competitor_lookup_log      → API 调用记录（每次请求一条）
       ├─ skip_asins                 → 硬性淘汰黑名单
       ├─ shops                      → 店铺信息（shop_id 去重）
       ├─ product_30day_new          → 30 天新品追踪
       ├─ api_config                 → 动态配置（卖家精灵使用次数 + 精筛阈值）
       ├─ scoring_config             → 评分维度配置
       └─ grade_thresholds           → 评分等级阈值
```

---

## 第一步：上传文件并初筛

### 文件解析

- **Excel**：Apache POI，`LinkedHashMap` 保证列顺序与索引一致
- **JSON**：Jackson 反序列化
- 支持多文件合并上传

### 初筛流程（filterRows）

筛选顺序（优先级从高到低）：

| 步骤 | 规则 | 状态 | 说明 |
|------|------|------|------|
| 1. ASIN 提取 | 列索引 1 定位，列名回退 | — | `B0[0-9A-Z]{8}` 格式校验 |
| 2. 内部去重 | 同文件重复 ASIN | `DUPLICATE` | |
| 3. **黑名单跳过** | `skip_asins` 表（历史硬性淘汰） | `SKIP_BLACKLIST` | 价格/评论/精筛历史失败 |
| 4. **主表跳过** | `competitor_products` 表（曾请求过 API） | `SKIP_MAIN` | **绝对不重复调 API** |
| 5. 价格筛选 | £4.99 ~ £19.99 | `PRICE_FAIL` | 仅对全新 ASIN 生效 |
| 6. 评论筛选 | 评论数 < 5 | `REVIEW_FAIL` | 仅对全新 ASIN 生效 |
| 7. 通过 | 以上全部通过 | `PASS` | 进入 API 调用队列 |

**关键规则：跳过检查在价格/评论之前。只要 ASIN 在主表或黑名单存在，直接淘汰，不重复请求 API。**

### 跳过集合来源

| 集合 | 数据来源 | 含义 |
|------|---------|------|
| 黑名单 | `skip_asins` 表 | 初筛价格/评论淘汰 + 精筛不通过 |
| 主表 | `competitor_products.asin` + `competitor_products.parent_asin` | 曾请求过 API 的所有 ASIN（含父ASIN和变体子ASIN） |

### 返回预览

```json
{
  "taskId": 40,
  "totalCount": 386,
  "passCount": 80,
  "priceFailCount": 130,
  "reviewFailCount": 17,
  "duplicateCount": 0,
  "skipCount": 159,
  "skipMainCount": 20,
  "skipBlacklistCount": 139,
  "batchTotal": 2,
  "discardedAsins": 0
}
```

---

## 第二步：确认 + 启动 API

```
POST /api/v1/asin-import/execute?taskId=40&month=202605
→ 立即返回，异步执行
```

### API 请求参数

| 参数 | 值 | 说明 |
|------|-----|------|
| marketplace | UK/DE | 市场 |
| month | 202605 | 数据月份 |
| asins | 40 个/批 | 最多 40 |
| variation | **N** | N=含变体 |
| size | **100** | 最大单页条数 |
| page | 自动翻页 | 从 1 开始 |

### 翻页规则

```
page=1 → 获取第一页
  如果 total > 100 且 remainder >= 70 → 翻 page=2
  如果 total > 200 且 remainder >= 70 → 翻 page=3
  ...

条件：fetched >= 200 且 remainder < 70 → 停止翻页
```

| total | 翻页 | API 次数 | 说明 |
|-------|------|---------|------|
| 80 | 1 页 | 1 次 | remainder=0 < 70 |
| 212 | 2 页 | 2 次 | remainder=12 < 70 |
| 270 | 3 页 | 3 次 | remainder=70 ≥ 70 |
| 350 | 3 页 | 3 次 | remainder=50 < 70 (200+ 后) |

---

## 第三步：API 调用 + 入库 + 追踪

### doLookupAndSave 流程

```
for each page:
  ① 调卖家精灵 API
  ② 遍历返回 items，每个 item → mapToEntity → upsert(delete+insert)
  ③ 子类目 → competitor_subcategories 表
  
④ 遍历请求的 40 个父 ASIN → 全部写入 competitor_products（追踪记录）
   → 确保下次上传时这些父 ASIN 被 SKIP_MAIN 拦截
  
⑤ 统计父/变体数：
   parent_asin == asin 或空 → 父 ASIN
   parent_asin != asin → 变体 ASIN
```

### 返回 summary

```json
{
  "total": 150,
  "mode1": 5,
  "mode2": 12,
  "fail": 133,
  "newProductPassed": 2,
  "apiCalls": 2,
  "parentAsinCount": 40,
  "variantAsinCount": 110
}
```

---

## 第四步：精筛（CompetitorFilterService）

API 数据入库后自动触发。

### 模式一（全部条件必须满足）

| 条件 | 阈值 | 来源 |
|------|------|------|
| 价格 | £4.99 ~ £30.00 | `filter_config` 表 |
| 上架天数 | < 90 天 | `filter_config` 表 |
| BSR 或 销量 | BSR < 50000 或 销量 > 5 | `filter_config` 表 |
| 销量上限 | ≤ 200 | `filter_config` 表 |
| 30天无销量无排名 | 淘汰 | `filter_config` 表 |
| 重量 | < 300g | `filter_config` 表 |
| 配送方式 | FBA/FBM（AMZ 淘汰） | 硬编码 |

### 模式二（满足其一即可）

| 条件 | 阈值 |
|------|------|
| BSR | < 20,000 |
| 月销量 | > 50 |

### 筛选结果处理

```
通过模式一 → filter_mode = "MODE1"
通过模式二 → filter_mode = "MODE2"
都不通过   → filter_mode = "FAIL"
  ├─ 原因写入 filter_reasons
  ├─ 写入 skip_asins 表（下次上传拦截）
  └─ 更新 competitor_products 记录

通过任一 + 上架 ≤ 30天 → product_30day_new 表
提取 seller_id → shops 表（唯一键去重）
```

### 精筛配置

通过 `GET/PUT /api/v1/filter-config` 读写，存储在 `api_config` 表（key 前缀 `filter_`）。

前端在「全部选品」页面 → 展开「精筛配置」面板可修改，保存后**立即生效**，无需重启。

---

## 第五步：进度日志

执行日志格式：

```
[1/2] 入库 150 条(2页) | 父:40 变体:110 | 模式一:5 模式二:12 淘汰:133 | 30天新品:2
[2/2] 入库 120 条(1页) | 父:40 变体:80 | 模式一:8 模式二:3 淘汰:109 | 30天新品:1
```

---

## 第六步：任务完成后统计

`asin_import_tasks` 表记录：

| 字段 | 含义 |
|------|------|
| total_count | 上传总 ASIN 数 |
| pass_count | 初筛通过数 |
| price_fail_count | 价格淘汰 |
| review_fail_count | 评论淘汰 |
| duplicate_count | 文件内重复 |
| skip_count | 跳过总数（主表 + 黑名单） |
| batch_total | 批次数 |
| api_success | 入库总条数 |
| api_fail | 失败条数 |
| **api_requests_used** | 实际 API 请求次数（含翻页） |
| **parent_asin_count** | 父 ASIN 数 |
| **variant_asin_count** | 变体 ASIN 数 |
| **data_month** | 数据月份 YYYYMM |
| created_at | 创建时间 |
| updated_at | 完成时间 |

---

## 第七步：导入历史侧边栏

前端 ASIN 导入页面右上角「导入历史」→ 打开侧边栏（Drawer）：

- **使用次数条**：本月已用 X / 上限 Y
- **按月分组**：最新月份在前
- **卡片摘要**：状态标签 + 市场 + 时间 + 上传/通过/入库数
- **点击展开**：价格淘汰、评论淘汰、跳过数、批次数、API 请求次数、父 ASIN 数、变体 ASIN 数、完成时间

数据来源：`GET /api/v1/asin-import/history` + `GET /api/v1/competitor/quota`

---

## 数据流全貌

```
八爪鱼 Excel
  ↓ upload
初筛（价格/评论/去重/跳过）
  ↓ 预览确认
API 调用（40个/批，N含变体，size=100，智能翻页）
  ↓
卖家精灵 API 返回（父ASIN + 变体子ASIN）
  ↓
入库 competitor_products（所有 item + 父ASIN追踪记录）
  ↓
精筛（模式一 + 模式二）
  ↓ 不通过 → skip_asins
  ↓ 通过 + ≤30天 → product_30day_new
  ↓ 店铺 → shops
  ↓
评分（ScoringService：FBM特判 + 4维度加权）
  ↓
前端选品页面展示
```

---

## 卖家精灵使用次数

| 限制 | 默认值 | 可修改 |
|------|--------|--------|
| 每分钟 | 10 次 | `PUT /api/v1/competitor/quota` |
| 每月 | 20000 次 | `PUT /api/v1/competitor/quota` |
| 单次 ASIN | 40 个 | `PUT /api/v1/competitor/quota` |

使用次数上限存储在 `api_config` 表，修改即时生效。每次 `competitorLookup` 调用记录到 `competitor_lookup_log`。
