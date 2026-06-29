<template>
  <div class="bazhuayu-auto">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">八爪鱼自动采集</span>
            <span class="summary-text">
              本周 {{ weekTag }} · 云端定时爬取 → 初筛 → 确认后调卖家精灵
            </span>
          </div>
          <div class="header-actions">
            <el-select
              v-model="marketplace"
              placeholder="全部站点"
              clearable
              size="small"
              style="width: 120px"
            >
              <el-option label="UK" value="UK" />
              <el-option label="DE" value="DE" />
              <el-option label="US" value="US" />
            </el-select>
            <el-button
              type="primary"
              size="small"
              :loading="triggering"
              @click="handleTrigger"
            >
              手动触发采集
            </el-button>
            <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        采集完成后产出「待确认」初筛任务。核对无误后点「确认并调卖家精灵」，
        才会消耗卖家精灵 API 额度走正常流程入库。
      </el-alert>

      <!-- 本周初筛任务 -->
      <el-table :data="tasks" v-loading="loading" border stripe>
        <el-table-column prop="marketplace" label="站点" width="80" />
        <el-table-column prop="taskStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.taskStatus)" size="small">
              {{ row.taskStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="总数" width="90" />
        <el-table-column prop="passCount" label="初筛通过" width="100">
          <template #default="{ row }">
            <span class="pass-count">{{ row.passCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="筛除" min-width="180">
          <template #default="{ row }">
            <span class="fail-detail">
              价格 {{ row.priceFailCount }} · 评论 {{ row.reviewFailCount }} ·
              重复 {{ row.duplicateCount }} · 跳过 {{ row.skipCount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="API 进度" width="120">
          <template #default="{ row }">
            <span v-if="row.taskStatus === 'RUNNING'">
              {{ row.batchCurrent }}/{{ row.batchTotal }}
            </span>
            <span v-else-if="row.taskStatus === 'DONE'" class="done-text">
              成功 {{ row.apiSuccess }}
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              link
              type="primary"
              @click="viewResults(row)"
            >
              明细
            </el-button>
            <el-button
              size="small"
              type="success"
              :disabled="!canExecute(row)"
              :loading="executingId === row.id"
              @click="handleConfirm(row)"
            >
              确认并调卖家精灵
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && tasks.length === 0" description="本周暂无采集任务" />
    </el-card>

    <!-- 初筛明细抽屉 -->
    <el-drawer v-model="resultsVisible" title="初筛明细" size="40%">
      <div v-if="currentResults">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务 ID">{{ currentResults.taskId }}</el-descriptions-item>
          <el-descriptions-item label="总数">{{ currentResults.total }}</el-descriptions-item>
          <el-descriptions-item label="失败数">{{ currentResults.failedCount }}</el-descriptions-item>
        </el-descriptions>
        <div class="status-breakdown">
          <el-tag
            v-for="(count, status) in currentResults.byStatus"
            :key="status"
            :type="status === 'PASS' ? 'success' : 'info'"
            style="margin: 4px"
          >
            {{ status }}: {{ count }}
          </el-tag>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { bazhuayuApi, type BazhuayuTask } from '@/api/bazhuayu'
import { asinImportApi } from '@/api/asinImport'

const loading = ref(false)
const triggering = ref(false)
const marketplace = ref('')
const weekTag = ref('')
const tasks = ref<BazhuayuTask[]>([])
const executingId = ref<number | null>(null)

const resultsVisible = ref(false)
const currentResults = ref<{
  taskId: number
  total: number
  byStatus: Record<string, number>
  failedCount: number
} | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

function statusTagType(status: string): TagType {
  const map: Record<string, TagType> = {
    READY: 'warning',
    RUNNING: 'primary',
    DONE: 'success',
    ERROR: 'danger',
    REJECTED: 'danger',
    PAUSED: 'info'
  }
  return map[status] || 'info'
}

/** 只有 READY 且有通过项才能执行；RUNNING/DONE 不可重复触发 */
function canExecute(row: BazhuayuTask): boolean {
  return row.taskStatus === 'READY' && row.passCount > 0
}

async function refresh() {
  loading.value = true
  try {
    tasks.value = await bazhuayuApi.latestTasks()
    if (tasks.value.length > 0) {
      // 任务里没有 weekTag 字段，用第一条创建时间月份兜底显示，实际周由后端管控
      weekTag.value = deriveWeek(tasks.value[0].createdAt)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载任务失败')
  } finally {
    loading.value = false
  }
}

function deriveWeek(createdAt: string): string {
  if (!createdAt) return ''
  const d = new Date(createdAt.replace(/-/g, '/'))
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

async function handleTrigger() {
  triggering.value = true
  try {
    await bazhuayuApi.trigger(marketplace.value || undefined)
    ElMessage.success('采集已触发，云端采集+初筛需数分钟，请稍后刷新')
  } catch (e: any) {
    ElMessage.error(e?.message || '触发失败')
  } finally {
    triggering.value = false
  }
}

async function viewResults(row: BazhuayuTask) {
  try {
    currentResults.value = await asinImportApi.results(row.id)
    resultsVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '加载明细失败')
  }
}

async function handleConfirm(row: BazhuayuTask) {
  try {
    await ElMessageBox.confirm(
      `站点 ${row.marketplace} 共 ${row.passCount} 个 ASIN 将调用卖家精灵 API（消耗额度），确认执行？`,
      '确认调用卖家精灵',
      { type: 'warning', confirmButtonText: '确认执行', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  executingId.value = row.id
  try {
    await asinImportApi.execute(row.id, '', row.marketplace)
    ElMessage.success('已开始调用卖家精灵 API')
    startPolling()
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    executingId.value = null
  }
}

/** 执行后轮询任务状态，复用 asin-import 进度，直到全部非 RUNNING */
function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await refresh()
    if (!tasks.value.some(t => t.taskStatus === 'RUNNING')) {
      stopPolling()
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(refresh)
onUnmounted(stopPolling)
</script>

<style scoped lang="scss">
.bazhuayu-auto {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .title {
      font-size: 16px;
      font-weight: 600;
    }
    .summary-text {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}
.pass-count {
  color: var(--el-color-success);
  font-weight: 600;
}
.fail-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.done-text {
  color: var(--el-color-success);
}
.status-breakdown {
  margin-top: 16px;
}
</style>
