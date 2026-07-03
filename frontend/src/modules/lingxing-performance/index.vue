<template>
  <div class="lingxing-performance">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">领星产品表现</span>
            <span class="summary-text">
              按店铺 + 时间窗（≤92 天）同步产品表现。关键指标落列，完整 200+ 指标留底 raw_json
            </span>
          </div>
        </div>
      </template>

      <!-- 同步条件 -->
      <div class="sync-bar">
        <el-select
          v-model="selectedSids"
          multiple
          collapse-tags
          collapse-tags-tooltip
          filterable
          placeholder="选择店铺（必填，上限 200）"
          style="width: 320px"
        >
          <el-option
            v-for="s in sellers"
            :key="s.sid"
            :label="`${s.name || s.sellerId || s.sid}（${s.country || s.region || ''}）`"
            :value="s.sid"
          />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-select v-model="summaryField" style="width: 130px">
          <el-option label="ASIN" value="asin" />
          <el-option label="父 ASIN" value="parent_asin" />
          <el-option label="MSKU" value="msku" />
          <el-option label="SKU" value="sku" />
        </el-select>
        <el-select v-model="currencyCode" clearable placeholder="原币种" style="width: 110px">
          <el-option label="USD" value="USD" />
          <el-option label="CNY" value="CNY" />
        </el-select>
        <el-button type="primary" :loading="syncing" @click="handleSync">同步</el-button>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin: 12px 0"
      >
        店铺必填、上限 200；时间窗跨度不超过 92 天。多店铺同步受领星限流（每页间隔 10 秒），可能耗时较久。
        未同步店铺请先到「领星店铺」页拉取。
      </el-alert>

      <div class="filter-bar">
        <el-input
          v-model="asinKeyword"
          placeholder="按 ASIN 模糊查询"
          clearable
          size="small"
          style="width: 200px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-button size="small" @click="handleSearch">查询</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" border stripe size="small">
        <el-table-column prop="summaryValue" label="维度值" width="140" show-overflow-tooltip />
        <el-table-column prop="asin" label="ASIN" width="120" />
        <el-table-column prop="itemName" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="volume" label="销量" width="90" />
        <el-table-column prop="orderItems" label="订单量" width="90" />
        <el-table-column label="销售额" width="110">
          <template #default="{ row }">{{ row.amount ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="毛利润" width="110">
          <template #default="{ row }">{{ row.grossProfit ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="毛利率" width="90">
          <template #default="{ row }">{{ fmtRate(row.grossMargin) }}</template>
        </el-table-column>
        <el-table-column prop="sessionsTotal" label="Sessions" width="100" />
        <el-table-column label="广告花费" width="100">
          <template #default="{ row }">{{ row.spend ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="TACOS" width="90">
          <template #default="{ row }">{{ fmtRate(row.tacos) }}</template>
        </el-table-column>
        <el-table-column prop="currencyCode" label="币种" width="80" />
        <el-table-column label="时间窗" width="180">
          <template #default="{ row }">{{ row.startDate }} ~ {{ row.endDate }}</template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && rows.length === 0" description="暂无数据，选好店铺和时间窗后点「同步」" />

      <div class="pager">
        <el-pagination
          v-model:current-page="current"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="fetchList"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  lingxingProductApi,
  type LingxingProductPerformance,
  type LingxingSeller
} from '@/api/lingxingProduct'

const loading = ref(false)
const syncing = ref(false)
const rows = ref<LingxingProductPerformance[]>([])
const total = ref(0)
const current = ref(1)
const size = ref(20)
const asinKeyword = ref('')

const sellers = ref<LingxingSeller[]>([])
const selectedSids = ref<number[]>([])
const dateRange = ref<[string, string] | null>(null)
const summaryField = ref('asin')
const currencyCode = ref('')

function fmtRate(v: string | null): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return v
  return `${(n * 100).toFixed(2)}%`
}

async function loadSellers() {
  try {
    sellers.value = await lingxingProductApi.listSellers(1) // 只列正常店铺
  } catch {
    // 店铺没同步不阻塞本页，提示在同步时给出
  }
}

async function fetchList() {
  loading.value = true
  try {
    const page = await lingxingProductApi.listProductPerformance(
      current.value,
      size.value,
      asinKeyword.value.trim() || undefined
    )
    rows.value = page.records ?? []
    total.value = page.total ?? 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  current.value = 1
  fetchList()
}

function handleSizeChange() {
  current.value = 1
  fetchList()
}

async function handleSync() {
  if (selectedSids.value.length === 0) {
    ElMessage.warning('请先选择店铺（未同步店铺请到「领星店铺」页拉取）')
    return
  }
  if (!dateRange.value) {
    ElMessage.warning('请选择时间窗')
    return
  }
  syncing.value = true
  try {
    const r = await lingxingProductApi.syncProductPerformance({
      sids: selectedSids.value,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      summaryField: summaryField.value,
      currencyCode: currencyCode.value || undefined
    })
    ElMessage.success(`同步完成：${r.pages} 页 / 拉取 ${r.fetched} 条 / 落库 ${r.upserted} 条`)
    current.value = 1
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await loadSellers()
  await fetchList()
})
</script>

<style scoped lang="scss">
.lingxing-performance {
  padding: 20px;
}
.card-header .title {
  font-size: 16px;
  font-weight: 600;
}
.card-header .summary-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sync-bar,
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.filter-bar {
  margin-bottom: 12px;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
