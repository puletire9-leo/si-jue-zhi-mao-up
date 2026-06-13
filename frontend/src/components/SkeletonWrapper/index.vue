<template>
  <div
    class="skeleton-wrapper"
    :class="[`variant-${variant}`, { 'is-loading': loading }]"
  >
    <el-skeleton animated :loading="loading">
      <template #template>
        <!-- 卡片网格 -->
        <div v-if="variant === 'card-grid'" class="skeleton-card-grid">
          <div v-for="i in finalCount" :key="i" class="skeleton-card-item">
            <el-skeleton-item variant="image" class="skeleton-card-img" />
            <div class="skeleton-card-body">
              <el-skeleton-item variant="p" class="skeleton-text-60" />
              <el-skeleton-item variant="p" class="skeleton-text-80" />
            </div>
          </div>
        </div>

        <!-- 表格行 -->
        <div v-else-if="variant === 'table'" class="skeleton-table-inner">
          <div v-for="i in finalRows" :key="i" class="skeleton-table-row">
            <el-skeleton-item variant="p" class="skeleton-table-cell" />
          </div>
        </div>

        <!-- 统计卡片 -->
        <div v-else-if="variant === 'stats'" class="skeleton-stats">
          <el-skeleton-item variant="h1" class="skeleton-stat-title" />
          <el-skeleton-item variant="p" />
          <el-skeleton-item variant="p" class="skeleton-text-60" />
        </div>

        <!-- 列表行 -->
        <div v-else-if="variant === 'list'" class="skeleton-list">
          <div v-for="i in finalCount" :key="i" class="skeleton-list-row">
            <el-skeleton-item variant="circle" class="skeleton-avatar" />
            <el-skeleton-item variant="p" class="skeleton-text-70" />
          </div>
        </div>
      </template>

      <slot />
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  loading?: boolean
  variant: 'card-grid' | 'table' | 'stats' | 'list'
  count?: number
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: true,
  count: 6,
  rows: 5
})

const finalCount = computed(() => {
  if (props.variant === 'card-grid') {
    return Math.max(1, props.count || 6)
  }
  if (props.variant === 'list') {
    return Math.max(1, props.count || 5)
  }
  return Math.max(1, props.count)
})

const finalRows = computed(() => Math.max(1, props.rows))
</script>

<style scoped lang="scss">
.skeleton-wrapper {
  width: 100%;

  &.is-loading {
    pointer-events: none;
    user-select: none;
  }
}

// ====== card-grid ======
.skeleton-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.skeleton-card-item {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
}

.skeleton-card-img {
  width: 100%;
  height: 180px;
  display: block;
  border-radius: 0;
}

.skeleton-card-body {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ====== table ======
.skeleton-table-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
}

.skeleton-table-row {
  width: 100%;
}

.skeleton-table-cell {
  width: 100%;
  height: 20px;
}

// ====== stats ======
.skeleton-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
}

.skeleton-stat-title {
  width: 30%;
}

// ====== list ======
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter, #e4e7ed);

  &:last-child {
    border-bottom: none;
  }
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

// ====== 通用宽度辅助 ======
.skeleton-text-60 {
  width: 60%;
}

.skeleton-text-70 {
  width: 70%;
}

.skeleton-text-80 {
  width: 80%;
}
</style>
