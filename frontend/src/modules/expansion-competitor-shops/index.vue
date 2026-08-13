<template>
  <div class="expansion-page">
    <header class="page-header">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>选品中心</el-breadcrumb-item>
        <el-breadcrumb-item>拓品</el-breadcrumb-item>
        <el-breadcrumb-item>竞品店铺</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="title-row">
        <div>
          <h1>竞品店铺</h1>
          <div class="page-meta">
            <span>{{ total.toLocaleString('zh-CN') }} 个商品</span>
            <span>{{ currentBatchLabel }}</span>
          </div>
        </div>
        <el-tooltip content="刷新" placement="bottom">
          <el-button
            :icon="Refresh"
            circle
            :loading="loading"
            aria-label="刷新"
            @click="loadProducts"
          />
        </el-tooltip>
      </div>
    </header>

    <section class="filter-band" aria-label="商品筛选">
      <el-radio-group
        v-model="filters.marketplace"
        class="market-control"
        @change="handleMarketplaceChange"
      >
        <el-radio-button value="UK">英国</el-radio-button>
        <el-radio-button value="DE">德国</el-radio-button>
        <el-radio-button value="US">美国</el-radio-button>
      </el-radio-group>

      <el-input
        v-model="filters.keyword"
        class="keyword-input"
        clearable
        placeholder="ASIN 或商品标题"
        :prefix-icon="Search"
        @keyup.enter="search"
      />

      <el-input
        v-model="filters.sellerName"
        class="seller-input"
        clearable
        placeholder="店铺名称"
        @keyup.enter="search"
      />

      <el-select v-model="filters.batch" class="batch-select" @change="search">
        <el-option
          v-for="batch in batches"
          :key="batch.week"
          :label="batchLabel(batch)"
          :value="batch.week"
        />
      </el-select>

      <el-select
        v-model="filters.listingWindow"
        class="window-select"
        @change="search"
      >
        <el-option label="全部上架时间" value="ALL" />
        <el-option label="上架 30 天内" value="30" />
        <el-option label="上架 90 天内" value="90" />
      </el-select>

      <el-select v-model="sortValue" class="sort-select" @change="handleSortChange">
        <el-option label="月销量从高到低" value="salesVolume:desc" />
        <el-option label="月销量从低到高" value="salesVolume:asc" />
        <el-option label="上架时间从新到旧" value="listingDate:desc" />
        <el-option label="价格从低到高" value="price:asc" />
        <el-option label="最近更新" value="createdAt:desc" />
      </el-select>

      <el-button type="primary" :icon="Search" :loading="loading" @click="search">
        查询
      </el-button>
      <el-tooltip content="重置筛选" placement="bottom">
        <el-button :icon="RefreshLeft" circle aria-label="重置筛选" @click="resetFilters" />
      </el-tooltip>
    </section>

    <main v-loading="loading" class="product-area">
      <div v-if="products.length" class="product-grid">
        <article v-for="product in products" :key="product.id" class="product-card">
          <button
            type="button"
            class="product-image"
            :aria-label="`打开 ${product.asin}`"
            @click="openProduct(product)"
          >
            <LazyImage
              v-if="product.imageUrl"
              :image-id="product.id"
              :src="product.imageUrl"
              width="100%"
              height="100%"
              fit="contain"
            />
            <span v-else class="image-empty">
              <el-icon><PictureFilled /></el-icon>
            </span>
            <span class="market-badge">{{ product.marketplace }}</span>
          </button>

          <div class="product-body">
            <div class="sales-row">
              <div>
                <span class="metric-label">月销量</span>
                <strong>{{ formatNumber(product.units) }}</strong>
              </div>
              <span class="price">{{ formatPrice(product.price, product.marketplace) }}</span>
            </div>

            <h2 :title="product.title || product.asin">
              {{ product.title || product.asin }}
            </h2>

            <div class="seller" :title="product.sellerName || ''">
              <el-icon><Shop /></el-icon>
              <span>{{ product.sellerName || '未知店铺' }}</span>
            </div>

            <dl class="metrics">
              <div>
                <dt>上架</dt>
                <dd>{{ listingText(product) }}</dd>
              </div>
              <div>
                <dt>BSR</dt>
                <dd>{{ formatNumber(product.bsr) }}</dd>
              </div>
              <div>
                <dt>评分</dt>
                <dd>{{ ratingText(product.rating, product.ratings) }}</dd>
              </div>
              <div>
                <dt>配送</dt>
                <dd>{{ product.fulfillment || '—' }}</dd>
              </div>
            </dl>

            <div class="category" :title="product.nodeLabelPath || ''">
              {{ categoryLeaf(product.nodeLabelPath) }}
            </div>

            <footer class="card-footer">
              <span>{{ product.asin }}</span>
              <el-tooltip content="打开 Amazon" placement="top">
                <el-button
                  text
                  circle
                  :icon="TopRight"
                  aria-label="打开 Amazon"
                  @click="openProduct(product)"
                />
              </el-tooltip>
            </footer>
          </div>
        </article>
      </div>

      <el-empty v-else-if="!loading" description="当前条件下没有商品" />
    </main>

    <footer v-if="total > 0" class="pagination-band">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[48, 96, 200]"
        :total="total"
        @current-change="loadProducts"
        @size-change="handleSizeChange"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  PictureFilled,
  Refresh,
  RefreshLeft,
  Search,
  Shop,
  TopRight,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import LazyImage from '@/components/LazyImage/index.vue'
import {
  shopCollectionApi,
  type ShopProductRow,
  type ShopSelectionBatch,
} from '@/api/shopCollection'
import {
  amazonProductUrl,
  epochToDate,
} from '@/modules/shop-profile/utils'
import {
  buildExpansionProductQuery,
  createExpansionFilters,
  type ExpansionMarketplace,
  type ExpansionSort,
} from './query'

const filters = ref(createExpansionFilters())
const products = ref<ShopProductRow[]>([])
const batches = ref<ShopSelectionBatch[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(48)
const total = ref(0)

const sortValue = computed({
  get: () => `${filters.value.sortBy}:${filters.value.sortOrder}`,
  set: (value: string) => {
    const [sortBy, sortOrder] = value.split(':')
    filters.value.sortBy = sortBy as ExpansionSort
    filters.value.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
  },
})

const currentBatchLabel = computed(() => {
  const current = batches.value.find((batch) => batch.week === filters.value.batch)
  return current ? batchLabel(current) : '最新有效批次'
})

function batchLabel(batch: ShopSelectionBatch): string {
  const range = batch.startDate === batch.endDate
    ? batch.startDate
    : `${batch.startDate} 至 ${batch.endDate}`
  return `${batch.week} · ${range} · ${Number(batch.count || 0).toLocaleString('zh-CN')} 个`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '加载竞品店铺商品失败'
}

async function loadBatches(): Promise<void> {
  batches.value = await shopCollectionApi.selectionBatches(filters.value.marketplace)
  filters.value.batch = batches.value[0]?.week || ''
}

async function loadProducts(): Promise<void> {
  loading.value = true
  try {
    const result = await shopCollectionApi.expansionProducts(
      buildExpansionProductQuery(filters.value, page.value, pageSize.value),
    )
    products.value = result.list || []
    total.value = Number(result.total || 0)
  } catch (error: unknown) {
    products.value = []
    total.value = 0
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

async function handleMarketplaceChange(value: string | number | boolean | undefined): Promise<void> {
  filters.value.marketplace = String(value || 'UK') as ExpansionMarketplace
  page.value = 1
  try {
    await loadBatches()
    await loadProducts()
  } catch (error: unknown) {
    products.value = []
    total.value = 0
    ElMessage.error(errorMessage(error))
  }
}

function search(): void {
  page.value = 1
  loadProducts()
}

function handleSortChange(): void {
  search()
}

async function resetFilters(): Promise<void> {
  const marketplace = filters.value.marketplace
  filters.value = createExpansionFilters(marketplace)
  page.value = 1
  await loadBatches()
  await loadProducts()
}

function handleSizeChange(): void {
  page.value = 1
  loadProducts()
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString('zh-CN')
}

function formatPrice(value: string | number | null, marketplace: string): string {
  const amount = toNumber(value)
  if (amount == null || amount < 0) return '—'
  const symbols: Record<string, string> = { UK: '£', DE: '€', US: '$' }
  return `${symbols[marketplace] || ''}${amount.toFixed(2)}`
}

function listingText(product: ShopProductRow): string {
  if (product.listingDays != null) return `${product.listingDays} 天`
  return epochToDate(product.availableDate)
}

function ratingText(
  rating: string | number | null,
  ratings: number | null,
): string {
  const score = toNumber(rating)
  if (score == null) return '—'
  return ratings == null
    ? score.toFixed(1)
    : `${score.toFixed(1)} (${ratings.toLocaleString('zh-CN')})`
}

function categoryLeaf(path: string | null): string {
  if (!path) return '未分类'
  const parts = path.split(':').map((item) => item.trim()).filter(Boolean)
  return parts[parts.length - 1] || '未分类'
}

function openProduct(product: ShopProductRow): void {
  const marketplace = product.marketplace as ExpansionMarketplace
  window.open(
    product.productUrl || amazonProductUrl(marketplace, product.asin),
    '_blank',
    'noopener,noreferrer',
  )
}

onMounted(async () => {
  try {
    await loadBatches()
    await loadProducts()
  } catch (error: unknown) {
    ElMessage.error(errorMessage(error))
  }
})
</script>

<style scoped lang="scss">
.expansion-page {
  min-height: 100%;
  padding: 18px 20px 24px;
  color: #1f2937;
}

.page-header {
  max-width: 1800px;
  margin: 0 auto 14px;
}

.title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;

  h1 {
    margin: 0;
    font-size: 24px;
    line-height: 1.25;
    letter-spacing: 0;
  }
}

.page-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.filter-band {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1800px;
  margin: 0 auto 16px;
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  background: #faf8f5;
}

.keyword-input { width: min(280px, 22vw); }
.seller-input { width: min(220px, 18vw); }
.batch-select { width: 270px; }
.window-select { width: 150px; }
.sort-select { width: 180px; }

.product-area {
  min-height: 360px;
  max-width: 1800px;
  margin: 0 auto;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.product-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(17, 24, 39, 0.04);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;

  &:hover {
    transform: translateY(-2px);
    border-color: #d6cfc6;
    box-shadow: 0 8px 22px rgba(17, 24, 39, 0.09);
  }
}

.product-image {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 0;
  border-bottom: 1px solid #f0ede8;
  background: #fff;
  cursor: pointer;

  :deep(.lazy-image-container) {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}

.image-empty {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: #9ca3af;
  background: #f3f4f6;
  font-size: 38px;
}

.market-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  min-width: 32px;
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  background: rgba(17, 24, 39, 0.82);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.product-body {
  padding: 12px;
}

.sales-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  > div {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  strong {
    color: #047857;
    font-size: 20px;
    line-height: 1;
  }
}

.metric-label {
  color: #6b7280;
  font-size: 12px;
}

.price {
  color: #92400e;
  font-size: 16px;
  font-weight: 700;
}

h2 {
  display: -webkit-box;
  min-height: 40px;
  margin: 10px 0 8px;
  overflow: hidden;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.seller {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-bottom: 10px;
  color: #4b5563;
  font-size: 12px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;

  div {
    min-width: 0;
  }

  dt {
    color: #9ca3af;
    font-size: 11px;
  }

  dd {
    margin: 2px 0 0;
    overflow: hidden;
    color: #374151;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.category {
  margin-top: 10px;
  padding: 7px 8px;
  overflow: hidden;
  border-left: 3px solid #d97706;
  background: #faf8f5;
  color: #6b7280;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  margin-top: 8px;
  border-top: 1px solid #f0ede8;
  color: #6b7280;
  font-family: Consolas, monospace;
  font-size: 12px;
}

.pagination-band {
  display: flex;
  justify-content: flex-end;
  max-width: 1800px;
  margin: 18px auto 0;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

@media (max-width: 1380px) {
  .filter-band {
    flex-wrap: wrap;
  }

  .keyword-input,
  .seller-input {
    width: 230px;
  }
}

@media (max-width: 768px) {
  .expansion-page {
    padding: 14px 12px 20px;
  }

  .title-row {
    align-items: center;
  }

  .page-meta {
    flex-direction: column;
    gap: 3px;
  }

  .filter-band {
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .market-control,
  .keyword-input,
  .seller-input,
  .batch-select,
  .window-select,
  .sort-select {
    width: 100%;
  }

  .market-control,
  .keyword-input,
  .seller-input,
  .batch-select {
    grid-column: 1 / -1;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .pagination-band {
    overflow-x: auto;
    justify-content: flex-start;
  }
}

@media (max-width: 520px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
