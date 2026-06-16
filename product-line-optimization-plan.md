# 品线选品 — 用户体验优化计划 v2

> 基于 `modules/product-line-selection/` 全量代码审查（8 个组件 + store + API + 类型）
> 更新日期：2026-06-14
> 覆盖：19 项缺陷 → 5 个执行轮次 + 1 个架构轮次

---

## 目录

- [Round 1 — 基础交互修复（P0）](#round-1--基础交互修复p0)
- [Round 2 — 信息架构改进（P1）](#round-2--信息架构改进p1)
- [Round 3 — 状态一致性与数据流修复（P1-P2）](#round-3--状态一致性与数据流修复p1-p2)
- [Round 4 — 视觉与交互一致性（P2）](#round-4--视觉与交互一致性p2)
- [Round 5 — 移动端适配修复（P2）](#round-5--移动端适配修复p2)
- [Round 6 — 架构加固（技术债）](#round-6--架构加固技术债)
- [工作量汇总](#工作量汇总)

---

## Round 1 — 基础交互修复（P0）

**目标：消除用户能直接感知到的"不跟手"问题。** 这 4 项是每次使用都会碰到的高频交互。

### 1.1 市场/月份切换确认弹窗不回滚

**文件**：`index.vue:384-408`
**问题**：`ElMessageBox.confirm` 的 `.catch()` 中缺少状态回滚逻辑。

```typescript
// ❌ 当前代码 — 取消后 marketpace 已变为新值但页面空白
.catch(() => { /* 什么都不做 */ })
```

**修复方案**：在 `watch` 触发前保存旧值，取消时回滚：

```typescript
// ✅ 修复
const prevMarketplace = ref('UK')
const prevMonth = ref('2026-05')

// watch 回调前保存
watch([() => store.marketplace, () => store.month], ([newMkp, newMonth], [oldMkp, oldMonth]) => {
  // 缓存旧值用于回滚
  const shouldReset = (oldMkp || prevMarketplace.value) !== newMkp || (oldMonth || prevMonth.value) !== newMonth
  if (!shouldReset) return

  if (store.selectedCount > 0 || store.hasFilters) {
    ElMessageBox.confirm(...)
      .then(() => { /* 正常重置 */ })
      .catch(() => {
        // ✅ 回滚到旧值
        store.marketplace = oldMkp ?? prevMarketplace.value
        store.month = oldMonth ?? prevMonth.value
      })
  } else {
    // 无选中/筛选时直接重置
    resetSelection()
    store.initData()
  }
})
// 在成功的重置时更新前值
prevMarketplace.value = store.marketplace
prevMonth.value = store.month
```

**影响范围**：+12 行，新增 2 个 ref + 回滚逻辑
**难度**：中

---

### 1.2 搜索防抖 + Enter 键双重触发

**文件**：`index.vue:75, 423-429`，`store.ts:392-394`

**问题 1**：`@keyup.enter` 直接调用 `store.searchByKeyword()`，绕过了 `watch` 上绑定的 300ms debounce。

```html
<!-- ❌ 当前 -->
<el-input @keyup.enter="store.searchByKeyword(store.searchKeyword)" />
```

**修复**：

```html
<!-- ✅ 改为只触发输入事件，由 watch 防抖统一处理 -->
<el-input @keyup.enter="store.searchByKeyword(store.searchKeyword)" />
```

→ 改为在 `@keyup.enter` 上只清除防抖 + 立即执行：

```typescript
// index.vue
function handleSearchEnter() {
  if (searchDebounce) clearTimeout(searchDebounce)
  store.searchByKeyword(store.searchKeyword)
}
```

**问题 2**：watch 内 debounce 实现简陋（只在 index.vue 中，不是可复用 composable）。

**修复**：使用项目已有的 `src/utils/debounce.ts`：

```typescript
import { debounce } from '@/utils/debounce'

// setup 中
const debouncedSearch = debounce((val: string) => {
  store.searchByKeyword(val)
}, 300)

watch(() => store.searchKeyword, (val) => {
  debouncedSearch(val)
})
```

**影响范围**：+5 行（替换现有手动 setTimeout 逻辑）
**难度**：低

---

### 1.3 removeFilterByLabel 不触发搜索

**文件**：`store.ts:140-142`
**问题**：`ElementTagCloud` 和 `CarrierGrid` 调用 `removeFilterByLabel`，但该方法不触发 `searchCompetitors()`。

```typescript
// ❌ 当前
function removeFilterByLabel(label: string) {
  activeFilters.value = activeFilters.value.filter(f => !f.label.startsWith(label))
}
```

**修复**：

```typescript
// ✅
function removeFilterByLabel(label: string) {
  activeFilters.value = activeFilters.value.filter(f => !f.label.startsWith(label))
  if (selectedNodeId.value || selectedBsrId.value) searchCompetitors()
}
```

**影响范围**：+1 行
**难度**：低

---

### 1.4 批量操作防重复检查的微任务窗口

**文件**：`store.ts:366-371`
**问题**：`batchAddToSelection` 和 `exportSelectedExcel` 在 async 函数开始处检查 loading 标志，但首个 `await` 之前存在微任务窗口。

```typescript
// ❌ 当前（有基本防重，但不严密）
async function batchAddToSelection() {
  if (batchLoading.value) return  // ← 此处检查
  batchLoading.value = true
  const products = Array.from(selectedProducts.value)
  // ... await ...   ← 此处 yield 后第二个调用可能已通过检查
}
```

**修复**：改为在 `batchLoading` 赋值后立刻 `await` 一个微任务，或使用节流包装：

```typescript
import { throttle } from '@/utils/debounce'

// 包装公共方法
const throttledBatchAdd = throttle(() => {
  // 原有逻辑...
}, 1000)
```

或者在 Vue 模板层就禁用按钮（已绑 `:loading`，但这依赖于 store 状态同步速度）。

**更好的方式**：确保 `index.vue` 中事件绑定是节流的，而不是依赖 store 内部的 loading 状态：

```html
<!-- 禁用按钮方案已足够 — loading 状态 + disabled 属性 -->
<el-button :loading="store.batchLoading" :disabled="store.batchLoading" @click="store.batchAddToSelection()">
```

**影响范围**：+3 行（添加 `:disabled` 绑定）
**难度**：低

---

## Round 2 — 信息架构改进（P1）

**目标：让用户知道"我在哪，我选了啥，还能做什么"**。这些缺陷让用户觉得页面"没有上下文"。

### 2.1 L1/L2 层级切换缺视觉锚点

**文件**：`index.vue:96-110` + CSS 部分
**当前状态**：面包屑上 `cat-l1` 和 `cat-l2` 视觉区分度不够。

**修复方案**：

1. 在面包屑下方添加一个**模式标签条**：

```html
<div v-if="store.selectedBsrId" class="mode-indicator">
  <span class="mode-badge" :class="store.selectedNodeId ? 'mode-l2' : 'mode-l1'">
    {{ store.selectedNodeId ? 'AI 品线模型' : '大类浏览' }}
  </span>
  <span class="mode-desc">
    {{ store.selectedNodeId
      ? `基于 ${store.selectedNodeName} 的 AI 模型进行智能筛选与排序`
      : `浏览 ${store.selectedBsrName} 大类全部 ${store.competitorTotal.toLocaleString()} 件商品` }}
  </span>
</div>
```

2. CSS 强化：
```scss
.mode-indicator {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 20px;
  background: $bg-hover;
  border-bottom: 1px solid $border-color;
  font-size: 12px;
}
.mode-badge {
  padding: 2px 10px; border-radius: $radius-full;
  font-weight: 600; font-size: 11px; letter-spacing: 0.03em;
  &.mode-l1 { background: rgba($primary-color, 0.06); color: $primary-color; }
  &.mode-l2 { background: rgba($info-color, 0.06); color: #0891b2; }
}
.mode-desc { color: $text-tertiary; }
```

**影响范围**：+20 行 HTML + 15 行 CSS
**难度**：低

---

### 2.2 模型摘要面板默认展开 + 状态持久化

**文件**：`ModelSummaryBar.vue`
**问题**：模型首次加载时折叠，用户看不到关键指标，必须手动点击展开。

**修复方案**：

1. **默认标记为已展开**（用户一进入 L2 就看到模型摘要）：

```typescript
watch(() => props.modelData, (data) => {
  if (data && !expanded.value) {
    expanded.value = true  // 首次加载时自动展开
  }
})
```

2. **展开状态持久化到 localStorage**：

```typescript
const EXPAND_STORE_KEY = 'pl-model-expanded:' + (props.modelData?.nodeId || '')
const expanded = ref(localStorage.getItem(EXPAND_STORE_KEY) !== 'false')

watch(expanded, (val) => {
  localStorage.setItem(EXPAND_STORE_KEY, String(val))
})
```

3. **模型加载失败时显示降级提示**（当前只显示"暂无模型数据"，应提示用户"该子类暂无 AI 模型数据，以下为全部商品"——见 Round 6）。

**影响范围**：+10 行
**难度**：低

---

### 2.3 推荐组合"一键应用"加预览 + 批量撤销

**文件**：`ComboCards.vue:50-60`，`store.ts`
**问题**：`applyCombo` 批量添加筛选条件但无预览/汇总/批量撤销。

**修复方案**：

1. 应用成功后弹出轻提示，列出已添加的条件：

```typescript
function applyCombo(combo: ComboItem) {
  const added: string[] = []
  // ... 遍历添加逻辑 ...
  combo.elements.forEach(el => {
    if (!store.activeFilters.find(f => f.value === el && f.type === 'element')) {
      store.addFilter('element', el, el, '推荐组合')
      added.push(el)
    }
  })
  // carrier 同理
  if (added.length > 0) {
    ElMessage.success(`已应用 ${added.length} 个筛选条件: ${added.join(', ')}`)
  }
}
```

2. 添加**一键清除该组合所有筛选**的功能：

```typescript
// store 中新增
function removeFiltersBySource(source: string) {
  activeFilters.value = activeFilters.value.filter(f => f.source !== source)
  searchCompetitors()
}
```

ComboCards 中加撤销按钮：

```html
<button class="combo-undo" v-if="isComboApplied(combo)" @click.stop="undoCombo(combo)">
  撤销
</button>
```

**影响范围**：store +15 行, ComboCards +20 行
**难度**：中

---

### 2.4 商品详情弹窗上下文丢失

**文件**：`ProductDetailDialog/index.vue`
**问题**：弹窗覆盖全部工作区，用户看不到当前品线和筛选条件。

**修复方案**（两种可选）：

**方案 A（推荐）—— 侧边抽屉代替居中弹窗**：
将 `el-dialog` 替换为从右侧滑入的抽屉（`el-drawer`），保留左侧品线树和筛选条件可见：

```html
<el-drawer
  v-model="dialogVisible"
  :title="dialogTitle"
  size="65%"
  direction="rtl"
>
  <!-- 原有内容 -->
</el-drawer>
```

同时增加"关闭后回到之前浏览位置"：

```typescript
// 记住关闭前的滚动位置和页码
watch(dialogVisible, (visible) => {
  if (!visible) {
    restoreScrollPosition()  // 恢复之前记录的 scrollTop
  }
})
```

**影响范围**：修改 `ProductDetailDialog/index.vue` 中的 `el-dialog` → `el-drawer`，移除宽高微调。+5 行。
**难度**：低（Element Plus 原生支持）

---

## Round 3 — 状态一致性与数据流修复（P1-P2）

**目标：消除"用户做了操作但结果不对"的困惑。**

### 3.1 全选当前页跨页误解

**文件**：`CompetitorCardGrid.vue:16-18`，`index.vue`
**问题**："全选当前页"预期和感知不匹配。

**修复方案**：同时展示显式提示 + 可选"全选全部"：

```html
<div class="grid-toolbar">
  <span class="grid-count">共 {{ total }} 件</span>
  <span v-if="selectedCount" class="grid-selected">
    已选 {{ selectedCount }} 件
    <span v-if="selectedCount < total" class="grid-selected-hint">
      （当前页 {{ products.length }} 件）
    </span>
  </span>
  <span class="grid-spacer" />
  <!-- 改为两个按钮 -->
  <el-button v-if="!allSelectedOnPage" size="small" text @click="selectAllCurrent">
    全选当前页
  </el-button>
  <el-button v-if="total > pageSize && selectedCount < total" size="small" text @click="emit('selectAllCurrent')">
    全选全部 {{ total }} 件
  </el-button>
  <el-button v-if="selectedCount > 0" size="small" text type="danger" @click="emit('deselectAllCurrent')">
    清空
  </el-button>
</div>
```

同时 store 新增 `selectAllOnAllPages` 方法，对后端发批量请求遍历所有页。

**影响范围**：CompetitorCardGrid +10 行，store +15 行
**难度**：中（需要后端支持全量选中，或前端分页遍历）

---

### 3.2 Batch 版本切换竞态

**文件**：`index.vue:410-420`，`store.ts:214-233`
**问题**：`watch(selectedBatchId)` 中 `selectCategory` 路径无请求去重。

**修复方案**：

```typescript
// store 中模型已有 _modelReqId，给 loadProducts 也加上
let _productsReqId = 0

async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
  const reqId = ++_productsReqId
  competitorLoading.value = true
  try {
    // ... 请求逻辑 ...
    if (reqId !== _productsReqId) return  // 已过期，丢弃结果
    competitorResults.value = ...
  } finally {
    if (reqId === _productsReqId) competitorLoading.value = false
  }
}
```

**影响范围**：store +5 行（_productsReqId + reqId 检查）
**难度**：低

---

### 3.3 不同来源筛选取值冲突

**文件**：`store.ts:128-133`
**问题**：`addFilter` 的 `exists` 检查只匹配 `value + type`，不同 `source` 的同名元素互相阻塞。

**修复方案**：来源隔离：

```typescript
function addFilter(type: FilterType, label: string, value: string, source: string) {
  // 模型元素/载体允许同名但不同来源（组合推荐 vs 手动点击）
  const exists = activeFilters.value.find(f =>
    f.value === value && f.type === type && f.source === source
  )
  if (exists) return
  activeFilters.value.push({ id: `f-${++_filterSeq}`, type, label, value, source })
  searchCompetitors()
}
```

同时 `removeFilterByLabel` 的 `label.startsWith` 匹配也要改成精确匹配：

```typescript
function removeFilterByLabel(label: string) {
  activeFilters.value = activeFilters.value.filter(f => f.label !== label) // 精确匹配
  if (selectedNodeId.value || selectedBsrId.value) searchCompetitors()
}
```

**影响范围**：store +2 行（exists 判断加 source 匹配）
**难度**：低

---

## Round 4 — 视觉与交互一致性（P2）

**目标：让页面看起来更精致、统一。** 这些是用户可能不会明确说出来但能感觉到"不对"的地方。

### 4.1 分页器双端显示（顶栏 + 底部）

**文件**：`CompetitorCardGrid.vue`
**问题**：分页器只在底部，翻页超过5页后用户需要滚动到底部才能翻页。

**修复方案**：在 grid-toolbar 右侧也嵌入分页：

```html
<div class="grid-toolbar">
  <span class="grid-count">共 {{ total }} 件</span>
  ...
  <span class="grid-spacer" />
  <!-- 顶部分页器（紧凑模式） -->
  <el-pagination
    v-if="total > pageSize"
    :total="total"
    :current-page="currentPage"
    :page-size="pageSize"
    layout="prev, pager, next"
    small
    @current-change="$emit('pageChange', $event)"
  />
  ...
</div>
```

底部保留完整的 `layout="total, sizes, prev, pager, next"`。

**影响范围**：CompetitorCardGrid +6 行
**难度**：低

---

### 4.2 商品卡片信息去重、消除 emoji 跨平台不一致

**文件**：`UniversalCard/index.vue`, `ProductLineTree.vue`
**问题**：emoji 用作图标跨平台不一致，多个徽章叠加视觉混乱。

**修复方案**：

1. **品线树图标**：L1 图标改为 SVG：

```html
<!-- ProductLineTree.vue 中将 emoji 替换为 SVG -->
<span class="l1-icon">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 12V3l4-2 4 2v9M1 12h12M5 4v6m4-6v6" stroke="currentColor" stroke-width="1.3"/>
  </svg>
</span>
```

2. **卡片类目角标颜色统一**：将 `UniversalCard` 中的紫色渐变 (new/reference/sales-badge) 统一为品牌橙色系：

```scss
// 统一到品牌色
.card-type-badge.new {
  background: linear-gradient(135deg, $primary-light, $primary-color);
}
.card-type-badge.reference {
  background: linear-gradient(135deg, $primary-color, $primary-dark);
}
.card-sales-badge {
  background: $primary-color;
  box-shadow: 0 4px 12px rgba($primary-color, 0.3);
}
```

3. **相似链接按钮**改为圆角实色按钮：

```scss
.card-link-button.open-link {
  background: $primary-color;
  box-shadow: 0 2px 8px rgba($primary-color, 0.25);
}
```

4. **修复 will-change 反模式**：

```scss
// 将 will-change 从 :hover 移出
.universal-card {
  will-change: transform;  // 在元素入 DOM 时设置
  &:hover {
    transform: translateY(-4px);
  }
}
```

**影响范围**：UniversalCard CSS +10 行修改，ProductLineTree +10 行
**难度**：低

---

### 4.3 搜索结果数不显眼

**文件**：`CompetitorCardGrid.vue:121`
**问题**：`grid-count` 字体 13px 普通色，不突出。

**修复**：

```scss
.grid-count {
  font-size: 14px;
  font-weight: 700;
  color: $text-primary;
  font-variant-numeric: tabular-nums;
}
```

**影响范围**：+3 行 CSS
**难度**：极低

---

### 4.4 卡片详情弹窗增加缺失的业务数据

**文件**：`ProductDetailDialog/index.vue`

**补充字段**：
1. BSR 变化率（`bsrCr` / `bsrCv`）
2. 月销量增长率（`unitsGr`）
3. 子类目排名（`subcategories`）
4. `filterMode` 增加简短解释文案

```html
<!-- BSR 变化 -->
<div v-if="product.bsrCr" class="info-item">
  <div class="info-label">BSR 变化率：
  </div>
  <div class="info-value">
    <el-tag :type="product.bsrCr > 0 ? 'danger' : 'success'" size="small">
      {{ product.bsrCr > 0 ? '↑' : '↓' }} {{ Math.abs(product.bsrCr) }}%
    </el-tag>
  </div>
</div>

<!-- 销量增长率 -->
<div v-if="product.unitsGr" class="info-item">
  <div class="info-label">月销增长率：
  </div>
  <div class="info-value">{{ product.unitsGr > 0 ? '+' : '' }}{{ product.unitsGr }}%</div>
</div>

<!-- 子类目排名 -->
<div v-if="product.subcategories?.length" class="info-item">
  <div class="info-label">子类目排名：
  </div>
  <div class="info-value">
    <div v-for="sub in product.subcategories.slice(0, 3)" :key="sub.code">
      #{{ sub.rank }} {{ sub.label }}
    </div>
  </div>
</div>
```

**影响范围**：ProductDetailDialog +25 行
**难度**：低

---

## Round 5 — 移动端适配修复（P2）

**目标：手机上的体验不再是"残血版"。**

### 5.1 品线树移动遮罩层无半透明背景

**文件**：`ProductLineTree.vue`
**问题**：`.tree-panel.mobile-open` 全屏弹起时没有半透明遮罩，桌面内容透过树面板可见。

**修复方案**：

```scss
.tree-panel {
  &.mobile-open {
    position: fixed;
    inset: 0;
    z-index: 100;
    width: 100% !important;
    max-width: 100% !important;
    // ↓ 新增遮罩
    &::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: -1;
    }
  }
}
```

**影响范围**：+8 行 CSS
**难度**：低

---

### 5.2 元素标签云移动端响应式

**文件**：`ElementTagCloud.vue:57`

**修复**：

```scss
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// 新增响应式
@media (max-width: 768px) {
  .tag-row {
    gap: 4px;
  }
  .elem-tag {
    font-size: 12px;
    padding: 4px 10px;
  }
}
```

**影响范围**：+8 行 CSS
**难度**：低

---

### 5.3 模型摘要指标行移动端间距

**文件**：`ModelSummaryBar.vue:478-500`

**修复**：

```scss
.metrics-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 768px) {
    gap: 8px;
    .metric-item {
      flex: 1 1 calc(50% - 4px);
      min-width: 0;
    }
  }
}
```

**影响范围**：+6 行 CSS
**难度**：低

---

### 5.4 树拖拽分隔线移动端禁用

**文件**：`index.vue:348-372`
**问题**：`mousedown` 事件在触屏上注册但无实际作用。

**修复**：添加 `touch-action: none` 并确保触屏上不干扰滚动：

```typescript
// 在 topbar 中已有 @media (max-width: 900px) display:none，
// 但还需确保触摸动作不干扰
.tree-resize {
  @media (max-width: 900px) {
    display: none !important;  // 强化 display 优先级
  }
}
```

**影响范围**：+2 行 CSS
**难度**：极低

---

## Round 6 — 架构加固（技术债）

**目标：消除不会立刻暴露但长期侵蚀系统质量的隐患。**

### 6.1 请求取消机制

**文件**：`store.ts`, `api/product-line.ts`, `api/competitor.ts`
**问题**：所有 API 请求无 `AbortController`，快速切换品类导致过时请求覆盖结果。

**修复方案**：

1. 在 store 层面维护一个 `_currentAbortController`：

```typescript
let _currentAbortController: AbortController | null = null

async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
  // 取消上一次未完成的请求
  _currentAbortController?.abort()
  const controller = new AbortController()
  _currentAbortController = controller

  try {
    const res = await competitorApi.getDengZongShopList(params, { signal: controller.signal })
    // ...
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return  // 静默忽略
    ElMessage.error('商品数据加载失败')
  }
}
```

2. API 请求工具 `request.ts` 需要支持传入 `AbortSignal`（改造 `request interceptors`）。

**影响范围**：store +10 行，request.ts +5 行
**难度**：中（需确认 axios 请求拦截器是否透传 `signal`）

---

### 6.2 模型加载失败的降级提示

**文件**：`store.ts:256-267`
**问题**：模型失败后商品列表正常展示但无说明，用户看到"空模型"比看不到模型更困惑。

**修复**：

```typescript
const modelLoadFailed = ref(false)

async function selectSubCategory(...) {
  modelLoadFailed.value = false
  // ...
  getProductLineModel(nodeId, ...)
    .then(res => {
      modelData.value = res?.data ?? null
      modelLoadFailed.value = false
    })
    .catch(() => {
      modelLoadFailed.value = true  // ← 标记降级
      ElMessage.warning('品线模型加载失败，已降级为全量商品模式')
    })
}
```

在模板中：

```html
<!-- ModelSummaryBar 位置 -->
<ModelSummaryBar v-if="store.selectedNodeId" />
<div v-if="store.modelLoadFailed" class="degrade-notice">
  <el-alert title="模型数据不可用" description="当前显示全部商品，AI 筛选暂不可用" type="warning" show-icon :closable="false" />
</div>
```

**影响范围**：store +3 行，index.vue +4 行
**难度**：低

---

### 6.3 组件间筛选耦合去魔法字符串

**文件**：`CarrierGrid.vue:53`，`store.ts`

**问题**：`CarrierGrid` 用 `载体:${c.name}` 作为筛选标签，其他组件不知此约定。

**修复方案**：定义一个筛选常量文件或 store 公用方法：

```typescript
// store 中
const FILTER_LABEL = {
  carrier(name: string) { return `载体:${name}` },
  element(name: string) { return name },
  comboItem(name: string) { return `组合:${name}` },
}
```

`CarrierGrid` 和 `ComboCards` 都引用 `store.FILTER_LABEL` 生成 label。

**影响范围**：store +5 行，CarrierGrid/ComboCards 各改 1 行
**难度**：低

---

### 6.4 商品卡片选中状态双源同步简化

**文件**：`UniversalCard/index.vue:177-181,430-438`

**问题**：卡片顶部有 `el-checkbox`（绑定 `isSelected` + prop 同步），底部还有独立的 `card-select-bar`（emit `toggle-select`）。两个选中机制使用不同的事件链。

**修复方案**：统一为单一选中机制——移除 `card-select-bar` 的独立状态，让底部的"选中此产品"栏也通过复选框的选中状态来渲染：

```html
<div class="card-select-bar" :class="{ selected: isSelected }" @click.stop="handleCardSelectClick">
  <el-icon :size="18"><Select /></el-icon>
  <span>{{ isSelected ? '已选中' : '选中此产品' }}</span>
</div>
```

```typescript
function handleCardSelectClick() {
  isSelected.value = !isSelected.value
  handleSelect(isSelected.value)
}
```

不再通过 emit `toggle-select` 走另一条链路。

**影响范围**：UniversalCard -3 行（移除 emits 中不必要的事件）
**难度**：低

---

### 6.5 CompetitorCardGrid sortBy 双源同步问题

**文件**：`CompetitorCardGrid.vue:84-89`

**问题**：`sortBy` ref + props watch 双源同步在快速切换时可能产生竞态。

**修复方案**：完全依赖 prop 单向数据流，内部不再维护 `sortBy ref`：

```html
<!-- 直接用 props.sortBy 作为 el-select 的 model-value -->
<el-select :model-value="props.sortBy" size="small" style="width:130px" @change="handleSortChange">
```

```typescript
// 不再需要内部 ref 和 watch
function handleSortChange(val: string) {
  emit('sortChange', val)
}
```

**影响范围**：CompetitorCardGrid -15 行（移除 ref + watch + 同步逻辑）
**难度**：低

---

## 工作量汇总

| 轮次 | 类别 | 项数 | 涉及文件 | 代码变更 | 预计时间 | 并行度 |
|------|------|------|----------|----------|----------|--------|
| Round 1 | 基础交互修复 (P0) | 4 | `index.vue`, `store.ts`, `CompetitorCardGrid` | ~+25 行 | 25 min | 可并行 |
| Round 2 | 信息架构改进 (P1) | 4 | `index.vue`, `ModelSummaryBar`, `ComboCards`, `ProductDetailDialog` | ~+60 行 | 40 min | 部分并行 |
| Round 3 | 状态一致性修复 (P1-P2) | 3 | `CompetitorCardGrid`, `store.ts` | ~+30 行 | 30 min | 部分并行 |
| Round 4 | 视觉交互一致性 (P2) | 4 | `UniversalCard`, `ProductLineTree`, `CompetitorCardGrid`, `ProductDetailDialog` | ~+50 行 | 35 min | 可并行 |
| Round 5 | 移动端适配 (P2) | 4 | `ProductLineTree`, `ElementTagCloud`, `ModelSummaryBar`, `index.vue` | ~+25 行 | 15 min | 可并行 |
| Round 6 | 架构加固 (tech debt) | 5 | `store.ts`, `api/*`, `request.ts`, `CarrierGrid`, `UniversalCard`, `CompetitorCardGrid` | ~+40/-20 行 | 45 min | 部分并行 |
| **合计** | **6 轮** | **24** 个子项 | **~12 文件** | **~+230 行** | **~3 小时** | — |

---

## 执行建议

### 优先级建议

```
Round 1 → Round 2 → Round 3
        ↘ Round 4 → Round 5 (可与其他轮次并行)
        ↘ Round 6 (建议单独安排，避免干扰功能修复)
```

### 关键依赖

- **Round 3.1**（全选全部）依赖后端接口支持批量获取全部 ASIN
- **Round 6.1**（请求取消）依赖 `request.ts` 的 axios 实例是否透传 `signal`
- **Round 2.4**（弹窗→抽屉）需要确认 Element Plus 版本是否支持 `el-drawer`

### 最值得立即做的 5 件事

按"付出/回报比"排序：

1. **Round 1.1** 确认弹窗回滚（~12 行，消除最迷惑的页面空白问题）
2. **Round 6.5** sortBy 单向数据流（删除 15 行冗余代码，消除一次潜在竞态）
3. **Round 1.3** removeFilterByLabel 触发搜索（1 行代码，修复筛选取消无反应）
4. **Round 3.2** loadProducts 请求去重（5 行代码，防止快速切换品类时页面闪烁）
5. **Round 2.2** 模型摘要默认展开（10 行代码，让新用户首次进入就看到 AI 分析结果）
