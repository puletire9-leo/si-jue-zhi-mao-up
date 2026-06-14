<template>
  <div class="tree-panel" :class="{ 'mobile-open': mobileOpen }">
    <!-- 搜索框 -->
    <div class="tree-search">
      <el-input
        v-model="searchText"
        placeholder="搜索品线…"
        :prefix-icon="Search"
        clearable
        size="default"
      />
    </div>

    <!-- L1 列表 -->
    <div class="tree-list">
      <div v-if="store.treeLoading" class="tree-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载品线数据…</span>
      </div>
      <template v-else>
        <div
          v-for="group in filteredGroups"
          :key="group.id"
          class="tree-l1"
          :class="{ active: group.id === store.selectedBsrId }"
          @click="$emit('selectL1', group.id, group.name)"
        >
          <span class="l1-icon">{{ group.icon }}</span>
          <span class="l1-name">{{ group.name }}</span>
          <span class="l1-badge">{{ group.children.length }} 子类</span>
        </div>

        <div v-if="filteredGroups.length === 0" class="tree-empty">
          <span v-if="searchText">无匹配品线</span>
          <span v-else>暂无品线数据</span>
        </div>
      </template>
    </div>

    <!-- 移动端关闭按钮 -->
    <div v-if="mobileOpen" class="mobile-close" @click="$emit('closeMobile')">
      <el-icon><Close /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Close, Loading } from '@element-plus/icons-vue'
import { useProductLineSelectionStore } from '../store'

defineProps<{ mobileOpen?: boolean }>()
const emit = defineEmits<{
  closeMobile: []
  selectL1: [bsrId: string, bsrName: string]
}>()

const store = useProductLineSelectionStore()
const searchText = ref('')

// 按 L1 名称过滤
const filteredGroups = computed(() => {
  const q = searchText.value.toLowerCase().trim()
  if (!q) return store.treeData
  return store.treeData.filter(g =>
    g.name.toLowerCase().includes(q)
  )
})
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.tree-panel {
  min-width: 200px;
  max-width: 400px;
  background: $bg-color;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  &.mobile-open {
    position: fixed;
    inset: 0;
    z-index: 100;
    width: 100% !important;
    max-width: 100% !important;

    &::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: -1;
    }
  }
}

.tree-search {
  padding: 12px;
  border-bottom: 1px solid $border-color;
}

.tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.tree-empty {
  padding: 24px;
  text-align: center;
  color: $text-tertiary;
  font-size: 13px;
}

.tree-l1 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background: $bg-hover;
  }

  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.06);
  }
}

.l1-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.l1-name {
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .tree-l1.active & {
    color: $primary-color;
  }
}

.l1-badge {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  flex-shrink: 0;
}

.mobile-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: $text-secondary;
  z-index: 101;

  &:hover { color: $text-primary; background: $bg-hover; }
}
</style>
