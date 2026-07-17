<template>
  <div class="sp-list">
    <!-- 顶部标题 -->
    <div class="sp-page-head">
      <div class="sp-title">
        <span class="sp-title__crumb">店铺画像</span>
        <span class="sp-title__sep">/</span>
        <span>列表</span>
      </div>
      <div class="sp-title__meta">
        <span v-if="currentBatch">当前批次 {{ currentBatch }}</span>
      </div>
    </div>

    <!-- 工具条 -->
    <el-card class="sp-toolbar" shadow="never" body-style="padding:12px 16px;">
      <div class="sp-toolbar__row">
        <ShopScreeningToolbar
          v-model="filters"
          :batches="batches"
          :loading="loading"
          @search="searchList"
          @marketplace-change="onMarketplaceChange"
        />
        <div class="sp-toolbar__spacer" />
        <el-button size="small" @click="goBaselines">基线与定位</el-button>
      </div>
    </el-card>

    <!-- KPI 摘要条 -->
    <div class="sp-kpi-strip">
      <div class="sp-kpi">
        <span class="sp-kpi__label">店铺数</span>
        <span class="sp-kpi__value">{{ num(kpi.shopCount) }}</span>
      </div>
      <div class="sp-kpi">
        <span class="sp-kpi__label">商品数</span>
        <span class="sp-kpi__value">{{ num(kpi.productCount) }}</span>
      </div>
      <div class="sp-kpi sp-kpi--highlight">
        <span class="sp-kpi__label">通过筛选</span>
        <span class="sp-kpi__value">{{ num(kpi.passedCount) }}</span>
      </div>
      <div class="sp-kpi">
        <span class="sp-kpi__label">M01 命中</span>
        <span class="sp-kpi__value">{{ num(kpi.m01Count) }}</span>
      </div>
      <div class="sp-kpi">
        <span class="sp-kpi__label">当前批次</span>
        <span class="sp-kpi__value sp-kpi__value--sm">{{ currentBatch || '—' }}</span>
      </div>
    </div>

    <!-- 主表 -->
    <el-card shadow="never" body-style="padding:0;">
      <el-table
        :data="pagedRows"
        v-loading="loading"
        border
        stripe
        size="small"
        row-key="sellerName"
        @row-click="goDetail"
      >
        <el-table-column label="市场" width="64">
          <template #default="{ row }">
            <span class="sp-badge-market" :style="marketBadgeStyle(row.marketplace)">{{ row.marketplace }}</span>
          </template>
        </el-table-column>
        <el-table-column label="店铺名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <a class="sp-link" @click.stop="goDetail(row)">{{ row.sellerName }}</a>
          </template>
        </el-table-column>
        <el-table-column label="周批次" width="105"><template #default="{ row }">{{ row.latestBatchCode || '—' }}</template></el-table-column>
        <el-table-column label="通过筛选" width="95" align="right">
          <template #default="{ row }"><strong>{{ num(row.passedProductCount) }}</strong></template>
        </el-table-column>
        <el-table-column label="商品数" width="85" align="right">
          <template #default="{ row }">
            <span class="sp-mono">{{ num(row.productCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="A/B/C/D 分布" min-width="170">
          <template #default="{ row }">
            <SalesTierStack :a="row.aCount" :b="row.bCount" :c="row.cCount" :d="row.dCount" :unknown="row.unknownCount" />
          </template>
        </el-table-column>
        <el-table-column label="ABC 占比" width="86" align="right">
          <template #default="{ row }"><span class="sp-mono">{{ pct(row.abcRatio) }}</span></template>
        </el-table-column>
        <el-table-column label="M01" width="90" align="right"><template #default="{ row }">{{ num(row.m01HitCount) }}</template></el-table-column>
        <el-table-column label="平均上架" width="90" align="right"><template #default="{ row }">{{ row.avgListingDays == null ? '—' : Math.round(row.avgListingDays) }}</template></el-table-column>
        <el-table-column label="90天新品" width="90" align="right"><template #default="{ row }">{{ num(row.new90Count) }}</template></el-table-column>
        <el-table-column label="主类目" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ row.topCategory || '—' }}</template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="goDetail(row)">查看详情</el-button>
            <el-button link type="primary" size="small" @click.stop="goPositioning(row)">查看定位</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="emptyText" />
        </template>
      </el-table>

      <div class="sp-pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          size="small"
          background
          @current-change="reload"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import shopCollectionApi, { type ShopScreeningBatch, type ShopScreeningRow } from '@/api/shopCollection'
import ShopScreeningToolbar from '@/modules/shop-collection-shared/ShopScreeningToolbar.vue'
import { buildShopScreeningQuery, createShopScreeningFilters } from '@/modules/shop-collection-shared/shopScreening'
import { num, pct, marketColor } from './utils'
import SalesTierStack from './components/SalesTierStack.vue'

const router = useRouter()

const filters = ref(createShopScreeningFilters('UK'))
const batches = ref<ShopScreeningBatch[]>([])
const loading = ref(false)
const rows = ref<ShopScreeningRow[]>([])

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const emptyText = computed(() => '暂无符合筛选条件的店铺')

const currentBatch = computed(() => filters.value.range.createdWeeks.join(', ') || rows.value[0]?.latestBatchCode || '')

const kpi = reactive({
  shopCount: 0,
  productCount: 0,
  passedCount: 0,
  m01Count: 0,
})

function recalcKpi(list: ShopScreeningRow[]) {
  const first = list[0]
  kpi.shopCount = first?.totalRows || 0
  kpi.productCount = first?.totalProductCount || 0
  kpi.passedCount = first?.totalPassedProductCount || 0
  kpi.m01Count = first?.totalM01HitCount || 0
}

const pagedRows = computed(() => rows.value)

function marketBadgeStyle(m: string) {
  const c = marketColor(m)
  return { background: c.bg, color: c.fg }
}

async function reload() {
  loading.value = true
  try {
    const result = await shopCollectionApi.screenShops(
      buildShopScreeningQuery(filters.value, 'ALL', page.value, pageSize.value)
    )
    rows.value = result.list || []
    total.value = result.total || 0
    recalcKpi(rows.value)
  } catch (e: any) {
    rows.value = []
    total.value = 0
    recalcKpi([])
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadBatches() {
  batches.value = await shopCollectionApi.screeningBatches(filters.value.marketplace)
}

function searchList() { page.value = 1; reload() }
async function onMarketplaceChange() { page.value = 1; await loadBatches(); await reload() }
function handleSizeChange() { page.value = 1; reload() }

function goDetail(row: ShopScreeningRow) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goPositioning(row: ShopScreeningRow) {
  router.push({
    name: 'ShopProfileBaselines',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goBaselines() {
  router.push({ name: 'ShopProfileBaselines' })
}

onMounted(async () => { await loadBatches(); await reload() })
</script>

<style scoped lang="scss">
.sp-list {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  &__crumb {
    font-size: 13px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
  &__sep {
    color: var(--el-text-color-placeholder);
  }
  &__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
.sp-toolbar__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sp-toolbar__spacer {
  flex: 1;
}
.sp-kpi-strip {
  display: flex;
  gap: 1px;
  background: var(--el-border-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  overflow: hidden;
}
.sp-kpi {
  flex: 1;
  background: var(--el-bg-color);
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  &__label {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }
  &__value {
    font-family: var(--el-font-family-mono, 'Consolas', monospace);
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.25;
    &--sm {
      font-size: 15px;
    }
  }
  &--highlight .sp-kpi__value {
    color: #e8621c;
  }
}
.sp-badge-market {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.sp-link {
  color: #e8621c;
  cursor: pointer;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
}
.sp-mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.sp-dim {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.sp-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
