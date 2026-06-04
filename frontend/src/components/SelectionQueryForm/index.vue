<script setup lang="ts">
/**
 * 选品查询表单组件
 * @description 通用选品查询表单，支持总选品、新品榜、竞品店铺、回收站等页面
 * @author AI Assistant
 * @version 1.3.0
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Search, Refresh, Picture, List, Filter } from '@element-plus/icons-vue'
import type { SelectionQueryParams, SelectionQueryFormProps, CategoryItem, SearchTypeOption } from './types'
import { defaultQueryParams, pageTypeConfig, defaultSearchTypeOptions } from './types'
import { competitorApi } from '@/api/competitor'
import { selectionApi } from '@/api/selection'

// Props 定义
const props = withDefaults(defineProps<SelectionQueryFormProps>(), {
  showSource: false,
  showCombinedSearch: false,
  showCompactMode: false,
  showAdvancedSearch: false,
  showFilter: false,
  searchTypeOptions: () => defaultSearchTypeOptions,
  showSort: false,
  showDateRange: false,
  showImageSearch: false,
  showTitle: false,
  showTotal: false,
  categories: () => [],
  total: 0,
  title: ''
})

// Emits 定义
const emit = defineEmits<{
  search: [params: SelectionQueryParams]
  reset: []
  imageSearch: []
  change: [params: SelectionQueryParams]
}>()

// 表单数据
const formData = reactive<SelectionQueryParams>({
  ...defaultQueryParams,
  ...props.initialParams
})

// 紧凑模式下的搜索类型和搜索内容
const compactSearchType = ref('asin')
const compactSearchContent = ref('')

// 日期范围（用于日期选择器）
const dateRange = ref<string[]>([])

// 上架时间范围（用于筛选对话框中的上架时间选择器）
const listingDateRange = ref<string[]>([])

// 卖家列表（从后端加载）
const sellerOptions = ref<{ id: number; marketplace: string; sellerName: string; storeUrl: string }[]>([])
const sellerLoading = ref(false)

const loadSellers = async (marketplace?: string) => {
  sellerLoading.value = true
  try {
    const res = await selectionApi.getAllSellers(marketplace ? { marketplace } : undefined)
    sellerOptions.value = res.data || []
  } catch {
    sellerOptions.value = []
  } finally {
    sellerLoading.value = false
  }
}

// 多项精确搜索对话框
const advancedSearchDialogVisible = ref(false)
const advancedSearchContent = ref('')

// 筛选对话框
const filterDialogVisible = ref(false)

// 国家选项（值必须与数据库中存储的值一致）
const countryOptions = [
  { label: '英国', value: 'UK' },
  { label: '德国', value: 'DE' }
]

// 数据筛选模式选项（值必须与数据库中存储的值一致）
const dataFilterModeOptions = [
  { label: '模式一', value: 'MODE1' },
  { label: '模式二', value: 'MODE2' },
  { label: '未通过', value: 'FAIL' }
]

// 等级选项
const gradeOptions = [
  { label: 'S', value: 'S', color: '#67C23A' },
  { label: 'A', value: 'A', color: '#409EFF' },
  { label: 'B', value: 'B', color: '#E6A23C' },
  { label: 'C', value: 'C', color: '#909399' },
  { label: 'D', value: 'D', color: '#F56C6C' }
]

// 根据页面类型获取默认配置
const pageConfig = computed(() => {
  return pageTypeConfig[props.pageType] || {}
})

// 合并配置（Props优先级高于默认配置）
const config = computed(() => {
  // 从 props 中提取显式设置的布尔值
  const explicitProps: Record<string, boolean> = {}
  
  // 对于每个布尔类型的 prop，如果为 true 则覆盖默认值
  if (props.showSource === true) explicitProps.showSource = true
  if (props.showCombinedSearch === true) explicitProps.showCombinedSearch = true
  if (props.showCompactMode === true) explicitProps.showCompactMode = true
  if (props.showAdvancedSearch === true) explicitProps.showAdvancedSearch = true
  if (props.showFilter === true) explicitProps.showFilter = true
  if (props.showSort === true) explicitProps.showSort = true
  if (props.showDateRange === true) explicitProps.showDateRange = true
  if (props.showImageSearch === true) explicitProps.showImageSearch = true
  if (props.showTitle === true) explicitProps.showTitle = true
  if (props.showTotal === true) explicitProps.showTotal = true
  
  const mergedConfig = {
    ...pageConfig.value,
    ...explicitProps
  }
  
  return mergedConfig
})

// 显示标题
const displayTitle = computed(() => {
  if (props.title) return props.title
  const titles: Record<string, string> = {
    all: '全部选品',
    new: '新品榜',
    reference: '竞品店铺',
    recycle: '回收站'
  }
  return titles[props.pageType] || '选品列表'
})

// 监听日期范围变化
watch(dateRange, (newVal) => {
  if (newVal && newVal.length === 2) {
    formData.startDate = newVal[0]
    formData.endDate = newVal[1]
  } else {
    formData.startDate = ''
    formData.endDate = ''
  }
  emit('change', { ...formData })
}, { deep: true })

// 监听上架时间范围变化
watch(listingDateRange, (newVal) => {
  if (newVal && newVal.length === 2) {
    formData.listingDateStart = newVal[0]
    formData.listingDateEnd = newVal[1]
  } else {
    formData.listingDateStart = ''
    formData.listingDateEnd = ''
  }
  emit('change', { ...formData })
}, { deep: true })

// 监听表单数据变化
watch(formData, (newVal) => {
  emit('change', { ...newVal })
}, { deep: true })

// 监听国家变化，重新加载卖家列表
watch(() => formData.country, (newVal) => {
  loadSellers(newVal || undefined)
  // 切换国家时清空卖家选择
  formData.sellerSelect = ''
})

// 组件挂载时加载卖家列表
onMounted(() => {
  loadSellers(formData.country || undefined)
})

/**
 * 处理紧凑模式搜索
 */
const handleCompactSearch = () => {
  // 根据搜索类型设置对应的字段
  const searchType = compactSearchType.value
  const searchContent = compactSearchContent.value.trim()
  
  // 重置所有搜索字段
  formData.asin = ''
  formData.productTitle = ''
  formData.storeName = ''
  formData.category = ''
  
  // 根据搜索类型设置值
  switch (searchType) {
    case 'asin':
      formData.asin = searchContent
      break
    case 'productTitle':
      formData.productTitle = searchContent
      break
    case 'storeName':
      formData.storeName = searchContent
      break
    case 'category':
      formData.category = searchContent
      break
  }
  
  emit('search', { ...formData })
}

/**
 * 处理搜索
 */
const handleSearch = () => {
  emit('search', { ...formData })
}

/**
 * 处理卖家选择变化
 */
const handleSellerChange = (val: string) => {
  // 选中卖家时，同步设置 storeName 用于搜索
  formData.storeName = val || ''
  emit('search', { ...formData })
}

/**
 * 处理重置
 */
const handleReset = () => {
  // 重置表单数据
  Object.assign(formData, defaultQueryParams)
  // 重置紧凑模式数据
  compactSearchType.value = 'asin'
  compactSearchContent.value = ''
  // 重置日期范围
  dateRange.value = []
  // 重置上架时间范围
  listingDateRange.value = []
  // 关闭筛选对话框（如果在对话框中）
  filterDialogVisible.value = false
  // 触发重置事件
  emit('reset')
  // 触发搜索（重置后重新加载数据）
  emit('search', { ...formData })
}

/**
 * 处理以图搜图
 */
const handleImageSearch = () => {
  emit('imageSearch')
}

/**
 * 打开多项精确搜索对话框
 */
const openAdvancedSearchDialog = () => {
  advancedSearchDialogVisible.value = true
}

/**
 * 关闭多项精确搜索对话框
 */
const closeAdvancedSearchDialog = () => {
  advancedSearchDialogVisible.value = false
}

/**
 * 清空多项搜索内容
 */
const clearAdvancedSearchContent = () => {
  advancedSearchContent.value = ''
}

/**
 * 处理多项精确搜索
 */
const handleAdvancedSearch = () => {
  const content = advancedSearchContent.value.trim()
  if (!content) {
    return
  }
  
  // 按行分割，获取搜索列表
  const searchList = content.split('\n').map(line => line.trim()).filter(line => line)
  
  if (searchList.length === 0) {
    return
  }
  
  // 根据当前搜索类型设置搜索条件
  const searchType = compactSearchType.value
  
  // 重置所有搜索字段
  formData.asin = ''
  formData.productTitle = ''
  formData.storeName = ''
  formData.category = ''
  
  // 如果有多个值，使用第一个值作为主要搜索条件
  // 其他值可以通过其他方式处理（如发送到后端进行批量查询）
  const firstValue = searchList[0]
  
  switch (searchType) {
    case 'asin':
      formData.asin = firstValue
      break
    case 'productTitle':
      formData.productTitle = firstValue
      break
    case 'storeName':
      formData.storeName = firstValue
      break
    case 'category':
      formData.category = firstValue
      break
  }
  
  // 关闭对话框
  advancedSearchDialogVisible.value = false
  
  // 触发搜索
  emit('search', { ...formData })
}

/**
 * 打开筛选对话框
 */
const openFilterDialog = () => {
  filterDialogVisible.value = true
}

/**
 * 关闭筛选对话框
 */
const closeFilterDialog = () => {
  filterDialogVisible.value = false
}

/**
 * 应用筛选
 */
const applyFilter = () => {
  emit('search', { ...formData })
  filterDialogVisible.value = false
}

/**
 * 切换等级筛选
 */
const handleGradeToggle = (grade: string) => {
  const grades = formData.grade ? formData.grade.split(',').filter(g => g) : []
  const index = grades.indexOf(grade)
  if (index >= 0) {
    grades.splice(index, 1)
  } else {
    grades.push(grade)
  }
  formData.grade = grades.join(',')
  // 不立即关闭对话框，让用户可以继续选择其他筛选条件
  // applyFilter()
}

/**
 * 获取当前查询参数
 */
const getQueryParams = (): SelectionQueryParams => {
  return { ...formData }
}

/**
 * 设置查询参数
 */
const setQueryParams = (params: Partial<SelectionQueryParams>) => {
  Object.assign(formData, params)
  // 同步更新日期范围
  if (params.startDate && params.endDate) {
    dateRange.value = [params.startDate, params.endDate]
  }
  // 同步更新上架时间范围
  if (params.listingDateStart && params.listingDateEnd) {
    listingDateRange.value = [params.listingDateStart, params.listingDateEnd]
  }
}

// 暴露方法给父组件
defineExpose({
  getQueryParams,
  setQueryParams,
  handleSearch,
  handleReset,
  openAdvancedSearchDialog,
  openFilterDialog
})
</script>

<template>
  <div class="selection-query-form">
    <!-- 标题区域 -->
    <div v-if="config.showTitle" class="form-title">
      <h3>{{ displayTitle }}</h3>
      <span v-if="config.showTotal" class="product-count">共 {{ total }} 个产品</span>
    </div>
    
    <!-- 紧凑模式（单行布局） -->
    <div v-if="config.showCompactMode" class="compact-search-bar">
      <div class="search-filters-row">
        <!-- 国家选择器 -->
        <el-select
          v-model="formData.country"
          placeholder="选择国家"
          clearable
          class="country-select"
          size="default"
          @change="handleSearch"
        >
          <el-option
            v-for="option in countryOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <!-- 卖家选择器 -->
        <el-select
          v-model="formData.sellerSelect"
          placeholder="选择卖家"
          clearable
          filterable
          class="seller-select"
          size="default"
          :loading="sellerLoading"
          @change="handleSellerChange"
        >
          <el-option
            v-for="seller in sellerOptions"
            :key="seller.id"
            :label="seller.sellerName"
            :value="seller.sellerName"
          >
            <span>{{ seller.sellerName }}</span>
            <span style="float: right; color: #8492a6; font-size: 12px">{{ seller.marketplace }}</span>
          </el-option>
        </el-select>

        <!-- 上架时间范围选择器 -->
        <el-date-picker
          v-model="listingDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="上架开始日期"
          end-placeholder="上架结束日期"
          value-format="YYYY-MM-DD"
          class="listing-date-picker"
          size="default"
          @change="handleSearch"
        />
        
        <!-- 数据筛选模式选择器 -->
        <el-select
          v-model="formData.dataFilterMode"
          placeholder="数据筛选模式"
          clearable
          class="data-filter-select"
          size="default"
          @change="handleSearch"
        >
          <el-option
            v-for="option in dataFilterModeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <div class="search-wrapper">
        <el-select
          v-model="compactSearchType"
          placeholder="搜索类型"
          class="search-type-select"
          size="default"
        >
          <el-option
            v-for="option in searchTypeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        
        <div class="search-input-wrapper">
          <el-input
            v-model="compactSearchContent"
            placeholder="请输入搜索内容"
            clearable
            class="search-input"
            size="default"
            @keyup.enter="handleCompactSearch"
          >
            <template #append>
              <el-button 
                type="primary" 
                :icon="Search" 
                size="default"
                @click="handleCompactSearch"
                class="search-btn"
              >
                搜索
              </el-button>
            </template>
          </el-input>
        </div>
      </div>
      
      <div class="action-buttons">
        <!-- 多项精确搜索按钮 -->
        <el-button
          v-if="config.showAdvancedSearch"
          :icon="List"
          size="default"
          @click="openAdvancedSearchDialog"
          class="advanced-search-btn"
          title="多项精确搜索"
        />
        
        <!-- 筛选按钮 -->
        <el-button
          v-if="config.showFilter"
          :icon="Filter"
          size="default"
          @click="openFilterDialog"
          class="filter-btn"
          title="筛选条件"
        >
          筛选
        </el-button>
        
        <el-button 
          :icon="Refresh" 
          size="default"
          @click="handleReset"
          class="reset-btn"
        >
          重置
        </el-button>
        
        <el-button 
          v-if="config.showImageSearch" 
          type="info" 
          :icon="Picture" 
          size="default"
          @click="handleImageSearch"
          class="image-search-btn"
        >
          以图搜图
        </el-button>
      </div>
    </div>
    
    <!-- 传统模式（多行布局） -->
    <el-form v-else :inline="true" :model="formData" class="traditional-form">
      <!-- 组合搜索 (新品榜模式) -->
      <el-form-item v-if="config.showCombinedSearch" class="combined-search-item">
        <el-input 
          v-model="formData.keyword" 
          placeholder="请输入搜索内容" 
          clearable
          class="search-input"
        >
          <template #prepend>
            <el-select v-model="formData.searchType" style="width: 100px">
              <el-option label="ASIN" value="asin" />
              <el-option label="商品标题" value="productTitle" />
            </el-select>
          </template>
          <template #append>
            <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </el-form-item>
      
      <!-- ASIN输入框 (非组合搜索模式) -->
      <el-form-item v-if="!config.showCombinedSearch" label="ASIN">
        <el-input 
          v-model="formData.asin" 
          placeholder="请输入ASIN" 
          clearable
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      
      <!-- 商品标题输入框 (非组合搜索模式) -->
      <el-form-item v-if="!config.showCombinedSearch" label="商品标题">
        <el-input 
          v-model="formData.productTitle" 
          placeholder="请输入商品标题" 
          clearable
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      
      <!-- 来源筛选 (总选品页面) -->
      <el-form-item v-if="config.showSource" label="来源">
        <el-select v-model="formData.productType" placeholder="请选择来源" clearable>
          <el-option label="全部" value="" />
          <el-option label="新品榜" value="new" />
          <el-option label="竞品店铺" value="reference" />
          <el-option label="郑总店铺" value="zheng" />
        </el-select>
      </el-form-item>
      
      <!-- 店铺名称 -->
      <el-form-item v-if="!config.showCombinedSearch" label="店铺名称">
        <el-input 
          v-model="formData.storeName" 
          placeholder="请输入店铺名称" 
          clearable
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      
      <!-- 大类榜单 -->
      <el-form-item v-if="!config.showCombinedSearch" label="大类榜单">
        <el-select 
          v-model="formData.category" 
          placeholder="请选择大类榜单" 
          clearable
          style="width: 200px"
        >
          <el-option label="全部" value="" />
          <el-option 
            v-for="cat in categories" 
            :key="cat.category" 
            :label="`${cat.category} (${cat.count})`" 
            :value="cat.category" 
          />
        </el-select>
      </el-form-item>
      
      <!-- 排序字段和排序方式 -->
      <el-form-item v-if="config.showSort" label="排序">
        <el-select 
          v-model="formData.sortField" 
          placeholder="排序字段" 
          clearable 
          style="width: 120px"
        >
          <el-option label="销量" value="salesVolume" />
          <el-option label="价格" value="price" />
          <el-option label="上架时间" value="listingDate" />
          <el-option label="创建时间" value="createdAt" />
        </el-select>
        <el-select 
          v-model="formData.sortOrder" 
          placeholder="排序方式" 
          clearable 
          style="width: 100px; margin-left: 8px"
        >
          <el-option label="降序" value="desc" />
          <el-option label="升序" value="asc" />
        </el-select>
      </el-form-item>
      
      <!-- 日期范围 (回收站) -->
      <el-form-item v-if="config.showDateRange" label="删除时间">
        <el-date-picker 
          v-model="dateRange" 
          type="daterange" 
          range-separator="至" 
          start-placeholder="开始日期" 
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px"
        />
      </el-form-item>
      
      <!-- 操作按钮 -->
      <el-form-item class="action-buttons">
        <el-button 
          v-if="!config.showCombinedSearch" 
          type="primary" 
          :icon="Search" 
          @click="handleSearch"
        >
          搜索
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        <el-button 
          v-if="config.showImageSearch" 
          type="info" 
          :icon="Picture" 
          @click="handleImageSearch"
        >
          以图搜图
        </el-button>
      </el-form-item>
    </el-form>
    
    <!-- 多项精确搜索对话框 -->
    <el-dialog
      v-model="advancedSearchDialogVisible"
      title="多项精确搜索"
      width="600px"
      destroy-on-close
    >
      <div class="advanced-search">
        <div class="search-type-selector">
          <span class="search-type-label">搜索类型：</span>
          <el-select
            v-model="compactSearchType"
            placeholder="选择搜索类型"
            class="search-type-dropdown"
            style="width: 150px"
          >
            <el-option
              v-for="option in searchTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        
        <div class="search-content-area">
          <el-input
            v-model="advancedSearchContent"
            type="textarea"
            :rows="10"
            placeholder="精确搜索，一行一项，最多支持2000行"
            resize="vertical"
          />
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="clearAdvancedSearchContent">
            清空
          </el-button>
          <el-button @click="closeAdvancedSearchDialog">
            关闭
          </el-button>
          <el-button type="primary" @click="handleAdvancedSearch">
            搜索
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 筛选对话框 -->
    <el-dialog
      v-model="filterDialogVisible"
      title="筛选条件"
      width="600px"
      destroy-on-close
    >
      <div class="filter-panel">
        <!-- 国家筛选 -->
        <div class="filter-section">
          <div class="filter-label">国家</div>
          <el-select v-model="formData.country" placeholder="请选择国家" clearable style="width: 100%">
            <el-option 
              v-for="option in countryOptions" 
              :key="option.value" 
              :label="option.label" 
              :value="option.value" 
            />
          </el-select>
        </div>
        
        <!-- 上架时间范围筛选 -->
        <div class="filter-section">
          <div class="filter-label">上架时间范围</div>
          <el-date-picker
            v-model="listingDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </div>
        
        <!-- 数据筛选模式 -->
        <div class="filter-section">
          <div class="filter-label">数据筛选模式</div>
          <el-select v-model="formData.dataFilterMode" placeholder="请选择数据筛选模式" clearable style="width: 100%">
            <el-option 
              v-for="option in dataFilterModeOptions" 
              :key="option.value" 
              :label="option.label" 
              :value="option.value" 
            />
          </el-select>
        </div>
        
        <!-- 来源筛选 -->
        <div class="filter-section">
          <div class="filter-label">来源</div>
          <el-select v-model="formData.productType" placeholder="请选择来源" clearable style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="新品榜" value="new" />
            <el-option label="竞品店铺" value="reference" />
            <el-option label="郑总店铺" value="zheng" />
          </el-select>
        </div>
        
        <!-- 大类榜单筛选 -->
        <div class="filter-section">
          <div class="filter-label">大类榜单</div>
          <el-select
            v-model="formData.category"
            placeholder="请选择大类榜单"
            clearable
            style="width: 100%"
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="cat in categories"
              :key="cat.category"
              :label="`${cat.category} (${cat.count})`"
              :value="cat.category"
            />
          </el-select>
        </div>

        <!-- 等级筛选 -->
        <div class="filter-section">
          <div class="filter-label">等级</div>
          <div class="grade-filter-group">
            <el-check-tag
              v-for="g in gradeOptions"
              :key="g.value"
              :checked="formData.grade.split(',').includes(g.value)"
              :style="{ '--el-color-primary': g.color }"
              @change="handleGradeToggle(g.value)"
            >
              {{ g.label }}
            </el-check-tag>
          </div>
        </div>

        <!-- 本周/往期筛选 -->
        <div class="filter-section">
          <div class="filter-label">数据时效</div>
          <el-radio-group v-model="formData.isCurrent">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="1">本周上架</el-radio-button>
            <el-radio-button label="0">往期上架</el-radio-button>
          </el-radio-group>
        </div>
        
        <!-- 排序 -->
        <div class="filter-section">
          <div class="filter-label">排序</div>
          <div class="sort-row">
            <el-select 
              v-model="formData.sortField" 
              placeholder="排序字段" 
              clearable 
              style="width: 150px"
            >
              <el-option label="评分" value="score" />
              <el-option label="销量" value="salesVolume" />
              <el-option label="价格" value="price" />
              <el-option label="上架时间" value="listingDate" />
              <el-option label="创建时间" value="createdAt" />
            </el-select>
            <el-select 
              v-model="formData.sortOrder" 
              placeholder="排序方式" 
              clearable 
              style="width: 120px; margin-left: 12px"
            >
              <el-option label="降序" value="desc" />
              <el-option label="升序" value="asc" />
            </el-select>
          </div>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleReset">
            重置
          </el-button>
          <el-button @click="closeFilterDialog">
            关闭
          </el-button>
          <el-button type="primary" @click="applyFilter">
            应用
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.selection-query-form {
  .form-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-top: 8px;
    width: 100%;
    
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
    
    .product-count {
      color: #909399;
      font-size: 14px;
    }
  }
  
  // 紧凑模式样式
  .compact-search-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    flex-wrap: wrap;
    padding: 16px 0;
    margin-bottom: 16px;
    
    .search-filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .country-select {
        width: 120px;
      }

      .seller-select {
        width: 200px;
      }
      
      .listing-date-picker {
        width: 320px;
      }
      
      .data-filter-select {
        width: 140px;
      }
    }
    
    .search-wrapper {
      display: flex;
      align-items: center;
      gap: 0;
      
      .search-type-select {
        width: 120px;
        
        :deep(.el-input__wrapper) {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
      }
      
      .search-input-wrapper {
        .search-input {
          width: 300px;
          
          :deep(.el-input__wrapper) {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            border-left: none;
          }
          
          :deep(.el-input-group__append) {
            padding: 0;
            
            .search-btn {
              margin: 0;
              border-radius: 0 4px 4px 0;
              height: 100%;
            }
          }
        }
      }
    }
    
    .action-buttons {
      display: flex;
      gap: 12px;
      
      .advanced-search-btn,
      .filter-btn,
      .reset-btn,
      .image-search-btn {
        margin: 0;
      }
    }
  }
  
  // 传统表单样式
  .traditional-form {
    .el-form-item {
      margin-bottom: 16px;
      margin-right: 16px;
      
      &:last-child {
        margin-right: 0;
      }
    }
    
    .combined-search-item {
      .search-input {
        width: 400px;
        
        :deep(.el-input-group__prepend) {
          padding: 0;
          background-color: #fff;
        }
        
        :deep(.el-input-group__append) {
          padding: 0;
          
          .el-button {
            margin: 0;
            border-radius: 0;
            height: 100%;
          }
        }
      }
    }
    
    .action-buttons {
      .el-button {
        margin-left: 8px;
        
        &:first-child {
          margin-left: 0;
        }
      }
    }
  }
  
  // 多项精确搜索对话框样式
  .advanced-search {
    .search-type-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      
      .search-type-label {
        font-weight: 500;
        color: #606266;
      }
    }
    
    .search-content-area {
      .el-textarea {
        width: 100%;
      }
    }
  }
  
  // 筛选面板样式
  .filter-panel {
    .filter-section {
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .filter-label {
        font-weight: 500;
        color: #606266;
        margin-bottom: 8px;
      }
      
      .sort-row {
        display: flex;
        align-items: center;
      }

      .grade-filter-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 响应式布局
@media screen and (max-width: 1200px) {
  .selection-query-form {
    .compact-search-bar {
      .search-wrapper {
        .search-input-wrapper {
          .search-input {
            width: 250px;
          }
        }
      }
    }
    
    .traditional-form {
      .combined-search-item {
        .search-input {
          width: 350px;
        }
      }
    }
  }
}

@media screen and (max-width: 768px) {
  .selection-query-form {
    .compact-search-bar {
      flex-direction: column;
      align-items: stretch;
      
      .search-wrapper {
        width: 100%;
        
        .search-type-select {
          width: 100px;
          flex-shrink: 0;
        }
        
        .search-input-wrapper {
          flex: 1;
          
          .search-input {
            width: 100%;
          }
        }
      }
      
      .action-buttons {
        width: 100%;
        justify-content: flex-end;
      }
    }
    
    .traditional-form {
      .el-form-item {
        margin-right: 8px;
        margin-bottom: 12px;
      }
      
      .combined-search-item {
        width: 100%;
        
        .search-input {
          width: 100%;
        }
      }
      
      .action-buttons {
        width: 100%;
        margin-top: 8px;
      }
    }
  }
}
</style>
1188

<system-reminder>
Contents of /mnt/f/项目/si-jue-zhi-mao-up/frontend/CLAUDE.md:

# 前端 - Claude 自动加载上下文

> Vue 3 + TypeScript + Element Plus + Vite + Pinia。详情见 [AGENTS.md](AGENTS.md)。

## 目录结构

```
frontend/src/
├── api/          # API 接口定义（20 文件）
├── components/   # 通用组件（8 个）
├── composables/  # 组合式函数
├── layouts/      # 布局组件
├── router/       # Vue Router 路由
├── stores/       # Pinia 状态管理（5 个）
├── styles/       # 全局样式 SCSS
├── types/        # TypeScript 类型（11 个）
├── utils/        # 工具函数（11 个）
└── views/        # 页面视图（27 个）
```

## 修改规则

1. 新页面放 `views/`，在 `router/index.ts` 注册
2. 新 API 放 `api/`，用 `utils/request.ts` 的 axios 实例
3. 新组件放 `components/`，PascalCase 命名
4. 新类型放 `types/`，**禁止 `any`**
5. 样式用 SCSS，变量在 `styles/variables.scss`

## 后端映射

| API 文件 | 实际后端 | 说明 |
|----------|---------|------|
| product.ts | Python | CRUD 待迁移到 Java |
| selection.ts | Python | CRUD 待迁移到 Java |
| finalDrafts.ts | Python | CRUD 待迁移到 Java |
| materialLibrary.ts | Python | 含 AI 分析，保留 Python |
| carrierLibrary.ts | Python | 待迁移到 Java |
| image.ts | Python | 核心 AI，保留 Python |
| user.ts | Java | sjzm-user，已迁移 |
| productData.ts | Python | Polars 数据处理，保留 |
| import_export.ts | Python | Excel 处理，保留 |
| report.ts | Python | 脚本生成，保留 |
| lingxing.ts | Python | COS 上传，保留 |

**Java 后端已实现的前端页面：** 登录/用户管理/竞品分析/评分/ASIN 导入/筛选预设。
**仍在 Python 的页面：** 产品管理/选品/定稿/素材库/运营商库/图片管理/导入导出/数据看板/统计/报表/领星导入。

## 构建

**生产构建禁止在 Docker 内执行。** Docker Desktop 内存不够，Vite 构建会 OOM 导致守护进程崩溃。在宿主机运行：

```powershell
cd E:\项目\si-jue-zhi-mao-up\frontend
npm run build
```

输出到 `../static/vue-dist/`，prod-frontend 容器通过 volume 直接挂载使用，无需重建镜像。

</system-reminder>

<system-reminder>
Contents of /mnt/f/项目/si-jue-zhi-mao-up/backend/CLAUDE.md:

# Python 后端 - Claude 自动加载上下文

> FastAPI + Python 3.11 + Celery + Qdrant。详情见 [AGENTS.md](AGENTS.md)。

## 路径约定

- 路由前缀: `/api/v1/{resource}/`
- 业务服务: `app/services/`
- 数据模型: `app/models/`（SQLAlchemy）
- 异步任务: `app/tasks/`（Celery）
- 数据库迁移: `migrations/`

## 核心 AI 服务

| 服务 | 文件 | 依赖 |
|------|------|------|
| 向量编码 | `ai_vector_processing/` | torch + transformers |
| 以图搜图 | `tencent_image_search_service.py` | 腾讯云 SDK |
| 图像识别 | `tencent_image_recognition_service.py` | 腾讯云 SDK |
| LLM 视觉 | `tencent_llm_vision_service.py` | 混元大模型 |
| 评分引擎 | `scoring_engine.py` | 纯规则计算 |

## 修改规则

1. 新路由注册到 `app/api/v1/__init__.py` 的 `api_router`
2. 禁止在路由文件写业务逻辑 → 放 `services/` 下
3. AI 服务保持独立，不与 CRUD 逻辑耦合
4. 异步任务放 `tasks/`，通过 Celery 执行
5. DB 变更写 SQL 迁移文件放 `migrations/`
6. 禁止硬编码路径，用 `app/config.py` 的 `Settings`

## 当前状态

**仍在 Python 后端运行的功能：**
- 产品/选品/定稿/素材/运营商 CRUD
- 图片管理（以图搜图、相似搜索、COS 代理）
- 导入导出、数据看板、统计、报表、领星导入
- 系统配置、日志、下载管理

**已迁移到 Java 的功能：**
- 用户认证（登录/注册/刷新/登出）
- 竞品分析、评分引擎、ASIN 导入、筛选预设

新增 API 优先评估是否应在 Java 侧实现。

</system-reminder>