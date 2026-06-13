<template>
  <div class="model-panel" v-loading="store.modelLoading">
    <!-- 空状态 -->
    <div v-if="!store.selectedNodeId" class="model-empty">
      <div class="empty-icon">↖</div>
      <div class="empty-hint">选择左侧品线查看模型</div>
      <div class="empty-sub">点击已分析的子类节点加载品线模型数据</div>
    </div>

    <!-- 模型内容 -->
    <template v-else>
      <!-- 健康度横幅 -->
      <div class="health-banner">
        <div class="health-ring" :class="store.selectedNodeHealth" :style="healthRingStyle">
          {{ healthDisplay.score }}
        </div>
        <div class="health-info">
          <h3>{{ store.selectedNodeName }}</h3>
          <p>{{ healthDisplay.reason || '正在分析品类健康状态…' }}</p>
          <div class="metrics">
            <div class="metric">BSR P50 <strong>{{ healthDisplay.bsrP50 }}</strong></div>
            <div class="metric">最低评分 <strong>{{ healthDisplay.ratingMin }}</strong></div>
            <div class="metric">中位重量 <strong>{{ healthDisplay.weightMedian }}g</strong></div>
            <div class="metric">FBA 占比 <strong>{{ healthDisplay.fbaMedian }}%</strong></div>
          </div>
          <div class="metrics" v-if="healthDisplay.hasPrice">
            <div class="metric">价格区间 <strong>{{ healthDisplay.priceMin }}–{{ healthDisplay.priceMax }}</strong></div>
            <div class="metric">均价 <strong>{{ healthDisplay.priceAvg }}</strong></div>
            <div class="metric">甜蜜点 <strong>{{ healthDisplay.sweetSpot }}%</strong></div>
          </div>
          <div class="health-actions">
            <el-button text type="primary" size="small" :loading="mdLoading" @click="openMdReport">
              查看完整分析报告
            </el-button>
          </div>
        </div>
      </div>

      <!-- 搜索关键词 -->
      <ModelCard title="搜索关键词" :expanded="true">
        <div class="kw-section">
          <div class="kw-group" v-if="searchKeywords?.en?.length">
            <span class="kw-label">EN</span>
            <span v-for="kw in searchKeywords.en" :key="kw" class="kw-tag" title="点击复制" @click="copyText(kw)">{{ kw }}</span>
          </div>
          <div class="kw-group" v-if="searchKeywords?.cn?.length">
            <span class="kw-label">CN</span>
            <span v-for="kw in searchKeywords.cn" :key="kw" class="kw-tag" title="点击复制" @click="copyText(kw)">{{ kw }}</span>
          </div>
          <div v-if="!searchKeywords?.en?.length && !searchKeywords?.cn?.length" class="empty-text">暂无搜索关键词</div>
        </div>
      </ModelCard>

      <!-- 已验证元素 -->
      <ElementTagCloud :elements="provenElements" />

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

      <!-- 载体画像 -->
      <CarrierGrid :carriers="carrierDetails" />

      <!-- 推荐组合 -->
      <ComboCards :combos="recommendedCombos" />

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
    </template>

    <!-- MD 报告弹窗 -->
    <el-dialog
      v-model="mdDialogVisible"
      title="品线分析报告"
      width="800px"
      top="5vh"
      destroy-on-close
    >
      <div class="md-content" v-html="sanitizedMd" /><!-- FIXED: HIGH-3 -->
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'  // FIXED: HIGH-3
import { useProductLineSelectionStore } from '../store'
import { getModelMd } from '@/api/product-line'
import { healthScoreMap, healthColorMap, saturationLabel } from '../composables/useModelDisplay'  // FIXED: MED-1
import ModelCard from './ModelCard.vue'
import ElementTagCloud from './ElementTagCloud.vue'
import type { ProvenElement } from './ElementTagCloud.vue'
import CarrierGrid from './CarrierGrid.vue'
import type { CarrierItem } from './CarrierGrid.vue'
import ComboCards from './ComboCards.vue'
import type { ComboItem } from './ComboCards.vue'

const store = useProductLineSelectionStore()

// ---- 健康度映射（FIXED: MED-1 — 使用 composable）----

const healthDisplay = computed(() => {
  const data = store.modelData
  const health = data?.overallHealth || store.selectedNodeHealth
  const score = data?.overallHealth
    ? (healthScoreMap[health] ?? 50)
    : (healthScoreMap[store.selectedNodeHealth] ?? 50)
  const qb = data?.qualityBenchmark
  const pb = data?.priceBand
  return {
    score,
    reason: data?.healthReason || '',
    bsrP50: qb?.bsr_p50 ?? '—',
    ratingMin: qb?.rating_min ?? '—',
    weightMedian: qb?.weight_g_median ?? '—',
    fbaMedian: qb?.fba_median ?? '—',
    hasPrice: !!(pb?.min || pb?.max),
    priceMin: pb?.min != null ? `£${pb.min}` : '—',
    priceMax: pb?.max != null ? `£${pb.max}` : '—',
    priceAvg: pb?.avg != null ? `£${pb.avg}` : '—',
    sweetSpot: pb?.sweet_spot_ratio != null ? Math.round(pb.sweet_spot_ratio * 100) : '—',
  }
})

const healthRingStyle = computed(() => {
  const data = store.modelData
  const health = data?.overallHealth || store.selectedNodeHealth
  const s = healthDisplay.value.score
  const color = healthColorMap[health] ?? '#059669'
  const deg = (s / 100) * 360
  return {
    background: `conic-gradient(${color} 0deg, ${color} ${deg}deg, #e5e1da ${deg}deg 360deg)`,
    color,
  }
})

// ---- 从 store 读取真实数据 ----
const provenElements = computed<ProvenElement[]>(() => {
  const raw = store.modelData?.provenElements
  if (!raw) return []
  return raw.map((el) => {
    const tags: string[] = el.signalTags || []
    let trend: ProvenElement['trend'] = 'normal'
    if (tags.some(t => /BURST/i.test(t))) trend = 'hot'
    else if (tags.some(t => /RISING/i.test(t))) trend = 'rising'
    return { name: el.name, frequency: el.frequency, carriers: el.carriers, signalTags: tags, insight: el.insight, trend }
  })
})

const carrierDetails = computed<CarrierItem[]>(() => {
  const raw = store.modelData?.carrierDetail
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

const recommendedCombos = computed<ComboItem[]>(() => {
  const raw = store.modelData?.recommendedCombos
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

// ---- 搜索关键词 ----
const searchKeywords = computed(() => store.modelData?.searchKeywords ?? null)

// ---- 元素饱和度（FIXED: MED-1 — saturationLabel 来自 composable）----
const elementSaturation = computed(() => store.modelData?.elementSaturation ?? null)

// ---- 价格空白 ----
const priceGaps = computed(() => store.modelData?.priceGaps ?? null)

// ---- 好品清单 ----
const goodProducts = computed(() => store.modelData?.goodProducts ?? [])

// ---- 复制工具 ----
function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(`已复制: ${text}`)
  }).catch(() => {
    ElMessage.info(text)
  })
}

// ---- MD 报告 ----
const mdDialogVisible = ref(false)
const mdContent = ref('')
const mdLoading = ref(false)

const renderedMd = computed(() => {
  if (!mdContent.value) return ''
  return marked.parse(mdContent.value) as string
})

// FIXED: HIGH-3 — DOMPurify 过滤 XSS
const sanitizedMd = computed(() => DOMPurify.sanitize(renderedMd.value))

async function openMdReport() {
  const nodeId = Number(store.selectedNodeId)
  if (!nodeId) return
  mdLoading.value = true
  try {
    const res = await getModelMd(nodeId, store.marketplace)
    mdContent.value = res?.data?.markdown ?? '暂无报告内容'
    mdDialogVisible.value = true
  } catch {
    mdContent.value = '加载分析报告失败'
    mdDialogVisible.value = true
  } finally {
    mdLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.model-panel {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar { width: 6px; background: transparent; }
  &::-webkit-scrollbar-thumb { background: $border-color; border-radius: 3px; }
}

.model-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $text-tertiary;

  .empty-icon { font-size: 48px; opacity: 0.2; }
  .empty-hint { font-size: 15px; }
  .empty-sub { font-size: 13px; opacity: 0.6; }
}

// ---- 健康度横幅 ----
.health-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
}

.health-ring {
  width: 80px; height: 80px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700;
  flex-shrink: 0;
  font-family: $font-family-mono;
}

.health-info {
  h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: $text-primary; }
  p { font-size: 13px; color: $text-secondary; line-height: 1.5; }

  .metrics { display: flex; gap: 20px; margin-top: 10px; }
  .metric { font-size: 12px; color: $text-tertiary; }
  .metric strong { color: $text-primary; font-family: $font-family-mono; }
  .metric strong.up { color: $success-color; }
}

.health-actions { margin-top: 8px; }

// ---- 搜索关键词 ----
.kw-section { display: flex; flex-direction: column; gap: 10px; }
.kw-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.kw-label { font-size: 11px; font-weight: 600; color: $text-tertiary; width: 28px; flex-shrink: 0; }
.kw-tag {
  display: inline-block; padding: 3px 10px; background: $bg-hover; border: 1px solid $border-color;
  border-radius: $radius-md; font-size: 12px; cursor: pointer; transition: all $transition-fast;
  &:hover { border-color: $primary-color; color: $primary-color; background: rgba($primary-color, 0.04); }
}
.empty-text { font-size: 12px; color: $text-tertiary; padding: 12px 0; text-align: center; }

// ---- 元素饱和度 ----
.sat-list { display: flex; flex-direction: column; gap: 8px; }
.sat-item { display: flex; align-items: center; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid $border-color; &:last-child { border-bottom: none; } }
.sat-name { font-weight: 600; min-width: 100px; }
.sat-freq { color: $text-tertiary; min-width: 40px; }
.sat-tag {
  display: inline-block; padding: 1px 8px; border-radius: $radius-sm; font-size: 11px; font-weight: 600;
  &.high { background: rgba($danger-color, 0.08); color: $danger-color; }
  &.medium { background: rgba($warning-color, 0.08); color: $warning-color; }
  &.low { background: rgba($success-color, 0.08); color: $success-color; }
}
.sat-insight { color: $text-secondary; flex: 1; }

// ---- 价格空白 ----
.gap-list { display: flex; flex-direction: column; gap: 6px; }
.gap-item { display: flex; align-items: center; gap: 12px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid $border-color; &:last-child { border-bottom: none; } }
.gap-range { font-weight: 600; color: $primary-color; min-width: 100px; }
.gap-opp { color: $text-secondary; flex: 1; }

// ---- 好品清单 ----
.mono { font-family: $font-family-mono; font-size: 12px; }
.tags { font-size: 12px; color: $text-secondary; }

.md-content {
  font-size: 14px;
  line-height: 1.7;
  color: $text-primary;
  max-height: 70vh;
  overflow-y: auto;

  h1 { font-size: 22px; margin: 20px 0 12px; }
  h2 { font-size: 18px; margin: 16px 0 10px; }
  h3 { font-size: 15px; margin: 12px 0 8px; }
  p { margin: 8px 0; }
  ul, ol { padding-left: 20px; }
  li { margin: 4px 0; }
  code { background: $bg-hover; padding: 2px 6px; border-radius: $radius-sm; font-size: 13px; }
  pre code { display: block; padding: 12px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid $border-color; padding: 8px 12px; text-align: left; }
  th { background: $bg-hover; font-weight: 600; }
  strong { font-weight: 600; }
}

@media (max-width: 768px) {
  .health-banner { flex-direction: column; align-items: flex-start; }
}
</style>
