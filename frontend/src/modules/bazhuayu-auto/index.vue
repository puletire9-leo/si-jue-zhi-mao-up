<template>
  <div class="bazhuayu-auto">
    <!-- 6 任务云端采集控制台 -->
    <el-card style="margin-bottom: 16px">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">八爪鱼采集控制台</span>
            <span class="summary-text">
              启动云端采集（从头爬，约 30~60 分钟）/ 停止 / 实时状态。榜单采完自动入库初筛
            </span>
          </div>
          <el-button size="small" :loading="stateLoading" @click="refreshState">刷新状态</el-button>
        </div>
      </template>

      <el-table :data="consoleRows" border size="small">
        <el-table-column prop="functionLabel" label="功能" width="100" />
        <el-table-column prop="marketplace" label="站点" width="70" />
        <el-table-column label="状态" width="150">
          <template #default="{ row }">
            <el-tag :type="phaseTagType(row.state?.phase)" size="small">
              {{ phaseLabel(row.state?.phase) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="云端已采 / 入库" min-width="160">
          <template #default="{ row }">
            <span v-if="row.state">
              <span v-if="row.state.cloudExtractCount > 0">
                云端 {{ row.state.cloudExtractCount.toLocaleString() }}
              </span>
              <span v-if="row.state.drainedRows > 0" class="drained">
                · 入库 {{ row.state.drainedRows.toLocaleString() }}
              </span>
              <span v-if="row.state.error" class="err-text" :title="row.state.error">
                · {{ row.state.error }}
              </span>
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!isRunning(row.state)"
              size="small"
              type="warning"
              :loading="actingKey === row.taskKey"
              @click="handleStart(row)"
            >
              启动采集
            </el-button>
            <el-button
              v-else
              size="small"
              type="danger"
              :loading="actingKey === row.taskKey"
              @click="handleStop(row)"
            >
              停止
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 榜单初筛结果 + 确认调卖家精灵 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">榜单初筛结果</span>
            <span class="summary-text">
              本周 {{ weekTag }} · 采集完成后产出「待确认」初筛任务，确认后调卖家精灵
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
              读取已采数据
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
        「读取已采数据」拉取云端已采好的未导出增量入库初筛，不重新启动云端。
        核对无误后点「确认并调卖家精灵」，才会消耗卖家精灵 API 额度走正常流程入库。
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  bazhuayuApi,
  type BazhuayuTask,
  type BazhuayuRunState,
  type BazhuayuPhase
} from '@/api/bazhuayu'
import { asinImportApi } from '@/api/asinImport'

const loading = ref(false)
const triggering = ref(false)
const marketplace = ref('')
const weekTag = ref('')
const tasks = ref<BazhuayuTask[]>([])
const executingId = ref<number | null>(null)

// ── 控制台：6 任务 ──
const FUNCTIONS = [
  { key: 'bangdan', label: '榜单采集' },
  { key: 'yitushitu', label: '以图识图' }
]
const MARKETS = ['US', 'UK', 'DE']
const stateLoading = ref(false)
const actingKey = ref<string | null>(null)
const runStates = ref<BazhuayuRunState[]>([])

interface ConsoleRow {
  taskKey: string
  function: string
  functionLabel: string
  marketplace: string
  state: BazhuayuRunState | null
}

/** 固定 6 行（2 功能 × 3 站点），按 run-state 回填实时态 */
const consoleRows = computed<ConsoleRow[]>(() => {
  const byKey = new Map(runStates.value.map(s => [s.taskKey, s]))
  const rows: ConsoleRow[] = []
  for (const f of FUNCTIONS) {
    for (const mp of MARKETS) {
      const taskKey = `${f.key}:${mp}`
      rows.push({
        taskKey,
        function: f.key,
        functionLabel: f.label,
        marketplace: mp,
        state: byKey.get(taskKey) ?? null
      })
    }
  }
  return rows
})

const RUNNING_PHASES: BazhuayuPhase[] = ['STARTING', 'WAITING_CLOUD', 'DRAINING']

function isRunning(state: BazhuayuRunState | null): boolean {
  return !!state && RUNNING_PHASES.includes(state.phase)
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let statePollTimer: ReturnType<typeof setInterval> | null = null

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

function phaseLabel(phase?: BazhuayuPhase): string {
  if (!phase) return '空闲'
  const map: Record<BazhuayuPhase, string> = {
    IDLE: '空闲',
    STARTING: '启动中',
    WAITING_CLOUD: '等待云端采集',
    DRAINING: '入库初筛中',
    DONE: '完成',
    ERROR: '失败',
    TIMEOUT: '超时',
    STOPPED: '已停止'
  }
  return map[phase] || phase
}

function phaseTagType(phase?: BazhuayuPhase): TagType {
  if (!phase) return 'info'
  const map: Record<BazhuayuPhase, TagType> = {
    IDLE: 'info',
    STARTING: 'warning',
    WAITING_CLOUD: 'primary',
    DRAINING: 'primary',
    DONE: 'success',
    ERROR: 'danger',
    TIMEOUT: 'danger',
    STOPPED: 'info'
  }
  return map[phase] || 'info'
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

// ── 控制台操作 ──
async function refreshState() {
  stateLoading.value = true
  try {
    runStates.value = await bazhuayuApi.runState()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载运行态失败')
  } finally {
    stateLoading.value = false
  }
}

async function handleStart(row: ConsoleRow) {
  try {
    await ElMessageBox.confirm(
      `将启动八爪鱼云端采集「${row.functionLabel} ${row.marketplace}」，从头爬取约 30~60 分钟，` +
        (row.function === 'bangdan' ? '完成后自动入库初筛。' : '完成后仅记录状态（数据管道下一步）。') +
        '确认启动？',
      '启动云端采集',
      { type: 'warning', confirmButtonText: '启动', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actingKey.value = row.taskKey
  try {
    const resp = await bazhuayuApi.startCollect(row.function, row.marketplace)
    if (resp.accepted.length > 0) {
      ElMessage.success(`已启动 ${row.functionLabel} ${resp.accepted.join('/')}`)
      startStatePolling()
    } else if (resp.skipped.length > 0) {
      ElMessage.warning('该任务正在运行中')
    } else if (resp.missing.length > 0) {
      ElMessage.error(`站点 ${resp.missing.join('/')} 未配置任务 ID`)
    }
    await refreshState()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    actingKey.value = null
  }
}

async function handleStop(row: ConsoleRow) {
  try {
    await ElMessageBox.confirm(
      `将停止「${row.functionLabel} ${row.marketplace}」的云端采集。确认停止？`,
      '停止采集',
      { type: 'warning', confirmButtonText: '停止', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actingKey.value = row.taskKey
  try {
    const resp = await bazhuayuApi.stopCollect(row.function, row.marketplace)
    if (resp.stopped) {
      ElMessage.success('已请求停止')
    } else {
      ElMessage.warning(`本地已停止，云端 stop 失败：${resp.cloudStopError || '未知'}`)
    }
    await refreshState()
  } catch (e: any) {
    ElMessage.error(e?.message || '停止失败')
  } finally {
    actingKey.value = null
  }
}

/** 启动后轮询 run-state，全部任务进终态则停轮询并刷新初筛任务表 */
function startStatePolling() {
  stopStatePolling()
  statePollTimer = setInterval(async () => {
    await refreshState()
    if (!runStates.value.some(s => RUNNING_PHASES.includes(s.phase))) {
      stopStatePolling()
      refresh()   // 一条龙完成会产出 READY 初筛任务
    }
  }, 5000)
}

function stopStatePolling() {
  if (statePollTimer) {
    clearInterval(statePollTimer)
    statePollTimer = null
  }
}

async function handleTrigger() {
  triggering.value = true
  try {
    await bazhuayuApi.trigger(marketplace.value || undefined)
    ElMessage.success('已触发读取，drain 增量入库初筛需数分钟，请稍后刷新')
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

const resultsVisible = ref(false)
const currentResults = ref<{
  taskId: number
  total: number
  byStatus: Record<string, number>
  failedCount: number
} | null>(null)

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

onMounted(async () => {
  await refresh()
  await refreshState()
  // 恢复：若有正在跑的一条龙，继续轮询
  if (runStates.value.some(s => RUNNING_PHASES.includes(s.phase))) {
    startStatePolling()
  }
})
onUnmounted(() => {
  stopPolling()
  stopStatePolling()
})
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
.drained {
  color: var(--el-color-success);
}
.err-text {
  color: var(--el-color-danger);
  font-size: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
}
.status-breakdown {
  margin-top: 16px;
}
</style>
