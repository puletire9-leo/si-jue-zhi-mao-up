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
        <el-radio-group v-model="marketplace" size="small" @change="onMarketplaceChange">
          <el-radio-button v-for="m in MARKETPLACES" :key="m" :value="m">{{ m }}</el-radio-button>
        </el-radio-group>

        <el-radio-group v-model="dataSource" size="small" @change="reload">
          <el-radio-button value="live">实时聚合</el-radio-button>
          <el-radio-button value="snapshot">物化快照</el-radio-button>
        </el-radio-group>

        <el-date-picker
          v-model="batchDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="批次日期（空=最新）"
          size="small"
          style="width: 180px"
          clearable
          @change="reload"
        />

        <el-input
          v-model="sellerName"
          placeholder="搜索店铺名称"
          size="small"
          clearable
          style="width: 180px"
          @keyup.enter="reload"
          @clear="reload"
        />

        <el-input-number
          v-model="minProductCount"
          :min="0"
          :controls="false"
          placeholder="最低商品数"
          size="small"
          style="width: 120px"
        />

        <el-select v-model="sortBy" size="small" style="width: 130px" @change="applySort">
          <el-option label="商品数" value="productCount" />
          <el-option label="A 数" value="aCount" />
          <el-option label="AB 数" value="abCount" />
          <el-option label="ABC 数" value="abcCount" />
          <el-option label="D 占比" value="dRatio" />
        </el-select>

        <div class="sp-toolbar__spacer" />

        <el-button size="small" @click="goBaselines">基线与定位</el-button>
        <el-button size="small" :loading="loading" @click="reload">刷新</el-button>
        <el-button type="primary" size="small" :loading="computing" @click="handleCompute">
          物化 {{ marketplace }}
        </el-button>
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
        <span class="sp-kpi__label">A 商品数</span>
        <span class="sp-kpi__value">{{ num(kpi.aCount) }}</span>
      </div>
      <div class="sp-kpi">
        <span class="sp-kpi__label">ABC 商品数</span>
        <span class="sp-kpi__value">{{ num(kpi.abcCount) }}</span>
      </div>
      <div class="sp-kpi">
        <span class="sp-kpi__label">D 商品数</span>
        <span class="sp-kpi__value">{{ num(kpi.dCount) }}</span>
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
        <el-table-column label="商品数" width="90" align="right">
          <template #default="{ row }">
            <span class="sp-mono">{{ num(row.productCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="A/B/C/D 分布" min-width="170">
          <template #default="{ row }">
            <SalesTierStack :a="row.aCount" :b="row.bCount" :c="row.cCount" :d="row.dCount" :unknown="row.unknownCount" />
          </template>
        </el-table-column>
        <el-table-column label="A 占比" width="78" align="right">
          <template #default="{ row }"><span class="sp-mono">{{ pct(row.aRatio) }}</span></template>
        </el-table-column>
        <el-table-column label="ABC 占比" width="86" align="right">
          <template #default="{ row }"><span class="sp-mono">{{ pct(row.abcRatio) }}</span></template>
        </el-table-column>
        <el-table-column label="D 占比" width="78" align="right">
          <template #default="{ row }"><span class="sp-mono">{{ pct(row.dRatio) }}</span></template>
        </el-table-column>
        <el-table-column label="A 类目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.topACategory || '—' }}</template>
        </el-table-column>
        <el-table-column label="ABC 类目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.topABCCategory || '—' }}</template>
        </el-table-column>
        <el-table-column label="D 类目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.topDCategory || '—' }}</template>
        </el-table-column>
        <el-table-column label="结构标签" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.profileType" size="small" effect="light" type="warning">{{ row.profileType }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="批次" width="108">
          <template #default="{ row }"><span class="sp-mono sp-dim">{{ row.latestBatchDate || '—' }}</span></template>
        </el-table-column>
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
        <span class="sp-dim">
          共 <span class="sp-mono">{{ sortedRows.length }}</span> 条（按 limit={{ limit }} 拉取）
        </span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="sortedRows.length"
          layout="sizes, prev, pager, next"
          size="small"
          background
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { shopProfileApi } from '@/api/shopProfile'
import type { Marketplace, ShopProfileSummary } from '@/types/shopProfile'
import { MARKETPLACES, num, pct, marketColor } from './utils'
import SalesTierStack from './components/SalesTierStack.vue'

const router = useRouter()

const marketplace = ref<Marketplace>('UK')
const dataSource = ref<'live' | 'snapshot'>('live')
const batchDate = ref<string>('')
const sellerName = ref<string>('')
const minProductCount = ref<number | undefined>(undefined)
const sortBy = ref<'productCount' | 'aCount' | 'abCount' | 'abcCount' | 'dRatio'>('productCount')
const limit = ref(100)

const loading = ref(false)
const computing = ref(false)
const rows = ref<ShopProfileSummary[]>([])

const page = ref(1)
const pageSize = ref(20)

const emptyText = computed(() =>
  dataSource.value === 'snapshot'
    ? '暂无快照数据，请先点右上角「物化」生成，或切回实时聚合'
    : '暂无数据'
)

const currentBatch = computed(() => rows.value[0]?.latestBatchDate || batchDate.value || '')

const kpi = reactive({
  shopCount: 0,
  productCount: 0,
  aCount: 0,
  abcCount: 0,
  dCount: 0
})

function recalcKpi(list: ShopProfileSummary[]) {
  kpi.shopCount = list.length
  kpi.productCount = list.reduce((s, r) => s + (r.productCount || 0), 0)
  kpi.aCount = list.reduce((s, r) => s + (r.aCount || 0), 0)
  kpi.abcCount = list.reduce((s, r) => s + (r.abcCount || 0), 0)
  kpi.dCount = list.reduce((s, r) => s + (r.dCount || 0), 0)
}

const sortedRows = computed(() => {
  const key = sortBy.value
  return [...rows.value].sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedRows.value.slice(start, start + pageSize.value)
})

function applySort() {
  page.value = 1
}

function marketBadgeStyle(m: string) {
  const c = marketColor(m)
  return { background: c.bg, color: c.fg }
}

async function reload() {
  loading.value = true
  page.value = 1
  try {
    const params = {
      marketplace: marketplace.value,
      batchDate: batchDate.value || undefined,
      sellerName: sellerName.value || undefined,
      minProductCount: minProductCount.value ?? undefined,
      limit: limit.value
    }
    const fn = dataSource.value === 'snapshot' ? shopProfileApi.snapshots : shopProfileApi.summary
    const data = await fn(params)
    rows.value = data
    recalcKpi(data)
  } catch (e: any) {
    rows.value = []
    recalcKpi([])
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onMarketplaceChange() {
  // 切市场保留旧数据直到新数据返回，避免闪屏；这里只重置分页
  reload()
}

async function handleCompute() {
  try {
    await ElMessageBox.confirm(
      `将重新计算 ${marketplace.value} 的店铺画像快照，覆盖该市场旧快照，确认继续？`,
      '物化店铺画像',
      { type: 'warning', confirmButtonText: '确认物化', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  computing.value = true
  try {
    const r = await shopProfileApi.compute({
      marketplace: marketplace.value,
      batchDate: batchDate.value || undefined
    })
    if (r.requiresSqlMigration) {
      ElMessage.warning('缺少快照表，请先执行 create_analysis_baseline_tables.sql')
    } else {
      ElMessage.success(
        `物化完成：写入快照 ${r.insertedSnapshots ?? 0} 条 / 类目 ${r.insertedCategories ?? 0} 条`
      )
      dataSource.value = 'snapshot'
      await reload()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '物化失败')
  } finally {
    computing.value = false
  }
}

function goDetail(row: ShopProfileSummary) {
  router.push({
    name: 'ShopProfileDetail',
    params: { marketplace: row.marketplace, sellerName: encodeURIComponent(row.sellerName) },
    query: row.latestBatchDate ? { batchDate: row.latestBatchDate } : {}
  })
}

function goPositioning(row: ShopProfileSummary) {
  router.push({
    name: 'ShopProfileBaselines',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goBaselines() {
  router.push({ name: 'ShopProfileBaselines' })
}

onMounted(reload)
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
