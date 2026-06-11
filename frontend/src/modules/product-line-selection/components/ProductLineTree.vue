<template>
  <div class="tree-panel" :class="{ 'mobile-open': mobileOpen }">
    <!-- 搜索框 -->
    <div class="tree-search">
      <el-input
        v-model="searchText"
        placeholder="搜索品线或小类…"
        :prefix-icon="Search"
        clearable
        size="default"
      />
    </div>

    <!-- 树列表 -->
    <div class="tree-list">
      <div v-for="group in filteredGroups" :key="group.id" class="tree-group">
        <!-- L1: 大类 -->
        <div class="tree-l1" @click="group.expanded = !group.expanded">
          <span class="arrow" :class="{ expanded: group.expanded }">
            <el-icon><ArrowRight /></el-icon>
          </span>
          <span class="icon">{{ group.icon }}</span>
          {{ group.name }}
          <span class="count">{{ group.children.length }} 子类</span>
        </div>

        <!-- L2: 小类 -->
        <div
          v-for="node in group.children"
          v-show="group.expanded"
          :key="node.id"
          class="tree-l2"
          :class="{ active: node.id === store.selectedNodeId }"
          @click="handleNodeClick(node)"
        >
          <span class="dot" :class="node.status" />
          {{ node.name }}
          <span class="count">{{ node.productCount?.toLocaleString() }}</span>
        </div>
      </div>

      <div v-if="filteredGroups.length === 0" class="tree-empty">
        无匹配结果
      </div>
    </div>

    <!-- 移动端关闭按钮 -->
    <div v-if="mobileOpen" class="mobile-close" @click="$emit('closeMobile')">
      <el-icon><Close /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, ArrowRight, Close } from '@element-plus/icons-vue'
import { useProductLineSelectionStore } from '../store'

defineProps<{ mobileOpen?: boolean }>()
defineEmits<{ closeMobile: [] }>()

const store = useProductLineSelectionStore()
const searchText = ref('')

// ---- 模拟数据 ----
interface TreeNode {
  id: string
  name: string
  icon?: string
  productCount: number
  status: 'done' | 'pending' | 'empty'
}
interface TreeGroup { id: string; name: string; icon: string; expanded: boolean; children: TreeNode[] }

const groups = ref<TreeGroup[]>([
  {
    id: 'home-kitchen', name: 'Home & Kitchen', icon: '🏠', expanded: true,
    children: [
      { id: 'kitchen-dining', name: 'Kitchen & Dining', productCount: 3241, status: 'done' },
      { id: 'home-decor', name: 'Home Decor', productCount: 2186, status: 'done' },
      { id: 'storage-org', name: 'Storage & Organization', productCount: 1953, status: 'done' },
      { id: 'bedding', name: 'Bedding', productCount: 892, status: 'pending' },
      { id: 'bath', name: 'Bath', productCount: 654, status: 'empty' },
    ]
  },
  {
    id: 'tools', name: 'Tools & Home Improvement', icon: '🔧', expanded: true,
    children: [
      { id: 'power-tools', name: 'Power Tools', productCount: 1567, status: 'done' },
      { id: 'hand-tools', name: 'Hand Tools', productCount: 2340, status: 'done' },
      { id: 'lighting', name: 'Lighting & Ceiling Fans', productCount: 3102, status: 'pending' },
      { id: 'hardware', name: 'Hardware', productCount: 1203, status: 'done' },
    ]
  },
  {
    id: 'toys', name: 'Toys & Games', icon: '🧸', expanded: false,
    children: [
      { id: 'board-games', name: 'Board Games', productCount: 1234, status: 'done' },
      { id: 'plush', name: 'Plush Toys', productCount: 567, status: 'pending' },
      { id: 'building', name: 'Building Toys', productCount: 2109, status: 'done' },
    ]
  },
])

// ---- 搜索过滤 ----
const filteredGroups = computed(() => {
  const q = searchText.value.toLowerCase().trim()
  if (!q) return groups.value
  return groups.value
    .map(g => ({
      ...g,
      children: g.children.filter(c =>
        c.name.toLowerCase().includes(q)
      ),
      expanded: true
    }))
    .filter(g => g.children.length > 0)
})

// ---- 节点点击 ----
function handleNodeClick(node: TreeNode) {
  const health = node.status === 'done' ? 'healthy' : node.status === 'pending' ? 'stable' : 'declining'
  store.selectNode(node.id, node.name, health)
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.tree-panel {
  width: 280px;
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

.tree-empty {
  padding: 24px;
  text-align: center;
  color: $text-tertiary;
  font-size: 13px;
}

.tree-group {
  margin-bottom: 2px;
}

.tree-l1 {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;
  letter-spacing: 0.02em;

  &:hover {
    color: $text-primary;
    background: $bg-hover;
  }

  .arrow {
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: $text-tertiary;
    transition: transform $transition-fast;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .icon { font-size: 14px; }
  .count {
    margin-left: auto;
    font-size: 11px;
    color: $text-tertiary;
    font-weight: 400;
  }
}

.tree-l2 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px 7px 40px;
  font-size: 13px;
  color: $text-secondary;
  cursor: pointer;
  transition: all $transition-fast;
  border-left: 3px solid transparent;

  &:hover {
    color: $text-primary;
    background: $bg-hover;
  }

  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.04);
    border-left-color: $primary-color;
    font-weight: 600;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;

    &.done { background: $success-color; }
    &.pending { background: $info-color; }
    &.empty { background: $text-tertiary; }
  }

  .count {
    margin-left: auto;
    font-size: 11px;
    color: $text-tertiary;
    font-weight: 400;
    font-family: $font-family-mono;
  }
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
