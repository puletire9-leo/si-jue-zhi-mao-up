<template>
  <div class="filter-panel bg-white rounded-lg shadow-sm p-3 mb-3">
    <div class="flex flex-wrap items-center gap-2">
      <!-- 视图切换 -->
      <el-radio-group v-model="currentView" size="small" @change="handleViewChange">
        <el-radio-button label="manager">
          <el-icon class="mr-1" size="14"><TrendCharts /></el-icon>
          管理视图
        </el-radio-button>
        <el-radio-button label="developer">
          <el-icon class="mr-1" size="14"><List /></el-icon>
          开发视图
        </el-radio-button>
      </el-radio-group>

      <el-divider direction="vertical" class="h-6 mx-1" />

      <!-- 分类选择 -->
      <el-select
        v-model="selectedCategory"
        placeholder="分类"
        clearable
        size="small"
        style="width: 120px"
        @change="handleCategoryChange"
      >
        <el-option
          v-for="cat in categoryOptions"
          :key="cat.value"
          :label="cat.label"
          :value="cat.value"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-2 h-2 rounded-full"
              :style="{ backgroundColor: cat.color }"
            />
            <span>{{ cat.label }}</span>
          </div>
        </el-option>
      </el-select>

      <!-- 店铺筛选 -->
      <el-select
        v-model="filterForm.store"
        placeholder="店铺"
        clearable
        size="small"
        style="width: 100px"
        @change="handleFilterChange"
      >
        <el-option
          v-for="store in filterOptions.stores"
          :key="store"
          :label="store"
          :value="store"
        />
      </el-select>

      <!-- 国家筛选 -->
      <el-select
        v-model="filterForm.country"
        placeholder="国家"
        clearable
        size="small"
        style="width: 90px"
        @change="handleFilterChange"
      >
        <el-option
          v-for="country in filterOptions.countries"
          :key="country"
          :label="country"
          :value="country"
        />
      </el-select>

      <!-- 开发筛选 -->
      <el-select
        v-model="filterForm.developer"
        placeholder="开发"
        clearable
        size="small"
        style="width: 100px"
        @change="handleFilterChange"
      >
        <el-option
          v-for="dev in filterOptions.developers"
          :key="dev"
          :label="dev"
          :value="dev"
        />
      </el-select>

      <!-- 搜索框 -->
      <el-input
        v-model="filterForm.searchKeyword"
        placeholder="搜索ASIN/MSKU/产品名"
        clearable
        size="small"
        style="width: 180px"
        @input="handleSearchInput"
      >
        <template #prefix>
          <el-icon size="14"><Search /></el-icon>
        </template>
      </el-input>

      <el-divider direction="vertical" class="h-6 mx-1" />

      <!-- 操作按钮 -->
      <el-button type="primary" size="small" @click="handleRefresh">
        <el-icon size="14"><Refresh /></el-icon>
      </el-button>

      <el-button size="small" @click="handleExport">
        <el-icon size="14"><Download /></el-icon>
      </el-button>

      <el-button size="small" @click="handleReset">
        <el-icon size="14"><Delete /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import {
  TrendCharts,
  List,
  Search,
  Refresh,
  Download,
  Delete
} from '@element-plus/icons-vue'
import { debounce } from '../../../utils/debounce'

const store = useProductDataStore()

// 视图模式
const currentView = computed({
  get: () => store.currentView,
  set: (val) => store.setViewMode(val)
})

// 分类选择
const selectedCategory = computed({
  get: () => store.selectedCategory,
  set: (val) => store.setSelectedCategory(val)
})

// 分类选项
const categoryOptions = computed(() => {
  return Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
    color: config.color
  }))
})

// 筛选选项
const filterOptions = computed(() => store.filterOptions)

// 筛选表单
const filterForm = reactive({
  store: '',
  country: '',
  developer: '',
  searchKeyword: ''
})

// 视图切换
function handleViewChange(mode: 'manager' | 'developer') {
  store.setViewMode(mode)
}

// 分类切换 - 只刷新相关数据，不重新初始化
function handleCategoryChange() {
  // 分类切换时刷新相关数据
  store.fetchSalesTrend()
  store.fetchTopProducts()
  store.fetchAdPerformance()
}

// 筛选变化
async function handleFilterChange() {
  store.setFilters({
    store: filterForm.store || undefined,
    country: filterForm.country || undefined,
    developer: filterForm.developer || undefined
  })
  
  // 刷新所有数据
  await Promise.all([
    store.fetchCategoryStats(),
    store.fetchSalesTrend(),
    store.fetchTopProducts(),
    store.fetchAdPerformance(),
    store.fetchProductList({ page: 1, pageSize: 20 })
  ])
}

// 搜索输入（防抖）
const handleSearchInput = debounce(async () => {
  store.setFilters({
    searchKeyword: filterForm.searchKeyword || undefined
  })
  
  // 搜索时主要刷新产品列表
  await store.fetchProductList({ page: 1, pageSize: 20 })
}, 300)

// 刷新
async function handleRefresh() {
  await store.refresh()
}

// 导出
function handleExport() {
  store.exportData()
}

// 重置
function handleReset() {
  filterForm.store = ''
  filterForm.country = ''
  filterForm.developer = ''
  filterForm.searchKeyword = ''
  store.resetFilters()
  store.fetchProductList({ page: 1, pageSize: 10 })
}
</script>

<style scoped>
.filter-panel {
  border: 1px solid #e4e7ed;
}
</style>
