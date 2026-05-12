/**
 * 分类统计数据业务逻辑Composable
 */
import { computed } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import { debounce } from '../../../utils/debounce'

export function useCategoryStats() {
  const store = useProductDataStore()
  
  // 计算属性
  const stats = computed(() => store.categoryStats)
  const loading = computed(() => store.loading.stats)
  const selectedCategory = computed(() => store.selectedCategory)
  
  // 带颜色配置的分类统计
  const statsWithConfig = computed(() => {
    return stats.value.map(stat => ({
      ...stat,
      config: CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG] || {
        name: stat.category,
        label: stat.category,
        color: '#999999',
        icon: 'Box'
      }
    }))
  })
  
  // 按销量排序的分类
  const sortedBySales = computed(() => {
    return [...stats.value].sort((a, b) => b.totalSalesVolume - a.totalSalesVolume)
  })
  
  // 按销售额排序的分类
  const sortedByAmount = computed(() => {
    return [...stats.value].sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)
  })
  
  // 按增长率排序的分类
  const sortedByGrowth = computed(() => {
    return [...stats.value].sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
  })
  
  // 获取分类排名
  function getCategoryRank(category: string, sortBy: 'sales' | 'amount' | 'growth' = 'sales') {
    let sorted: typeof stats.value
    
    switch (sortBy) {
      case 'amount':
        sorted = sortedByAmount.value
        break
      case 'growth':
        sorted = sortedByGrowth.value
        break
      default:
        sorted = sortedBySales.value
    }
    
    const index = sorted.findIndex(s => s.category === category)
    return index >= 0 ? index + 1 : '-'
  }
  
  // 选择分类（防抖）
  const selectCategory = debounce((category: string) => {
    store.setSelectedCategory(category)
    // 刷新相关数据
    store.fetchSalesTrend()
    store.fetchTopProducts()
    store.fetchAdPerformance()
    store.fetchProductList({ page: 1, pageSize: 10 })
  }, 300)

  // 清除分类选择（防抖）
  const clearCategory = debounce(() => {
    store.setSelectedCategory('')
    store.fetchSalesTrend()
    store.fetchTopProducts()
    store.fetchAdPerformance()
  }, 300)
  
  // 格式化数字
  function formatNumber(num: number, decimals: number = 0): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(decimals) + 'K'
    }
    return num.toFixed(decimals)
  }
  
  // 格式化金额
  function formatCurrency(amount: number): string {
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
  
  // 格式化百分比
  function formatPercent(value: number, decimals: number = 1): string {
    return value.toFixed(decimals) + '%'
  }
  
  return {
    // Computed
    stats,
    loading,
    selectedCategory,
    statsWithConfig,
    sortedBySales,
    sortedByAmount,
    sortedByGrowth,
    
    // Methods
    getCategoryRank,
    selectCategory,
    clearCategory,
    formatNumber,
    formatCurrency,
    formatPercent
  }
}
