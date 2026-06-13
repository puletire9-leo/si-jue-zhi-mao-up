<template>
  <ModelCard title="载体画像" subtitle="点击加入筛选" :expanded="true">
    <div class="carrier-grid">
      <div
        v-for="c in carriers"
        :key="c.name"
        class="carrier-card"
        :class="{ selected: isSelected(c), lightweight: c.lightweight }"
        @click="toggle(c)"
      >
        <div class="carrier-info">
          <div class="name">
            {{ c.name }}
            <span v-if="c.lightweight" class="lightweight-badge">✅</span>
          </div>
          <div class="meta">{{ c.variant_strategy || '—' }}<span v-if="c.lightweight"> · 轻量</span></div>
          <div class="stats">
            <span>均价 <strong>£{{ c.avg_price }}</strong></span>
            <span>竞品 <strong>{{ c.count }}</strong></span>
            <span>重量 <strong>{{ c.avg_weight_g }}g</strong></span>
          </div>
        </div>
      </div>
    </div>
  </ModelCard>
</template>

<script setup lang="ts">
import { useProductLineSelectionStore } from '../store'
import ModelCard from './ModelCard.vue'

export interface CarrierItem {
  name: string
  count: number
  avg_price: number | string
  avg_weight_g: number | string
  avg_fba: number | string
  variant_strategy: string
  lightweight: boolean
}

defineProps<{
  carriers: CarrierItem[]
}>()

const store = useProductLineSelectionStore()

function isSelected(c: { name: string }) {
  return store.activeFilters.some(f => f.type === 'carrier' && f.value === c.name)
}

function toggle(c: { name: string }) {
  const label = `载体:${c.name}`
  if (isSelected(c)) {
    store.removeFilterByLabel(label)
  } else {
    store.addFilter('carrier', label, c.name, '模型-载体')
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.carrier-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

.carrier-card {
  display: flex; gap: 14px; padding: 14px;
  background: $bg-hover;
  border-radius: $radius-lg;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover, &.selected { border-color: $primary-color; background: rgba($primary-color, 0.03); }

  .carrier-info {
    flex: 1;
    .name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .meta { font-size: 12px; color: $text-secondary; margin-bottom: 6px; }
    .stats { display: flex; gap: 16px; font-size: 12px; color: $text-tertiary; }
    .stats strong { font-family: $font-family-mono; color: $text-primary; }
  }

  .lightweight-badge { margin-left: 4px; font-size: 12px; }
}

@media (max-width: 768px) {
  .carrier-grid { grid-template-columns: 1fr; }
}
</style>
