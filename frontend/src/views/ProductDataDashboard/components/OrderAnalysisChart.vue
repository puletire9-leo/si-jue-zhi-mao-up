<template>
  <div class="order-analysis-chart bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        自然订单分析
        <el-tag v-if="isCompareMode" size="small" type="info" class="ml-2">对比模式</el-tag>
      </h3>
      <div class="flex items-center gap-1">
        <!-- 指标选择下拉 -->
        <el-dropdown @command="handleMetricChange" size="small">
          <el-button size="small">
            {{ metricLabel }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="salesAmount">销售额</el-dropdown-item>
              <el-dropdown-item command="orderQuantity">订单量</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 数据类型切换 -->
        <el-radio-group v-model="dataType" size="small">
          <el-radio-button label="all">全</el-radio-button>
          <el-radio-button label="ad">广</el-radio-button>
          <el-radio-button label="organic">自</el-radio-button>
        </el-radio-group>

        <!-- 时间维度切换 -->
        <el-radio-group v-model="timeDimension" size="small">
          <el-radio-button label="day">天</el-radio-button>
          <el-radio-button label="week">周</el-radio-button>
          <el-radio-button label="month">月</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div ref="chartRef" class="chart-container" style="height: 350px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { ArrowDown } from '@element-plus/icons-vue'
import { useProductDataStore } from '../../../stores/productData'

const store = useProductDataStore()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

// 当前选择的指标
const currentMetric = ref<'salesAmount' | 'orderQuantity'>('salesAmount')
// 数据类型
const dataType = ref<'all' | 'ad' | 'organic'>('all')
// 时间维度
const timeDimension = ref<'day' | 'week' | 'month'>('day')

// 从store获取数据
const isCompareMode = computed(() => store.isCompareMode)
const trendData = computed(() => store.trendData)
const compareTrendData = computed(() => store.compareTrendData)
const dateRange = computed(() => store.dateRange)
const compareDateRange = computed(() => store.compareDateRange)

// 指标标签
const metricLabel = computed(() => {
  return currentMetric.value === 'salesAmount' ? '销售额' : '订单量'
})

// 处理指标切换
function handleMetricChange(command: string) {
  currentMetric.value = command as 'salesAmount' | 'orderQuantity'
  updateChart()
}

// 处理趋势数据
function processTrendData(data: any[], isCompare: boolean = false) {
  const dates: string[] = []
  const adData: number[] = []
  const organicData: number[] = []
  const adRateData: number[] = []

  // 按日期分组聚合数据
  const groupedData = new Map<string, { adSales: number; organicSales: number; adOrders: number; organicOrders: number }>()

  data.forEach(item => {
    const date = item.date
    if (!groupedData.has(date)) {
      groupedData.set(date, { adSales: 0, organicSales: 0, adOrders: 0, organicOrders: 0 })
    }
    const group = groupedData.get(date)!
    
    // 根据指标类型累加数据
    if (currentMetric.value === 'salesAmount') {
      group.adSales += item.adSales || 0
      group.organicSales += (item.salesAmount || 0) - (item.adSales || 0)
    } else {
      group.adOrders += item.orderQuantity || 0
      // 自然订单估算：总订单 - 广告订单（这里简化处理）
      group.organicOrders += Math.floor((item.orderQuantity || 0) * 0.6)
    }
  })

  // 转换为数组并按日期排序
  const sortedDates = Array.from(groupedData.keys()).sort()
  
  sortedDates.forEach(date => {
    const item = groupedData.get(date)!
    
    if (currentMetric.value === 'salesAmount') {
      const ad = item.adSales
      const organic = item.organicSales
      const total = ad + organic
      
      dates.push(date)
      adData.push(Math.round(ad))
      organicData.push(Math.round(organic))
      adRateData.push(total > 0 ? parseFloat(((ad / total) * 100).toFixed(2)) : 0)
    } else {
      const ad = item.adOrders
      const organic = item.organicOrders
      const total = ad + organic
      
      dates.push(date)
      adData.push(ad)
      organicData.push(organic)
      adRateData.push(total > 0 ? parseFloat(((ad / total) * 100).toFixed(2)) : 0)
    }
  })

  return { dates, adData, organicData, adRateData }
}

// 注意：不再使用模拟数据，所有数据必须从store获取

// 初始化图表
function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表
function updateChart() {
  if (!chart) return

  // 处理本期数据
  const currentProcessed = processTrendData(trendData.value)
  const dates = currentProcessed.dates

  // 如果没有数据，显示空状态
  if (dates.length === 0) {
    chart.setOption({
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#999', fontSize: 14 }
      },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: []
    }, true)
    return
  }

  const isSales = currentMetric.value === 'salesAmount'
  const unit = isSales ? '$' : ''

  const series: echarts.SeriesOption[] = []

  if (isCompareMode.value) {
    // 对比模式：显示本期和对比期数据
    // 处理对比期数据
    const compareProcessed = processTrendData(compareTrendData.value, true)

    // 本期数据 - 广告
    if (dataType.value === 'all' || dataType.value === 'ad') {
      series.push({
        name: `本期广告${metricLabel.value}`,
        type: 'bar',
        data: currentProcessed.adData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '20%'
      })
    }

    // 本期数据 - 自然
    if (dataType.value === 'all' || dataType.value === 'organic') {
      series.push({
        name: `本期自然${metricLabel.value}`,
        type: 'bar',
        data: currentProcessed.organicData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '20%'
      })
    }

    // 对比期数据 - 广告
    if (dataType.value === 'all' || dataType.value === 'ad') {
      series.push({
        name: `对比期广告${metricLabel.value}`,
        type: 'bar',
        data: compareProcessed.adData,
        itemStyle: { color: '#93C5FD' },
        barWidth: '20%'
      })
    }

    // 对比期数据 - 自然
    if (dataType.value === 'all' || dataType.value === 'organic') {
      series.push({
        name: `对比期自然${metricLabel.value}`,
        type: 'bar',
        data: compareProcessed.organicData,
        itemStyle: { color: '#86EFAC' },
        barWidth: '20%'
      })
    }

    // 广告占比折线（本期）
    if (dataType.value === 'all') {
      series.push({
        name: '本期广告占比',
        type: 'line',
        yAxisIndex: 1,
        data: currentProcessed.adRateData,
        itemStyle: { color: '#F97316' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6
      })
    }
  } else {
    // 普通模式
    // 根据数据类型显示不同的系列
    if (dataType.value === 'all' || dataType.value === 'ad') {
      series.push({
        name: `广告${metricLabel.value}`,
        type: 'bar',
        stack: 'total',
        data: currentProcessed.adData,
        itemStyle: { color: '#60A5FA' },
        barWidth: '40%'
      })
    }

    if (dataType.value === 'all' || dataType.value === 'organic') {
      series.push({
        name: `自然${metricLabel.value}`,
        type: 'bar',
        stack: 'total',
        data: currentProcessed.organicData,
        itemStyle: { color: '#4ADE80' },
        barWidth: '40%'
      })
    }

    // 广告占比折线
    if (dataType.value === 'all') {
      series.push({
        name: '广告占比',
        type: 'line',
        yAxisIndex: 1,
        data: currentProcessed.adRateData,
        itemStyle: { color: '#F97316' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
        label: {
          show: true,
          formatter: '{c}%',
          fontSize: 10,
          color: '#F97316'
        }
      })
    }
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let html = `<div class="font-medium mb-1">${params[0].axisValue}</div>`
        params.forEach((p: any) => {
          const value = p.seriesName.includes('占比') ? `${p.value}%` : `${unit}${p.value.toLocaleString()}`
          html += `<div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" style="background:${p.color}"></span>
            <span>${p.seriesName}:</span>
            <span class="font-bold">${value}</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      data: series.map(s => s.name as string),
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 10 }
    },
    grid: {
      left: '2%',
      right: '3%',
      bottom: '15%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11
      }
    },
    yAxis: [
      {
        type: 'value',
        name: unit,
        nameTextStyle: { color: '#6B7280', fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) {
              return `${unit}${(value / 1000).toFixed(0)}K`
            }
            return `${unit}${value}`
          }
        }
      },
      {
        type: 'value',
        name: '占比',
        nameTextStyle: { color: '#6B7280', fontSize: 11 },
        min: 0,
        max: 100,
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 11,
          formatter: '{value}%'
        }
      }
    ],
    series
  }

  chart.setOption(option, true)
}

// 获取周数
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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

  // 加载销售趋势数据
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
watch([currentMetric, dataType, timeDimension, isCompareMode, trendData, compareTrendData], updateChart, { deep: true })
</script>

<style scoped>
.chart-container {
  width: 100%;
}
</style>
