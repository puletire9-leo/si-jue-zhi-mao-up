<template>
  <div class="lingxing-profit">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">领星利润统计</span>
            <span class="summary-text">
              按店铺 + 时间窗（≤7 天）同步利润统计-ASIN，逐日一行。关键指标落列，200+ 费用项留底 raw_json
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
          placeholder="选择店铺（不选则拉全部有权限店铺）"
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
        时间窗跨度不超过 7 天（领星限制），返回按日期逐日一行。店铺不选则同步全部有权限店铺。
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
        <el-table-column prop="dataDate" label="日期" width="110" />
        <el-table-column prop="asin" label="ASIN" width="120" />
        <el-table-column prop="localSku" label="SKU" width="120" show-overflow-tooltip />
        <el-table-column prop="storeName" label="店铺" width="130" show-overflow-tooltip />
        <el-table-column prop="countryCode" label="国家" width="70" />
        <el-table-column prop="totalSalesQuantity" label="销量" width="80" />
        <el-table-column label="销售额" width="110">
          <template #default="{ row }">{{ row.totalSalesAmount ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="广告费" width="100">
          <template #default="{ row }">{{ row.totalAdsCost ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="合计成本" width="100">
          <template #default="{ row }">{{ row.totalCost ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="毛利润" width="110">
          <template #default="{ row }">
            <span :class="profitClass(row.grossProfit)">{{ row.grossProfit ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="毛利率" width="90">
          <template #default="{ row }">{{ fmtRate(row.grossRate) }}</template>
        </el-table-column>
        <el-table-column prop="currencyCode" label="币种" width="80" />
      </el-table>

      <el-empty v-if="!loading && rows.length === 0" description="暂无数据，选好时间窗后点「同步」" />

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
  type LingxingProfitAsin,
  type LingxingSeller
} from '@/api/lingxingProduct'

const loading = ref(false)
const syncing = ref(false)
const rows = ref<LingxingProfitAsin[]>([])
const total = ref(0)
const current = ref(1)
const size = ref(20)
const asinKeyword = ref('')

const sellers = ref<LingxingSeller[]>([])
const selectedSids = ref<number[]>([])
const dateRange = ref<[string, string] | null>(null)
const currencyCode = ref('')

function fmtRate(v: string | null): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return v
  return `${(n * 100).toFixed(2)}%`
}

function profitClass(v: string | null): string {
  if (v == null || v === '') return ''
  return Number(v) < 0 ? 'neg' : 'pos'
}

async function loadSellers() {
  try {
    sellers.value = await lingxingProductApi.listSellers(1)
  } catch {
    // 不阻塞本页
  }
}

async function fetchList() {
  loading.value = true
  try {
    const page = await lingxingProductApi.listProfitAsin(
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
  if (!dateRange.value) {
    ElMessage.warning('请选择时间窗（跨度不超过 7 天）')
    return
  }
  syncing.value = true
  try {
    const r = await lingxingProductApi.syncProfitAsin({
      sids: selectedSids.value.length ? selectedSids.value : undefined,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
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
.lingxing-profit {
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
.pos {
  color: var(--el-color-success);
}
.neg {
  color: var(--el-color-danger);
}
</style>
