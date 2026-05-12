<template>
  <div class="final-draft">
    <el-card class="main-card">
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="header-title">定稿管理</span>
          <div class="header-actions">
            <!-- 批量导入按钮 -->
            <el-button type="primary" :icon="Upload" @click="handleBatchImport">
              批量导入
            </el-button>
            
            <!-- 新增定稿按钮 -->
            <el-button type="primary" :icon="Plus" @click="handleAddDraft">
              新增定稿
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
              type="primary"
              :icon="Download"
              :disabled="selectedItems.length === 0"
              @click="handleInfringementLabelDownload"
            >
              侵权标注
            </el-button>

            <el-button 
              v-if="canDeleteDraft"
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

      <!-- 定稿产品网格 -->
      <div v-loading="loading" class="drafts-grid">
        <!-- 定稿卡片组件 -->
        <DraftCard
          v-for="draft in draftList"
          :key="draft.id"
          :draft="draft"
          :selected="selectedItems.includes(draft.id)"
          @select="handleSelect"
          @edit="handleEdit"
          @delete="handleDelete"
          @download="handleDownload"
        />
        
        <!-- 空状态 -->
        <el-empty
          v-if="!loading && draftList.length === 0"
          description="暂无定稿数据"
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

    <!-- 新增/编辑定稿对话框 -->
    <DraftDialog
      v-model="dialogVisible"
      :draft="currentDraft"
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
    <BatchImportDialog
      v-model="batchImportDialogVisible"
      @success="handleDialogSuccess"
    />
    
    <!-- 批量修改对话框 -->
    <BatchEditDialog
      v-model="batchEditDialogVisible"
      :selected-ids="selectedItems"
      @success="handleDialogSuccess"
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
defineOptions({ name: 'FinalDraft' })
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
// import { Plus, Upload, Download, Sort, Search, Refresh, Collection, Check, ArrowDown, Delete, List, Filter, Edit } from '@element-plus/icons-vue'

// 导入组件
import DraftCard from './components/DraftCard.vue'
import DraftDialog from './components/DraftDialog.vue'
import BatchImportDialog from './components/BatchImportDialog.vue'
import BatchEditDialog from './components/BatchEditDialog.vue'

// 导入API
import { finalDraftApi } from '@/api/finalDraft'

// 导入工具函数
import { downloadFile, batchDownloadFiles, getFileExtension, downloadImagesAsZip } from '@/utils/download'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'

// 导入Store
import { useUserStore } from '@/stores/user'

// 下载逻辑（~400行提取到 composables/useDraftDownload.ts）
import {
  showProgress,
  downloadProgress,
  downloadStatus,
  progressText,
  fileNameDialogVisible,
  isBatchDownload,
  currentDownloadDraft,
  currentDownloadDrafts,
  collectFilesFromDraft,
  requestZipDownload,
} from './composables/useDraftDownload'

// 列表、筛选、搜索逻辑
import { useDraftList } from './composables/useDraftList'

const {
  loading,
  draftList,
  pagination,
  loadDrafts,
  handleSizeChange,
  handlePageChange,
  // filter
  filterDialogVisible,
  filterParams,
  tempFilterParams,
  developerOptions,
  carrierOptions,
  batchOptions,
  fetchAllBatches,
  openFilterDialog,
  handleFilterDialogClose,
  resetFilter,
  confirmFilter,
  loadSystemConfigs,
  // search
  searchTypeOptions,
  queryParams,
  searchDialogVisible,
  advancedSearchContent,
  handleSearch,
  handleReset,
  openSearchDialog,
  closeSearchDialog,
  clearSearchContent,
  clearAdvancedSearchContent,
  preprocessSearchContent,
  handleAdvancedSearch,
} = useDraftList()

// 使用字符串代替图标，减少内存占用
const Plus = 'Plus'
const Upload = 'Upload'
const Download = 'Download'
const Sort = 'Sort'
const Search = 'Search'
const Refresh = 'Refresh'
const Collection = 'Collection'
const Check = 'Check'
const ArrowDown = 'ArrowDown'
const Delete = 'Delete'
const List = 'List'
const Filter = 'Filter'
const Edit = 'Edit'

// 类型定义
interface Draft {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  element?: string
  modificationRequirement?: string
  infringementLabel?: string
  images: string[]
  reference_images: string[]
  referenceImages?: string[]
  createTime: string
  updateTime: string
  status: 'finalized' | 'optimizing' | 'concept'
}

// 用户状态管理
const userStore = useUserStore()
// 定稿状态管理
// 计算属性：检查用户是否有删除权限（只有仓库角色不能删除）
const canDeleteDraft = computed(() => {
  const role = userStore.userInfo?.role
  return role !== '仓库'
})

// 响应式数据
const dialogVisible = ref(false)
const batchDialogVisible = ref(false)
const batchImportDialogVisible = ref(false)
const batchEditDialogVisible = ref(false)
const currentDraft = ref<Draft | null>(null)
const selectedItems = ref<number[]>([])
const selectedBatch = ref<string>('')
const selectedDate = ref<string>('')

// 文件命名表单（本地状态）
const fileNameForm = reactive({
  name: '',
  type: 'zip',
  includeDate: true
})


// 路由实例
const router = useRouter()

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
    ElMessage.success(`已全选 ${selectedItems.value.length} 个定稿卡片`)
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
      `确定要删除定稿 ${draft.sku} 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实删除API
    const response = await finalDraftApi.delete(draft.sku)
    
    if (response.code === 200) {
      ElMessage.success(response.message || '删除成功')
      // 立即从列表中移除被删除的定稿，确保UI立即更新
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
        ElMessage.warning('该定稿已存在于回收站，无需重复删除')
      } else if (response.code === 404) {
        ElMessage.warning('该定稿不存在，可能已被删除')
      } else {
        ElMessage.error(response.message || '删除失败')
      }
    }
  } catch (error: any) {
    // 用户取消删除或API调用失败
    if (error !== 'cancel') {
      console.error('删除定稿失败:', error)
      // 处理网络错误或其他异常
      if (error.response?.data?.message) {
        if (error.response.status === 400 && error.response.data.message.includes('已存在于回收站')) {
          ElMessage.warning('该定稿已存在于回收站，无需重复删除')
        } else if (error.response.status === 404) {
          ElMessage.warning('该定稿不存在，可能已被删除')
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
    ElMessage.warning('请先选择要下载的定稿')
    return
  }
  
  // 收集所有选中的草稿对象
  const selectedDrafts = draftList.value.filter(draft => selectedItems.value.includes(draft.id))
  
  if (selectedDrafts.length === 0) {
    ElMessage.warning('未找到选中的定稿')
    return
  }
  
  // 过滤出只有已定稿状态的产品
  const finalizedDrafts = selectedDrafts.filter(draft => draft.status === 'finalized')
  
  if (finalizedDrafts.length === 0) {
    ElMessage.warning('选中的产品中没有已定稿状态的产品，只有已定稿状态的产品才可以下载')
    return
  }
  
  if (finalizedDrafts.length < selectedDrafts.length) {
    ElMessage.warning(`只下载已定稿状态的产品，共 ${finalizedDrafts.length} 个，跳过 ${selectedDrafts.length - finalizedDrafts.length} 个非已定稿状态的产品`)
  }
  
  // 收集所有要下载的图片（批量下载不包含侵权标注）
  const filesToDownload = finalizedDrafts.flatMap(d => collectFilesFromDraft(d, false))

  if (filesToDownload.length === 0) {
    ElMessage.warning('选中的设计稿没有可下载的图片')
    return
  }

  // 打开文件命名对话框
  isBatchDownload.value = true
  currentDownloadDrafts.value = finalizedDrafts
  fileNameForm.name = `批量下载_${finalizedDrafts.length}个设计稿`
  fileNameForm.includeDate = true
  fileNameDialogVisible.value = true
}

const handleBatchDelete = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要删除的定稿')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedItems.value.length} 个定稿吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用真实批量删除API
    const response = await finalDraftApi.batchDelete({ ids: selectedItems.value })
    
    if (response.code === 200) {
      ElMessage.success(`成功删除 ${response.data.success} 个定稿，失败 ${response.data.failed} 个`)
      const deletedIds = selectedItems.value
      selectedItems.value = []
      // 立即从列表中移除被删除的定稿，确保UI立即更新
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
      console.error('批量删除定稿失败:', error)
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

/**
 * 处理侵权标注下载
 * 下载选中的已定稿产品，文件名格式为: 设计稿-sku侵权标注内容.扩展名
 * 例如: 设计稿-21561613513懂法守法鼎折覆餗防水放.png
 */
const handleInfringementLabelDownload = async (): Promise<void> => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要下载的定稿')
    return
  }

  // 收集所有选中的草稿对象
  const selectedDrafts = draftList.value.filter(draft => selectedItems.value.includes(draft.id))

  if (selectedDrafts.length === 0) {
    ElMessage.warning('未找到选中的定稿')
    return
  }

  // 过滤出只有已定稿状态的产品
  const finalizedDrafts = selectedDrafts.filter(draft => draft.status === 'finalized')

  // 调试日志：打印选中的定稿数据
  console.log('选中的定稿数据:', selectedDrafts)
  console.log('已定稿的定稿数据:', finalizedDrafts)
  finalizedDrafts.forEach((draft, index) => {
    console.log(`定稿 ${index + 1}: SKU=${draft.sku}, infringementLabel=${draft.infringementLabel}`)
  })

  if (finalizedDrafts.length === 0) {
    ElMessage.warning('选中的产品中没有已定稿状态的产品，只有已定稿状态的产品才可以下载')
    return
  }

  if (finalizedDrafts.length < selectedDrafts.length) {
    ElMessage.warning(`只下载已定稿状态的产品，共 ${finalizedDrafts.length} 个，跳过 ${selectedDrafts.length - finalizedDrafts.length} 个非已定稿状态的产品`)
  }

  // 收集所有要下载的图片（侵权标注下载 = 包含侵权标注）
  const filesToDownload = finalizedDrafts.flatMap(d => collectFilesFromDraft(d, true))

  if (filesToDownload.length === 0) {
    ElMessage.warning('选中的设计稿没有可下载的图片')
    return
  }

  // 打开文件命名对话框
  isBatchDownload.value = true
  currentDownloadDrafts.value = finalizedDrafts
  fileNameForm.name = `侵权标注下载_${finalizedDrafts.length}个设计稿`
  fileNameForm.includeDate = true
  fileNameDialogVisible.value = true
}

const handleDownload = async (draft: Draft): Promise<void> => {
  try {
    // 检查状态，只有已定稿的产品才可以下载
    if (draft.status !== 'finalized') {
      ElMessage.warning(`只有已定稿状态的产品才可以下载，当前状态: ${draft.status}`)
      return
    }
    
    const totalImages = (draft.images?.length || 0) + (draft.reference_images?.length || 0)
    
    if (totalImages === 0) {
      ElMessage.warning(`设计稿 ${draft.sku} 没有可下载的图片`)
      return
    }
    
    // 打开文件命名对话框
    isBatchDownload.value = false
    currentDownloadDraft.value = draft
    fileNameForm.name = `设计稿_${draft.sku}`
    fileNameDialogVisible.value = true
  } catch (error: any) {
    console.error(`下载设计稿 ${draft.sku} 失败:`, error)
    const errorMessage = error.message || '未知错误'
    ElMessage.error(`下载设计稿 ${draft.sku} 失败: ${errorMessage}`)
  }
}

const handleSortCommand = (command: string): void => {
  // 排序逻辑
  ElMessage.info(`按${command}排序`)
}

const handleDialogSuccess = (): void => {
  dialogVisible.value = false
  loadDrafts()
}

// 文件命名确认方法
const confirmFileName = async (): Promise<void> => {
  if (!fileNameForm.name.trim()) {
    ElMessage.warning('请输入文件名')
    return
  }
  fileNameDialogVisible.value = false

  const draftsToDownload = isBatchDownload.value
    ? currentDownloadDrafts.value
    : (currentDownloadDraft.value ? [currentDownloadDraft.value] : [])

  if (draftsToDownload.length === 0) {
    ElMessage.warning('没有可下载的定稿')
    return
  }

  const finalizedDrafts = draftsToDownload.filter(d => d.status === 'finalized')
  if (finalizedDrafts.length === 0) {
    ElMessage.warning('只有已定稿状态的产品才可以下载')
    return
  }

  const allFiles = finalizedDrafts.flatMap(d => collectFilesFromDraft(d, !isBatchDownload.value))
  if (allFiles.length === 0) {
    ElMessage.warning('没有可下载的图片')
    return
  }

  try {
    const zipName = fileNameForm.includeDate
      ? `${fileNameForm.name}_${new Date().toISOString().split('T')[0]}`
      : fileNameForm.name
    await requestZipDownload(allFiles, zipName)
  } catch (error: any) {
    ElMessage.error(`下载失败: ${error.message || '未知错误'}`)
    showProgress.value = false
  }
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

</script>

<style scoped lang="scss">
.final-draft {
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 0;
  min-height: 200px;
  max-height: calc(100% - 130px);
  overflow-y: auto;
  flex: 1;
  padding-bottom: 50px; /* 为固定的分页控件预留空间 */
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
    margin-bottom: 16px;
  }
  
  .el-input {
    width: 100%;
  }
  
  .el-checkbox {
    margin-top: 8px;
  }
}
</style>