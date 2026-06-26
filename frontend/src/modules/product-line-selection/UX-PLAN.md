# 品线选品 — 用户体验优化实施方案

> 基于 12 项痛点分析，按 P0/P1/P2 分级。
> 每项包含：当前行为 → 目标行为 → 具体代码变更 → 验收标准。
> 文件路径均以 `frontend/src/modules/product-line-selection/` 为根。

---

## P0 — 功能缺失 / 操作中断

### 1. 筛选自动触发（去掉「应用全部筛选」按钮）

**现状：** 用户点击模型中的元素/载体/关键词后，筛选条件被加入 `activeFilters`，但搜索不会触发。用户必须再点「应用全部筛选」按钮才能看到结果。

**目标：** 点击模型中的元素/载体/关键词时，自动触发搜索。把「应用全部筛选」按钮改为「清除筛选」。

**文件：** `store.ts`（`addFilter` 方法）

```typescript
// store.ts — 改造 addFilter 方法返回是否需要立即搜索
function addFilter(type: FilterType, label: string, value: string, source: string) {
  const exists = activeFilters.value.find(f => f.value === value && f.type === type)
  if (exists) return
  activeFilters.value.push({ id: `f-${++_filterSeq}`, type, label, value, source })
  // 每次添加筛选后自动触发搜索
  searchCompetitors()
}
```

**文件：** `index.vue`（action-bar 区域）

```diff
- <el-button type="primary" :disabled="!store.hasFilters" :loading="store.competitorLoading" @click="store.searchCompetitors()">
-   应用全部筛选
- </el-button>
+ <el-button v-if="store.hasFilters" size="small" @click="store.clearFilters(); store.searchCompetitors()">
+   清除筛选
+ </el-button>
```

**验收：**
- [ ] 点击元素/载体 → 自动加载竞品结果
- [ ] 筛选标签存在时显示「清除筛选」按钮
- [ ] 无筛选时隐藏「清除筛选」按钮

---

### 2. 批量操作加反馈消息

**现状：** `batchAddToSelection` 和 `exportSelectedExcel` 成功/失败时只有 `console.warn`，用户不知道操作结果。

**文件：** `store.ts`

```diff
async function batchAddToSelection() {
  const products = Array.from(selectedProducts.value)
  if (products.length === 0) return
  try {
    await selectionApi.create({
      products, marketplace: marketplace.value,
      nodeId: selectedNodeId.value || undefined,
      bsrId: selectedBsrId.value || undefined,
    })
+   ElMessage.success(`已加入 ${products.length} 件商品到选品库`)
    selectedProducts.value = new Set()
  } catch (err) {
-   console.warn('[Store]', err)
+   ElMessage.error('批量加入选品失败，请重试')
  }
}

async function exportSelectedExcel() {
  const products = Array.from(selectedProducts.value)
  if (products.length === 0) return
  try {
    const blob = await selectionApi.exportSelectedAsins(products)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `selected-asins-${Date.now()}.xlsx`
    a.click(); window.URL.revokeObjectURL(url)
+   ElMessage.success(`已导出 ${products.length} 条 ASIN`)
  } catch (err) {
-   console.warn('[Store]', err)
+   ElMessage.error('导出 Excel 失败，请重试')
  }
}
```

另外补全：

```diff
async function selectCategory(bsrId: string, name: string) {
  // ... 现有代码
  await loadProducts({ bsrId })
+ if (competitorResults.value.length === 0) {
+   ElMessage.info('该大类下暂无商品数据')
+ }
}

async function fetchTree() {
  // ...
  } catch (err) {
    console.warn('[Store]', err)
+   ElMessage.error('品线树加载失败，请检查网络或刷新重试')
  }
}

async function fetchBatchesList() {
  // ...
  } catch (err) {
    console.warn('[Store]', err)
+   ElMessage.error('批次列表加载失败')
  }
}
```

**验收：**
- [ ] 批量加入选品 → 弹成功提示并显示数量
- [ ] 导出 ASIN → 弹成功提示
- [ ] 品线树加载失败 → 弹错误提示而不是空白

---

### 3. 卡片网格加「全选当前页」

**现状：** 用户必须逐个点击每张卡片上的 checkbox。

**文件：** `CompetitorCardGrid.vue`

```diff
  <div class="card-grid-container">
+   <!-- 工具栏 -->
+   <div v-if="total > 0" class="grid-toolbar">
+     <span class="grid-count">共 {{ total }} 件</span>
+     <span v-if="selectedCount > 0" class="grid-selected">已选 {{ selectedCount }} 件</span>
+     <el-button size="small" text type="primary" @click="selectAllCurrent">
+       {{ allSelectedOnPage ? '取消全选' : '全选当前页' }}
+     </el-button>
+   </div>
    <SkeletonWrapper :loading="loading" variant="card-grid" :count="12">
```

对应的 script 部分：

```diff
  interface Props {
    products: CompetitorProductRaw[]
    total: number
    loading: boolean
    currentPage: number
    pageSize: number
    selectedAsins?: Set<string>
+   selectedCount?: number
  }

  interface Emits {
    (e: 'cardClick', product: CompetitorProductRaw): void
    (e: 'toggleSelect', asin: string): void
    (e: 'viewDetail', product: CompetitorProductRaw): void
    (e: 'pageChange', page: number): void
    (e: 'sizeChange', size: number): void
+   (e: 'selectAllCurrent'): void
+   (e: 'deselectAllCurrent'): void
  }
+ 
+ function selectAllCurrent() {
+   if (allSelectedOnPage.value) {
+     emit('deselectAllCurrent')
+   } else {
+     emit('selectAllCurrent')
+   }
+ }
+ 
+ const allSelectedOnPage = computed(() => {
+   const set = props.selectedAsins
+   if (!set || !props.products.length) return false
+   return props.products.every(p => set.has(p.asin))
+ })
```

```diff
  .card-grid-container {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
+ 
+ .grid-toolbar {
+   display: flex;
+   align-items: center;
+   gap: 12px;
+   padding: 8px 16px;
+   border-bottom: 1px solid border-color;
+   font-size: 13px;
+   .grid-count { color: text-tertiary; }
+   .grid-selected { color: primary-color; font-weight: 600; }
+ }
```

**文件：** `index.vue`（父组件）

```diff
  <CompetitorCardGrid
    :products="store.competitorResults"
    :total="store.competitorTotal"
    :loading="store.competitorLoading"
    :current-page="store.competitorPage"
    :page-size="store.competitorPageSize"
    :selected-asins="store.selectedProducts"
+   :selected-count="store.selectedCount"
    @toggle-select="..."
    @card-click="openDetail"
    @page-change="store.goToPage"
    @size-change="..."
+   @select-all-current="store.selectAllOnPage(store.competitorResults)"
+   @deselect-all-current="store.clearSelection()"
  />
```

**验收：**
- [ ] 卡片网格顶部显示「共 N 件」+ 选中计数
- [ ] 点击「全选当前页」→ 当前页所有卡片打勾
- [ ] 再次点击 → 取消全选
- [ ] 跨页后，上一页的全选状态保持

---

### 4. 错误静默修复（已部分覆盖于 #2）

同上 #2 的 `fetchTree` / `fetchBatchesList` 加 `ElMessage.error` 部分。

---

## P1 — 操作效率低

### 5. L1/L2 差异说明

**现状：** 用户不知道 L1 → 浏览全部、L2 → 查看 AI 模型 + 精细筛选。

**文件：** `CompetitorCardGrid.vue`（空状态文案）

```diff
- <el-empty v-if="!loading && products.length === 0" description="点击左侧品线大类或小类查看竞品" />
+ <el-empty v-if="!loading && products.length === 0" description="点击左侧大类浏览全部商品，点击子类加载 AI 品线模型" />
```

**文件：** `index.vue`（L1 选中时，class `cat-l1.active` 区域加提示）

```diff
  <div v-if="store.selectedBsrId" class="category-header">
    <span class="cat-l1" :class="{ clickable: !!store.selectedNodeId, active: !store.selectedNodeId }" 
          @click="store.selectedNodeId && store.selectCategory(...)">
      📦 {{ store.selectedBsrName }}
    </span>
    <template v-if="store.selectedNodeId && store.selectedNodeName">
      <span class="cat-sep">/</span>
      <span class="cat-l2 active">{{ store.selectedNodeName }}</span>
    </template>
+   <span v-if="!store.selectedNodeId" class="cat-hint">显示大类全部商品</span>
+   <span v-else class="cat-hint">AI 模型分析筛选</span>
  </div>
```

```scss
.cat-hint {
  margin-left: auto;
  font-size: 11px;
  color: text-tertiary;
  letter-spacing: 0.02em;
}
```

**验收：** 选中 L1 时显示「显示大类全部商品」，选中 L2 时显示「AI 模型分析筛选」

---

### 6. 卡片网格按 BSR/价格/销量排序

**现状：** 商品按后端顺序排列，用户无法排序。

**文件：** `CompetitorCardGrid.vue`（工具栏加排序选项）

```diff
  <div v-if="total > 0" class="grid-toolbar">
    <span class="grid-count">共 {{ total }} 件</span>
+   <span class="grid-spacer" />
+   <el-select v-model="sortBy" size="small" style="width:130px" @change="$emit('sortChange', sortBy)">
+     <el-option label="默认排序" value="" />
+     <el-option label="BSR ↑" value="bsr_asc" />
+     <el-option label="BSR ↓" value="bsr_desc" />
+     <el-option label="价格 ↑" value="price_asc" />
+     <el-option label="价格 ↓" value="price_desc" />
+     <el-option label="月销 ↑" value="units_asc" />
+     <el-option label="月销 ↓" value="units_desc" />
+   </el-select>
```

```diff
  interface Props {
+   sortBy?: string
  }
  interface Emits {
    // ... 现有
+   (e: 'sortChange', sortBy: string): void
  }
```

**文件：** `store.ts`（新增 `sortBy` 状态 + `loadProducts` 参数）

```typescript
const sortBy = ref('')

function setSortBy(val: string) {
  sortBy.value = val
  // 排序变化时重新加载当前数据（如果 API 支持服务端排序）
  if (selectedNodeId.value || selectedBsrId.value) {
    loadProducts({ 
      nodeId: selectedNodeId.value ? Number(selectedNodeId.value) : undefined,
      bsrId: selectedBsrId.value || undefined,
    })
  }
}
```

`loadProducts` 函数中新增参数：

```diff
  async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
    // ...
    const params: Record<string, any> = {
      marketplace: marketplace.value,
      month: month.value.replace('-', ''),
      page: competitorPage.value,
      size: competitorPageSize.value,
+     sortBy: sortBy.value || undefined,
    }
```

**文件：** `index.vue`（绑定 sortChange）

```diff
  <CompetitorCardGrid
+   :sort-by="store.sortBy"
    ...
+   @sort-change="store.setSortBy"
  />
```

**验收：** 下拉选择排序条件后，商品列表按选中规则重新排序

---

### 7. 树展开状态保持

**现状：** `treeData.value` 在每次 fetch 时只展开第一个分组。

**文件：** `store.ts`

```diff
  treeData.value = raw.map((g: ProductLineGroup, idx: number) => {
    const l1Name = g.bsrName || (g.subCategories?.[0]?.nodeFullPath?.split(':')[0]) || g.bsrId
+   // 维持已有展开状态
+   const existing = treeData.value.find(t => t.id === g.bsrId)
    return {
      id: g.bsrId,
      name: l1Name,
      icon: '📦',
-     expanded: idx === 0,
+     expanded: existing?.expanded ?? idx === 0,
      children: (g.subCategories || []).map(...)
    }
  })
```

**验收：** 点击展开分组 B → 切换月份/版本后 → 分组 B 保持展开状态

---

### 8. 搜索词跨类目保留

**现状：** `selectCategory` 和 `selectSubCategory` 都 `searchKeyword.value = ''`。

**文件：** `store.ts`

```diff
  async function selectCategory(bsrId: string, name: string) {
    selectedNodeId.value = ''
    selectedNodeName.value = ''
    selectedNodeHealth.value = 'healthy'
    selectedBsrId.value = bsrId
    selectedBsrName.value = name
    clearFilters()
    closeResults()
    competitorPage.value = 1
    selectedProducts.value = new Set()
-   searchKeyword.value = ''
    modelData.value = null
    modelLoading.value = false
    await loadProducts({ bsrId })
  }

  async function selectSubCategory(nodeId: number, name: string, bsrId: string, health?: string) {
    // ...
    competitorPage.value = 1
    selectedProducts.value = new Set()
-   searchKeyword.value = ''
    // ...
  }
```

**验收：** 在搜索框输入关键词 → 点击另一个类目 → 关键词不丢失

---

### 9. ModelSummaryBar 默认折叠

**现状：** 模型面板默认展开，展现在商品卡片列表之前，占用大量垂直空间。

**文件：** `ModelSummaryBar.vue`

```diff
- const expanded = ref(false)
+ const expanded = ref(false)  // 始终默认折叠
```

如果希望用户首次看到模型时感知到内容存在，可以在摘要行加上可视提示：

```diff
  <div v-if="!expanded" class="summary-row" @click="expanded = true">
    <span class="health-badge" :class="healthClass">
      <span class="health-dot"></span>
      {{ healthLabel }}
    </span>
    <span class="summary-text">{{ summaryLine }}</span>
-   <span class="expand-icon">▸ 展开</span>
+   <span class="expand-icon">▸ 展开模型详情</span>
  </div>
```

**验收：** 选中子类后模型摘要默认只显示折叠行，用户手动点击展开

---

## P2 — 体验增强

### 10. 跨页选中记忆

**现状：** 翻页后选中状态丢失。

**文件：** `store.ts`

`selectedProducts` 本身就是 `ref(new Set<string>())`，天然跨页有效。问题是翻页后用户看不到哪些是已选的。

`CompetitorCardGrid` 已经通过 `selectedAsins` prop 传了 Set，只要 card 的实现检查 `selectedAsins?.has(item.asin)`，跨页的选中状态是保留的。

**现状实际上没有 bug，但用户无法直观感知跨页选中。建议在分页栏加提示：**

```diff
  <div class="grid-footer" v-if="total > 0">
+   <span v-if="selectedCount && selectedCount > pageSize" class="cross-page-hint">
+     已跨页选中 {{ selectedCount }} 件商品
+   </span>
    <el-pagination ... />
  </div>
```

---

### 11. 商品对比（后端配合）

**这是一个新功能，需要后端配合。** 暂不纳入前端计划，此处只记录设计思路：

- 在卡片左上角加「对比」checkbox（区别于「选中」）
- 最多选择 3-4 个 ASIN
- 点击「对比」按钮 → 在新区域/弹窗中并排显示多列商品数据

**工作量：** 前端 1 天 + 后端按需

---

### 12. 详情弹窗关闭后保持页码

**现状：** 关闭 `ProductDetailDialog` 后页面不重置，但需要确认。

**检查：** `openDetail` 不修改 `competitorPage`，`detailVisible` 也独立控制。**当前行为大概率 OK。** 如果发现弹窗关闭后页码跳到第 1 页，检查 `ProductDetailDialog` 的 `close` 事件是否意外触发了搜索。

---

## 执行顺序 & 工作量

| 轮次 | 项 | 文件数 | 代码变更 | 预计时间 |
|------|----|--------|---------|---------|
| Round 1 | #1 筛选自动触发 + 清除按钮 | 2 文件 | ~10 行 | 20 分钟 |
| Round 1 | #2 操作反馈 + 错误消息 | 1 文件 | ~20 行 | 15 分钟 |
| Round 1 | #3 全选当前页 | 2 文件 | ~50 行 | 30 分钟 |
| Round 1 | #9 模型默认折叠 | 1 文件 | ~2 行 | 5 分钟 |
| Round 2 | #5 L1/L2 差异说明 | 2 文件 | ~15 行 | 20 分钟 |
| Round 2 | #6 排序功能 | 3 文件 | ~60 行 | 40 分钟 |
| Round 2 | #7 树展开保持 | 1 文件 | ~3 行 | 10 分钟 |
| Round 2 | #8 搜索词保留 | 1 文件 | ~2 行 | 5 分钟 |
| Round 3 | #10 跨页选中提示 | 1 文件 | ~8 行 | 15 分钟 |
| Round 3 | #12 页码保持验证 | 1 文件 | 验证，无变更 | 10 分钟 |

**总预估：** 约 2.5 小时（不含对比功能）

所有 P0 项可在 **1 小时内**完成。
