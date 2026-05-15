<template>
  <div class="carrier-library">
    <el-card class="main-card">
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="header-title">载体库管理</span>
          <div class="header-actions">
            <!-- 批量导入按钮 -->
            <el-button type="primary" :icon="Upload" @click="handleBatchImport">
              批量导入
            </el-button>
            
            <!-- 新增载体按钮 -->
            <el-button type="primary" :icon="Plus" @click="handleAddCarrier">
              新增载体
            </el-button>
            
            <!-- 批量操作按钮 -->
            <el-button 
              type="info" 
              :icon="Download" 
              :disabled="selectedItems.length === 0"
              @click="handleBatchDownload"
            >
              批量下载
            </el-button>
            
            <el-button 
              type="warning" 
              :icon="Edit" 
              :disabled="selectedItems.length === 0"
              @click="handleBatchEdit"
            >
              批量修改
            </el-button>
            
            <el-button 
              v-if="isAdmin"
              type="danger" 
              :icon="Delete" 
              :disabled="selectedItems.length === 0"
              @click="handleBatchDelete"
            >
              批量删除
            </el-button>
            
            <el-button 
              type="warning" 
              :icon="Refresh"
              @click="handleRecycleBin"
            >
              回收站
            </el-button>
            
            <!-- 分类排序按钮 -->
            <el-dropdown @command="handleSortCommand">
          <el-button type="default" :icon="Sort">
            分类排序<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="developer">开发人</el-dropdown-item>
                  <el-dropdown-item command="sku">SKU</el-dropdown-item>
                  <el-dropdown-item command="batch">批次</el-dropdown-item>
                  <el-dropdown-item command="createTime">创建时间</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
      
      <!-- 下载进度条 -->
      <el-progress 
        v-if="showProgress" 
        :percentage="downloadProgress" 
        :status="downloadStatus" 
        :text-inside="true" 
        :stroke-width="20" 
        class="download-progress"
      >
        <template #format>
          {{ downloadProgress }}% {{ progressText }}
        </template>
      </el-progress>

      <!-- 搜索表单 -->
      <div class="search-container">
        <div class="search-bar">
          <el-select
            v-model="queryParams.searchType"
            placeholder="搜索类型"
            class="search-type-select"
            size="small"
            style="width: 100px"
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
              v-model="queryParams.searchContent"
              placeholder="请输入搜索内容"
              clearable
              class="search-input"
              size="small"
              @keyup.enter="handleSearch"
            >
              <template #append>
                <el-button 
                  type="primary" 
                  :icon="Search" 
                  size="small"
                  @click="handleSearch"
                  class="search-btn"
                >
                  搜索
                </el-button>
              </template>
            </el-input>
            <el-button 
              :icon="List" 
              size="small"
              @click="openSearchDialog"
              class="advanced-search-icon-btn"
              title="多项精确搜索"
            >
            </el-button>
            <!-- 全选/取消全选图片按钮 -->
            <el-button 
              :type="isAllSelected ? 'default' : 'info'" 
              :icon="isAllSelected ? 'Close' : 'Collection'" 
              size="small"
              @click="handleSelectAll"
              class="select-all-btn"
              :title="isAllSelected ? '取消全选' : '全选当前列表所有图片'"
            >
              {{ isAllSelected ? '取消全选' : '全选' }}
            </el-button>
            <!-- 筛选功能 -->
            <el-button 
              type="default" 
              :icon="Filter" 
              size="small"
              @click="openFilterDialog"
              class="filter-btn"
              title="筛选条件"
            >
              筛选
            </el-button>
          </div>
        </div>
      </div>
      
      <!-- 多项精确搜索弹窗 -->
      <el-dialog
        v-model="searchDialogVisible"
        title="多项精确搜索"
        width="600px"
        destroy-on-close
      >
        <div class="advanced-search">
          <div class="search-type-selector">
            <span class="search-type-label">搜索类型：</span>
            <el-select
              v-model="queryParams.searchType"
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
            <el-button @click="closeSearchDialog">
              关闭
            </el-button>
            <el-button type="primary" @click="handleAdvancedSearch">
              搜索
            </el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 载体网格 -->
      <div v-loading="loading" class="drafts-grid">
        <!-- 载体卡片组件 -->
        <CarrierCard
          v-for="carrier in carrierList"
          :key="carrier.id"
          :carrier="carrier"
          :selected="selectedItems.includes(carrier.id)"
          :card-width="cardWidth"
          :card-height="cardHeight"
          @select="handleSelect"
          @edit="handleEdit"
          @update="handleUpdateCarrier"
          @delete="handleDelete"
          @download="handleDownload"
          @resize="handleCardResize"
        />
        
        <!-- 空状态 -->
        <el-empty
          v-if="!loading && carrierList.length === 0"
          description="暂无载体数据"
          :image-size="200"
        />
      </div>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[20, 40, 60, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- 新增/编辑载体对话框 -->
    <CarrierDialog
      v-model="dialogVisible"
      :is-edit="!!currentCarrier"
      :carrier-data="currentCarrier"
      @success="handleDialogSuccess"
    />

    <!-- 批次选择对话框 -->
    <el-dialog
      v-model="batchDialogVisible"
      title="选择批次"
      width="500px"
      :before-close="handleBatchDialogClose"
    >
      <div class="batch-list">
        <div
          v-for="batchItem in batchList"
          :key="batchItem.batch"
          class="batch-item"
          :class="{ selected: selectedBatch === batchItem.batch }"
          @click="selectBatch(batchItem)"
        >
          <div class="batch-info">
            <span class="batch-name">{{ batchItem.batch }}</span>
            <span class="image-count">{{ batchItem.imageCount }} 张图片</span>
          </div>
          <el-icon v-if="selectedBatch === batchItem.batch" class="check-icon">
            <Check />
          </el-icon>
        </div>
        
        <el-empty
          v-if="batchList.length === 0"
          description="暂无批次数据"
          :image-size="100"
        />
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleBatchDialogClose">取消</el-button>
          <el-button type="primary" @click="confirmBatchSelection" :disabled="!selectedBatch">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 筛选对话框 -->
    <el-dialog
      v-model="filterDialogVisible"
      title="筛选条件"
      width="350px"
      :before-close="handleFilterDialogClose"
      append-to-body
    >
      <div class="simple-filter-dialog">
        <!-- 简化的筛选条件 -->
        <div class="filter-section">
          <h4>开发人</h4>
          <el-checkbox-group v-model="tempFilterParams.developer">
            <el-checkbox
              v-for="developer in developerOptions"
              :key="developer"
              :label="developer"
              size="small"
            >
              {{ developer }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
        
        <div class="filter-section">
          <h4>状态</h4>
          <el-checkbox-group v-model="tempFilterParams.status">
            <el-checkbox label="finalized" size="small">已定稿</el-checkbox>
            <el-checkbox label="optimizing" size="small">未完成在优化</el-checkbox>
            <el-checkbox label="concept" size="small">构思</el-checkbox>
          </el-checkbox-group>
        </div>
        
        <div class="filter-section">
          <h4>批次</h4>
          <el-checkbox-group v-model="tempFilterParams.batch">
            <el-checkbox
              v-for="batch in batchOptions"
              :key="batch"
              :label="batch"
              size="small"
            >
              {{ batch }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
        
        <div class="filter-section">
          <h4>载体</h4>
          <el-checkbox-group v-model="tempFilterParams.carrier">
            <el-checkbox
              v-for="carrier in carrierOptions"
              :key="carrier"
              :label="carrier"
              size="small"
            >
              {{ carrier }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="resetFilter">重置</el-button>
          <el-button size="small" @click="handleFilterDialogClose">取消</el-button>
          <el-button type="primary" size="small" @click="confirmFilter">确定</el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 批量导入对话框 -->
    <CarrierBatchImportDialog
      v-model="batchImportDialogVisible"
      @success="handleDialogSuccess"
    />
    
    <!-- 批量修改对话框 -->
    <BatchEditDialog
      v-model="batchEditDialogVisible"
      :selected-ids="selectedItems"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'CarrierLibrary' })
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Download, Sort, Search, Refresh, Collection, Check, ArrowDown, Delete, List, Filter, Edit } from '@element-plus/icons-vue'
import CarrierCard from './components/CarrierCard.vue'
import CarrierDialog from './components/CarrierDialog.vue'
import CarrierBatchImportDialog from './components/CarrierBatchImportDialog.vue'
import BatchEditDialog from '../FinalDraft/components/BatchEditDialog.vue'
import { carrierLibraryApi } from '@/api/carrierLibrary'
import { systemConfigApi } from '@/api/systemConfig'
import { downloadFile, batchDownloadFiles, getFileExtension, formatFilename, downloadImagesAsZip } from '@/utils/download'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'
import { useUserStore } from '@/stores/user'

// 类型定义
interface Carrier {
  id: number
  carrier_name: string
  batch: string
  developer: string
  material: string
  process: string
  weight: number
  packaging_method: string
  packaging_size: string
  price: number
  minimum_order_quantity: number
  supplier: string
  supplier_order_link: string
  images: string[]
  reference_images: string[]
  referenceImages?: string[]
  create_time: string
  update_time: string
}

interface QueryParams {
  searchType: string
  searchContent: string
}

interface Pagination {
  page: number
  size: number
  total: number
}

// 用户状态管理
const userStore = useUserStore()

// 计算属性：检查用户是否为管理员
const isAdmin = computed(() => {
  return userStore.userInfo && (userStore.userInfo.role === '管理员' || userStore.userInfo.role === 'admin')
})

// 响应式数据
const loading = ref(false)
const dialogVisible = ref(false)
const batchDialogVisible = ref(false)
const batchImportDialogVisible = ref(false)
const batchEditDialogVisible = ref(false)
const currentCarrier = ref<Carrier | null>(null)
const selectedItems = ref<number[]>([])
const selectedBatch = ref<string>('')
const selectedDate = ref<string>('')

// 下载进度相关
const showProgress = ref(false)
const downloadProgress = ref(0)
const downloadStatus = ref<'success' | 'exception' | 'warning'>()
const progressText = ref('')

// 筛选对话框相关状态
const filterDialogVisible = ref(false)
const activeFilterPanels = ref<string[]>([])

// 筛选相关状态 - 修改为支持多选
const filterParams = reactive({
  developer: [] as string[],
  status: [] as string[],
  carrier: [] as string[],
  batch: [] as string[]
})

// 临时筛选参数，用于在对话框中临时存储筛选条件
const tempFilterParams = reactive({
  developer: [] as string[],
  status: [] as string[],
  carrier: [] as string[],
  batch: [] as string[]
})

// 开发人选项
const developerOptions = ref<string[]>([])

// 载体选项
const carrierOptions = ref<string[]>([])

// 批次选项
const batchOptions = ref<string[]>([])

// 路由实例
const router = useRouter()

// 搜索类型选项
const searchTypeOptions = [
  { label: 'SKU', value: 'sku' },
  { label: '批次', value: 'batch' },
  { label: '开发人', value: 'developer' },
  { label: '载体', value: 'carrier' },
  { label: '状态', value: 'status' },
  { label: '元素', value: 'element' }
]

const queryParams = reactive<QueryParams>({
  searchType: 'sku',
  searchContent: ''
})

// 搜索弹窗相关
const searchDialogVisible = ref(false)
// 多项精确搜索专用状态，避免与普通搜索混淆
const advancedSearchContent = ref('')

const pagination = reactive<Pagination>({
  page: 1,
  size: 20,
  total: 0
})

const carrierList = ref<Carrier[]>([])

// 判断是否已全选所有carrier卡片
const isAllSelected = computed(() => {
  return carrierList.value.length > 0 && selectedItems.value.length === carrierList.value.length
})

// 批次列表数据
interface BatchItem {
  batch: string
  imageCount: number
}

const batchList = ref<BatchItem[]>([
  { batch: 'BATCH202401', imageCount: 15 },
  { batch: 'BATCH202402', imageCount: 8 },
  { batch: 'BATCH202403', imageCount: 22 },
  { batch: 'BATCH202404', imageCount: 5 },
  { batch: 'BATCH202405', imageCount: 12 }
])

// 方法
const loadCarriers = async (): Promise<void> => {
  loading.value = true
  try {
    // 构建API请求参数
    const apiParams = {
      search_type: queryParams.searchType,
      search_content: queryParams.searchContent,
      developer: filterParams.developer,
      batch: filterParams.batch,
      page: pagination.page,
      size: pagination.size
    }
    
    // 添加调试日志，打印API请求参数
    console.log('发送到API的请求参数:', apiParams)
    
    // 调用真实API
    const response = await carrierLibraryApi.getList(apiParams)
    
    // 添加调试日志，打印API返回的完整数据
    console.log('API返回的数据:', response)
    console.log('list数组长度:', response.data?.list?.length)
    console.log('total字段值:', response.data?.total)
    
    if (response.code === 200) {
        const listData = response.data?.list
        let processedList: Carrier[] = []
        if (Array.isArray(listData)) {
            processedList = listData.map((item: any) => ({
              id: item.id,
              carrier_name: item.carrier_name || item.carrier || '',
              batch: item.batch || '',
              developer: item.developer || '',
              material: item.material || '',
              process: item.process || '',
              weight: item.weight || 0,
              packaging_method: item.packaging_method || '',
              packaging_size: item.packaging_size || '',
              price: item.price || 0,
              minimum_order_quantity: item.minimum_order_quantity || 0,
              supplier: item.supplier || '',
              supplier_order_link: item.supplier_order_link || '',
              images: item.images || [],
              reference_images: item.reference_images || [],
              referenceImages: item.reference_images || [],
              create_time: item.create_time || item.createTime || '',
              update_time: item.update_time || item.updateTime || ''
            }))
        } else {
            processedList = []
        }
        
        carrierList.value = processedList
        
        let totalCount = response.data?.total || 0
        if (totalCount === 0 && processedList.length > 0) {
            totalCount = processedList.length
        }
        
        pagination.total = totalCount
        pagination.page = response.data?.page || 1
        pagination.size = response.data?.size || 20
        
        console.log('最终分页信息:', {
            total: pagination.total,
            page: pagination.page,
            size: pagination.size,
            listLength: processedList.length
        })
      
    } else {
      // API调用失败，确保carrierList为空数组
      carrierList.value = []
      ElMessage.error(response.message || '加载载体数据失败')
      console.error('API返回错误:', response)
    }
  } catch (error: any) {
    // 捕获网络错误或其他异常，确保carrierList为空数组
    carrierList.value = []
    console.error('加载载体数据失败:', error)
    ElMessage.error(error.message || '加载载体数据失败')
  } finally {
    // 确保loading状态总是被设置为false
    loading.value = false
  }
}

const handleSearch = (): void => {
  pagination.page = 1
  loadCarriers()
}

const handleReset = (): void => {
  Object.assign(queryParams, {
    searchType: 'carrier_name',
    searchContent: ''
  })
  pagination.page = 1
  loadCarriers()
}

// 搜索弹窗相关方法
const openSearchDialog = (): void => {
  // 打开搜索对话框时，清空专用搜索内容
  advancedSearchContent.value = ''
  searchDialogVisible.value = true
}

const closeSearchDialog = (): void => {
  // 关闭对话框时，清空专用搜索内容，不影响普通搜索
  advancedSearchContent.value = ''
  searchDialogVisible.value = false
}

const clearSearchContent = (): void => {
  // 清空普通搜索内容
  queryParams.searchContent = ''
}

const clearAdvancedSearchContent = (): void => {
  // 清空多项精确搜索内容
  advancedSearchContent.value = ''
}

const preprocessSearchContent = (content: string): string => {
  if (!content) return ''
  
  // 替换各种换行符为空格
  let processed = content.replace(/[\r\n]+/g, ' ')
  
  // 替换逗号为空格
  processed = processed.replace(/,+/g, ' ')
  
  // 合并多个空格为一个
  processed = processed.replace(/\s+/g, ' ')
  
  // 去除前后空格
  processed = processed.trim()
  
  return processed
}

const handleAdvancedSearch = (): void => {
  // 预处理多项精确搜索内容，支持多种分隔符
  const processedContent = preprocessSearchContent(advancedSearchContent.value)
  // 使用处理后的内容进行搜索，不影响普通搜索状态
  queryParams.searchContent = processedContent
  searchDialogVisible.value = false
  handleSearch()
}

// 处理筛选命令
// 筛选对话框相关方法
const openFilterDialog = (): void => {
  // 打开筛选对话框时，将当前筛选条件复制到临时筛选参数
  Object.assign(tempFilterParams, {
    developer: [...filterParams.developer],
    status: [...filterParams.status],
    carrier: [...filterParams.carrier],
    batch: [...filterParams.batch]
  })
  filterDialogVisible.value = true
}

const handleFilterDialogClose = (): void => {
  // 关闭筛选对话框时，清空临时筛选参数
  resetFilter()
  filterDialogVisible.value = false
}

const resetFilter = (): void => {
  // 重置临时筛选参数
  Object.assign(tempFilterParams, {
    developer: [],
    status: [],
    carrier: [],
    batch: []
  })
}

const confirmFilter = (): void => {
  // 确认筛选条件，将临时筛选参数复制到正式筛选参数
  Object.assign(filterParams, {
    developer: [...tempFilterParams.developer],
    batch: [...tempFilterParams.batch]
  })
  
  // 关闭对话框
  filterDialogVisible.value = false
  
  // 重新加载数据
  pagination.page = 1
  loadCarriers()
  
  // 显示筛选成功消息
  const filterCounts = {
    developer: filterParams.developer.length,
    batch: filterParams.batch.length
  }
  let message = '已应用筛选条件'
  if (filterCounts.developer > 0 || filterCounts.batch > 0) {
    message += `: 开发人(${filterCounts.developer})，批次(${filterCounts.batch})`
  }
  ElMessage.success(message)
}

// 全选/取消全选图片功能
const handleSelectAll = (): void => {
  if (carrierList.value.length === 0) {
    ElMessage.warning('当前列表没有可选择的图片')
    return
  }
  
  if (isAllSelected.value) {
    // 取消全选
    selectedItems.value = []
    ElMessage.success('已取消全选所有图片')
  } else {
    // 全选所有carrier卡片
    selectedItems.value = carrierList.value.map(carrier => carrier.id)
    ElMessage.success(`已全选 ${selectedItems.value.length} 个载体卡片`)
  }
}

const handleAddCarrier = (): void => {
  currentCarrier.value = null
  dialogVisible.value = true
}

const handleEdit = (carrier: Carrier): void => {
  currentCarrier.value = carrier
  dialogVisible.value = true
}

const handleDelete = async (carrier: Carrier): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除载体 ${carrier.carrier_name} 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实删除API
    const response = await carrierLibraryApi.delete(carrier.id)
    
    if (response.code === 200) {
      ElMessage.success(response.message || '删除成功')
      // 立即从列表中移除被删除的载体，确保UI立即更新
      const index = carrierList.value.findIndex(item => item.id === carrier.id)
      if (index > -1) {
        carrierList.value.splice(index, 1)
        // 如果是最后一页且删除后列表为空，切换到上一页
        if (carrierList.value.length === 0 && pagination.page > 1) {
          pagination.page--
        }
      }
      loadCarriers()
    } else {
      // 根据错误信息显示不同的提示
      if (response.code === 400 && response.message.includes('已存在于回收站')) {
        ElMessage.warning('该载体已存在于回收站，无需重复删除')
      } else if (response.code === 404) {
        ElMessage.warning('该载体不存在，可能已被删除')
      } else {
        ElMessage.error(response.message || '删除失败')
      }
    }
  } catch (error: any) {
    // 用户取消删除或API调用失败
    if (error !== 'cancel') {
      console.error('删除载体失败:', error)
      // 处理网络错误或其他异常
      if (error.response?.data?.message) {
        if (error.response.status === 400 && error.response.data.message.includes('已存在于回收站')) {
          ElMessage.warning('该载体已存在于回收站，无需重复删除')
        } else if (error.response.status === 404) {
          ElMessage.warning('该载体不存在，可能已被删除')
        } else {
          ElMessage.error(error.response.data.message || '删除失败')
        }
      } else {
        ElMessage.error('删除失败')
      }
    }
  }
}

const handleSelect = (draftId: number, selected: boolean): void => {
  if (selected) {
    selectedItems.value.push(draftId)
  } else {
    const index = selectedItems.value.indexOf(draftId)
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    }
  }
}

/**
 * 处理批量下载
 */
const handleBatchDownload = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要下载的载体')
    return
  }

  try {
    // 收集所有选中的载体对象
    const selectedCarriers = carrierList.value.filter(carrier => selectedItems.value.includes(carrier.id))

    if (selectedCarriers.length === 0) {
      ElMessage.warning('未找到选中的载体')
      return
    }

    // 收集所有要下载的图片
    const filesToDownload: Array<{ url: string; filename: string }> = []

    for (const carrier of selectedCarriers) {
      // 添加设计稿
      if (carrier.images && carrier.images.length > 0) {
        for (let i = 0; i < carrier.images.length; i++) {
          const originalUrl = ImageUrlUtil.getOriginalUrl(carrier.images[i])
          // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
          const ext = 'jpg'
          const filename = formatFilename(`载体-${carrier.carrier_name}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
          filesToDownload.push({ url: originalUrl, filename })
        }
      }

      // 添加效果图
      if (carrier.reference_images && carrier.reference_images.length > 0) {
        for (let i = 0; i < carrier.reference_images.length; i++) {
          const originalUrl = ImageUrlUtil.getOriginalUrl(carrier.reference_images[i])
          // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
          const ext = 'jpg'
          const filename = formatFilename(`效果图-${carrier.carrier_name}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
          filesToDownload.push({ url: originalUrl, filename })
        }
      }
    }

    if (filesToDownload.length === 0) {
      ElMessage.warning('选中的载体没有可下载的图片')
      return
    }

    // 显示开始下载的提示
    ElMessage.success(`开始批量下载，共 ${selectedCarriers.length} 个载体，${filesToDownload.length} 张图片`)

    // 使用后端API进行批量下载
    const zipFilename = formatFilename(`载体图片-${new Date().getTime()}.zip`)

    // 初始化进度条
    showProgress.value = true
    downloadProgress.value = 0
    downloadStatus.value = undefined
    progressText.value = '准备下载...'

    // 获取认证token
    const token = localStorage.getItem('token')

    // 第一步：调用 download-zip API 创建下载任务
    progressText.value = '正在创建下载任务...'
    const createTaskResponse = await fetch('/api/v1/final-drafts/download-zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(filesToDownload),
    })

    if (!createTaskResponse.ok) {
      throw new Error(`创建下载任务失败! status: ${createTaskResponse.status}`)
    }

    // 解析响应获取 task_id
    const taskResult = await createTaskResponse.json()
    if (!taskResult.success || !taskResult.data?.task_id) {
      throw new Error(taskResult.message || '创建下载任务失败')
    }

    const taskId = taskResult.data.task_id
    console.log(`批量下载任务创建成功，任务ID: ${taskId}`)
    progressText.value = '正在打包文件...'
    downloadProgress.value = 50

    // 第二步：使用 task_id 下载实际的ZIP文件
    progressText.value = '正在下载ZIP文件...'
    const downloadResponse = await fetch(`/api/v1/final-drafts/download-tasks/${taskId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
    })

    if (!downloadResponse.ok) {
      throw new Error(`下载ZIP文件失败! status: ${downloadResponse.status}`)
    }

    // 获取响应内容长度
    const contentLength = downloadResponse.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
    let receivedBytes = 0

    // 创建可读流
    const reader = downloadResponse.body?.getReader()
    const chunks: Uint8Array[] = []

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(value)
        receivedBytes += value.length

        // 更新进度 (50% - 99%)
        if (totalBytes > 0) {
          downloadProgress.value = Math.min(99, 50 + Math.floor((receivedBytes / totalBytes) * 49))
        }
      }
    }

    // 合并所有块创建Blob，指定类型为ZIP
    const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' })

    // 完成下载，更新进度到100%
    downloadProgress.value = 100
    downloadStatus.value = 'success'
    progressText.value = '下载完成！'

    console.log('成功获取Blob对象，大小:', blob.size, 'bytes')

    // 创建下载链接
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = zipFilename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()

    // 清理资源
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)

    // 显示下载完成的提示
    ElMessage.success(`批量下载完成，已打包为 ${zipFilename}`)

    // 3秒后隐藏进度条
    setTimeout(() => {
      showProgress.value = false
    }, 3000)

  } catch (error: any) {
    console.error('批量下载失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : undefined
    })

    // 更新进度条状态为异常
    downloadStatus.value = 'exception'
    downloadProgress.value = 100
    progressText.value = '下载失败！'

    // 3秒后隐藏进度条
    setTimeout(() => {
      showProgress.value = false
    }, 3000)

    // 根据错误类型显示更详细的提示
    if (error.response) {
      if (error.response.status === 500) {
        ElMessage.error(`批量下载失败: 服务器内部错误，${error.response.data?.detail || '无法生成ZIP文件'}`)
      } else if (error.response.status === 400) {
        ElMessage.error(`批量下载失败: 请求参数错误，${error.response.data?.detail || '无效的文件列表'}`)
      } else {
        ElMessage.error(`批量下载失败: HTTP错误 ${error.response.status}`)
      }
    } else if (error.request) {
      ElMessage.error('批量下载失败: 网络连接失败，无法连接到服务器')
    } else {
      ElMessage.error(`批量下载失败: ${error.message || '未知错误'}`)
    }
  }
}

const handleBatchDelete = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要删除的载体')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedItems.value.length} 个载体吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实批量删除API
    const response = await carrierLibraryApi.batchDelete({ ids: selectedItems.value })
    
    if (response.code === 200) {
      ElMessage.success(`成功删除 ${response.data.success} 个载体，失败 ${response.data.failed} 个`)
      const deletedIds = selectedItems.value
      selectedItems.value = []
      // 立即从列表中移除被删除的载体，确保UI立即更新
      if (deletedIds.length > 0) {
        carrierList.value = carrierList.value.filter(carrier => !deletedIds.includes(carrier.id))
        // 如果是最后一页且删除后列表为空，切换到上一页
        if (carrierList.value.length === 0 && pagination.page > 1) {
          pagination.page--
        }
      }
      loadCarriers()
    } else {
      ElMessage.error(response.message || '批量删除失败')
    }
  } catch (error) {
    // 用户取消删除或API调用失败
    if (error !== 'cancel') {
      console.error('批量删除载体失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

// 跳转到回收站页面
const handleRecycleBin = (): void => {
  router.push('/carrier-library-recycle-bin')
}

// 批量导入方法
const handleBatchImport = (): void => {
  batchImportDialogVisible.value = true
}

// 批量修改方法
const handleBatchEdit = (): void => {
  batchEditDialogVisible.value = true
}

/**
 * 处理载体下载
 * @param carrier 载体对象
 */
const handleDownload = async (carrier: Carrier): Promise<void> => {
  try {
    const totalImages = (carrier.images?.length || 0) + (carrier.reference_images?.length || 0)

    if (totalImages === 0) {
      ElMessage.warning(`载体 ${carrier.carrier_name} 没有可下载的图片`)
      return
    }

    // 收集所有要下载的图片
    const filesToDownload: Array<{ url: string; filename: string }> = []

    // 添加设计稿
    if (carrier.images && carrier.images.length > 0) {
      for (let i = 0; i < carrier.images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(carrier.images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`载体-${carrier.carrier_name}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }

    // 添加效果图
    if (carrier.reference_images && carrier.reference_images.length > 0) {
      for (let i = 0; i < carrier.reference_images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(carrier.reference_images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`效果图-${carrier.carrier_name}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }

    // 显示开始下载的提示
    ElMessage.success(`开始下载载体 ${carrier.carrier_name} 的图片，共 ${totalImages} 张`)

    // 使用后端API进行下载
    const zipFilename = formatFilename(`载体-${carrier.carrier_name}-图片-${new Date().getTime()}.zip`)

    // 初始化进度条
    showProgress.value = true
    downloadProgress.value = 0
    downloadStatus.value = undefined
    progressText.value = '准备下载...'

    // 获取认证token
    const token = localStorage.getItem('token')

    // 第一步：调用 download-zip API 创建下载任务
    progressText.value = '正在创建下载任务...'
    const createTaskResponse = await fetch('/api/v1/final-drafts/download-zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(filesToDownload),
    })

    if (!createTaskResponse.ok) {
      throw new Error(`创建下载任务失败! status: ${createTaskResponse.status}`)
    }

    // 解析响应获取 task_id
    const taskResult = await createTaskResponse.json()
    if (!taskResult.success || !taskResult.data?.task_id) {
      throw new Error(taskResult.message || '创建下载任务失败')
    }

    const taskId = taskResult.data.task_id
    console.log(`下载任务创建成功，任务ID: ${taskId}`)
    progressText.value = '正在打包文件...'
    downloadProgress.value = 50

    // 第二步：使用 task_id 下载实际的ZIP文件
    progressText.value = '正在下载ZIP文件...'
    const downloadResponse = await fetch(`/api/v1/final-drafts/download-tasks/${taskId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
    })

    if (!downloadResponse.ok) {
      throw new Error(`下载ZIP文件失败! status: ${downloadResponse.status}`)
    }

    // 获取响应内容长度
    const contentLength = downloadResponse.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
    let receivedBytes = 0

    // 创建可读流
    const reader = downloadResponse.body?.getReader()
    const chunks: Uint8Array[] = []

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(value)
        receivedBytes += value.length

        // 更新进度 (50% - 99%)
        if (totalBytes > 0) {
          downloadProgress.value = Math.min(99, 50 + Math.floor((receivedBytes / totalBytes) * 49))
        }
      }

      // 完成下载
      downloadProgress.value = 100
      downloadStatus.value = 'success'
      progressText.value = '下载完成！'

      // 构建最终的Blob，指定类型为ZIP
      const blob = new Blob(chunks as BlobPart[], { type: 'application/zip' })

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = zipFilename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()

      // 清理
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showProgress.value = false
      }, 100)

      ElMessage.success(`载体 ${carrier.carrier_name} 的图片已打包成ZIP文件下载完成`)
    } else {
      throw new Error('无法读取响应内容')
    }
  } catch (error: any) {
    console.error(`下载载体 ${carrier.carrier_name} 失败:`, error)
    ElMessage.error(`下载载体 ${carrier.carrier_name} 失败: ${error.message || '未知错误'}`)
    downloadStatus.value = 'exception'
    progressText.value = '下载失败！'
    setTimeout(() => {
      showProgress.value = false
    }, 3000)
  }
}

const handleSortCommand = (command: string): void => {
  // 排序逻辑
  ElMessage.info(`按${command}排序`)
}

const handleSizeChange = (size: number): void => {
  pagination.size = size
  loadCarriers()
}

const handlePageChange = (page: number): void => {
  pagination.page = page
  loadCarriers()
}

const handleDialogSuccess = (): void => {
  dialogVisible.value = false
  loadCarriers()
}

// 处理载体更新
const handleUpdateCarrier = async (updatedCarrier: Carrier): Promise<void> => {
  try {
    const response = await carrierLibraryApi.update(updatedCarrier.id, updatedCarrier)
    if (response.code === 200) {
      ElMessage.success('载体更新成功')
      // 更新本地列表中的数据 - 使用后端返回的数据和splice确保响应式更新
      const index = carrierList.value.findIndex(carrier => carrier.id === updatedCarrier.id)
      if (index > -1) {
        // 合并原有数据、前端更新数据、后端返回数据，确保所有字段都更新
        const mergedData = { 
          ...carrierList.value[index], 
          ...updatedCarrier,
          ...response.data  // 后端返回的数据优先级最高
        }
        // 使用splice替换数组元素，确保Vue检测到变化
        carrierList.value.splice(index, 1, mergedData)
      }
    } else {
      ElMessage.error(response.message || '载体更新失败')
    }
  } catch (error) {
    console.error('更新载体失败:', error)
    ElMessage.error('更新载体失败')
  }
}

// 处理卡片调整大小
const handleCardResize = (carrierId: number, width: number, height: number): void => {
  console.log(`Card ${carrierId} resized to ${width}x${height}`)
  // 这里可以添加保存卡片大小的逻辑
}

// 批次选择相关方法
const handleBatchSelect = (): void => {
  batchDialogVisible.value = true
  selectedBatch.value = queryParams.searchContent
}

const handleBatchDialogClose = (): void => {
  batchDialogVisible.value = false
  selectedBatch.value = ''
}

const selectBatch = (batchItem: BatchItem): void => {
  selectedBatch.value = batchItem.batch
}

const confirmBatchSelection = (): void => {
  queryParams.searchType = 'batch'
  queryParams.searchContent = selectedBatch.value
  batchDialogVisible.value = false
  handleSearch()
}

// 日期选择相关方法
const handleDateChange = (date: string): void => {
  // 日期选择功能已集成到新的搜索界面
  if (date) {
    queryParams.searchType = 'batch'
    queryParams.searchContent = date
    handleSearch()
  }
}

// 卡片大小设置
const cardWidth = ref(200)
const cardHeight = ref(200)

// 加载开发人列表、载体列表和卡片大小设置
const loadSystemConfigs = async () => {
  try {
    // 加载开发人列表
    const developerResponse = await systemConfigApi.getDeveloperList()
    if (developerResponse.code === 200 && developerResponse.data && Array.isArray(developerResponse.data.developerList)) {
      developerOptions.value = developerResponse.data.developerList
    } else {
      // 默认开发人列表
      developerOptions.value = ['admin', 'user1', 'user2']
    }
    
    // 加载载体列表
    const carrierResponse = await systemConfigApi.getCarrierList()
    if (carrierResponse.code === 200 && carrierResponse.data && Array.isArray(carrierResponse.data.carrierList)) {
      carrierOptions.value = carrierResponse.data.carrierList
    } else {
      // 默认载体列表
      carrierOptions.value = []
    }
    
    // 加载产品卡片大小设置
    const imageSettingsResponse = await systemConfigApi.getImageSettings()
    if (imageSettingsResponse.code === 200 && imageSettingsResponse.data) {
      cardWidth.value = imageSettingsResponse.data.productCardWidth || 200
      cardHeight.value = imageSettingsResponse.data.productCardHeight || 200
    }
  } catch (error) {
    console.error('加载系统配置失败:', error)
    developerOptions.value = ['admin', 'user1', 'user2']
    carrierOptions.value = []
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<style scoped lang="scss">
.carrier-library {
  padding: 20px;
  height: calc(100vh - 40px);
  overflow: hidden;
}

// 批次输入框样式
.batch-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  
  .batch-input {
    flex: 1;
  }
  
  .batch-select-btn {
    flex-shrink: 0;
  }
}

// 日期选择器样式
.date-picker-wrapper {
  .date-picker {
    width: 100%;
  }
}

// 批次选择对话框样式
.batch-list {
  max-height: 400px;
  overflow-y: auto;
  
  .batch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    margin-bottom: 8px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      border-color: #409eff;
      background-color: #f5f7fa;
    }
    
    &.selected {
      border-color: #409eff;
      background-color: #ecf5ff;
    }
    
    .batch-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .batch-name {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
      }
      
      .image-count {
        font-size: 12px;
        color: #909399;
      }
    }
    
    .check-icon {
      color: #409eff;
      font-size: 16px;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.search-container {
  margin-bottom: 5px;
}

.search-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-type-select {
  flex-shrink: 0;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  /* 增加搜索容器宽度，让搜索框更大 */
  width: 500px;
}

.search-input {
  /* 增加搜索框宽度，占据更多空间 */
  width: calc(100% - 60px);
  /* 保持搜索框高度 */
  --el-input-height: 32px;
}

.search-btn {
  /* 保持搜索按钮高度 */
  --el-button-size: 32px;
  /* 减小搜索按钮宽度 */
  width: 60px;
  margin-left: -1px;
}

.advanced-search-icon-btn {
  /* 图标按钮样式 */
  width: 32px;
  height: 32px;
  min-width: auto;
  margin-left: 12px; /* 增加左侧间距 */
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  transition: all 0.3s;
  
  &:hover {
    background: #ecf5ff;
    color: #409eff;
  }
}

/* 全选按钮样式 */
.select-all-btn {
  /* 全选按钮样式，与筛选按钮保持一致 */
  margin-left: 12px; /* 增加左侧间距，与搜索按钮保持距离 */
  --el-button-size: 32px;
  border-radius: 4px;
}

/* 筛选按钮样式 */
.filter-btn {
  margin-left: 12px; /* 增加左侧间距，与搜索按钮保持距离 */
  --el-button-size: 32px;
  border-radius: 4px;
}

/* 筛选对话框样式 */
.filter-dialog {
  padding: 10px 0; /* 减小内边距 */
  
  .el-collapse {
    margin: 0;
  }
  
  .el-collapse-item__header {
    padding: 8px 10px; /* 减小折叠项头部内边距 */
    font-size: 14px;
  }
  
  .el-collapse-item__content {
    padding: 10px;
    padding-top: 8px;
    padding-bottom: 15px;
  }
  
  .el-checkbox-group {
    margin-top: 5px;
  }
  
  /* 复选框网格布局 */
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* 两列布局 */
    gap: 8px 12px; /* 行列间距 */
    align-items: center;
  }
  
  .el-checkbox {
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 简化筛选对话框样式 */
.simple-filter-dialog {
  padding: 10px 0;
  
  .filter-section {
    margin-bottom: 15px;
    
    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
    }
    
    .el-checkbox {
      margin-right: 15px;
      margin-bottom: 8px;
    }
  }
}

.advanced-search {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-type-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-type-label {
  font-weight: 500;
  color: #606266;
}

.search-content-area {
  margin-top: 12px;
}

.search-content-area .el-textarea__inner {
  font-family: monospace;
  font-size: 14px;
}

.drafts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(v-bind('cardWidth + "px"'), 1fr));
  gap: 20px;
  margin-bottom: 0;
  min-height: 200px;
  max-height: calc(100% - 130px);
  overflow-y: auto;
  flex: 1;
  padding: 20px;
  align-items: start;
  background: #f5f7fa;
  border-radius: 8px;
}

.main-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.el-pagination {
  display: flex;
  justify-content: center;
  margin: 0;
  padding: 8px 0;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  z-index: 10;
}
</style>