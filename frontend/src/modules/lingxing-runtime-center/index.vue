<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import {
  lingxingRuntimeApi,
  type LingxingMcpStatus,
  type LingxingMcpTool,
  type LingxingRegistration,
  type LingxingTask
} from '@/api/lingxingRuntimeCenter'

const loading = ref(false)
const tasks = ref<LingxingTask[]>([])
const registrations = ref<LingxingRegistration[]>([])
const handlers = ref<string[]>([])
const total = ref(0)
const statusFilter = ref('')
const mcpStatus = ref<LingxingMcpStatus | null>(null)
const mcpTools = ref<LingxingMcpTool[]>([])
const mcpLoading = ref(false)
let timer: number | null = null

const running = computed(() => tasks.value.filter(item => item.status === 'RUNNING'))
const pendingCount = computed(() => tasks.value.filter(item => item.status === 'PENDING').length)
const successCount = computed(() => tasks.value.filter(item => item.status === 'SUCCESS').length)

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  try {
    const [taskPage, registrationRows, handlerRows, status] = await Promise.all([
      lingxingRuntimeApi.listTasks({ status: statusFilter.value || undefined, page: 1, size: 100 }),
      lingxingRuntimeApi.listRegistrations(),
      lingxingRuntimeApi.listHandlers(),
      lingxingRuntimeApi.mcpStatus().catch(() => null)
    ])
    tasks.value = taskPage.list || []
    total.value = taskPage.total || 0
    registrations.value = registrationRows || []
    handlers.value = handlerRows || []
    mcpStatus.value = status
  } finally {
    if (!silent) loading.value = false
  }
}

async function loadMcpTools(): Promise<void> {
  mcpLoading.value = true
  try {
    const result = await lingxingRuntimeApi.mcpTools()
    mcpTools.value = Array.isArray(result) ? result : result.tools || []
    ElMessage.success(`已读取 ${mcpTools.value.length} 个 MCP 工具`)
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : 'MCP 工具读取失败')
  } finally {
    mcpLoading.value = false
  }
}

async function dispatch(row: LingxingRegistration): Promise<void> {
  if (row.enabled !== 1) {
    ElMessage.warning('该注册项未启用，请在自动化任务中心完成配置')
    return
  }
  await ElMessageBox.confirm(`立即将“${row.taskName}”加入领星串行队列？`, '手动派发', {
    type: 'info', confirmButtonText: '加入队列'
  })
  await lingxingRuntimeApi.dispatch(row.registrationCode)
  ElMessage.success('任务已进入领星队列')
  await load()
}

async function stop(value: unknown): Promise<void> {
  const row = value as LingxingTask
  await ElMessageBox.confirm(`确认停止任务 ${row.taskId}？`, '停止任务', { type: 'warning' })
  await lingxingRuntimeApi.stop(row.taskId)
  ElMessage.success('停止指令已提交')
  await load()
}

async function recover(): Promise<void> {
  const count = await lingxingRuntimeApi.recover()
  ElMessage.success(`已恢复 ${count} 个遗留任务`)
  await load()
}

function statusLabel(status?: string | null): string {
  return ({ PENDING: '排队中', RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败', STOPPED: '已停止', SCHEDULED: '已排期', DISABLED: '已停用' } as Record<string, string>)[status || ''] || status || '未运行'
}

function statusType(status?: string | null): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  return ({ RUNNING: 'primary', SUCCESS: 'success', PENDING: 'warning', SCHEDULED: 'primary', FAILED: 'danger', STOPPED: 'info', DISABLED: 'info' } as Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'>)[status || ''] || 'info'
}

function duration(value: unknown): string {
  const row = value as LingxingTask
  if (!row.startedAt) return '-'
  const end = row.finishedAt ? new Date(row.finishedAt).getTime() : Date.now()
  const seconds = Math.max(0, Math.round((end - new Date(row.startedAt).getTime()) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

onMounted(async () => {
  await load()
  timer = window.setInterval(() => {
    if (running.value.length || pendingCount.value) void load(true)
  }, 5000)
})

onUnmounted(() => { if (timer) window.clearInterval(timer) })
</script>

<template>
  <div class="runtime-page">
    <header class="page-header">
      <div>
        <h2>领星运行中心</h2>
        <p>所有领星 OpenAPI 批量任务统一排队、账号串行执行；MCP 用于即时查询与排障。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="loading" :icon="Refresh" @click="load()">刷新</el-button>
        <el-button :icon="RefreshRight" @click="recover">恢复队列</el-button>
      </div>
    </header>

    <section class="metrics" aria-label="领星运行指标">
      <div class="metric"><span>当前运行</span><strong>{{ running.length }}</strong><small>单账号最多 1 个</small></div>
      <div class="metric"><span>等待队列</span><strong>{{ pendingCount }}</strong><small>优先级 + FIFO</small></div>
      <div class="metric"><span>最近成功</span><strong>{{ successCount }}</strong><small>当前加载范围</small></div>
      <div class="metric"><span>处理器</span><strong>{{ handlers.length }}</strong><small>已注册任务类型</small></div>
    </section>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>运行限制：单线程 worker + 领星账号级串行门禁。自动化中心只负责排期与编排，实际领星请求必须进入本队列。</template>
    </el-alert>

    <section class="section">
      <div class="section-heading"><div><h3>当前执行与队列</h3><p>实时查看正在占用领星账号的任务及后续排队任务。</p></div></div>
      <el-table v-loading="loading" :data="tasks.filter(item => ['RUNNING', 'PENDING'].includes(item.status))" stripe>
        <el-table-column prop="taskId" label="任务号" min-width="190" show-overflow-tooltip />
        <el-table-column prop="taskType" label="任务类型" min-width="210" show-overflow-tooltip />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column prop="priority" label="优先级" width="80" />
        <el-table-column label="已耗时" width="120"><template #default="{ row }">{{ duration(row) }}</template></el-table-column>
        <el-table-column prop="createdAt" label="入队时间" min-width="170" />
        <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="danger" @click="stop(row)">停止</el-button></template></el-table-column>
        <template #empty>当前没有运行或排队任务</template>
      </el-table>
    </section>

    <section class="split-grid">
      <div class="section">
        <div class="section-heading"><div><h3>任务接入注册</h3><p>这里只展示任务如何进入队列，排期请到自动化任务中心维护。</p></div></div>
        <div class="registration-list">
          <div v-for="row in registrations" :key="row.registrationCode" class="registration-row">
            <div><strong>{{ row.taskName }}</strong><span>{{ row.registrationCode }}</span></div>
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'">{{ row.enabled === 1 ? '已接入' : '未启用' }}</el-tag>
            <el-button link type="primary" @click="dispatch(row)">加入队列</el-button>
          </div>
          <el-empty v-if="!registrations.length" :image-size="56" description="暂无接入注册项" />
        </div>
      </div>

      <div class="section mcp-section">
        <div class="section-heading">
          <div><h3>领星 MCP</h3><p>官方 Streamable HTTP，只读即时查询、抽样核验与异常排查。</p></div>
          <el-button :disabled="!mcpStatus?.configured" :loading="mcpLoading" @click="loadMcpTools">读取工具</el-button>
        </div>
        <div class="mcp-status">
          <el-tag :type="mcpStatus?.configured ? 'success' : 'danger'">{{ mcpStatus?.configured ? '已配置' : '未配置' }}</el-tag>
          <span>传输：{{ mcpStatus?.transport || '-' }}</span>
          <span>协议：{{ mcpStatus?.protocol_version || '-' }}</span>
        </div>
        <div v-if="mcpTools.length" class="tool-list">
          <el-tooltip v-for="tool in mcpTools" :key="tool.name" :content="tool.description || tool.name">
            <el-tag effect="plain">{{ tool.name }}</el-tag>
          </el-tooltip>
        </div>
        <el-empty v-else :image-size="56" description="尚未读取工具清单" />
      </div>
    </section>

    <section class="section">
      <div class="section-heading history-heading">
        <div><h3>任务历史</h3><p>共 {{ total }} 条，显示最近 100 条。</p></div>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" style="width: 150px" @change="load()">
          <el-option label="排队中" value="PENDING" /><el-option label="运行中" value="RUNNING" />
          <el-option label="成功" value="SUCCESS" /><el-option label="失败" value="FAILED" /><el-option label="已停止" value="STOPPED" />
        </el-select>
      </div>
      <el-table :data="tasks" stripe>
        <el-table-column prop="taskId" label="任务号" min-width="190" show-overflow-tooltip />
        <el-table-column prop="taskType" label="类型" min-width="210" show-overflow-tooltip />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="耗时" width="120"><template #default="{ row }">{{ duration(row) }}</template></el-table-column>
        <el-table-column prop="operator" label="触发人" width="120" />
        <el-table-column prop="createdAt" label="入队时间" min-width="170" />
        <el-table-column prop="errorMessage" label="结果/错误" min-width="240" show-overflow-tooltip />
      </el-table>
    </section>
  </div>
</template>

<style scoped lang="scss">
.runtime-page { padding: 20px; color: #1f2937; }
.page-header, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-header { margin-bottom: 18px; }
h2, h3 { margin: 0; letter-spacing: 0; }
h2 { font-size: 24px; }
h3 { font-size: 16px; }
p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.header-actions { display: flex; gap: 8px; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e5e7eb; margin-bottom: 14px; }
.metric { min-height: 104px; padding: 16px 18px; border-right: 1px solid #e5e7eb; background: #fff; }
.metric:last-child { border-right: 0; }
.metric span, .metric small { display: block; color: #6b7280; }
.metric strong { display: block; margin: 5px 0; font-size: 27px; font-variant-numeric: tabular-nums; }
.metric small { font-size: 12px; }
.section { margin-top: 14px; padding: 16px; border: 1px solid #e5e7eb; background: #fff; }
.section-heading { margin-bottom: 14px; }
.split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.registration-list { display: grid; gap: 8px; }
.registration-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #eef0f3; }
.registration-row:last-child { border-bottom: 0; }
.registration-row strong, .registration-row span { display: block; }
.registration-row span { margin-top: 3px; color: #909399; font-size: 12px; }
.mcp-status, .tool-list { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
.mcp-status { color: #606266; font-size: 13px; }
.tool-list { margin-top: 16px; }
.history-heading { align-items: center; }
@media (max-width: 900px) { .metrics { grid-template-columns: repeat(2, 1fr); } .metric:nth-child(2) { border-right: 0; } .split-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .runtime-page { padding: 12px; } .page-header { flex-direction: column; } .metrics { grid-template-columns: 1fr; } .metric { border-right: 0; border-bottom: 1px solid #e5e7eb; } .metric:last-child { border-bottom: 0; } }
</style>
