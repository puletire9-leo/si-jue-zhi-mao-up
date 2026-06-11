<template>
  <div class="empty-state" :class="`type-${type}`">
    <div class="empty-icon">{{ iconMap[type] }}</div>
    <h4 class="empty-title">{{ titleMap[type] }}</h4>
    <p class="empty-desc">{{ description || descMap[type] }}</p>
    <div v-if="$slots.action || actionText" class="empty-action">
      <slot name="action">
        <el-button v-if="actionText" type="primary" @click="$emit('action')">
          {{ actionText }}
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
type EmptyType = 'default' | 'no-data' | 'no-results' | 'analyzing' | 'error'

defineProps<{
  type?: EmptyType
  description?: string
  actionText?: string
}>()

defineEmits<{ action: [] }>()

const iconMap: Record<EmptyType, string> = {
  default: '📭',
  'no-data': '📂',
  'no-results': '🔍',
  analyzing: '⏳',
  error: '⚠️'
}

const titleMap: Record<EmptyType, string> = {
  default: '暂无内容',
  'no-data': '暂无数据',
  'no-results': '无匹配结果',
  analyzing: '分析中…',
  error: '加载失败'
}

const descMap: Record<EmptyType, string> = {
  default: '',
  'no-data': '当前条件下没有可显示的数据',
  'no-results': '请调整筛选条件后重试',
  analyzing: '正在处理数据，请稍候',
  error: '请检查网络连接后重试'
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: $text-tertiary;

  &.type-error { color: $danger-color; }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: $text-tertiary;
  line-height: 1.5;
  max-width: 280px;
}

.empty-action {
  margin-top: 20px;
}
</style>
