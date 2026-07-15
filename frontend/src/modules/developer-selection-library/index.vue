<template>
  <div class="developer-selection-library">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div class="page-title">人工选品库</div>
          <div class="page-actions">
            <el-button
              :type="selectionMode ? 'primary' : 'default'"
              @click="toggleSelectionMode"
            >
              {{ selectionMode ? '退出选择' : '选择模式' }}
            </el-button>
            <el-button
              type="success"
              :icon="Download"
              :loading="exporting"
              :disabled="loading || total === 0"
              @click="exportAllCsv"
            >
              下载全部 CSV
            </el-button>
            <el-button :icon="Refresh" :loading="loading" @click="refreshAll">刷新</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="bucket" class="bucket-tabs" @tab-change="handleBucketChange">
        <el-tab-pane label="好品库" name="GOOD" />
        <el-tab-pane label="差品库" name="BAD" />
      </el-tabs>

      <div class="batch-filter-bar">
        <span class="batch-filter-bar__label">批次分类</span>
        <el-check-tag :checked="batchFilter === 'ALL'" @change="setBatchFilter('ALL')">
          全部
        </el-check-tag>
        <el-check-tag :checked="batchFilter === 'UNASSIGNED'" @change="setBatchFilter('UNASSIGNED')">
          未加入分类
        </el-check-tag>
        <el-check-tag
          v-for="batchItem in batches"
          :key="batchItem.id"
          :checked="batchFilter === batchItem.id"
          @change="setBatchFilter(batchItem.id)"
        >
          {{ batchDisplayName(batchItem) }}
        </el-check-tag>
        <el-button size="small" type="primary" plain @click="createBatch">+ 新建批次</el-button>
      </div>

      <div class="toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索 ASIN、标题、店铺或开发姓名"
          style="width: 320px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="marketplace" clearable placeholder="全部站点" style="width: 130px" @change="handleSearch">
          <el-option label="UK 英国" value="UK" />
          <el-option label="US 美国" value="US" />
          <el-option label="DE 德国" value="DE" />
        </el-select>
        <el-select
          v-if="isAdmin"
          v-model="developerId"
          clearable
          filterable
          placeholder="全部开发"
          style="width: 220px"
          @change="handleDeveloperChange"
        >
          <el-option
            v-for="developer in developers"
            :key="developer.userId"
            :label="`${developer.developerName}（${developer.itemCount}）`"
            :value="developer.userId"
          />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Filter" @click="openFilterDrawer">
          更多筛选
          <el-badge v-if="activeRangeFilterCount" :value="activeRangeFilterCount" class="filter-badge" />
        </el-button>
      </div>

      <div v-if="selectionMode" class="selection-toolbar">
        <span class="selected-count">已选 {{ selectedIds.length }} 个</span>
        <el-button size="small" @click="toggleSelectCurrentPage">
          {{ currentPageAllSelected ? '取消当前页' : '全选当前页' }}
        </el-button>
        <el-select
          v-model="targetBatchId"
          clearable
          placeholder="选择目标批次"
          style="width: 220px"
        >
          <el-option
            v-for="batchItem in assignableBatches"
            :key="batchItem.id"
            :label="batchDisplayName(batchItem)"
            :value="batchItem.id"
          />
        </el-select>
        <el-button type="primary" :disabled="!selectedIds.length || !targetBatchId" @click="assignSelectedBatch">
          加入批次
        </el-button>
        <el-button :disabled="!selectedIds.length" @click="unassignSelectedBatch">移出分类</el-button>
        <el-button type="warning" :disabled="!selectedIds.length" @click="convertSelected">
          {{ bucket === 'GOOD' ? '批量转为差品' : '批量转为好品' }}
        </el-button>
        <el-button type="danger" plain :disabled="!selectedIds.length" @click="removeSelected">批量移出</el-button>
        <el-button :disabled="!selectedIds.length" @click="selectedIds = []">取消选择</el-button>
      </div>

      <div class="card-display-settings">
        <div class="card-display-settings__copy">
          <span class="card-display-settings__title">卡片大小</span>
          <span class="card-display-settings__hint">缩小后同一行自动显示更多卡片</span>
        </div>
        <div class="card-display-settings__controls" role="group" aria-label="卡片大小">
          <el-button
            size="small"
            aria-label="缩小卡片"
            :disabled="cardScale <= CARD_SCALE_MIN"
            @click="adjustCardScale(-CARD_SCALE_STEP)"
          >
            −
          </el-button>
          <span class="card-display-settings__count">{{ cardScalePercent }}%</span>
          <el-button
            size="small"
            type="primary"
            aria-label="放大卡片"
            :disabled="cardScale >= CARD_SCALE_MAX"
            @click="adjustCardScale(CARD_SCALE_STEP)"
          >
            +
          </el-button>
        </div>
      </div>

      <div v-loading="loading" class="product-grid" :style="productGridStyle">
        <div
          v-for="item in items"
          :key="item.id"
          class="library-card-scale-wrapper"
          :style="cardWrapperStyle(item)"
        >
          <div
            :ref="(element) => setCardScaleCanvasRef(item.id, element)"
            class="library-card-scale-canvas"
            :data-card-key="item.id"
          >
            <div
              class="library-card"
              :class="{ 'is-selected': selectionMode && selectedIds.includes(item.id) }"
            >
              <div class="library-card__owner" @click="handleCardClick(item)">
                <el-checkbox
                  v-if="selectionMode"
                  :model-value="selectedIds.includes(item.id)"
                  @click.stop
                  @change="(checked: boolean) => toggleSelection(item.id, checked)"
                />
                <el-tag type="primary" effect="dark" round>开发：{{ item.developerName }}</el-tag>
                <el-tag :type="item.batchName ? 'success' : 'info'" effect="plain" round>
                  分类：{{ item.batchName || '未分类' }}
                </el-tag>
                <span class="marketplace-label">{{ item.marketplace }}</span>
              </div>

              <div class="library-card__product" @click="handleProductAreaClick($event, item)">
                <UniversalCard
                  :product="toCardProduct(item)"
                  mode="selection"
                  :selectable="false"
                  :show-delete="false"
                  @view="openDetail(item)"
                />
              </div>

              <div class="library-card__actions">
                <el-button size="small" type="warning" plain @click.stop="convertOne(item)">
                  {{ bucket === 'GOOD' ? '转为差品' : '转为好品' }}
                </el-button>
                <el-button size="small" type="danger" link @click.stop="removeOne(item)">移出</el-button>
              </div>
            </div>
          </div>
        </div>

        <el-empty v-if="!loading && items.length === 0" description="当前筛选暂无商品" />
      </div>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[30, 60, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadItems"
        @size-change="handleSizeChange"
      />
    </el-card>

    <FilterDrawer
      v-model:visible="filterDrawerVisible"
      title="更多筛选"
      :size="520"
      @reset="resetDraftRange"
      @confirm="applyRangeFilter"
    >
      <RangeFilterPanel
        v-model="draftRange"
        :country="marketplace || 'UK'"
        :snapshot-options="weekOptions"
        snapshot-kind="competitor_created_week"
        snapshot-label-text="加入选品库周（周）"
        snapshot-placeholder-text="可选择一个或多个周"
        :auto-select-latest-week="false"
        embedded
      />
    </FilterDrawer>

    <ProductDetailDialog
      v-model:visible="detailVisible"
      :product="detailProduct"
      mode="selection"
      data-source="selection"
      :show-edit-button="false"
      :show-delete-button="false"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'DeveloperSelectionLibrary' })

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Filter, Refresh, Search } from '@element-plus/icons-vue'
import UniversalCard from '@/components/UniversalCard/index.vue'
import ProductDetailDialog from '@/components/ProductDetailDialog/index.vue'
import FilterDrawer from '@/components/FilterDrawer/index.vue'
import RangeFilterPanel from '@/components/RangeFilterPanel/index.vue'
import type { RangeFilterValue, RangeSnapshotOption } from '@/components/RangeFilterPanel/index.vue'
import { cloneRangeFilter, createEmptyRangeFilter } from '@/utils/rangeFilter'
import { downloadPagedRecordsCsv } from '@/views/AllSelection/composables/selectionCsv'
import { useUserStore } from '@/stores/user'
import {
  developerSelectionLibraryApi,
  type DeveloperLibraryBucket,
  type DeveloperOption,
  type DeveloperSelectionBatch,
  type DeveloperSelectionLibraryItem,
  type DeveloperSelectionLibraryQueryParams
} from '@/api/developerSelectionLibrary'

const CARD_SCALE_STORAGE_KEY = 'sjzm:developer-selection-library:card-scale'
const DEFAULT_ADMIN_DEVELOPER_NAME = '刘淼'
const CARD_SCALE_MIN = 0.4
const CARD_SCALE_MAX = 1
const CARD_SCALE_STEP = 0.1
const DEFAULT_CARD_SCALE = 0.6
const BASE_CARD_WIDTH = 280
const BASE_CARD_HEIGHT = 620
const BASE_CARD_GAP = 16

const normalizeCardScale = (value: number): number => {
  const rounded = Math.round(value / CARD_SCALE_STEP) * CARD_SCALE_STEP
  return Math.min(CARD_SCALE_MAX, Math.max(CARD_SCALE_MIN, Number(rounded.toFixed(1))))
}

const readCardScale = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(CARD_SCALE_STORAGE_KEY))
    return Number.isFinite(stored) ? normalizeCardScale(stored) : DEFAULT_CARD_SCALE
  } catch {
    return DEFAULT_CARD_SCALE
  }
}

const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)
const bucket = ref<DeveloperLibraryBucket>('GOOD')
const keyword = ref('')
const marketplace = ref('')
const developerId = ref<string | undefined>()
const developers = ref<DeveloperOption[]>([])
const batches = ref<DeveloperSelectionBatch[]>([])
const batchFilter = ref('ALL')
const targetBatchId = ref<string | undefined>()
const items = ref<DeveloperSelectionLibraryItem[]>([])
const selectionMode = ref(false)
const selectedIds = ref<string[]>([])
const loading = ref(false)
const exporting = ref(false)
const page = ref(1)
const size = ref(60)
const total = ref(0)
const detailVisible = ref(false)
const detailProduct = ref<Record<string, unknown> | null>(null)
const filterDrawerVisible = ref(false)
const activeRange = ref<RangeFilterValue>(createEmptyRangeFilter())
const draftRange = ref<RangeFilterValue>(createEmptyRangeFilter())
const weekOptions = ref<RangeSnapshotOption[]>([])

const cardScale = ref(readCardScale())
const cardScalePercent = computed(() => Math.round(cardScale.value * 100))
const productGridStyle = computed(() => ({
  '--selection-card-scale': String(cardScale.value),
  '--selection-card-min-width': `${Math.round(BASE_CARD_WIDTH * cardScale.value)}px`,
  '--selection-card-fallback-height': `${Math.round(BASE_CARD_HEIGHT * cardScale.value)}px`,
  '--selection-card-gap': `${Math.max(8, Math.round(BASE_CARD_GAP * cardScale.value))}px`
}))
const cardBaseHeights = ref<Record<string, number>>({})
const cardScaleCanvases = new Map<string, HTMLElement>()
let cardHeightObserver: ResizeObserver | null = null

const assignableBatches = computed(() => {
  if (!isAdmin.value || !developerId.value) return batches.value
  return batches.value.filter((item) => item.userId === developerId.value)
})

const currentPageAllSelected = computed(() =>
  items.value.length > 0 && items.value.every((item) => selectedIds.value.includes(item.id))
)

const activeRangeFilterCount = computed(() => {
  const range = activeRange.value
  return [
    range.priceMin,
    range.priceMax,
    range.unitsMin,
    range.unitsMax,
    range.listingDaysMin,
    range.listingDaysMax,
    range.bsrMax,
    range.weightMax,
    range.variantCountMax
  ].filter((value) => value !== null).length + range.fulfillment.length + range.createdWeeks.length
})

function updateCardBaseHeight(key: string, canvas: HTMLElement) {
  const height = canvas.offsetHeight
  if (height > 0 && cardBaseHeights.value[key] !== height) {
    cardBaseHeights.value = { ...cardBaseHeights.value, [key]: height }
  }
}

function setCardScaleCanvasRef(key: string, element: unknown) {
  const previous = cardScaleCanvases.get(key)
  if (previous && previous !== element) {
    cardHeightObserver?.unobserve(previous)
    cardScaleCanvases.delete(key)
  }
  if (!(element instanceof HTMLElement)) return
  cardScaleCanvases.set(key, element)
  cardHeightObserver?.observe(element)
  nextTick(() => updateCardBaseHeight(key, element))
}

function cardWrapperStyle(item: DeveloperSelectionLibraryItem) {
  const baseHeight = cardBaseHeights.value[item.id]
  return baseHeight ? { height: `${Math.ceil(baseHeight * cardScale.value)}px` } : undefined
}

function setCardScale(value: number) {
  const scale = normalizeCardScale(value)
  if (cardScale.value === scale) return
  cardScale.value = scale
  try {
    window.localStorage.setItem(CARD_SCALE_STORAGE_KEY, String(scale))
  } catch {
    // 本地存储不可用时，当前会话仍保留缩放设置。
  }
}

function adjustCardScale(delta: number) {
  setCardScale(cardScale.value + delta)
}

function parseSnapshot(item: DeveloperSelectionLibraryItem): Record<string, unknown> {
  if (!item.snapshotJson) return {}
  try {
    const value = JSON.parse(item.snapshotJson)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function toCardProduct(item: DeveloperSelectionLibraryItem): Record<string, unknown> {
  const snapshot = parseSnapshot(item)
  return {
    ...snapshot,
    id: item.id,
    asin: item.asin,
    marketplace: item.marketplace,
    productTitle: item.title || snapshot.productTitle || snapshot.title || '',
    title: item.title || snapshot.title || snapshot.productTitle || '',
    imageUrl: item.imageUrl || snapshot.imageUrl || snapshot.image || '',
    price: item.price ?? snapshot.price,
    units: item.units ?? snapshot.units ?? snapshot.salesVolume,
    salesVolume: item.units ?? snapshot.salesVolume ?? snapshot.units,
    bsr: item.bsr ?? snapshot.bsr,
    ratings: item.ratings ?? snapshot.ratings,
    rating: item.rating ?? snapshot.rating,
    listingDays: item.listingDays ?? snapshot.listingDays,
    sellerName: item.sellerName || snapshot.sellerName || snapshot.storeName || '',
    storeName: item.sellerName || snapshot.storeName || snapshot.sellerName || '',
    nodeLabelPath: item.nodeLabelPath || snapshot.nodeLabelPath || '',
    productUrl: item.productUrl || snapshot.productUrl || snapshot.productLink || '',
    productLink: item.productUrl || snapshot.productLink || snapshot.productUrl || '',
    productType: item.originScene === 'NEW_PRODUCTS' ? 'new' : 'shop',
    source: item.originSource || snapshot.source || '',
    batchId: item.batchId,
    batchName: item.batchName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

function buildQueryParams(targetPage = page.value, targetSize = size.value): DeveloperSelectionLibraryQueryParams {
  const range = activeRange.value
  return {
    bucket: bucket.value,
    marketplace: marketplace.value || undefined,
    keyword: keyword.value.trim() || undefined,
    developerId: isAdmin.value ? developerId.value : undefined,
    batchId: !['ALL', 'UNASSIGNED'].includes(batchFilter.value) ? batchFilter.value : undefined,
    unassigned: batchFilter.value === 'UNASSIGNED' ? true : undefined,
    page: targetPage,
    size: targetSize,
    createdWeeks: range.createdWeeks.length ? [...range.createdWeeks] : undefined,
    priceMin: range.priceMin ?? undefined,
    priceMax: range.priceMax ?? undefined,
    unitsMin: range.unitsMin ?? undefined,
    unitsMax: range.unitsMax ?? undefined,
    listingDaysMin: range.listingDaysMin ?? undefined,
    listingDaysMax: range.listingDaysMax ?? undefined,
    bsrMax: range.bsrMax ?? undefined,
    weightMax: range.weightMax ?? undefined,
    variantCountMax: range.variantCountMax ?? undefined,
    fulfillment: range.fulfillment.length ? [...range.fulfillment] : undefined
  }
}

async function loadDevelopers() {
  if (!isAdmin.value) return
  try {
    developers.value = await developerSelectionLibraryApi.developers()
  } catch (error: any) {
    ElMessage.error(error?.message || '加载开发人员失败')
  }
}

function applyAdminDefaultDeveloper() {
  if (!isAdmin.value || developerId.value) return
  const defaultDeveloper = developers.value.find((item) =>
    item.developerName.trim() === DEFAULT_ADMIN_DEVELOPER_NAME
  )
  if (defaultDeveloper) {
    developerId.value = defaultDeveloper.userId
  } else {
    ElMessage.warning(`未找到默认开发人：${DEFAULT_ADMIN_DEVELOPER_NAME}`)
  }
}

async function loadBatches() {
  try {
    batches.value = await developerSelectionLibraryApi.batches({
      bucket: bucket.value,
      developerId: isAdmin.value ? developerId.value : undefined
    })
    if (!['ALL', 'UNASSIGNED'].includes(batchFilter.value) &&
        !batches.value.some((item) => item.id === batchFilter.value)) {
      batchFilter.value = 'ALL'
    }
    if (targetBatchId.value && !batches.value.some((item) => item.id === targetBatchId.value)) {
      targetBatchId.value = undefined
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载批次失败')
  }
}

async function loadItems() {
  loading.value = true
  try {
    const result = await developerSelectionLibraryApi.list(buildQueryParams())
    items.value = result.list || []
    total.value = result.total || 0
    selectedIds.value = []
  } catch (error: any) {
    ElMessage.error(error?.message || '加载人工选品库失败')
  } finally {
    loading.value = false
  }
}

async function loadWeekOptions() {
  try {
    const rows = await developerSelectionLibraryApi.weeks({
      bucket: bucket.value,
      marketplace: marketplace.value || undefined,
      developerId: isAdmin.value ? developerId.value : undefined
    })
    weekOptions.value = rows.map((item) => ({
      value: item.week,
      label: item.week,
      count: item.count,
      startDate: item.startDate,
      endDate: item.endDate
    }))
  } catch (error: any) {
    ElMessage.error(error?.message || '加载周周期失败')
  }
}

async function refreshAll() {
  await Promise.all([loadItems(), loadDevelopers(), loadBatches(), loadWeekOptions()])
}

function handleSearch() {
  page.value = 1
  Promise.all([loadItems(), loadWeekOptions()])
}

function handleDeveloperChange() {
  page.value = 1
  batchFilter.value = 'ALL'
  targetBatchId.value = undefined
  Promise.all([loadItems(), loadBatches(), loadWeekOptions()])
}

function handleBucketChange() {
  page.value = 1
  batchFilter.value = 'ALL'
  targetBatchId.value = undefined
  selectedIds.value = []
  Promise.all([loadItems(), loadBatches(), loadWeekOptions()])
}

function setBatchFilter(value: string) {
  if (batchFilter.value === value) return
  batchFilter.value = value
  page.value = 1
  loadItems()
}

function batchDisplayName(batchItem: DeveloperSelectionBatch) {
  if (isAdmin.value && !developerId.value) {
    return `${batchItem.batchName} · ${batchItem.developerName}`
  }
  return batchItem.batchName
}

function defaultBatchName() {
  const today = new Date()
  return `${today.getMonth() + 1}.${today.getDate()}`
}

async function createBatch() {
  if (isAdmin.value && !developerId.value) {
    ElMessage.warning('管理员新建批次前请先选择开发人员')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入批次名称', `新建${bucket.value === 'GOOD' ? '好品' : '差品'}批次`, {
      inputValue: defaultBatchName(),
      inputPlaceholder: '例如 7.14',
      inputValidator: (input) => {
        const name = String(input || '').trim()
        if (!name) return '批次名称不能为空'
        if (name.length > 50) return '批次名称不能超过50个字符'
        return true
      }
    })
    const developer = developers.value.find((item) => item.userId === developerId.value)
    const created = await developerSelectionLibraryApi.createBatch({
      bucket: bucket.value,
      batchName: String(value).trim(),
      targetUserId: isAdmin.value ? developerId.value : undefined,
      developerName: developer?.developerName
    })
    await loadBatches()
    batchFilter.value = created.id
    page.value = 1
    await loadItems()
    ElMessage.success(`批次 ${created.batchName} 已创建`)
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '新建批次失败')
  }
}

function openFilterDrawer() {
  draftRange.value = cloneRangeFilter(activeRange.value)
  filterDrawerVisible.value = true
  loadWeekOptions()
}

function resetDraftRange() {
  draftRange.value = createEmptyRangeFilter()
}

function applyRangeFilter() {
  activeRange.value = cloneRangeFilter(draftRange.value)
  filterDrawerVisible.value = false
  handleSearch()
}

async function exportAllCsv() {
  if (total.value <= 0) {
    ElMessage.warning('当前筛选没有可导出的商品')
    return
  }
  exporting.value = true
  try {
    const result = await downloadPagedRecordsCsv<DeveloperSelectionLibraryItem>({
      total: total.value,
      filenamePrefix: `developer_selection_${bucket.value}_${marketplace.value || 'ALL'}`,
      loadPage: async (targetPage, targetSize) => {
        const response = await developerSelectionLibraryApi.list(buildQueryParams(targetPage, targetSize))
        return response.list || []
      }
    })
    ElMessage.success(`已导出全部 ${result.count} 条人工选品数据`)
  } catch (error: any) {
    ElMessage.error(error?.message || '导出 CSV 失败')
  } finally {
    exporting.value = false
  }
}

function handleSizeChange() {
  page.value = 1
  loadItems()
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedIds.value = []
  targetBatchId.value = undefined
}

function toggleSelection(id: string, checked: boolean) {
  if (checked && !selectedIds.value.includes(id)) selectedIds.value.push(id)
  if (!checked) selectedIds.value = selectedIds.value.filter((value) => value !== id)
}

function handleCardClick(item: DeveloperSelectionLibraryItem) {
  if (!selectionMode.value) {
    openDetail(item)
    return
  }
  toggleSelection(item.id, !selectedIds.value.includes(item.id))
}

function handleProductAreaClick(event: MouseEvent, item: DeveloperSelectionLibraryItem) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, .el-button')) return
  handleCardClick(item)
}

function toggleSelectCurrentPage() {
  const currentIds = items.value.map((item) => item.id)
  if (currentPageAllSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !currentIds.includes(id))
  } else {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...currentIds]))
  }
}

function openDetail(item: DeveloperSelectionLibraryItem) {
  detailProduct.value = toCardProduct(item)
  detailVisible.value = true
}

async function assignSelectedBatch() {
  if (!selectedIds.value.length || !targetBatchId.value) return
  try {
    const result = await developerSelectionLibraryApi.assignBatch(selectedIds.value, targetBatchId.value)
    ElMessage.success(`已将 ${result.assigned} 个商品加入批次`)
    await loadItems()
  } catch (error: any) {
    ElMessage.error(error?.message || '加入批次失败')
  }
}

async function unassignSelectedBatch() {
  if (!selectedIds.value.length) return
  try {
    const result = await developerSelectionLibraryApi.unassignBatch(selectedIds.value)
    ElMessage.success(`已将 ${result.unassigned} 个商品移出分类`)
    await loadItems()
  } catch (error: any) {
    ElMessage.error(error?.message || '移出分类失败')
  }
}

async function convertIds(ids: string[]) {
  const target: DeveloperLibraryBucket = bucket.value === 'GOOD' ? 'BAD' : 'GOOD'
  const result = await developerSelectionLibraryApi.convert(ids, target)
  ElMessage.success(`已转换 ${result.converted} 个商品，原批次已清除`)
  await Promise.all([loadItems(), loadDevelopers(), loadBatches()])
}

async function convertOne(item: DeveloperSelectionLibraryItem) {
  try {
    await convertIds([item.id])
  } catch (error: any) {
    ElMessage.error(error?.message || '转换失败')
  }
}

async function convertSelected() {
  if (!selectedIds.value.length) return
  try {
    await convertIds(selectedIds.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '批量转换失败')
  }
}

async function removeIds(ids: string[]) {
  const result = await developerSelectionLibraryApi.remove(ids)
  ElMessage.success(`已移出 ${result.deleted} 个商品`)
  await Promise.all([loadItems(), loadDevelopers()])
}

async function removeOne(item: DeveloperSelectionLibraryItem) {
  try {
    await ElMessageBox.confirm(`确定移出 ${item.asin} 吗？`, '移出人工选品库', { type: 'warning' })
    await removeIds([item.id])
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '移出失败')
  }
}

async function removeSelected() {
  if (!selectedIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定移出选中的 ${selectedIds.value.length} 个商品吗？`, '批量移出', { type: 'warning' })
    await removeIds(selectedIds.value)
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '批量移出失败')
  }
}

onMounted(async () => {
  if (typeof ResizeObserver !== 'undefined') {
    cardHeightObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const key = (entry.target as HTMLElement).dataset.cardKey
        if (key) updateCardBaseHeight(key, entry.target as HTMLElement)
      })
    })
  }
  if (isAdmin.value) {
    await loadDevelopers()
    applyAdminDefaultDeveloper()
  }
  await Promise.all([loadItems(), loadBatches(), loadWeekOptions()])
})

onUnmounted(() => {
  cardHeightObserver?.disconnect()
  cardHeightObserver = null
  cardScaleCanvases.clear()
})
</script>

<style scoped lang="scss">
.developer-selection-library {
  padding: 16px;
}

.page-header,
.toolbar,
.selection-toolbar,
.batch-filter-bar,
.library-card__owner,
.library-card__actions,
.card-display-settings {
  display: flex;
  align-items: center;
}

.page-header,
.card-display-settings {
  justify-content: space-between;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.bucket-tabs {
  margin-bottom: 6px;
}

.batch-filter-bar {
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

.batch-filter-bar__label {
  margin-right: 2px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.toolbar,
.selection-toolbar {
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.selection-toolbar {
  padding: 10px 12px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}

.filter-badge {
  margin-left: 6px;
}

.selected-count {
  color: var(--el-color-primary);
  font-weight: 600;
}

.card-display-settings {
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #f0f9ff 0%, #f8fbff 100%);
  border: 1px solid #d9ecff;
  border-radius: 8px;
}

.card-display-settings__copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.card-display-settings__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.card-display-settings__hint {
  font-size: 12px;
  color: #909399;
}

.card-display-settings__controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.card-display-settings__count {
  min-width: 64px;
  color: #303133;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--selection-card-min-width, 280px), 1fr));
  align-items: start;
  gap: var(--selection-card-gap, 16px);
  min-height: 300px;
  margin-bottom: 18px;
}

.library-card-scale-wrapper {
  position: relative;
  min-width: 0;
  min-height: var(--selection-card-fallback-height, 620px);
}

.library-card-scale-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% / var(--selection-card-scale, 1));
  transform: scale(var(--selection-card-scale, 1));
  transform-origin: top left;
}

.library-card {
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.library-card.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

.library-card__owner {
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}

.marketplace-label {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.library-card__product {
  cursor: pointer;
}

.library-card :deep(.universal-card) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.library-card__actions {
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 768px) {
  .developer-selection-library {
    padding: 8px;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
