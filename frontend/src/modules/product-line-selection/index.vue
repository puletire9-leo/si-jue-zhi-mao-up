<template>
  <div class="selection-page">
    <!-- 顶部工具栏 -->
    <div class="topbar">
      <div class="tb-brand"><span>思觉智贸</span> · 选品</div>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>选品中心</el-breadcrumb-item>
        <el-breadcrumb-item>品线选品</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="tb-spacer" />

      <label class="tb-select desktop-only">
        站点
        <el-select v-model="store.marketplace" size="small" style="width:80px">
          <el-option label="US" value="US" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
        </el-select>
      </label>

      <label class="tb-select desktop-only">
        月份
        <el-select v-model="store.month" size="small" style="width:100px">
          <el-option
            v-for="m in monthOptions"
            :key="m"
            :label="m"
            :value="m"
          />
        </el-select>
      </label>

      <label class="tb-select desktop-only">
        版本
        <el-select v-model="store.selectedBatchId" size="small" style="width:180px">
          <el-option
            v-for="b in store.batches"
            :key="b.batchId"
            :label="b.batchId"
            :value="b.batchId"
          />
        </el-select>
        <span v-if="store.selectedBatchInfo" class="batch-meta">
          v{{ store.selectedBatchInfo.dataVersion }}
          · {{ store.selectedBatchInfo.status }}
          · {{ store.selectedBatchInfo.analyzedAt }}
        </span>
      </label>

      <MobileActionSheet
        class="mobile-only"
        title="站点"
        :options="siteOptions"
        v-model="store.marketplace"
      />
      <MobileActionSheet
        class="mobile-only"
        title="月份"
        :options="monthActionOptions"
        v-model="store.month"
      />
      <MobileActionSheet
        class="mobile-only"
        title="版本"
        :options="batchOptions"
        v-model="store.selectedBatchId"
      />

      <el-input
        v-model="store.searchKeyword"
        placeholder="搜索商品标题..."
        clearable
        style="width:240px"
        size="small"
        @keyup.enter="store.searchByKeyword(store.searchKeyword)"
        @clear="store.searchByKeyword('')"
      />

      <button class="mobile-tree-btn" @click="mobileTreeOpen = true">
        <el-icon><Menu /></el-icon> 品线
      </button>
    </div>

    <!-- 工作区 -->
    <div class="workspace">
      <ProductLineTree
        :mobile-open="mobileTreeOpen"
        @close-mobile="mobileTreeOpen = false"
        @select-l1="(bsrId, name) => store.selectCategory(bsrId, name)"
      />

      <!-- 拖拽分隔线 (桌面端) -->
      <div class="tree-resize" @mousedown="startResize" />

      <div class="content-area">
        <!-- 类目导航条 -->
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
          <span v-if="!store.selectedNodeId" class="cat-hint">显示大类全部商品</span>
          <span v-else class="cat-hint">AI 模型分析筛选</span>
        </div>

        <!-- L2 子类面板：选中 L1 后显示 -->
        <div v-if="store.selectedBsrId && store.currentSubCategories.length" class="l2-panel">
          <div class="l2-search">
            <el-input
              v-model="subCategorySearch"
              placeholder="搜索子类…"
              :prefix-icon="Search"
              clearable
              size="small"
            />
            <span class="l2-count">{{ displaySubCategories.length }} / {{ store.currentSubCategories.length }} 子类</span>
          </div>
          <div class="l2-list">
            <div
              v-for="cat in displaySubCategories"
              :key="cat.id"
              class="l2-item"
              :class="{ active: String(cat.nodeId) === store.selectedNodeId }"
              @click="handleL2ItemClick(cat)"
            >
              <span class="l2-item-name">{{ cat.name }}</span>
              <span class="l2-item-count">{{ cat.productCount?.toLocaleString() || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- 品线模型摘要条 -->
        <ModelSummaryBar
          v-if="store.selectedNodeId"
          :model-data="store.modelData"
          :loading="store.modelLoading"
        />

        <!-- 模型加载失败降级提示 -->
        <div v-if="store.modelLoadFailed" class="degrade-notice">
          <el-alert title="模型数据不可用" description="当前显示全部商品，AI 筛选暂不可用" type="warning" show-icon :closable="false" />
        </div>

        <!-- 空白状态引导 -->
        <div v-else-if="!store.selectedBsrId" class="empty-guide">
          <div class="empty-guide-icon">
            <el-icon><FolderOpened /></el-icon>
          </div>
          <h3 class="empty-guide-title">从左侧选择品线开始</h3>
          <p class="empty-guide-desc">
            点击左侧品线大类查看该品类全部商品，<br>
            再在右侧面板中选择子类加载 AI 品线模型与精准筛选。
          </p>
          <div class="empty-guide-steps">
            <div class="step">
              <span class="step-num">1</span>
              <span>选择市场与月份</span>
            </div>
            <div class="step-arrow">→</div>
            <div class="step">
              <span class="step-num">2</span>
              <span>点击左侧品线</span>
            </div>
            <div class="step-arrow">→</div>
            <div class="step">
              <span class="step-num">3</span>
              <span>浏览或筛选子类商品</span>
            </div>
          </div>
        </div>

        <!-- 筛选操作栏 — L1: 基础字段筛选 / L2: 模型元素+基础筛选 -->
        <div v-if="store.selectedBsrId" class="action-bar">
          <!-- L2 模式：模型元素/载体筛选标签 -->
          <div v-if="store.selectedNodeId" class="filter-tags">
            <span
              v-for="f in store.activeFilters"
              :key="f.id"
              class="filter-tag"
            >
              {{ f.label }}
              <span class="close" @click="store.removeFilter(f.id)">&times;</span>
            </span>
            <span v-if="!store.hasFilters" class="filter-hint">
              点击模型中的元素或载体加入筛选
            </span>
            <el-button
              v-if="store.hasFilters"
              size="small"
              @click="store.clearFilters(); store.searchCompetitors()"
            >
              清除筛选
            </el-button>
          </div>

          <!-- 基础字段筛选（L1/L2 通用） -->
          <div class="basic-filters">
            <el-input
              v-model="store.searchSellerName"
              placeholder="卖家名"
              clearable
              size="small"
              style="width:160px"
              @keyup.enter="store.applyBasicFilters()"
              @clear="store.applyBasicFilters()"
            />
            <el-input
              v-model="store.searchBrand"
              placeholder="品牌"
              clearable
              size="small"
              style="width:140px"
              @keyup.enter="store.applyBasicFilters()"
              @clear="store.applyBasicFilters()"
            />
            <el-input
              v-model.number="store.searchPriceMin"
              placeholder="最低价"
              type="number"
              size="small"
              style="width:110px"
              @change="store.applyBasicFilters()"
            />
            <span class="price-sep">—</span>
            <el-input
              v-model.number="store.searchPriceMax"
              placeholder="最高价"
              type="number"
              size="small"
              style="width:110px"
              @change="store.applyBasicFilters()"
            />
            <el-button
              size="small"
              :disabled="!store.searchSellerName && !store.searchBrand && store.searchPriceMin == null && store.searchPriceMax == null"
              @click="store.clearBasicFilters(); store.applyBasicFilters()"
            >
              清除
            </el-button>
          </div>
        </div>

        <!-- 商品卡片网格 -->
        <CompetitorCardGrid
          :products="store.competitorResults"
          :total="store.competitorTotal"
          :loading="store.competitorLoading"
          :current-page="store.competitorPage"
          :page-size="store.competitorPageSize"
          :selected-asins="store.selectedProducts"
          :selected-count="store.selectedCount"
          :sort-by="store.sortBy"
          @toggle-select="(asin: string) => store.toggleProductSelection(asin, !store.selectedProducts.has(asin))"
          @view-detail="openDetail"
          @card-click="openDetail"
          @page-change="store.goToPage"
          @size-change="(s) => { store.competitorPageSize = s; store.searchCompetitors() }"
          @select-all-current="store.selectAllOnPage(store.competitorResults)"
          @deselect-all-current="store.clearSelection()"
          @sort-change="store.setSortBy"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="store.selectedCount > 0" class="bottom-bar">
      <span>已选 {{ store.selectedCount }} 件</span>
      <el-button size="small" @click="store.clearSelection()">清空</el-button>
      <el-button type="primary" size="small" :loading="store.batchLoading" @click="store.batchAddToSelection()">批量加入选品</el-button>
      <el-button size="small" :loading="store.exportLoading" @click="store.exportSelectedExcel()">导出Excel</el-button>
    </div>

    <!-- 商品详情弹窗（侧边抽屉） -->
    <ProductDetailDialog v-model:visible="detailVisible" :product="detailProduct" mode="selection" use-drawer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Menu, FolderOpened, Search } from '@element-plus/icons-vue'
import { useProductLineSelectionStore } from './store'
import ProductLineTree from './components/ProductLineTree.vue'
import ModelSummaryBar from './components/ModelSummaryBar.vue'
import CompetitorCardGrid from './components/CompetitorCardGrid.vue'
import ProductDetailDialog from '@/components/ProductDetailDialog/index.vue'
import MobileActionSheet from '@/components/MobileActionSheet/index.vue'

const store = useProductLineSelectionStore()
const mobileTreeOpen = ref(false)
const detailVisible = ref(false)
const detailProduct = ref<any>(null)

// L2 子类面板
const subCategorySearch = ref('')
const displaySubCategories = computed(() => {
  const q = subCategorySearch.value.toLowerCase().trim()
  if (!q) return store.currentSubCategories
  return store.currentSubCategories.filter(c =>
    c.name.toLowerCase().includes(q)
  )
})

function handleL2ItemClick(cat: any) {
  if (String(cat.nodeId) === store.selectedNodeId) {
    // 已选中 → 回到 L1 视图
    store.selectCategory(store.selectedBsrId, store.selectedBsrName)
  } else {
    // 切换到 L2
    store.selectSubCategory(cat.nodeId, cat.name, store.selectedBsrId)
  }
}

// 切换 L1 时清空 L2 搜索词
watch(() => store.selectedBsrId, () => {
  subCategorySearch.value = ''
})

// 月份动态生成：当前日期往前推12个月
const monthOptions = computed(() => {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(val)
  }
  return months
})

// MobileActionSheet 选项
const siteOptions = [
  { label: 'US', value: 'US' },
  { label: 'UK', value: 'UK' },
  { label: 'DE', value: 'DE' },
]

const monthActionOptions = computed(() =>
  monthOptions.value.map(m => ({ label: m, value: m }))
)

const batchOptions = computed(() =>
  store.batches.map(b => ({ label: b.batchId, value: b.batchId }))
)

// 拖拽分隔线
const treeWidth = ref(280)
const resizing = ref(false)

function startResize(e: MouseEvent) {
  resizing.value = true
  const startX = e.clientX
  const startWidth = treeWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    treeWidth.value = Math.max(200, Math.min(400, startWidth + delta))
    document.documentElement.style.setProperty('--tree-width', treeWidth.value + 'px')
  }
  const onUp = () => {
    resizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function openDetail(product: any) {
  detailProduct.value = product
  detailVisible.value = true
}

onMounted(() => {
  store.initData()
})

watch([() => store.marketplace, () => store.month], ([newMkp, newMonth], [oldMkp, oldMonth]) => {
  if (store.selectedCount > 0 || store.hasFilters) {
    ElMessageBox.confirm(
      '切换市场或月份将清空当前筛选和选中，是否继续？',
      '确认切换',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    ).then(() => {
      store.selectedBsrId = ''
      store.selectedNodeId = ''
      store.searchKeyword = ''
      store.modelData = null
      store.competitorResults = []
      store.selectedProducts = new Set()
      store.initData()
    }).catch(() => {
      // 用户取消 — 回滚市场/月份到旧值
      store.marketplace = oldMkp
      store.month = oldMonth
    })
  } else {
    store.selectedBsrId = ''
    store.selectedNodeId = ''
    store.searchKeyword = ''
    store.modelData = null
    store.competitorResults = []
    store.selectedProducts = new Set()
    store.initData()
  }
})

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

// 搜索输入 300ms 防抖
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(() => store.searchKeyword, (val) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    store.searchByKeyword(val)
  }, 300)
})
</script>

<script lang="ts">
export default { name: 'ProductLineSelection' }
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.selection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- 顶部工具栏 ----
.topbar {
  height: 48px;
  min-height: 48px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;

  .tb-brand { font-size: 13px; font-weight: 600; color: $text-secondary; letter-spacing: 0.02em; white-space: nowrap; }
  .tb-brand span { color: $text-primary; }
  .tb-spacer { flex: 1; }
}

.tb-select {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
}

.batch-meta {
  font-size: 11px;
  color: $text-tertiary;
  font-family: $font-family-mono;
  white-space: nowrap;
}

.mobile-tree-btn {
  display: none;
  padding: 6px 12px;
  background: $bg-hover;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  font-size: 13px;
  color: $text-secondary;
  cursor: pointer;
  font-family: inherit;

  &:hover { color: $text-primary; border-color: $primary-color; }
}

// ---- 工作区 ----
.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

// 品线树宽度由 CSS 变量控制
:deep(.tree-panel) {
  width: var(--tree-width, 280px);
  flex-shrink: 0;
}

.tree-resize {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background $transition-fast;

  &:hover { background: $primary-color; }

  @media (max-width: 900px) { display: none; }
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: auto;
}

// ---- 类目导航条 ----
.category-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid $border-color;
  font-size: 14px; font-weight: 600;
  background: $bg-color;
}
.cat-l1 {
  color: $text-secondary;
  &.active {
    color: $primary-color;
    border: 1px solid var(--el-color-primary, #b45309);
    background: rgba(180, 83, 9, 0.04);
    padding: 4px 10px;
    border-radius: 6px;
  }
  &.clickable { cursor: pointer; &:hover { color: $primary-color; text-decoration: underline; } }
}
.cat-sep { color: $text-tertiary; }
.cat-l2 { color: $text-secondary; }
.cat-l2.active {
  color: $primary-color;
  background: rgba(180, 83, 9, 0.04);
  border-radius: 4px;
  padding: 4px 8px;
}
.cat-hint {
  margin-left: auto;
  font-size: 11px;
  color: $text-tertiary;
}

// ---- L2 子类面板 ----
.l2-panel {
  background: $bg-color;
  border-bottom: 1px solid $border-color;
}

.l2-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  border-bottom: 1px solid $border-color;
}

.l2-count {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  font-family: $font-family-mono;
}

.l2-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.l2-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  cursor: pointer;
  transition: all $transition-fast;
  border-left: 3px solid transparent;

  &:hover {
    background: $bg-hover;
  }

  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.04);
    border-left-color: $primary-color;
  }
}

.l2-item-name {
  flex: 1;
  font-size: 13px;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .l2-item.active & {
    color: $primary-color;
    font-weight: 600;
  }
}

.l2-item-count {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  font-family: $font-family-mono;
  flex-shrink: 0;
}

// 移动端: L2 搜索框和列表可触摸滚动
@media (max-width: 900px) {
  .l2-list {
    max-height: 200px;
  }
}

// ---- 操作栏 ----
.action-bar {
  display: flex; gap: 12px; align-items: center;
  padding: 12px 20px;
  background: $bg-color;
  border-top: 1px solid $border-color;

  .filter-tags {
    flex: 1;
    display: flex; flex-wrap: wrap; gap: 6px;
  }

  .filter-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px;
    background: rgba($primary-color, 0.08);
    color: $primary-color;
    border-radius: $radius-sm;
    font-size: 12px; font-weight: 500;
    border: 1px solid rgba($primary-color, 0.15);
  }

  .filter-tag .close {
    cursor: pointer; font-size: 14px; line-height: 1; opacity: 0.6;
    &:hover { opacity: 1; }
  }

  .filter-hint {
    font-size: 12px;
    color: $text-tertiary;
    font-style: italic;
  }

  .basic-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .price-sep {
      color: $text-tertiary;
      font-size: 13px;
    }
  }
}

// ---- 底部操作栏 ----
.bottom-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  background: $bg-color;
  border-top: 1px solid $border-color;
  font-size: 13px;
  color: $text-secondary;
  z-index: 10;
}

// ---- 响应式 ----
.desktop-only.desktop-only {
  @media (max-width: 900px) { display: none; }
}

.mobile-only.mobile-only {
  @media (min-width: 901px) { display: none; }
}

@media (max-width: 900px) {
  .mobile-tree-btn { display: inline-flex; align-items: center; gap: 4px; }

  .tb-select {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .tb-select .el-select {
    min-width: 60px;
    width: auto !important;
  }
  .tb-select .el-select__wrapper {
    min-width: 54px;
  }
  .tb-select:nth-child(3) .el-select {
    min-width: 120px;
  }

  .batch-meta { display: none; }

  .topbar .el-input { width: 140px !important; }
  .topbar { flex-wrap: wrap; gap: 8px; }

  .bottom-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px;
  }
}

// ---- 模型降级提示 ----
.degrade-notice {
  flex-shrink: 0;
  margin: 12px 20px 0;
}

// ---- 空白状态引导 ----
.empty-guide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
  user-select: none;
}

.empty-guide-icon {
  font-size: 48px;
  color: $text-tertiary;
  opacity: 0.5;
}

.empty-guide-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
}

.empty-guide-desc {
  font-size: 14px;
  color: $text-tertiary;
  line-height: 1.7;
  margin: 0;
}

.empty-guide-steps {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: $text-secondary;
  padding: 8px 16px;
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
}

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: $primary-color;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.step-arrow {
  color: $text-tertiary;
  font-size: 16px;
}
</style>
