<template>
  <div class="exposure-click-card bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        曝光点击
        <el-tag v-if="isCompareMode" size="small" type="info" class="ml-2">对比模式</el-tag>
      </h3>
    </div>

    <!-- 指标卡片 - 横向排列 -->
    <div class="flex gap-4 mb-3">
      <div class="metric-item flex-1">
        <div class="metric-label">曝光</div>
        <div class="metric-value">{{ currentMetrics.impressions.toLocaleString() }}</div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(currentMetrics.impressions, compareMetrics.impressions)">
          {{ formatChange(currentMetrics.impressions, compareMetrics.impressions) }}
        </div>
      </div>
      <div class="metric-item flex-1">
        <div class="metric-label">点击</div>
        <div class="metric-value">{{ currentMetrics.clicks.toLocaleString() }}</div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(currentMetrics.clicks, compareMetrics.clicks)">
          {{ formatChange(currentMetrics.clicks, compareMetrics.clicks) }}
        </div>
      </div>
      <div class="metric-item flex-1">
        <div class="metric-label">CTR</div>
        <div class="metric-value">{{ currentMetrics.ctr.toFixed(2) }}%</div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(currentMetrics.ctr, compareMetrics.ctr)">
          {{ formatChange(currentMetrics.ctr, compareMetrics.ctr) }}
        </div>
      </div>
    </div>

    <!-- 图表 -->
    <div ref="chartRef" class="chart-container" style="height: 180px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useProductDataStore } from '../../../stores/productData'

const store = useProductDataStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

// 从store获取数据
const isCompareMode = computed(() => store.isCompareMode)
const trendData = computed(() => store.trendData)
const compareTrendData = computed(() => store.compareTrendData)

// 计算指标数据
const currentMetrics = computed(() => {
  const data = trendData.value
  const impressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0)
  const clicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0)
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  return {
    impressions,
    clicks,
    ctr
  }
})

const compareMetrics = computed(() => {
  const data = compareTrendData.value
  const impressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0)
  const clicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0)
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  return {
    impressions,
    clicks,
    ctr
  }
})

// 获取变化样式
function getChangeClass(current: number, compare: number): string {
  if (compare === 0) return 'neutral'
  const change = ((current - compare) / compare) * 100
  return change >= 0 ? 'up' : 'down'
}

// 格式化变化
function formatChange(current: number, compare: number): string {
  if (compare === 0) return '-'
  const change = ((current - compare) / compare) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

// 处理趋势数据
function processTrendData(data: any[]) {
  const dates: string[] = []
  const impressionsData: number[] = []
  const clicksData: number[] = []
  const ctrData: number[] = []

  // 按日期分组聚合数据
  const groupedData = new Map<string, { impressions: number; clicks: number }>()

  data.forEach(item => {
    const date = item.date
    if (!groupedData.has(date)) {
      groupedData.set(date, { impressions: 0, clicks: 0 })
    }
    const group = groupedData.get(date)!
    group.impressions += item.impressions || 0
    group.clicks += item.clicks || 0
  })

  // 转换为数组并按日期排序
  const sortedDates = Array.from(groupedData.keys()).sort()

  sortedDates.forEach(date => {
    const item = groupedData.get(date)!
    dates.push(date)
    impressionsData.push(item.impressions)
    clicksData.push(item.clicks)
    ctrData.push(item.impressions > 0 ? parseFloat(((item.clicks / item.impressions) * 100).toFixed(2)) : 0)
  })

  return { dates, impressionsData, clicksData, ctrData }
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

  const currentProcessed = processTrendData(trendData.value)
  const compareProcessed = processTrendData(compareTrendData.value)

  // 如果没有数据，显示空状态
  if (currentProcessed.dates.length === 0) {
    chart.setOption({
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#999', fontSize: 14 }
      }
    }, true)
    return
  }

  const series: echarts.SeriesOption[] = []

  if (isCompareMode.value && compareProcessed.dates.length > 0) {
    // 对比模式：显示本期和对比期数据
    series.push(
      {
        name: '本期曝光',
        type: 'bar',
        data: currentProcessed.impressionsData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '15%'
      },
      {
        name: '对比期曝光',
        type: 'bar',
        data: compareProcessed.impressionsData,
        itemStyle: { color: '#93C5FD' },
        barWidth: '15%'
      },
      {
        name: '本期点击',
        type: 'bar',
        data: currentProcessed.clicksData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '15%'
      },
      {
        name: '对比期点击',
        type: 'bar',
        data: compareProcessed.clicksData,
        itemStyle: { color: '#86EFAC' },
        barWidth: '15%'
      },
      {
        name: '本期CTR',
        type: 'line',
        yAxisIndex: 1,
        data: currentProcessed.ctrData,
        itemStyle: { color: '#FB923C' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 4
      },
      {
        name: '对比期CTR',
        type: 'line',
        yAxisIndex: 1,
        data: compareProcessed.ctrData,
        itemStyle: { color: '#FDBA74' },
        lineStyle: { width: 2, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 4
      }
    )
  } else {
    // 普通模式
    series.push(
      {
        name: '曝光',
        type: 'bar',
        data: currentProcessed.impressionsData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '25%'
      },
      {
        name: '点击',
        type: 'bar',
        data: currentProcessed.clicksData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '25%'
      },
      {
        name: 'CTR',
        type: 'line',
        yAxisIndex: 1,
        data: currentProcessed.ctrData,
        itemStyle: { color: '#FB923C' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 4
      }
    )
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: series.map(s => s.name as string),
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 9 }
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '20%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: currentProcessed.dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 10
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10
        }
      },
      {
        type: 'value',
        name: 'CTR',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        max: 10,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: '{value}%'
        }
      }
    ],
    series
  }

  chart.setOption(option, true)
}

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

  // 加载趋势数据（包含曝光点击数据）
  store.fetchSalesTrend()
  if (isCompareMode.value) {
    store.fetchCompareSalesTrend()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  chart?.dispose()
})

// 监听变化
watch([isCompareMode, trendData, compareTrendData], updateChart, { deep: true })
</script>

<style scoped>
.metric-item {
  text-align: left;
}

.metric-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.metric-change {
  font-size: 10px;
  font-weight: 500;
}

.metric-change.up {
  color: #10b981;
}

.metric-change.down {
  color: #ef4444;
}

.metric-change.neutral {
  color: #6b7280;
}

.chart-container {
  width: 100%;
}
</style>
