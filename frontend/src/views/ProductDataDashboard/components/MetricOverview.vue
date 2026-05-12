<template>
  <!-- 核心指标总览卡片 -->
  <div class="metric-overview">
    <div class="overview-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 总产品数 -->
      <div class="overview-item">
        <div class="item-label text-xs text-gray-500 mb-1">总产品数</div>
        <div class="item-value flex items-center justify-between">
          <span class="value-big font-bold">{{ formatNumber(totalStats.productCount) }}</span>
          <span :class="getTrendClass(growthRates.productCount)" class="value-change text-xs">
            {{ getTrendIcon(growthRates.productCount) }}
            {{ Math.abs(growthRates.productCount).toFixed(1) }}%
          </span>
        </div>
        <div v-if="isCompareMode" class="item-compare text-xs text-gray-400 mt-1">
          对比期: {{ formatNumber(compareTotalStats.productCount) }}
        </div>
      </div>
      
      <!-- 总销量 -->
      <div class="overview-item">
        <div class="item-label text-xs text-gray-500 mb-1">总销量</div>
        <div class="item-value flex items-center justify-between">
          <span class="value-big font-bold">{{ formatNumber(totalStats.totalSalesVolume) }}</span>
          <span :class="getTrendClass(growthRates.salesVolume)" class="value-change text-xs">
            {{ getTrendIcon(growthRates.salesVolume) }}
            {{ Math.abs(growthRates.salesVolume).toFixed(1) }}%
          </span>
        </div>
        <div v-if="isCompareMode" class="item-compare text-xs text-gray-400 mt-1">
          对比期: {{ formatNumber(compareTotalStats.totalSalesVolume) }}
        </div>
      </div>
      
      <!-- 出单率 -->
      <div class="overview-item">
        <div class="item-label text-xs text-gray-500 mb-1">出单率</div>
        <div class="item-value flex items-center justify-between">
          <span class="value-big font-bold">{{ calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount).toFixed(2) }}</span>
          <span :class="getTrendClass(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount)))" class="value-change text-xs">
            {{ getTrendIcon(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount))) }}
            {{ Math.abs(calculateChangeRate(calculateOrderRate(totalStats.totalSalesVolume, totalStats.productCount), calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount))).toFixed(1) }}%
          </span>
        </div>
        <div v-if="isCompareMode" class="item-compare text-xs text-gray-400 mt-1">
          对比期: {{ calculateOrderRate(compareTotalStats.totalSalesVolume, compareTotalStats.productCount).toFixed(2) }}
        </div>
      </div>
      
      <!-- 平均ACoAS -->
      <div class="overview-item">
        <div class="item-label text-xs text-gray-500 mb-1">平均ACoAS</div>
        <div class="item-value flex items-center justify-between">
          <span class="value-big font-bold">{{ avgAcoas.toFixed(1) }}%</span>
          <span :class="getTrendClass(-growthRates.acoas)" class="value-change text-xs">
            {{ getTrendIcon(-growthRates.acoas) }}
            {{ Math.abs(growthRates.acoas).toFixed(1) }}%
          </span>
        </div>
        <div v-if="isCompareMode" class="item-compare text-xs text-gray-400 mt-1">
          对比期: {{ compareAvgAcoas.toFixed(1) }}%
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProductDataStore } from '../../../stores/productData'

const store = useProductDataStore()

const isCompareMode = computed(() => store.isCompareMode)
const totalStats = computed(() => store.totalStats)
const avgAcoas = computed(() => store.avgAcoas)
const compareTotalStats = computed(() => store.compareTotalStats)
const compareAvgAcoas = computed(() => store.compareAvgAcoas)
const growthRates = computed(() => store.growthRates)

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

// 格式化数字 - 显示具体数字，不使用K/M缩写
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
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
</script>

<style scoped>
.metric-overview {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .overview-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.overview-item {
  min-height: 60px;
}

.item-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
  line-height: 1.3;
}

.item-value {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.value-big {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.value-change {
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 2px;
}

.item-compare {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.2;
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
</style>