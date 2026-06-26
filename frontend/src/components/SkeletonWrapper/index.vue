<template>
  <div
    v-if="showSkeleton"
    class="skeleton-wrapper"
    :class="[`variant-${normalizedVariant}`]"
  >
    <!-- 卡片网格（选品/产品卡片风格） -->
    <template v-if="isCard">
      <div v-for="i in count" :key="i" class="skeleton-card">
        <div class="skeleton-card-image shimmer" />
        <div class="skeleton-card-body">
          <div class="skeleton-card-title shimmer" />
          <div class="skeleton-card-subtitle shimmer" />
          <div class="skeleton-card-lines">
            <div
              v-for="j in rows"
              :key="j"
              class="skeleton-line shimmer"
              :style="{ width: cardWidths[(j - 1) % cardWidths.length] }"
            />
          </div>
          <div class="skeleton-card-actions">
            <div class="skeleton-btn shimmer" />
            <div class="skeleton-btn shimmer" />
          </div>
        </div>
      </div>
    </template>

    <!-- 列表行（历史侧边栏风格） -->
    <template v-else-if="normalizedVariant === 'list'">
      <div v-for="i in count" :key="i" class="skeleton-list-item">
        <div class="skeleton-list-header">
          <div class="skeleton-tag shimmer" />
          <div class="skeleton-list-title shimmer" />
          <div class="skeleton-list-time shimmer" />
        </div>
        <div class="skeleton-list-body">
          <div
            v-for="j in rows"
            :key="j"
            class="skeleton-line shimmer"
            :style="{ width: listWidths[(j - 1) % listWidths.length] }"
          />
        </div>
      </div>
    </template>

    <!-- 纯文本 -->
    <template v-else-if="normalizedVariant === 'text'">
      <div class="skeleton-text-block">
        <div
          v-for="i in rows"
          :key="i"
          class="skeleton-text-row shimmer"
          :style="{ width: textWidths[(i - 1) % textWidths.length] }"
        />
      </div>
    </template>

    <!-- 表格行 -->
    <template v-else-if="normalizedVariant === 'table'">
      <div class="skeleton-table">
        <div v-for="i in rows" :key="i" class="skeleton-table-row shimmer" />
      </div>
    </template>

    <!-- 统计卡片 -->
    <template v-else-if="normalizedVariant === 'stats'">
      <div class="skeleton-stats-widget">
        <div class="skeleton-stat-title shimmer" />
        <div class="skeleton-line shimmer" style="width: 60%" />
        <div class="skeleton-line shimmer" style="width: 40%" />
      </div>
    </template>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 骨架屏变体（所有现有消费者使用此属性） */
  variant?: string
  /** 旧版 type 别名 */
  type?: string
  /** 是否显示骨架屏。默认 true 兼容直接使用（无 slot）的场景 */
  loading?: boolean
  /** 骨架项数量 */
  count?: number
  /** 文本行数 */
  rows?: number
}>(), {
  loading: true,
  count: 4,
  rows: 3,
})

const isCard = computed(() => {
  const v = normalizedVariant.value
  return v === 'card' || v === 'card-grid'
})

const normalizedVariant = computed(() => {
  return props.variant || props.type || ''
})

const showSkeleton = computed(() => {
  return props.loading && normalizedVariant.value.length > 0
})

const cardWidths = ['85%', '60%', '75%', '45%', '65%']
const listWidths = ['95%', '78%', '52%']
const textWidths = ['100%', '92%', '74%', '92%', '74%']
</script>

<style scoped>
/* ── 全局闪烁动画 ── */
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.shimmer {
  background: linear-gradient(
    90deg,
    var(--el-fill-color) 25%,
    var(--el-fill-color-lighter) 37%,
    var(--el-fill-color) 63%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
}

/* ── 卡片骨架 ── */
.skeleton-wrapper.variant-card,
.skeleton-wrapper.variant-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  min-height: 400px;
}

.skeleton-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.skeleton-card-image {
  width: 100%;
  height: 200px;
  border-radius: 0;
  flex-shrink: 0;
}

.skeleton-card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.skeleton-card-title {
  height: 18px;
  width: 75%;
}

.skeleton-card-subtitle {
  height: 14px;
  width: 50%;
}

.skeleton-card-lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.skeleton-card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-light);
  margin-top: auto;
}

.skeleton-btn {
  width: 56px;
  height: 28px;
  border-radius: 6px;
}

/* ── 列表骨架 ── */
.skeleton-wrapper.variant-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.skeleton-list-item {
  padding: 12px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skeleton-tag {
  width: 48px;
  height: 22px;
  border-radius: 4px;
  flex-shrink: 0;
}

.skeleton-list-title {
  height: 16px;
  flex: 1;
}

.skeleton-list-time {
  height: 12px;
  width: 60px;
  flex-shrink: 0;
}

.skeleton-list-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 文本骨架 ── */
.skeleton-text-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-text-row {
  height: 14px;
  border-radius: 4px;
}

/* ── 表格骨架 ── */
.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.skeleton-table-row {
  width: 100%;
  height: 20px;
}

/* ── 统计骨架 ── */
.skeleton-stats-widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.skeleton-stat-title {
  width: 40%;
  height: 28px;
}
</style>
