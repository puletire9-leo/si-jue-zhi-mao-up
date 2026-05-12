/**
 * 产品数据状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  CategoryStats,
  ProductData,
  ProductListParams,
  FilterParams,
  ViewMode,
  TimeDimension,
  TrendData,
  TopProduct,
  AdPerformance
} from '../types/productData'
import { productDataApi } from '../api/productData'

export const useProductDataStore = defineStore('productData', () => {
  // ========== State ==========
  const currentView = ref<ViewMode>('manager')
  const selectedCategory = ref<string>('')
  const timeDimension = ref<TimeDimension>('day')
  const dateRange = ref<[string, string]>(['', ''])
  const filters = ref<FilterParams>({})

  // 数据状态
  const availableMonths = ref<string[]>([])
  const categoryStats = ref<CategoryStats[]>([])
  const productList = ref<ProductData[]>([])
  const productTotal = ref(0)
  const trendData = ref<TrendData[]>([])
  const topProducts = ref<TopProduct[]>([])
  const adPerformance = ref<AdPerformance[]>([])

  // ========== 对比模式状态 ==========
  const isCompareMode = ref(false)
  const compareDateRange = ref<[string, string]>(['', ''])
  const compareType = ref<'previous_period' | 'last_week' | 'last_month' | 'last_year' | 'custom'>('previous_period')
  
  // 对比期数据
  const compareCategoryStats = ref<CategoryStats[]>([])
  const compareTrendData = ref<TrendData[]>([])
  const compareTopProducts = ref<TopProduct[]>([])
  const compareAdPerformance = ref<AdPerformance[]>([])

  // 筛选选项
  const filterOptions = ref({
    stores: [] as string[],
    countries: [] as string[],
    developers: [] as string[],
    categories: [] as string[]
  })

  // 加载状态
  const loading = ref({
    categoryStats: false,
    products: false,
    trend: false,
    topProducts: false,
    adPerformance: false,
    filterOptions: false
  })

  // 初始化标记，防止重复初始化
  const isInitialized = ref(false)
  // 全局加载锁，防止并发请求
  const isLoading = ref(false)
  // 待处理请求队列（用于防抖）
  const pendingRequests = new Map<string, Promise<any>>()

  // ========== 请求去重辅助函数 ==========
  /**
   * 执行带去重的请求
   * @param key 请求唯一标识
   * @param fetcher 请求函数
   * @returns 请求结果
   */
  async function fetchWithDedup<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // 如果有正在进行的相同请求，直接返回
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key) as Promise<T>
    }

    // 创建新请求
    const promise = fetcher().finally(() => {
      // 请求完成后从队列中移除
      pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise)
    return promise
  }

  // ========== Getters ==========
  const currentCategoryStats = computed(() => {
    if (!selectedCategory.value) return null
    return categoryStats.value.find(c => c.category === selectedCategory.value) || null
  })

  const totalStats = computed(() => {
    return categoryStats.value.reduce((acc, cat) => ({
      productCount: acc.productCount + cat.productCount,
      totalSalesVolume: acc.totalSalesVolume + cat.totalSalesVolume,
      totalSalesAmount: acc.totalSalesAmount + cat.totalSalesAmount,
      totalOrderQuantity: acc.totalOrderQuantity + cat.totalOrderQuantity,
      totalAdSpend: acc.totalAdSpend + cat.totalAdSpend,
      totalAdSales: acc.totalAdSales + cat.totalAdSales
    }), {
      productCount: 0,
      totalSalesVolume: 0,
      totalSalesAmount: 0,
      totalOrderQuantity: 0,
      totalAdSpend: 0,
      totalAdSales: 0
    })
  })

  const avgAcoas = computed(() => {
    const { totalAdSpend, totalSalesAmount } = totalStats.value
    if (totalSalesAmount === 0) return 0
    return parseFloat((totalAdSpend / totalSalesAmount * 100).toFixed(2))
  })

  const avgRoas = computed(() => {
    const { totalAdSpend, totalAdSales } = totalStats.value
    if (totalAdSpend === 0) return 0
    return parseFloat((totalAdSales / totalAdSpend).toFixed(2))
  })

  // ========== 对比模式 Getters ==========
  
  // 对比期统计数据
  const compareTotalStats = computed(() => {
    return compareCategoryStats.value.reduce((acc, cat) => ({
      productCount: acc.productCount + cat.productCount,
      totalSalesVolume: acc.totalSalesVolume + cat.totalSalesVolume,
      totalSalesAmount: acc.totalSalesAmount + cat.totalSalesAmount,
      totalOrderQuantity: acc.totalOrderQuantity + cat.totalOrderQuantity,
      totalAdSpend: acc.totalAdSpend + cat.totalAdSpend,
      totalAdSales: acc.totalAdSales + cat.totalAdSales
    }), {
      productCount: 0,
      totalSalesVolume: 0,
      totalSalesAmount: 0,
      totalOrderQuantity: 0,
      totalAdSpend: 0,
      totalAdSales: 0
    })
  })

  // 对比期平均ACoAS
  const compareAvgAcoas = computed(() => {
    const { totalAdSpend, totalSalesAmount } = compareTotalStats.value
    if (totalSalesAmount === 0) return 0
    return parseFloat((totalAdSpend / totalSalesAmount * 100).toFixed(2))
  })

  // 对比期平均ROAS
  const compareAvgRoas = computed(() => {
    const { totalAdSpend, totalAdSales } = compareTotalStats.value
    if (totalAdSpend === 0) return 0
    return parseFloat((totalAdSales / totalAdSpend).toFixed(2))
  })

  // 增长率计算
  const growthRates = computed(() => {
    const current = totalStats.value
    const compare = compareTotalStats.value
    
    const calculateGrowth = (current: number, compare: number) => {
      if (compare === 0) return current > 0 ? 100 : 0
      return parseFloat(((current - compare) / compare * 100).toFixed(2))
    }
    
    return {
      productCount: calculateGrowth(current.productCount, compare.productCount),
      salesVolume: calculateGrowth(current.totalSalesVolume, compare.totalSalesVolume),
      salesAmount: calculateGrowth(current.totalSalesAmount, compare.totalSalesAmount),
      orderQuantity: calculateGrowth(current.totalOrderQuantity, compare.totalOrderQuantity),
      adSpend: calculateGrowth(current.totalAdSpend, compare.totalAdSpend),
      acoas: parseFloat((avgAcoas.value - compareAvgAcoas.value).toFixed(2)),
      roas: parseFloat((avgRoas.value - compareAvgRoas.value).toFixed(2))
    }
  })

  // ========== Actions ==========
  
  // 切换视图模式
  function setViewMode(mode: ViewMode) {
    currentView.value = mode
  }

  // 设置选中分类
  function setSelectedCategory(category: string) {
    selectedCategory.value = category
  }

  // 设置日期范围
  function setDateRange(range: [string, string]) {
    dateRange.value = range
  }

  // ========== 对比模式 Actions ==========
  
  // 设置对比模式
  function setCompareMode(mode: boolean) {
    isCompareMode.value = mode
    if (!mode) {
      // 关闭对比模式时清空对比数据
      compareDateRange.value = ['', '']
      compareCategoryStats.value = []
      compareTrendData.value = []
      compareTopProducts.value = []
      compareAdPerformance.value = []
    }
  }

  // 设置对比期日期范围
  function setCompareDateRange(range: [string, string]) {
    compareDateRange.value = range
  }

  // 设置对比类型
  function setCompareType(type: 'previous_period' | 'last_week' | 'last_month' | 'last_year' | 'custom') {
    compareType.value = type
  }

  // 获取对比期分类统计数据
  async function fetchCompareCategoryStats() {
    if (!isCompareMode.value || !compareDateRange.value[0] || !compareDateRange.value[1]) {
      console.log('[Store] 跳过获取对比期分类统计，条件不满足:', {
        isCompareMode: isCompareMode.value,
        dateRange: compareDateRange.value
      })
      return
    }
    
    try {
      console.log('[Store] 获取对比期分类统计:', compareDateRange.value)
      const requestKey = `compareCategoryStats:${compareDateRange.value[0]}:${compareDateRange.value[1]}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getCategoryStats({
          startDate: compareDateRange.value[0],
          endDate: compareDateRange.value[1],
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      console.log('[Store] 对比期分类统计响应:', res)
      if (res.code === 200) {
        compareCategoryStats.value = res.data || []
        console.log('[Store] 对比期分类统计已更新:', compareCategoryStats.value)
      }
    } catch (error) {
      console.error('获取对比期分类统计失败:', error)
      compareCategoryStats.value = []
    }
  }

  // 获取对比期销售趋势
  async function fetchCompareSalesTrend(months: number = 6) {
    if (!isCompareMode.value || !compareDateRange.value[0] || !compareDateRange.value[1]) return
    
    try {
      const requestKey = `compareSalesTrend:${selectedCategory.value}:${compareDateRange.value[0]}:${compareDateRange.value[1]}:${timeDimension.value}:${months}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getSalesTrend({
          category: selectedCategory.value || undefined,
          startDate: compareDateRange.value[0],
          endDate: compareDateRange.value[1],
          timeDimension: timeDimension.value,
          months,
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        compareTrendData.value = res.data || []
      }
    } catch (error) {
      console.error('获取对比期销售趋势失败:', error)
      compareTrendData.value = []
    }
  }

  // 获取对比期TOP产品
  async function fetchCompareTopProducts(limit: number = 10) {
    if (!isCompareMode.value || !compareDateRange.value[0] || !compareDateRange.value[1]) return
    
    try {
      const requestKey = `compareTopProducts:${selectedCategory.value}:${compareDateRange.value[0]}:${compareDateRange.value[1]}:${limit}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getTopProducts({
          category: selectedCategory.value || undefined,
          startDate: compareDateRange.value[0],
          endDate: compareDateRange.value[1],
          limit,
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        compareTopProducts.value = res.data || []
      }
    } catch (error) {
      console.error('获取对比期TOP产品失败:', error)
      compareTopProducts.value = []
    }
  }

  // 获取对比期广告表现
  async function fetchCompareAdPerformance() {
    if (!isCompareMode.value || !compareDateRange.value[0] || !compareDateRange.value[1]) return
    
    try {
      const requestKey = `compareAdPerformance:${selectedCategory.value}:${compareDateRange.value[0]}:${compareDateRange.value[1]}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getAdPerformance({
          category: selectedCategory.value || undefined,
          startDate: compareDateRange.value[0],
          endDate: compareDateRange.value[1],
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        compareAdPerformance.value = res.data || []
      }
    } catch (error) {
      console.error('获取对比期广告表现失败:', error)
      compareAdPerformance.value = []
    }
  }

  // 刷新对比数据
  async function refreshCompareData() {
    if (!isCompareMode.value) {
      console.log('[Store] 不在对比模式，跳过加载对比数据')
      return
    }
    
    console.log('[Store] 开始加载对比数据，对比期:', compareDateRange.value)
    
    await Promise.all([
      fetchCompareCategoryStats(),
      fetchCompareSalesTrend(),
      fetchCompareTopProducts(),
      fetchCompareAdPerformance()
    ])
    
    console.log('[Store] 对比数据加载完成:', {
      categoryStats: compareCategoryStats.value,
      trendData: compareTrendData.value
    })
  }

  // 设置时间维度
  function setTimeDimension(dimension: TimeDimension) {
    timeDimension.value = dimension
  }

  // 设置筛选条件
  function setFilters(newFilters: FilterParams) {
    filters.value = { ...filters.value, ...newFilters }
  }

  // 重置筛选条件
  function resetFilters() {
    filters.value = {}
    selectedCategory.value = ''
  }

  // 获取可用月份
  async function fetchAvailableMonths() {
    try {
      const res = await productDataApi.getAvailableMonths()
      if (res.code === 200) {
        availableMonths.value = res.data || []
        if (availableMonths.value.length > 0 && !dateRange.value[0]) {
          const latestMonth = availableMonths.value[0]
          // 默认设置为该月的第一天和最后一天
          dateRange.value = [`${latestMonth}-01`, `${latestMonth}-31`]
        }
      }
    } catch (error) {
      console.error('获取可用月份失败:', error)
      availableMonths.value = []
    }
  }

  // 获取分类统计数据
  async function fetchCategoryStats() {
    if (loading.value.categoryStats) return // 防止重复请求
    loading.value.categoryStats = true
    try {
      // 构建请求唯一标识
      const requestKey = `categoryStats:${dateRange.value[0]}:${dateRange.value[1]}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getCategoryStats({
          startDate: dateRange.value[0],
          endDate: dateRange.value[1],
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        console.log('[Store] 接收到的分类统计数据:', res.data)
        console.log('[Store] 第一条数据:', res.data?.[0])
        console.log('[Store] 数据长度:', res.data?.length)
        // 检查字段名是否匹配
        if (res.data?.[0]) {
          console.log('[Store] 字段名检查:', Object.keys(res.data[0]))
        }
        categoryStats.value = res.data || []
        console.log('[Store] 存储后的categoryStats:', categoryStats.value)
        console.log('[Store] 存储后的长度:', categoryStats.value.length)
      }
    } catch (error) {
      console.error('获取分类统计失败:', error)
      categoryStats.value = []
    } finally {
      loading.value.categoryStats = false
    }
  }

  // 获取产品明细列表
  async function fetchProductList(params: { 
    page: number; 
    pageSize: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    loading.value.products = true
    try {
      const res = await productDataApi.getProductList({
        page: params.page,
        pageSize: params.pageSize,
        filters: {
          ...filters.value,
          category: selectedCategory.value || undefined,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1]
        },
        sortField: params.sortField,
        sortOrder: params.sortOrder
      })
      if (res.code === 200) {
        productList.value = res.data.list || []
        productTotal.value = res.data.total || 0
      }
    } catch (error) {
      console.error('获取产品列表失败:', error)
      productList.value = []
      productTotal.value = 0
    } finally {
      loading.value.products = false
    }
  }

  // 获取销售趋势
  async function fetchSalesTrend(months: number = 6) {
    if (loading.value.trend) return // 防止重复请求
    loading.value.trend = true
    try {
      // 构建请求唯一标识
      const requestKey = `salesTrend:${selectedCategory.value}:${dateRange.value[0]}:${dateRange.value[1]}:${timeDimension.value}:${months}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getSalesTrend({
          category: selectedCategory.value || undefined,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1],
          timeDimension: timeDimension.value,
          months,
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        trendData.value = res.data || []
      }
    } catch (error) {
      console.error('获取销售趋势失败:', error)
      trendData.value = []
    } finally {
      loading.value.trend = false
    }
  }

  // 获取TOP产品
  async function fetchTopProducts(limit: number = 10) {
    if (loading.value.topProducts) return // 防止重复请求
    loading.value.topProducts = true
    try {
      // 构建请求唯一标识
      const requestKey = `topProducts:${selectedCategory.value}:${dateRange.value[0]}:${dateRange.value[1]}:${limit}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getTopProducts({
          category: selectedCategory.value || undefined,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1],
          limit,
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        topProducts.value = res.data || []
      }
    } catch (error) {
      console.error('获取TOP产品失败:', error)
      topProducts.value = []
    } finally {
      loading.value.topProducts = false
    }
  }

  // 获取广告表现
  async function fetchAdPerformance() {
    if (loading.value.adPerformance) return // 防止重复请求
    loading.value.adPerformance = true
    try {
      // 构建请求唯一标识
      const requestKey = `adPerformance:${selectedCategory.value}:${dateRange.value[0]}:${dateRange.value[1]}:${filters.value.store}:${filters.value.country}:${filters.value.developer}`

      const res = await fetchWithDedup(requestKey, () =>
        productDataApi.getAdPerformance({
          category: selectedCategory.value || undefined,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1],
          store: filters.value.store,
          country: filters.value.country,
          developer: filters.value.developer
        })
      )
      if (res.code === 200) {
        adPerformance.value = res.data || []
      }
    } catch (error) {
      console.error('获取广告表现失败:', error)
      adPerformance.value = []
    } finally {
      loading.value.adPerformance = false
    }
  }

  // 获取筛选选项
  async function fetchFilterOptions() {
    loading.value.filterOptions = true
    try {
      const res = await productDataApi.getFilterOptions()
      if (res.code === 200) {
        filterOptions.value = res.data || {
          stores: [],
          countries: [],
          developers: [],
          categories: []
        }
      }
    } catch (error) {
      console.error('获取筛选选项失败:', error)
    } finally {
      loading.value.filterOptions = false
    }
  }

  // 导出数据
  async function exportData() {
    try {
      const blob = await productDataApi.exportData({
        filters: {
          ...filters.value,
          category: selectedCategory.value || undefined,
          startDate: dateRange.value[0],
          endDate: dateRange.value[1]
        }
      })
      
      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `product-data-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出数据失败:', error)
    }
  }

  // 初始化加载所有数据（分阶段加载，核心数据优先）
  async function init() {
    // 如果正在初始化或已完成初始化，则跳过
    if (isLoading.value || isInitialized.value) {
      return
    }

    isLoading.value = true
    try {
      // 第一阶段：加载基础配置
      await fetchAvailableMonths()

      // 第二阶段：并行加载核心数据（分类统计和筛选选项）
      await Promise.all([
        fetchCategoryStats(),
        fetchFilterOptions()
      ])

      // 标记初始化完成，让 UI 可以渲染核心内容
      isInitialized.value = true

      // 第三阶段：异步加载次要数据（趋势、TOP产品、广告表现）
      // 使用 requestIdleCallback 或增加延迟时间，让主线程有足够时间渲染UI
      const loadSecondaryData = () => {
        // 分批加载，避免同时发起过多请求
        fetchSalesTrend()
        // 延迟加载其他数据，减轻网络压力
        setTimeout(() => fetchTopProducts(), 200)
        setTimeout(() => fetchAdPerformance(), 400)
      }

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(loadSecondaryData, { timeout: 1000 })
      } else {
        setTimeout(loadSecondaryData, 300)
      }
    } finally {
      isLoading.value = false
    }
  }

  // 强制刷新所有数据（用于筛选条件变更时）
  async function refresh() {
    isLoading.value = true
    try {
      // 核心数据优先加载
      await fetchCategoryStats()

      // 次要数据并行加载
      await Promise.all([
        fetchSalesTrend(),
        fetchTopProducts(),
        fetchAdPerformance()
      ])
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    currentView,
    selectedCategory,
    timeDimension,
    dateRange,
    filters,
    availableMonths,
    categoryStats,
    productList,
    productTotal,
    trendData,
    topProducts,
    adPerformance,
    filterOptions,
    loading,
    
    // 对比模式 State
    isCompareMode,
    compareDateRange,
    compareType,
    compareCategoryStats,
    compareTrendData,
    compareTopProducts,
    compareAdPerformance,
    
    // Getters
    currentCategoryStats,
    totalStats,
    avgAcoas,
    avgRoas,
    compareTotalStats,
    compareAvgAcoas,
    compareAvgRoas,
    growthRates,
    
    // Actions
    setViewMode,
    setSelectedCategory,
    setTimeDimension,
    setDateRange,
    setFilters,
    resetFilters,
    setCompareMode,
    setCompareDateRange,
    setCompareType,
    fetchCategoryStats,
    fetchAvailableMonths,
    fetchProductList,
    fetchSalesTrend,
    fetchTopProducts,
    fetchAdPerformance,
    fetchFilterOptions,
    fetchCompareCategoryStats,
    fetchCompareSalesTrend,
    fetchCompareTopProducts,
    fetchCompareAdPerformance,
    refreshCompareData,
    exportData,
    init,
    refresh
  }
})
