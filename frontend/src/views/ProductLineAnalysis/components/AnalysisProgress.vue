<template>
  <div class="analysis-progress">
    <!-- 整体进度条 -->
    <div class="overall-progress">
      <div class="progress-header">
        <span class="progress-title">分析进度</span>
        <span class="progress-count">{{ currentIndex }} / {{ totalCount }} 小类</span>
        <el-tag v-if="isRunning" type="warning" size="small">运行中</el-tag>
        <el-tag v-else-if="isComplete" type="success" size="small">已完成</el-tag>
        <el-tag v-else-if="hasError" type="danger" size="small">出错</el-tag>
      </div>
      <el-progress
        :percentage="totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0"
        :status="isComplete ? 'success' : hasError ? 'exception' : ''"
        :stroke-width="12"
      />
    </div>

    <!-- 当前小类节点进度 -->
    <div v-if="currentSubName" class="sub-progress">
      <div class="sub-header">
        <el-icon><DataAnalysis /></el-icon>
        <span>当前: <b>{{ currentSubName }}</b></span>
        <span class="sub-elapsed">耗时: {{ formatMs(currentSubElapsed) }}</span>
      </div>
      <div class="node-steps">
        <div
          v-for="node in nodeOrder"
          :key="node.key"
          class="node-step"
          :class="getNodeStatus(node.key)"
        >
          <div class="node-dot" />
          <span class="node-label">{{ node.label }}</span>
        </div>
      </div>
    </div>

    <!-- 实时日志流 -->
    <div v-if="logs.length > 0" class="log-stream">
      <div class="log-header" @click="logExpanded = !logExpanded">
        <el-icon><Document /></el-icon>
        <span>实时日志 ({{ logs.length }})</span>
        <el-icon class="expand-icon" :class="{ expanded: logExpanded }">
          <ArrowDown />
        </el-icon>
      </div>
      <div v-show="logExpanded" class="log-body" ref="logBodyRef">
        <div
          v-for="(log, i) in logs.slice(-100)"
          :key="i"
          class="log-line"
          :class="log.level"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-msg">{{ log.msg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import type { SSEEventType } from '@/api/productLineAnalysis'

const props = defineProps<{
  totalCount: number
}>()

// ── 状态 ──
const currentIndex = ref(0)
const currentSubName = ref('')
const currentSubElapsed = ref(0)
const isRunning = ref(false)
const isComplete = ref(false)
const hasError = ref(false)
const completedNodes = ref<Set<string>>(new Set())
const logExpanded = ref(true)
const logBodyRef = ref<HTMLElement | null>(null)

interface LogEntry {
  time: string
  msg: string
  level: 'info' | 'error' | 'warn'
}
const logs = ref<LogEntry[]>([])

// ── 节点顺序 ──
const nodeOrder = [
  { key: 'semantic_understanding', label: '语义理解' },
  { key: 'competition_analysis', label: '竞争格局' },
  { key: 'lifecycle_judgment', label: '生命周期' },
  { key: 'profit_estimation', label: '利润推算' },
  { key: 'differentiation_full', label: '差异化(全)' },
  { key: 'differentiation_quick', label: '差异化(快)' },
  { key: 'risk_radar', label: '风险雷达' },
  { key: 'cross_line_discovery', label: '跨品线' },
  { key: 'final_verdict', label: '最终裁决' },
]

function nowStr(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function addLog(msg: string, level: LogEntry['level'] = 'info') {
  logs.value.push({ time: nowStr(), msg, level })
  nextTick(() => {
    if (logBodyRef.value) {
      logBodyRef.value.scrollTop = logBodyRef.value.scrollHeight
    }
  })
}

function getNodeStatus(nodeKey: string): string {
  if (completedNodes.value.has(nodeKey)) return 'done'
  // 判断是否为当前正在执行的节点
  return 'pending'
}

// ── 对外暴露事件处理方法 ──
function handleSSEEvent(event: SSEEventType, data: Record<string, unknown>) {
  switch (event) {
    case 'start':
      isRunning.value = true
      isComplete.value = false
      hasError.value = false
      currentIndex.value = 0
      logs.value = []
      addLog(`分析启动 — 批次: ${data.batch_id}, 站点: ${data.marketplace}`)
      break

    case 'data_ready':
      addLog(`数据就绪 — ${data.total_sub_categories} 个小类待分析`)
      break

    case 'sub_start':
      currentIndex.value = data.index as number
      currentSubName.value = data.nodeName as string
      currentSubElapsed.value = 0
      completedNodes.value = new Set()
      addLog(`[${data.index}/${data.total}] 开始分析: ${data.nodeName}`)
      break

    case 'progress':
      completedNodes.value.add(data.node as string)
      currentSubElapsed.value = data.elapsed_ms as number
      if (data.node === 'semantic_understanding') {
        addLog(`✓ ${data.display} — 原型: ${data.archetype || '?'}`)
      } else if (data.node === 'profit_estimation') {
        addLog(`✓ ${data.display} — 利润率: ${data.margin || 0}%`)
      } else if (data.node === 'risk_radar') {
        addLog(`✓ ${data.display} — Go/NoGo: ${data.goNoGo || '?'}`)
      } else if (data.node === 'final_verdict') {
        addLog(`✓ ${data.display} — 推荐: ${data.recommendLevel || '?'} / 分数: ${data.opportunityScore || 0}`)
      } else {
        addLog(`✓ ${data.display}`)
      }
      break

    case 'node_error':
      addLog(`✗ ${data.display} 出错: ${data.error}`, 'error')
      break

    case 'sub_complete':
      addLog(`完成 ${data.nodeName} — 推荐: ${data.recommendLevel}, 分数: ${data.opportunityScore}, ${data.errors_count} 错误`)
      break

    case 'heartbeat':
      // 静默，不打日志
      break

    case 'writeback':
      addLog(`正在回写 ${data.results_count} 条结果到数据库...`)
      break

    case 'complete':
      isRunning.value = false
      isComplete.value = true
      currentSubName.value = ''
      addLog(`分析完成 — 共 ${data.total_sub_categories} 小类, 耗时 ${formatMs(data.total_elapsed_ms as number)}, ${data.errors_count} 错误`, 'info')
      break

    case 'error':
      isRunning.value = false
      hasError.value = true
      addLog(`分析出错: ${data.error}`, 'error')
      break
  }
}

function reset() {
  currentIndex.value = 0
  currentSubName.value = ''
  currentSubElapsed.value = 0
  isRunning.value = false
  isComplete.value = false
  hasError.value = false
  completedNodes.value = new Set()
  logs.value = []
}

defineExpose({ handleSSEEvent, reset })
</script>

<style scoped>
.analysis-progress {
  margin-top: 16px;
}

.overall-progress {
  margin-bottom: 16px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.progress-title {
  font-size: 15px;
  font-weight: 600;
}

.progress-count {
  color: #606266;
  font-size: 13px;
}

.sub-progress {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #606266;
}

.sub-elapsed {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.node-steps {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.node-step {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #f0f0f0;
  color: #909399;
  transition: all 0.3s;
}

.node-step.done {
  background: #f0f9eb;
  color: #67c23a;
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c0c4cc;
}

.node-step.done .node-dot {
  background: #67c23a;
}

.log-stream {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fafafa;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.expand-icon {
  margin-left: auto;
  transition: transform 0.2s;
}
.expand-icon.expanded {
  transform: rotate(180deg);
}

.log-body {
  max-height: 240px;
  overflow-y: auto;
  padding: 8px 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.log-line {
  display: flex;
  gap: 8px;
}
.log-line.error .log-msg {
  color: #f56c6c;
}
.log-line.warn .log-msg {
  color: #e6a23c;
}

.log-time {
  color: #c0c4cc;
  flex-shrink: 0;
}

.log-msg {
  color: #303133;
  word-break: break-all;
}
</style>
