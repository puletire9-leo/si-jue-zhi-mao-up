<template>
  <div class="shop-watchlist">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-button type="primary" @click="goCandidatePool">去方法卡找店</el-button>
        <el-select v-model="marketplace" placeholder="站点" style="width: 120px">
          <el-option label="全部站点" value="" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
          <el-option label="US" value="US" />
        </el-select>
        <el-select v-model="sourceTypeFilter" placeholder="来源" clearable style="width: 150px" @change="loadList">
          <el-option label="候选确认" value="CANDIDATE_CONFIRM" />
          <el-option label="人工加入" value="MANUAL" />
          <el-option label="基线" value="BASELINE" />
          <el-option label="历史方法卡" value="METHOD_CARD" />
        </el-select>
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
        正式观察池只放“已经确认要盯”的店铺，记录为什么盯、是否已抓全集、后续是否确认。
        方法卡命中的大量店铺先去「方法卡找店」候选池；卖家精灵抓取实况统一去「请求中心」。
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
const statusFilter = ref('')
const sourceTypeFilter = ref('')
const rows = ref<ShopWatchlist[]>([])
const loading = ref(false)

async function loadList() {
  loading.value = true
  try {
    rows.value = await shopCollectionApi.listWatchlist(
      marketplace.value || undefined,
      statusFilter.value || undefined,
      sourceTypeFilter.value || undefined
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '加载观察池失败')
  } finally {
    loading.value = false
  }
}

function openShop(row: ShopWatchlist) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goCandidatePool() {
  router.push({ name: 'module-shop-candidate-pool-ShopCandidatePool' })
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
