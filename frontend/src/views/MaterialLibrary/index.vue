<template>
  <div class="material-library">
    <el-card class="main-card">
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="header-title">素材库管理</span>
          <div class="header-actions">
            <!-- 元素词编辑按钮 -->
            <el-button type="primary" :icon="Setting" @click="handleElementWordEdit">
              元素词编辑
            </el-button>
            
            <!-- 批量导入按钮 -->
            <el-button type="primary" :icon="Upload" @click="handleBatchImport">
              批量导入
            </el-button>
            
            <!-- 新增素材按钮 -->
            <el-button type="primary" :icon="Plus" @click="handleAddDraft">
              新增素材
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

      <!-- 素材网格 -->
      <div v-loading="loading" class="drafts-grid">
        <!-- 素材卡片组件 -->
        <DraftCard
          v-for="draft in draftList"
          :key="draft.id"
          :draft="draft"
          :selected="selectedItems.includes(draft.id)"
          :only-material-images="true"
          :only-show-element="true"
          @select="handleSelect"
          @edit="handleEdit"
          @delete="handleDelete"
          @download="handleDownload"
        />
        
        <!-- 空状态 -->
        <el-empty
          v-if="!loading && draftList.length === 0"
          description="暂无素材数据"
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

    <!-- 新增/编辑素材对话框 -->
    <MaterialDialog
      v-model="dialogVisible"
      :is-edit="!!currentDraft"
      :material-data="currentDraft"
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
    <MaterialBatchImportDialog
      v-model="batchImportDialogVisible"
      @success="handleDialogSuccess"
    />
    
    <!-- 批量修改对话框 -->
    <BatchEditDialog
      v-model="batchEditDialogVisible"
      :selected-ids="selectedItems"
      @success="handleDialogSuccess"
    />
    
    <!-- 元素词编辑对话框 -->
    <ElementWordEditorDialog
      v-model="elementWordDialogVisible"
      @success="handleElementWordSuccess"
    />
    
    <!-- 文件命名对话框 -->
    <el-dialog
      v-model="fileNameDialogVisible"
      :title="isBatchDownload ? '批量下载文件命名' : '下载文件命名'"
      width="500px"
    >
      <div class="file-name-dialog">
        <el-form :model="fileNameForm" label-width="80px">
          <el-form-item label="文件名称">
            <el-input
              v-model="fileNameForm.name"
              placeholder="请输入文件名"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="文件类型">
            <el-select v-model="fileNameForm.type" disabled>
              <el-option label="ZIP压缩包" value="zip" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isBatchDownload">
            <el-checkbox v-model="fileNameForm.includeDate">包含当前日期</el-checkbox>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="fileNameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmFileName" :disabled="!fileNameForm.name.trim()">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'MaterialLibrary' })
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Download, Sort, Search, Refresh, Collection, Check, ArrowDown, Delete, List, Filter, Edit, Setting } from '@element-plus/icons-vue'
import DraftCard from '../FinalDraft/components/DraftCard.vue'
import MaterialDialog from './components/MaterialDialog.vue'
import MaterialBatchImportDialog from './components/MaterialBatchImportDialog.vue'
import BatchEditDialog from '../FinalDraft/components/BatchEditDialog.vue'
import ElementWordEditorDialog from './components/ElementWordEditorDialog.vue'
import { materialLibraryApi } from '@/api/materialLibrary'
import { systemConfigApi } from '@/api/systemConfig'
import { downloadFile, batchDownloadFiles, getFileExtension, formatFilename, downloadImagesAsZip } from '@/utils/download'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'
import { useUserStore } from '@/stores/user'

// 类型定义
interface Draft {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  element?: string
  modificationRequirement?: string
  images: string[]
  reference_images: string[]
  referenceImages?: string[]
  final_draft_images: string[]
  finalDraftImages?: string[]
  createTime: string
  updateTime: string
  status: 'finalized' | 'optimizing' | 'concept'
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
const elementWordDialogVisible = ref(false)
const currentDraft = ref<Draft | null>(null)
const selectedItems = ref<number[]>([])
const selectedBatch = ref<string>('')
const selectedDate = ref<string>('')

// 文件命名对话框相关
const fileNameDialogVisible = ref(false)
const isBatchDownload = ref(false)
const fileNameForm = reactive({
  name: '',
  type: 'zip',
  includeDate: true
})
const currentDownloadDraft = ref<Draft | null>(null)
const currentDownloadDrafts = ref<Draft[]>([])

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

// 搜索类型选项 - 只保留元素搜索
const searchTypeOptions = [
  { label: '元素', value: 'element' }
]

const queryParams = reactive<QueryParams>({
  searchType: 'element',
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

const draftList = ref<Draft[]>([])

// 判断是否已全选所有draft卡片
const isAllSelected = computed(() => {
  return draftList.value.length > 0 && selectedItems.value.length === draftList.value.length
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
const loadDrafts = async (): Promise<void> => {
  loading.value = true
  try {
    // 构建API请求参数
    const apiParams = {
      search_type: queryParams.searchType,
      search_content: queryParams.searchContent,
      developer: filterParams.developer,
      status: filterParams.status,
      carrier: filterParams.carrier,
      batch: filterParams.batch,
      page: pagination.page,
      size: pagination.size
    }
    
    // 添加调试日志，打印API请求参数
    console.log('发送到API的请求参数:', apiParams)
    
    // 调用真实API
    const response = await materialLibraryApi.getList(apiParams)
    
    // 添加调试日志，打印API返回的完整数据
    console.log('API返回的数据:', response)
    console.log('list数组长度:', response.data?.list?.length)
    console.log('total字段值:', response.data?.total)
    
    if (response.code === 200) {
        // 确保draftList.value总是数组，防止渲染错误
        const listData = response.data?.list
        console.log('处理前的listData:', listData)
        let processedList: Draft[] = []
        if (Array.isArray(listData)) {
            processedList = listData.map(item => ({
              ...item,
              images: item.images || [],
              reference_images: item.reference_images || [],
              referenceImages: item.reference_images || [],
              final_draft_images: [],
              finalDraftImages: []
            }))
            console.log('处理后的draftList:', processedList)
        } else {
            processedList = []
            console.warn('API返回的list不是数组，已初始化为空数组')
        }
        
        draftList.value = processedList
        
        // 更新分页信息
        let totalCount = response.data?.total || 0
        // 确保total与实际数据数量一致
        if (totalCount === 0 && processedList.length > 0) {
            totalCount = processedList.length
            console.warn('API返回total为0，但实际数据数量为', processedList.length, '已修正')
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
      // API调用失败，确保draftList为空数组
      draftList.value = []
      ElMessage.error(response.message || '加载素材数据失败')
      console.error('API返回错误:', response)
    }
  } catch (error: any) {
    // 捕获网络错误或其他异常，确保draftList为空数组
    draftList.value = []
    console.error('加载素材数据失败:', error)
    ElMessage.error(error.message || '加载素材数据失败')
  } finally {
    // 确保loading状态总是被设置为false
    loading.value = false
  }
}

const handleSearch = (): void => {
  pagination.page = 1
  loadDrafts()
}

const handleReset = (): void => {
  Object.assign(queryParams, {
    searchType: 'sku',
    searchContent: ''
  })
  pagination.page = 1
  loadDrafts()
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
    status: [...tempFilterParams.status],
    carrier: [...tempFilterParams.carrier],
    batch: [...tempFilterParams.batch]
  })
  
  // 关闭对话框
  filterDialogVisible.value = false
  
  // 重新加载数据
  pagination.page = 1
  loadDrafts()
  
  // 显示筛选成功消息
  const filterCounts = {
    developer: filterParams.developer.length,
    status: filterParams.status.length,
    carrier: filterParams.carrier.length,
    batch: filterParams.batch.length
  }
  let message = '已应用筛选条件'
  if (filterCounts.developer > 0 || filterCounts.status > 0 || filterCounts.carrier > 0 || filterCounts.batch > 0) {
    message += `: 开发人(${filterCounts.developer})，状态(${filterCounts.status})，载体(${filterCounts.carrier})，批次(${filterCounts.batch})`
  }
  ElMessage.success(message)
}

// 全选/取消全选图片功能
const handleSelectAll = (): void => {
  if (draftList.value.length === 0) {
    ElMessage.warning('当前列表没有可选择的图片')
    return
  }
  
  if (isAllSelected.value) {
    // 取消全选
    selectedItems.value = []
    ElMessage.success('已取消全选所有图片')
  } else {
    // 全选所有draft卡片
    selectedItems.value = draftList.value.map(draft => draft.id)
    ElMessage.success(`已全选 ${selectedItems.value.length} 个素材卡片`)
  }
}

const handleAddDraft = (): void => {
  currentDraft.value = null
  dialogVisible.value = true
}

const handleEdit = (draft: Draft): void => {
  currentDraft.value = draft
  dialogVisible.value = true
}

const handleDelete = async (draft: Draft): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除素材 ${draft.sku} 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实删除API
    const response = await materialLibraryApi.delete(draft.sku)
    
    if (response.code === 200) {
      ElMessage.success(response.message || '删除成功')
      // 立即从列表中移除被删除的素材，确保UI立即更新
      const index = draftList.value.findIndex(item => item.sku === draft.sku)
      if (index > -1) {
        draftList.value.splice(index, 1)
        // 如果是最后一页且删除后列表为空，切换到上一页
        if (draftList.value.length === 0 && pagination.page > 1) {
          pagination.page--
        }
      }
      loadDrafts()
    } else {
      // 根据错误信息显示不同的提示
      if (response.code === 400 && response.message.includes('已存在于回收站')) {
        ElMessage.warning('该素材已存在于回收站，无需重复删除')
      } else if (response.code === 404) {
        ElMessage.warning('该素材不存在，可能已被删除')
      } else {
        ElMessage.error(response.message || '删除失败')
      }
    }
  } catch (error: any) {
    // 用户取消删除或API调用失败
    if (error !== 'cancel') {
      console.error('删除素材失败:', error)
      // 处理网络错误或其他异常
      if (error.response?.data?.message) {
        if (error.response.status === 400 && error.response.data.message.includes('已存在于回收站')) {
          ElMessage.warning('该素材已存在于回收站，无需重复删除')
        } else if (error.response.status === 404) {
          ElMessage.warning('该素材不存在，可能已被删除')
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

const handleBatchDownload = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要下载的素材')
    return
  }
  
  // 收集所有选中的草稿对象
  const selectedDrafts = draftList.value.filter(draft => selectedItems.value.includes(draft.id))
  
  if (selectedDrafts.length === 0) {
    ElMessage.warning('未找到选中的素材')
    return
  }
  
  // 收集所有要下载的图片
  const filesToDownload: Array<{ url: string; filename: string }> = []
  
  for (const draft of selectedDrafts) {
    // 添加设计稿
    if (draft.images && draft.images.length > 0) {
      for (let i = 0; i < draft.images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(draft.images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`素材-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }
    
    // 添加效果图
    if (draft.reference_images && draft.reference_images.length > 0) {
      for (let i = 0; i < draft.reference_images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(draft.reference_images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`效果图-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }
  }
  
  if (filesToDownload.length === 0) {
    ElMessage.warning('选中的素材没有可下载的图片')
    return
  }
  
  // 打开文件命名对话框
  isBatchDownload.value = true
  currentDownloadDrafts.value = selectedDrafts
  fileNameForm.name = `批量下载_${selectedDrafts.length}个素材`
  fileNameForm.includeDate = true
  fileNameDialogVisible.value = true
}

const handleBatchDelete = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要删除的素材')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedItems.value.length} 个素材吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实批量删除API
    const response = await materialLibraryApi.batchDelete({ ids: selectedItems.value })
    
    if (response.code === 200) {
      ElMessage.success(`成功删除 ${response.data.success} 个素材，失败 ${response.data.failed} 个`)
      const deletedIds = selectedItems.value
      selectedItems.value = []
      // 立即从列表中移除被删除的素材，确保UI立即更新
      if (deletedIds.length > 0) {
        draftList.value = draftList.value.filter(draft => !deletedIds.includes(draft.id))
        // 如果是最后一页且删除后列表为空，切换到上一页
        if (draftList.value.length === 0 && pagination.page > 1) {
          pagination.page--
        }
      }
      loadDrafts()
    } else {
      ElMessage.error(response.message || '批量删除失败')
    }
  } catch (error) {
    // 用户取消删除或API调用失败
    if (error !== 'cancel') {
      console.error('批量删除素材失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

// 跳转到回收站页面
const handleRecycleBin = (): void => {
  router.push('/final-draft-recycle-bin')
}

// 批量导入方法
const handleBatchImport = (): void => {
  batchImportDialogVisible.value = true
}

// 批量修改方法
const handleBatchEdit = (): void => {
  batchEditDialogVisible.value = true
}

// 元素词编辑方法
const handleElementWordEdit = (): void => {
  elementWordDialogVisible.value = true
}

// 元素词编辑成功回调
const handleElementWordSuccess = (): void => {
  // 元素词更新成功，无需特殊处理
  console.log('元素词更新成功')
}

// 文件命名确认方法
const confirmFileName = async (): Promise<void> => {
  if (!fileNameForm.name.trim()) {
    ElMessage.warning('请输入文件名')
    return
  }
  
  fileNameDialogVisible.value = false
  
  if (isBatchDownload.value) {
    await handleBatchDownloadWithName(currentDownloadDrafts.value, fileNameForm.name, fileNameForm.includeDate)
  } else if (currentDownloadDraft.value) {
    await handleDownloadWithName(currentDownloadDraft.value, fileNameForm.name)
  }
}

// 带文件名的单个下载方法
const handleDownloadWithName = async (draft: Draft, fileName: string): Promise<void> => {
  try {
    const totalImages = (draft.images?.length || 0) + (draft.reference_images?.length || 0)
    
    if (totalImages === 0) {
      ElMessage.warning(`素材 ${draft.sku} 没有可下载的图片`)
      return
    }
    
    // 收集所有要下载的图片
    const filesToDownload: Array<{ url: string; filename: string }> = []
    
    // 添加设计稿
    if (draft.images && draft.images.length > 0) {
      for (let i = 0; i < draft.images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(draft.images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`素材-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }
    
    // 添加效果图
    if (draft.reference_images && draft.reference_images.length > 0) {
      for (let i = 0; i < draft.reference_images.length; i++) {
        const originalUrl = ImageUrlUtil.getOriginalUrl(draft.reference_images[i])
        // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
        const ext = 'jpg'
        const filename = formatFilename(`效果图-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
        filesToDownload.push({ url: originalUrl, filename })
      }
    }
    
    // 显示开始下载的提示
    ElMessage.info(`开始下载素材 ${draft.sku} 的图片，共 ${totalImages} 张`)
    
    // 初始化进度条
    showProgress.value = true
    downloadProgress.value = 0
    downloadStatus.value = undefined
    progressText.value = '准备下载...'
    
    // 获取认证token
    const token = localStorage.getItem('token')
    
    // 使用fetch API直接调用后端
    const response = await fetch('/api/v1/final-drafts/download-zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        files: filesToDownload,
        filename: fileName
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    // 解析JSON响应
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || '下载失败')
    }
    
    // 获取任务ID
    const taskId = result.data?.task_id
    if (!taskId) {
      throw new Error('未获取到下载任务ID')
    }
    
    // 处理失败的SKU信息
    const failedCount = result.data?.failed_count || 0
    const failedFiles = result.data?.failed_files || []
    
    // 完成进度
    downloadProgress.value = 100
    downloadStatus.value = failedCount > 0 ? 'warning' : 'success'
    progressText.value = failedCount > 0 ? `任务创建完成，部分文件下载失败` : '任务创建成功！'
    
    // 清理
    setTimeout(() => {
      showProgress.value = false
    }, 1000)
    
    // 显示下载结果
    if (failedCount > 0) {
      // 提取失败的SKU列表
      const failedSkus = new Set()
      const errorDetailsMap = new Map()
      
      failedFiles.forEach(file => {
        // 从文件名中提取SKU
        const match = file.filename.match(/(?:素材|效果图)-(.*?)[.-]/)
        if (match && match[1]) {
          const sku = match[1]
          failedSkus.add(sku)
          // 保存每个SKU的失败原因
          if (file.error) {
            errorDetailsMap.set(sku, file.error)
          }
        }
      })
      
      const failedSkuList = Array.from(failedSkus).join(', ')
      
      // 构建详细的错误信息
      let errorMessage = `下载任务已创建，但部分SKU下载失败：${failedSkuList}。`
      
      // 添加失败原因
      const detailedErrors = []
      errorDetailsMap.forEach((error, sku) => {
        detailedErrors.push(`${sku}: ${error}`)
      })
      
      if (detailedErrors.length > 0) {
        errorMessage += `失败原因：${detailedErrors.join('；')}`
      }
      
      errorMessage += ' 请前往下载中心查看详情。'
      
      ElMessage.warning(errorMessage)
    } else {
      ElMessage.success(`下载任务已成功，请前往下载中心查看和下载`)
    }
  } catch (error: any) {
    console.error(`下载素材 ${draft.sku} 失败:`, error)
    const errorMessage = error.message || '未知错误'
    ElMessage.error(`下载素材 ${draft.sku} 失败: ${errorMessage}`)
    showProgress.value = false
  }
}

// 带文件名的批量下载方法
const handleBatchDownloadWithName = async (drafts: Draft[], fileName: string, includeDate: boolean): Promise<void> => {
  if (drafts.length === 0) {
    ElMessage.warning('请先选择要下载的素材')
    return
  }
  
  try {
    // 收集所有要下载的图片
    const filesToDownload: Array<{ url: string; filename: string }> = []
    
    for (const draft of drafts) {
      // 添加设计稿
      if (draft.images && draft.images.length > 0) {
        for (let i = 0; i < draft.images.length; i++) {
          const originalUrl = ImageUrlUtil.getOriginalUrl(draft.images[i])
          // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
          const ext = 'jpg'
          const filename = formatFilename(`素材-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
          filesToDownload.push({ url: originalUrl, filename })
        }
      }
      
      // 添加效果图
      if (draft.reference_images && draft.reference_images.length > 0) {
        for (let i = 0; i < draft.reference_images.length; i++) {
          const originalUrl = ImageUrlUtil.getOriginalUrl(draft.reference_images[i])
          // 使用默认扩展名jpg，因为我们知道原始图片是jpg格式
          const ext = 'jpg'
          const filename = formatFilename(`效果图-${draft.sku}${i > 0 ? `-${i + 1}` : ''}.${ext}`)
          filesToDownload.push({ url: originalUrl, filename })
        }
      }
    }
    
    if (filesToDownload.length === 0) {
      ElMessage.warning('选中的素材没有可下载的图片')
      return
    }
    
    // 显示开始下载的提示
    ElMessage.info(`开始批量下载，共 ${drafts.length} 个素材，${filesToDownload.length} 张图片`)
    
    // 初始化进度条
    showProgress.value = true
    downloadProgress.value = 0
    downloadStatus.value = undefined
    progressText.value = '准备下载...'
    
    // 构建文件名
    let finalFileName = fileName
    if (includeDate) {
      const date = new Date().toISOString().split('T')[0]
      finalFileName += `_${date}`
    }
    
    // 获取认证token
    const token = localStorage.getItem('token')
    
    // 使用fetch API直接调用后端
    const response = await fetch('/api/v1/final-drafts/download-zip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        files: filesToDownload,
        filename: finalFileName
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    // 解析JSON响应
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || '下载失败')
    }
    
    // 获取任务ID
    const taskId = result.data?.task_id
    if (!taskId) {
      throw new Error('未获取到下载任务ID')
    }
    
    // 处理失败的SKU信息
    const failedCount = result.data?.failed_count || 0
    const failedFiles = result.data?.failed_files || []
    
    // 完成进度
    downloadProgress.value = 100
    downloadStatus.value = failedCount > 0 ? 'warning' : 'success'
    progressText.value = failedCount > 0 ? `任务创建完成，部分文件下载失败` : '任务创建成功！'
    
    // 清理
    setTimeout(() => {
      showProgress.value = false
    }, 1000)
    
    // 显示下载结果
    if (failedCount > 0) {
      // 提取失败的SKU列表
      const failedSkus = new Set()
      const errorDetailsMap = new Map()
      
      failedFiles.forEach(file => {
        // 从文件名中提取SKU
        const match = file.filename.match(/(?:素材|效果图)-(.*?)[.-]/)
        if (match && match[1]) {
          const sku = match[1]
          failedSkus.add(sku)
          // 保存每个SKU的失败原因
          if (file.error) {
            errorDetailsMap.set(sku, file.error)
          }
        }
      })
      
      const failedSkuList = Array.from(failedSkus).join(', ')
      
      // 构建详细的错误信息
      let errorMessage = `下载任务已创建，但部分SKU下载失败：${failedSkuList}。`
      
      // 添加失败原因
      const detailedErrors = []
      errorDetailsMap.forEach((error, sku) => {
        detailedErrors.push(`${sku}: ${error}`)
      })
      
      if (detailedErrors.length > 0) {
        errorMessage += `失败原因：${detailedErrors.join('；')}`
      }
      
      errorMessage += ' 请前往下载中心查看详情。'
      
      ElMessage.warning(errorMessage)
    } else {
      ElMessage.success(`下载任务已成功，请前往下载中心查看和下载`)
    }
  } catch (error: any) {
    console.error('批量下载失败:', error)
    const errorMessage = error.message || '未知错误'
    ElMessage.error(`批量下载失败: ${errorMessage}`)
    showProgress.value = false
  }
}

const handleDownload = async (draft: Draft): Promise<void> => {
  try {
    const totalImages = (draft.images?.length || 0) + (draft.reference_images?.length || 0)
    
    if (totalImages === 0) {
      ElMessage.warning(`素材 ${draft.sku} 没有可下载的图片`)
      return
    }
    
    // 打开文件命名对话框
    isBatchDownload.value = false
    currentDownloadDraft.value = draft
    fileNameForm.name = `素材_${draft.sku}`
    fileNameDialogVisible.value = true
  } catch (error: any) {
    console.error(`下载素材 ${draft.sku} 失败:`, error)
    const errorMessage = error.message || '未知错误'
    ElMessage.error(`下载素材 ${draft.sku} 失败: ${errorMessage}`)
  }
}

const handleSortCommand = (command: string): void => {
  // 排序逻辑
  ElMessage.info(`按${command}排序`)
}

const handleSizeChange = (size: number): void => {
  pagination.size = size
  loadDrafts()
}

const handlePageChange = (page: number): void => {
  pagination.page = page
  loadDrafts()
}

const handleDialogSuccess = (): void => {
  dialogVisible.value = false
  loadDrafts()
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
  loadData()
})
</script>

<style scoped lang="scss">
.material-library {
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
  gap: 10px;
  margin-bottom: 0;
  min-height: 200px;
  max-height: calc(100% - 130px);
  overflow-y: auto;
  flex: 1;
  padding-bottom: 50px; /* 为固定的分页控件预留空间 */
}

/* 动态卡片大小 */
:deep(.draft-card) {
  width: 100%;
  height: v-bind('cardHeight + "px"');
}

:deep(.card-image-wrapper) {
  height: v-bind('cardHeight - 80 + "px"');
}

:deep(.card-content) {
  padding: 8px 12px;
}

:deep(.card-content.only-element) {
  padding: 6px 10px;
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

/* 文件命名对话框样式 */
.file-name-dialog {
  padding: 10px 0;
  
  .el-form-item {
    margin-bottom: 20px;
  }
  
  .el-input {
    width: 100%;
  }
  
  .el-checkbox {
    margin-top: 10px;
  }
}
</style>