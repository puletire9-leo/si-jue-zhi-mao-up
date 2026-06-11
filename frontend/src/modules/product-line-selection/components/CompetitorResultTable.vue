<template>
  <div class="result-panel" :class="{ open: store.resultsVisible }">
    <!-- 头部栏 -->
    <div class="result-header">
      <span class="title">竞品结果</span>
      <span class="count">{{ mockResults.length }} 条匹配</span>
      <span class="spacer" />

      <el-button
        type="primary"
        size="small"
        :disabled="selectedRows.length === 0"
        @click="$emit('batchSelect', selectedRows)"
      >
        批量加入选品 ({{ selectedRows.length }})
      </el-button>

      <button class="close-btn" @click="store.closeResults()">
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table
        :data="mockResults"
        stripe
        size="small"
        height="100%"
        @selection-change="handleSelectionChange"
        empty-text="暂无竞品数据"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="asin" label="ASIN" width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.asin }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="商品名称" min-width="240" show-overflow-tooltip />
        <el-table-column prop="price" label="价格" width="100" align="right">
          <template #default="{ row }">
            <span class="mono">{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bsr" label="BSR" width="100" align="right">
          <template #default="{ row }">
            <span class="mono">#{{ row.bsr?.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="rating" label="评分" width="90" align="center">
          <template #default="{ row }">
            <span class="mono rating">{{ row.rating }} ★</span>
          </template>
        </el-table-column>
        <el-table-column prop="matchScore" label="元素匹配" width="100" align="center">
          <template #default="{ row }">
            <span class="mono">{{ row.matchScore }}/10</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <span class="pill" :class="row.status">
              {{ row.status === 'sell' ? '在售' : row.status === 'new' ? '新品' : '缺货' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$emit('viewDetail', row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 底部分页 -->
    <div class="result-footer">
      <span>1–8 / {{ mockResults.length }}</span>
      <span class="spacer" />
      <el-pagination
        small
        layout="prev, pager, next"
        :total="mockResults.length"
        :page-size="8"
        background
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { useProductLineSelectionStore } from '../store'

defineEmits<{
  batchSelect: [rows: any[]]
  viewDetail: [row: any]
}>()

const store = useProductLineSelectionStore()
const selectedRows = ref<any[]>([])

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows
}

// ---- 模拟数据 ----
const mockResults = ref([
  { asin: 'B0DGH4T7RK', title: '便携式不锈钢咖啡研磨器 — 手摇款', price: '¥189', bsr: 847, rating: 4.6, matchScore: 8, status: 'sell' },
  { asin: 'B0DKL9M2NP', title: '不锈钢便携咖啡粉研磨机 — 电动', price: '¥268', bsr: 1203, rating: 4.3, matchScore: 7, status: 'sell' },
  { asin: 'B0CFHR8WJX', title: '便携式不锈钢研磨器套装 — 粗中细三档', price: '¥245', bsr: 562, rating: 4.8, matchScore: 9, status: 'new' },
  { asin: 'B0NGT5PLXA', title: '不锈钢便携研磨器 — 陶瓷刀盘', price: '¥156', bsr: 3421, rating: 4.4, matchScore: 6, status: 'out' },
  { asin: 'B0PXQ9RDJK', title: '专业级不锈钢咖啡磨豆机 — 便携式', price: '¥320', bsr: 412, rating: 4.7, matchScore: 9, status: 'sell' },
  { asin: 'B0ZMW2KTNL', title: '不锈钢研磨器 — 便携露营款', price: '¥178', bsr: 2108, rating: 4.5, matchScore: 7, status: 'sell' },
  { asin: 'B0AKL7HNXC', title: '手动不锈钢研磨器 — 便携式薄款', price: '¥135', bsr: 5723, rating: 4.2, matchScore: 5, status: 'sell' },
  { asin: 'B0DYU3VMQP', title: '便携式咖啡研磨器 — 不锈钢双层', price: '¥199', bsr: 1876, rating: 4.6, matchScore: 8, status: 'sell' },
])
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.result-panel {
  border-top: 1px solid $border-color;
  background: $bg-color;
  display: flex;
  flex-direction: column;
  transition: height 0.3s ease;

  &:not(.open) { height: 0; border-top: none; overflow: hidden; }
  &.open { height: 45vh; min-height: 320px; }
}

.result-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid $border-color;
  background: $bg-hover;
  flex-shrink: 0;

  .title { font-size: 14px; font-weight: 600; }
  .count { font-size: 12px; color: $text-tertiary; }
  .spacer { flex: 1; }
}

.close-btn {
  width: 28px; height: 28px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-color;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  color: $text-secondary;

  &:hover { background: $bg-hover; }
}

.table-wrap { flex: 1; overflow: hidden; }

.mono { font-family: $font-family-mono; font-size: 12px; }
.rating { color: #ca8a04; font-weight: 600; }

.pill {
  display: inline-block; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: $radius-sm; letter-spacing: 0.02em;

  &.sell { background: rgba($success-color, 0.08); color: $success-color; }
  &.new { background: rgba($primary-color, 0.08); color: $primary-color; }
  &.out { background: rgba($danger-color, 0.06); color: $danger-color; }
}

.result-footer {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 20px;
  border-top: 1px solid $border-color;
  background: $bg-hover;
  font-size: 12px;
  color: $text-secondary;
  flex-shrink: 0;

  .spacer { flex: 1; }
}
</style>
