<template>
  <div class="tier-stack">
    <div class="tier-bar">
      <div
        v-for="seg in segments"
        :key="seg.tier"
        class="tier-bar__seg"
        :style="{ width: seg.width, background: seg.color }"
        :title="`${seg.tier}: ${seg.count} (${seg.pctText})`"
      />
    </div>
    <div v-if="showLabels" class="tier-labels">
      <span v-for="seg in segments" :key="seg.tier">
        <span class="tier-dot" :style="{ background: seg.color }" />{{ seg.pctText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TIER_COLOR } from '../utils'

const props = withDefaults(
  defineProps<{
    a: number
    b: number
    c: number
    d: number
    unknown?: number
    showLabels?: boolean
  }>(),
  { unknown: 0, showLabels: true }
)

interface Seg {
  tier: string
  count: number
  color: string
  width: string
  pctText: string
}

const segments = computed<Seg[]>(() => {
  const rows = [
    { tier: 'A', count: props.a || 0, color: TIER_COLOR.A },
    { tier: 'B', count: props.b || 0, color: TIER_COLOR.B },
    { tier: 'C', count: props.c || 0, color: TIER_COLOR.C },
    { tier: 'D', count: props.d || 0, color: TIER_COLOR.D },
    { tier: 'UNKNOWN', count: props.unknown || 0, color: TIER_COLOR.UNKNOWN }
  ]
  const total = rows.reduce((s, r) => s + r.count, 0)
  return rows
    .filter((r) => r.count > 0)
    .map((r) => {
      const ratio = total > 0 ? r.count / total : 0
      return {
        ...r,
        width: `${(ratio * 100).toFixed(2)}%`,
        pctText: `${(ratio * 100).toFixed(0)}%`
      }
    })
})
</script>

<style scoped lang="scss">
.tier-stack {
  min-width: 80px;
}
.tier-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--el-fill-color, #f0edea);
  width: 100%;
}
.tier-bar__seg {
  height: 100%;
  transition: width 0.3s ease;
}
.tier-labels {
  display: flex;
  gap: 8px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.tier-labels span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.tier-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
</style>
