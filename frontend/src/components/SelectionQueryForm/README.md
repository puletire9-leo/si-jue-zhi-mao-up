# SelectionQueryForm 选品查询表单组件

## 简介

`SelectionQueryForm` 是一个通用的选品查询表单组件，用于整合选品相关页面的查询功能。支持总选品管理、新品榜管理、竞品店铺管理、选品回收站等页面的查询需求。

## 特性

- 🎯 **页面类型预设**：内置四种页面类型的默认配置
- 🔧 **高度可配置**：通过 Props 灵活控制显示内容
- 📱 **响应式布局**：适配不同屏幕尺寸
- 🎨 **统一风格**：保持与 Element Plus 一致的视觉风格
- 🔍 **完整功能**：支持搜索、重置、以图搜图等操作
- 📅 **日期范围**：支持回收站等需要日期筛选的场景

## 安装

组件已内置在项目中，无需额外安装。

## 基础用法

### 1. 总选品管理页面

```vue
<template>
  <div class="all-selection">
    <el-card class="main-card">
      <SelectionQueryForm
        ref="queryFormRef"
        page-type="all"
        :categories="categories"
        :total="pagination.total"
        @search="handleSearch"
        @reset="handleReset"
        @image-search="handleImageSearch"
      />
      
      <!-- 产品列表 -->
      <div class="product-list">
        <!-- ... -->
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'

const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>()

const categories = ref([
  { category: '电子产品', count: 120 },
  { category: '家居用品', count: 85 }
])

const pagination = reactive({
  page: 1,
  size: 60,
  total: 0
})

// 处理搜索
const handleSearch = (params: SelectionQueryParams) => {
  console.log('搜索参数:', params)
  // 调用API加载数据
  loadProducts(params)
}

// 处理重置
const handleReset = () => {
  pagination.page = 1
}

// 处理以图搜图
const handleImageSearch = () => {
  // 打开以图搜图对话框
}

// 加载产品列表
const loadProducts = async (params: SelectionQueryParams) => {
  const apiParams = {
    page: pagination.page,
    size: pagination.size,
    asin: params.asin,
    product_title: params.productTitle,
    store_name: params.storeName,
    category: params.category,
    product_type: params.productType,
    sort_by: params.sortField,
    sort_order: params.sortOrder
  }
  // const response = await selectionApi.getAllSelectionList(apiParams)
  // ...
}
</script>
```

### 2. 新品榜管理页面

```vue
<template>
  <div class="new-products">
    <el-card class="main-card">
      <SelectionQueryForm
        ref="queryFormRef"
        page-type="new"
        :categories="categories"
        @search="handleSearch"
        @reset="handleReset"
        @image-search="handleImageSearch"
      />
      
      <!-- 产品列表 -->
      <div class="product-list">
        <!-- ... -->
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'

const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>()
const categories = ref([])

const handleSearch = (params: SelectionQueryParams) => {
  // 处理组合搜索
  const searchField = params.searchType // 'asin' 或 'productTitle'
  const searchValue = params.keyword
  // 调用API...
}
</script>
```

### 3. 竞品店铺管理页面

```vue
<template>
  <div class="reference-products">
    <el-card class="main-card">
      <SelectionQueryForm
        ref="queryFormRef"
        page-type="reference"
        :categories="categories"
        @search="handleSearch"
        @reset="handleReset"
      />
      
      <!-- 产品列表 -->
      <div class="product-list">
        <!-- ... -->
      </div>
    </el-card>
  </div>
</template>
```

### 4. 选品回收站页面

```vue
<template>
  <div class="selection-recycle-bin">
    <el-card class="main-card">
      <SelectionQueryForm
        ref="queryFormRef"
        page-type="recycle"
        @search="handleSearch"
        @reset="handleReset"
      />
      
      <!-- 回收站列表 -->
      <div class="recycle-list">
        <!-- ... -->
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'

const handleSearch = (params: SelectionQueryParams) => {
  // 处理日期范围
  const startDate = params.startDate
  const endDate = params.endDate
  // 调用API...
}
</script>
```

## Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pageType` | `'all' \| 'new' \| 'reference' \| 'recycle'` | **必填** | 页面类型，决定默认显示哪些字段 |
| `showSource` | `boolean` | `false` | 是否显示来源筛选（总选品页面） |
| `showCombinedSearch` | `boolean` | `false` | 是否显示组合搜索（新品榜页面） |
| `showSort` | `boolean` | `false` | 是否显示排序字段和排序方式 |
| `showDateRange` | `boolean` | `false` | 是否显示日期范围选择器（回收站） |
| `showImageSearch` | `boolean` | `false` | 是否显示以图搜图按钮 |
| `showTitle` | `boolean` | `false` | 是否显示标题区域 |
| `showTotal` | `boolean` | `false` | 是否显示产品总数统计 |
| `categories` | `CategoryItem[]` | `[]` | 大类榜单列表 |
| `initialParams` | `Partial<SelectionQueryParams>` | `{}` | 初始查询参数 |
| `total` | `number` | `0` | 产品总数（用于显示统计） |
| `title` | `string` | `''` | 自定义标题 |

### 页面类型默认配置

不同 `pageType` 的默认配置：

| 页面类型 | 默认启用的功能 |
|----------|----------------|
| `all` (总选品) | showSource, showSort, showImageSearch, showTitle, showTotal |
| `new` (新品榜) | showCombinedSearch, showSort, showImageSearch |
| `reference` (竞品店铺) | showSort |
| `recycle` (回收站) | showDateRange |

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `search` | `(params: SelectionQueryParams)` | 点击搜索按钮时触发 |
| `reset` | `()` | 点击重置按钮时触发 |
| `imageSearch` | `()` | 点击以图搜图按钮时触发 |
| `change` | `(params: SelectionQueryParams)` | 查询参数变化时触发 |

## Methods

通过 `ref` 可以调用以下方法：

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `getQueryParams` | `()` | `SelectionQueryParams` | 获取当前查询参数 |
| `setQueryParams` | `(params: Partial<SelectionQueryParams>)` | `void` | 设置查询参数 |
| `handleSearch` | `()` | `void` | 手动触发搜索 |
| `handleReset` | `()` | `void` | 手动触发重置 |

### 方法使用示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'

const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>()

// 获取当前查询参数
const currentParams = queryFormRef.value?.getQueryParams()

// 设置查询参数
queryFormRef.value?.setQueryParams({
  asin: 'B08N5WRWNW',
  category: '电子产品'
})

// 手动触发搜索
queryFormRef.value?.handleSearch()

// 手动触发重置
queryFormRef.value?.handleReset()
</script>
```

## 类型定义

### SelectionQueryParams

```typescript
interface SelectionQueryParams {
  asin: string                    // ASIN搜索
  productTitle: string            // 商品标题搜索
  keyword: string                 // 组合搜索关键词
  searchType: 'asin' | 'productTitle'  // 搜索类型
  productType: '' | 'new' | 'reference' | 'zheng'  // 产品类型
  storeName: string               // 店铺名称
  category: string                // 大类榜单
  sortField: '' | 'salesVolume' | 'price' | 'listingDate' | 'createdAt'  // 排序字段
  sortOrder: '' | 'desc' | 'asc'  // 排序方式
  startDate: string               // 开始日期
  endDate: string                 // 结束日期
}
```

### CategoryItem

```typescript
interface CategoryItem {
  category: string  // 分类名称
  count: number     // 分类数量
}
```

## 高级用法

### 自定义显示配置

可以通过 Props 覆盖默认配置：

```vue
<template>
  <SelectionQueryForm
    page-type="all"
    :show-source="false"        <!-- 隐藏来源筛选 -->
    :show-sort="true"           <!-- 显示排序 -->
    :show-image-search="false"  <!-- 隐藏以图搜图 -->
    :show-title="true"
    title="自定义标题"
  />
</template>
```

### 监听参数变化

```vue
<template>
  <SelectionQueryForm
    page-type="all"
    @change="handleParamsChange"
  />
</template>

<script setup lang="ts">
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'

const handleParamsChange = (params: SelectionQueryParams) => {
  console.log('参数变化:', params)
  // 可以在这里做实时搜索或其他操作
}
</script>
```

### 结合分页使用

```vue
<template>
  <div>
    <SelectionQueryForm
      ref="queryFormRef"
      page-type="all"
      @search="handleSearch"
      @reset="handleReset"
    />
    
    <div class="product-list">
      <!-- 产品列表 -->
    </div>
    
    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.size"
      :total="pagination.total"
      @change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'

const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>()

const pagination = reactive({
  page: 1,
  size: 60,
  total: 0
})

const handleSearch = (params: SelectionQueryParams) => {
  pagination.page = 1  // 搜索时重置到第一页
  loadData(params)
}

const handleReset = () => {
  pagination.page = 1
}

const handlePageChange = () => {
  const params = queryFormRef.value?.getQueryParams()
  if (params) {
    loadData(params)
  }
}

const loadData = async (params: SelectionQueryParams) => {
  // 调用API加载数据
}
</script>
```

## 注意事项

1. **页面类型**：`pageType` 是必填项，它决定了组件的默认配置
2. **Props优先级**：手动设置的 Props 优先级高于页面类型的默认配置
3. **日期范围**：回收站页面的日期范围通过 `startDate` 和 `endDate` 传递
4. **组合搜索**：新品榜页面的组合搜索通过 `keyword` 和 `searchType` 传递
5. **样式覆盖**：组件使用 scoped CSS，如需覆盖样式请使用 `:deep()`

## 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🎯 支持四种页面类型
- 🔧 提供丰富的配置选项
- 📱 支持响应式布局
