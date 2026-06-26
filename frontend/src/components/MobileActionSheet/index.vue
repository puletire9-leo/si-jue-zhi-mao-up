<template>
  <div class="mobile-action-sheet">
    <!-- trigger button -->
    <button class="mas-trigger" @click="open = true" type="button">
      <span class="mas-trigger-inner">
        <span class="mas-trigger-label">{{ title }}</span>
        <span class="mas-trigger-value">{{ displayValue }}</span>
      </span>
      <svg class="mas-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- overlay + panel teleported to body -->
    <Teleport to="body">
      <Transition name="mas">
        <div v-if="open" class="mas-overlay" @click.self="close">
          <div class="mas-panel" @click.stop>
            <div class="mas-header">
              <span class="mas-title">{{ title }}</span>
              <button class="mas-close-btn" type="button" @click="close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="mas-options">
              <div
                v-for="opt in options"
                :key="opt.value"
                class="mas-option"
                :class="{ active: modelValue === opt.value }"
                @click="select(opt.value)"
              >
                <span>{{ opt.label }}</span>
                <svg v-if="modelValue === opt.value" class="mas-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ActionOption {
  label: string
  value: string
}

const props = defineProps<{
  title: string
  options: ActionOption[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)

const displayValue = computed(() => {
  const match = props.options.find(o => o.value === props.modelValue)
  return match ? match.label : props.modelValue
})

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
}

function close() {
  open.value = false
}
</script>

<style lang="scss" scoped>
// ---- trigger button ----
.mas-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--el-border-color-light, #e5e1da);
  border-radius: 6px;
  font-family: inherit;
  cursor: pointer;
  color: var(--el-text-color-secondary, #6b7280);
  font-size: 12px;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: var(--el-color-primary, #b45309);
    color: var(--el-text-color-primary, #1a1a1a);
  }
}

.mas-trigger-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mas-trigger-label {
  color: var(--el-text-color-placeholder, #9ca3af);
}

.mas-trigger-value {
  font-weight: 500;
  color: var(--el-text-color-primary, #1a1a1a);
}

.mas-chevron {
  color: var(--el-text-color-placeholder, #9ca3af);
  flex-shrink: 0;
}

// ---- overlay ----
.mas-overlay {
  position: fixed;
  inset: 0;
  z-index: 2001;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

// ---- panel ----
.mas-panel {
  width: 100%;
  max-width: 500px;
  background: var(--el-bg-color-overlay, #ffffff);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow: hidden;
}

.mas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-light, #e5e1da);
  flex-shrink: 0;
}

.mas-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary, #1a1a1a);
}

.mas-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--el-fill-color-light, #f3f4f6);
  cursor: pointer;
  color: var(--el-text-color-secondary, #6b7280);
  font-family: inherit;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color, #e5e7eb);
  }
}

.mas-options {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}

.mas-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  font-size: 14px;
  color: var(--el-text-color-primary, #1a1a1a);
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--el-fill-color-light, #faf8f5);
  }

  &.active {
    color: var(--el-color-primary, #b45309);
    font-weight: 600;
    background: var(--el-color-primary-light-9, #fff7ed);
  }
}

.mas-check {
  color: var(--el-color-primary, #b45309);
  flex-shrink: 0;
}

// ---- transition ----
.mas-enter-active,
.mas-leave-active {
  transition: opacity 0.25s ease;
}

.mas-enter-active .mas-panel,
.mas-leave-active .mas-panel {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mas-enter-from,
.mas-leave-to {
  opacity: 0;
}

.mas-enter-from .mas-panel,
.mas-leave-to .mas-panel {
  transform: translateY(100%);
}

.mas-enter-to,
.mas-leave-from {
  opacity: 1;
}

.mas-enter-to .mas-panel,
.mas-leave-from .mas-panel {
  transform: translateY(0);
}
</style>
