<template>
  <div class="ad-analysis-dashboard bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-800">广告分析</h3>
      <div class="flex items-center gap-2">
        <el-radio-group v-model="timeRange" size="small">
          <el-radio-button label="day">天</el-radio-button>
          <el-radio-button label="week">周</el-radio-button>
          <el-radio-button label="month">月</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- 左侧：广告效果 -->
      <div class="ad-effect-section">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-medium text-gray-700">广告效果</h4>
          <el-radio-group v-model="leftMetric" size="small">
            <el-radio-button label="acoas">ACoAS</el-radio-button>
            <el-radio-button label="roas">ROAS</el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 指标卡片 -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="metric-card">
            <div class="metric-label">广告花费</div>
            <div class="metric-value">£{{ adMetrics.spend.toFixed(2) }}</div>
            <div class="metric-change" :class="adMetrics.spendChange >= 0 ? 'up' : 'down'">
              {{ adMetrics.spendChange >= 0 ? '+' : '' }}{{ adMetrics.spendChange.toFixed(2) }}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">广告销售额</div>
            <div class="metric-value">£{{ adMetrics.sales.toFixed(2) }}</div>
            <div class="metric-change" :class="adMetrics.salesChange >= 0 ? 'up' : 'down'">
              {{ adMetrics.salesChange >= 0 ? '+' : '' }}{{ adMetrics.salesChange.toFixed(2) }}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">ACoAS</div>
            <div class="metric-value">{{ adMetrics.acoas.toFixed(2) }}%</div>
            <div class="metric-change" :class="adMetrics.acoasChange <= 0 ? 'up' : 'down'">
              {{ adMetrics.acoasChange >= 0 ? '+' : '' }}{{ adMetrics.acoasChange.toFixed(2) }}%
            </div>
          </div>
        </div>
        
        <!-- 图表 -->
        <div ref="leftChartRef" class="chart-container" style="height: 180px"></div>
      </div>

      <!-- 右侧：曝光点击 -->
      <div class="exposure-section">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-medium text-gray-700">曝光点击</h4>
          <el-radio-group v-model="timeRange" size="small">
            <el-radio-button label="day">天</el-radio-button>
            <el-radio-button label="week">周</el-radio-button>
            <el-radio-button label="month">月</el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 指标卡片 -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="metric-card">
            <div class="metric-label">曝光</div>
            <div class="metric-value">{{ adMetrics.impressions.toLocaleString() }}</div>
            <div class="metric-change" :class="adMetrics.impressionsChange >= 0 ? 'up' : 'down'">
              {{ adMetrics.impressionsChange >= 0 ? '+' : '' }}{{ adMetrics.impressionsChange.toFixed(2) }}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">点击</div>
            <div class="metric-value">{{ adMetrics.clicks.toLocaleString() }}</div>
            <div class="metric-change" :class="adMetrics.clicksChange >= 0 ? 'up' : 'down'">
              {{ adMetrics.clicksChange >= 0 ? '+' : '' }}{{ adMetrics.clicksChange.toFixed(2) }}%
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">CTR</div>
            <div class="metric-value">{{ adMetrics.ctr.toFixed(2) }}%</div>
            <div class="metric-change" :class="adMetrics.ctrChange >= 0 ? 'up' : 'down'">
              {{ adMetrics.ctrChange >= 0 ? '+' : '' }}{{ adMetrics.ctrChange.toFixed(2) }}%
            </div>
          </div>
        </div>
        
        <!-- 图表 -->
        <div ref="rightChartRef" class="chart-container" style="height: 180px"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useProductDataStore } from '../../../stores/productData'

const store = useProductDataStore()
const timeRange = ref('day')
const leftMetric = ref('acoas')
const leftChartRef = ref<HTMLDivElement>()
const rightChartRef = ref<HTMLDivElement>()
let leftChart: echarts.ECharts | null = null
let rightChart: echarts.ECharts | null = null

// 从 store 获取趋势数据并聚合广告指标
const adMetrics = computed(() => {
  const data = store.trendData
  
  // 如果选择了分类，只统计该分类；否则统计所有
  const filteredData = store.selectedCategory 
    ? data.filter(d => d.category === store.selectedCategory)
    : data

  const totalSpend = filteredData.reduce((acc, cur) => acc + (cur.adSpend || 0), 0)
  const totalSales = filteredData.reduce((acc, cur) => acc + (cur.adSales || 0), 0)
  const totalImpressions = filteredData.reduce((acc, cur) => acc + (cur.impressions || 0), 0)
  const totalClicks = filteredData.reduce((acc, cur) => acc + (cur.clicks || 0), 0)

  return {
    spend: totalSpend,
    spendChange: 0, // 暂不计算同比
    sales: totalSales,
    salesChange: 0,
    acoas: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
    acoasChange: 0,
    impressions: totalImpressions,
    impressionsChange: 0,
    clicks: totalClicks,
    clicksChange: 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    ctrChange: 0
  }
})

// 获取图表数据
const chartData = computed(() => {
  const data = store.trendData
  
  // 按日期分组聚合
  const dailyMap = new Map<string, any>()
  data.forEach(item => {
    if (!dailyMap.has(item.date)) {
      dailyMap.set(item.date, {
        date: item.date,
        spend: 0,
        sales: 0,
        impressions: 0,
        clicks: 0
      })
    }
    const entry = dailyMap.get(item.date)
    
    // 如果没有选择分类，则累加所有分类；如果选择了，只累加匹配的
    if (!store.selectedCategory || item.category === store.selectedCategory) {
      entry.spend += item.adSpend || 0
      entry.sales += item.adSales || 0
      entry.impressions += item.impressions || 0
      entry.clicks += item.clicks || 0
    }
  })

  const sortedEntries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  
  return {
    dates: sortedEntries.map(e => e.date),
    spend: sortedEntries.map(e => e.spend),
    sales: sortedEntries.map(e => e.sales),
    acoas: sortedEntries.map(e => e.sales > 0 ? (e.spend / e.sales) * 100 : 0),
    roas: sortedEntries.map(e => e.spend > 0 ? (e.sales / e.spend) : 0),
    impressions: sortedEntries.map(e => e.impressions),
    clicks: sortedEntries.map(e => e.clicks),
    ctr: sortedEntries.map(e => e.impressions > 0 ? (e.clicks / e.impressions) * 100 : 0)
  }
})

// 初始化左侧图表（广告效果）
function initLeftChart() {
  if (!leftChartRef.value) return
  leftChart = echarts.init(leftChartRef.value)
  updateLeftChart()
}

// 更新左侧图表
function updateLeftChart() {
  if (!leftChart) return
  
  const data = chartData.value
  const metricData = leftMetric.value === 'acoas' ? data.acoas : data.roas
  const metricName = leftMetric.value === 'acoas' ? 'ACoAS' : 'ROAS'
  const metricUnit = leftMetric.value === 'acoas' ? '%' : ''
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['广告花费', '广告销售额', metricName],
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 10 }
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { 
        color: '#6B7280',
        fontSize: 10,
        formatter: (value: string) => {
          if (store.timeDimension === 'day') return value.slice(5)
          return value
        }
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
          fontSize: 10
        }
      },
      {
        type: 'value',
        name: metricName,
        nameTextStyle: { color: '#6B7280', fontSize: 10 },
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: `{value}${metricUnit}`
        }
      }
    ],
    series: [
      {
        name: '广告花费',
        type: 'bar',
        data: data.spend,
        itemStyle: { color: '#60A5FA' },
        barWidth: '30%'
      },
      {
        name: '广告销售额',
        type: 'bar',
        data: data.sales,
        itemStyle: { color: '#4ADE80' },
        barWidth: '30%'
      },
      {
        name: metricName,
        type: 'line',
        yAxisIndex: 1,
        data: metricData,
        itemStyle: { color: '#FB923C' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 4
      }
    ]
  }
  
  leftChart.setOption(option, true)
}

// 初始化右侧图表（曝光点击）
function initRightChart() {
  if (!rightChartRef.value) return
  rightChart = echarts.init(rightChartRef.value)
  updateRightChart()
}

// 更新右侧图表
function updateRightChart() {
  if (!rightChart) return
  
  const data = chartData.value
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['曝光', '点击', 'CTR'],
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 10 }
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { 
        color: '#6B7280',
        fontSize: 10,
        formatter: (value: string) => {
          if (store.timeDimension === 'day') return value.slice(5)
          return value
        }
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
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#6B7280',
          fontSize: 10,
          formatter: '{value}%'
        }
      }
    ],
    series: [
      {
        name: '曝光',
        type: 'bar',
        data: data.impressions,
        itemStyle: { color: '#60A5FA' },
        barWidth: '30%'
      },
      {
        name: '点击',
        type: 'bar',
        data: data.clicks,
        itemStyle: { color: '#4ADE80' },
        barWidth: '30%'
      },
      {
        name: 'CTR',
        type: 'line',
        yAxisIndex: 1,
        data: data.ctr,
        itemStyle: { color: '#FB923C' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 4
      }
    ]
  }
  
  rightChart.setOption(option, true)
}

// 监听 store 数据变化
watch(() => store.trendData, () => {
  updateLeftChart()
  updateRightChart()
}, { deep: true })

// 监听分类和维度变化
watch([() => store.selectedCategory, () => store.timeDimension, leftMetric], () => {
  updateLeftChart()
  updateRightChart()
})

// 窗口大小变化
function handleResize() {
  leftChart?.resize()
  rightChart?.resize()
}

// 监听容器尺寸变化
let leftResizeObserver: ResizeObserver | null = null
let rightResizeObserver: ResizeObserver | null = null

onMounted(() => {
  initLeftChart()
  initRightChart()
  window.addEventListener('resize', handleResize)
  
  // 使用 ResizeObserver 监听容器尺寸变化
  if (leftChartRef.value && typeof ResizeObserver !== 'undefined') {
    leftResizeObserver = new ResizeObserver(() => {
      leftChart?.resize()
    })
    leftResizeObserver.observe(leftChartRef.value)
  }
  
  if (rightChartRef.value && typeof ResizeObserver !== 'undefined') {
    rightResizeObserver = new ResizeObserver(() => {
      rightChart?.resize()
    })
    rightResizeObserver.observe(rightChartRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  leftResizeObserver?.disconnect()
  rightResizeObserver?.disconnect()
  leftChart?.dispose()
  rightChart?.dispose()
})
</script>

<style scoped>
.ad-analysis-dashboard {
  display: flex;
  flex-direction: column;
}

.ad-effect-section,
.exposure-section {
  display: flex;
  flex-direction: column;
}

.metric-card {
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}

.metric-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.metric-change {
  font-size: 10px;
  font-weight: 500;
}

.metric-change.up {
  color: #ef4444;
}

.metric-change.down {
  color: #10b981;
}

.chart-container {
  width: 100%;
  flex: 1;
}
</style>
