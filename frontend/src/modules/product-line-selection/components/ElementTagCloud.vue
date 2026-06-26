<template>
  <ModelCard title="已验证元素" subtitle="点击筛选" :expanded="true">
    <div class="tag-row">
      <span
        v-for="elem in elements"
        :key="elem.name"
        class="elem-tag"
        :class="{
          selected: isSelected(elem),
          hot: elem.trend === 'hot',
          rising: elem.trend === 'rising'
        }"
        @click="toggle(elem)"
      >
        {{ elem.name }}
        <span class="count">{{ elem.frequency }}</span>
      </span>
    </div>
  </ModelCard>
</template>

<script setup lang="ts">
import { useProductLineSelectionStore } from '../store'
import ModelCard from './ModelCard.vue'

export interface ProvenElement {
  name: string
  frequency: number
  carriers: string[]
  signalTags: string[]
  insight: string
  trend: 'hot' | 'rising' | 'normal'
}

defineProps<{
  elements: ProvenElement[]
}>()

const store = useProductLineSelectionStore()

function isSelected(e: { name: string }) {
  return store.activeFilters.some(f => f.value === e.name && f.type === 'element')
}

function toggle(e: { name: string }) {
  if (isSelected(e)) {
    store.removeFilterByLabel(e.name)
  } else {
    store.addFilter('element', e.name, e.name, store.selectedNodeName)
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

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

@media (max-width: 768px) {
  .elem-tag {
    font-size: 12px;
    padding: 4px 10px;
  }
  .tag-row {
    gap: 4px;
  }
}
</style>
