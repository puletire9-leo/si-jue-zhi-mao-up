<template>
  <div class="request-center">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="requestTypeFilter" placeholder="任务类型" clearable style="width: 180px" @change="loadTasks">
          <el-option label="店铺全集查询" value="SHOP_FULL_LOOKUP" />
          <el-option label="ASIN 查询" value="ASIN_LOOKUP" />
          <el-option label="候选批量抓取" value="CANDIDATE_BATCH" />
          <el-option label="精品池复抓" value="PREMIUM_REFRESH" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="loadTasks">
          <el-option label="待处理 PENDING" value="PENDING" />
          <el-option label="运行中 RUNNING" value="RUNNING" />
          <el-option label="已暂停 PAUSED" value="PAUSED" />
          <el-option label="已停止 STOPPED" value="STOPPED" />
          <el-option label="成功 SUCCESS" value="SUCCESS" />
          <el-option label="部分成功" value="PARTIAL_SUCCESS" />
          <el-option label="失败 FAILED" value="FAILED" />
        </el-select>
        <el-button type="primary" @click="loadTasks">刷新</el-button>
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
            <el-button size="small" link @click.stop="handleResume(row)" :disabled="row.status !== 'PAUSED'">恢复</el-button>
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
            <el-descriptions-item label="错误" :span="3" v-if="currentRun.lastErrorMessage">{{ currentRun.lastErrorMessage }}</el-descriptions-item>
          </el-descriptions>

          <div class="section-title">子项明细</div>
          <el-table :data="items" size="small" border max-height="420">
            <el-table-column prop="seq" label="#" width="50" />
            <el-table-column prop="marketplace" label="站点" width="70" />
            <el-table-column prop="sellerName" label="店铺名" min-width="160" show-overflow-tooltip />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="itemStatusType(row.status)">{{ itemStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="total" label="总数" width="70" />
            <el-table-column prop="writtenCount" label="写入" width="70" />
            <el-table-column prop="apiCalls" label="使用次数" width="90" />
            <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click.stop="handleRetryItem(row)"
                           :disabled="row.status !== 'FAILED'">重试</el-button>
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
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  requestCenterApi,
  type SellerspriteRequestRun,
  type SellerspriteRequestItem
} from '@/api/shopPremium'

const route = useRoute()
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
let refreshTimer: number | null = null

const detailTitle = computed(() => currentRun.value ? `任务 ${currentRun.value.runId}` : '任务详情')

async function loadTasks(silentFlag: unknown = false) {
  const silent = silentFlag === true
  if (!silent) loading.value = true
  try {
    const r = await requestCenterApi.listTasks({
      requestType: requestTypeFilter.value || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = r.list || []
    total.value = r.total || 0
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
  try { await requestCenterApi.pause(row.runId); ElMessage.success('已暂停'); await loadTasks() }
  catch (e: any) { ElMessage.error(e?.message || '暂停失败') }
}

async function handleResume(row: SellerspriteRequestRun) {
  try { await requestCenterApi.resume(row.runId); ElMessage.success('已恢复'); await loadTasks() }
  catch (e: any) { ElMessage.error(e?.message || '恢复失败') }
}

async function handleStop(row: SellerspriteRequestRun) {
  try { await requestCenterApi.stop(row.runId); ElMessage.success('已停止'); await loadTasks() }
  catch (e: any) { ElMessage.error(e?.message || '停止失败') }
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
function canStop(status: string) {
  return ['RUNNING', 'PAUSED', 'PENDING'].includes(status)
}

function statusLabel(s: string) {
  return ({
    PENDING: '待处理', RUNNING: '运行中', PAUSED: '已暂停', STOPPED: '已停止',
    SUCCESS: '成功', PARTIAL_SUCCESS: '部分成功', FAILED: '失败'
  } as Record<string, string>)[s] || s
}
function statusType(s: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return ({
    PENDING: 'info', RUNNING: 'primary', PAUSED: 'warning', STOPPED: 'info',
    SUCCESS: 'success', PARTIAL_SUCCESS: 'warning', FAILED: 'danger'
  } as Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'>)[s] || 'info'
}
function itemStatusLabel(s: string) {
  return ({ PENDING: '待处理', RUNNING: '处理中', SUCCESS: '成功', PARTIAL_SUCCESS: '部分成功', FAILED: '失败', SKIPPED: '跳过' } as Record<string, string>)[s] || s
}
function itemStatusType(s: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return ({
    PENDING: 'info', RUNNING: 'primary', SUCCESS: 'success', PARTIAL_SUCCESS: 'warning',
    FAILED: 'danger', SKIPPED: 'info'
  } as Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'>)[s] || 'info'
}

function hasActiveTask() {
  return rows.value.some((r) => ['PENDING', 'RUNNING'].includes(r.status))
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
.section-title {
  font-weight: 600;
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
</style>
