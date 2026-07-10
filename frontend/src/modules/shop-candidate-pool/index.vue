<template>
  <div class="shop-candidate-pool">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="sourceTypeFilter" placeholder="来源" style="width: 130px" @change="handleSourceTypeChange">
          <el-option label="M1 方法卡" value="METHOD_CARD" />
          <el-option label="全部来源" value="" />
          <el-option label="人工加入" value="MANUAL" />
          <el-option label="基线" value="BASELINE" />
        </el-select>
        <el-select v-model="marketplace" placeholder="站点" style="width: 120px" @change="handleMarketplaceChange">
          <el-option label="全部站点" value="" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
          <el-option label="US" value="US" />
        </el-select>
        <el-select
          v-model="batchCode"
          placeholder="来源周批次"
          clearable
          filterable
          :loading="batchLoading"
          style="width: 190px"
          @change="handleBatchChange"
        >
          <el-option
            v-for="item in batchOptions"
            :key="item.batchCode"
            :label="batchOptionLabel(item)"
            :value="item.batchCode"
          />
        </el-select>
        <el-select v-model="methodId" placeholder="方法卡" style="width: 170px" @change="handleMethodChange">
          <el-option label="M1 / M01 新品加速法" value="M01" />
        </el-select>
        <el-input-number v-model="minCount" :min="1" :max="100" controls-position="right" style="width: 130px" />
        <el-button type="primary" :loading="syncing" @click="handleSyncFromRank">刷新 M1 通过店铺</el-button>
        <div class="spacer" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="handleFilterChange">
          <el-option label="待处理 PENDING" value="PENDING" />
          <el-option label="已选中 SELECTED" value="SELECTED" />
          <el-option label="抓取中 FETCHING" value="FETCHING" />
          <el-option label="已抓取 FETCHED" value="FETCHED" />
          <el-option label="抓取失败 FETCH_FAILED" value="FETCH_FAILED" />
          <el-option label="已忽略 IGNORED" value="IGNORED" />
          <el-option label="已入精品池 PROMOTED" value="PROMOTED" />
        </el-select>
        <el-button @click="loadList">刷新</el-button>
      </div>
      <div class="flow-strip">
        <span :class="['flow-step', 'active']">M1 通过店铺</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">单个/批量抓全集</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">看画像</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">入精品池</span>
        <span class="flow-note">当前表格默认只看 {{ methodId }} 方法卡命中的店铺；抓全集才会消耗卖家精灵次数。</span>
      </div>
      <div class="source-strip">
        <span>来源表：{{ selectedBatchOption?.sourceTable || 'competitor_products_clean' }}</span>
        <span>批次字段：{{ selectedBatchOption?.sourceWeekField || 'effective_week_tag' }}</span>
        <span>当前批次：{{ batchCode || '全部候选池批次' }}</span>
        <span v-if="selectedBatchOption">
          命中商品 {{ selectedBatchOption.productCount }} 个 / 店铺 {{ selectedBatchOption.sellerCount }} 家
        </span>
        <span v-else>未选批次时仅查看候选池已有记录；刷新方法卡会自动使用最新来源批次。</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="result-bar">
        <span>当前列表：{{ resultScopeLabel }}</span>
        <span>共 {{ total }} 家</span>
        <span>已选 {{ selectedRows.length }} 家，可抓 {{ fetchableSelectedCount }} 家</span>
        <span v-if="currentPageDuplicateCount > 0">本页跨批重复 {{ currentPageDuplicateCount }} 条</span>
        <div class="result-actions">
          <el-button size="small" @click="selectCurrentPageFetchable">全选本页可抓店铺</el-button>
          <el-button size="small" :loading="allSelecting" @click="selectAllFetchable">全选全部可抓店铺</el-button>
          <el-button size="small" @click="clearSelection">清空选择</el-button>
        </div>
      </div>
      <el-table ref="tableRef" :data="rows" v-loading="loading" stripe height="calc(100vh - 325px)" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="marketplace" label="站点" width="70" />
        <el-table-column prop="sellerName" label="店铺名" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.sellerName }}</span>
            <el-tag v-if="isCurrentPageDuplicate(row)" size="small" type="warning" class="duplicate-tag">跨批重复</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="命中数" width="90" sortable :sort-by="'hitCount'">
          <template #default="{ row }">
            <el-tag type="success" v-if="row.hitCount != null">{{ row.hitCount }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="topCategory" label="主打类目" min-width="140" show-overflow-tooltip />
        <el-table-column prop="batchCode" label="周批次" width="110" />
        <el-table-column label="通过方法" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="row.sourceType === 'METHOD_CARD' ? 'primary' : 'info'">
              {{ sourceLabel(row.sourceType) }}
            </el-tag>
            <span v-if="row.sourceCode" class="src-code">{{ row.sourceCode }}</span>
          </template>
        </el-table-column>
        <el-table-column label="通过原因" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            {{ reasonText(row) }}
          </template>
        </el-table-column>
        <el-table-column label="上次错误" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="error-text" v-if="row.lastErrorMessage">{{ row.lastErrorMessage }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="抓取" width="100">
          <template #default="{ row }">
            <span v-if="row.fetchRunId" :title="row.fetchRunId">有记录</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              :disabled="!canFetch(row.status)"
              @click="handleFetch(row)"
            >抓全集</el-button>
            <el-button size="small" link @click="openShop(row)">看画像</el-button>
            <el-button size="small" type="success" link :disabled="row.status !== 'FETCHED'" @click="handlePromote(row)">入精品池</el-button>
            <el-dropdown @command="(c: string) => handleStatus(row, c)" trigger="click">
              <el-button size="small" link>标记<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="SELECTED" :disabled="row.status !== 'PENDING'">选中</el-dropdown-item>
                  <el-dropdown-item command="IGNORED">忽略</el-dropdown-item>
                  <el-dropdown-item command="PENDING" :disabled="!canResetPending(row.status)">重置为待处理</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" type="danger" link @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="footer-bar" v-if="selectedRows.length > 0">
        <span>已选 {{ selectedRows.length }} 家，可抓 {{ fetchableSelectedCount }} 家</span>
        <el-button type="primary" size="small" :loading="batchFetching" @click="handleBatchFetch">
          批量抓全集
        </el-button>
      </div>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next"
        small
        style="margin-top: 10px; justify-content: flex-end"
        @current-change="loadList"
        @size-change="loadList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElTable } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { shopCandidateApi, type ShopCandidatePool, type ShopMethodBatchOption } from '@/api/shopCandidate'
import { requestCenterApi, shopPremiumApi } from '@/api/shopPremium'

const router = useRouter()
const marketplace = ref('')
const batchCode = ref('')
const sourceTypeFilter = ref('METHOD_CARD')
const methodId = ref('M01')
const minCount = ref(1)
const statusFilter = ref('')
const rows = ref<ShopCandidatePool[]>([])
const batchOptions = ref<ShopMethodBatchOption[]>([])
const loading = ref(false)
const batchLoading = ref(false)
const syncing = ref(false)
const batchFetching = ref(false)
const allSelecting = ref(false)
const selectedRows = ref<ShopCandidatePool[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
const syncingTableSelection = ref(false)

const page = ref(1)
const size = ref(50)
const total = ref(0)
const fetchableSelectedCount = computed(() => selectedRows.value.filter((row) => canFetch(row.status)).length)
const selectedBatchOption = computed(() => batchOptions.value.find((item) => item.batchCode === batchCode.value))
const currentPageDuplicateKeys = computed(() => {
  const counts = new Map<string, number>()
  rows.value.forEach((row) => {
    const key = candidateKey(row)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
})
const currentPageDuplicateCount = computed(() => rows.value.filter((row) => isCurrentPageDuplicate(row)).length)
const resultScopeLabel = computed(() => {
  if (sourceTypeFilter.value === 'METHOD_CARD') return `${methodId.value} 方法卡通过店铺`
  if (sourceTypeFilter.value === 'MANUAL') return '人工加入店铺'
  if (sourceTypeFilter.value === 'BASELINE') return '基线来源店铺'
  return '全部店铺候选'
})

async function loadMethodBatches(preferLatest = false) {
  batchLoading.value = true
  try {
    const list = await shopCandidateApi.methodBatches({
      methodId: methodId.value,
      marketplace: marketplace.value || undefined,
      limit: 50
    })
    batchOptions.value = list || []
    if (preferLatest) {
      batchCode.value = batchOptions.value[0]?.batchCode || ''
    } else if (batchCode.value && !batchOptions.value.some((item) => item.batchCode === batchCode.value)) {
      batchCode.value = batchOptions.value[0]?.batchCode || ''
    }
  } catch (e: any) {
    batchOptions.value = []
    ElMessage.error(e?.message || '加载方法卡来源批次失败')
  } finally {
    batchLoading.value = false
  }
}

async function loadList() {
  loading.value = true
  try {
    const r = await shopCandidateApi.list({
      marketplace: marketplace.value || undefined,
      batchCode: batchCode.value || undefined,
      sourceType: sourceTypeFilter.value || undefined,
      sourceCode: sourceTypeFilter.value === 'METHOD_CARD' ? methodId.value : undefined,
      status: statusFilter.value || undefined,
      minHitCount: sourceTypeFilter.value === 'METHOD_CARD' ? minCount.value : undefined,
      page: page.value,
      size: size.value
    })
    rows.value = r.list || []
    total.value = r.total || 0
    await syncVisibleSelection()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载候选池失败')
  } finally {
    loading.value = false
  }
}

async function handleSyncFromRank() {
  sourceTypeFilter.value = 'METHOD_CARD'
  if (!batchCode.value) {
    await loadMethodBatches(true)
  }
  if (!batchCode.value) {
    ElMessage.warning('没有可用的方法卡来源周批次，请先确认 competitor_products_clean 是否已有 M01 命中数据')
    return
  }
  syncing.value = true
  try {
    const r = await shopCandidateApi.syncFromMethodRank(
      methodId.value,
      marketplace.value || undefined,
      minCount.value,
      batchCode.value || undefined
    )
    ElMessage.success(`${r.methodId} 通过店铺 ${r.rankedShops} 家，写入候选池 ${r.upserted} 家（${r.batchCode}）`)
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

function handleSourceTypeChange() {
  page.value = 1
  clearSelection()
  loadList()
}

async function handleMarketplaceChange() {
  page.value = 1
  clearSelection()
  await loadMethodBatches(true)
  await loadList()
}

async function handleMethodChange() {
  sourceTypeFilter.value = 'METHOD_CARD'
  page.value = 1
  clearSelection()
  await loadMethodBatches(true)
  await loadList()
}

function handleBatchChange() {
  page.value = 1
  clearSelection()
  loadList()
}

function handleFilterChange() {
  page.value = 1
  clearSelection()
  loadList()
}

function canFetch(status: string): boolean {
  return ['PENDING', 'SELECTED', 'FETCH_FAILED'].includes(status)
}

function canResetPending(status: string): boolean {
  return ['SELECTED', 'FETCH_FAILED', 'IGNORED'].includes(status)
}

async function handleFetch(row: ShopCandidatePool) {
  try {
    await ElMessageBox.confirm(
      `将为「${row.sellerName}」(${row.marketplace}) 创建请求中心任务。任务推进时会抓取店铺全集并消耗卖家精灵使用次数。确认继续？`,
      '创建店铺抓取任务',
      { type: 'warning', confirmButtonText: '创建任务', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    const task = await createCandidateFetchTask([row])
    ElMessage.success(`请求中心任务已创建：${task.runId}`)
    await loadList()
    goToRequestCenter(task.runId)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建任务失败')
  }
}

async function handleBatchFetch() {
  if (selectedRows.value.length === 0) return
  const fetchable = selectedRows.value.filter((r) => canFetch(r.status))
  if (fetchable.length === 0) {
    ElMessage.warning('所选店铺没有可抓取的（状态需为 PENDING/SELECTED/FETCH_FAILED）')
    return
  }
  const { list: deduped, duplicateCount } = dedupeCandidatesForFetch(fetchable)
  try {
    await ElMessageBox.confirm(
      `将对 ${deduped.length} 家店铺创建请求中心任务。${duplicateCount > 0 ? `已自动跳过跨批重复 ${duplicateCount} 条，按命中数高、批次新的记录保留。` : ''}预计至少消耗 ${deduped.length} 次使用次数，实际按店铺分页计算；可在请求中心推进、暂停、停止、重试。确认继续？`,
      '创建候选批量抓取任务',
      { type: 'warning', confirmButtonText: '创建任务', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  batchFetching.value = true
  try {
    const task = await createCandidateFetchTask(deduped)
    ElMessage.success(`请求中心任务已创建：${task.runId}，共 ${task.totalCount} 家`)
    clearSelection()
    await loadList()
    goToRequestCenter(task.runId)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建任务失败')
  } finally {
    batchFetching.value = false
  }
}

function createCandidateFetchTask(candidates: ShopCandidatePool[]) {
  return requestCenterApi.createTask({
    requestType: 'CANDIDATE_BATCH',
    triggerType: 'CANDIDATE_CONFIRM',
    triggerRef: buildCandidateBatchTriggerRef(candidates),
    fetchReason: '候选池确认抓取店铺全集',
    items: candidates.map((row) => ({
      marketplace: row.marketplace,
      sellerName: row.sellerName,
      triggerId: row.id
    }))
  })
}

function onSelectionChange(sel: ShopCandidatePool[]) {
  if (syncingTableSelection.value) return
  const currentPageIds = new Set(rows.value.map((row) => row.id))
  const keepInvisible = selectedRows.value.filter((row) => !currentPageIds.has(row.id))
  selectedRows.value = [...keepInvisible, ...sel]
}

function selectCurrentPageFetchable() {
  rows.value.filter((row) => canFetch(row.status)).forEach((row) => {
    tableRef.value?.toggleRowSelection(row, true)
  })
}

function buildCandidateBatchTriggerRef(candidates: ShopCandidatePool[]) {
  const marketplaceSet = Array.from(new Set(candidates.map((row) => row.marketplace))).sort()
  const batchSet = Array.from(new Set(candidates.map((row) => row.batchCode).filter(Boolean))).sort()
  return JSON.stringify({
    source: 'shop_candidate_pool',
    sourceCode: sourceTypeFilter.value === 'METHOD_CARD' ? methodId.value : sourceTypeFilter.value || 'ALL',
    batchCode: batchCode.value || 'ALL',
    selectedCount: candidates.length,
    marketplaces: marketplaceSet,
    batches: batchSet.slice(-5)
  })
}

async function selectAllFetchable() {
  allSelecting.value = true
  try {
    const list = await shopCandidateApi.listFetchable({
      marketplace: marketplace.value || undefined,
      batchCode: batchCode.value || undefined,
      sourceType: sourceTypeFilter.value || undefined,
      sourceCode: sourceTypeFilter.value === 'METHOD_CARD' ? methodId.value : undefined,
      status: statusFilter.value || undefined,
      minHitCount: sourceTypeFilter.value === 'METHOD_CARD' ? minCount.value : undefined,
      limit: 10000
    })
    selectedRows.value = list || []
    await syncVisibleSelection()
    if (selectedRows.value.length >= 10000) {
      ElMessage.warning('已选择前 10000 家可抓店铺；如还有更多，请收窄筛选条件后分批处理')
    } else {
      ElMessage.success(`已全选当前筛选条件下 ${selectedRows.value.length} 家可抓店铺`)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '全选全部可抓店铺失败')
  } finally {
    allSelecting.value = false
  }
}

function clearSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

async function syncVisibleSelection() {
  await nextTick()
  syncingTableSelection.value = true
  try {
    tableRef.value?.clearSelection()
    const selectedIds = new Set(selectedRows.value.map((row) => row.id))
    rows.value.forEach((row) => {
      if (selectedIds.has(row.id)) {
        tableRef.value?.toggleRowSelection(row, true)
      }
    })
  } finally {
    await nextTick()
    syncingTableSelection.value = false
  }
}

function candidateKey(row: ShopCandidatePool) {
  return `${row.marketplace || ''}::${(row.sellerName || '').trim().toLowerCase()}`
}

function isCurrentPageDuplicate(row: ShopCandidatePool) {
  return (currentPageDuplicateKeys.value.get(candidateKey(row)) || 0) > 1
}

function dedupeCandidatesForFetch(candidates: ShopCandidatePool[]) {
  const map = new Map<string, ShopCandidatePool>()
  candidates.forEach((row) => {
    const key = candidateKey(row)
    const existing = map.get(key)
    if (!existing || compareCandidatePriority(row, existing) > 0) {
      map.set(key, row)
    }
  })
  return {
    list: Array.from(map.values()),
    duplicateCount: candidates.length - map.size
  }
}

function compareCandidatePriority(a: ShopCandidatePool, b: ShopCandidatePool) {
  const hitDiff = (a.hitCount || 0) - (b.hitCount || 0)
  if (hitDiff !== 0) return hitDiff
  return String(a.batchCode || '').localeCompare(String(b.batchCode || ''))
}

function batchOptionLabel(item: ShopMethodBatchOption) {
  return `${item.batchCode} · ${item.sellerCount} 店 / ${item.productCount} 品`
}

function openShop(row: ShopCandidatePool) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function goToRequestCenter(runId?: string) {
  router.push({
    name: 'module-sellersprite-request-center-SellerspriteRequestCenter',
    ...(runId ? { query: { runId } } : {})
  })
}

async function handleStatus(row: ShopCandidatePool, status: string) {
  try {
    await shopCandidateApi.updateStatus(row.id, status)
    ElMessage.success('状态已更新')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function handlePromote(row: ShopCandidatePool) {
  try {
    await ElMessageBox.confirm(
      `将「${row.sellerName}」提升到精品店铺池？候选已 FETCHED，将推进为 PROMOTED 并回填 premium_id。`,
      '入精品池',
      { type: 'warning', confirmButtonText: '入池', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await shopPremiumApi.promoteFromCandidate(row.id, {
      tagsJson: '["候选提升"]',
      qualityLevel: 'MID',
      refreshFrequency: 'MONTHLY'
    })
    ElMessage.success('已加入精品池')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '入池失败')
  }
}

async function handleRemove(row: ShopCandidatePool) {
  try {
    await ElMessageBox.confirm(`确认从候选池移除「${row.sellerName}」？`, '移除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await shopCandidateApi.delete(row.id)
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
function reasonText(row: ShopCandidatePool) {
  if (row.reason) return row.reason
  if (row.sourceType === 'METHOD_CARD') {
    return `${row.sourceCode || '方法卡'} 命中 ${row.hitCount ?? '-'} 个合格新品${row.topCategory ? `，主打 ${row.topCategory}` : ''}`
  }
  return '-'
}
function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDING: '待处理', SELECTED: '已选中', FETCHING: '抓取中', FETCHED: '已抓取',
    FETCH_FAILED: '抓取失败', IGNORED: '已忽略', PROMOTED: '已入精品池'
  }
  return map[s] || s
}
function statusType(s: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
    PENDING: 'info', SELECTED: 'warning', FETCHING: 'primary', FETCHED: 'success',
    FETCH_FAILED: 'danger', IGNORED: 'info', PROMOTED: 'success'
  }
  return map[s] || 'info'
}

onMounted(async () => {
  await loadMethodBatches(true)
  await loadList()
})
</script>

<style scoped lang="scss">
.shop-candidate-pool {
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
.tip {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
.flow-strip,
.result-bar,
.source-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: #606266;
  font-size: 12px;
}
.flow-step {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}
.flow-step.active {
  color: #b45309;
  border-color: #f3d19e;
  background: #fdf6ec;
}
.flow-arrow {
  color: #c0c4cc;
}
.flow-note {
  margin-left: 6px;
  color: #909399;
}
.result-bar {
  margin: 0 0 10px;
  justify-content: flex-start;
}
.source-strip {
  padding-top: 8px;
  color: #909399;
}
.result-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.duplicate-tag {
  margin-left: 6px;
}
.src-code {
  margin-left: 6px;
  color: #909399;
  font-size: 12px;
}
.error-text {
  color: #f56c6c;
}
.footer-bar {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #606266;
  font-size: 13px;
}
</style>
