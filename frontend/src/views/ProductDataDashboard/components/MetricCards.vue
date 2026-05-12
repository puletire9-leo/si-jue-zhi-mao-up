<template>

  <!-- 对比模式下的指标卡片 -->
  <template v-if="isCompareMode">
    <div class="metric-compare-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <!-- 总产品数对比 -->
      <div class="metric-compare-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="metric-header">
          <span class="metric-name">总产品数</span>
          <span :class="getTrendClass(growthRates.productCount)">
            {{ getTrendIcon(growthRates.productCount) }}
            {{ Math.abs(growthRates.productCount).toFixed(1) }}%
          </span>
        </div>
        <div class="metric-values">
          <div class="metric-current">
            <div class="metric-value-big">{{ formatNumber(totalStats.productCount) }}</div>
            <div class="metric-label-small">
              本期 <span class="tag tag-current">当前</span>
            </div>
          </div>
          <div class="metric-arrow">→</div>
          <div class="metric-compare">
            <div class="metric-value-small">{{ formatNumber(compareTotalStats.productCount) }}</div>
            <div class="metric-label-small">
              对比期 <span class="tag tag-compare">上期</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 总销量对比 -->
      <div class="metric-compare-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="metric-header">
          <span class="metric-name">总销量</span>
          <span :class="getTrendClass(growthRates.salesVolume)">
            {{ getTrendIcon(growthRates.salesVolume) }}
            {{ Math.abs(growthRates.salesVolume).toFixed(1) }}%
          </span>
        </div>
        <div class="metric-values">
          <div class="metric-current">
            <div class="metric-value-big">{{ formatNumber(totalStats.totalSalesVolume) }}</div>
            <div class="metric-label-small">
              本期 <span class="tag tag-current">当前</span>
            </div>
          </div>
          <div class="metric-arrow">→</div>
          <div class="metric-compare">
            <div class="metric-value-small">{{ formatNumber(compareTotalStats.totalSalesVolume) }}</div>
            <div class="metric-label-small">
              对比期 <span class="tag tag-compare">上期</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 出单率对比 -->
      <div class="metric-compare-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="metric-header">
          <span class="metric-name">出单率</span>
          <span :class="getTrendClass(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount)))">
            {{ getTrendIcon(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount))) }}
            {{ Math.abs(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount))).toFixed(1) }}%
          </span>
        </div>
        <div class="metric-values">
          <div class="metric-current">
            <div class="metric-value-big">{{ calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount).toFixed(2) }}</div>
            <div class="metric-label-small">
              本期 <span class="tag tag-current">当前</span>
            </div>
          </div>
          <div class="metric-arrow">→</div>
          <div class="metric-compare">
            <div class="metric-value-small">{{ calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount).toFixed(2) }}</div>
            <div class="metric-label-small">
              对比期 <span class="tag tag-compare">上期</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 平均ACoAS对比 -->
      <div class="metric-compare-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="metric-header">
          <span class="metric-name">平均ACoAS</span>
          <span :class="getTrendClass(-growthRates.acoas)">
            {{ getTrendIcon(-growthRates.acoas) }}
            {{ Math.abs(growthRates.acoas).toFixed(1) }}%
          </span>
        </div>
        <div class="metric-values">
          <div class="metric-current">
            <div class="metric-value-big">{{ avgAcoas.toFixed(1) }}%</div>
            <div class="metric-label-small">
              本期 <span class="tag tag-current">当前</span>
            </div>
          </div>
          <div class="metric-arrow">→</div>
          <div class="metric-compare">
            <div class="metric-value-small">{{ compareAvgAcoas.toFixed(1) }}%</div>
            <div class="metric-label-small">
              对比期 <span class="tag tag-compare">上期</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- 普通模式下的指标卡片 -->
  <template v-else>
    <div class="metric-cards grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <!-- 总产品数 -->
      <div class="metric-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-gray-500 text-xs mb-1">总产品数</p>
            <p class="text-xl font-bold text-gray-800 truncate">{{ formatNumber(totalStats.productCount) }}</p>
            <p class="text-xs text-green-500 mt-1 flex items-center">
              <el-icon class="mr-1" size="12"><ArrowUp /></el-icon>
              +12.5%
            </p>
          </div>
          <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
            <el-icon class="text-xl text-blue-500"><Box /></el-icon>
          </div>
        </div>
      </div>

      <!-- 总销量 -->
      <div class="metric-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-gray-500 text-xs mb-1">总销量</p>
            <p class="text-xl font-bold text-gray-800 truncate">{{ formatNumber(totalStats.totalSalesVolume) }}</p>
            <p class="text-xs text-green-500 mt-1 flex items-center">
              <el-icon class="mr-1" size="12"><ArrowUp /></el-icon>
              +8.3%
            </p>
          </div>
          <div class="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
            <el-icon class="text-xl text-green-500"><ShoppingCart /></el-icon>
          </div>
        </div>
      </div>

      <!-- 出单率 -->
      <div class="metric-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-gray-500 text-xs mb-1">出单率</p>
            <p class="text-xl font-bold text-gray-800 truncate">{{ calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount).toFixed(2) }}</p>
            <p class="text-xs text-green-500 mt-1 flex items-center">
              <el-icon class="mr-1" size="12"><ArrowUp /></el-icon>
              +5.2%
            </p>
          </div>
          <div class="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
            <el-icon class="text-xl text-purple-500"><TrendCharts /></el-icon>
          </div>
        </div>
      </div>

      <!-- 平均ACoAS -->
      <div class="metric-card bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-gray-500 text-xs mb-1">平均ACoAS</p>
            <p class="text-xl font-bold text-gray-800">{{ avgAcoas.toFixed(1) }}%</p>
            <p class="text-xs text-red-500 mt-1 flex items-center">
              <el-icon class="mr-1" size="12"><ArrowDown /></el-icon>
              -2.1%
            </p>
          </div>
          <div class="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
            <el-icon class="text-xl text-purple-500"><TrendCharts /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- 分类指标卡片 - 紧凑布局 -->
  <div class="category-metrics mb-4">
    <div
      v-for="stat in statsWithConfig"
      :key="stat.category"
      class="category-card rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md"
      :class="{ 'ring-2': selectedCategory === stat.category }"
      :style="{
        backgroundColor: stat.config.color + '08',
        borderColor: stat.config.color,
        borderWidth: '1px',
        borderStyle: 'solid',
        '--tw-ring-color': selectedCategory === stat.category ? stat.config.color : 'transparent'
      }"
      @click="selectCategory(stat.category)"
    >
      <div class="flex items-center justify-between category-header">
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center"
            :style="{ backgroundColor: stat.config.color }"
          >
            <el-icon class="text-white">
              <component :is="getIconComponent(stat.config.icon)" />
            </el-icon>
          </div>
          <span class="font-semibold text-gray-800 text-sm">{{ stat.config.label }}</span>
        </div>
        <el-tag
          :type="stat.growthRate && stat.growthRate > 0 ? 'success' : 'danger'"
          size="small"
          class="text-xs"
        >
          {{ stat.growthRate && stat.growthRate > 0 ? '+' : '' }}{{ stat.growthRate?.toFixed(1) }}%
        </el-tag>
      </div>

      <!-- 普通模式：只显示本期数据 -->
      <div v-if="!isCompareMode" class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
        <div>
          <p class="text-xs text-gray-500 mb-1">sku</p>
          <p class="text-sm font-bold" :style="{ color: stat.config.color }">
            {{ stat.productCount }}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">销量</p>
          <p class="text-sm font-bold" :style="{ color: stat.config.color }">
            {{ formatCompactNumber(stat.totalSalesVolume) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">ACoAS</p>
          <p class="text-sm font-bold" :style="{ color: stat.config.color }">
            {{ stat.avgAcoas.toFixed(1) }}%
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">出单率</p>
          <p class="text-sm font-bold" :style="{ color: stat.config.color }">
            {{ calculateOrderRate(stat.totalSalesVolume, stat.productCount).toFixed(2) }}
          </p>
        </div>
      </div>

      <!-- 对比模式：显示本期和对比期数据 -->
      <div v-else class="space-y-2">
        <!-- 本期数据 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center bg-white bg-opacity-50 rounded p-2">
          <div>
            <p class="text-xs text-gray-500 mb-1">本期sku</p>
            <p class="text-sm font-bold" :style="{ color: stat.config.color }">{{ stat.productCount }}</p>
            <p v-if="stat.compareData" :class="getChangeRateClass(calculateChangeRate(stat.productCount, stat.compareData.productCount))" class="text-xs mt-1 flex items-center justify-center gap-1">
              {{ getChangeRateIcon(calculateChangeRate(stat.productCount, stat.compareData.productCount)) }}
              {{ Math.abs(calculateChangeRate(stat.productCount, stat.compareData.productCount)).toFixed(1) }}%
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">本期销量</p>
            <p class="text-sm font-bold" :style="{ color: stat.config.color }">{{ formatCompactNumber(stat.totalSalesVolume) }}</p>
            <p v-if="stat.compareData" :class="getChangeRateClass(calculateChangeRate(stat.totalSalesVolume, stat.compareData.totalSalesVolume))" class="text-xs mt-1 flex items-center justify-center gap-1">
              {{ getChangeRateIcon(calculateChangeRate(stat.totalSalesVolume, stat.compareData.totalSalesVolume)) }}
              {{ Math.abs(calculateChangeRate(stat.totalSalesVolume, stat.compareData.totalSalesVolume)).toFixed(1) }}%
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">本期ACoAS</p>
            <p class="text-sm font-bold" :style="{ color: stat.config.color }">{{ stat.avgAcoas.toFixed(1) }}%</p>
            <p v-if="stat.compareData" :class="getChangeRateClass(-calculateChangeRate(stat.avgAcoas, stat.compareData.avgAcoas))" class="text-xs mt-1 flex items-center justify-center gap-1">
              {{ getChangeRateIcon(-calculateChangeRate(stat.avgAcoas, stat.compareData.avgAcoas)) }}
              {{ Math.abs(calculateChangeRate(stat.avgAcoas, stat.compareData.avgAcoas)).toFixed(1) }}%
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">本期出单率</p>
            <p class="text-sm font-bold" :style="{ color: stat.config.color }">{{ calculateOrderRate(stat.totalSalesVolume, stat.productCount).toFixed(2) }}</p>
            <p v-if="stat.compareData" :class="getChangeRateClass(calculateChangeRate(calculateOrderRate(stat.totalSalesVolume, stat.productCount), calculateOrderRate(stat.compareData.totalSalesVolume, stat.compareData.productCount)))" class="text-xs mt-1 flex items-center justify-center gap-1">
              {{ getChangeRateIcon(calculateChangeRate(calculateOrderRate(stat.totalSalesVolume, stat.productCount), calculateOrderRate(stat.compareData.totalSalesVolume, stat.compareData.productCount))) }}
              {{ Math.abs(calculateChangeRate(calculateOrderRate(stat.totalSalesVolume, stat.productCount), calculateOrderRate(stat.compareData.totalSalesVolume, stat.compareData.productCount))).toFixed(1) }}%
            </p>
          </div>
        </div>
        <!-- 对比期数据 -->
        <div v-if="stat.compareData" class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center bg-gray-100 bg-opacity-50 rounded p-2">
          <div>
            <p class="text-xs text-gray-500 mb-1">对比期sku</p>
            <p class="text-sm font-bold text-gray-600">{{ stat.compareData.productCount }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">对比期销量</p>
            <p class="text-sm font-bold text-gray-600">{{ formatCompactNumber(stat.compareData.totalSalesVolume) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">对比期ACoAS</p>
            <p class="text-sm font-bold text-gray-600">{{ stat.compareData.avgAcoas.toFixed(1) }}%</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">对比期出单率</p>
            <p class="text-sm font-bold text-gray-600">{{ calculateOrderRate(stat.compareData.totalSalesVolume, stat.compareData.productCount).toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import { debounce } from '../../../utils/debounce'
import {
  Box,
  ShoppingCart,
  Money,
  TrendCharts,
  ArrowUp,
  ArrowDown,
  Tools,
  House
} from '@element-plus/icons-vue'

const store = useProductDataStore()

const isCompareMode = computed(() => store.isCompareMode)
const totalStats = computed(() => store.totalStats)
const avgAcoas = computed(() => store.avgAcoas)
const compareTotalStats = computed(() => store.compareTotalStats)
const compareAvgAcoas = computed(() => store.compareAvgAcoas)
const growthRates = computed(() => store.growthRates)
const selectedCategory = computed(() => store.selectedCategory)
const categoryStats = computed(() => store.categoryStats)
const compareCategoryStats = computed(() => store.compareCategoryStats)

// 获取趋势样式类
function getTrendClass(rate: number): string {
  if (rate > 0) return 'trend-up'
  if (rate < 0) return 'trend-down'
  return 'trend-neutral'
}

// 获取趋势图标
function getTrendIcon(rate: number): string {
  if (rate > 0) return '↑'
  if (rate < 0) return '↓'
  return '→'
}

// 带配置的统计数据
const statsWithConfig = computed(() => {
  console.log('[Component] categoryStats:', categoryStats.value)
  console.log('[Component] compareCategoryStats:', compareCategoryStats.value)
  
  // 从CATEGORY_CONFIG中获取所有分类
  return Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
    // 从categoryStats中查找对应的数据（使用标准化匹配，去除空格并忽略大小写）
    const normalizedCategory = category.trim().toLowerCase()
    const stat = categoryStats.value.find(s => {
      const sCategory = (s.category || '').trim().toLowerCase()
      return sCategory === normalizedCategory
    })
    
    // 在对比模式下，查找对比期数据
    const compareStat = isCompareMode.value ? compareCategoryStats.value.find(s => {
      const sCategory = (s.category || '').trim().toLowerCase()
      return sCategory === normalizedCategory
    }) : null

    if (stat) {
      console.log(`[Component] 找到匹配: ${category} ->`, stat)
    }
    if (compareStat) {
      console.log(`[Component] 找到对比期匹配: ${category} ->`, compareStat)
    }
    
    // 计算增长率
    const calculateGrowth = (current: number, compare: number) => {
      if (compare === 0) return current > 0 ? 100 : 0
      return parseFloat(((current - compare) / compare * 100).toFixed(2))
    }

    // 如果找到了数据，使用实际数据；否则使用默认值
    const currentData = {
      productCount: stat?.productCount || 0,
      totalSalesVolume: stat?.totalSalesVolume || 0,
      totalSalesAmount: stat?.totalSalesAmount || 0,
      totalOrderQuantity: stat?.totalOrderQuantity || 0,
      totalAdSpend: stat?.totalAdSpend || 0,
      totalAdSales: stat?.totalAdSales || 0,
      avgAcoas: stat?.avgAcoas || 0,
      avgRoas: stat?.avgRoas || 0,
    }
    
    const compareData = compareStat ? {
      productCount: compareStat.productCount || 0,
      totalSalesVolume: compareStat.totalSalesVolume || 0,
      totalSalesAmount: compareStat.totalSalesAmount || 0,
      totalOrderQuantity: compareStat.totalOrderQuantity || 0,
      totalAdSpend: compareStat.totalAdSpend || 0,
      totalAdSales: compareStat.totalAdSales || 0,
      avgAcoas: compareStat.avgAcoas || 0,
      avgRoas: compareStat.avgRoas || 0,
    } : null

    return {
      category,
      ...currentData,
      compareData,
      growthRate: compareData ? calculateGrowth(currentData.totalSalesAmount, compareData.totalSalesAmount) : (stat?.growthRate || 0),
      config
    }
  })
})

// 获取图标组件
function getIconComponent(iconName: string) {
  const iconMap: Record<string, any> = {
    'Tool': Tools,
    'Box': Box,
    'House': House
  }
  return iconMap[iconName] || Box
}

// 选择分类（防抖）
const selectCategory = debounce((category: string) => {
  if (selectedCategory.value === category) {
    store.setSelectedCategory('')
  } else {
    store.setSelectedCategory(category)
  }
  // 刷新相关数据
  store.fetchSalesTrend()
  store.fetchTopProducts()
  store.fetchAdPerformance()
  store.fetchProductList({ page: 1, pageSize: 10 })
}, 300)

// 格式化数字 - 显示具体数字，不使用K/M缩写
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

// 格式化金额
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

// 紧凑格式化数字
function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 紧凑格式化金额
function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M'
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(1) + 'K'
  }
  return '$' + amount.toFixed(0)
}

// 计算出单率
function calculateOrderRate(salesVolume: number, productCount: number): number {
  if (productCount === 0) return 0
  return salesVolume / productCount
}

// 计算变化率
function calculateChangeRate(current: number, compare: number): number {
  if (compare === 0) return current > 0 ? 100 : 0
  return parseFloat(((current - compare) / compare * 100).toFixed(2))
}

// 获取变化率样式类
function getChangeRateClass(rate: number): string {
  if (rate > 0) return 'trend-up'
  if (rate < 0) return 'trend-down'
  return 'trend-neutral'
}

// 获取变化率图标
function getChangeRateIcon(rate: number): string {
  if (rate > 0) return '↑'
  if (rate < 0) return '↓'
  return '→'
}
</script>

<style scoped>
.metric-cards,
.metric-compare-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 1024px) {
  .metric-cards,
  .metric-compare-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.category-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .category-metrics {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 分类卡片内部样式优化 */
.category-card {
  padding: 16px;
  border-radius: 12px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.category-card .category-header {
  margin-bottom: 16px;
}

.category-card .grid-cols-4 {
  flex: 1;
}

.category-card .grid-cols-4 > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

.category-card .text-xs {
  line-height: 1.4;
  font-size: 11px;
}

.category-card .text-sm {
  line-height: 1.3;
  margin-bottom: 4px;
  font-size: 13px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .category-card {
    min-height: 180px;
  }
  
  .category-card .grid-cols-4 > div {
    min-height: 60px;
  }
}

/* 对比模式卡片样式 */
.metric-compare-card {
  border: 2px solid transparent;
}

.metric-compare-card:hover {
  border-color: #409eff;
}

.metric-card,
.category-card,
.metric-compare-card {
  transition: all 0.3s ease;
}

.category-card:hover,
.metric-compare-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

/* 分类卡片选中效果 */
.category-card.ring-2 {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 变化率显示优化 */
.trend-up,
.trend-down,
.trend-neutral {
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 标签样式优化 */
.tag {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 10px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .metric-compare-grid,
  .metric-cards {
    grid-template-columns: 1fr;
  }
  
  .category-metrics {
    grid-template-columns: 1fr;
  }
  
  .category-card {
    min-height: 160px;
  }
  
  .category-card .grid-cols-4 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .category-card .grid-cols-4 > div {
    min-height: 50px;
  }
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.metric-name {
  font-size: 14px;
  color: #666;
}

.trend-up {
  color: #67c23a;
  font-weight: bold;
}

.trend-down {
  color: #f56c6c;
  font-weight: bold;
}

.trend-neutral {
  color: #909399;
  font-weight: bold;
}

.metric-values {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-current {
  flex: 1;
}

.metric-compare {
  flex: 1;
  text-align: right;
}

.metric-value-big {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.metric-value-small {
  font-size: 14px;
  color: #666;
}

.metric-label-small {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.metric-arrow {
  color: #c0c4cc;
  font-size: 16px;
}

.tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  margin-left: 4px;
}

.tag-current {
  background: #409eff;
  color: white;
}

.tag-compare {
  background: #909399;
  color: white;
}
</style>
