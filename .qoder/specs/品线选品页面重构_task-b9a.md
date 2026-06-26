# 品线选品页面修复 — 数据源 + 榜单逻辑 + 前端交互设计

## Context

上一轮重构已完成 UI 组件（store.ts / CompetitorCardGrid / ModelSummaryBar / index.vue），但页面仍然**不可用**。根因：

| # | Bug | 根因 |
|---|-----|------|
| B1 | **数据源完全错误** | store.ts 调用 `competitorApi.getList()` 查 `competitor_products` 表；品线树数据来自 `deng_zong_shop` 表 |
| B2 | **后端不认 nodeId** | `CompetitorQueryRequest` 没有 `nodeId` 字段，前端传了被忽略 |
| B3 | **后端不认 bsrId** | 没有按大类筛选的参数 |
| B4 | **DengZongShopMapper 无 nodeId/bsrId** | SQL 不支持 |
| B5 | **L1 大类不可点击** | ProductLineTree L1 仅展开/折叠 |
| B6 | **选中后不显示类目名称** | 右侧无标题 |

**目标**: L1/L2 都可点击展示商品，L1 展示大类全量，L2 展示小类 + 模型。

## 正确数据流

```
品线树 (deng_zong_shop → /api/v1/product-line/aggregated-data)
  L1 大类: bsrId (如 "284507")     L2 小类: nodeId (如 12345678)
    ↓                                    ↓
GET /deng-zong-shop/products         GET /deng-zong-shop/products
  ?bsrId=X                             ?nodeId=X
    ↓                                    ↓
商品卡片 (全量大类商品)               商品卡片 + 品线模型
```

## 前端交互设计（详细）

### 页面状态矩阵

| 当前状态 | 树高亮 | 类目导航条 | ModelSummaryBar | 筛选操作栏 | 商品卡片 | 空状态文案 |
|----------|--------|-----------|-----------------|-----------|---------|-----------|
| 无选择 | 无 | 隐藏 | 隐藏 | 隐藏 | 空 | "点击左侧品线大类或小类查看竞品" |
| L1 选中 | L1 行高亮 | `📦 Home & Kitchen` | **隐藏** | **隐藏** | 大类全量商品 | — |
| L2 选中 | L2 行高亮 | `📦 Home & Kitchen / Spatulas` | **显示** | **显示** | 小类商品 | — |

### ProductLineTree.vue 交互

```
┌─ Tree Panel ──────────────────────────┐
│ [🔍 搜索品线或小类...]                │
│                                       │
│ ▼ 📦 Home & Kitchen     5 子类 ←─ L1 行: 点击=选中+展开
│   ● Spatulas                120  ←─ L2 行: 点击=选中
│   ● Cutting Boards           85
│   ○ Mixing Bowls             40
│                                       │
│ ▶ 📦 Sports & Outdoors  3 子类 ←─ 未选中, 点击=选中+展开
│                                       │
└───────────────────────────────────────┘
```

**L1 行点击行为**（拆分为两个点击区域）：
- **箭头区域**（`<span class="arrow">`）: 仅展开/折叠，`@click.stop` 不冒泡
- **其余区域**（icon + 名称 + 子类数）: 选中该大类 + 自动展开子节点 + emit `selectL1`

**L1 active 判断**: `group.id === store.selectedBsrId && !store.selectedNodeId`
- 只有"纯 L1 选中"时 L1 行高亮；选了 L2 后 L1 不高亮（避免双重高亮）

**L2 active 判断**: `String(node.nodeId) === store.selectedNodeId`（保持现有逻辑）

### index.vue 类目导航条

位置：`content-area` 顶部，ModelSummaryBar 之前。

```
┌─ content-area ────────────────────────────────────┐
│ ┌─ category-header ─────────────────────────────┐ │
│ │ 📦 Home & Kitchen  /  Spatulas                │ │
│ │    ↑ 可点击回退L1    ↑ 当前L2(不可点击)        │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ ModelSummaryBar (仅 L2) ─────────────────────┐ │
│ │ 🟢 healthy 85 │ BSR P50: 1,234 │ 评分≥4.2 ...│ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ action-bar (仅 L2) ──────────────────────────┐ │
│ │ [keyword1 ×] [keyword2 ×]  [应用全部筛选]      │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ card-grid ───────────────────────────────────┐ │
│ │ [Card] [Card] [Card] [Card] ...               │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**类目导航条行为**：
- L1 名称：当 L2 选中时**可点击**（回退到 L1 大类视图）；L1 选中时显示为 active 态（不可再点）
- L2 名称：始终显示为 active 态，不可点击（已经在看了）
- 分隔符 `/`：纯文本

---

## Task 1: 后端 — DengZongShopMapper 增加 nodeId/bsrId 过滤

**文件**: `java-backend/sjzm-product/src/main/java/com/sjzm/product/mapper/DengZongShopMapper.java`

### 1.1 `selectGroupedByParent` SQL（第 14-51 行）

在 `category` 条件之后（第 26 行 `category` 后）插入：
```sql
"  <if test='bsrId != null'> AND ds.bsr_id = #{bsrId}</if>" +
"  <if test='nodeId != null'> AND ds.node_id = #{nodeId}</if>" +
```

方法签名增加两个参数（在 `category` 之后、`sortBy` 之前）：
```java
@Param("bsrId") String bsrId,
@Param("nodeId") Long nodeId,
```

### 1.2 `countGroupedByParent` SQL（第 53-72 行）

同样增加两行 SQL 条件和两个 `@Param` 参数。

---

## Task 2: 后端 — DengZongShopController 增加请求参数

**文件**: `java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/DengZongShopController.java`

`/products` 端点（第 30-59 行）增加两个 `@RequestParam`：
```java
@RequestParam(required = false) String bsrId,
@RequestParam(required = false) Long nodeId,
```

调用 Mapper 时传入新参数：
```java
long total = mapper.countGroupedByParent(marketplace, month, brand, sellerName, title, category, bsrId, nodeId);
List<DengZongShop> list = mapper.selectGroupedByParent(
    marketplace, month, brand, sellerName, title, category, bsrId, nodeId, sortBy, safeSortOrder, offset, size);
```

`toResponse` 已返回 nodeId/bsrId（第 181、190 行），无需修改。

---

## Task 3: 前端 store.ts — 切换数据源 + L1/L2 方法

**文件**: `frontend/src/modules/product-line-selection/store.ts`

### 3.1 新增状态
```typescript
const selectedBsrId = ref('')      // L1 大类 ID
const selectedBsrName = ref('')    // L1 大类名称（面包屑用）
```

### 3.2 抽取 `loadProducts(filter)` — 通用商品加载
```typescript
async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
  competitorLoading.value = true
  resultsVisible.value = true
  try {
    const params: Record<string, any> = {
      marketplace: marketplace.value,
      month: month.value,
      page: competitorPage.value,
      size: competitorPageSize.value,
    }
    if (filter.bsrId) params.bsrId = filter.bsrId
    if (filter.nodeId) params.nodeId = filter.nodeId
    if (searchKeyword.value) params.title = searchKeyword.value
    // 模型筛选条件（仅 L2 时有 modelData）
    // ... 保持现有 elementFilters/carrierFilters 等逻辑
    const res = await competitorApi.getDengZongShopList(params)
    competitorResults.value = (res?.data?.list ?? []) as CompetitorProductRaw[]
    competitorTotal.value = res?.data?.total ?? 0
  } catch { competitorResults.value = []; competitorTotal.value = 0 }
  finally { competitorLoading.value = false }
}
```

### 3.3 新增 `selectCategory(bsrId, name)` — L1 大类点击
```typescript
async function selectCategory(bsrId: string, name: string) {
  // 清理 L2 状态
  selectedNodeId.value = ''
  // 设置 L1 状态
  selectedBsrId.value = bsrId
  selectedBsrName.value = name
  // 重置其他
  clearFilters(); closeResults()
  competitorPage.value = 1
  selectedProducts.value = new Set()
  searchKeyword.value = ''
  modelData.value = null        // L1 不加载模型
  modelLoading.value = false
  await loadProducts({ bsrId })
}
```

### 3.4 新增 `selectSubCategory(nodeId, name, bsrId)` — L2 小类点击
替代现有 `selectNode`，保留异步模型加载逻辑：
```typescript
async function selectSubCategory(nodeId: number, name: string, bsrId: string, health?: string) {
  // 设置 L1+L2 状态
  selectedBsrId.value = bsrId
  selectedNodeId.value = String(nodeId)
  selectedNodeName.value = name
  selectedNodeHealth.value = health || 'healthy'
  // 重置
  clearFilters(); closeResults()
  competitorPage.value = 1
  selectedProducts.value = new Set()
  searchKeyword.value = ''
  // 异步加载模型（reqId 防竞态，保持现有逻辑）
  const reqId = ++_modelReqId
  modelLoading.value = true
  modelData.value = null
  getProductLineModel(nodeId, marketplace.value, selectedBatchId.value)
    .then(res => { if (reqId === _modelReqId) modelData.value = res?.data ?? null })
    .catch(() => { if (reqId === _modelReqId) modelData.value = null })
    .finally(() => { if (reqId === _modelReqId) modelLoading.value = false })
  // 立即拉取商品
  await loadProducts({ nodeId })
}
```

### 3.5 改造 `searchCompetitors`
根据当前 L1/L2 状态传参：
```typescript
async function searchCompetitors() {
  const filter: Record<string, any> = {}
  if (selectedNodeId.value) filter.nodeId = Number(selectedNodeId.value)
  else if (selectedBsrId.value) filter.bsrId = selectedBsrId.value
  else return
  await loadProducts(filter)
}
```

### 3.6 改造 `searchByKeyword`
```typescript
async function searchByKeyword(keyword: string) {
  searchKeyword.value = keyword
  competitorPage.value = 1
  await searchCompetitors()  // 自动使用当前 L1/L2 filter
}
```

### 3.7 return 导出
```typescript
// 新增导出
selectedBsrId, selectedBsrName,
selectCategory, selectSubCategory,
// 保留但改名（内部兼容）
// selectNode → 删除或指向 selectSubCategory
```

### 3.8 改造 `goToPage`
```typescript
async function goToPage(page: number) {
  competitorPage.value = page
  await searchCompetitors()  // 自动使用当前 L1/L2 filter
}
```

---

## Task 4: 前端 ProductLineTree.vue — L1 可点击 + emit 事件

**文件**: `frontend/src/modules/product-line-selection/components/ProductLineTree.vue`

### 4.1 扩展 emits + store 引用
```typescript
const emit = defineEmits<{
  closeMobile: []
  selectL1: [bsrId: string, bsrName: string]
  selectL2: [nodeId: number, nodeName: string, bsrId: string]
}>()
```

### 4.2 L1 模板改造：分离箭头点击 vs 行点击
```html
<!-- L1: 大类 -->
<div
  class="tree-l1"
  :class="{ active: group.id === store.selectedBsrId && !store.selectedNodeId }"
  @click="handleL1Click(group)"
>
  <span class="arrow" :class="{ expanded: group.expanded }"
        @click.stop="group.expanded = !group.expanded">
    <el-icon><ArrowRight /></el-icon>
  </span>
  <span class="icon">{{ group.icon }}</span>
  {{ group.name }}
  <span class="count">{{ group.children.length }} 子类</span>
</div>
```

关键点：
- `@click.stop` 在 arrow 上 → 点击箭头只展开/折叠，不选中
- `@click` 在 tree-l1 div 上 → 点击行其他区域 = 选中 + 展开

### 4.3 L2 模板改造：emit 事件 + 传入 parentBsrId
```html
<div
  v-for="node in group.children"
  v-show="group.expanded"
  :key="node.id"
  class="tree-l2"
  :class="{ active: String(node.nodeId) === store.selectedNodeId }"
  @click="handleNodeClick(node, group.id)"
>
```

### 4.4 Script 方法
```typescript
function handleL1Click(group: TreeGroup) {
  group.expanded = true  // 选中时自动展开（方便看到子节点）
  emit('selectL1', group.id, group.name)
}

function handleNodeClick(node: TreeNode, parentBsrId: string) {
  if (node.nodeId == null) return
  emit('selectL2', node.nodeId, node.name, parentBsrId)
}
```

### 4.5 L1 active 样式
```scss
.tree-l1 {
  // ... 现有样式保持
  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.06);
    font-weight: 700;
  }
}
```

---

## Task 5: 前端 index.vue — 事件绑定 + 类目导航条 + 条件渲染

**文件**: `frontend/src/modules/product-line-selection/index.vue`

### 5.1 ProductLineTree 添加事件
```html
<ProductLineTree
  :mobile-open="mobileTreeOpen"
  @close-mobile="mobileTreeOpen = false"
  @select-l1="(bsrId, name) => store.selectCategory(bsrId, name)"
  @select-l2="(nodeId, name, bsrId) => store.selectSubCategory(nodeId, name, bsrId)"
/>
```

### 5.2 类目导航条（content-area 内，ModelSummaryBar 之前）
```html
<div v-if="store.selectedBsrId" class="category-header">
  <span
    class="cat-l1"
    :class="{ clickable: !!store.selectedNodeId, active: !store.selectedNodeId }"
    @click="store.selectedNodeId && store.selectCategory(store.selectedBsrId, store.selectedBsrName)"
  >
    📦 {{ store.selectedBsrName }}
  </span>
  <template v-if="store.selectedNodeId && store.selectedNodeName">
    <span class="cat-sep">/</span>
    <span class="cat-l2 active">{{ store.selectedNodeName }}</span>
  </template>
</div>
```

**样式**:
```scss
.category-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid $border-color;
  font-size: 14px; font-weight: 600;
  background: $bg-color;
}
.cat-l1 {
  color: $text-secondary;
  &.active { color: $primary-color; }
  &.clickable { cursor: pointer; &:hover { color: $primary-color; text-decoration: underline; } }
}
.cat-sep { color: $text-tertiary; }
.cat-l2 { color: $text-secondary; &.active { color: $primary-color; } }
```

### 5.3 ModelSummaryBar — 仅 L2 显示
```html
<ModelSummaryBar
  v-if="store.selectedNodeId"
  :model-data="store.modelData"
  :loading="store.modelLoading"
/>
```

### 5.4 筛选操作栏 — 仅 L2 显示（保持现有条件）
```html
<div v-if="store.selectedNodeId" class="action-bar">
  <!-- 保持不变 -->
</div>
```

### 5.5 CompetitorCardGrid — 始终显示
去掉任何 v-if 条件，始终渲染卡片网格。空状态文案由 CompetitorCardGrid 内部根据 `products.length === 0` 显示。

### 5.6 watch 适配
```typescript
watch(() => store.selectedBatchId, (newId) => {
  if (!newId) return
  if (store.selectedNodeId) {
    store.selectSubCategory(
      Number(store.selectedNodeId), store.selectedNodeName,
      store.selectedBsrId, store.selectedNodeHealth
    )
  } else if (store.selectedBsrId) {
    store.selectCategory(store.selectedBsrId, store.selectedBsrName)
  }
})
```

---

## Task 6: CompetitorCardGrid 空状态文案

**文件**: `frontend/src/modules/product-line-selection/components/CompetitorCardGrid.vue`

第 14 行：`"点击左侧品线小类查看竞品"` → `"点击左侧品线大类或小类查看竞品"`

---

## 实施顺序

| 阶段 | 任务 | 依赖 |
|------|------|------|
| Phase 1 | Task 1 + Task 2（后端 Mapper + Controller） | 无 |
| Phase 2 | Task 3（store.ts 数据源切换 + L1/L2 方法） | Phase 1 |
| Phase 3 | Task 4 + Task 5 + Task 6（前端 Tree + index + CardGrid） | Phase 2 |

## 验证

| # | 操作 | 预期 |
|---|------|------|
| V1 | 点击 L1 大类（如 Home & Kitchen） | 树 L1 行高亮，导航条显示 `📦 Home & Kitchen`，右侧显示该大类全量商品，**无**模型条和筛选栏 |
| V2 | 展开 L1，点击 L2 小类 | 树 L2 行高亮，导航条显示 `📦 Home & Kitchen / Spatulas`，模型条和筛选栏出现，商品切换为小类 |
| V3 | 从 L2 点击面包屑中的 L1 名称 | 模型条消失，商品切回大类全量，导航条只显示 L1 |
| V4 | 在 L1 视图中搜索关键词 | title 参数 + bsrId 传入 API，商品正确过滤 |
| V5 | 在 L2 视图中搜索关键词 | title 参数 + nodeId 传入 API，商品正确过滤 |
| V6 | 分页翻页 | page 参数传入，翻页正常（L1 和 L2 都能翻页） |
| V7 | L2 视图下切换版本（batchId） | 自动重新加载当前 L2 数据和模型 |
| V8 | L1 视图下切换版本 | 自动重新加载当前 L1 数据 |

## 风险注意

1. **DengZongShop 返回格式**: `toResponse` 返回 `Map`，`source` 字段存在（第 222 行），`UniversalCard` 的 `productType` 可正常解析
2. **字段兼容**: `CompetitorProductRaw` 接口字段与 `DengZongShop.toResponse` 完全对应，无需额外映射
3. **模型高级筛选**: `priceMin/priceMax/bsrMax/ratingMin/weightMax` 在 `loadProducts` 中已包含，当 `modelData` 存在时自动附加（仅 L2 模式）
4. **月份格式**: store.ts `month` = `"2026-05"`, 需确认 deng_zong_shop 表 month 字段格式一致

---

## 全面逻辑审查报告

### 一、严重 Bug（功能完全失效）

#### BUG-1: 排序功能完全失效（CRITICAL）

**位置**: `CompetitorCardGrid.vue` 第 8-14 行 + `store.ts` `setSortBy` 第 288-296 行

**问题**: 前端排序下拉发送 `"bsr_asc"`、`"price_desc"` 等合并值，但后端 DengZongShopMapper 需要分离的 `sortBy`（`"bsr"|"price"|"units"`）和 `sortOrder`（`"asc"|"desc"`）两个参数。

**数据流追踪**:
```
UI el-select → emit sortChange("bsr_asc")
→ store.setSortBy("bsr_asc") → sortBy.value = "bsr_asc"
→ loadProducts params.sortBy = "bsr_asc", params.sortOrder = undefined
→ 后端 safeSortOrder 默认 "ASC", sortBy = "bsr_asc"
→ SQL: <otherwise> → ORDER BY t.bsr ASC (永远走默认)
```

**结果**: 用户切换任何排序选项都无效，永远按 BSR 升序。

**修复方案**: `setSortBy` 需要拆分 `"bsr_asc"` → `{ sortBy: "bsr", sortOrder: "asc" }`，并在 `loadProducts` 中传两个参数。

---

### 二、逻辑缺陷（功能部分失效）

#### BUG-2: 移除筛选条件不重置页码

**位置**: `store.ts` `removeFilter` 第 126-128 行

**问题**: `removeFilter` 调用 `searchCompetitors()` 但没有重置 `competitorPage` 到 1。而 `addFilter` 调用 `searchCompetitors()` 会重置（因为 `searchCompetitors` 第 265 行 `competitorPage.value = 1`）。

**场景**: 用户在第 3 页，移除一个筛选 → 数据变少，但还在请求第 3 页 → 可能返回空数据。

**修复**: `removeFilter` 调用前加 `competitorPage.value = 1`。

#### BUG-3: 切换市场/月份不清理搜索词和筛选

**位置**: `index.vue` watch 第 285-301 行

**问题**: 确认后只重置了 `selectedBsrId`、`selectedNodeId`，但未清理 `searchKeyword`、`activeFilters`、`modelData`、`competitorResults`。

**场景**: 用户在 UK 搜了 "ceramic"，切换到 US → 搜索框还有 "ceramic"，但品类数据已变。

**修复**: confirm 分支内增加 `store.searchKeyword = ''`; `store.clearFilters()`; `store.modelData = null`; `store.competitorResults = []`。

#### BUG-4: 搜索框缺少回车触发

**位置**: `index.vue` 第 69-75 行

**问题**: `<el-input>` 没有 `@keyup.enter` 和 `@clear` 事件。虽然有 300ms 防抖（第 316-322 行 watch），但用户习惯按回车立即搜索。而且 `@clear` 缺失导致清空后仍需等 300ms 才触发。

**修复**: 增加 `@keyup.enter="store.searchByKeyword(store.searchKeyword)"` 和 `@clear="store.searchByKeyword('')"`.

---

### 三、体验缺陷（功能可用但不完善）

#### ISSUE-1: `searchCompetitors` 总是重置页码

**位置**: `store.ts` 第 265 行

**问题**: `searchCompetitors()` 第一行就是 `competitorPage.value = 1`。当从 `goToPage` 翻页后 → `@size-change` 触发 `searchCompetitors()` → 页码被重置为 1。用户改了每页条数后跳回第 1 页。

**修复**: `searchCompetitors` 不应该硬编码重置 page=1，应由调用方决定是否重置。或者 `@size-change` 改为调用 `goToPage(1)`。

#### ISSUE-2: L1 视图下筛选栏隐藏但无替代筛选入口

**位置**: `index.vue` 第 148 行

**问题**: `v-if="store.selectedNodeId"` 使筛选栏仅在 L2 显示。L1 大类视图下用户只能用搜索框按标题搜索，没有任何其他筛选方式（如价格范围、BSR 范围、卖家等）。

**建议**: L1 视图可增加简单筛选（如卖家名筛选、价格范围），或直接展示高级筛选面板。

#### ISSUE-3: 批量加入选品后未提示已加入的 ASIN 是否与选品库重复

**位置**: `store.ts` `batchAddToSelection` 第 335-356 行

**问题**: `selectionApi.create` 后只显示"已加入 N 件"，不提示是否有重复/跳过的。对比 AllSelection 的乐观更新 + 多人协作状态，品线选品的选中状态是纯本地的，无多人同步。

---

### 四、对比 AllSelection 缺失功能

| 功能 | AllSelection | 品线选品 | 优先级 |
|------|:---:|:---:|------|
| **排序** | ✅ 完整（BSR/价格/销量/上架/评分/创建时间） | ❌ Bug-1 完全失效 | P0 |
| **筛选预设（保存/加载）** | ✅ 9个槽位 | ❌ 无 | P1 |
| **等级筛选 (S/A/B/C/D)** | ✅ 多选标签 | ❌ 无（DengZongShop 无 grade 字段） | P2 |
| **多项 ASIN 搜索** | ✅ 弹窗2000行 | ❌ 仅标题搜索 | P2 |
| **数据时效筛选** | ✅ 本周/往期 | ❌ 无 | P2 |
| **批量删除** | ✅ 选中后删除 | ❌ 无 | P2 |
| **导入 Excel** | ✅ 三种模式 | ❌ 无 | P2 |
| **下载模板** | ✅ | ❌ 无 | P3 |
| **合并变体开关** | ✅ groupByParent | ❌ 后端固定去重 | P2 |
| **多人协作选中状态** | ✅ 5秒轮询 | ❌ 纯本地 Set | P3 |
| **骨架屏** | ✅ 首次加载 | ✅ SkeletonWrapper | 已有 |
| **搜索回车/清空** | ✅ @keyup.enter + @clear | ❌ 仅防抖 | P1 |
| **全选下拉（当前页/全部/清空）** | ✅ 下拉菜单 | ⚠️ 仅"全选当前页"按钮 | P2 |
| **回收站** | ✅ | ❌ 无 | P3 |
| **商品详情弹窗内删除** | ✅ 支持 | ⚠️ 需验证 | P2 |

---

### 五、已做得好的功能（确认无误）

| 功能 | 状态 |
|------|------|
| L1 大类点击 → 展示全量商品 | ✅ |
| L2 小类点击 → 展示商品 + 品线模型 | ✅ |
| 类目导航条（面包屑可回退 L1） | ✅ |
| ModelSummaryBar 仅 L2 显示 | ✅ |
| 筛选操作栏仅 L2 显示 | ✅ |
| 品线树搜索（支持 L1/L2 名称匹配） | ✅ |
| 搜索关键词 300ms 防抖 | ✅ |
| 移动端 MobileActionSheet 适配 | ✅ |
| 空白状态引导（3 步骤） | ✅ |
| 树加载状态（Loading 图标） | ✅ |
| 错误提示（ElMessage.error） | ✅ |
| 切换版本自动刷新当前选品 | ✅ |
| 分页翻页 | ✅（排序修好后完全可用） |
| 全选当前页/取消全选 | ✅ |
| 批量加入选品 + 导出 Excel | ✅ |
| 骨架屏加载 | ✅ |
| 跨页选中提示 | ✅ |
| 拖拽调整树宽度 | ✅ |
| 模型异步加载 + 防竞态 | ✅ |
| MD 报告弹窗 + XSS 防护 | ✅ |

---

### 六、修复优先级建议

| 优先级 | 编号 | 修复内容 | 影响范围 |
|--------|------|---------|---------|
| **P0** | BUG-1 | 排序值拆分（`setSortBy` + `loadProducts` 传 sortBy/sortOrder） | store.ts + CompetitorCardGrid |
| **P1** | BUG-2 | `removeFilter` 前重置 page=1 | store.ts |
| **P1** | BUG-3 | 切换市场/月份清理搜索词+筛选+结果 | index.vue |
| **P1** | BUG-4 | 搜索框加 `@keyup.enter` + `@clear` | index.vue |
| **P1** | ISSUE-1 | `searchCompetitors` 去掉硬编码 page=1 | store.ts |
| **P2** | ISSUE-2 | L1 视图增加基础筛选能力 | index.vue |
| **P2** | — | 筛选预设功能（参照 AllSelection） | 新增组件 + store |
| **P3** | — | 多人协作选中状态 | 需后端支持 |
