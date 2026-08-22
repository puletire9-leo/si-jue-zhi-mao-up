<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection, Refresh, Setting, VideoPlay } from '@element-plus/icons-vue'
import {
  automationCenterApi,
  type AutomationJob,
  type AutomationRun
} from '@/api/automationCenter'
import type { LingxingRegistration } from '@/api/lingxingRuntimeCenter'

interface PipelineDefinition {
  registrationCode: string
  source: string
  stages: string[]
  target: string
  defaultTime: string
  defaultPayload: string
  slotGroup: string
}

const PIPELINES: Record<string, PipelineDefinition> = {
  FINANCE_DAILY_REPORT: {
    registrationCode: 'FINANCE_DAILY_REPORT_DAILY',
    source: '领星 OpenAPI（UK + DE，统一 GBP）',
    stages: ['领星日数据拉取', 'RDS 日事实落库', '按日事实重算当天统一表', '财务指标计算', '飞书 5 维日报'],
    target: '飞书多维表格',
    defaultTime: '10:00:00',
    defaultPayload: '{"reportDate":null}',
    slotGroup: 'FINANCE_REPORT'
  },
  OPERATIONS_LOGISTICS_PURCHASE_PROGRESS: {
    registrationCode: 'OPS_LOGISTICS_DAILY',
    source: '领星 OpenAPI（采购 / 货件 / 库存批次）',
    stages: ['领星增量拉取', 'RDS 落库', '采购进度计算', '状态幂等判断', '飞书回写'],
    target: '飞书多维表格',
    defaultTime: '02:10:00',
    defaultPayload: '{"syncShipments":true}',
    slotGroup: 'OPERATIONS_LOGISTICS'
  }
}

const loading = ref(false)
const jobs = ref<AutomationJob[]>([])
const registrations = ref<LingxingRegistration[]>([])
const runs = ref<AutomationRun[]>([])
const dialogVisible = ref(false)
const saving = ref(false)
const selectedJob = ref<AutomationJob | null>(null)
const form = reactive<LingxingRegistration>(emptyRegistration('', null))
let timer: number | null = null

const registrationByJob = computed(() => new Map(registrations.value.map(item => [item.automationJobCode, item])))

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  try {
    const [jobRows, registrationRows, runRows] = await Promise.all([
      automationCenterApi.jobs(), automationCenterApi.registrations(), automationCenterApi.runs(undefined, 80)
    ])
    jobs.value = jobRows
    registrations.value = registrationRows
    runs.value = runRows
  } finally {
    if (!silent) loading.value = false
  }
}

function emptyRegistration(jobCode: string, current: LingxingRegistration | null): LingxingRegistration {
  if (current) return { ...current }
  const pipeline = PIPELINES[jobCode]
  return {
    registrationCode: pipeline?.registrationCode || `${jobCode}_DAILY`,
    automationJobCode: jobCode,
    taskType: jobCode,
    taskName: jobs.value.find(item => item.code === jobCode)?.name || jobCode,
    enabled: 0,
    scheduleType: 'DAILY',
    runTime: pipeline?.defaultTime || '10:00:00',
    dayOfWeek: null,
    fixedDelaySeconds: null,
    timezone: 'Asia/Shanghai',
    priority: jobCode === 'FINANCE_DAILY_REPORT' ? 90 : 100,
    slotGroup: pipeline?.slotGroup || 'DEFAULT',
    slotOrder: 0,
    minimumGapSeconds: 60,
    payloadTemplateJson: pipeline?.defaultPayload || '{}',
    retryLimit: 0,
    remark: '由自动化任务中心维护；所有领星请求统一进入领星运行中心'
  }
}

function openConfig(job: AutomationJob): void {
  selectedJob.value = job
  Object.assign(form, emptyRegistration(job.code, registrationByJob.value.get(job.code) || null))
  dialogVisible.value = true
}

async function saveConfig(): Promise<void> {
  if (!selectedJob.value) return
  try { JSON.parse(form.payloadTemplateJson || '{}') } catch {
    ElMessage.warning('运行参数必须是合法 JSON')
    return
  }
  saving.value = true
  try {
    await automationCenterApi.saveRegistration({ ...form })
    ElMessage.success('自动化配置已保存')
    dialogVisible.value = false
    await load()
  } finally { saving.value = false }
}

async function runNow(job: AutomationJob): Promise<void> {
  const registration = registrationByJob.value.get(job.code)
  if (!registration) {
    ElMessage.warning('请先配置任务，使它接入领星运行中心')
    openConfig(job)
    return
  }
  if (registration.enabled !== 1) {
    ElMessage.warning('任务当前已停用，请先启用后再运行')
    openConfig(job)
    return
  }
  await ElMessageBox.confirm(`立即运行“${job.name}”？任务将进入领星串行队列。`, '手动启动', {
    type: 'info', confirmButtonText: '启动任务'
  })
  const task = await automationCenterApi.dispatch(registration.registrationCode)
  ElMessage.success(`已加入队列：${task.taskId}`)
  await load()
}

function pipeline(jobCode: string): PipelineDefinition {
  return PIPELINES[jobCode] || {
    registrationCode: '', source: '待配置数据源', stages: ['读取', '整理', '投递'], target: '待配置目标', defaultTime: '10:00:00', defaultPayload: '{}', slotGroup: 'DEFAULT'
  }
}

function statusLabel(status: string): string {
  return ({ RUNNING: '运行中', SUCCESS: '成功', PARTIAL_SUCCESS: '部分成功', FAILED: '失败' } as Record<string, string>)[status] || status
}

function statusType(status: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  return ({ RUNNING: 'primary', SUCCESS: 'success', PARTIAL_SUCCESS: 'warning', FAILED: 'danger' } as Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'>)[status] || 'info'
}

function runDuration(value: unknown): string {
  const run = value as AutomationRun
  if (!run.finishedAt) return run.status === 'RUNNING' ? '进行中' : '-'
  const seconds = Math.max(0, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

const STAGE_LABELS: Record<string, string> = {
  validateTarget: '检查飞书目标',
  refreshListing: 'Listing 非破坏刷新',
  snapshotUnifiedPeriod: '按当天日事实写入统一表时间窗',
  resolveSellersUK: '解析 UK 店铺',
  resolveSellersDE: '解析 DE 店铺',
  pullAsinListUK: '领星 UK 日数据拉取',
  pullAsinListDE: '领星 DE 日数据拉取',
  storeDailyFacts: 'RDS 日事实落库',
  loadStoredDailyFacts: '读取 RDS 已有日事实',
  loadReportAsinWhitelistUK: '读取 UK ASIN 白名单',
  loadReportAsinWhitelistDE: '读取 DE ASIN 白名单',
  loadEffectiveDevelopers: '读取有效开发人员',
  loadEffectiveOperators: '读取有效运营人员',
  consolidateAsinsAll: '跨站 ASIN 合并',
  loadListingDatesAll: '读取统一上架日期',
  loadUnifiedAll: '读取统一表元数据',
  loadPriorPositiveAsinsAll: '读取历史出单 ASIN',
  loadPriorStatusSnapshotAll: '读取上期状态快照',
  resolvePriorStatusSnapshotAll: '定位上期快照日期',
  computeReportAllGbp: 'GBP 日报指标计算',
  financeProcessing: '财务数据处理',
  validateReportQuality: '财务日报质量门禁',
  publishFeishuTotal: '飞书总表投递',
  publishFeishuOperations: '飞书运营表投递',
  publishFeishuDevelopers: '飞书开发表投递',
  publishFeishuNonstandard: '飞书非标品表投递',
  publishFeishuListingTime: '飞书上架时间表投递',
  syncPurchaseOrders: '采购单增量拉取',
  syncPurchasePlans: '采购计划增量拉取',
  syncInventory: '库存批次拉取',
  syncShipments: '货件实际数据拉取',
  processPurchaseProgress: '采购进度加工',
  prepareDelivery: '幂等绑定与投递筛选',
  publishFeishuCreates: '飞书批量新增',
  publishFeishuUpdates: '飞书批量更新',
  storeStatusSnapshotAll: 'ASIN 状态快照落库'
}

const STAGE_ORDER = [
  'validateTarget', 'refreshListing',
  'resolveSellersUK', 'pullAsinListUK', 'resolveSellersDE', 'pullAsinListDE', 'storeDailyFacts',
  'snapshotUnifiedPeriod',
  'loadStoredDailyFacts', 'loadReportAsinWhitelistUK', 'loadReportAsinWhitelistDE',
  'loadEffectiveDevelopers', 'loadEffectiveOperators', 'consolidateAsinsAll',
  'loadListingDatesAll', 'loadUnifiedAll', 'loadPriorPositiveAsinsAll',
  'resolvePriorStatusSnapshotAll', 'loadPriorStatusSnapshotAll',
  'computeReportAllGbp', 'financeProcessing', 'validateReportQuality',
  'publishFeishuTotal', 'publishFeishuOperations', 'publishFeishuDevelopers',
  'publishFeishuNonstandard', 'publishFeishuListingTime',
  'syncPurchaseOrders', 'syncPurchasePlans', 'syncInventory', 'syncShipments',
  'processPurchaseProgress', 'prepareDelivery', 'publishFeishuCreates', 'publishFeishuUpdates',
  'storeStatusSnapshotAll'
]

interface StageDuration { key: string; label: string; milliseconds: number }

function resultDetails(value: unknown): Record<string, unknown> {
  const run = value as AutomationRun
  if (!run.resultJson) return {}
  try {
    const value = typeof run.resultJson === 'string' ? JSON.parse(run.resultJson) : run.resultJson
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
  } catch { return {} }
}

function stageDurations(value: unknown): StageDuration[] {
  const run = value as AutomationRun
  const timings = resultDetails(run).stageDurationsMs
  if (!timings || typeof timings !== 'object' || Array.isArray(timings)) return []
  const rows = Object.entries(timings as Record<string, unknown>)
    .filter(([, duration]) => typeof duration === 'number' && Number.isFinite(duration))
    .map(([key, duration]) => ({ key, label: STAGE_LABELS[key] || key, milliseconds: duration as number }))
  const order = new Map(STAGE_ORDER.map((key, index) => [key, index]))
  return rows.sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999))
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds} 毫秒`
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

function parseJson(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function requestDetails(run: AutomationRun): Record<string, unknown> {
  return parseJson(run.requestJson)
}

function jobName(jobCode: string): string {
  return jobs.value.find(item => item.code === jobCode)?.name || jobCode
}

function asText(value: unknown): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value) && value.length >= 3 && value.every(part => typeof part === 'number')) {
    const [year, month, day] = value as number[]
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return String(value)
}

function reportDate(run: AutomationRun): string {
  return asText(resultDetails(run).reportDate) || asText(requestDetails(run).reportDate)
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const text = String(value).replace('T', ' ')
  return text.length >= 19 ? text.slice(0, 19) : text
}

function triggerLabel(run: AutomationRun): string {
  if (run.triggerType === 'EVENT') return '领星队列'
  if (run.triggerType === 'MANUAL') return '手动'
  return run.triggerType || '-'
}

function triggerDetail(run: AutomationRun): string {
  const who = run.requestedBy ? run.requestedBy : ''
  return who ? `${triggerLabel(run)} · ${who}` : triggerLabel(run)
}

function plannedStep(run: AutomationRun): string {
  const req = requestDetails(run)
  if (req.refreshListing === true || req.pullFromLingxing === true) return 'Listing 刷新 / 领星日数据拉取'
  if (req.persistFacts === true) return 'RDS 日事实落库'
  if (req.publishToFeishu === true) return '飞书投递'
  return '财务日报处理'
}

function lastFinishedStage(run: AutomationRun): StageDuration | null {
  const stages = stageDurations(run)
  if (!stages.length) return null
  const byKey = new Map(stages.map(item => [item.key, item]))
  for (let index = STAGE_ORDER.length - 1; index >= 0; index -= 1) {
    const found = byKey.get(STAGE_ORDER[index])
    if (found) return found
  }
  return stages[stages.length - 1]
}

function currentStep(run: AutomationRun): string {
  if (run.status === 'RUNNING') return `进行中 · ${plannedStep(run)}`
  const failed = asText(resultDetails(run).failedStage)
  if (failed) return `停在：${STAGE_LABELS[failed] || failed}`
  const last = lastFinishedStage(run)
  if (run.status === 'SUCCESS' && last) return `已完成 · ${last.label}`
  if (run.status === 'PARTIAL_SUCCESS' && last) return `部分完成 · ${last.label}`
  if (last) return last.label
  return run.status === 'SUCCESS' ? '已完成' : '-'
}

function statusDetail(run: AutomationRun): string {
  const details = resultDetails(run)
  const date = reportDate(run)
  const bits: string[] = []
  if (date) bits.push(`报表日 ${date}`)
  if (run.status === 'RUNNING') {
    bits.push(plannedStep(run))
    return bits.join(' · ')
  }
  if (run.status === 'FAILED') {
    const failed = asText(details.failedStage)
    if (failed) bits.push(`失败阶段 ${STAGE_LABELS[failed] || failed}`)
    if (run.errorMessage) bits.push(run.errorMessage)
    return bits.join(' · ') || '失败'
  }
  if (details.pullFromLingxing === true) bits.push(`领星拉取 ${details.fetchedRows ?? 0} 行`)
  else if (details.pullFromLingxing === false) bits.push('复用 RDS 日事实')
  if (Number(details.storedRows) > 0) bits.push(`新落入库 ${details.storedRows} 行`)
  if (Number(details.distinctAsins) > 0) bits.push(`${details.distinctAsins} 个 ASIN`)
  if (details.publishToFeishu === true) {
    bits.push(`飞书新建 ${details.created ?? 0} / 更新 ${details.updated ?? 0}`)
  }
  if (run.status === 'PARTIAL_SUCCESS') bits.push('部分行投递失败')
  return bits.join(' · ') || statusLabel(run.status)
}

function countLabel(run: AutomationRun): string {
  return `成功 ${run.successCount ?? 0} / 失败 ${run.failedCount ?? 0} / 跳过 ${run.skippedCount ?? 0}（共 ${run.totalCount ?? 0}）`
}

function listingRefreshSummary(run: AutomationRun): string {
  const raw = resultDetails(run).listingRefresh
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
  const value = raw as Record<string, unknown>
  const parts = [`模式 ${asText(value.mode) || 'UPSERT'}`]
  if (value.written != null) parts.push(`落库 ${value.written}`)
  if (value.targetAsins != null) parts.push(`目标 ${value.targetAsins} ASIN`)
  if (value.pages != null) parts.push(`${value.pages} 页`)
  return parts.join(' · ')
}

onMounted(async () => {
  await load()
  timer = window.setInterval(() => { if (runs.value.some(item => item.status === 'RUNNING')) void load(true) }, 3000)
})
onUnmounted(() => { if (timer) window.clearInterval(timer) })
</script>

<template>
  <div class="automation-page">
    <header class="page-header">
      <div><h2>自动化任务中心</h2><p>连接数据上下游，统一配置执行时间、处理阶段和投递结果。</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="load()">刷新</el-button>
    </header>

    <el-alert type="info" :closable="false" show-icon title="本中心负责编排，不直接持有领星或飞书密钥。领星请求进入领星运行中心，飞书连接由飞书对接中心维护。" />

    <section class="task-list">
      <article v-for="job in jobs" :key="job.code" class="task-panel">
        <div class="task-top">
          <div class="task-identity">
            <div class="task-icon"><el-icon><Connection /></el-icon></div>
            <div><h3>{{ job.name }}</h3><p>{{ job.description }}</p></div>
          </div>
          <div class="task-actions">
            <el-tag :type="registrationByJob.get(job.code)?.enabled === 1 ? 'success' : 'info'">
              {{ registrationByJob.get(job.code)?.enabled === 1 ? '自动化已启用' : '未启用' }}
            </el-tag>
            <el-button :icon="Setting" @click="openConfig(job)">配置</el-button>
            <el-button type="primary" :icon="VideoPlay" @click="runNow(job)">手动启动</el-button>
          </div>
        </div>

        <div class="pipeline">
          <div class="endpoint source"><span>上游</span><strong>{{ pipeline(job.code).source }}</strong></div>
          <template v-for="(stage, index) in pipeline(job.code).stages" :key="stage">
            <div class="connector" aria-hidden="true">→</div>
            <div class="stage"><span>{{ index + 1 }}</span><strong>{{ stage }}</strong></div>
          </template>
          <div class="connector" aria-hidden="true">→</div>
          <div class="endpoint target"><span>下游</span><strong>{{ pipeline(job.code).target }}</strong></div>
        </div>

        <dl class="task-meta">
          <div><dt>执行方式</dt><dd>{{ registrationByJob.get(job.code)?.scheduleType || '未配置' }}</dd></div>
          <div><dt>自动时间</dt><dd>{{ registrationByJob.get(job.code)?.runTime || '-' }}</dd></div>
          <div><dt>下次运行</dt><dd>{{ registrationByJob.get(job.code)?.nextRunAt || '-' }}</dd></div>
          <div><dt>最近入队</dt><dd>{{ registrationByJob.get(job.code)?.lastEnqueuedAt || '-' }}</dd></div>
          <div><dt>最近状态</dt><dd>{{ registrationByJob.get(job.code)?.lastStatus || '未运行' }}</dd></div>
        </dl>
      </article>
      <el-empty v-if="!jobs.length && !loading" description="尚未注册自动化任务" />
    </section>

    <section class="history-section">
      <div class="section-heading">
        <div>
          <h3>运行记录</h3>
          <p>完整保留任务名称、报表日、当前步骤、触发方式、处理数量、耗时、结果和错误。</p>
        </div>
      </div>
      <el-table :data="runs" stripe class="run-table">
        <el-table-column type="expand" width="48">
          <template #default="{ row }">
            <div class="run-detail">
              <dl class="run-summary">
                <div><dt>任务</dt><dd>{{ jobName(row.jobCode) }}（{{ row.jobCode }}）</dd></div>
                <div><dt>报表日</dt><dd>{{ reportDate(row) || '-' }}</dd></div>
                <div><dt>当前步骤</dt><dd>{{ currentStep(row) }}</dd></div>
                <div><dt>触发</dt><dd>{{ triggerDetail(row) }}</dd></div>
                <div><dt>处理结果</dt><dd>{{ countLabel(row) }}</dd></div>
                <div><dt>耗时</dt><dd>{{ runDuration(row) }}</dd></div>
                <div><dt>开始</dt><dd>{{ formatDateTime(row.startedAt) }}</dd></div>
                <div><dt>结束</dt><dd>{{ formatDateTime(row.finishedAt) }}</dd></div>
                <div v-if="listingRefreshSummary(row)"><dt>Listing 刷新</dt><dd>{{ listingRefreshSummary(row) }}</dd></div>
                <div v-if="row.correlationId"><dt>关联任务</dt><dd>{{ row.correlationId }}</dd></div>
                <div class="run-summary-wide"><dt>状态说明</dt><dd>{{ statusDetail(row) }}</dd></div>
                <div v-if="row.errorMessage" class="run-summary-wide failed-stage"><dt>错误</dt><dd>{{ row.errorMessage }}</dd></div>
              </dl>
              <div v-if="stageDurations(row).length" class="stage-timing-list">
                <div
                  v-for="stage in stageDurations(row)"
                  :key="stage.key"
                  class="stage-timing-item"
                  :class="{ failed: asText(resultDetails(row).failedStage) === stage.key }"
                >
                  <span>{{ stage.label }}</span><strong>{{ formatDuration(stage.milliseconds) }}</strong>
                </div>
              </div>
              <el-empty v-else description="该次运行还没有阶段耗时（运行中或尚未写入结果）" :image-size="48" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="任务" min-width="220">
          <template #default="{ row }">
            <div class="cell-title">{{ jobName(row.jobCode) }}</div>
            <div class="cell-sub">{{ reportDate(row) ? `报表日 ${reportDate(row)}` : row.jobCode }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="runNo" label="运行号" min-width="210" show-overflow-tooltip />
        <el-table-column label="状态" min-width="280">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
            <div class="cell-sub">{{ statusDetail(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="当前步骤" min-width="200">
          <template #default="{ row }">{{ currentStep(row) }}</template>
        </el-table-column>
        <el-table-column label="触发" min-width="160">
          <template #default="{ row }">{{ triggerDetail(row) }}</template>
        </el-table-column>
        <el-table-column label="处理结果" min-width="220">
          <template #default="{ row }">{{ countLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="120">
          <template #default="{ row }">{{ runDuration(row) }}</template>
        </el-table-column>
        <el-table-column label="开始时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="错误" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" :title="`配置 ${selectedJob?.name || ''}`" width="620px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="启用任务"><el-switch v-model="form.enabled" :active-value="1" :inactive-value="0" /></el-form-item>
        <el-form-item label="执行周期">
          <el-segmented v-model="form.scheduleType" :options="[{ label: '手动', value: 'MANUAL' }, { label: '每天', value: 'DAILY' }]" />
        </el-form-item>
        <el-form-item v-if="form.scheduleType === 'DAILY'" label="自动时间">
          <el-time-picker v-model="form.runTime" value-format="HH:mm:ss" format="HH:mm" placeholder="选择执行时间" />
        </el-form-item>
        <el-form-item label="时区"><el-input v-model="form.timezone" disabled /></el-form-item>
        <el-form-item label="队列优先级"><el-input-number v-model="form.priority" :min="0" :max="999" /></el-form-item>
        <el-form-item label="运行参数">
          <el-input v-model="form.payloadTemplateJson" type="textarea" :rows="4" spellcheck="false" />
        </el-form-item>
        <el-form-item label="接入链路"><el-input :model-value="`${form.registrationCode} → 领星运行中心 → ${form.automationJobCode}`" disabled /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.automation-page { padding: 20px; color: #1f2937; }
.page-header, .task-top, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-header { margin-bottom: 18px; }
h2, h3 { margin: 0; letter-spacing: 0; }
h2 { font-size: 24px; } h3 { font-size: 16px; }
p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.task-list { display: grid; gap: 14px; margin-top: 14px; }
.task-panel, .history-section { padding: 18px; border: 1px solid #e5e7eb; background: #fff; }
.task-identity, .task-actions { display: flex; align-items: center; gap: 10px; }
.task-identity { align-items: flex-start; min-width: 0; }
.task-icon { display: grid; flex: 0 0 38px; height: 38px; place-items: center; color: #fff; background: #303133; border-radius: 6px; }
.pipeline { display: flex; align-items: stretch; gap: 8px; margin: 20px 0; overflow-x: auto; padding-bottom: 4px; }
.endpoint, .stage { display: flex; flex: 0 0 auto; flex-direction: column; justify-content: center; min-height: 62px; padding: 8px 11px; border: 1px solid #dcdfe6; background: #fafafa; }
.endpoint { width: 180px; border-left: 3px solid #409eff; }
.endpoint.target { border-left-color: #67c23a; }
.endpoint span, .stage span { color: #909399; font-size: 11px; }
.endpoint strong, .stage strong { margin-top: 5px; font-size: 12px; font-weight: 600; }
.stage { width: 114px; }
.stage span { display: grid; width: 18px; height: 18px; place-items: center; color: #fff; background: #606266; border-radius: 50%; }
.connector { display: grid; flex: 0 0 14px; place-items: center; color: #909399; }
.task-meta { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; border-top: 1px solid #eef0f3; }
.task-meta div { min-width: 0; padding: 13px 12px 0 0; }
.task-meta dt { color: #909399; font-size: 12px; }.task-meta dd { margin: 5px 0 0; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.history-section { margin-top: 14px; }.section-heading { margin-bottom: 14px; }
.cell-title { font-weight: 600; line-height: 1.35; }
.cell-sub { margin-top: 4px; color: #6b7280; font-size: 12px; line-height: 1.45; white-space: normal; }
.run-detail { padding: 4px 18px 12px 18px; }
.run-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 18px; margin: 0 0 14px; }
.run-summary div { min-width: 0; }
.run-summary-wide { grid-column: 1 / -1; }
.run-summary dt { color: #909399; font-size: 12px; }
.run-summary dd { margin: 4px 0 0; color: #303133; font-size: 13px; line-height: 1.5; word-break: break-word; }
.stage-timing-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px 18px; }
.stage-timing-item { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 7px; border-bottom: 1px solid #ebeef5; color: #606266; font-size: 13px; }
.stage-timing-item strong { color: #303133; font-weight: 600; }
.stage-timing-item.failed, .failed-stage { color: #f56c6c; }
.failed-stage dd { color: #f56c6c; }
@media (max-width: 900px) { .task-top { flex-direction: column; } .task-meta { grid-template-columns: repeat(2, 1fr); } .run-summary { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) { .automation-page { padding: 12px; } .page-header { flex-direction: column; } .task-actions { flex-wrap: wrap; } .task-meta, .run-summary { grid-template-columns: 1fr; } .stage-timing-list { grid-template-columns: 1fr; } }
</style>
