<template>
  <div class="shop-watchlist">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="marketplace" placeholder="站点" style="width: 120px">
          <el-option label="全部站点" value="" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
          <el-option label="US" value="US" />
        </el-select>
        <el-select v-model="methodId" placeholder="方法卡" style="width: 140px">
          <el-option label="M01 新品加速法" value="M01" />
        </el-select>
        <el-input-number v-model="minCount" :min="1" :max="100" controls-position="right" style="width: 130px" />
        <span class="hint">命中数下限</span>
        <el-button type="primary" :loading="syncing" @click="handleSyncFromRank">
          按方法卡刷新观察池
        </el-button>
        <div class="spacer" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="loadList">
          <el-option label="观察中 WATCHING" value="WATCHING" />
          <el-option label="已抓取 FETCHED" value="FETCHED" />
          <el-option label="已确认 CONFIRMED" value="CONFIRMED" />
          <el-option label="已忽略 IGNORED" value="IGNORED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
      </div>
      <div class="tip">
        主线：方法卡命中 → 观察池（记录为什么盯）→ 抓店铺全集 → 画像解释。
        「按方法卡刷新观察池」会跑一遍 M01 店铺排名，把命中达标的店铺写入观察池。
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 280px)">
        <el-table-column prop="marketplace" label="站点" width="70" />
        <el-table-column prop="sellerName" label="店铺名" min-width="180" show-overflow-tooltip />
        <el-table-column label="命中数" width="90" sortable :sort-by="'hitCount'">
          <template #default="{ row }">
            <el-tag type="success" v-if="row.hitCount != null">{{ row.hitCount }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="topCategory" label="主打类目" min-width="150" show-overflow-tooltip />
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
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleFetch(row)">抓全集</el-button>
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import shopCollectionApi, { type ShopWatchlist } from '@/api/shopCollection'

const router = useRouter()
const marketplace = ref('')
const methodId = ref('M01')
const minCount = ref(1)
const statusFilter = ref('')
const rows = ref<ShopWatchlist[]>([])
const loading = ref(false)
const syncing = ref(false)

async function loadList() {
  loading.value = true
  try {
    rows.value = await shopCollectionApi.listWatchlist(marketplace.value || undefined, statusFilter.value || undefined)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载观察池失败')
  } finally {
    loading.value = false
  }
}

async function handleSyncFromRank() {
  syncing.value = true
  try {
    const r = await shopCollectionApi.syncWatchlistFromMethodRank(methodId.value, marketplace.value || undefined, minCount.value)
    ElMessage.success(`${r.methodId} 排名 ${r.rankedShops} 家，写入观察池 ${r.upserted} 家`)
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

async function handleFetch(row: ShopWatchlist) {
  try {
    await ElMessageBox.confirm(
      `将调用卖家精灵抓取「${row.sellerName}」(${row.marketplace}) 的店铺全集，消耗卖家精灵使用次数。确认继续？`,
      '抓取店铺全集',
      { type: 'warning', confirmButtonText: '抓取', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  const loadingMsg = ElMessage({ message: `抓取中：${row.sellerName}…`, duration: 0, type: 'info' })
  try {
    const r = await shopCollectionApi.syncShopProducts(row.marketplace, row.sellerName, row.reason || undefined, row.id)
    ElMessage.success(`抓取完成：${r.total} 个商品，入库 ${r.inserted}`)
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '抓取失败')
  } finally {
    loadingMsg.close()
  }
}

function openShop(row: ShopWatchlist) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

async function handleStatus(row: ShopWatchlist, status: string) {
  try {
    await shopCollectionApi.updateWatchlistStatus(row.id, status)
    ElMessage.success('状态已更新')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function handleRemove(row: ShopWatchlist) {
  try {
    await ElMessageBox.confirm(`确认从观察池移除「${row.sellerName}」？`, '移除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await shopCollectionApi.removeWatchlist(row.id)
    ElMessage.success('已移除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '移除失败')
  }
}

function sourceLabel(t: string) {
  const map: Record<string, string> = {
    METHOD_CARD: '方法卡', BASELINE: '基线', MANUAL: '人工', OWN_GOOD_SIMILAR: '自有相似', CATEGORY: '类目'
  }
  return map[t] || t
}
function statusLabel(s: string) {
  const map: Record<string, string> = { WATCHING: '观察中', FETCHED: '已抓取', CONFIRMED: '已确认', IGNORED: '已忽略' }
  return map[s] || s
}
function statusType(s: string): 'primary' | 'success' | 'info' | 'warning' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = {
    WATCHING: 'warning', FETCHED: 'primary', CONFIRMED: 'success', IGNORED: 'info'
  }
  return map[s] || 'info'
}

onMounted(loadList)
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
</style>
