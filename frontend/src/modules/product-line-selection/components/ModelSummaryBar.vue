<template>
  <div class="model-summary-bar" v-loading="loading">
    <!-- 折叠态: 单行摘要 -->
    <div v-if="!expanded" class="summary-row" @click="expanded = true">
      <span class="health-badge" :class="healthClass">
        <span class="health-dot"></span>
        {{ healthLabel }}
      </span>
      <span class="summary-text">{{ summaryLine }}</span>
      <span class="expand-icon">▸ 展开</span>
    </div>

    <!-- 展开态: 完整模型详情 -->
    <div v-else class="model-detail">
      <!-- 标题栏 -->
      <div class="detail-header" @click="expanded = false">
        <span class="health-badge" :class="healthClass">
          <span class="health-dot"></span>
          {{ healthLabel }}
        </span>
        <span class="detail-title">品线模型详情</span>
        <span v-if="modelData?.nodeName" class="detail-subtitle">— {{ modelData.nodeName }}</span>
        <span class="expand-icon">▼ 收起</span>
      </div>

      <!-- 健康度 + 质量基准 -->
      <div class="detail-section health-section">
        <div class="section-row">
          <span class="health-score" :style="{ color: healthColor }">{{ healthScore }}</span>
          <span class="health-reason">{{ modelData?.healthReason || '品类信号分布健康' }}</span>
        </div>
        <div class="metrics-row">
          <div class="metric-item">
            <span class="metric-label">BSR P50</span>
            <span class="metric-value">{{ qbDisplay.bsrP50 }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">最低评分</span>
            <span class="metric-value">≥{{ qbDisplay.ratingMin }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">中位重量</span>
            <span class="metric-value">{{ qbDisplay.weightMedian }}g</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">FBA占比</span>
            <span class="metric-value">{{ qbDisplay.fbaMedian }}%</span>
          </div>
          <template v-if="hasPrice">
            <div class="metric-item">
              <span class="metric-label">价格区间</span>
              <span class="metric-value">£{{ priceDisplay.min }}–£{{ priceDisplay.max }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">甜蜜点占比</span>
              <span class="metric-value">{{ priceDisplay.sweetSpot }}%</span>
            </div>
          </template>
        </div>
      </div>

      <!-- 搜索关键词 -->
      <div class="detail-section keyword-section" v-if="keywordList.length">
        <span class="section-label">搜索关键词</span>
        <div class="keyword-tags">
          <el-tag
            v-for="kw in keywordList"
            :key="kw"
            size="small"
            @click="applyKeyword(kw)"
          >{{ kw }}</el-tag>
        </div>
      </div>

      <!-- 子组件 -->
      <ElementTagCloud v-if="elementsData.length" :elements="elementsData" />
      <CarrierGrid v-if="carrierData.length" :carriers="carrierData" />
      <ComboCards v-if="comboData.length" :combos="comboData" />

      <!-- 元素饱和度 -->
      <ModelCard title="元素饱和度" :expanded="false">
        <div v-if="elementSaturation?.length" class="sat-list">
          <div v-for="s in elementSaturation" :key="s.element" class="sat-item">
            <span class="sat-name">{{ s.element }}</span>
            <span class="sat-freq">{{ s.frequency }}次</span>
            <span class="sat-tag" :class="s.saturation">{{ saturationLabel(s.saturation) }}</span>
            <span class="sat-insight">{{ s.insight }}</span>
          </div>
        </div>
        <div v-else class="empty-text">暂无饱和度数据</div>
      </ModelCard>

      <!-- 价格空白 -->
      <ModelCard title="价格空白" :expanded="false">
        <div v-if="priceGaps?.length" class="gap-list">
          <div v-for="g in priceGaps" :key="g.range" class="gap-item">
            <span class="gap-range">{{ g.range }}</span>
            <span class="gap-opp">{{ g.opportunity }}</span>
          </div>
        </div>
        <div v-else class="empty-text">暂无价格空白数据</div>
      </ModelCard>

      <!-- 好品清单 -->
      <ModelCard title="好品清单" subtitle="已验证高潜力产品" :expanded="false">
        <el-table v-if="goodProducts.length" :data="goodProducts.slice(0, 20)" stripe size="small" height="320">
          <el-table-column prop="asin" label="ASIN" width="130">
            <template #default="{ row }"><span class="mono">{{ row.asin }}</span></template>
          </el-table-column>
          <el-table-column label="元素" min-width="160">
            <template #default="{ row }">{{ (row.elements || []).slice(0, 3).join(', ') }}</template>
          </el-table-column>
          <el-table-column label="载体" min-width="120">
            <template #default="{ row }">{{ (row.carriers || []).slice(0, 2).join(', ') }}</template>
          </el-table-column>
          <el-table-column label="场景" min-width="140">
            <template #default="{ row }">{{ (row.scenes || []).slice(0, 2).join(', ') }}</template>
          </el-table-column>
          <el-table-column label="搜索词" min-width="160">
            <template #default="{ row }">
              <span class="tags">{{ (row.keywordsEn || []).slice(0, 2).join(', ') }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="empty-text">暂无好品数据</div>
      </ModelCard>

      <!-- 查看完整报告 -->
      <div class="detail-actions">
        <el-button text type="primary" size="small" @click="openMdReport">
          查看完整分析报告
        </el-button>
      </div>
    </div>
  </div>

  <!-- MD 报告弹窗 -->
  <el-dialog v-model="mdDialogVisible" title="品线模型分析报告" width="80%" top="5vh">
    <div v-loading="mdLoading" class="md-content" v-html="sanitizedMd" /><!-- FIXED: HIGH-3 -->
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'  // FIXED: HIGH-3
import { useProductLineSelectionStore } from '../store'
import { getModelMd } from '@/api/product-line'
import { healthScoreMap, healthColorMap, saturationLabel } from '../composables/useModelDisplay'  // FIXED: MED-1
import type { ProductLineModelData } from '@/types/productLine'
import ElementTagCloud from './ElementTagCloud.vue'
import type { ProvenElement as TagCloudElement } from './ElementTagCloud.vue'
import CarrierGrid from './CarrierGrid.vue'
import type { CarrierItem } from './CarrierGrid.vue'
import ComboCards from './ComboCards.vue'
import type { ComboItem } from './ComboCards.vue'

const props = defineProps<{
  modelData: ProductLineModelData | null
  loading: boolean
}>()

const store = useProductLineSelectionStore()
const expanded = ref(false)

// ---- 健康度映射（FIXED: MED-1 — 使用 composable）----

const healthLabelMap: Record<string, string> = {
  healthy: 'healthy',
  stable: 'stable',
  declining: 'declining',
  risky: 'risky',
}

const healthEmojiMap: Record<string, string> = {
  healthy: '🟢',
  stable: '🔵',
  declining: '🟡',
  risky: '🔴',
}

const healthKey = computed(() => {
  return props.modelData?.overallHealth || 'healthy'
})

const healthLabel = computed(() => {
  const h = healthKey.value
  const emoji = healthEmojiMap[h] || '🟢'
  const label = healthLabelMap[h] || 'healthy'
  const score = healthScoreMap[h] ?? 85
  return `${emoji} ${label} ${score}`
})

const healthClass = computed(() => healthKey.value)

const healthColor = computed(() => healthColorMap[healthKey.value] ?? '#059669')

const healthScore = computed(() => healthScoreMap[healthKey.value] ?? 85)

// ---- 质量基准展示 ----
const qbDisplay = computed(() => {
  const qb = props.modelData?.qualityBenchmark
  return {
    bsrP50: qb?.bsr_p50?.toLocaleString() ?? '—',
    ratingMin: qb?.rating_min ?? '—',
    weightMedian: qb?.weight_g_median ?? '—',
    fbaMedian: qb?.fba_median ?? '—',
  }
})

const hasPrice = computed(() => {
  const pb = props.modelData?.priceBand
  return !!(pb?.min != null || pb?.max != null)
})

const priceDisplay = computed(() => {
  const pb = props.modelData?.priceBand
  return {
    min: pb?.min?.toFixed(2) ?? '—',
    max: pb?.max?.toFixed(2) ?? '—',
    sweetSpot: pb?.sweet_spot_ratio != null ? Math.round(pb.sweet_spot_ratio * 100) : '—',
  }
})

// ---- 摘要行 ----
const summaryLine = computed(() => {
  const data = props.modelData
  if (!data) return '暂无模型数据'

  const reason = data.healthReason || '品类信号分布健康'
  const qb = data.qualityBenchmark
  const pb = data.priceBand
  const parts: string[] = [reason]

  if (qb?.bsr_p50 != null) {
    parts.push(`BSR P50: ${qb.bsr_p50.toLocaleString()}`)
  }
  if (qb?.rating_min != null) {
    parts.push(`评分≥${qb.rating_min}`)
  }
  if (qb?.weight_g_median != null) {
    parts.push(`重量≤${qb.weight_g_median}g`)
  }
  if (pb?.min != null && pb?.max != null) {
    parts.push(`£${pb.min.toFixed(2)}–${pb.max.toFixed(2)}`)
  }

  return parts.join(' | ')
})

// ---- 搜索关键词（展平 en + cn） ----
const keywordList = computed<string[]>(() => {
  const kw = props.modelData?.searchKeywords
  if (!kw) return []
  const all: string[] = []
  if (Array.isArray(kw.en)) all.push(...kw.en)
  if (Array.isArray(kw.cn)) all.push(...kw.cn)
  return all
})

function applyKeyword(kw: string) {
  store.addFilter('keyword', kw, kw, '搜索关键词')
  store.searchCompetitors()
}

// ---- 子组件数据转换 ----
const elementsData = computed<TagCloudElement[]>(() => {
  const raw = props.modelData?.provenElements
  if (!raw) return []
  return raw.map((el) => {
    const tags: string[] = el.signalTags || []
    let trend: TagCloudElement['trend'] = 'normal'
    if (tags.some(t => /BURST/i.test(t))) trend = 'hot'
    else if (tags.some(t => /RISING/i.test(t))) trend = 'rising'
    return { name: el.name, frequency: el.frequency, carriers: el.carriers, signalTags: tags, insight: el.insight, trend }
  })
})

const carrierData = computed<CarrierItem[]>(() => {
  const raw = props.modelData?.carrierDetail
  if (!raw) return []
  return raw.map((c) => ({
    name: c.name,
    count: c.count,
    avg_price: c.avg_price,
    avg_weight_g: c.avg_weight_g,
    avg_fba: c.avg_fba,
    variant_strategy: c.variant_strategy,
    lightweight: c.lightweight,
  }))
})

const comboData = computed<ComboItem[]>(() => {
  const raw = props.modelData?.recommendedCombos
  if (!raw) return []
  return raw.map((c) => ({
    elements: c.elements,
    carriers: c.carriers,
    scenes: c.scenes,
    keywordsEn: c.keywordsEn,
    keywordsCn: c.keywordsCn,
    heat: c.heat,
    reason: c.reason,
  }))
})

// ---- 元素饱和度 / 价格空白 / 好品清单（FIXED: MED-1 — saturationLabel 来自 composable）----
const elementSaturation = computed(() => props.modelData?.elementSaturation ?? null)
const priceGaps = computed(() => props.modelData?.priceGaps ?? null)
const goodProducts = computed<any[]>(() => props.modelData?.goodProducts ?? [])

// ---- 查看完整 MD 报告 ----
const mdDialogVisible = ref(false)
const mdLoading = ref(false)
const mdContent = ref('')

const renderedMd = computed(() => {
  if (!mdContent.value) return ''
  return marked.parse(mdContent.value) as string
})

// FIXED: HIGH-3 — DOMPurify 过滤 XSS
const sanitizedMd = computed(() => DOMPurify.sanitize(renderedMd.value))

async function openMdReport() {
  const nodeId = props.modelData?.nodeId
  if (!nodeId) return
  mdLoading.value = true
  try {
    const res = await getModelMd(nodeId, store.marketplace)
    mdContent.value = res?.data?.markdown ?? '暂无报告内容'
    mdDialogVisible.value = true
  } catch {
    mdContent.value = '加载报告失败'
    mdDialogVisible.value = true
  } finally {
    mdLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.model-summary-bar {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-color;
  overflow: hidden;
  transition: all $transition-base;
}

// ---- 折叠态 ----
.summary-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background $transition-fast;
  user-select: none;

  &:hover {
    background: $bg-hover;
  }
}

.summary-text {
  flex: 1;
  font-size: 13px;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-icon {
  font-size: 12px;
  color: $text-tertiary;
  white-space: nowrap;
  flex-shrink: 0;
}

// ---- 健康徽章 ----
.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: $radius-full;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;

  .health-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &.healthy {
    background: rgba(#059669, 0.08);
    color: #059669;
  }
  &.stable {
    background: rgba(#0891b2, 0.08);
    color: #0891b2;
  }
  &.declining {
    background: rgba(#ca8a04, 0.08);
    color: #ca8a04;
  }
  &.risky {
    background: rgba(#dc2626, 0.08);
    color: #dc2626;
  }
}

// ---- 展开态 ----
.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;
  cursor: pointer;
  transition: background $transition-fast;
  user-select: none;

  &:hover {
    background: $bg-hover;
  }
}

.detail-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
}

.detail-subtitle {
  font-size: 13px;
  color: $text-tertiary;
  flex: 1;
}

.detail-section {
  padding: 12px 16px;
  border-bottom: 1px solid $border-color;

  &:last-of-type {
    border-bottom: none;
  }
}

// ---- 健康度区块 ----
.section-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.health-score {
  font-size: 20px;
  font-weight: 700;
  font-family: $font-family-mono;
  flex-shrink: 0;
}

.health-reason {
  font-size: 13px;
  color: $text-secondary;
}

.metrics-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 11px;
  color: $text-tertiary;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  font-family: $font-family-mono;
  color: $text-primary;
}

// ---- 搜索关键词 ----
.keyword-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: $text-tertiary;
  flex-shrink: 0;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

// ---- 操作按钮 ----
.detail-actions {
  padding: 10px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid $border-color;
}

// ---- MD 报告弹窗 ----
.md-content {
  padding: 8px 0;
  font-size: 14px;
  line-height: 1.7;
  color: $text-primary;
  h1, h2, h3, h4 { margin-top: 1.2em; margin-bottom: 0.6em; color: $text-primary; }
  h1 { font-size: 1.6em; border-bottom: 1px solid $border-color; padding-bottom: 8px; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.1em; }
  p { margin: 0.6em 0; }
  code { background: $bg-hover; padding: 2px 6px; border-radius: $radius-sm; font-size: 13px; }
  pre { background: $bg-hover; padding: 12px; border-radius: $radius-md; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid $border-color; padding: 6px 12px; text-align: left; font-size: 13px; }
  th { background: $bg-hover; font-weight: 600; }
  ul, ol { padding-left: 20px; margin: 0.4em 0; }
  li { margin: 0.2em 0; }
  blockquote { border-left: 3px solid $primary-color; padding-left: 12px; color: $text-secondary; margin: 12px 0; }
}

// ---- 元素饱和度 / 价格空白 / 好品清单 ----
.sat-list { display: flex; flex-direction: column; gap: 8px; }
.sat-item { display: flex; align-items: center; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid $border-color; &:last-child { border-bottom: none; } }
.sat-name { font-weight: 600; min-width: 100px; }
.sat-freq { color: $text-tertiary; min-width: 40px; }
.sat-tag { display: inline-block; padding: 1px 8px; border-radius: $radius-sm; font-size: 11px; font-weight: 600; }
.sat-tag.high { background: rgba($danger-color, 0.08); color: $danger-color; }
.sat-tag.medium { background: rgba($warning-color, 0.08); color: $warning-color; }
.sat-tag.low { background: rgba($success-color, 0.08); color: $success-color; }
.sat-insight { color: $text-secondary; flex: 1; }
.gap-list { display: flex; flex-direction: column; gap: 8px; }
.gap-item { display: flex; align-items: center; gap: 12px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid $border-color; &:last-child { border-bottom: none; } }
.gap-range { font-weight: 600; min-width: 120px; font-family: $font-family-mono; }
.gap-opp { color: $text-secondary; flex: 1; }
.mono { font-family: $font-family-mono; font-size: 12px; }
.tags { color: $text-secondary; font-size: 12px; }
.empty-text { font-size: 12px; color: $text-tertiary; padding: 12px 0; text-align: center; }
</style>
