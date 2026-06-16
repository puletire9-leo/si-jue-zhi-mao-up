<template>
  <div class="category-summary" :class="{ expanded }">
    <!-- 可点击标题行，切换展开/折叠 -->
    <div class="cs-header" @click="expanded = !expanded">
      <span class="cs-arrow">{{ expanded ? '▾' : '▸' }}</span>
      <span class="cs-title">📊 {{ store.marketplace }} · {{ store.month }}</span>
    </div>

    <!-- 展开区域 -->
    <div v-show="expanded" class="cs-body">
      <div v-if="store.treeLoading" class="cs-loading">加载中…</div>
      <div v-else-if="totalCount === 0" class="cs-empty">暂无可选品类数据</div>
      <template v-else>
        <div class="cs-list">
          <div
            v-for="group in store.treeData"
            :key="group.id"
            class="cs-l1"
            :class="{ active: group.id === store.selectedBsrId }"
            @click="handleClick(group)"
          >
            <span class="cs-l1-name">{{ group.name }}</span>
            <span class="cs-l1-bar">
              <span class="cs-l1-bar-fill" :style="{ width: pct(group) + '%' }" />
            </span>
            <span class="cs-l1-count">{{ countOf(group).toLocaleString() }}</span>
            <span class="cs-l1-pct">{{ pct(group).toFixed(1) }}%</span>
          </div>
        </div>
        <div class="cs-footer">共 <em>{{ totalCount.toLocaleString() }}</em> 件商品</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProductLineSelectionStore } from '../store'
import type { TreeGroup } from '@/types/productLine'

const store = useProductLineSelectionStore()
const expanded = ref(false)

function countOf(g: TreeGroup): number {
  return g.children.reduce((s, c) => s + (c.productCount || 0), 0)
}

const totalCount = computed(() =>
  store.treeData.reduce((sum, g) => sum + countOf(g), 0)
)

function pct(g: TreeGroup): number {
  const t = totalCount.value
  if (t === 0) return 0
  return (countOf(g) / t) * 100
}

function handleClick(g: TreeGroup) {
  if (g.id === store.selectedBsrId && store.selectedBsrId) {
    // 取消选中：完整清理状态
    store.selectedBsrId = ''
    store.selectedBsrName = ''
    store.selectedNodeId = ''
    store.selectedNodeName = ''
    store.clearFilters()
    store.clearBasicFilters()
    store.selectedProducts = new Set()
    store.competitorResults = []
    store.modelData = null
    store.competitorPage = 1
    store.sortBy = ''
    store.closeResults()
  } else {
    store.selectCategory(g.id, g.name)
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.category-summary {
  border-bottom: 1px solid $border-color;
  font-size: 12px;
}

.cs-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background $transition-fast;

  &:hover {
    background: $bg-hover;
  }
}

.cs-arrow {
  font-size: 10px;
  color: $text-tertiary;
  flex-shrink: 0;
  width: 12px;
  text-align: center;
}

.cs-title {
  font-weight: 600;
  color: $text-primary;
  font-size: 13px;
}

.cs-body {
  padding: 0 12px 8px;
}

.cs-loading,
.cs-empty {
  padding: 8px 0;
  text-align: center;
  color: $text-tertiary;
  font-size: 12px;
}

.cs-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cs-l1 {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover {
    background: $bg-hover;
  }

  &.active {
    background: rgba($primary-color, 0.06);
  }
}

.cs-l1-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $text-secondary;
  font-size: 12px;
  min-width: 0;

  .cs-l1.active & {
    color: $primary-color;
    font-weight: 600;
  }
}

.cs-l1-bar {
  flex: 0 0 50px;
  height: 5px;
  background: $bg-hover;
  border-radius: 3px;
  overflow: hidden;
}

.cs-l1-bar-fill {
  display: block;
  height: 100%;
  background: $primary-color;
  border-radius: 3px;
  opacity: 0.45;
  transition: width 0.3s ease;
}

.cs-l1-count {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $text-secondary;
  white-space: nowrap;
  min-width: 45px;
  text-align: right;
}

.cs-l1-pct {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  min-width: 36px;
  text-align: right;
}

.cs-footer {
  margin-top: 6px;
  text-align: center;
  font-size: 11px;
  color: $text-tertiary;

  em {
    font-style: normal;
    color: $primary-color;
    font-weight: 700;
  }
}
</style>
