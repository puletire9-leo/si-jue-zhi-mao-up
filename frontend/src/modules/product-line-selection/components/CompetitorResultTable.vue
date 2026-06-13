<template>
    <div class="result-panel" :class="{ open: resultsVisible }">
    <!-- 头部栏 -->
    <div class="result-header">
      <span class="title">竞品结果</span>
      <span class="count">{{ totalItems }} 条匹配</span>
      <span class="spacer" />

      <el-button
        type="primary"
        size="small"
        :disabled="selectedRows.length === 0"
        @click="$emit('batchSelect', selectedRows)"
      >
        批量加入选品 ({{ selectedRows.length }})
      </el-button>

      <button class="close-btn" @click="$emit('close')">
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table
        :data="tableData"
        stripe
        size="small"
        height="100%"
        @selection-change="handleSelectionChange"
        empty-text="暂无竞品数据"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="asin" label="ASIN" width="140">
          <template #default="{ row }">
            <span class="mono">{{ row.asin }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="商品名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="price" label="价格" width="100" align="right">
          <template #default="{ row }">
            <span class="mono num">£{{ row.price }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="units" label="月销" width="90" align="right">
          <template #default="{ row }">
            <span class="mono num">{{ row.units?.toLocaleString() ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bsr" label="BSR" width="100" align="right">
          <template #default="{ row }">
            <span class="mono num">#{{ row.bsr?.toLocaleString() ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="核心元素" min-width="160">
          <template #default="{ row }">
            <span class="tags">{{ (row.elements || []).slice(0, 3).join(', ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="载体" min-width="120">
          <template #default="{ row }">
            <span class="tags">{{ (row.carriers || []).slice(0, 2).join(', ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="信号" min-width="140">
          <template #default="{ row }">
            <span class="tags">{{ (row.signal_tags || []).join(', ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="场景" min-width="120">
          <template #default="{ row }">
            <span class="tags">{{ (row.scenes || []).slice(0, 2).join(', ') }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 底部分页 -->
    <div class="result-footer">
      <span>{{ pageRange }}</span>
      <span class="spacer" />
      <el-pagination
        v-if="totalItems > 0"
        small
        layout="prev, pager, next"
        :total="totalItems"
        :page-size="pageSize"
        v-model:current-page="currentPage"
        background
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  results?: any[]
  total?: number
  loading?: boolean
  resultsVisible?: boolean
  currentPage?: number  // FIXED: HIGH-2 — 从父组件同步分页状态
}>(), {
  results: () => [],
  total: 0,
  loading: false,
  resultsVisible: false,
  currentPage: 1,  // FIXED: HIGH-2
})

const emit = defineEmits<{
  batchSelect: [rows: any[]]
  viewDetail: [row: any]
  close: []
  pageChange: [page: number]
}>()

const selectedRows = ref<any[]>([])
// FIXED: HIGH-2 — currentPage 从 props 初始化，不再写死 ref(1)
const currentPage = ref(props.currentPage)

// FIXED: HIGH-2 — 父组件 page 变化时同步更新本地 ref
watch(() => props.currentPage, val => {
  currentPage.value = val
}, { immediate: true })
const pageSize = 20

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows
}

function handlePageChange(page: number) {
  emit('pageChange', page)
}

const totalItems = computed(() => props.total)

const tableData = computed(() => props.results)

const pageRange = computed(() => {
  if (totalItems.value === 0) return '0 条数据'
  const start = (currentPage.value - 1) * pageSize + 1
  const end = Math.min(currentPage.value * pageSize, totalItems.value)
  return `${start}–${end} / ${totalItems.value}`
})
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
.tags { font-size: 12px; color: $text-secondary; }

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
