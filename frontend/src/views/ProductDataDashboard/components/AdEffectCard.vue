<template>
  <div class="ad-effect-card bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        广告效果
        <el-tag v-if="isCompareMode" size="small" type="info" class="ml-2">对比模式</el-tag>
      </h3>
      <div class="flex items-center gap-1">
        <el-radio-group v-model="metricType" size="small">
          <el-radio-button label="acos">ACOS</el-radio-button>
          <el-radio-button label="roas">ROAS</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 指标卡片 - 横向排列 -->
    <div class="flex gap-4 mb-3">
      <div class="metric-item flex-1">
        <div class="metric-label">广告花费</div>
        <div class="metric-value">${{ currentMetrics.spend.toFixed(2) }}</div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(currentMetrics.spend, compareMetrics.spend)">
          {{ formatChange(currentMetrics.spend, compareMetrics.spend) }}
        </div>
      </div>
      <div class="metric-item flex-1">
        <div class="metric-label">广告销售额</div>
        <div class="metric-value">${{ currentMetrics.sales.toFixed(2) }}</div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(currentMetrics.sales, compareMetrics.sales)">
          {{ formatChange(currentMetrics.sales, compareMetrics.sales) }}
        </div>
      </div>
      <div class="metric-item flex-1">
        <div class="metric-label">{{ metricType === 'acos' ? 'ACOS' : 'ROAS' }}</div>
        <div class="metric-value">
          {{ metricType === 'acos' ? currentMetrics.acos.toFixed(2) + '%' : currentMetrics.roas.toFixed(2) }}
        </div>
        <div v-if="isCompareMode" class="metric-change" :class="getChangeClass(getMainMetric(currentMetrics), getMainMetric(compareMetrics))">
          {{ formatChange(getMainMetric(currentMetrics), getMainMetric(compareMetrics)) }}
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

const metricType = ref<'acos' | 'roas'>('acos')

// 从store获取数据
const isCompareMode = computed(() => store.isCompareMode)
const adPerformance = computed(() => store.adPerformance)
const compareAdPerformance = computed(() => store.compareAdPerformance)

// 计算指标数据
const currentMetrics = computed(() => {
  const data = adPerformance.value
  const spend = data.reduce((sum, item) => sum + (item.adSpend || 0), 0)
  const sales = data.reduce((sum, item) => sum + (item.adSales || 0), 0)
  const acos = sales > 0 ? (spend / sales) * 100 : 0
  const roas = spend > 0 ? sales / spend : 0

  return {
    spend,
    sales,
    acos,
    roas
  }
})

const compareMetrics = computed(() => {
  const data = compareAdPerformance.value
  const spend = data.reduce((sum, item) => sum + (item.adSpend || 0), 0)
  const sales = data.reduce((sum, item) => sum + (item.adSales || 0), 0)
  const acos = sales > 0 ? (spend / sales) * 100 : 0
  const roas = spend > 0 ? sales / spend : 0

  return {
    spend,
    sales,
    acos,
    roas
  }
})

// 获取主指标值
function getMainMetric(metrics: { acos: number; roas: number }): number {
  return metricType.value === 'acos' ? metrics.acos : metrics.roas
}

// 获取变化样式
function getChangeClass(current: number, compare: number): string {
  if (compare === 0) return 'neutral'
  const change = ((current - compare) / compare) * 100
  // ACOS越低越好，ROAS越高越好
  if (metricType.value === 'acos') {
    return change <= 0 ? 'up' : 'down'
  }
  return change >= 0 ? 'up' : 'down'
}

// 格式化变化
function formatChange(current: number, compare: number): string {
  if (compare === 0) return '-'
  const change = ((current - compare) / compare) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

// 处理广告表现数据
function processAdPerformanceData(data: any[]) {
  const categories: string[] = []
  const spendData: number[] = []
  const salesData: number[] = []
  const acosData: number[] = []
  const roasData: number[] = []

  // 按分类聚合数据
  const groupedData = new Map<string, { spend: number; sales: number }>()

  data.forEach(item => {
    const category = item.category || '未知'
    if (!groupedData.has(category)) {
      groupedData.set(category, { spend: 0, sales: 0 })
    }
    const group = groupedData.get(category)!
    group.spend += item.adSpend || 0
    group.sales += item.adSales || 0
  })

  // 转换为数组
  groupedData.forEach((value, key) => {
    categories.push(key)
    spendData.push(value.spend)
    salesData.push(value.sales)
    acosData.push(value.sales > 0 ? parseFloat(((value.spend / value.sales) * 100).toFixed(2)) : 0)
    roasData.push(value.spend > 0 ? parseFloat((value.sales / value.spend).toFixed(2)) : 0)
  })

  return { categories, spendData, salesData, acosData, roasData }
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

  const currentProcessed = processAdPerformanceData(adPerformance.value)
  const compareProcessed = processAdPerformanceData(compareAdPerformance.value)

  // 如果没有数据，显示空状态
  if (currentProcessed.categories.length === 0) {
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

  if (isCompareMode.value && compareProcessed.categories.length > 0) {
    // 对比模式：显示本期和对比期数据
    series.push(
      {
        name: '本期广告花费',
        type: 'bar',
        data: currentProcessed.spendData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '15%'
      },
      {
        name: '对比期广告花费',
        type: 'bar',
        data: compareProcessed.spendData,
        itemStyle: { color: '#93C5FD' },
        barWidth: '15%'
      },
      {
        name: '本期广告销售额',
        type: 'bar',
        data: currentProcessed.salesData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '15%'
      },
      {
        name: '对比期广告销售额',
        type: 'bar',
        data: compareProcessed.salesData,
        itemStyle: { color: '#86EFAC' },
        barWidth: '15%'
      },
      {
        name: `本期${metricType.value.toUpperCase()}`,
        type: 'line',
        yAxisIndex: 1,
        data: metricType.value === 'acos' ? currentProcessed.acosData : currentProcessed.roasData,
        itemStyle: { color: '#FB923C' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 4
      },
      {
        name: `对比期${metricType.value.toUpperCase()}`,
        type: 'line',
        yAxisIndex: 1,
        data: metricType.value === 'acos' ? compareProcessed.acosData : compareProcessed.roasData,
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
        name: '广告花费',
        type: 'bar',
        data: currentProcessed.spendData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '25%'
      },
      {
        name: '广告销售额',
        type: 'bar',
        data: currentProcessed.salesData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '25%'
      },
      {
        name: metricType.value.toUpperCase(),
        type: 'line',
        yAxisIndex: 1,
        data: metricType.value === 'acos' ? currentProcessed.acosData : currentProcessed.roasData,
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
      data: currentProcessed.categories,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 10,
        rotate: 30,
        interval: 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '金额',
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: (value: number) => {
            if (value >= 1000) {
              return `$${(value / 1000).toFixed(0)}K`
            }
            return `$${value}`
          }
        }
      },
      {
        type: 'value',
        name: metricType.value.toUpperCase(),
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        max: metricType.value === 'acos' ? 50 : 30,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: metricType.value === 'acos' ? '{value}%' : '{value}'
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

// 监听变化
watch([metricType, isCompareMode, adPerformance, compareAdPerformance], updateChart, { deep: true })
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
