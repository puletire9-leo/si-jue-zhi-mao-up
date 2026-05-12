<script setup lang="ts">
/**
 * 选品查询表单组件
 * @description 通用选品查询表单，支持总选品、新品榜、竞品店铺、回收站等页面
 * @author AI Assistant
 * @version 1.3.0
 */
import { ref, reactive, computed, watch } from 'vue'
import { Search, Refresh, Picture, List, Filter } from '@element-plus/icons-vue'
import type { SelectionQueryParams, SelectionQueryFormProps, CategoryItem, SearchTypeOption } from './types'
import { defaultQueryParams, pageTypeConfig, defaultSearchTypeOptions } from './types'

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

// 多项精确搜索对话框
const advancedSearchDialogVisible = ref(false)
const advancedSearchContent = ref('')

// 筛选对话框
const filterDialogVisible = ref(false)

// 国家选项（值必须与数据库中存储的值一致）
const countryOptions = [
  { label: '英国', value: '英国' },
  { label: '德国', value: '德国' }
]

// 数据筛选模式选项（值必须与数据库中存储的值一致）
const dataFilterModeOptions = [
  { label: '模式一', value: '模式一' },
  { label: '模式二', value: '模式二' }
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
    padding: 16px 0;
    margin-bottom: 16px;
    
    .search-filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .country-select {
        width: 120px;
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
