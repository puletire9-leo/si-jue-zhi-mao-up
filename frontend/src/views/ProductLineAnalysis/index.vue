<template>
  <div class="product-line-analysis">
    <!-- 页头 -->
    <div class="page-header">
      <h2>品线分析</h2>
      <span class="page-desc">选品 Agent 实时分析 — 输入批次ID启动 LangGraph 9节点分析流程</span>
    </div>

    <!-- 控制面板 -->
    <el-card class="control-card">
      <el-form :inline="true" @submit.prevent="handleStart">
        <el-form-item label="批次ID">
          <el-input
            v-model="batchId"
            placeholder="如: 20260609-001"
            clearable
            style="width: 200px"
            :disabled="isAnalyzing"
          />
        </el-form-item>
        <el-form-item label="站点">
          <el-select v-model="marketplace" :disabled="isAnalyzing" style="width: 100px">
            <el-option label="UK" value="UK" />
            <el-option label="DE" value="DE" />
            <el-option label="US" value="US" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="isAnalyzing"
            :disabled="!batchId.trim()"
            @click="handleStart"
          >
            {{ isAnalyzing ? '分析中...' : '开始分析' }}
          </el-button>
          <el-button v-if="isAnalyzing" type="danger" plain @click="handleStop">
            停止
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 连接状态 -->
      <div v-if="statusMsg" class="status-bar" :class="statusClass">
        <el-icon><Connection /></el-icon>
        <span>{{ statusMsg }}</span>
      </div>
    </el-card>

    <!-- SSE 进度 -->
    <AnalysisProgress ref="progressRef" :total-count="totalCount" />

    <!-- 结果卡片 -->
    <div v-if="results.length > 0" class="results-section">
      <div class="results-header">
        <h3>分析结果</h3>
        <div class="results-summary">
          <el-tag
            v-for="level in resultLevelCounts"
            :key="level.label"
            :type="level.type"
            size="small"
            effect="plain"
          >
            {{ level.label }}: {{ level.count }}
          </el-tag>
          <span v-if="completeData" class="elapsed-text">
            总耗时: {{ formatMs(completeData.total_elapsed_ms as number) }}
          </span>
        </div>
      </div>
      <el-row :gutter="12">
        <el-col
          v-for="item in results"
          :key="item.nodeId || item.nodeName"
          :xs="24"
          :sm="12"
          :md="8"
        >
          <AnalysisResultCard :item="item" />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import AnalysisProgress from './components/AnalysisProgress.vue'
import AnalysisResultCard from './components/AnalysisResultCard.vue'
import {
  startProductLineAnalysis,
  type SSEEventType,
  type AnalysisCompleteEvent,
} from '@/api/productLineAnalysis'

// ── 表单 ──
const batchId = ref('')
const marketplace = ref('UK')

// ── 状态 ──
const isAnalyzing = ref(false)
const statusMsg = ref('')
const statusClass = ref('')
const totalCount = ref(0)
const completeData = ref<AnalysisCompleteEvent | null>(null)

interface ResultItem {
  nodeId: string
  bsrId: string
  nodeName: string
  recommendLevel: string
  opportunityScore: number
  analysisReport: Record<string, unknown>
  confidence: number
  errors: string[]
}
const results = ref<ResultItem[]>([])

const progressRef = ref<InstanceType<typeof AnalysisProgress> | null>(null)

let eventSource: EventSource | null = null

// ── 结果统计 ──
const resultLevelCounts = computed(() => {
  const counts: Record<string, number> = {}
  results.value.forEach((r) => {
    const level = r.recommendLevel || 'UNKNOWN'
    counts[level] = (counts[level] || 0) + 1
  })
  const typeMap: Record<string, string> = {
    STRONGLY_RECOMMEND: 'success',
    RECOMMEND: '',
    WATCH: 'warning',
    AVOID: 'danger',
    NO_GO: 'danger',
  }
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    type: (typeMap[label] || 'info') as 'success' | '' | 'warning' | 'danger' | 'info',
  }))
})

function formatMs(ms: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ── 启动分析 ──
function handleStart() {
  if (!batchId.value.trim()) return
  if (isAnalyzing.value) return

  isAnalyzing.value = true
  results.value = []
  completeData.value = null
  totalCount.value = 0
  statusMsg.value = '正在建立 SSE 连接...'
  statusClass.value = 'connecting'

  progressRef.value?.reset()

  eventSource = startProductLineAnalysis(
    batchId.value.trim(),
    marketplace.value,
    handleSSEEvent,
    handleError,
    handleConnectionClose,
  )
}

function handleStop() {
  eventSource?.close()
  eventSource = null
  isAnalyzing.value = false
  statusMsg.value = '分析已手动停止'
  statusClass.value = 'error'
}

// ── SSE 事件处理 ──
function handleSSEEvent(event: SSEEventType, data: Record<string, unknown>) {
  // 转发给进度组件
  progressRef.value?.handleSSEEvent(event, data)

  switch (event) {
    case 'start':
      statusMsg.value = '分析已启动，等待数据...'
      statusClass.value = 'running'
      break

    case 'data_ready':
      totalCount.value = data.total_sub_categories as number
      statusMsg.value = `数据就绪: ${data.total_sub_categories} 个小类`
      break

    case 'sub_start':
      statusMsg.value = `正在分析 ${data.nodeName} (${data.index}/${data.total})`
      statusClass.value = 'running'
      break

    case 'progress':
      statusMsg.value = `${data.display} — ${data.nodeName}`
      break

    case 'heartbeat':
      // 静默
      break

    case 'sub_complete':
      // 收集结果
      results.value.push({
        nodeId: (data.nodeId as string) || '',
        bsrId: '',
        nodeName: data.nodeName as string,
        recommendLevel: data.recommendLevel as string,
        opportunityScore: data.opportunityScore as number,
        analysisReport: {},
        confidence: 0,
        errors: [],
      })
      break

    case 'writeback':
      statusMsg.value = '回写数据库...'
      break

    case 'complete':
      completeData.value = data as unknown as AnalysisCompleteEvent
      isAnalyzing.value = false
      statusMsg.value = `分析完成 — ${data.total_sub_categories} 小类, ${data.errors_count} 错误`
      statusClass.value = data.errors_count > 0 ? 'warning' : 'success'
      // 用完整结果替换简要结果
      if (data.results_summary && Array.isArray(data.results_summary)) {
        const summary = data.results_summary as Array<Record<string, unknown>>
        results.value = summary.map((r) => ({
          nodeId: (r.nodeId as string) || '',
          bsrId: '',
          nodeName: r.nodeName as string,
          recommendLevel: r.recommendLevel as string,
          opportunityScore: r.opportunityScore as number,
          analysisReport: (r.analysisReport as Record<string, unknown>) || {},
          confidence: (r.confidence as number) || 0,
          errors: (r.errors as string[]) || [],
        }))
      }
      break

    case 'error':
      isAnalyzing.value = false
      statusMsg.value = `分析出错: ${data.error}`
      statusClass.value = 'error'
      ElMessage.error(`分析出错: ${data.error}`)
      break
  }
}

function handleError(_e: Event) {
  isAnalyzing.value = false
  statusMsg.value = 'SSE 连接中断，请检查 Agent 服务是否正常运行'
  statusClass.value = 'error'
  ElMessage.error('SSE 连接中断')
}

function handleConnectionClose() {
  eventSource = null
  // isAnalyzing 由 complete/error 事件控制
}

onBeforeUnmount(() => {
  eventSource?.close()
})
</script>

<style scoped>
.product-line-analysis {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.page-desc {
  color: #909399;
  font-size: 13px;
}

.control-card {
  margin-bottom: 4px;
}

.control-card :deep(.el-form-item) {
  margin-bottom: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 8px;
}

.status-bar.connecting {
  background: #ecf5ff;
  color: #409eff;
}
.status-bar.running {
  background: #f0f9eb;
  color: #67c23a;
}
.status-bar.success {
  background: #f0f9eb;
  color: #67c23a;
}
.status-bar.warning {
  background: #fdf6ec;
  color: #e6a23c;
}
.status-bar.error {
  background: #fef0f0;
  color: #f56c6c;
}

.results-section {
  margin-top: 20px;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.results-header h3 {
  margin: 0;
  font-size: 16px;
}

.results-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.elapsed-text {
  font-size: 12px;
  color: #909399;
}
</style>
