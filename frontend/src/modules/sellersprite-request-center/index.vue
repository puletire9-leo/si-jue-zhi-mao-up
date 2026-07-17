<template>
  <div class="request-center">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-date-picker
          v-model="monthFilter"
          type="month"
          value-format="YYYY-MM"
          format="YYYY年MM月"
          placeholder="创建月份"
          clearable
          style="width: 150px"
          @change="handleFilterChange"
        />
        <el-select v-model="requestTypeFilter" placeholder="任务类型" clearable style="width: 180px" @change="handleFilterChange">
          <el-option label="店铺全集查询" value="SHOP_FULL_LOOKUP" />
          <el-option label="ASIN 批量查询" value="ASIN_BATCH_LOOKUP" />
          <el-option label="手动 ASIN 查询" value="MANUAL_ASIN_LOOKUP" />
          <el-option label="卖家名批量" value="SELLER_BATCH_LOOKUP" />
          <el-option label="邓总店铺同步" value="DENG_ZONG_SHOP_SYNC" />
          <el-option label="ASIN 查询（旧）" value="ASIN_LOOKUP" />
          <el-option label="候选批量抓取" value="CANDIDATE_BATCH" />
          <el-option label="精品池复抓" value="PREMIUM_REFRESH" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="handleFilterChange">
          <el-option label="待处理 PENDING" value="PENDING" />
          <el-option label="运行中 RUNNING" value="RUNNING" />
          <el-option label="已暂停 PAUSED" value="PAUSED" />
          <el-option label="系统暂停" value="PAUSED_SYSTEM" />
          <el-option label="已停止 STOPPED" value="STOPPED" />
          <el-option label="成功 SUCCESS" value="SUCCESS" />
          <el-option label="部分成功" value="PARTIAL_SUCCESS" />
          <el-option label="失败 FAILED" value="FAILED" />
        </el-select>
        <el-button type="primary" @click="loadTasks">刷新</el-button>
        <el-tag v-if="health?.circuitOpen" type="danger">卖家精灵熔断中：{{ health?.resumeAt || '待人工确认' }}</el-tag>
        <div class="usage-summary">
          <span>{{ usageSummaryLabel }}</span>
          <strong>{{ monthlyUsage.totalApiCalls.toLocaleString() }}</strong>
          <span>次</span>
          <span class="usage-summary__tasks">{{ monthlyUsage.taskCount }} 个任务</span>
        </div>
        <div class="spacer" />
        <span class="tip">任务创建后自动按卖家精灵限制执行；当前店铺请求完成后响应暂停/停止；页面每 3 秒刷新进度和使用次数</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 280px)" @row-click="openDetail">
        <el-table-column prop="runId" label="runId" width="180" show-overflow-tooltip />
        <el-table-column prop="requestType" label="类型" width="150" />
        <el-table-column prop="triggerType" label="触发" width="150" />
        <el-table-column prop="marketplace" label="站点" width="80" />
        <el-table-column prop="batchCode" label="周批次" width="110" />
        <el-table-column label="进度" min-width="220">
          <template #default="{ row }">
            <span>总{{ row.totalCount }} 待{{ row.pendingCount }} 成{{ row.successCount }} 败{{ row.failedCount }} 跳{{ row.skippedCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="apiCalls" label="使用次数" width="100" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="handleStart(row)"
                       :disabled="!canStart(row.status)">唤醒自动</el-button>
            <el-button size="small" link @click.stop="handlePause(row)" :disabled="row.status !== 'RUNNING'">暂停</el-button>
            <el-button size="small" link @click.stop="handleResume(row)" :disabled="!canResume(row.status)">恢复</el-button>
            <el-button size="small" type="danger" link @click.stop="handleStop(row)"
                       :disabled="!canStop(row.status)">停止</el-button>
            <el-button size="small" link @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        small
        style="margin-top: 10px; justify-content: flex-end"
        @current-change="loadTasks"
        @size-change="loadTasks"
      />
    </el-card>

    <el-drawer v-model="drawerVisible" :title="detailTitle" size="60%" destroy-on-close>
      <div v-loading="detailLoading">
        <template v-if="currentRun">
          <el-descriptions :column="3" border size="small" title="任务概览">
            <el-descriptions-item label="runId">{{ currentRun.runId }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ currentRun.requestType }}</el-descriptions-item>
            <el-descriptions-item label="触发">{{ currentRun.triggerType }}</el-descriptions-item>
            <el-descriptions-item label="站点">{{ currentRun.marketplace || '-' }}</el-descriptions-item>
            <el-descriptions-item label="周批次">{{ currentRun.batchCode || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusType(currentRun.status)">{{ statusLabel(currentRun.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="总数">{{ currentRun.totalCount }}</el-descriptions-item>
            <el-descriptions-item label="待处理">{{ currentRun.pendingCount }}</el-descriptions-item>
            <el-descriptions-item label="成功">{{ currentRun.successCount }}</el-descriptions-item>
            <el-descriptions-item label="失败">{{ currentRun.failedCount }}</el-descriptions-item>
            <el-descriptions-item label="跳过">{{ currentRun.skippedCount }}</el-descriptions-item>
            <el-descriptions-item label="使用次数">{{ currentRun.apiCalls }}</el-descriptions-item>
            <el-descriptions-item label="开始">{{ currentRun.startedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="结束">{{ currentRun.finishedAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="原因" :span="3">{{ currentRun.fetchReason || '-' }}</el-descriptions-item>
            <el-descriptions-item v-if="currentRun.systemPauseReason" label="系统暂停" :span="3">{{ currentRun.systemPauseReason }} {{ currentRun.systemResumeAt ? `（预计恢复 ${currentRun.systemResumeAt}）` : '' }}</el-descriptions-item>
            <el-descriptions-item label="错误" :span="3" v-if="currentRun.lastErrorMessage">{{ currentRun.lastErrorMessage }}</el-descriptions-item>
          </el-descriptions>

          <div class="section-title">子项明细</div>
          <el-table :data="items" size="small" border max-height="420">
            <el-table-column prop="seq" label="#" width="50" />
            <el-table-column prop="marketplace" label="站点" width="70" />
            <el-table-column label="店铺名/批次" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <template v-if="isAsinType(currentRun?.requestType)">
                  批次 #{{ (row as SellerspriteRequestItem).seq + 1 }}
                  <span class="muted">({{ asinCount(row) }} ASIN)</span>
                </template>
                <span v-else>{{ (row as SellerspriteRequestItem).sellerName || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="itemStatusType(row.status)">{{ itemStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="total" label="总数" width="70" />
            <el-table-column prop="writtenCount" label="写入" width="70" />
            <el-table-column prop="apiCalls" label="使用次数" width="90" />
            <el-table-column prop="attemptCount" label="尝试" width="70" />
            <el-table-column prop="nextRetryAt" label="下次重试" width="160" />
            <el-table-column prop="errorCode" label="错误码" width="120" />
            <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click.stop="handleRetryItem(row)"
                           :disabled="!['FAILED', 'WAITING_RETRY'].includes(row.status)">重试</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  requestCenterApi,
  type SellerspriteRequestRun,
  type SellerspriteRequestItem,
  type SellerspriteMonthlyUsageSummary
} from '@/api/shopPremium'

const route = useRoute()
const currentMonthValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const monthFilter = ref(currentMonthValue())
const requestTypeFilter = ref('')
const statusFilter = ref('')
const rows = ref<SellerspriteRequestRun[]>([])
const loading = ref(false)
const page = ref(1)
const size = ref(50)
const total = ref(0)

const drawerVisible = ref(false)
const currentRun = ref<SellerspriteRequestRun | null>(null)
const items = ref<SellerspriteRequestItem[]>([])
const detailLoading = ref(false)
const health = ref<Record<string, any> | null>(null)
const monthlyUsage = ref<SellerspriteMonthlyUsageSummary>({
  month: currentMonthValue(),
  taskCount: 0,
  totalApiCalls: 0
})
let refreshTimer: number | null = null

const detailTitle = computed(() => currentRun.value ? `任务 ${currentRun.value.runId}` : '任务详情')
const usageSummaryLabel = computed(() => {
  const [year, month] = monthlyUsage.value.month.split('-')
  return `${year}年${Number(month)}月总请求次数`
})

function handleFilterChange() {
  page.value = 1
  loadTasks()
}

async function loadTasks(silentFlag: unknown = false) {
  const silent = silentFlag === true
  if (!silent) loading.value = true
  try {
    const summaryMonth = monthFilter.value || currentMonthValue()
    const [r, summary, healthStatus] = await Promise.all([
      requestCenterApi.listTasks({
        month: monthFilter.value || undefined,
        requestType: requestTypeFilter.value || undefined,
        status: statusFilter.value || undefined,
        page: page.value,
        size: size.value
      }),
      requestCenterApi.monthlyUsageSummary(summaryMonth),
      requestCenterApi.health()
    ])
    rows.value = r.list || []
    total.value = r.total || 0
    monthlyUsage.value = summary
    health.value = healthStatus
  } catch (e: any) {
    if (!silent) ElMessage.error(e?.message || '加载任务失败')
  } finally {
    if (!silent) loading.value = false
  }
}

async function openDetail(row: SellerspriteRequestRun) {
  drawerVisible.value = true
  detailLoading.value = true
  try {
    currentRun.value = await requestCenterApi.getTask(row.runId)
    items.value = await requestCenterApi.listItems(row.runId)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function handleStart(row: SellerspriteRequestRun) {
  try {
    await requestCenterApi.startAutoConsume(row.runId)
    ElMessage.success('已唤醒自动执行')
    await loadTasks()
    if (drawerVisible.value && currentRun.value?.runId === row.runId) {
      currentRun.value = await requestCenterApi.getTask(row.runId)
      items.value = await requestCenterApi.listItems(row.runId)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '唤醒自动执行失败')
  }
}

async function handlePause(row: SellerspriteRequestRun) {
  try {
    await ElMessageBox.confirm('暂停将在当前已发出请求完成后生效，之后不再领取新子项。', '确认暂停', { type: 'warning' })
    await requestCenterApi.pause(row.runId); ElMessage.success('已暂停'); await loadTasks()
  }
  catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '暂停失败')
  }
}

async function handleResume(row: SellerspriteRequestRun) {
  try {
    await ElMessageBox.confirm('确认恢复此任务？', '确认恢复', { type: 'info' })
    await requestCenterApi.resume(row.runId); ElMessage.success('已恢复'); await loadTasks()
  }
  catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '恢复失败')
  }
}

async function handleStop(row: SellerspriteRequestRun) {
  try {
    await ElMessageBox.confirm('停止后未发起的子项将不会执行；当前已发出请求完成后结束。确认停止？', '确认停止', { type: 'error', confirmButtonText: '停止任务' })
    await requestCenterApi.stop(row.runId); ElMessage.success('已停止'); await loadTasks()
  }
  catch (e: any) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '停止失败')
  }
}

async function handleRetryItem(row: SellerspriteRequestItem) {
  try {
    await requestCenterApi.retryItem(row.id)
    ElMessage.success('子项已置回 PENDING，并自动继续执行')
    if (currentRun.value) {
      currentRun.value = await requestCenterApi.getTask(currentRun.value.runId)
      items.value = await requestCenterApi.listItems(currentRun.value.runId)
    }
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '重试失败')
  }
}

function canStart(status: string) {
  return ['PENDING', 'RUNNING'].includes(status)
}
function canResume(status: string) {
  return ['PAUSED', 'PAUSED_SYSTEM'].includes(status)
}
function canStop(status: string) {
  return ['RUNNING', 'PAUSED', 'PAUSED_SYSTEM', 'PENDING'].includes(status)
}

function statusLabel(s: string) {
  return ({
    PENDING: '待处理', RUNNING: '运行中', PAUSED: '已暂停', PAUSED_SYSTEM: '系统暂停', STOPPED: '已停止',
    SUCCESS: '成功', PARTIAL_SUCCESS: '部分成功', FAILED: '失败'
  } as Record<string, string>)[s] || s
}
function statusType(s: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return ({
    PENDING: 'info', RUNNING: 'primary', PAUSED: 'warning', PAUSED_SYSTEM: 'danger', STOPPED: 'info',
    SUCCESS: 'success', PARTIAL_SUCCESS: 'warning', FAILED: 'danger'
  } as Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'>)[s] || 'info'
}
function itemStatusLabel(s: string) {
  return ({ PENDING: '待处理', RUNNING: '处理中', WAITING_RETRY: '等待重试', SUCCESS: '成功', PARTIAL_SUCCESS: '部分成功', FAILED: '失败', SKIPPED: '跳过' } as Record<string, string>)[s] || s
}
function itemStatusType(s: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return ({
    PENDING: 'info', RUNNING: 'primary', WAITING_RETRY: 'warning', SUCCESS: 'success', PARTIAL_SUCCESS: 'warning',
    FAILED: 'danger', SKIPPED: 'info'
  } as Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'>)[s] || 'info'
}

/** ASIN 批量查询类型：子项以 asin_list 分批，展示"批次 #N (M ASIN)" */
const ASIN_TYPES = ['ASIN_BATCH_LOOKUP', 'MANUAL_ASIN_LOOKUP', 'ASIN_LOOKUP']
function isAsinType(requestType: string | null | undefined): boolean {
  return !!requestType && ASIN_TYPES.includes(requestType)
}

/** 从 asinList JSON 解析 ASIN 数量（ASIN 批量查询子项用） */
function asinCount(item: SellerspriteRequestItem): number {
  if (!item.asinList) return 0
  try {
    const arr = JSON.parse(item.asinList)
    return Array.isArray(arr) ? arr.length : 0
  } catch { return 0 }
}

function hasActiveTask() {
  return rows.value.some((r) => ['PENDING', 'RUNNING', 'PAUSED_SYSTEM'].includes(r.status))
}

async function refreshCurrentDetail() {
  if (!drawerVisible.value || !currentRun.value) return
  const runId = currentRun.value.runId
  currentRun.value = await requestCenterApi.getTask(runId)
  items.value = await requestCenterApi.listItems(runId)
}

onMounted(async () => {
  await loadTasks()
  if (route.query.runId) {
    const hit = rows.value.find((r) => r.runId === route.query.runId)
    if (hit) await openDetail(hit)
  }
  refreshTimer = window.setInterval(async () => {
    if (!hasActiveTask() && !drawerVisible.value) return
    await loadTasks(true)
    await refreshCurrentDetail()
  }, 3000)
})

onUnmounted(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped lang="scss">
.request-center {
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
.toolbar .tip {
  color: #909399;
  font-size: 12px;
}
.usage-summary {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 7px 12px;
  color: #606266;
  background: #f0f9eb;
  border: 1px solid #d1edc4;
  border-radius: 6px;
  white-space: nowrap;
}
.usage-summary strong {
  color: #67c23a;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
.usage-summary__tasks {
  margin-left: 4px;
  color: #909399;
  font-size: 12px;
}
.section-title {
  font-weight: 600;
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.muted {
  color: #909399;
  font-size: 12px;
}
</style>
