<template>
  <div class="shop-premium-pool">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="marketplace" placeholder="站点" style="width: 120px" @change="loadList">
          <el-option label="全部站点" value="" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
          <el-option label="US" value="US" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="池状态" clearable style="width: 130px" @change="loadList">
          <el-option label="活跃 ACTIVE" value="ACTIVE" />
          <el-option label="暂停 PAUSED" value="PAUSED" />
          <el-option label="已移除 REMOVED" value="REMOVED" />
        </el-select>
        <el-select v-model="qualityFilter" placeholder="质量等级" clearable style="width: 130px" @change="loadList">
          <el-option label="HIGH" value="HIGH" />
          <el-option label="MID" value="MID" />
          <el-option label="LOW" value="LOW" />
        </el-select>
        <el-select v-model="freqFilter" placeholder="复抓频率" clearable style="width: 130px" @change="loadList">
          <el-option label="每周 WEEKLY" value="WEEKLY" />
          <el-option label="每月 MONTHLY" value="MONTHLY" />
          <el-option label="手动 MANUAL" value="MANUAL" />
        </el-select>
        <el-input v-model="sellerName" placeholder="店铺名筛选" clearable style="width: 180px" @keyup.enter="loadList" />
        <el-button type="primary" @click="loadList">查询</el-button>
        <div class="spacer" />
        <el-button @click="openAddManual">人工加入精品池</el-button>
      </div>
      <div class="tip">
        精品池 = 长期复用、周期复抓的优质店铺。status 表示是否属于精品池；refreshStatus 表示复抓任务状态，两者不混用。
        复抓走请求中心：先 dry-run 预览（不消耗使用次数），确认后创建任务，再轮询 consume 推进。
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 320px)" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" :selectable="canSelect" />
        <el-table-column prop="marketplace" label="站点" width="70" />
        <el-table-column prop="sellerName" label="店铺名" min-width="170" show-overflow-tooltip />
        <el-table-column label="质量" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="qualityType(row.qualityLevel)">{{ row.qualityLevel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <el-tag v-for="t in parseTags(row.tagsJson)" :key="t" size="small" effect="plain" style="margin-right: 4px">{{ t }}</el-tag>
            <span v-if="!parseTags(row.tagsJson).length">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="refreshFrequency" label="复抓频率" width="100" />
        <el-table-column label="最近抓取" width="110">
          <template #default="{ row }">{{ row.lastFetchDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="下次建议" width="110">
          <template #default="{ row }">{{ row.nextFetchDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="复抓状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="refreshStatusType(row.refreshStatus)">{{ refreshStatusLabel(row.refreshStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="池状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="入池原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openShop(row)">看画像</el-button>
            <el-button size="small" link @click="openEdit(row)">编辑</el-button>
            <el-dropdown @command="(c: string) => handleStatus(row, c)" trigger="click">
              <el-button size="small" link>状态<el-icon><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="ACTIVE" :disabled="row.status === 'ACTIVE'">设为活跃</el-dropdown-item>
                  <el-dropdown-item command="PAUSED" :disabled="row.status === 'PAUSED'">暂停</el-dropdown-item>
                  <el-dropdown-item command="REMOVED" :disabled="row.status === 'REMOVED'">移除(软删)</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" type="danger" link @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="footer-bar" v-if="selectedRows.length > 0">
        <span>已选 {{ selectedRows.length }} 家（仅 ACTIVE 可复抓）</span>
        <el-button size="small" @click="handleDryRun" :loading="dryRunLoading">dry-run 复抓预览</el-button>
        <el-button type="primary" size="small" @click="handleCreateRefreshTask" :loading="creatingTask">创建复抓任务</el-button>
        <el-button size="small" @click="goToRequestCenter">看请求中心</el-button>
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

    <!-- 人工加入对话框 -->
    <el-dialog v-model="addDialogVisible" title="人工加入精品池" width="520px">
      <el-form :model="addForm" label-width="120px" size="small">
        <el-form-item label="站点" required>
          <el-select v-model="addForm.marketplace" style="width: 100%">
            <el-option label="UK" value="UK" />
            <el-option label="DE" value="DE" />
            <el-option label="US" value="US" />
          </el-select>
        </el-form-item>
        <el-form-item label="店铺名" required>
          <el-input v-model="addForm.sellerName" placeholder="店铺名" />
        </el-form-item>
        <el-form-item label="入池原因">
          <el-input v-model="addForm.reason" placeholder="如：人工判断为优质精铺店" />
        </el-form-item>
        <el-form-item label="标签(JSON)">
          <el-input v-model="addForm.tagsJson" placeholder='如：["精铺","上新快"]' />
        </el-form-item>
        <el-form-item label="质量等级">
          <el-select v-model="addForm.qualityLevel" style="width: 100%">
            <el-option label="HIGH" value="HIGH" />
            <el-option label="MID" value="MID" />
            <el-option label="LOW" value="LOW" />
          </el-select>
        </el-form-item>
        <el-form-item label="复抓频率">
          <el-select v-model="addForm.refreshFrequency" style="width: 100%">
            <el-option label="每周 WEEKLY" value="WEEKLY" />
            <el-option label="每月 MONTHLY" value="MONTHLY" />
            <el-option label="手动 MANUAL" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="强制加入">
          <el-switch v-model="addForm.forceCreateImmediately" />
          <span class="hint"> 该店无成功快照时，强制加入精品池（后续需手动发起复抓）</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="addForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAddManual" :loading="adding">加入</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑精品店" width="520px">
      <el-form :model="editForm" label-width="120px" size="small">
        <el-form-item label="标签(JSON)">
          <el-input v-model="editForm.tagsJson" placeholder='如：["精铺","上新快"]' />
        </el-form-item>
        <el-form-item label="质量等级">
          <el-select v-model="editForm.qualityLevel" style="width: 100%">
            <el-option label="HIGH" value="HIGH" />
            <el-option label="MID" value="MID" />
            <el-option label="LOW" value="LOW" />
          </el-select>
        </el-form-item>
        <el-form-item label="复抓频率">
          <el-select v-model="editForm.refreshFrequency" style="width: 100%">
            <el-option label="每周 WEEKLY" value="WEEKLY" />
            <el-option label="每月 MONTHLY" value="MONTHLY" />
            <el-option label="手动 MANUAL" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="入池原因">
          <el-input v-model="editForm.reason" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit" :loading="editing">保存</el-button>
      </template>
    </el-dialog>

    <!-- dry-run 预览对话框 -->
    <el-dialog v-model="dryRunDialogVisible" title="复抓 dry-run 预览" width="720px">
      <div v-if="dryRunResult" v-loading="dryRunLoading">
        <el-alert :title="dryRunResult.note" type="info" :closable="false" style="margin-bottom: 12px" />
        <el-descriptions :column="4" border size="small" style="margin-bottom: 12px">
          <el-descriptions-item label="请求数">{{ dryRunResult.totalRequested }}</el-descriptions-item>
          <el-descriptions-item label="将复抓">{{ dryRunResult.toRefreshCount }}</el-descriptions-item>
          <el-descriptions-item label="跳过">{{ dryRunResult.skippedCount }}</el-descriptions-item>
          <el-descriptions-item label="预计使用次数(下限)">{{ dryRunResult.estimatedApiCallsLowerBound }}</el-descriptions-item>
        </el-descriptions>
        <div class="section-title">将复抓</div>
        <el-table :data="dryRunResult.toRefresh" size="small" border max-height="200">
          <el-table-column prop="marketplace" label="站点" width="70" />
          <el-table-column prop="sellerName" label="店铺名" min-width="160" show-overflow-tooltip />
          <el-table-column prop="refreshStatus" label="复抓状态" width="100" />
          <el-table-column prop="nextFetchDate" label="下次建议" width="110" />
        </el-table>
        <div class="section-title">跳过</div>
        <el-table :data="dryRunResult.skipped" size="small" border max-height="200">
          <el-table-column prop="marketplace" label="站点" width="70" />
          <el-table-column prop="sellerName" label="店铺名" min-width="140" show-overflow-tooltip />
          <el-table-column prop="status" label="池状态" width="90" />
          <el-table-column prop="reason" label="跳过原因" min-width="200" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="dryRunDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="confirmCreateTask" :loading="creatingTask"
                   :disabled="!dryRunResult || dryRunResult.toRefreshCount === 0">确认创建复抓任务</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  shopPremiumApi,
  type ShopPremiumPool,
  type RefreshDryRunResult,
  type CreateRefreshTaskResult
} from '@/api/shopPremium'

const router = useRouter()
const marketplace = ref('')
const statusFilter = ref('')
const qualityFilter = ref('')
const freqFilter = ref('')
const sellerName = ref('')
const rows = ref<ShopPremiumPool[]>([])
const loading = ref(false)
const selectedRows = ref<ShopPremiumPool[]>([])
const page = ref(1)
const size = ref(50)
const total = ref(0)

// 对话框
const addDialogVisible = ref(false)
const adding = ref(false)
const addForm = ref({
  marketplace: 'UK', sellerName: '', reason: '', tagsJson: '["精铺"]',
  qualityLevel: 'MID', refreshFrequency: 'MONTHLY', note: '', forceCreateImmediately: false
})
const editDialogVisible = ref(false)
const editing = ref(false)
const editForm = ref<{ id: number; tagsJson: string; qualityLevel: string; refreshFrequency: string; reason: string; note: string }>({
  id: 0, tagsJson: '', qualityLevel: 'MID', refreshFrequency: 'MONTHLY', reason: '', note: ''
})

// dry-run
const dryRunDialogVisible = ref(false)
const dryRunLoading = ref(false)
const dryRunResult = ref<RefreshDryRunResult | null>(null)
const creatingTask = ref(false)

async function loadList() {
  loading.value = true
  try {
    const r = await shopPremiumApi.list({
      marketplace: marketplace.value || undefined,
      status: statusFilter.value || undefined,
      qualityLevel: qualityFilter.value || undefined,
      refreshFrequency: freqFilter.value || undefined,
      sellerName: sellerName.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = r.list || []
    total.value = r.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载精品池失败')
  } finally {
    loading.value = false
  }
}

function canSelect(row: ShopPremiumPool) {
  return row.status === 'ACTIVE' && (row.refreshStatus === 'IDLE' || row.refreshStatus === 'FAILED')
}

function onSelectionChange(sel: ShopPremiumPool[]) {
  selectedRows.value = sel
}

function openAddManual() {
  addDialogVisible.value = true
}

async function submitAddManual() {
  if (!addForm.value.sellerName) {
    ElMessage.warning('请填店铺名')
    return
  }
  adding.value = true
  try {
    await shopPremiumApi.addManual(addForm.value)
    ElMessage.success('已加入精品池')
    addDialogVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '加入失败')
  } finally {
    adding.value = false
  }
}

function openEdit(row: ShopPremiumPool) {
  editForm.value = {
    id: row.id,
    tagsJson: row.tagsJson || '',
    qualityLevel: row.qualityLevel || 'MID',
    refreshFrequency: row.refreshFrequency || 'MONTHLY',
    reason: row.reason || '',
    note: row.note || ''
  }
  editDialogVisible.value = true
}

async function submitEdit() {
  editing.value = true
  try {
    await shopPremiumApi.update(editForm.value.id, {
      tagsJson: editForm.value.tagsJson || undefined,
      qualityLevel: editForm.value.qualityLevel,
      refreshFrequency: editForm.value.refreshFrequency,
      reason: editForm.value.reason || undefined,
      note: editForm.value.note || undefined
    })
    ElMessage.success('已保存')
    editDialogVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    editing.value = false
  }
}

async function handleStatus(row: ShopPremiumPool, status: string) {
  try {
    await shopPremiumApi.updateStatus(row.id, status)
    ElMessage.success('状态已更新')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function handleRemove(row: ShopPremiumPool) {
  try {
    await ElMessageBox.confirm(`确认软删除「${row.sellerName}」？同店再加入时会恢复原行而非新建。`, '移除', { type: 'warning' })
  } catch { return }
  try {
    await shopPremiumApi.remove(row.id)
    ElMessage.success('已移除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '移除失败')
  }
}

async function handleDryRun() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要复抓的精品店')
    return
  }
  dryRunLoading.value = true
  dryRunDialogVisible.value = true
  try {
    dryRunResult.value = await shopPremiumApi.refreshDryRun(selectedRows.value.map((r) => r.id))
  } catch (e: any) {
    ElMessage.error(e?.message || 'dry-run 失败')
  } finally {
    dryRunLoading.value = false
  }
}

async function confirmCreateTask() {
  if (!dryRunResult.value || dryRunResult.value.toRefreshCount === 0) return
  try {
    await ElMessageBox.confirm(
      `将创建复抓任务，复抓 ${dryRunResult.value.toRefreshCount} 家店，预计至少消耗 ${dryRunResult.value.estimatedApiCallsLowerBound} 次使用次数。任务创建后需在请求中心轮询 consume 推进。确认？`,
      '创建复抓任务',
      { type: 'warning', confirmButtonText: '创建任务', cancelButtonText: '取消' }
    )
  } catch { return }
  creatingTask.value = true
  try {
    const r: CreateRefreshTaskResult = await shopPremiumApi.createRefreshTask(selectedRows.value.map((row) => row.id))
    ElMessage.success(`复抓任务已创建：runId=${r.runId}，共 ${r.totalCount} 条。跳转请求中心推进`)
    dryRunDialogVisible.value = false
    await loadList()
    goToRequestCenter(r.runId)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建任务失败')
  } finally {
    creatingTask.value = false
  }
}

function goToRequestCenter(runId?: string) {
  router.push({
    name: 'module-sellersprite-request-center-SellerspriteRequestCenter',
    ...(runId ? { query: { runId } } : {})
  })
}

function openShop(row: ShopPremiumPool) {
  router.push({
    name: 'module-shop-collection-shops-ShopCollectionShops',
    query: { marketplace: row.marketplace, sellerName: row.sellerName }
  })
}

function parseTags(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch { return [] }
}

function statusLabel(s: string) {
  return ({ ACTIVE: '活跃', PAUSED: '暂停', REMOVED: '已移除' } as Record<string, string>)[s] || s
}
function statusType(s: string): 'success' | 'warning' | 'info' {
  return ({ ACTIVE: 'success', PAUSED: 'warning', REMOVED: 'info' } as Record<string, 'success' | 'warning' | 'info'>)[s] || 'info'
}
function refreshStatusLabel(s: string) {
  return ({ IDLE: '空闲', RUNNING: '复抓中', FAILED: '失败' } as Record<string, string>)[s] || s
}
function refreshStatusType(s: string): 'success' | 'primary' | 'danger' | 'info' {
  return ({ IDLE: 'info', RUNNING: 'primary', FAILED: 'danger' } as Record<string, 'success' | 'primary' | 'danger' | 'info'>)[s] || 'info'
}
function qualityType(q: string): 'success' | 'warning' | 'info' {
  return ({ HIGH: 'success', MID: 'warning', LOW: 'info' } as Record<string, 'success' | 'warning' | 'info'>)[q] || 'info'
}

onMounted(loadList)
</script>

<style scoped lang="scss">
.shop-premium-pool {
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
.section-title {
  font-weight: 600;
  margin: 12px 0 8px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
