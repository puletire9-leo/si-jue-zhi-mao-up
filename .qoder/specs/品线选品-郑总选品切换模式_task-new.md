# 品线选品 — 切换「郑总模式/选品模式」

## 背景

当前品线选品页面只展示郑总店铺（deng_zong_shop）的数据。需要增加一个「选品模式」，让用户可以切换到 competitor_products 表查看全部品类商品。

---

## 一、核心逻辑

页面默认加载：**郑总模式**（当前行为不变）

顶部工具栏新增切换按钮。点击「选品」按钮 → 切换为选品模式：

| | 郑总模式 | 选品模式 |
|---|---|---|
| 品线树 API | `getAggregatedData()` → `deng_zong_shop` | `getAllCategories()` → `competitor_products` |
| 品线树范围 | 仅郑总有的品类 | 全部品类，郑总优先排序 |
| 商品 API | `getDengZongShopList()` → `deng_zong_shop` | `getList()` → `competitor_products` |
| 模型（ModelSummaryBar） | 有模型即显示 | 同左（不依赖数据源） |
| 排序选项 | 全部 | 全部（无模型专属排序项） |

**切换时清空以下状态：**
- 筛选条件（activeFilters）
- 基础筛选条件（搜索词、卖家、品牌、价格范围）
- 已选商品（selectedProducts）
- 页码（competitorPage → 1）
- 选中 L1/L2（selectedBsrId / selectedNodeId）
- 搜索结果（competitorResults）
- 模型数据（modelData）

---

## 二、改动清单

### 后端 Java（2 处）

#### 1. `CompetitorQueryRequest.java` — 新增筛选字段

```java
// 新增字段
private String bsrId;       // L1 大类筛选
private Integer nodeId;     // L2 小类筛选（已在 CompetitorListParams 前端接口中，后端补齐）
```

#### 2. `CompetitorProductMapper.java` — 新增聚合查询

两个查询方法，返回品类统计（按 bsr_id + node_id 分组，带商品数）：

```sql
-- 按 bsr_id 分组统计 L1
SELECT bsr_id AS bsrId, COUNT(*) AS product_count
FROM competitor_products
WHERE marketplace = #{marketplace} AND month = #{month}
GROUP BY bsr_id
ORDER BY product_count DESC

-- 按 bsr_id + node_id 分组统计 L2
SELECT bsr_id AS bsrId, node_id AS nodeId, MAX(node_label_path) AS nodeFullPath,
       SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName,
       COUNT(*) AS productCount
FROM competitor_products
WHERE marketplace = #{marketplace} AND month = #{month}
GROUP BY bsr_id, node_id
ORDER BY bsr_id, productCount DESC
```

#### 3. `ProductLineController.java` — 新增 `all-categories` 端点

```
GET /api/v1/product-line/all-categories?marketplace=UK&month=202605
```

返回格式与 `aggregated-data` 兼容：

```json
{
  "productLines": [
    {
      "bsrId": "kitchen",
      "bsrName": "Kitchen & Dining",
      "productCount": 17379,
      "subCategories": [
        {
          "nodeId": 3028635031,
          "nodeName": "Signs & Plaques",
          "nodeFullPath": "Home & Kitchen:...",
          "productCount": 320
        }
      ]
    }
  ]
}
```

排序规则：
- L1：先按「郑总已有 bsrId」排前，其余按 `productCount` 降序
- L2：先按「郑总已有 nodeId」排前，其余按 `productCount` 降序

「郑总已有」的判断方式：调用 aggregated-data 接口或查 deng_zong_shop 表去重，取其 bsrId/nodeId 集合用于排序。

### 前端（4 处改动）

#### 1. `api/product-line.ts` — 新增 API 方法

```typescript
export function getAllCategories(marketplace: string, month: string) {
  return request({
    url: '/api/v1/product-line/all-categories',
    method: 'get',
    params: { marketplace, month }
  })
}
```

#### 2. `store.ts` — 新增 `dataSource` 状态 + 分支逻辑

```typescript
type DataSource = 'zheng' | 'selection'
const dataSource = ref<DataSource>('zheng')

function setDataSource(source: DataSource) {
  dataSource.value = source
  // 清空所有状态
  clearFilters()
  clearBasicFilters()
  selectedProducts.value = new Set()
  competitorPage.value = 1
  searchKeyword.value = ''
  selectedBsrId.value = ''
  selectedBsrName.value = ''
  selectedNodeId.value = ''
  selectedNodeName.value = ''
  competitorResults.value = []
  modelData.value = null
  // 重新加载
  initData()
}
```

修改 `fetchTree()`：

```typescript
async function fetchTree() {
  treeLoading.value = true
  try {
    const mkp = marketplace.value
    const mo = month.value.replace('-', '')
    const res = dataSource.value === 'zheng'
      ? await getAggregatedData(mkp, mo)
      : await getAllCategories(mkp, mo)
    // 后续解析逻辑不变（格式兼容）
    ...
  }
}
```

修改 `loadProducts()` — 第 215 行：

```typescript
// 原: const res = await competitorApi.getDengZongShopList(params)
// 改为按数据源分支:
const res = dataSource.value === 'zheng'
  ? await competitorApi.getDengZongShopList(params)
  : await competitorApi.getList(params)
```

修改 `selectCategory()` / `selectSubCategory()` — 跳过 model 加载的判断：

```typescript
// 选品模式下也尝试加载模型，有就显示没有就静默跳过
async function selectSubCategory(nodeId: number, name: string) {
  ...
  // 尝试加载模型 — 不管什么模式，有模型就显示
  await loadModel(selectedNodeId.value).catch(() => {})
  ...
}
```

#### 3. `index.vue` — 顶部工具栏加切换按钮

在顶部（或树面板上方）加切换开关：

```html
<el-radio-group v-model="store.dataSource" size="small" @change="store.setDataSource">
  <el-radio-button value="zheng">📦 郑总模式</el-radio-button>
  <el-radio-button value="selection">🔍 选品模式</el-radio-button>
</el-radio-group>
```

#### 4. `CompetitorCardGrid.vue` — 无需修改

当前排序项只有 `BSR ↑/↓`、`价格 ↑/↓`、`月销 ↑/↓`，无模型专属项。跳过。

---

## 三、store 核心伪代码

```typescript
type DataSource = 'zheng' | 'selection'
const dataSource = ref<DataSource>('zheng')

function setDataSource(source: DataSource) {
  dataSource.value = source
  clearFilters()
  clearBasicFilters()
  selectedProducts.value = new Set()
  competitorPage.value = 1
  searchKeyword.value = ''
  selectedBsrId.value = ''
  selectedBsrName.value = ''
  selectedNodeId.value = ''
  selectedNodeName.value = ''
  competitorResults.value = []
  modelData.value = null
  initData()
}

// fetchTree
async function fetchTree() {
  const res = dataSource.value === 'zheng'
    ? await getAggregatedData(mkp, mo)
    : await getAllCategories(mkp, mo)
  // 解析逻辑不变
}

// loadProducts
async function loadProducts(filter) {
  const params = { marketplace, month, page, size, ... }
  // 入参构造不变（model 自动跳过因为 modelData=null）
  const res = dataSource.value === 'zheng'
    ? await competitorApi.getDengZongShopList(params)
    : await competitorApi.getList(params)
  competitorResults.value = res.data.list
  competitorTotal.value = res.data.total
}
```

---

## 四、不涉及的部分

| 模块 | 说明 |
|------|------|
| ModelSummaryBar / ProductLineModel | 无论什么模式，有模型就显示，没有就隐藏。不改 |
| 排序选项 | 无需修改 |
| 商品卡片/详情对话框 | 复用现有组件，不改 |
| 现有郑总模式逻辑 | 完全不变 |

---

## 五、改动文件总表

| 文件 | 改动 | 行数预估 |
|------|------|---------|
| `java-backend/.../dto/CompetitorQueryRequest.java` | 新增 `bsrId` + `nodeId` 字段 | +3行 |
| `java-backend/.../mapper/CompetitorProductMapper.java` | 新增按 bsrId/nodeId 分组统计查询 | +10行 |
| `java-backend/.../controller/ProductLineController.java` | 新增 `/all-categories` 端点 | +40行 |
| `frontend/src/api/product-line.ts` | 新增 `getAllCategories()` | +5行 |
| `frontend/src/modules/product-line-selection/store.ts` | 新增 `dataSource` + `setDataSource` + `fetchTree`/`loadProducts` 分支 | ~50行 |
| `frontend/src/modules/product-line-selection/index.vue` | 工具栏增加切换按钮 | ~20行 |

## 六、验证

1. 默认进入 → 郑总模式，品线树/商品/模型均正常 ← 已有行为不变
2. 点击「选品」→ 品线树刷新为 competitor_products 全部品类，郑总品类排前
3. 点击小类 → 商品从 competitor_products 加载，有模型的 nodeId 显示模型
4. 点击「郑总模式」→ 回到原有行为，状态全部重置
5. 切换过程中无白屏/报错
