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
          {{ healthScore }}
        </div>
        <div class="health-info">
          <h3>{{ store.selectedNodeName }}</h3>
          <p>品类健康度良好，市场规模稳定增长，竞争强度适中，利润空间可观</p>
          <div class="metrics">
            <div class="metric">市场规模 <strong>¥2.4M</strong></div>
            <div class="metric">竞争强度 <strong>中低</strong></div>
            <div class="metric">利润空间 <strong>32%</strong></div>
            <div class="metric">趋势 <strong class="up">↑ 12%</strong></div>
          </div>
        </div>
      </div>

      <!-- 已验证元素 -->
      <ModelCard title="已验证元素" subtitle="点击筛选" :expanded="true">
        <div class="tag-row">
          <span
            v-for="elem in elements"
            :key="elem.name"
            class="elem-tag"
            :class="{
              selected: isElemSelected(elem),
              hot: elem.trend === 'hot',
              rising: elem.trend === 'rising'
            }"
            @click="toggleElement(elem)"
          >
            {{ elem.name }}
            <span class="count">{{ elem.count }}</span>
          </span>
        </div>
      </ModelCard>

      <!-- 载体画像 -->
      <ModelCard title="载体画像" subtitle="点击加入筛选" :expanded="true">
        <div class="carrier-grid">
          <div
            v-for="c in carriers"
            :key="c.name"
            class="carrier-card"
            :class="{ selected: isCarrierSelected(c) }"
            @click="toggleCarrier(c)"
          >
            <div class="carrier-thumb">{{ c.icon }}</div>
            <div class="carrier-info">
              <div class="name">{{ c.name }}</div>
              <div class="meta">{{ c.category }}</div>
              <div class="stats">
                <span>均价 <strong>{{ c.avgPrice }}</strong></span>
                <span>竞品 <strong>{{ c.competitorCount }}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </ModelCard>

      <!-- 推荐组合 -->
      <ModelCard title="推荐组合" :expanded="true">
        <div class="combo-list">
          <div v-for="combo in combos" :key="combo.name" class="combo-card" @click="applyCombo(combo)">
            <div class="combo-text">
              <div class="combo-name">{{ combo.name }}</div>
              <div class="combo-detail">评分 {{ combo.score }} · 利润预估 {{ combo.profit }}</div>
            </div>
            <button class="combo-btn" @click.stop="applyCombo(combo)">一键应用</button>
          </div>
        </div>
      </ModelCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProductLineSelectionStore } from '../store'
import ModelCard from './ModelCard.vue'

const store = useProductLineSelectionStore()

// ---- 数据 ----
const elements = ref([
  { name: '不锈钢', count: 847, trend: 'hot' },
  { name: '便携式', count: 623, trend: 'normal' },
  { name: '多功能', count: 512, trend: 'normal' },
  { name: '硅胶', count: 438, trend: 'rising' },
  { name: '可调节', count: 391, trend: 'normal' },
  { name: 'BPA-Free', count: 356, trend: 'normal' },
  { name: '洗碗机安全', count: 298, trend: 'normal' },
  { name: '竹制', count: 267, trend: 'rising' },
])

const carriers = ref([
  { name: '不锈钢研磨器', icon: '☕', category: '厨房小家电', avgPrice: '¥189', competitorCount: 47 },
  { name: '可叠加收纳盒', icon: '📦', category: '家居收纳', avgPrice: '¥45', competitorCount: 128 },
  { name: '硅胶厨具套装', icon: '🍳', category: '厨房工具', avgPrice: '¥128', competitorCount: 63 },
  { name: '竹制砧板', icon: '🪵', category: '厨房配件', avgPrice: '¥89', competitorCount: 85 },
])

const combos = ref([
  { name: '不锈钢 + 便携式 + 研磨器', score: 94, profit: '¥52/件', items: ['不锈钢', '便携式', '研磨器'] },
  { name: '硅胶 + BPA-Free + 厨具套装', score: 89, profit: '¥38/件', items: ['硅胶', 'BPA-Free', '厨具套装'] },
  { name: '竹制 + 可调节 + 收纳盒', score: 86, profit: '¥41/件', items: ['竹制', '可调节', '收纳盒'] },
])

// ---- 健康度环形图计算 ----
const healthScores: Record<string, { score: number; gradient: string; color: string }> = {
  healthy: { score: 78, gradient: '#059669', color: '#059669' },
  stable: { score: 62, gradient: '#0891b2', color: '#0891b2' },
  declining: { score: 45, gradient: '#ca8a04', color: '#ca8a04' },
  risky: { score: 28, gradient: '#dc2626', color: '#dc2626' },
}

const healthScore = computed(() => healthScores[store.selectedNodeHealth]?.score ?? 0)
const healthRingStyle = computed(() => {
  const s = healthScores[store.selectedNodeHealth] ?? healthScores.healthy
  const deg = (s.score / 100) * 360
  return {
    background: `conic-gradient(${s.gradient} 0deg, ${s.gradient} ${deg}deg, #e5e1da ${deg}deg 360deg)`,
    color: s.color
  }
})

// ---- 元素/载体选中状态 ----
function isElemSelected(e: { name: string }) {
  return store.activeFilters.some(f => f.value === e.name && f.type === 'element')
}
function isCarrierSelected(c: { name: string }) {
  return store.activeFilters.some(f => f.label.startsWith('载体:') && f.label.includes(c.name))
}

function toggleElement(e: { name: string; count: number }) {
  if (isElemSelected(e)) {
    store.removeFilterByLabel(e.name)
  } else {
    store.addFilter('element', e.name, e.name, '模型-元素')
  }
}

function toggleCarrier(c: { name: string; icon: string; avgPrice: string; competitorCount: number }) {
  const label = `载体:${c.name}`
  if (isCarrierSelected(c)) {
    store.removeFilterByLabel(label)
  } else {
    store.addFilter('carrier', label, c.name, '模型-载体')
  }
}

function applyCombo(combo: { items: string[] }) {
  combo.items.forEach(item => {
    if (!store.activeFilters.find(f => f.value === item)) {
      store.addFilter('combo', item, item, '推荐组合')
    }
  })
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

// ---- 元素标签 ----
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; }

.elem-tag {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: $bg-hover;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  font-size: 13px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover { border-color: $primary-color; color: $primary-color; }
  &.selected { border-color: $primary-color; color: $primary-color; background: rgba($primary-color, 0.04); }
  &.hot { border-color: rgba($danger-color, 0.25); background: rgba($danger-color, 0.04); }
  &.rising { border-color: rgba(#ea580c, 0.25); background: rgba(#ea580c, 0.04); }

  .count { font-size: 11px; color: $text-tertiary; font-family: $font-family-mono; }
}

// ---- 载体卡片 ----
.carrier-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

.carrier-card {
  display: flex; gap: 14px; padding: 14px;
  background: $bg-hover;
  border-radius: $radius-lg;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover, &.selected { border-color: $primary-color; background: rgba($primary-color, 0.03); }

  .carrier-thumb {
    width: 56px; height: 56px;
    background: linear-gradient(135deg, rgba($primary-color, 0.08), rgba($primary-light, 0.05));
    border-radius: $radius-md;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }

  .carrier-info {
    flex: 1;
    .name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .meta { font-size: 12px; color: $text-secondary; margin-bottom: 6px; }
    .stats { display: flex; gap: 16px; font-size: 12px; color: $text-tertiary; }
    .stats strong { font-family: $font-family-mono; color: $text-primary; }
  }
}

// ---- 推荐组合 ----
.combo-list { display: grid; gap: 8px; }

.combo-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: rgba($primary-color, 0.04);
  border: 1px solid rgba($primary-color, 0.12);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover { border-color: $primary-color; box-shadow: $shadow-sm; }

  .combo-text { flex: 1; }
  .combo-name { font-size: 13px; font-weight: 600; }
  .combo-detail { font-size: 12px; color: $text-secondary; margin-top: 2px; }
}

.combo-btn {
  padding: 5px 14px;
  background: $primary-color;
  color: white;
  border: none;
  border-radius: $radius-sm;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background $transition-fast;

  &:hover { background: $primary-dark; }
}

@media (max-width: 768px) {
  .carrier-grid { grid-template-columns: 1fr; }
  .health-banner { flex-direction: column; align-items: flex-start; }
}
</style>
