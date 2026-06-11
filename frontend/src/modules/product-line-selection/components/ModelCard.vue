<template>
  <div class="model-card">
    <div class="card-header" @click="toggle">
      <h4>
        {{ title }}
        <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
      </h4>
      <span class="arrow" :class="{ open: isOpen }">
        <el-icon><ArrowDown /></el-icon>
      </span>
    </div>
    <div class="card-body" v-show="isOpen">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

const props = defineProps<{
  title: string
  subtitle?: string
  expanded?: boolean
}>()

const isOpen = ref(props.expanded ?? true)

function toggle() { isOpen.value = !isOpen.value }
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.model-card {
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  overflow: hidden;
}

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover { background: $bg-hover; }

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  .subtitle {
    font-size: 11px;
    color: $text-tertiary;
    font-weight: 400;
    margin-left: 8px;
  }

  .arrow {
    font-size: 12px;
    color: $text-tertiary;
    transition: transform $transition-fast;

    &.open { transform: rotate(180deg); }
  }
}

.card-body {
  padding: 16px 20px;
}
</style>
