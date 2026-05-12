<template>
  <div class="category-ranking bg-white rounded-lg shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-semibold text-gray-800">分类排名</h3>
      <el-radio-group v-model="sortBy" size="small" @change="handleSortChange">
        <el-radio-button label="sales">销量</el-radio-button>
        <el-radio-button label="amount">销售</el-radio-button>
        <el-radio-button label="growth">增长</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 使用 el-table-v2 虚拟滚动优化大数据量渲染 -->
    <el-table-v2
      v-if="sortedData.length > 0"
      :columns="columns"
      :data="sortedData"
      :width="tableWidth"
      :height="Math.min(sortedData.length * 50 + 40, 400)"
      fixed
      class="category-table"
    />
    <el-empty v-else description="暂无数据" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { ElTag, ElButton, ElIcon } from 'element-plus'

const store = useProductDataStore()
const sortBy = ref<'sales' | 'amount' | 'growth'>('sales')
const tableWidth = ref(800)

const categoryStats = computed(() => store.categoryStats)
const compareCategoryStats = computed(() => store.compareCategoryStats)
const isCompareMode = computed(() => store.isCompareMode)

// 计算增长率
function calculateGrowthRate(current: number, compare: number): number {
  if (compare === 0) return current > 0 ? 100 : 0
  return parseFloat(((current - compare) / compare * 100).toFixed(2))
}

// 带配置的统计数据（包含增长率计算）
const statsWithConfig = computed(() => {
  return categoryStats.value.map(stat => {
    // 查找对比期数据
    const compareStat = compareCategoryStats.value.find(
      s => s.category === stat.category
    )

    // 计算增长率（对比模式下）
    let growthRate = stat.growthRate || 0
    if (isCompareMode.value && compareStat) {
      growthRate = calculateGrowthRate(
        stat.totalSalesAmount,
        compareStat.totalSalesAmount
      )
    }

    return {
      ...stat,
      growthRate,
      config: CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG] || {
        name: stat.category,
        label: stat.category,
        color: '#999999',
        icon: 'Box'
      }
    }
  })
})

// 排序后的数据
const sortedData = computed(() => {
  const data = [...statsWithConfig.value]
  switch (sortBy.value) {
    case 'amount':
      return data.sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)
    case 'growth':
      return data.sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
    default:
      return data.sort((a, b) => b.totalSalesVolume - a.totalSalesVolume)
  }
})

// 获取排名样式
function getRankClass(index: number) {
  if (index === 0) return 'bg-yellow-100 text-yellow-700'
  if (index === 1) return 'bg-gray-100 text-gray-700'
  if (index === 2) return 'bg-orange-100 text-orange-700'
  return 'bg-blue-50 text-blue-600'
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 格式化金额
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

// 排序变化
function handleSortChange() {
  // 排序已通过computed自动更新
}

// 行点击
function handleRowClick(row: any) {
  store.setSelectedCategory(row.category)
  store.fetchTopProducts()
  store.fetchProductList({ page: 1, pageSize: 10 })
}

// 查看详情
function viewDetail(category: string) {
  store.setSelectedCategory(category)
  store.setViewMode('developer')
}

// 定义表格列 - 使用 as const 确保类型正确
const columns = [
  {
    key: 'rank',
    title: '排名',
    width: 60,
    align: 'center' as const,
    cellRenderer: ({ rowIndex }: { rowIndex: number }) => {
      return h('div', {
        class: `w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${getRankClass(rowIndex)}`
      }, rowIndex + 1)
    }
  },
  {
    key: 'category',
    title: '分类',
    width: 140,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      return h('div', { class: 'flex items-center gap-2' }, [
        h('div', {
          class: 'w-3 h-3 rounded-full',
          style: { backgroundColor: rowData.config.color }
        }),
        h('span', { class: 'font-medium' }, rowData.config.label)
      ])
    }
  },
  {
    key: 'productCount',
    title: '产品数',
    width: 100,
    align: 'center' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      return h('span', { class: 'font-semibold' }, rowData.productCount)
    }
  },
  {
    key: 'totalSalesVolume',
    title: '销量',
    width: 120,
    align: 'right' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      return h('span', { class: 'font-semibold' }, formatNumber(rowData.totalSalesVolume))
    }
  },
  {
    key: 'totalSalesAmount',
    title: '销售额',
    width: 140,
    align: 'right' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      return h('span', { class: 'font-semibold text-orange-600' }, formatCurrency(rowData.totalSalesAmount))
    }
  },
  {
    key: 'avgAcoas',
    title: 'ACOS',
    width: 100,
    align: 'center' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      const acoas = rowData.avgAcoas || 0
      const type = acoas < 25 ? 'success' : acoas < 30 ? 'warning' : 'danger'
      return h(ElTag, { type, size: 'small' }, () => `${acoas.toFixed(1)}%`)
    }
  },
  {
    key: 'growthRate',
    title: '增长率',
    width: 100,
    align: 'center' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      const rate = rowData.growthRate || 0
      const isPositive = rate > 0
      return h('div', {
        class: `flex items-center justify-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`
      }, [
        h(ElIcon, null, () => isPositive ? h(ArrowUp) : h(ArrowDown)),
        h('span', {}, `${Math.abs(rate).toFixed(1)}%`)
      ])
    }
  },
  {
    key: 'action',
    title: '操作',
    width: 100,
    align: 'center' as const,
    cellRenderer: ({ rowData }: { rowData: any }) => {
      return h(ElButton, {
        type: 'primary',
        link: true,
        size: 'small',
        onClick: (e: Event) => {
          e.stopPropagation()
          viewDetail(rowData.category)
        }
      }, () => '查看详情')
    }
  }
]
</script>

<style scoped>
.category-table {
  cursor: pointer;
}

:deep(.el-table-v2__row:hover) {
  background-color: #F9FAFB;
}
</style>
