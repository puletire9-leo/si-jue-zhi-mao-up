<template>
  <div class="sales-trend-chart bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        {{ isCompareMode ? '销售趋势对比' : '销售趋势' }}
      </h3>
      <div class="flex items-center gap-2">
        <el-radio-group v-model="chartType" size="small">
          <el-radio-button label="line">折线</el-radio-button>
          <el-radio-button label="bar">柱状</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 对比模式图例 -->
    <div v-if="isCompareMode" class="compare-legend mb-2">
      <div class="legend-item">
        <div class="legend-line current"></div>
        <span class="legend-text">本期数据</span>
      </div>
      <div class="legend-item">
        <div class="legend-line compare"></div>
        <span class="legend-text">对比期数据</span>
      </div>
    </div>

    <div ref="chartRef" class="chart-container" style="height: 320px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'

const store = useProductDataStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const chartType = ref<'line' | 'bar'>('line')

const trendData = computed(() => store.trendData)
const compareTrendData = computed(() => store.compareTrendData)
const selectedCategory = computed(() => store.selectedCategory)
const isCompareMode = computed(() => store.isCompareMode)

// 处理图表数据
const processedData = computed(() => {
  // 对比模式下使用双折线
  if (isCompareMode.value) {
    return processCompareData()
  }
  // 普通模式
  return processNormalData()
})

// 处理普通模式数据
function processNormalData() {
  // 确保trendData有数据
  if (!trendData.value || trendData.value.length === 0) {
    return { dates: [], series: [] }
  }
  
  const dates = [...new Set(trendData.value.map(d => d.date))].sort()
  
  // 从实际的trendData中提取所有唯一的分类
  const allCategories = [...new Set(trendData.value.map(d => d.category))]
  
  // 基础分类列表
  let categories = allCategories
  
  // 优先级：全局单选 > 全部展示
  if (selectedCategory.value) {
    categories = [selectedCategory.value]
  }

  // 构造系列数据
  const series = categories.map(cat => {
    const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]
    const data = dates.map(date => {
      const item = trendData.value.find(d => d.date === date && d.category === cat)
      return item ? item.salesAmount : 0
    })
    return createSeriesItem(config?.label || cat, data, config?.color || '#999')
  })

  return { dates, series }
}

// 处理对比模式数据
function processCompareData() {
  // 合并本期和对比期的所有日期
  const currentDates = [...new Set(trendData.value.map(d => d.date))].sort()
  const compareDates = [...new Set(compareTrendData.value.map(d => d.date))].sort()
  
  // 如果选择了特定分类，只显示该分类的对比
  let categories: string[] = []
  if (selectedCategory.value) {
    categories = [selectedCategory.value]
  } else {
    // 默认显示所有分类的汇总
    categories = ['total']
  }

  const series: any[] = []

  categories.forEach(cat => {
    const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]
    const categoryName = config?.label || cat
    
    // 本期数据
    const currentData = currentDates.map(date => {
      if (cat === 'total') {
        // 汇总所有分类
        return trendData.value
          .filter(d => d.date === date)
          .reduce((sum, d) => sum + d.salesAmount, 0)
      }
      const item = trendData.value.find(d => d.date === date && d.category === cat)
      return item ? item.salesAmount : 0
    })

    // 对比期数据
    const compareData = compareDates.map(date => {
      if (cat === 'total') {
        // 汇总所有分类
        return compareTrendData.value
          .filter(d => d.date === date)
          .reduce((sum, d) => sum + d.salesAmount, 0)
      }
      const item = compareTrendData.value.find(d => d.date === date && d.category === cat)
      return item ? item.salesAmount : 0
    })

    // 使用统一的日期轴（取并集）
    const allDates = [...new Set([...currentDates, ...compareDates])].sort()

    // 本期系列 - 实线
    series.push({
      name: `${categoryName} (本期)`,
      type: 'line',
      data: allDates.map(date => {
        const idx = currentDates.indexOf(date)
        return idx >= 0 ? currentData[idx] : null
      }),
      smooth: true,
      itemStyle: { color: config?.color || '#667eea' },
      lineStyle: { width: 3, type: 'solid' },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: {
        focus: 'series',
        lineStyle: { width: 4 }
      }
    })

    // 对比期系列 - 虚线
    series.push({
      name: `${categoryName} (对比期)`,
      type: 'line',
      data: allDates.map(date => {
        const idx = compareDates.indexOf(date)
        return idx >= 0 ? compareData[idx] : null
      }),
      smooth: true,
      itemStyle: { color: config?.color || '#999' },
      lineStyle: { width: 2, type: 'dashed' },
      symbol: 'emptyCircle',
      symbolSize: 5,
      emphasis: {
        focus: 'series',
        lineStyle: { width: 3 }
      }
    })
  })

  return { dates: [...new Set([...currentDates, ...compareDates])].sort(), series }
}

// 构造系列配置的辅助函数
function createSeriesItem(name: string, data: number[], color: string) {
  return {
    name,
    type: chartType.value,
    data,
    smooth: true,
    itemStyle: { color },
    emphasis: {
      focus: 'series',
      lineStyle: { width: 4 }
    },
    areaStyle: chartType.value === 'line' ? {
      opacity: 0.1,
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color },
        { offset: 1, color: 'transparent' }
      ])
    } : undefined
  }
}

// 初始化图表
function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  updateChart()

  // 点击事件
  chart.on('click', (params: any) => {
    const categoryName = params.seriesName
    // 提取分类名称（去掉"(本期)"或"(对比期)"后缀）
    const cleanName = categoryName.replace(/ \(本期\)| \(对比期\)/, '')
    
    // 优先从实际的trendData中查找匹配的分类
    const matchedCategory = trendData.value.find(d => d.category === cleanName)?.category
    
    // 如果找到匹配的分类，使用它
    if (matchedCategory) {
      store.setSelectedCategory(matchedCategory)
      store.fetchTopProducts()
      store.fetchProductList({ page: 1, pageSize: 10 })
    } else {
      // 否则尝试从CATEGORY_CONFIG中查找
      const category = Object.entries(CATEGORY_CONFIG).find(
        ([, config]) => config.label === cleanName
      )?.[0]
      if (category) {
        store.setSelectedCategory(category)
        store.fetchTopProducts()
        store.fetchProductList({ page: 1, pageSize: 10 })
      }
    }
  })
}

// 更新图表
function updateChart() {
  if (!chart) return

  const { dates, series } = processedData.value

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        let html = `<div class="font-medium mb-1">${params[0].axisValue}</div>`
        // 按数值降序排序
        const sortedParams = [...params].sort((a: any, b: any) => b.value - a.value)
        // 过滤掉值为0或null的数据
        const activeParams = sortedParams.filter((p: any) => p.value > 0)
        
        // 如果没有数据，显示提示
        if (activeParams.length === 0) {
          return html + '<div class="text-gray-400 text-xs">暂无数据</div>'
        }

        // 最多显示前10条
        activeParams.slice(0, 10).forEach((p: any) => {
          html += `<div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" style="background:${p.color}"></span>
            <span>${p.seriesName}:</span>
            <span class="font-bold">$${p.value.toFixed(2)}</span>
          </div>`
        })

        // 如果超过10条，显示提示
        if (activeParams.length > 10) {
          html += `<div class="text-gray-400 text-xs mt-1 pl-4">... 还有 ${activeParams.length - 10} 项</div>`
        }
        
        return html
      }
    },
    legend: {
      type: 'scroll',
      data: series.map(s => s.name),
      bottom: 0,
      pageIconColor: '#606266',
      pageIconInactiveColor: '#C0C4CC'
    },
    grid: {
      left: '2%',
      right: '3%',
      bottom: isCompareMode.value ? '15%' : '12%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: chartType.value === 'bar',
      data: dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: {
        color: '#6B7280',
        formatter: (value: number) => `$${(value / 1000).toFixed(0)}K`
      }
    },
    series: series as any
  }

  chart.setOption(option, true)
}

// 监听数据变化
watch([trendData, compareTrendData, chartType, selectedCategory, isCompareMode], updateChart, { deep: true })

// 窗口大小变化
function handleResize() {
  chart?.resize()
}

// 监听容器尺寸变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
  
  // 使用 ResizeObserver 监听容器尺寸变化
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(chartRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  chart?.dispose()
})
</script>

<style scoped>
.chart-container {
  width: 100%;
}

/* 对比模式图例 */
.compare-legend {
  display: flex;
  gap: 20px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-line {
  width: 30px;
  height: 3px;
  border-radius: 2px;
}

.legend-line.current {
  background: #667eea;
}

.legend-line.compare {
  background: #999;
  border-top: 2px dashed #999;
  height: 0;
}

.legend-text {
  font-size: 12px;
  color: #666;
}
</style>
