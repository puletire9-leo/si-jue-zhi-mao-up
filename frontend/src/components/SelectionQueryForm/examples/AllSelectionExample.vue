<!--
  总选品管理页面 - 使用 SelectionQueryForm 组件示例
  
  使用说明：
  1. 将此代码复制到 AllSelection/index.vue 中替换原有的查询表单部分
  2. 保留原有的产品列表、分页、对话框等逻辑
  3. 根据实际API调整参数映射
-->

<template>
  <div class="all-selection">
    <div class="selection-layout">
      <div class="content">
        <el-card class="main-card">
          <template #header>
            <div class="card-header">
              <span>总选品管理</span>
              <div class="header-actions">
                <el-button type="primary" :icon="Plus" @click="handleAdd">
                  添加选品
                </el-button>
                <el-button type="success" :icon="Upload" @click="handleImport">
                  导入Excel
                </el-button>
                <el-button type="info" :icon="Download" @click="handleDownloadTemplate">
                  下载模板
                </el-button>
                <el-button type="warning" :icon="Refresh" @click="handleRecycleBin">
                  回收站
                </el-button>
                <el-button
                  type="danger"
                  :icon="Delete"
                  :disabled="selectedIds.length === 0"
                  @click="handleBatchDelete"
                >
                  批量删除 ({{ selectedIds.length }})
                </el-button>
                <el-button
                  type="success"
                  :icon="Download"
                  :disabled="selectedIds.length === 0"
                  :loading="exporting"
                  @click="handleExportAsins"
                >
                  导出选中ASIN ({{ selectedIds.length }})
                </el-button>
                <el-dropdown @command="handleSelectAll">
                  <el-button type="primary" :icon="Select">全选</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="current">选择当前页</el-dropdown-item>
                      <el-dropdown-item command="all">选择全部</el-dropdown-item>
                      <el-dropdown-item command="clear" :icon="CircleClose">清空选择</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>

          <!-- 使用 SelectionQueryForm 组件替换原有的查询表单 -->
          <SelectionQueryForm
            ref="queryFormRef"
            page-type="all"
            :categories="categories"
            :total="pagination.total"
            @search="handleSearch"
            @reset="handleReset"
            @image-search="handleSearchByImage"
          />

          <!-- 产品列表 -->
          <div v-loading="loading" class="products-grid">
            <UniversalCard
              v-for="product in productList"
              :key="product.id"
              :product="product"
              :selected="selectedIds.includes(product.asin)"
              mode="selection"
              @click="handleCardClick"
              @select="handleSelect"
              @view="handleView"
              @delete="handleDelete"
            />
            
            <el-empty
              v-if="!loading && productList.length === 0"
              description="暂无选品数据"
              :image-size="200"
            />
          </div>

          <!-- 分页 -->
          <el-pagination
            :current-page="pagination.page"
            :page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[60, 100, 200, 500]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </el-card>

        <!-- 其他对话框保持不变... -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Upload,
  Delete,
  Download,
  Refresh,
  Select,
  CircleClose
} from '@element-plus/icons-vue'
import UniversalCard from '@/components/UniversalCard/index.vue'
import SelectionQueryForm from '@/components/SelectionQueryForm/index.vue'
import type { SelectionQueryParams } from '@/components/SelectionQueryForm/types'
import { selectionApi } from '@/api/selection'

const router = useRouter()
const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>()

// 数据
const productList = ref([])
const selectedIds = ref<string[]>([])
const categories = ref([])
const loading = ref(false)
const exporting = ref(false)

const pagination = reactive({
  page: 1,
  size: 60,
  total: 0
})

// 加载分类列表
const loadCategories = async () => {
  try {
    const response = await selectionApi.getCategories()
    categories.value = response.data || []
  } catch (error) {
    console.error('加载分类列表失败:', error)
  }
}

// 加载产品列表
const loadProducts = async (params?: SelectionQueryParams) => {
  loading.value = true
  try {
    // 如果没有传入参数，从组件获取当前参数
    const queryParams = params || queryFormRef.value?.getQueryParams()
    
    const apiParams: any = {
      page: pagination.page,
      size: pagination.size,
      asin: queryParams?.asin || '',
      product_title: queryParams?.productTitle || '',
      store_name: queryParams?.storeName || '',
      category: queryParams?.category || '',
      product_type: queryParams?.productType || '',
      sort_by: queryParams?.sortField || 'createdAt',
      sort_order: queryParams?.sortOrder || 'desc'
    }
    
    const response = await selectionApi.getAllSelectionList(apiParams)
    productList.value = response.data?.list || []
    pagination.total = response.data?.total || 0
  } catch (error) {
    console.error('加载选品列表失败:', error)
    ElMessage.error('加载选品列表失败')
  } finally {
    loading.value = false
  }
}

// 处理搜索
const handleSearch = (params: SelectionQueryParams) => {
  pagination.page = 1
  loadProducts(params)
}

// 处理重置
const handleReset = () => {
  pagination.page = 1
  // 重置后会自动触发搜索
}

// 处理分页大小变化
const handleSizeChange = (size: number) => {
  pagination.size = size
  loadProducts()
}

// 处理页码变化
const handlePageChange = (page: number) => {
  pagination.page = page
  loadProducts()
}

// 处理以图搜图
const handleSearchByImage = () => {
  // 打开以图搜图对话框
  console.log('打开以图搜图对话框')
}

// 其他方法保持不变...
const handleAdd = () => {
  console.log('添加选品')
}

const handleImport = () => {
  console.log('导入Excel')
}

const handleDownloadTemplate = () => {
  console.log('下载模板')
}

const handleRecycleBin = () => {
  router.push('/selection-recycle-bin')
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个选品吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await selectionApi.batchDelete(selectedIds.value)
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    pagination.page = 1
    await loadCategories()
    await loadProducts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

const handleExportAsins = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要导出的商品')
    return
  }
  
  try {
    exporting.value = true
    const blob = await selectionApi.exportSelectedAsins(selectedIds.value)
    
    // 下载文件
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected_asins_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success(`成功导出 ${selectedIds.value.length} 个商品的ASIN`)
  } catch (error) {
    console.error('导出ASIN失败:', error)
    ElMessage.error('导出ASIN失败')
  } finally {
    exporting.value = false
  }
}

const handleSelectAll = async (command: string) => {
  if (command === 'current') {
    const currentAsins = productList.value.map((p: any) => p.asin)
    selectedIds.value = [...new Set([...selectedIds.value, ...currentAsins])]
    ElMessage.success(`已选择当前页 ${currentAsins.length} 个商品`)
  } else if (command === 'all') {
    try {
      const response = await selectionApi.getAllAsins()
      selectedIds.value = response.data.asins
      ElMessage.success(`已选择全部 ${response.data.total} 个商品`)
    } catch (error) {
      ElMessage.error('获取全部商品失败')
    }
  } else if (command === 'clear') {
    selectedIds.value = []
    ElMessage.info('已清空选择')
  }
}

const handleCardClick = (product: any) => {
  console.log('点击卡片:', product)
}

const handleSelect = (id: string, selected: boolean) => {
  if (selected) {
    selectedIds.value.push(id)
  } else {
    const index = selectedIds.value.indexOf(id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    }
  }
}

const handleView = (product: any) => {
  console.log('查看产品:', product)
}

const handleDelete = async (product: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选品 ${product.asin} 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await selectionApi.delete(product.id)
    ElMessage.success('删除成功')
    loadProducts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 初始化
onMounted(() => {
  loadCategories()
  loadProducts()
})
</script>

<style scoped lang="scss">
.all-selection {
  .selection-layout {
    display: flex;
    gap: 20px;
  }
  
  .content {
    flex: 1;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }
  
  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 20px;
    min-height: 400px;
  }
  
  .el-pagination {
    margin-top: 20px;
    justify-content: flex-end;
  }
}
</style>
