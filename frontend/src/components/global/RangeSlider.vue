<template>
  <div class="range-slider">
    <div class="range-header">
      <label v-if="label" class="range-label">{{ label }}</label>
      <span v-if="modelHint" class="range-hint" @click="$emit('applyModel')">
        {{ modelHint }}
        <el-button link type="primary" size="small">应用</el-button>
      </span>
    </div>

    <div class="range-track" ref="trackRef" @mousedown="onTrackClick">
      <div class="range-fill" :style="fillStyle" />
      <div
        v-for="(_, i) in [0, 1]"
        :key="i"
        class="range-thumb"
        :style="{ left: `${percentages[i]}%` }"
        @mousedown.stop="onThumbStart($event, i)"
      >
        <span class="thumb-value">{{ modelValue[i] }}</span>
      </div>
    </div>

    <div class="range-inputs">
      <el-input-number
        v-model="localMin"
        :min="min"
        :max="localMax"
        :step="step"
        size="small"
        controls-position="right"
        @change="emitChange"
      />
      <span class="range-sep">—</span>
      <el-input-number
        v-model="localMax"
        :min="localMin"
        :max="max"
        :step="step"
        size="small"
        controls-position="right"
        @change="emitChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: [number, number]
  min?: number
  max?: number
  step?: number
  label?: string
  modelHint?: string
  recommendRange?: [number, number]
}>(), {
  min: 0,
  max: 100,
  step: 1,
})

const emit = defineEmits<{
  'update:modelValue': [val: [number, number]]
  applyModel: []
}>()

const localMin = ref(props.modelValue[0])
const localMax = ref(props.modelValue[1])

watch(() => props.modelValue, ([min, max]) => {
  localMin.value = min
  localMax.value = max
})

const percentages = computed(() => {
  const range = props.max - props.min
  return [
    ((localMin.value - props.min) / range) * 100,
    ((localMax.value - props.min) / range) * 100
  ]
})

const fillStyle = computed(() => ({
  left: `${percentages.value[0]}%`,
  width: `${percentages.value[1] - percentages.value[0]}%`
}))

function emitChange() {
  if (localMin.value > localMax.value) {
    localMax.value = localMin.value
  }
  emit('update:modelValue', [localMin.value, localMax.value])
}

// ---- 拖拽 ----
function onThumbStart(e: MouseEvent, index: number) {
  const startX = e.clientX
  const startVal = index === 0 ? localMin.value : localMax.value
  const range = props.max - props.min

  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX
    const track = document.querySelector('.range-track') as HTMLElement
    if (!track) return
    const trackWidth = track.offsetWidth
    const delta = (dx / trackWidth) * range
    const newVal = Math.round((startVal + delta) / props.step) * props.step

    if (index === 0) {
      localMin.value = Math.max(props.min, Math.min(localMax.value - props.step, newVal))
    } else {
      localMax.value = Math.min(props.max, Math.max(localMin.value + props.step, newVal))
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
    emitChange()
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.userSelect = 'none'
}

function onTrackClick(e: MouseEvent) {
  const track = e.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  const val = props.min + ratio * (props.max - props.min)
  const rounded = Math.round(val / props.step) * props.step

  // 更新较近的滑块
  if (Math.abs(rounded - localMin.value) < Math.abs(rounded - localMax.value)) {
    localMin.value = Math.max(props.min, Math.min(localMax.value - props.step, rounded))
  } else {
    localMax.value = Math.min(props.max, Math.max(localMin.value + props.step, rounded))
  }
  emitChange()
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.range-slider {
  padding: 4px 0;
}

.range-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}

.range-label {
  font-size: 12px; color: $text-secondary; font-weight: 500;
}

.range-hint {
  font-size: 12px; color: $success-color; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}

.range-track {
  position: relative;
  height: 8px;
  background: $border-color;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 12px;
}

.range-fill {
  position: absolute;
  height: 100%;
  background: $primary-color;
  border-radius: 4px;
}

.range-thumb {
  position: absolute;
  top: 50%;
  width: 20px; height: 20px;
  background: $bg-color;
  border: 2px solid $primary-color;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 2;

  &:hover { box-shadow: 0 0 0 4px rgba($primary-color, 0.15); }

  .thumb-value {
    position: absolute; top: -24px; left: 50%; transform: translateX(-50%);
    font-size: 11px; color: $text-primary; font-family: $font-family-mono;
    background: $bg-color; padding: 2px 6px; border-radius: 3px;
    border: 1px solid $border-color; white-space: nowrap;
  }
}

.range-inputs {
  display: flex; align-items: center; gap: 8px;

  .range-sep { font-size: 13px; color: $text-tertiary; }
}
</style>
