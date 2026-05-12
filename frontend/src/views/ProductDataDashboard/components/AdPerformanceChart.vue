<template>
  <div class="ad-performance-chart bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        广告效果分析
        <el-tag v-if="isCompareMode" size="small" type="info" class="ml-2">对比模式</el-tag>
      </h3>
      <div class="flex items-center gap-1">
        <!-- 大类选择 -->
        <el-select
          v-model="localSelectedCategories"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择大类"
          size="small"
          style="width: 140px"
          @change="handleLocalCategoryChange"
        >
          <el-option
            v-for="(config, key) in CATEGORY_CONFIG"
            :key="key"
            :label="config.label"
            :value="key"
          >
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: config.color }" />
              <span>{{ config.label }}</span>
            </div>
          </el-option>
        </el-select>

        <el-radio-group v-model="showMode" size="small" @change="handleModeChange">
          <el-radio-button label="top5">Top 5</el-radio-button>
          <el-radio-button label="all">全部</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="chartType" size="small">
          <el-radio-button label="acoas">ACoAS</el-radio-button>
          <el-radio-button label="roas">ROAS</el-radio-button>
          <el-radio-button label="ctr">CTR</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div ref="chartRef" class="chart-container" style="height: 350px"></div>
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

const chartType = ref<'acoas' | 'roas' | 'ctr'>('acoas')
const showMode = ref<'all' | 'top5'>('top5')
const localSelectedCategories = ref<string[]>([])

// 从store获取数据
const isCompareMode = computed(() => store.isCompareMode)
const adPerformance = computed(() => store.adPerformance)
const compareAdPerformance = computed(() => store.compareAdPerformance)

// 图表配置
const chartConfig = {
  acoas: { name: 'ACoAS', unit: '%', color: '#EF4444', max: 50 },
  roas: { name: 'ROAS', unit: '', color: '#10B981', max: 5 },
  ctr: { name: 'CTR', unit: '%', color: '#3B82F6', max: 5 }
}

// 获取图表数据
function getChartData() {
  // 优先级：1. 本地多选 > 2. Top 5 模式 > 3. 全部模式
  let categories = Object.keys(CATEGORY_CONFIG)

  if (localSelectedCategories.value.length > 0) {
    categories = localSelectedCategories.value
  } else if (showMode.value === 'top5') {
    // 基于销售额排序取前5
    const sorted = [...adPerformance.value].sort((a, b) => b.adSales - a.adSales)
    categories = sorted.slice(0, 5).map(item => item.category)
    // 如果没有数据，使用默认前5个分类
    if (categories.length === 0) {
      categories = Object.keys(CATEGORY_CONFIG).slice(0, 5)
    }
  }

  // 准备数据
  const currentData: Record<string, number> = {}
  const compareData: Record<string, number> = {}

  categories.forEach(cat => {
    // 本期数据
    const currentStat = adPerformance.value.find(s => s.category === cat)
    if (chartType.value === 'acoas') {
      currentData[cat] = currentStat?.acoas || 0
    } else if (chartType.value === 'roas') {
      currentData[cat] = currentStat?.roas || 0
    } else {
      currentData[cat] = currentStat?.ctr || 0
    }

    // 对比期数据
    if (isCompareMode.value) {
      const compareStat = compareAdPerformance.value.find(s => s.category === cat)
      if (chartType.value === 'acoas') {
        compareData[cat] = compareStat?.acoas || 0
      } else if (chartType.value === 'roas') {
        compareData[cat] = compareStat?.roas || 0
      } else {
        compareData[cat] = compareStat?.ctr || 0
      }
    }
  })

  return { categories, currentData, compareData }
}

// 处理本地类目变化
function handleLocalCategoryChange(vals: string[]) {
  if (vals.length > 0) {
    showMode.value = 'all'
  }
  updateChart()
}

// 处理模式变化
function handleModeChange(val: string) {
  if (val === 'top5') {
    localSelectedCategories.value = []
  }
  updateChart()
}

// 初始化图表
function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表
function updateChart() {
  if (!chart) return

  const { categories, currentData, compareData } = getChartData()
  const config = chartConfig[chartType.value]

  // 准备系列数据
  const series: any[] = []

  // 本期数据系列
  const currentSeriesData = categories.map(cat => currentData[cat] || 0)
  series.push({
    name: '本期',
    type: 'bar',
    data: currentSeriesData,
    itemStyle: { color: config.color },
    emphasis: {
      focus: 'series'
    },
    barWidth: isCompareMode.value ? '30%' : '50%'
  })

  // 对比期数据系列（仅在对比模式下显示）
  if (isCompareMode.value) {
    const compareSeriesData = categories.map(cat => compareData[cat] || 0)
    series.push({
      name: '对比期',
      type: 'bar',
      data: compareSeriesData,
      itemStyle: { color: '#9CA3AF' },
      emphasis: {
        focus: 'series'
      },
      barWidth: '30%'
    })
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const categoryLabels = categories.map(cat =>
          CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]?.label || cat
        )
        const dataIndex = params[0]?.dataIndex
        const categoryLabel = categoryLabels[dataIndex] || ''

        let html = `<div class="font-medium mb-1">${categoryLabel}</div>`

        params.forEach((p: any) => {
          const color = p.color
          const value = p.value
          html += `<div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
            <span>${p.seriesName}:</span>
            <span class="font-bold">${value.toFixed(2)}${config.unit}</span>
          </div>`
        })

        // 显示增长率
        if (isCompareMode.value && params.length === 2) {
          const current = params[0].value
          const compare = params[1].value
          let growth = 0
          if (compare > 0) {
            growth = ((current - compare) / compare) * 100
          }
          const growthColor = growth > 0 ? '#10B981' : growth < 0 ? '#EF4444' : '#6B7280'
          const growthIcon = growth > 0 ? '↑' : growth < 0 ? '↓' : '→'
          html += `<div class="mt-2 pt-2 border-t border-gray-200">
            <span class="text-gray-500">增长率:</span>
            <span style="color: ${growthColor}" class="font-bold ml-1">
              ${growthIcon} ${Math.abs(growth).toFixed(1)}%
            </span>
          </div>`
        }

        return html
      }
    },
    legend: {
      data: isCompareMode.value ? ['本期', '对比期'] : ['本期'],
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 11 }
    },
    grid: {
      left: '2%',
      right: '3%',
      bottom: '12%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories.map(cat => CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]?.label || cat),
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 10,
        rotate: 30,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: config.unit,
      nameTextStyle: { color: '#6B7280', fontSize: 11 },
      max: config.max,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11,
        formatter: `{value}${config.unit}`
      }
    },
    series: series
  }

  chart.setOption(option, true)
}

// 监听变化
watch([chartType, showMode, localSelectedCategories, isCompareMode, adPerformance, compareAdPerformance], updateChart, { deep: true })

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

  // 加载广告数据
  store.fetchAdPerformance()
  if (isCompareMode.value) {
    store.fetchCompareAdPerformance()
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
</style>
