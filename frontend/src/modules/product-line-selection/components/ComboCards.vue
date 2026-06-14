<template>
  <ModelCard title="推荐组合" :expanded="true">
    <div class="combo-list">
      <div v-for="(combo, idx) in combos" :key="idx" class="combo-card" @click="applyCombo(combo)">
        <div class="combo-text">
          <div class="combo-name">
            {{ combo.elements?.join(' + ') }} × {{ combo.carriers?.join(', ') }}
            <span v-if="combo.heat === '已验证'" class="badge-hot">🔥</span>
            <span v-else-if="combo.heat === '新兴'" class="badge-star">⭐</span>
          </div>
          <div class="combo-detail">
            场景: {{ combo.scenes?.join(', ') || '—' }} · {{ combo.heat || '—' }}
          </div>
          <div class="combo-keywords" v-if="combo.keywordsEn?.length || combo.keywordsCn?.length">
            <span v-for="(kw, ki) in topKeywords(combo)" :key="ki" class="keyword-tag">{{ kw }}</span>
          </div>
          <div class="combo-detail" v-if="combo.reason">{{ combo.reason }}</div>
        </div>
        <div class="combo-actions">
          <button class="combo-btn" @click.stop="applyCombo(combo)">一键应用</button>
          <button v-if="isComboApplied(combo)" class="combo-undo" @click.stop="undoCombo(combo)">撤销</button>
        </div>
      </div>
    </div>
  </ModelCard>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useProductLineSelectionStore } from '../store'
import ModelCard from './ModelCard.vue'

export interface ComboItem {
  elements: string[]
  carriers: string[]
  scenes: string[]
  keywordsEn: string[]
  keywordsCn: string[]
  heat: string
  reason: string
}

defineProps<{
  combos: ComboItem[]
}>()

const store = useProductLineSelectionStore()

function topKeywords(combo: ComboItem): string[] {
  const all = [...(combo.keywordsEn || []), ...(combo.keywordsCn || [])]
  return all.slice(0, 3)
}

function applyCombo(combo: ComboItem) {
  const added: string[] = []
  ;(combo.elements || []).forEach(el => {
    if (!store.activeFilters.find(f => f.value === el && f.type === 'element')) {
      store.addFilter('element', store.FILTER_LABEL.element(el), el, '推荐组合')
      added.push(el)
    }
  })
  ;(combo.carriers || []).forEach(c => {
    if (!store.activeFilters.find(f => f.value === c && f.type === 'carrier')) {
      store.addFilter('carrier', store.FILTER_LABEL.carrier(c), c, '推荐组合')
      added.push(c)
    }
  })
  if (added.length > 0) {
    ElMessage.success(`已应用 ${added.length} 个筛选条件: ${added.join(', ')}`)
  }
  store.searchCompetitors()
}

function isComboApplied(combo: ComboItem): boolean {
  const targets = [...(combo.elements || []), ...(combo.carriers || [])]
  return targets.some(val =>
    store.activeFilters.find(f => f.value === val && f.source === '推荐组合')
  )
}

function undoCombo(combo: ComboItem) {
  const targets = [...(combo.elements || []), ...(combo.carriers || [])]
  targets.forEach(val => {
    const idx = store.activeFilters.findIndex(f => f.value === val && f.source === '推荐组合')
    if (idx !== -1) store.activeFilters.splice(idx, 1)
  })
  store.searchCompetitors()
  ElMessage.info('已撤销推荐组合筛选')
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

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
  .combo-keywords { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
}

.keyword-tag {
  display: inline-block;
  padding: 1px 6px;
  background: rgba($primary-color, 0.08);
  border-radius: $radius-sm;
  font-size: 11px;
  color: $text-secondary;
}

.combo-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
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

.combo-undo {
  padding: 5px 14px;
  background: transparent;
  color: $text-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all $transition-fast;

  &:hover {
    color: $danger-color;
    border-color: $danger-color;
  }
}
</style>
