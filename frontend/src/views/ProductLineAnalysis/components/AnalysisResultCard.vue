<template>
  <el-card
    class="result-card"
    :class="levelClass"
    shadow="hover"
    @click="expanded = !expanded"
  >
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="card-title">
        <el-tag :type="levelTagType" size="small" effect="dark">
          {{ recommendLevel }}
        </el-tag>
        <span class="node-name">{{ item.nodeName }}</span>
      </div>
      <div class="card-score">
        <span class="score-value">{{ item.opportunityScore }}</span>
        <span class="score-label">/ 100</span>
      </div>
    </div>

    <!-- 评分条 -->
    <div class="score-bar">
      <el-progress
        :percentage="item.opportunityScore"
        :color="scoreColor"
        :stroke-width="8"
        :show-text="false"
      />
    </div>

    <!-- 关键指标 -->
    <div class="key-metrics">
      <div class="metric">
        <span class="metric-label">置信度</span>
        <span class="metric-value">{{ (item.confidence * 100).toFixed(0) }}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">错误</span>
        <span class="metric-value" :class="{ 'has-errors': item.errors.length > 0 }">
          {{ item.errors.length }}
        </span>
      </div>
      <div class="metric">
        <span class="metric-label">nodeId</span>
        <span class="metric-value mono">{{ item.nodeId || '-' }}</span>
      </div>
    </div>

    <!-- 一句话总结 -->
    <div v-if="oneLinerSummary" class="one-liner">
      <el-icon><InfoFilled /></el-icon>
      <span>{{ oneLinerSummary }}</span>
    </div>

    <!-- 展开详情 -->
    <div v-show="expanded && item.analysisReport" class="detail-section">
      <el-divider />

      <!-- 评分明细 -->
      <div v-if="report" class="detail-block">
        <h4>评分明细</h4>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item
            v-for="(val, key) in scoreBreakdown"
            :key="key"
            :label="scoreLabels[key as string] || key"
          >
            {{ typeof val === 'number' ? val.toFixed(1) : val }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- L1 评分 -->
      <div v-if="report.l1Score" class="detail-block">
        <h4>L1 通用评分 (6维)</h4>
        <div class="score-grid">
          <div v-for="(val, key) in report.l1Score" :key="key" class="score-cell">
            <span class="score-key">{{ l1Labels[key as string] || key }}</span>
            <el-progress
              :percentage="Math.min(100, (val as number) * 10)"
              :stroke-width="6"
              style="width: 80px"
            />
            <span class="score-val">{{ (val as number).toFixed(1) }}</span>
          </div>
        </div>
      </div>

      <!-- LLM 总结 -->
      <div v-if="report.summary || report.llmSummary" class="detail-block">
        <h4>LLM 分析总结</h4>
        <div class="llm-text">{{ report.summary || report.llmSummary }}</div>
      </div>

      <!-- 行动计划 -->
      <div v-if="report.actionPlan" class="detail-block">
        <h4>行动计划</h4>
        <ol class="action-plan">
          <li v-for="(step, i) in (Array.isArray(report.actionPlan) ? report.actionPlan : [report.actionPlan])" :key="i">
            {{ typeof step === 'string' ? step : JSON.stringify(step) }}
          </li>
        </ol>
      </div>

      <!-- 错误列表 -->
      <div v-if="item.errors.length > 0" class="detail-block">
        <h4 style="color: #f56c6c">错误记录</h4>
        <div v-for="(err, i) in item.errors" :key="i" class="error-line">
          {{ err }}
        </div>
      </div>
    </div>

    <!-- 展开提示 -->
    <div class="expand-hint">
      {{ expanded ? '点击收起' : '点击展开详情' }}
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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

const props = defineProps<{ item: ResultItem }>()
const expanded = ref(false)

const report = computed(() => (props.item.analysisReport || {}) as Record<string, unknown>)

// ── 推荐等级样式 ──
const levelClass = computed(() => {
  const level = props.item.recommendLevel?.toUpperCase()
  if (level === 'STRONGLY_RECOMMEND') return 'level-strong-buy'
  if (level === 'RECOMMEND') return 'level-recommend'
  if (level === 'WATCH') return 'level-watch'
  if (level === 'AVOID' || level === 'NO_GO') return 'level-avoid'
  return ''
})

const levelTagType = computed(() => {
  const level = props.item.recommendLevel?.toUpperCase()
  if (level === 'STRONGLY_RECOMMEND') return 'success'
  if (level === 'RECOMMEND') return ''
  if (level === 'WATCH') return 'warning'
  if (level === 'AVOID' || level === 'NO_GO') return 'danger'
  return 'info'
})

const scoreColor = computed(() => {
  const score = props.item.opportunityScore
  if (score >= 75) return '#67c23a'
  if (score >= 60) return '#409eff'
  if (score >= 40) return '#e6a23c'
  return '#f56c6c'
})

// ── 一句话总结 ──
const oneLinerSummary = computed(() => {
  const r = report.value
  if (r.oneLiner) return r.oneLiner as string
  if (r.summary && typeof r.summary === 'string' && r.summary.length < 100) return r.summary
  return ''
})

// ── 评分明细 ──
const scoreBreakdown = computed(() => {
  const r = report.value
  return (r.scoreBreakdown || r.l2Score || {}) as Record<string, unknown>
})

const scoreLabels: Record<string, string> = {
  marketCapacity: '市场容量',
  competitionIntensity: '竞争强度',
  priceOpportunity: '价格机会',
  profitMargin: '利润率',
  lifecycle: '生命周期',
  trendMomentum: '趋势动能',
  supplyBarrier: '供应壁垒',
  complianceRisk: '合规风险',
  total: '总分',
}

const l1Labels: Record<string, string> = {
  marketSize: '市场规模',
  competition: '竞争格局',
  profitPotential: '利润潜力',
  trendStrength: '趋势强度',
  barrierLevel: '进入壁垒',
  riskLevel: '风险水平',
}
</script>

<style scoped>
.result-card {
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.result-card:hover {
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-name {
  font-size: 15px;
  font-weight: 600;
}

.card-score {
  text-align: right;
}

.score-value {
  font-size: 24px;
  font-weight: 700;
}

.score-label {
  font-size: 12px;
  color: #909399;
}

.score-bar {
  margin-bottom: 10px;
}

.key-metrics {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 11px;
  color: #909399;
}

.metric-value {
  font-size: 13px;
  font-weight: 500;
}

.metric-value.mono {
  font-family: monospace;
  font-size: 12px;
}

.metric-value.has-errors {
  color: #f56c6c;
}

.one-liner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  background: #ecf5ff;
  border-radius: 4px;
  font-size: 13px;
  color: #409eff;
  margin-bottom: 4px;
}

.expand-hint {
  text-align: center;
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}

.detail-section {
  margin-top: 4px;
}

.detail-block {
  margin-bottom: 12px;
}

.detail-block h4 {
  font-size: 13px;
  margin-bottom: 8px;
  color: #303133;
}

.score-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.score-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.score-key {
  min-width: 60px;
  color: #606266;
}

.score-val {
  font-weight: 600;
  min-width: 30px;
  text-align: right;
}

.llm-text {
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
  white-space: pre-wrap;
}

.action-plan {
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
}

.error-line {
  font-size: 12px;
  color: #f56c6c;
  padding: 2px 0;
  font-family: monospace;
}

/* 推荐等级边框色 */
.level-strong-buy { border-left: 3px solid #67c23a; }
.level-recommend  { border-left: 3px solid #409eff; }
.level-watch      { border-left: 3px solid #e6a23c; }
.level-avoid      { border-left: 3px solid #f56c6c; }
</style>
