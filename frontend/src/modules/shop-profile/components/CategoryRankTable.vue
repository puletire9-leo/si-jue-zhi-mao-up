<template>
  <el-table :data="rows" v-loading="loading" border stripe size="small">
    <el-table-column label="等级" width="80">
      <template #default="{ row }">
        <el-tag :type="tierTagType(row.salesTier)" size="small" effect="light">{{ row.salesTier }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="categoryKey" label="榜单类目" min-width="240" show-overflow-tooltip />
    <el-table-column label="商品数" width="100" align="right">
      <template #default="{ row }"><span class="mono">{{ num(row.productCount) }}</span></template>
    </el-table-column>
    <el-table-column label="销量合计" width="120" align="right">
      <template #default="{ row }"><span class="mono">{{ num(row.unitsSum) }}</span></template>
    </el-table-column>
    <el-table-column label="平均销量" width="120" align="right">
      <template #default="{ row }">
        <span class="mono">{{ row.unitsAvg != null ? Math.round(row.unitsAvg).toLocaleString('en-US') : '—' }}</span>
      </template>
    </el-table-column>
    <template #empty>
      <el-empty description="暂无类目数据" />
    </template>
  </el-table>
</template>

<script setup lang="ts">
import type { ShopProfileCategory } from '@/types/shopProfile'
import { num, tierTagType } from '../utils'

defineProps<{
  rows: ShopProfileCategory[]
  loading?: boolean
}>()
</script>

<style scoped lang="scss">
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
</style>
