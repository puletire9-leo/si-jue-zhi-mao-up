<template>
  <div class="top-products bg-white rounded-lg shadow-sm p-3 h-full">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">
        {{ selectedCategory ? currentCategoryLabel + ' - ' : '' }}TOP热销
        <el-tag v-if="isCompareMode" size="small" type="info" class="ml-2">对比模式</el-tag>
      </h3>
      <el-radio-group v-model="displayCount" size="small" @change="handleCountChange">
        <el-radio-button :label="5">5</el-radio-button>
        <el-radio-button :label="10">10</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 普通模式：只显示本期数据 -->
    <div v-if="!isCompareMode" class="grid grid-cols-1 gap-1 overflow-auto" style="max-height: 220px">
      <div
        v-for="(item, index) in topProducts.slice(0, displayCount)"
        :key="item.product.asin"
        class="product-card flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:shadow-md transition-all cursor-pointer"
        :class="{ 'bg-gradient-to-r from-orange-50 to-transparent': index < 3 }"
        @click="viewProductDetail(item.product)"
      >
        <!-- 排名 -->
        <div
          class="rank-badge w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          :class="getRankBadgeClass(index)"
        >
          {{ item.rank }}
        </div>

        <!-- 产品图片占位 -->
        <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <el-image
            :src="getProductImage(item.product.asin)"
            fit="cover"
            class="w-full h-full rounded-lg"
          >
            <template #error>
              <div class="w-full h-full flex items-center justify-center text-gray-400">
                <el-icon size="20"><Picture /></el-icon>
              </div>
            </template>
          </el-image>
        </div>

        <!-- 产品信息 -->
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-800 truncate">
            {{ item.product.product_name }}
          </p>
          <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ item.product.asin }}</span>
          </div>
        </div>

        <!-- 销量数据 -->
        <div class="text-right flex-shrink-0">
          <p class="text-sm font-bold text-orange-600">
            {{ item.salesVolume }}
          </p>
          <p class="text-xs text-gray-500">销量</p>
        </div>
      </div>
    </div>

    <!-- 对比模式：显示本期和对比期数据 -->
    <div v-else class="compare-mode">
      <!-- 本期数据 -->
      <div class="mb-3">
        <div class="flex items-center gap-2 mb-2">
          <el-tag size="small" type="success">本期</el-tag>
          <span class="text-xs text-gray-500">当前选中时间段</span>
        </div>
        <div class="grid grid-cols-1 gap-1 overflow-auto" style="max-height: 150px">
          <div
            v-for="(item, index) in topProducts.slice(0, displayCount)"
            :key="'current-' + item.product.asin"
            class="product-card flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:shadow-md transition-all cursor-pointer bg-green-50"
            :class="{ 'bg-gradient-to-r from-green-100 to-transparent': index < 3 }"
            @click="viewProductDetail(item.product)"
          >
            <!-- 排名 -->
            <div
              class="rank-badge w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="getRankBadgeClass(index)"
            >
              {{ item.rank }}
            </div>

            <!-- 产品图片占位 -->
            <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <el-image
                :src="getProductImage(item.product.asin)"
                fit="cover"
                class="w-full h-full rounded-lg"
              >
                <template #error>
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <el-icon size="20"><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>

            <!-- 产品信息 -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-gray-800 truncate">
                {{ item.product.product_name }}
              </p>
              <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ item.product.asin }}</span>
              </div>
            </div>

            <!-- 销量数据 -->
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-bold text-green-600">
                {{ item.salesVolume }}
              </p>
              <p class="text-xs text-gray-500">销量</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 对比期数据 -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <el-tag size="small" type="info">对比期</el-tag>
          <span class="text-xs text-gray-500">{{ compareDateRangeLabel }}</span>
        </div>
        <div class="grid grid-cols-1 gap-1 overflow-auto" style="max-height: 150px">
          <div
            v-for="(item, index) in compareTopProducts.slice(0, displayCount)"
            :key="'compare-' + item.product.asin"
            class="product-card flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:shadow-md transition-all cursor-pointer bg-gray-50"
            :class="{ 'bg-gradient-to-r from-gray-100 to-transparent': index < 3 }"
            @click="viewProductDetail(item.product)"
          >
            <!-- 排名 -->
            <div
              class="rank-badge w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              :class="getRankBadgeClass(index)"
            >
              {{ item.rank }}
            </div>

            <!-- 产品图片占位 -->
            <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <el-image
                :src="getProductImage(item.product.asin)"
                fit="cover"
                class="w-full h-full rounded-lg"
              >
                <template #error>
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <el-icon size="20"><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>

            <!-- 产品信息 -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-gray-800 truncate">
                {{ item.product.product_name }}
              </p>
              <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span class="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{{ item.product.asin }}</span>
              </div>
            </div>

            <!-- 销量数据 -->
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-bold text-gray-600">
                {{ item.salesVolume }}
              </p>
              <p class="text-xs text-gray-500">销量</p>
            </div>
          </div>
        </div>
        <el-empty v-if="compareTopProducts.length === 0" description="对比期暂无数据" />
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!isCompareMode && topProducts.length === 0" description="暂无数据" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import type { ProductData } from '../../../types/productData'
import { Picture } from '@element-plus/icons-vue'

const store = useProductDataStore()

const displayCount = ref(5)
const topProducts = computed(() => store.topProducts)
const compareTopProducts = computed(() => store.compareTopProducts)
const selectedCategory = computed(() => store.selectedCategory)
const isCompareMode = computed(() => store.isCompareMode)
const compareDateRange = computed(() => store.compareDateRange)

// 组件挂载时获取数据
onMounted(() => {
  // 获取本期数据
  store.fetchTopProducts(displayCount.value)
  // 如果在对比模式下，同时获取对比期数据
  if (isCompareMode.value) {
    store.fetchCompareTopProducts(displayCount.value)
  }
})

// 当前分类标签
const currentCategoryLabel = computed(() => {
  if (!selectedCategory.value) return ''
  return CATEGORY_CONFIG[selectedCategory.value as keyof typeof CATEGORY_CONFIG]?.label || selectedCategory.value
})

// 对比期日期范围标签
const compareDateRangeLabel = computed(() => {
  if (!compareDateRange.value[0] || !compareDateRange.value[1]) return ''
  return `${compareDateRange.value[0]} 至 ${compareDateRange.value[1]}`
})

// 获取排名样式
function getRankBadgeClass(index: number) {
  if (index === 0) return 'bg-yellow-400 text-white'
  if (index === 1) return 'bg-gray-300 text-white'
  if (index === 2) return 'bg-orange-300 text-white'
  return 'bg-gray-100 text-gray-600'
}

// 获取产品图片URL
function getProductImage(asin: string) {
  // 使用占位图服务
  return `https://placehold.co/100x100/e2e8f0/64748b?text=${asin.slice(-4)}`
}

// 格式化金额
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

// 数量变化
function handleCountChange() {
  store.fetchTopProducts(displayCount.value)
  // 如果在对比模式下，同时获取对比期数据
  if (isCompareMode.value) {
    store.fetchCompareTopProducts(displayCount.value)
  }
}

// 查看产品详情
function viewProductDetail(product: ProductData) {
  // 可以打开抽屉或弹窗显示详情
  console.log('查看产品详情:', product)
}
</script>

<style scoped>
.product-card {
  transition: all 0.3s ease;
}

.product-card:hover {
  transform: translateX(4px);
  border-color: #FCD34D;
}

.compare-mode {
  overflow-y: auto;
  max-height: 400px;
}
</style>
