<template>
  <div class="category-pie-chart">
    <div class="chart-header">
      <h3 class="chart-title">分类占比</h3>
      <el-select v-model="chartType" size="small" @change="updateCharts">
        <el-option label="产品数占比" value="productCount" />
        <el-option label="销量占比" value="salesVolume" />
        <el-option label="出单率占比" value="orderRate" />
        <el-option label="ACoAS占比" value="acoas" />
      </el-select>
    </div>
    <div class="chart-content">
      <!-- 第一栏：图例 -->
      <div class="chart-column legend-column">
        <h4 class="column-title">图例</h4>
        <div class="legend-list">
          <div v-for="item in processedCurrentData.data" :key="item.name" class="legend-item" @click="handleLegendClick(item.name)">
            <span class="legend-color" :style="{ backgroundColor: item.itemStyle.color }"></span>
            <span class="legend-name">{{ item.name }}</span>
            <span class="legend-percentage">{{ ((item.value / processedCurrentData.total) * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>
      
      <!-- 第二栏：当期数据饼状图 -->
      <div class="chart-column current-column">
        <h4 class="column-title">当期数据</h4>
        <div ref="currentChartRef" class="chart-container" style="height: 300px"></div>
      </div>
      
      <!-- 第三栏：具体参数对比 -->
      <div class="chart-column compare-column">
        <!-- 点击分类的具体参数对比 -->
        <div v-if="selectedCategory" class="category-detail">
          <h4 class="detail-title">{{ selectedCategory.name }} 详细对比</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">总产品数</span>
              <div class="detail-values">
                <div class="value-row">
                  <span class="value-label">当期</span>
                  <span class="value-current">{{ selectedCategory.current.productCount }}</span>
                </div>
                <div class="value-row">
                  <span class="value-label">变化</span>
                  <span class="value-change" :class="getChangeClass(selectedCategory.change.productCount)">
                    {{ getChangeIcon(selectedCategory.change.productCount) }}
                    {{ Math.abs(selectedCategory.change.productCount).toFixed(1) }}%
                  </span>
                </div>
                <div class="value-row">
                  <span class="value-label">对比期</span>
                  <span class="value-compare">{{ selectedCategory.compare.productCount }}</span>
                </div>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-label">总销量</span>
              <div class="detail-values">
                <div class="value-row">
                  <span class="value-label">当期</span>
                  <span class="value-current">{{ selectedCategory.current.totalSalesVolume }}</span>
                </div>
                <div class="value-row">
                  <span class="value-label">变化</span>
                  <span class="value-change" :class="getChangeClass(selectedCategory.change.totalSalesVolume)">
                    {{ getChangeIcon(selectedCategory.change.totalSalesVolume) }}
                    {{ Math.abs(selectedCategory.change.totalSalesVolume).toFixed(1) }}%
                  </span>
                </div>
                <div class="value-row">
                  <span class="value-label">对比期</span>
                  <span class="value-compare">{{ selectedCategory.compare.totalSalesVolume }}</span>
                </div>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-label">出单率</span>
              <div class="detail-values">
                <div class="value-row">
                  <span class="value-label">当期</span>
                  <span class="value-current">{{ (selectedCategory.current.orderRate || 0).toFixed(2) }}</span>
                </div>
                <div class="value-row">
                  <span class="value-label">变化</span>
                  <span class="value-change" :class="getChangeClass(selectedCategory.change.orderRate)">
                    {{ getChangeIcon(selectedCategory.change.orderRate) }}
                    {{ Math.abs(selectedCategory.change.orderRate).toFixed(1) }}%
                  </span>
                </div>
                <div class="value-row">
                  <span class="value-label">对比期</span>
                  <span class="value-compare">{{ (selectedCategory.compare.orderRate || 0).toFixed(2) }}</span>
                </div>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-label">ACoAS</span>
              <div class="detail-values">
                <div class="value-row">
                  <span class="value-label">当期</span>
                  <span class="value-current">{{ selectedCategory.current.avgAcoas.toFixed(1) }}%</span>
                </div>
                <div class="value-row">
                  <span class="value-label">变化</span>
                  <span class="value-change" :class="getChangeClass(-selectedCategory.change.avgAcoas)">
                    {{ getChangeIcon(-selectedCategory.change.avgAcoas) }}
                    {{ Math.abs(selectedCategory.change.avgAcoas).toFixed(1) }}%
                  </span>
                </div>
                <div class="value-row">
                  <span class="value-label">对比期</span>
                  <span class="value-compare">{{ selectedCategory.compare.avgAcoas.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-selection">
          <p>请点击左侧饼状图查看详细对比</p>
        </div>
      </div>
      
      <!-- 第四栏：对比期数据饼状图 -->
      <div class="chart-column compare-period-column">
        <h4 class="column-title">对比期数据</h4>
        <div ref="compareChartRef" class="chart-container" style="height: 300px"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import { useProductDataStore } from '@/stores/productData'
import { CATEGORY_CONFIG } from '@/types/productData'

const store = useProductDataStore()
const currentChartRef = ref<HTMLElement>()
const compareChartRef = ref<HTMLElement>()
let currentChart: echarts.ECharts | null = null
let compareChart: echarts.ECharts | null = null
const chartType = ref<'productCount' | 'salesVolume' | 'orderRate' | 'acoas'>('productCount')
const selectedCategory = ref<any>(null)

const categoryStats = computed(() => store.categoryStats)
const compareCategoryStats = computed(() => store.compareCategoryStats)
const totalStats = computed(() => store.totalStats)
const compareTotalStats = computed(() => store.compareTotalStats)
const avgAcoas = computed(() => store.avgAcoas)
const compareAvgAcoas = computed(() => store.compareAvgAcoas)

// 处理当期数据
const processedCurrentData = computed(() => {
  if (!categoryStats.value || categoryStats.value.length === 0) {
    return { data: [], total: 0 }
  }

  let total = 0
  const data = categoryStats.value.map(stat => {
    let value = 0
    switch (chartType.value) {
      case 'productCount':
        value = stat.productCount || 0
        break
      case 'salesVolume':
        value = stat.totalSalesVolume || 0
        break
      case 'orderRate':
        value = stat.orderRate || 0
        break
      case 'acoas':
        value = stat.avgAcoas || 0
        break
    }
    total += value
    
    const config = CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG]
    return {
      name: config?.label || stat.category,
      value: value,
      itemStyle: {
        color: config?.color || '#999999'
      }
    }
  }).filter(item => item.value > 0)

  // 按值排序
  data.sort((a, b) => b.value - a.value)

  return { data, total }
})

// 处理对比期数据
const processedCompareData = computed(() => {
  if (!compareCategoryStats.value || compareCategoryStats.value.length === 0) {
    return { data: [], total: 0 }
  }

  let total = 0
  const data = compareCategoryStats.value.map(stat => {
    let value = 0
    switch (chartType.value) {
      case 'productCount':
        value = stat.productCount || 0
        break
      case 'salesVolume':
        value = stat.totalSalesVolume || 0
        break
      case 'orderRate':
        value = stat.orderRate || 0
        break
      case 'acoas':
        value = stat.avgAcoas || 0
        break
    }
    total += value
    
    const config = CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG]
    return {
      name: config?.label || stat.category,
      value: value,
      itemStyle: {
        color: config?.color || '#999999'
      }
    }
  }).filter(item => item.value > 0)

  // 按值排序
  data.sort((a, b) => b.value - a.value)

  return { data, total }
})

// 初始化图表
function initCharts() {
  // 初始化当期图表
  if (currentChartRef.value) {
    currentChart = echarts.init(currentChartRef.value)
    updateCurrentChart()
    // 添加点击事件监听
    currentChart.on('click', handleChartClick)
  }

  // 初始化对比期图表
  if (compareChartRef.value) {
    compareChart = echarts.init(compareChartRef.value)
    updateCompareChart()
  }

  // 响应式调整
  window.addEventListener('resize', handleResize)
}

// 处理图表点击事件
function handleChartClick(params: any) {
  const categoryName = params.name
  handleCategoryClick(categoryName)
}

// 处理图例点击事件
function handleLegendClick(categoryName: string) {
  handleCategoryClick(categoryName)
}

// 处理分类点击的通用函数
function handleCategoryClick(categoryName: string) {
  // 查找对应的分类统计数据
  let targetCategory: string | null = null
  const currentStat = categoryStats.value.find(stat => {
    const config = CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG]
    const match = config?.label === categoryName || stat.category === categoryName
    if (match) {
      targetCategory = stat.category
    }
    return match
  })
  
  const compareStat = compareCategoryStats.value.find(stat => {
    const config = CATEGORY_CONFIG[stat.category as keyof typeof CATEGORY_CONFIG]
    return config?.label === categoryName || stat.category === categoryName
  })

  if (currentStat && targetCategory) {
    // 更新本地状态，显示详细对比信息
    selectedCategory.value = {
      name: categoryName,
      current: {
        productCount: currentStat.productCount || 0,
        totalSalesVolume: currentStat.totalSalesVolume || 0,
        orderRate: currentStat.orderRate || 0,
        avgAcoas: currentStat.avgAcoas || 0
      },
      compare: {
        productCount: compareStat?.productCount || 0,
        totalSalesVolume: compareStat?.totalSalesVolume || 0,
        orderRate: compareStat?.orderRate || 0,
        avgAcoas: compareStat?.avgAcoas || 0
      },
      change: {
        productCount: calculateChangeRate(currentStat.productCount || 0, compareStat?.productCount || 0),
        totalSalesVolume: calculateChangeRate(currentStat.totalSalesVolume || 0, compareStat?.totalSalesVolume || 0),
        orderRate: calculateChangeRate(currentStat.orderRate || 0, compareStat?.orderRate || 0),
        avgAcoas: calculateChangeRate(currentStat.avgAcoas || 0, compareStat?.avgAcoas || 0)
      }
    }
    
    // 更新全局状态，触发核心指标卡片变化
    store.setSelectedCategory(targetCategory)
    
    // 刷新相关数据，确保所有组件显示一致的信息
    store.fetchSalesTrend()
    store.fetchTopProducts()
    store.fetchAdPerformance()
    store.fetchProductList({ page: 1, pageSize: 10 })
  }
}

// 计算变化率
function calculateChangeRate(current: number, compare: number): number {
  if (compare === 0) return current > 0 ? 100 : 0
  return parseFloat(((current - compare) / compare * 100).toFixed(2))
}

// 获取变化率样式类
function getChangeClass(rate: number): string {
  if (rate > 0) return 'change-up'
  if (rate < 0) return 'change-down'
  return 'change-neutral'
}

// 获取变化率图标
function getChangeIcon(rate: number): string {
  if (rate > 0) return '↑'
  if (rate < 0) return '↓'
  return '→'
}



// 更新当期图表
function updateCurrentChart() {
  if (!currentChart) return

  const { data, total } = processedCurrentData.value

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    // 移除图例配置，使用自定义图例
    legend: {
      show: false
    },
    series: [
      {
        name: '分类占比',
        type: 'pie',
        radius: ['35%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }

  currentChart.setOption(option, true)
}

// 更新对比期图表
function updateCompareChart() {
  if (!compareChart) return

  const { data, total } = processedCompareData.value

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    // 移除图例配置
    legend: {
      show: false
    },
    series: [
      {
        name: '分类占比',
        type: 'pie',
        radius: ['35%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }

  compareChart.setOption(option, true)
}

// 更新所有图表
function updateCharts() {
  updateCurrentChart()
  updateCompareChart()
}

// 处理窗口大小变化
function handleResize() {
  currentChart?.resize()
  compareChart?.resize()
}

// 监听数据变化
watch([categoryStats, compareCategoryStats, chartType], updateCharts, { deep: true })

onMounted(() => {
  initCharts()
})
</script>

<style scoped>
.category-pie-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 10px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  white-space: nowrap;
  flex: 1;
  margin-right: 10px;
}

.chart-content {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 0 10px;
}

/* 四栏布局 */
.chart-column {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

/* 第一栏：图例 */
.legend-column {
  flex: 0.8;
  min-width: 180px;
}

/* 第二栏：当期数据饼状图 */
.current-column {
  flex: 1.2;
  min-width: 220px;
  min-height: 400px;
}

/* 第三栏：具体参数对比 */
.compare-column {
  flex: 1.5;
  min-width: 250px;
  justify-content: center;
  min-height: 400px;
}

/* 第四栏：对比期数据饼状图 */
.compare-period-column {
  flex: 1.2;
  min-width: 220px;
  min-height: 400px;
}

.column-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 15px 0;
  text-align: center;
}

.legend-list {
  flex: 1;
  overflow-y: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.legend-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
  padding-left: 10px;
  border-radius: 4px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-percentage {
  color: #6b7280;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 8px;
}

.chart-container {
  width: 100%;
  flex: 1;
  height: 300px;
  min-height: 300px;
}

.category-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 15px 0;
  text-align: center;
}

.detail-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
}

.detail-item {
  background: #fff;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  display: block;
  margin-bottom: 10px;
  text-align: center;
}

.detail-values {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.value-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.value-current {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.value-change {
  font-size: 12px;
  font-weight: 500;
}

.value-compare {
  font-size: 12px;
  color: #9ca3af;
}

.change-up {
  color: #10b981;
}

.change-down {
  color: #ef4444;
}

.change-neutral {
  color: #6b7280;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 12px;
}

/* 响应式调整 */
@media (max-width: 1400px) {
  .chart-content {
    flex-wrap: wrap;
  }
  
  .chart-column {
    flex: 1 1 calc(50% - 15px);
  }
}

@media (max-width: 768px) {
  .chart-content {
    flex-direction: column;
  }
  
  .chart-column {
    flex: 1 1 100%;
  }
}
</style>