<template>
  <template v-if="loading && !hasLoaded">
    <SkeletonWrapper variant="table" :rows="8" />
  </template>
  <div v-else v-loading="refreshing" class="asin-import">
    <div class="page-header">
      <h2>ASIN 导入</h2>
      <span class="page-desc">从八爪鱼数据导入 → 筛选 → 调卖家精灵 API 获取竞品数据</span>
      <div class="header-marketplace">
        <span class="param-label">市场：</span>
        <el-select v-model="marketplace" size="small" style="width:130px">
          <el-option label="🇺🇸 美国 (US)" value="US" />
          <el-option label="🇬🇧 英国 (UK)" value="UK" />
          <el-option label="🇩🇪 德国 (DE)" value="DE" />
        </el-select>
      </div>
      <el-button type="primary" plain size="small" style="margin-left: auto;" @click="historyVisible = true">导入历史</el-button>
    </div>

    <!-- 步骤指示器 -->
    <el-steps :active="currentStep" align-center class="steps-bar">
      <el-step title="选择模式" description="获取方式" />
      <el-step title="上传文件" description="八爪鱼 Excel/JSON" />
      <el-step title="筛选预览" description="查看结果并确认" />
      <el-step title="API 调用" description="获取竞品数据" />
    </el-steps>

    <!-- 0. 选择获取模式 -->
    <el-card v-show="currentStep === 0" class="step-card">
      <div class="mode-selection">
        <div class="mode-card" :class="{ active: importMode === 'asin' }" @click="importMode = 'asin'">
          <el-icon :size="40" color="#409EFF"><Document /></el-icon>
          <h3>通过 ASIN 批量获取</h3>
          <p>上传八爪鱼导出的 Excel/JSON 文件，批量获取竞品详细数据</p>
          <el-tag type="success" size="small">可用</el-tag>
        </div>
        <div class="mode-card" :class="{ active: importMode === 'seller' }" @click="importMode = 'seller'">
          <el-icon :size="40" color="#409EFF"><User /></el-icon>
          <h3>通过卖家名获取</h3>
          <p>输入卖家名称，批量拉取卖家所有商品的竞品数据</p>
          <el-tag type="success" size="small">可用</el-tag>
        </div>
      </div>
      <!-- 卖家精灵使用次数设置 -->
      <el-divider />
      <div class="quota-settings">
        <div class="quota-header">
          <span class="quota-title">卖家精灵使用次数上限</span>
          <el-button size="small" text @click="loadQuota">刷新</el-button>
        </div>
        <el-row :gutter="12" style="margin-top: 12px;">
          <el-col :span="8">
            <div class="quota-item">
              <label>每分钟上限</label>
              <el-input-number v-model="quotaForm.maxPerMinute" :min="1" :max="100" size="small" controls-position="right" />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="quota-item">
              <label>每月上限</label>
              <el-input-number v-model="quotaForm.maxPerMonth" :min="1" :max="50000" :step="100" size="small" controls-position="right" />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="quota-item">
              <label>单次最多 ASIN</label>
              <el-input-number v-model="quotaForm.maxAsinsPerRequest" :min="1" :max="40" size="small" controls-position="right" />
            </div>
          </el-col>
        </el-row>
        <div class="quota-usage">
          <span>本月已用 <b>{{ quotaUsed }}</b> / <b>{{ quotaForm.maxPerMonth }}</b> 次</span>
          <el-progress :percentage="quotaPercent" :color="quotaColor" :stroke-width="10" style="width: 200px; margin-left: 12px;" />
        </div>
        <div style="margin-top: 12px;">
          <el-button type="primary" size="small" @click="saveQuota" :loading="savingQuota">保存使用次数设置</el-button>
        </div>
      </div>

      <!-- 精筛配置 -->
      <!-- <FilterConfigPanel :marketplace="marketplace" /> -->

      <div style="text-align: center; margin-top: 24px">
        <el-button type="primary" :disabled="importMode !== 'asin' && importMode !== 'seller'" @click="handleNextFromMode">
          {{ importMode === 'seller' ? '下一步：输入卖家名' : '下一步：上传文件' }}
        </el-button>
      </div>
    </el-card>

    <!-- 1. 上传文件（ASIN 模式） -->
    <el-card v-show="currentStep === 1 && importMode === 'asin'" class="step-card">
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        multiple
        :auto-upload="false"
        accept=".xlsx,.xls,.json"
        :on-change="handleFileChange"
      >
        <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
        <div class="upload-text">拖拽文件到此处或 <em>点击上传</em></div>
        <div class="upload-hint">支持 .xlsx .xls .json 格式（可多文件一起上传，自动去重）</div>
      </el-upload>

      <div v-if="uploading" class="upload-progress">
        <el-steps :active="uploadStage" direction="vertical" align-center>
          <el-step title="上传文件" :description="`已选择 ${importFiles.length} 个文件`" />
          <el-step title="解析数据" description="读取 Excel/JSON 文件..." />
          <el-step title="筛选去重" description="价格 + 评论筛选，ASIN 去重..." />
          <el-step title="保存结果" description="写入数据库..." />
        </el-steps>
        <el-progress :percentage="uploadPercent" :stroke-width="8" style="margin-top: 16px" />
      </div>

      <div v-else style="text-align: center; margin-top: 20px">

        <div style="margin-top: 14px">
          <el-button @click="currentStep = 0">返回</el-button>
          <el-button type="primary" :disabled="importFiles.length === 0" @click="handleUpload">
            上传并筛选
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 1b. 卖家名输入（卖家模式） -->
    <el-card v-show="currentStep === 1 && importMode === 'seller'" class="step-card">
      <h3 style="margin: 0 0 16px">输入卖家名称</h3>
      <el-form label-width="100px">

        <el-form-item label="卖家名称">
          <el-input
            v-model="sellerNamesText"
            type="textarea"
            :rows="6"
            placeholder="一行一个卖家名称，例如：SellerA&#10;SellerB&#10;SellerC"
            clearable
          />
          <div style="margin-top: 8px">
            <el-upload
              :auto-upload="false"
              accept=".txt,.md"
              :show-file-list="false"
              :on-change="handleSellerFileChange"
            >
              <el-button size="small" text type="primary">上传 .txt/.md 文件</el-button>
            </el-upload>
          </div>
          <div v-if="parsedSellerNames.length > 0" style="margin-top: 8px; font-size: 13px; color: #606266">
            已解析 <b>{{ parsedSellerNames.length }}</b> 个卖家名
          </div>
        </el-form-item>
      </el-form>
      <div style="text-align: center; margin-top: 20px">
        <el-button @click="currentStep = 0">返回</el-button>
        <el-button type="primary" :disabled="parsedSellerNames.length === 0" @click="handleSellerPreview" :loading="sellerPreviewing">
          查询卖家商品
        </el-button>
      </div>
    </el-card>

    <!-- 2. 筛选预览 + API 参数确认（ASIN 模式） -->
    <el-card v-show="currentStep === 2 && importMode === 'asin'" class="step-card">
      <!-- 数据库概况 -->
      <div class="db-stats" v-if="dbStats">
        <span>数据库现有：</span>
        <span class="stat-item">竞品数据 <b>{{ dbStats.products?.toLocaleString() }}</b> 条</span>
        <span class="stat-item">跳过ASIN <b>{{ dbStats.skipAsins?.toLocaleString() }}</b> 条</span>
        <span class="stat-item">店铺 <b>{{ dbStats.shops?.toLocaleString() }}</b> 个</span>
        <span class="stat-item this-batch" v-if="previewData">
          本次淘汰 <b>{{ (previewData.priceFailCount||0) + (previewData.reviewFailCount||0) }}</b> 个
        </span>
      </div>

      <!-- API 调用参数 -->
      <div class="api-params">

        <div class="param-row">
          <span class="param-label">数据月份：</span>
          <el-tag type="primary">{{ currentMonth }}</el-tag>
          <span class="param-hint">仅作入库标记，API 不限制月份，获取该 ASIN 全部历史数据</span>
        </div>
        <div class="param-row">
          <span class="param-label">每批数量：</span>
          <span>{{ BATCH_SIZE }} 个 ASIN（卖家精灵 API 上限）</span>
        </div>
      </div>

      <!-- 筛选预览 -->
      <div class="filter-summary">
        <span>筛选条件：价格 {{ currencySymbol }}{{ PRICE_MIN }} ~ {{ currencySymbol }}{{ PRICE_MAX }} | 评论 < {{ REVIEW_MAX }} | 每批 {{ BATCH_SIZE }} 个</span>
      </div>

      <!-- 筛选结果表 -->
      <el-table :data="previewRows" stripe class="preview-table">
        <el-table-column prop="label" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.type" size="small">{{ row.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="数量" width="100" align="right" />
        <el-table-column prop="percent" label="占比" width="80" align="right" />
        <el-table-column label="说明" min-width="200">
          <template #default="{ row }">{{ row.desc }}</template>
        </el-table-column>
      </el-table>

      <!-- 批量信息 -->
      <div v-if="previewData" class="batch-summary">
        <div class="batch-line">
          <el-icon color="#409EFF"><InfoFilled /></el-icon>
          <span>
            <b>{{ previewData.passCount }}</b> 个 ASIN → <b>{{ previewData.batchTotal }}</b> 批
            （每批 {{ BATCH_SIZE }} 个，预计 {{ previewData.batchTotal }} 次 API 请求）
          </span>
        </div>
        <el-alert
          v-if="previewData.discardedAsins > 0"
          type="warning"
          :closable="false"
          style="margin-top: 12px"
        >
          <template #title>
            剩余 {{ previewData.discardedAsins }} 个 ASIN 不足一批（{{ BATCH_SIZE }} 个），将被丢弃
          </template>
        </el-alert>
        <div v-if="previewData.discardedAsins === 0" class="batch-line" style="color: #67C23A">
          <el-icon color="#67C23A"><CircleCheckFilled /></el-icon>
          <span>无丢弃，全部 ASIN 恰好分完</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 20px">
        <el-button @click="handleBackToUpload">返回</el-button>
        <el-button type="success" :disabled="!previewData || previewData.passCount === 0" @click="handleConfirmAndExecute">
          确认并开始调用 API
        </el-button>
      </div>
    </el-card>

    <!-- 2b. 卖家模式预览 + 执行 -->
    <el-card v-show="currentStep === 2 && importMode === 'seller'" class="step-card">
      <h3 style="margin: 0 0 16px">卖家名批量导入 — 预览</h3>
      <div v-if="sellerPreviewData" class="batch-summary">
        <div class="batch-line">
          <el-icon color="#409EFF"><InfoFilled /></el-icon>
          <span>
            共 <b>{{ sellerPreviewData.sellerCount }}</b> 个卖家，
            预计 <b>{{ sellerPreviewData.estimatedApiCalls }}</b> 次 API 请求
            （每个卖家至少 1 次，大卖家可能翻页）
          </span>
        </div>
        <div class="batch-line" style="margin-top: 8px">
          <span>市场：<el-tag size="small" type="success">{{ sellerPreviewData.marketplace }}</el-tag></span>
          <span style="margin-left: 16px">月份：<el-tag size="small" type="primary">{{ month }}</el-tag></span>
        </div>
        <div class="rate-limit-info">
          <el-divider style="margin: 12px 0 8px" />
          <div class="rate-title">固定速率限制</div>
          <div class="rate-row">
            <span>每分钟最多 <b>{{ sellerPreviewData.maxPerMinute || 20 }}</b> 次请求</span>
            <span>每个卖家间隔 <b>{{ ((sellerPreviewData.delayMs || 2500) / 1000).toFixed(1) }}</b> 秒</span>
          </div>
          <div class="rate-row" style="margin-top: 4px">
            <span>预估总耗时：<b>{{ formatDuration(sellerPreviewData.estimatedDuration) }}</b></span>
          </div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px">
        <el-button @click="currentStep = 1; sellerPreviewData = null">返回</el-button>
        <el-button type="success" :disabled="!sellerPreviewData" @click="handleSellerExecute">
          确认并开始导入
        </el-button>
      </div>
    </el-card>

    <!-- 3. API 调用进度 -->
    <el-card v-show="currentStep === 3" class="step-card">
      <div class="api-params" style="margin-bottom: 16px">
        <span class="param-label">市场：</span><el-tag size="small" type="success">{{ marketplace }}</el-tag>
        <span class="param-label" style="margin-left: 16px">月份：</span><el-tag size="small" type="primary">{{ month }}</el-tag>
      </div>

      <div class="progress-info">
        <div class="progress-item">
          <span class="progress-label">任务状态</span>
          <el-tag :type="progressTagType">{{ progress.statusText }}</el-tag>
        </div>
        <div class="progress-item">
          <span class="progress-label">请求进度</span>
          <span><b>{{ progress.batchCurrent }}</b> / {{ progress.batchTotal }} 次</span>
        </div>
        <div class="progress-item">
          <span class="progress-label">已入库</span>
          <span style="color: #67C23A; font-weight: 600">{{ progress.apiSuccess }} 条</span>
        </div>
        <div class="progress-item" v-if="progress.apiFail > 0">
          <span class="progress-label">失败</span>
          <span style="color: #F56C6C; font-weight: 600">{{ progress.apiFail }} 条</span>
        </div>
        <div class="progress-item">
          <span class="progress-label">预计剩余</span>
          <span style="color: #E6A23C">{{ Math.max(0, progress.batchTotal - progress.batchCurrent) }} 次请求</span>
        </div>
      </div>

      <el-progress
        :percentage="progressPercent"
        :status="progressPercent === 100 ? 'success' : ''"
        :stroke-width="20"
        :text-inside="true"
      />

      <!-- 实时日志 -->
      <div v-if="progress.progressLog" class="progress-log">
        <div class="log-title">执行日志</div>
        <div class="log-content" ref="logContainerRef">{{ progress.progressLog }}</div>
      </div>

      <el-alert
        v-if="progress.errorMessage"
        type="error"
        :closable="false"
        style="margin-top: 16px"
      >
        <template #title>
          <div style="word-break: break-all; font-size: 13px; max-height: 80px; overflow-y: auto">
            {{ progress.errorMessage }}
          </div>
        </template>
      </el-alert>

      <div style="text-align: center; margin-top: 20px">
        <div v-if="quotaMax" class="quota-inline">
          本月已用 <b>{{ quotaUsed }}</b> / {{ quotaMax }} 次
        </div>
        <el-button v-if="progress.taskStatus === 'RUNNING'" type="warning" @click="handlePause">暂停</el-button>
        <el-button v-if="progress.taskStatus === 'RUNNING'" type="danger" @click="handleStop">停止</el-button>
        <el-button v-if="['PAUSED','CANCELLED'].includes(progress.taskStatus)" type="primary" @click="handleResume">继续</el-button>
        <el-button v-if="progress.taskStatus === 'DONE'" type="success" @click="handleDone">完成，查看结果</el-button>
      </div>
    </el-card>
    <!-- 历史侧边栏 -->
    <HistorySidebar v-model="historyVisible" @retry-created="onRetryCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Document, User, InfoFilled, CircleCheckFilled } from '@element-plus/icons-vue'
import { asinImportApi, type UploadPreview, type TaskProgress } from '@/api/asinImport'
import HistorySidebar from './HistorySidebar.vue'
import FilterConfigPanel from '@/components/FilterConfigPanel/index.vue'
import SkeletonWrapper from '@/components/SkeletonWrapper/index.vue'
import { competitorApi } from '@/api/competitor'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const hasLoaded = ref(false)
const refreshing = computed(() => loading.value && hasLoaded.value)
const historyVisible = ref(false)

// 卖家精灵使用次数
const quotaUsed = ref(0)
const quotaMax = ref(20000)
const savingQuota = ref(false)
const quotaForm = reactive({ maxPerMinute: 10, maxPerMonth: 20000, maxAsinsPerRequest: 40 })
const quotaPercent = computed(() => quotaMax.value > 0 ? Math.round(quotaUsed.value / quotaMax.value * 100) : 0)
const quotaColor = computed(() => quotaPercent.value > 80 ? '#F56C6C' : quotaPercent.value > 50 ? '#E6A23C' : '#67C23A')

async function loadQuota() {
  try {
    const res = await competitorApi.getQuota()
    if (res?.data) {
      quotaUsed.value = res.data.monthUsed || 0
      quotaMax.value = res.data.maxPerMonth || 20000
      quotaForm.maxPerMinute = res.data.maxPerMinute || 10
      quotaForm.maxPerMonth = res.data.maxPerMonth || 20000
      quotaForm.maxAsinsPerRequest = res.data.maxAsinsPerRequest || 40
    }
  } catch (e) { /* */ }
}

async function saveQuota() {
  savingQuota.value = true
  try {
    await competitorApi.updateQuota({
      maxPerMinute: quotaForm.maxPerMinute,
      maxPerMonth: quotaForm.maxPerMonth,
      maxAsinsPerRequest: quotaForm.maxAsinsPerRequest
    })
    quotaMax.value = quotaForm.maxPerMonth
    ElMessage.success('使用次数设置已保存')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally { savingQuota.value = false }
}

const PRICE_MIN = ref(4.99)
const PRICE_MAX = ref(19.99)
const REVIEW_MAX = ref(5)
const BATCH_SIZE = 40

// 加载初筛配置
const loadInitialFilterConfig = async () => {
  try {
    const res = await competitorApi.getInitialFilterConfig(marketplace.value)
    if (res.code === 200 && res.data) {
      PRICE_MIN.value = res.data.priceMin
      PRICE_MAX.value = res.data.priceMax
      REVIEW_MAX.value = res.data.reviewMax
    }
  } catch (e) { /* 静默失败，用默认值 */ }
}

onMounted(async () => {
  loading.value = true
  await loadInitialFilterConfig()
  await loadQuota()
  loading.value = false
  hasLoaded.value = true
})

// 市场货币符号
const currencySymbol = computed(() => {
  const symbols: Record<string, string> = { UK: '£', US: '$', DE: '€' }
  return symbols[marketplace.value] || '£'
})

// 自动计算最新月份：yyyyMM
const currentMonth = computed(() => {
  const now = new Date()
  return now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0')
})

const importMode = ref('asin') // 'asin' | 'seller'
const currentStep = ref(0)
const marketplace = ref('UK')

// 卖家模式状态
const sellerNamesText = ref('')
const sellerPreviewData = ref<{ taskId: number; sellerCount: number; estimatedApiCalls: number; marketplace: string } | null>(null)
const sellerPreviewing = ref(false)

const parsedSellerNames = computed(() => {
  return sellerNamesText.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter((v, i, a) => a.indexOf(v) === i) // 去重
})
const month = ref(currentMonth.value)
const importFiles = ref<File[]>([])
const uploading = ref(false)
const uploadStage = ref(0)
const uploadPercent = ref(0)
let uploadTimer: ReturnType<typeof setInterval> | null = null
const previewData = ref<UploadPreview | null>(null)
const progress = reactive<TaskProgress & { statusText: string }>({
  taskId: 0, status: '', statusText: '', totalCount: 0,
  passCount: 0, batchTotal: 0, batchCurrent: 0, apiSuccess: 0, apiFail: 0
})

let pollingTimer: ReturnType<typeof setInterval> | null = null

const previewRows = computed(() => {
  if (!previewData.value) return []
  const total = previewData.value.totalCount
  return [
    { label: '通过', type: 'success', count: previewData.value.passCount, percent: pct(previewData.value.passCount, total), desc: '符合所有筛选条件，将调用 API' },
    { label: '价格', type: 'warning', count: previewData.value.priceFailCount, percent: pct(previewData.value.priceFailCount, total), desc: `价格不在 ${currencySymbol.value}${PRICE_MIN.value}~${currencySymbol.value}${PRICE_MAX.value} 范围` },
    { label: '评论', type: 'warning', count: previewData.value.reviewFailCount, percent: pct(previewData.value.reviewFailCount, total), desc: `评论数 > ${REVIEW_MAX.value}` },
    { label: '重复', type: 'info', count: previewData.value.duplicateCount, percent: pct(previewData.value.duplicateCount, total), desc: '文件内重复 ASIN' },
    { label: '主表已有', type: 'info', count: previewData.value.skipMainCount ?? 0, percent: pct(previewData.value.skipMainCount ?? 0, total), desc: 'competitor_products 表已有 → 跳过 API' },
    { label: '硬性淘汰', type: '', count: previewData.value.skipBlacklistCount ?? 0, percent: pct(previewData.value.skipBlacklistCount ?? 0, total), desc: 'skip_asins 黑名单（价格/评论等历史淘汰）' }
  ]
})

const progressPercent = computed(() => {
  if (progress.batchTotal === 0) return 0
  return Math.round((progress.batchCurrent / progress.batchTotal) * 100)
})

const progressTagType = computed(() => {
  const map: Record<string, string> = { RUNNING: 'warning', DONE: 'success', ERROR: 'danger', REJECTED: 'danger' }
  return map[progress.taskStatus] || 'info'
})

function pct(count: number, total: number) {
  if (total === 0) return '0%'
  return Math.round((count / total) * 100) + '%'
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return '-'
  if (seconds < 60) return `${seconds} 秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

function handleFileChange(file: any, fileList: any) {
  importFiles.value = fileList.map((f: any) => f.raw).filter(Boolean)
}

function handleNextFromMode() {
  if (importMode.value === 'asin') {
    currentStep.value = 1
  } else if (importMode.value === 'seller') {
    currentStep.value = 1
    sellerPreviewData.value = null
  }
}

function handleSellerFileChange(file: any) {
  const raw = file.raw as File
  if (!raw) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      const existing = sellerNamesText.value.trim()
      const newLines = text.trim()
      sellerNamesText.value = existing ? existing + '\n' + newLines : newLines
    }
  }
  reader.readAsText(raw)
}

async function handleSellerPreview() {
  if (parsedSellerNames.value.length === 0) return
  sellerPreviewing.value = true
  try {
    const data: any = await asinImportApi.sellerPreview(parsedSellerNames.value, marketplace.value)
    sellerPreviewData.value = data.data || data
    month.value = currentMonth.value
    currentStep.value = 2
    ElMessage.success(`已解析 ${parsedSellerNames.value.length} 个卖家名`)
  } catch (e: any) {
    ElMessage.error(e?.message || '查询失败，请检查卖家名称')
  } finally {
    sellerPreviewing.value = false
  }
}

async function handleSellerExecute() {
  if (!sellerPreviewData.value) return

  // 使用次数预检
  let remainingQuota = 999
  try {
    const qRes = await competitorApi.getQuota()
    if (qRes?.data) remainingQuota = qRes.data.monthRemaining ?? 999
  } catch {}

  const estCalls = sellerPreviewData.value.estimatedApiCalls
  if (remainingQuota < estCalls) {
    ElMessage.warning(`本月剩余 ${remainingQuota} 次使用次数，不足预估 ${estCalls} 次`)
    return
  }

  try {
    await ElMessageBox.confirm(
      `将为 ${sellerPreviewData.value.sellerCount} 个卖家调用约 ${estCalls} 次 API，确认开始？`,
      '确认导入',
      { confirmButtonText: '开始', cancelButtonText: '返回' }
    )
  } catch { return }

  currentStep.value = 3
  try {
    const data: any = await asinImportApi.sellerExecute(sellerPreviewData.value.taskId, month.value)
    const task = data.data || data
    previewData.value = { taskId: task.taskId } as any
    Object.assign(progress, {
      taskId: task.taskId, batchTotal: task.batchTotal ?? sellerPreviewData.value.sellerCount,
      batchCurrent: 0, apiSuccess: 0, apiFail: 0, statusText: '调用中', taskStatus: 'RUNNING'
    })
    startPolling(task.taskId)
    startQuotaPolling()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  }
}

function startUploadProgress() {
  uploadStage.value = 0
  uploadPercent.value = 0
  // 模拟进度步进
  const stages = [1, 2, 3]
  let i = 0
  uploadTimer = setInterval(() => {
    if (i < stages.length) {
      uploadStage.value = stages[i]
      uploadPercent.value = Math.min(25 + (i + 1) * 25, 90)
      i++
    }
  }, 800)
}

function stopUploadProgress() {
  if (uploadTimer) { clearInterval(uploadTimer); uploadTimer = null }
  uploadPercent.value = 100
  setTimeout(() => { uploadStage.value = 0; uploadPercent.value = 0 }, 600)
}

async function handleUpload() {
  if (importFiles.value.length === 0) return
  uploading.value = true
  month.value = currentMonth.value
  startUploadProgress()
  try {
    const data: any = await asinImportApi.upload(importFiles.value, marketplace.value)
    previewData.value = data.data || data
    uploadStage.value = 4
    stopUploadProgress()
    currentStep.value = 2
    const count = importFiles.value.length
    ElMessage.success(`已合并 ${count} 个文件，筛选完成`)
  } catch (e: any) {
    stopUploadProgress()
    ElMessage.error(e?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

function handleBackToUpload() {
  currentStep.value = 1
  previewData.value = null
}

async function handleConfirmAndExecute() {
  if (!previewData.value) return
  const p = previewData.value

  // 使用次数预检
  let remainingQuota = 999
  try {
    const qRes = await competitorApi.getQuota()
    if (qRes?.data) {
      remainingQuota = qRes.data.monthRemaining ?? 999
      quotaUsed.value = qRes.data.monthUsed || 0
      quotaMax.value = qRes.data.maxPerMonth || 20000
    }
  } catch (e) { /* ignore */ }

  const estMin = p.batchTotal  // 最少 batchTotal 次
  const estMax = p.batchTotal * 2  // 含变体可能翻倍
  const quotaWarning = remainingQuota < estMin
    ? `<p style='color:#F56C6C;font-weight:bold'>本月剩余仅 ${remainingQuota} 次，不足最低 ${estMin} 次！建议增加使用次数上限或下月再试</p>`
    : remainingQuota < estMax
      ? `<p style='color:#E6A23C'>本月剩余 ${remainingQuota} 次，预计需要 ${estMin}~${estMax} 次（含翻页），可能不够</p>`
      : `<p style='color:#67C23A'>本月剩余 ${remainingQuota} 次，预计需要 ${estMin}~${estMax} 次</p>`

  const msg = `<div style='text-align:left'>
    <p><b>API 调用参数：</b></p>
    <p>市场：<b>${marketplace.value}</b> | 月份：<b>${month.value}</b> | 每批：<b>${BATCH_SIZE}</b> 个</p>
    <p style='margin-top:12px'>将通过 <b style='color:#409EFF'>${p.passCount}</b> 个 ASIN 分 <b style='color:#409EFF'>${p.batchTotal}</b> 批调用卖家精灵 API</p>
    ${p.discardedAsins > 0 ? `<p style='color:#E6A23C'>剩余 ${p.discardedAsins} 个不足一批（${BATCH_SIZE} 个），将被丢弃</p>` : ''}
    ${quotaWarning}
    <p style='margin-top:12px'>确认开始调用？</p>
  </div>`
  try {
    await ElMessageBox.confirm(msg, '确认 API 调用参数', {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '开始调用',
      cancelButtonText: '返回',
      type: remainingQuota < estMin ? 'warning' : 'info'
    })
  } catch { return }

  currentStep.value = 3
  try {
    const data: any = await asinImportApi.execute(previewData.value.taskId, month.value, marketplace.value)
    const task = data.data || data
    Object.assign(progress, task, { statusText: '调用中' })
    startPolling(task.taskId || previewData.value.taskId)
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  }
}

function startPolling(taskId: number) {
  stopPolling()
  pollingTimer = setInterval(async () => {
    try {
      const data: any = await asinImportApi.progress(taskId)
      const p = data.data || data
      const statusText: Record<string, string> = {
        RUNNING: '调用中', DONE: '已完成', ERROR: '出错', PAUSED: '已暂停', CANCELLED: '已取消', REJECTED: '已被拒绝'
      }
      Object.assign(progress, p, { statusText: statusText[p.taskStatus] || p.taskStatus })
      if (p.taskStatus === 'DONE' || p.taskStatus === 'ERROR' || p.taskStatus === 'CANCELLED' || p.taskStatus === 'REJECTED') {
        stopPolling()
        if (p.taskStatus === 'REJECTED') {
          ElMessage.warning('该任务被拒绝：已有另一个任务正在调用 API，请等待其完成后再试')
        }
      }
    } catch { /* ignore */ }
  }, 3000)
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
}

async function handlePause() {
  if (!previewData.value) return
  try {
    await asinImportApi.cancel(previewData.value.taskId, 'pause')
    stopPolling()
    Object.assign(progress, { taskStatus: 'PAUSED', statusText: '已暂停' })
    ElMessage.success('已通知后端暂停')
  } catch (e: any) {
    ElMessage.error(e?.message || '暂停失败')
  }
}

async function handleStop() {
  if (!previewData.value) return
  try {
    await asinImportApi.cancel(previewData.value.taskId, 'stop')
    stopPolling()
    Object.assign(progress, { taskStatus: 'CANCELLED', statusText: '已取消' })
    ElMessage.warning('已停止调用')
  } catch (e: any) {
    ElMessage.error(e?.message || '停止失败')
  }
}

async function handleResume() {
  if (!previewData.value) return
  const taskId = previewData.value.taskId
  try {
    const data: any = await asinImportApi.execute(taskId, month.value, marketplace.value)
    const task = data.data || data
    Object.assign(progress, task, { taskStatus: 'RUNNING', statusText: '调用中' })
    startPolling(taskId)
    ElMessage.success('继续执行')
  } catch (e: any) {
    ElMessage.error(e?.message || '继续失败')
  }
}

function onRetryCreated(newTaskId: number) {
  historyVisible.value = false
  currentStep.value = 3

  // 设置 previewData 供暂停/停止/继续按钮使用
  previewData.value = { taskId: newTaskId } as any

  // 初始化进度显示
  Object.assign(progress, {
    taskId: newTaskId,
    taskStatus: 'RUNNING',
    statusText: '调用中',
    batchCurrent: 0,
    batchTotal: 0,
    apiSuccess: 0,
    apiFail: 0,
    progressLog: '',
    errorMessage: ''
  })
  // 立即获取实际批次信息
  asinImportApi.progress(newTaskId).then((data: any) => {
    const p = data.data || data
    if (p) Object.assign(progress, p, { statusText: '调用中' })
  }).catch(() => {})
  startPolling(newTaskId)
  startQuotaPolling()
}

function handleDone() {
  stopQuotaPolling()
  ElMessageBox.confirm('API 调用完成，是否跳转查看竞品数据？', '完成', { confirmButtonText: '去查看', cancelButtonText: '留在此页' })
    .then(() => router.push('/reference-products'))
    .catch(() => {})
}

// ---- 使用次数轮询（步骤3进度页用） ----
let quotaTimer: any = null

function startQuotaPolling() {
  loadQuota()
  quotaTimer = setInterval(loadQuota, 10000)
}

function stopQuotaPolling() {
  if (quotaTimer) { clearInterval(quotaTimer); quotaTimer = null }
}

const dbStats = ref<Record<string, number> | null>(null)
async function fetchDbStats() {
  try {
    const token = localStorage.getItem('token')
    const r = await fetch('/api/v1/competitor/stats', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const d = await r.json()
    if (d.data) dbStats.value = d.data
  } catch {}
}

// 进入步骤 2/3 时加载使用次数
watch(marketplace, () => { loadInitialFilterConfig() })

watch(currentStep, (step) => {
  if (step === 0) {
    loadQuota()
  } else if (step === 2) {
    loadQuota()
    fetchDbStats()
  } else if (step === 3) {
    startQuotaPolling()
  } else {
    stopQuotaPolling()
  }
})
</script>

<style scoped>
.asin-import { max-width: 900px; margin: 0 auto; padding: 20px; }
.page-header { margin-bottom: 20px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.page-header h2 { margin: 0; font-size: 20px; }
.page-desc { color: #909399; font-size: 13px; }
.steps-bar { margin-bottom: 24px; }
.step-card { min-height: 320px; }

.header-marketplace {
  display: flex; align-items: center; gap: 6px; margin-left: 16px;
  .param-label { font-size: 12px; color: #909399; white-space: nowrap; }
}

/* 模式选择 */
.mode-selection { display: flex; gap: 24px; justify-content: center; margin-top: 16px; }
.mode-card {
  width: 260px; padding: 32px 24px; border: 2px solid #e4e7ed; border-radius: 12px;
  text-align: center; cursor: pointer; transition: all 0.3s;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.mode-card:hover:not(.disabled) { border-color: #409EFF; box-shadow: 0 4px 12px rgba(64,158,255,0.15); }
.mode-card.active { border-color: #409EFF; background: #ecf5ff; }
.mode-card.disabled { cursor: not-allowed; opacity: 0.6; }
.mode-card h3 { margin: 0; font-size: 16px; color: #303133; }
.mode-card p { margin: 0; font-size: 13px; color: #909399; line-height: 1.5; }

/* 使用次数设置 */
.quota-settings { padding: 0 4px; }
.quota-header { display: flex; align-items: center; justify-content: space-between; }
.quota-title { font-weight: 600; font-size: 14px; }
.quota-item label { display: block; font-size: 12px; color: #909399; margin-bottom: 4px; }
.quota-usage { display: flex; align-items: center; margin-top: 12px; font-size: 13px; color: #606266; }

/* 上传 */
.upload-area { width: 100%; }
.upload-text { font-size: 15px; color: #606266; margin-top: 12px; }
.upload-text em { color: #409EFF; }
.upload-hint { font-size: 12px; color: #C0C4CC; margin-top: 6px; }

/* API 参数 */
.db-stats {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  padding: 10px 16px; margin-bottom: 12px; background: #f0f9eb; border-radius: 8px;
  font-size: 13px; color: #606266;
}
.stat-item b { color: #409EFF; }
.stat-item.this-batch { color: #E6A23C; }
.stat-item.this-batch b { color: #E6A23C; }

.api-params {
  display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
  padding: 12px 16px; background: #f5f7fa; border-radius: 8px;
}
.param-row { display: flex; align-items: center; gap: 8px; }
.param-label { font-weight: 500; font-size: 14px; color: #303133; }
.param-hint { font-size: 12px; color: #909399; }

.filter-summary { font-size: 13px; color: #606266; margin-bottom: 12px; }
.preview-table { margin-top: 8px; }

.batch-summary { margin-top: 16px; padding: 12px 16px; background: #f0f9eb; border-radius: 8px; }
.batch-line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #303133; }
.rate-limit-info { padding: 0; }
.rate-title { font-weight: 600; font-size: 13px; color: #303133; margin-bottom: 6px; }
.rate-row { display: flex; gap: 24px; font-size: 13px; color: #606266; }
.rate-row b { color: #409EFF; }

.progress-info { display: flex; gap: 32px; margin-bottom: 20px; flex-wrap: wrap; }
.progress-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.progress-label { font-size: 12px; color: #909399; }

.quota-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; background: #f5f7fa; border-radius: 8px;
}
.quota-section { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.quota-title { font-weight: 600; font-size: 14px; color: #303133; }
.quota-item { font-size: 13px; color: #606266; }
.quota-editor {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 16px; margin-top: 8px; background: #fdf6ec; border-radius: 8px;
}
.quota-label { font-size: 13px; color: #606266; }
.progress-log { margin-top: 16px; }
.log-title { font-weight: 600; font-size: 14px; color: #303133; margin-bottom: 8px; }
.log-content {
  background: #1e1e1e; color: #d4d4d4; font-family: Consolas, monospace;
  font-size: 12px; padding: 12px; border-radius: 6px; max-height: 200px;
  overflow-y: auto; white-space: pre-wrap; word-break: break-all; line-height: 1.6;
}

.quota-inline { font-size: 13px; color: #909399; margin-bottom: 8px; }

.upload-progress {
  margin-top: 24px; padding: 20px 40px; background: #f5f7fa; border-radius: 8px;
}

/* Dark Mode Overrides */
:deep(html.dark) {
  .asin-import {
    background: var(--el-bg-color);
  }

  .page-header h2 {
    color: var(--el-text-color-primary);
  }

  .page-desc {
    color: var(--el-text-color-secondary);
  }

  .step-card {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
  }

  .mode-card {
    background: var(--el-bg-color);
    border-color: var(--el-border-color-lighter);

    &.active {
      background: var(--el-fill-color-lighter);
      border-color: var(--el-color-primary);
    }

    h3 {
      color: var(--el-text-color-primary);
    }

    p {
      color: var(--el-text-color-secondary);
    }
  }

  .db-stats {
    background: var(--el-fill-color-lighter);
  }

  .api-params {
    background: var(--el-fill-color-lighter);
  }

  .param-label {
    color: var(--el-text-color-primary);
  }

  .param-hint {
    color: var(--el-text-color-secondary);
  }

  .filter-summary {
    color: var(--el-text-color-regular);
  }

  .preview-table {
    background: var(--el-bg-color);
  }

  .batch-summary {
    background: var(--el-fill-color-lighter);
  }

  .batch-line {
    color: var(--el-text-color-primary);
  }

  .rate-title {
    color: var(--el-text-color-primary);
  }

  .rate-row {
    color: var(--el-text-color-regular);
  }

  .progress-label {
    color: var(--el-text-color-secondary);
  }

  .quota-editor {
    background: var(--el-fill-color-lighter);
  }

  .upload-progress {
    background: var(--el-fill-color-lighter);
  }
}
</style>
910
