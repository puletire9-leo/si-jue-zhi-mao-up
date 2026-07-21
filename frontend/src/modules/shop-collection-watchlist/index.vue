<template>
  <div class="shop-watchlist">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-button type="primary" @click="goCandidatePool">去店铺请求中心</el-button>
        <ShopScreeningToolbar
          v-model="filters"
          :batches="batches"
          :loading="loading"
          show-watchlist-filters
          @search="searchList"
          @marketplace-change="handleMarketplaceChange"
        />
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 280px)">
        <el-table-column prop="marketplace" label="站点" width="65" />
        <el-table-column prop="sellerName" label="店铺名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="latestBatchCode" label="周批次" width="105" />
        <el-table-column label="通过筛选" width="95">
          <template #default="{ row }"><strong>{{ row.passedProductCount }}</strong></template>
        </el-table-column>
        <el-table-column label="M01" width="80">
          <template #default="{ row }">
            <el-tag type="success" v-if="row.m01HitCount">{{ row.m01HitCount }}</el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column prop="productCount" label="商品数" width="85" />
        <el-table-column label="平均上架" width="90"><template #default="{ row }">{{ row.avgListingDays == null ? '-' : Math.round(row.avgListingDays) }}</template></el-table-column>
        <el-table-column prop="topCategory" label="主打类目" min-width="140" show-overflow-tooltip />
        <el-table-column label="来源" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="row.sourceType === 'METHOD_CARD' ? 'primary' : 'info'">
              {{ sourceLabel(row.sourceType) }}
            </el-tag>
            <span v-if="row.sourceCode" class="src-code">{{ row.sourceCode }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="进池原因" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.watchlistStatus)">{{ statusLabel(row.watchlistStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="openShop(row)">看画像</el-button>
            <el-dropdown @command="(c: string) => handleStatus(row, c)" trigger="click">
              <el-button size="small" link>标记<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="CONFIRMED">确认</el-dropdown-item>
                  <el-dropdown-item command="IGNORED">忽略</el-dropdown-item>
                  <el-dropdown-item command="WATCHING">重新观察</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" type="danger" link @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :page-sizes="[20, 30, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        class="pager"
        @current-change="loadList"
        @size-change="handleSizeChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import shopCollectionApi, { type ShopScreeningBatch, type ShopScreeningRow } from '@/api/shopCollection'
import ShopScreeningToolbar from '@/modules/shop-collection-shared/ShopScreeningToolbar.vue'
import { buildShopScreeningQuery, createShopScreeningFilters } from '@/modules/shop-collection-shared/shopScreening'

const router = useRouter()
const filters = ref(createShopScreeningFilters('UK'))
const batches = ref<ShopScreeningBatch[]>([])
const rows = ref<ShopScreeningRow[]>([])
const page = ref(1)
const size = ref(30)
const total = ref(0)
const loading = ref(false)

async function loadList() {
  loading.value = true
  try {
    const result = await shopCollectionApi.screenShops(
      buildShopScreeningQuery(filters.value, 'WATCHLIST', page.value, size.value)
    )
    rows.value = result.list || []
    total.value = result.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载观察池失败')
  } finally {
    loading.value = false
  }
}

async function loadBatches() {
  batches.value = await shopCollectionApi.screeningBatches(filters.value.marketplace)
}
function searchList() { page.value = 1; loadList() }
async function handleMarketplaceChange() { page.value = 1; await loadBatches(); await loadList() }
function handleSizeChange() { page.value = 1; loadList() }

function openShop(row: ShopScreeningRow) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goCandidatePool() {
  router.push({ name: 'module-shop-candidate-pool-ShopCandidatePool' })
}

async function handleStatus(row: ShopScreeningRow, status: string) {
  try {
    if (!row.watchlistId) return
    await shopCollectionApi.updateWatchlistStatus(row.watchlistId, status)
    ElMessage.success('状态已更新')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function handleRemove(row: ShopScreeningRow) {
  try {
    await ElMessageBox.confirm(`确认从观察池移除「${row.sellerName}」？`, '移除', { type: 'warning' })
  } catch {
    return
  }
  try {
    if (!row.watchlistId) return
    await shopCollectionApi.removeWatchlist(row.watchlistId)
    ElMessage.success('已移除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '移除失败')
  }
}

function sourceLabel(t: string | null) {
  const map: Record<string, string> = {
    METHOD_CARD: '方法卡', BASELINE: '基线', MANUAL: '人工', OWN_GOOD_SIMILAR: '自有相似', CATEGORY: '类目'
  }
  return t ? map[t] || t : '-'
}
function statusLabel(s: string | null) {
  const map: Record<string, string> = { WATCHING: '观察中', FETCHED: '已抓取', CONFIRMED: '已确认', IGNORED: '已忽略' }
  return s ? map[s] || s : '-'
}
function statusType(s: string | null): 'primary' | 'success' | 'info' | 'warning' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = {
    WATCHING: 'warning', FETCHED: 'primary', CONFIRMED: 'success', IGNORED: 'info'
  }
  return s ? map[s] || 'info' : 'info'
}

onMounted(async () => { await loadBatches(); await loadList() })
</script>

<style scoped lang="scss">
.shop-watchlist {
  padding: 16px;
}
.header-card {
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar .spacer {
  flex: 1;
}
.toolbar .hint {
  color: #909399;
  font-size: 13px;
}
.tip {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
.src-code {
  margin-left: 6px;
  color: #909399;
  font-size: 12px;
}
.pager { justify-content: flex-end; padding: 12px 16px; }
</style>
