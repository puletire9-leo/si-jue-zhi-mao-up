<template>
  <div class="shop-candidate-pool">
    <el-card shadow="never" class="mode-card">
      <el-radio-group v-model="requestMode" size="large">
        <el-radio-button label="NORMAL">正常店铺请求</el-radio-button>
        <el-radio-button label="DENG_ZONG">非标店铺上新</el-radio-button>
      </el-radio-group>
      <span class="mode-description">
        {{ requestMode === 'NORMAL'
          ? '普通候选店铺：进入 shop_candidate_pool，抓取结果写入 shop_products。'
          : '独立非标名单：读取 deng_zong_shop_seller，可重复抓取，结果只写 deng_zong_shop。' }}
      </span>
    </el-card>
    <template v-if="requestMode === 'NORMAL'">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="sourceTypeFilter" placeholder="来源" style="width: 130px" @change="handleSourceTypeChange">
          <el-option label="M1 方法卡" value="METHOD_CARD" />
          <el-option label="批次全部" value="BATCH_ALL" />
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
          placeholder="来源日期"
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
        <el-button type="primary" :loading="syncing" @click="handleSyncFromRank">获取 M1 通过店铺</el-button>
        <el-button :loading="syncingAll" @click="handleSyncAllFromBatch">获取批次全部店铺</el-button>
        <div class="spacer" />
        <el-radio-group v-model="requestState" size="small" @change="handleRequestStateChange">
          <el-radio-button label="UNREQUESTED">未请求</el-radio-button>
          <el-radio-button label="REQUESTED">已请求</el-radio-button>
        </el-radio-group>
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
        <span :class="['flow-step', { active: sourceTypeFilter === 'METHOD_CARD' }]">M1 通过店铺</span>
        <span class="flow-or">或</span>
        <span :class="['flow-step', { active: sourceTypeFilter === 'BATCH_ALL' }]">批次全部店铺</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">单个/批量抓全集</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">看画像</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">入精品池</span>
        <span class="flow-note">可获取 M1 通过店铺，也可忽略方法卡结果获取本批次全部店铺；抓全集才会消耗卖家精灵次数。</span>
      </div>
      <div class="source-strip">
        <span>来源表：{{ selectedBatchOption?.sourceTable || 'competitor_products_clean' }}</span>
        <span>批次字段：{{ selectedBatchOption?.sourceWeekField || 'effective_week_tag' }}</span>
        <span>当前批次：{{ selectedBatchDateLabel || '全部候选池批次' }}</span>
        <span v-if="selectedBatchOption">
          批次商品 {{ selectedBatchOption.productCount }} 个 / 全部店铺 {{ selectedBatchOption.sellerCount }} 家
        </span>
        <span v-else>未选批次时仅查看候选池已有记录；获取店铺会自动使用最新来源批次。</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="result-bar">
        <span>当前列表：{{ requestState === 'UNREQUESTED' ? '未请求' : '已请求' }} · {{ resultScopeLabel }}</span>
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
        <el-table-column type="selection" width="45" :selectable="isRowSelectable" />
        <el-table-column prop="marketplace" label="站点" width="70" />
        <el-table-column prop="sellerName" label="店铺名" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.sellerName }}</span>
            <el-tag v-if="isCurrentPageDuplicate(row)" size="small" type="warning" class="duplicate-tag">跨批重复</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商品数" width="90" sortable :sort-by="'hitCount'">
          <template #default="{ row }">
            <el-tag type="success" v-if="row.hitCount != null">{{ row.hitCount }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="topCategory" label="主打类目" min-width="140" show-overflow-tooltip />
        <el-table-column label="批次日期" width="130">
          <template #default="{ row }">
            {{ displayBatchDate(row.batchCode, row.batchDate) }}
          </template>
        </el-table-column>
        <el-table-column label="来源方式" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="row.sourceType === 'METHOD_CARD' ? 'primary' : 'info'">
              {{ sourceLabel(row.sourceType) }}
            </el-tag>
            <span v-if="row.sourceCode" class="src-code">{{ row.sourceCode }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源说明" min-width="240" show-overflow-tooltip>
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
        <el-table-column label="请求记录" width="100">
          <template #default="{ row }">
            <el-tag :type="row.requested ? 'success' : 'info'" size="small">
              {{ row.requested ? '已请求' : '未请求' }}
            </el-tag>
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
              :disabled="!canFetchCandidate(row)"
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
    </template>

    <template v-else>
      <el-card shadow="never" class="deng-zong-card">
        <div class="toolbar">
          <el-select v-model="dengMarketplace" placeholder="全部站点" clearable style="width: 130px" @change="loadDengSellers">
            <el-option label="UK" value="UK" />
            <el-option label="DE" value="DE" />
            <el-option label="US" value="US" />
          </el-select>
          <el-button type="primary" @click="openDengSellerEditor()">新增非标店铺</el-button>
          <el-button @click="loadDengSellers">刷新名单</el-button>
          <div class="spacer" />
          <el-button
            type="warning"
            :disabled="dengSelectedRows.length === 0"
            :loading="dengSubmitting"
            @click="submitDengSync(dengSelectedRows)"
          >批量请求所选店铺</el-button>
        </div>
        <el-alert
          title="非标店铺专用请求线路"
          description="这里登记的店铺就是“非标店铺上新”的来源名单。任务固定为 DENG_ZONG_SHOP_SYNC，历史完成后可再次抓取；活跃任务不会并发重复。不会进入正常候选池、观察池或精品店铺池。"
          type="warning"
          :closable="false"
          show-icon
          class="deng-alert"
        />
        <el-table
          :data="dengSellers"
          v-loading="dengLoading"
          stripe
          height="calc(100vh - 285px)"
          @selection-change="dengSelectedRows = $event"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column prop="marketplace" label="站点" width="80" />
          <el-table-column prop="sellerName" label="卖家名称" min-width="210" />
          <el-table-column label="店铺链接" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <a v-if="row.storeUrl" :href="row.storeUrl" target="_blank" rel="noopener">打开</a>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column prop="lastSyncedAt" label="最近抓取完成" width="180">
            <template #default="{ row }">{{ row.lastSyncedAt || '尚未抓取' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button type="warning" link :loading="dengSubmitting" @click="submitDengSync([row])">请求抓取</el-button>
              <el-button type="primary" link @click="openDengSellerEditor(row)">编辑</el-button>
              <el-button type="danger" link @click="deleteDengSeller(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-dialog v-model="dengEditorVisible" :title="dengEditor.id ? '编辑非标店铺' : '新增非标店铺'" width="480px">
        <el-form label-width="90px">
          <el-form-item label="站点" required>
            <el-select v-model="dengEditor.marketplace" style="width: 100%">
              <el-option label="UK" value="UK" />
              <el-option label="DE" value="DE" />
              <el-option label="US" value="US" />
            </el-select>
          </el-form-item>
          <el-form-item label="卖家名称" required><el-input v-model="dengEditor.sellerName" /></el-form-item>
          <el-form-item label="店铺链接"><el-input v-model="dengEditor.storeUrl" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="dengEditor.notes" type="textarea" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dengEditorVisible = false">取消</el-button>
          <el-button type="primary" :loading="dengSaving" @click="saveDengSeller">保存</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, ElTable } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { shopCandidateApi, type ShopCandidatePool, type ShopMethodBatchOption } from '@/api/shopCandidate'
import { formatShopBatchLabel } from '@/utils/batchLabel'
import { requestCenterApi, shopPremiumApi } from '@/api/shopPremium'
import { dengZongShopApi, type DengZongShopSeller } from '@/api/dengZongShop'

const router = useRouter()
const route = useRoute()
const requestMode = ref<'NORMAL' | 'DENG_ZONG'>(route.query.mode === 'deng-zong' ? 'DENG_ZONG' : 'NORMAL')
const dengMarketplace = ref('')
const dengSellers = ref<DengZongShopSeller[]>([])
const dengSelectedRows = ref<DengZongShopSeller[]>([])
const dengLoading = ref(false)
const dengSubmitting = ref(false)
const dengSaving = ref(false)
const dengEditorVisible = ref(false)
const dengEditor = ref({ id: 0, marketplace: 'UK', sellerName: '', storeUrl: '', notes: '' })

async function loadDengSellers() {
  dengLoading.value = true
  try {
    dengSellers.value = await dengZongShopApi.listSellers(dengMarketplace.value || undefined)
  } catch (error: any) {
    ElMessage.error(error?.message || '加载非标店铺名单失败')
  } finally {
    dengLoading.value = false
  }
}

function openDengSellerEditor(row?: DengZongShopSeller) {
  dengEditor.value = row
    ? { id: row.id, marketplace: row.marketplace, sellerName: row.sellerName, storeUrl: row.storeUrl || '', notes: row.notes || '' }
    : { id: 0, marketplace: dengMarketplace.value || 'UK', sellerName: '', storeUrl: '', notes: '' }
  dengEditorVisible.value = true
}

async function saveDengSeller() {
  const form = dengEditor.value
  if (!form.marketplace || !form.sellerName.trim()) {
    ElMessage.warning('站点和卖家名称不能为空')
    return
  }
  dengSaving.value = true
  try {
    const data = { ...form, sellerName: form.sellerName.trim(), storeUrl: form.storeUrl.trim(), notes: form.notes.trim() }
    if (form.id) await dengZongShopApi.updateSeller(form.id, data)
    else await dengZongShopApi.createSeller(data)
    dengEditorVisible.value = false
    ElMessage.success(form.id ? '非标店铺已更新' : '非标店铺已登记')
    await loadDengSellers()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存非标店铺失败')
  } finally {
    dengSaving.value = false
  }
}

async function deleteDengSeller(row: DengZongShopSeller) {
  try {
    await ElMessageBox.confirm(`确认从非标店铺名单删除「${row.sellerName}」？已抓取商品不会随之删除。`, '删除非标店铺', { type: 'warning' })
    await dengZongShopApi.deleteSeller(row.id)
    ElMessage.success('已从名单删除')
    await loadDengSellers()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

async function submitDengSync(rows: DengZongShopSeller[]) {
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(
      `确认请求 ${rows.length} 家非标店铺？将消耗卖家精灵次数，结果只写入 deng_zong_shop。`,
      '创建非标店铺抓取任务',
      { type: 'warning', confirmButtonText: '确认创建' }
    )
    dengSubmitting.value = true
    const result = await dengZongShopApi.createSyncTask(rows.map(row => row.id))
    const skipped = result.skippedCount ? `，跳过活跃任务 ${result.skippedCount} 家` : ''
    ElMessage.success(`已创建任务，入队 ${result.queuedCount} 家${skipped}`)
    await router.push({ name: 'module-sellersprite-request-center-SellerspriteRequestCenter', query: { runId: result.runId } })
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '创建非标店铺任务失败')
  } finally {
    dengSubmitting.value = false
  }
}
const FILTER_STORAGE_KEY = 'shop-request-center:filters:v1'
type RequestState = 'UNREQUESTED' | 'REQUESTED'
interface StoredFilters {
  marketplace?: string
  batchCode?: string
  batchByMarketplace?: Record<string, string>
  sourceTypeFilter?: string
  methodId?: string
  minCount?: number
  statusFilter?: string
  requestState?: RequestState
  size?: number
}

const storedFilters = readStoredFilters()
const marketplace = ref(storedFilters.marketplace || '')
const batchCode = ref(storedFilters.batchCode || '')
const batchByMarketplace = ref<Record<string, string>>(storedFilters.batchByMarketplace || {})
const sourceTypeFilter = ref(storedFilters.sourceTypeFilter ?? 'METHOD_CARD')
const methodId = ref(storedFilters.methodId || 'M01')
const minCount = ref(storedFilters.minCount || 1)
const statusFilter = ref(storedFilters.statusFilter || '')
const requestState = ref<RequestState>(storedFilters.requestState || 'UNREQUESTED')
const rows = ref<ShopCandidatePool[]>([])
const batchOptions = ref<ShopMethodBatchOption[]>([])
const loading = ref(false)
const batchLoading = ref(false)
const syncing = ref(false)
const syncingAll = ref(false)
const batchFetching = ref(false)
const allSelecting = ref(false)
const selectedRows = ref<ShopCandidatePool[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
const syncingTableSelection = ref(false)

const page = ref(1)
const size = ref(storedFilters.size || 50)
const total = ref(0)
const fetchableSelectedCount = computed(() => selectedRows.value.filter(canFetchCandidate).length)
const selectedBatchOption = computed(() => batchOptions.value.find((item) => item.batchCode === batchCode.value))
const selectedBatchDateLabel = computed(() => {
  const selected = selectedBatchOption.value
  return displayBatchDate(
    selected?.batchCode || batchCode.value,
    selected?.latestCreatedAt
  )
})
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
  if (sourceTypeFilter.value === 'BATCH_ALL') return '当前批次全部店铺'
  if (sourceTypeFilter.value === 'MANUAL') return '人工加入店铺'
  if (sourceTypeFilter.value === 'BASELINE') return '基线来源店铺'
  return '全部店铺候选'
})

async function loadMethodBatches(preferLatest = false) {
  batchLoading.value = true
  try {
    const list = await shopCandidateApi.sourceBatches({
      marketplace: marketplace.value || undefined,
      limit: 50
    })
    batchOptions.value = list || []
    const rememberedBatch = batchByMarketplace.value[marketplaceStorageKey()]
    const preferredBatch = preferLatest ? '' : (rememberedBatch || batchCode.value)
    batchCode.value = preferredBatch && batchOptions.value.some((item) => item.batchCode === preferredBatch)
      ? preferredBatch
      : (batchOptions.value[0]?.batchCode || '')
    rememberCurrentBatch()
    persistFilters()
  } catch (e: any) {
    batchOptions.value = []
    ElMessage.error(e?.message || '加载找店来源批次失败')
  } finally {
    batchLoading.value = false
  }
}

async function loadList() {
  persistFilters()
  loading.value = true
  try {
    const r = await shopCandidateApi.list({
      marketplace: marketplace.value || undefined,
      batchCode: batchCode.value || undefined,
      sourceType: sourceTypeFilter.value || undefined,
      sourceCode: sourceTypeFilter.value === 'METHOD_CARD' ? methodId.value : undefined,
      status: statusFilter.value || undefined,
      minHitCount: sourceTypeFilter.value === 'METHOD_CARD' ? minCount.value : undefined,
      requestState: requestState.value,
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
    ElMessage.success(`${r.methodId} 通过店铺 ${r.rankedShops} 家，写入候选池 ${r.upserted} 家（${displayBatchDate(r.batchCode)}）`)
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

async function handleSyncAllFromBatch() {
  sourceTypeFilter.value = 'BATCH_ALL'
  if (!batchCode.value) {
    await loadMethodBatches(true)
  }
  if (!batchCode.value) {
    ElMessage.warning('没有可用的来源周批次')
    return
  }
  syncingAll.value = true
  try {
    const r = await shopCandidateApi.syncAllFromBatch(
      marketplace.value || undefined,
      batchCode.value
    )
    ElMessage.success(`批次全部店铺 ${r.rankedShops} 家，写入候选池 ${r.upserted} 家（${displayBatchDate(r.batchCode)}）`)
    page.value = 1
    clearSelection()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步批次全部店铺失败')
  } finally {
    syncingAll.value = false
  }
}

async function handleMarketplaceChange() {
  page.value = 1
  clearSelection()
  await loadMethodBatches(false)
  await loadList()
}

async function handleMethodChange() {
  sourceTypeFilter.value = 'METHOD_CARD'
  page.value = 1
  clearSelection()
  await loadMethodBatches(false)
  await loadList()
}

function handleBatchChange() {
  rememberCurrentBatch()
  page.value = 1
  clearSelection()
  loadList()
}

function handleFilterChange() {
  page.value = 1
  clearSelection()
  loadList()
}

function handleRequestStateChange() {
  page.value = 1
  clearSelection()
  loadList()
}

function canFetchCandidate(row: ShopCandidatePool): boolean {
  return !row.requested && ['PENDING', 'SELECTED', 'FETCH_FAILED'].includes(row.status)
}

function isRowSelectable(row: ShopCandidatePool): boolean {
  return canFetchCandidate(row)
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
    ElMessage.success(`请求中心任务已创建：${task.runId}${task.skippedCount > 0 ? `，已跳过重复店铺 ${task.skippedCount} 家` : ''}`)
    await loadList()
    goToRequestCenter(task.runId)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建任务失败')
  }
}

async function handleBatchFetch() {
  if (selectedRows.value.length === 0) return
  const fetchable = selectedRows.value.filter(canFetchCandidate)
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
    ElMessage.success(`请求中心任务已创建：${task.runId}，入队 ${task.queuedCount} 家${task.skippedCount > 0 ? `，跳过重复 ${task.skippedCount} 家` : ''}`)
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
  return requestCenterApi.createShopTaskOnce({
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
  rows.value.filter(canFetchCandidate).forEach((row) => {
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
      requestState: requestState.value,
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
  // 统一收口到 utils/batchLabel：按天分组下拉显示 `7/22 · 1691店 / 2190品`。
  return formatShopBatchLabel({
    value: item.batchCode,
    sellerCount: item.sellerCount,
    productCount: item.productCount,
  })
}

function displayBatchDate(batchCode?: string | null, fallbackDate?: string | null) {
  const code = String(batchCode || '').trim()
  const isoWeek = code.match(/^(\d{4})-W(\d{2})$/)
  if (isoWeek) {
    const year = Number(isoWeek[1])
    const week = Number(isoWeek[2])
    if (week >= 1 && week <= 53) {
      const januaryFourth = new Date(Date.UTC(year, 0, 4))
      const januaryFourthWeekday = januaryFourth.getUTCDay() || 7
      const weekStart = new Date(
        Date.UTC(year, 0, 4 - januaryFourthWeekday + 1 + (week - 1) * 7)
      )
      return formatCalendarDate(weekStart)
    }
  }

  const fallback = formatCalendarDate(fallbackDate)
  if (fallback) return fallback

  const monthBatch = code.match(/^(\d{4})(\d{2})-W\d{2}$/)
  if (monthBatch) return `${monthBatch[1]}年${Number(monthBatch[2])}月`
  return code || '-'
}

function formatCalendarDate(value?: string | Date | null) {
  if (!value) return ''
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}年${value.getUTCMonth() + 1}月${value.getUTCDate()}日`
  }

  const dateText = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateText) {
    return `${dateText[1]}年${Number(dateText[2])}月${Number(dateText[3])}日`
  }
  return ''
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
    METHOD_CARD: '方法卡', BATCH_ALL: '批次全量', BASELINE: '基线', MANUAL: '人工', OWN_GOOD_SIMILAR: '自有相似', CATEGORY: '类目'
  }
  return map[t] || t
}
function reasonText(row: ShopCandidatePool) {
  if (row.reason) return row.reason
  if (row.sourceType === 'METHOD_CARD') {
    return `${row.sourceCode || '方法卡'} 命中 ${row.hitCount ?? '-'} 个合格新品${row.topCategory ? `，主打 ${row.topCategory}` : ''}`
  }
  if (row.sourceType === 'BATCH_ALL') {
    return `批次全量收录 ${row.hitCount ?? '-'} 个商品${row.topCategory ? `，主打 ${row.topCategory}` : ''}`
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

function marketplaceStorageKey() {
  return marketplace.value || '__ALL__'
}

function rememberCurrentBatch() {
  if (batchCode.value) {
    batchByMarketplace.value[marketplaceStorageKey()] = batchCode.value
  } else {
    delete batchByMarketplace.value[marketplaceStorageKey()]
  }
}

function persistFilters() {
  const filters: StoredFilters = {
    marketplace: marketplace.value,
    batchCode: batchCode.value,
    batchByMarketplace: batchByMarketplace.value,
    sourceTypeFilter: sourceTypeFilter.value,
    methodId: methodId.value,
    minCount: minCount.value,
    statusFilter: statusFilter.value,
    requestState: requestState.value,
    size: size.value
  }
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
}

function readStoredFilters(): StoredFilters {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || '{}') as StoredFilters
  } catch {
    localStorage.removeItem(FILTER_STORAGE_KEY)
    return {}
  }
}

onMounted(async () => {
  if (requestMode.value === 'DENG_ZONG') {
    await loadDengSellers()
    return
  }
  await loadMethodBatches(false)
  await loadList()
})

watch(requestMode, async mode => {
  await router.replace({ query: mode === 'DENG_ZONG' ? { ...route.query, mode: 'deng-zong' } : {} })
  if (mode === 'DENG_ZONG') await loadDengSellers()
})
</script>

<style scoped lang="scss">
.shop-candidate-pool {
  padding: 16px;
}
.header-card {
  margin-bottom: 12px;
}
.mode-card {
  margin-bottom: 12px;
}
.mode-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.mode-description {
  color: #606266;
  font-size: 13px;
}
.deng-zong-card .deng-alert {
  margin: 12px 0;
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
