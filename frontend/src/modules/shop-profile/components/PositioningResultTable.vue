<template>
  <el-table :data="rows" v-loading="loading" border stripe size="small">
    <el-table-column label="店铺" min-width="170" show-overflow-tooltip>
      <template #default="{ row }">
        <a class="link" @click="emit('view', row)">{{ row.sellerName }}</a>
      </template>
    </el-table-column>
    <el-table-column label="相似度" width="150">
      <template #default="{ row }">
        <div class="sim">
          <div class="sim__bar">
            <div class="sim__fill" :style="{ width: simWidth(row.similarityScore), background: similarityColor(row.similarityScore) }" />
          </div>
          <span class="sim__num mono" :style="{ color: similarityColor(row.similarityScore) }">
            {{ row.similarityScore != null ? row.similarityScore.toFixed(3) : '—' }}
          </span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="定位标签" width="130">
      <template #default="{ row }">
        <el-tag v-if="row.positioningLabel" size="small" effect="light">{{ row.positioningLabel }}</el-tag>
        <span v-else>—</span>
      </template>
    </el-table-column>
    <el-table-column label="商品数" width="90" align="right">
      <template #default="{ row }"><span class="mono">{{ num(row.productCount) }}</span></template>
    </el-table-column>
    <el-table-column label="A/AB/ABC/D 占比" min-width="200">
      <template #default="{ row }">
        <span class="mono ratios">
          {{ pct(row.aRatio, 0) }} / {{ pct(row.abRatio, 0) }} / {{ pct(row.abcRatio, 0) }} / {{ pct(row.dRatio, 0) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="类目匹配分" width="110" align="right">
      <template #default="{ row }">
        <span class="mono">{{ row.categoryMatchScore != null ? row.categoryMatchScore.toFixed(3) : '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="解释" min-width="220" show-overflow-tooltip>
      <template #default="{ row }">{{ row.profileAdvice || '—' }}</template>
    </el-table-column>
    <el-table-column label="操作" width="90" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" size="small" @click="emit('view', row)">查看详情</el-button>
      </template>
    </el-table-column>
    <template #empty>
      <el-empty :description="emptyText" :image-size="60" />
    </template>
  </el-table>
</template>

<script setup lang="ts">
import type { ShopProfilePositioningResult } from '@/types/shopProfile'
import { num, pct, similarityColor } from '../utils'

withDefaults(
  defineProps<{
    rows: ShopProfilePositioningResult[]
    loading?: boolean
    emptyText?: string
  }>(),
  { emptyText: '暂无定位结果' }
)

const emit = defineEmits<{
  (e: 'view', row: ShopProfilePositioningResult): void
}>()

function simWidth(score?: number | null): string {
  if (score == null) return '0%'
  return `${Math.min(100, Math.max(0, score * 100)).toFixed(0)}%`
}
</script>

<style scoped lang="scss">
.link {
  cursor: pointer;
  color: #e8621c;
  font-weight: 500;
  &:hover {
    text-decoration: underline;
  }
}
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.sim {
  display: flex;
  align-items: center;
  gap: 8px;
  &__bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--el-fill-color);
    overflow: hidden;
  }
  &__fill {
    height: 100%;
    border-radius: 3px;
  }
  &__num {
    font-size: 12px;
    font-weight: 600;
    min-width: 42px;
    text-align: right;
  }
}
.ratios {
  font-size: 12px;
}
</style>
