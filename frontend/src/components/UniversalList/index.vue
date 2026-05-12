<template>
  <div class="universal-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ title }}</span>
          <div class="header-actions">
            <el-button
              v-if="showAddButton"
              type="primary"
              :icon="Plus"
              @click="handleAdd"
            >
              {{ addButtonText }}
            </el-button>
            <el-button
              v-if="showImportButton"
              type="success"
              :icon="Upload"
              @click="handleImport"
            >
              导入Excel
            </el-button>
            <el-button
              v-if="showDownloadButton"
              type="info"
              :icon="Download"
              @click="handleDownloadTemplate"
            >
              下载模板
            </el-button>
            <el-button
              v-if="showRecycleBinButton"
              type="warning"
              :icon="Refresh"
              @click="handleRecycleBin"
            >
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
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <slot name="search-form"></slot>
      </el-form>

      <div v-loading="loading" class="list-grid">
        <UniversalCard
          v-for="item in items"
          :key="getItemKey(item)"
          :product="item"
          :selected="selectedIds.includes(getItemId(item))"
          :mode="cardMode"
          @click="handleCardClick"
          @select="handleSelect"
          @view="handleView"
          @delete="handleDelete"
        />
        
        <el-empty
          v-if="!loading && items.length === 0"
          :description="emptyText"
          :image-size="200"
        />
      </div>

      <div class="pagination-container">
        <div class="page-size-selector">
          <label>每页显示：</label>
          <el-select v-model="pagination.size" @change="handleSizeChange">
            <el-option label="60" :value="60" />
            <el-option label="100" :value="100" />
            <el-option label="200" :value="200" />
            <el-option label="500" :value="500" />
          </el-select>
        </div>
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[60, 100, 200, 500]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="importDialogVisible"
      title="导入Excel"
      width="500px"
    >
      <!-- 导入模式选择 -->
      <div style="margin-bottom: 20px; padding: 16px; background-color: #f5f7fa; border-radius: 4px;">
        <div style="font-weight: 500; margin-bottom: 8px; color: #606266;">导入模式：</div>
        <select v-model="importMode" style="width: 100%; padding: 8px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 14px;">
          <option value="skip">跳过已存在 - 如果ASIN已存在，则跳过该记录</option>
          <option value="update">更新已存在 - 如果ASIN已存在，则更新该记录</option>
          <option value="overwrite">覆盖已存在 - 如果ASIN已存在，则删除后重新插入</option>
        </select>
        <div style="margin-top: 8px; font-size: 12px; color: #909399;">
          当前选择：{{ importMode === 'skip' ? '跳过已存在' : importMode === 'update' ? '更新已存在' : '覆盖已存在' }}
        </div>
      </div>

      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :on-exceed="handleExceed"
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            只支持 .xlsx/.xls 格式的Excel文件
          </div>
        </template>
      </el-upload>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="handleImportSubmit">
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Plus, Delete, Upload, Download, Refresh, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import UniversalCard from '@/components/UniversalCard/index.vue'
import type { UploadInstance, UploadFile } from 'element-plus'

interface Props {
  title: string
  items: any[]
  loading: boolean
  pagination: {
    page: number
    size: number
    total: number
  }
  searchForm: Record<string, any>
  selectedIds: (string | number)[]
  cardMode: 'product' | 'selection'
  idField: string
  importColumns: string[]
  emptyText?: string
  showAddButton?: boolean
  addButtonText?: string
  showImportButton?: boolean
  showDownloadButton?: boolean
  showRecycleBinButton?: boolean
}

interface Emits {
  (e: 'add'): void
  (e: 'import'): void
  (e: 'download-template'): void
  (e: 'recycle-bin'): void
  (e: 'batch-delete'): void
  (e: 'search'): void
  (e: 'reset'): void
  (e: 'card-click', item: any): void
  (e: 'select', id: string | number, selected: boolean): void
  (e: 'view', item: any): void
  (e: 'delete', item: any): void
  (e: 'size-change', size: number): void
  (e: 'page-change', page: number): void
  (e: 'import-submit', file: File, mode: string): void
}

const props = withDefaults(defineProps<Props>(), {
  emptyText: '暂无数据',
  showAddButton: true,
  addButtonText: '添加',
  showImportButton: true,
  showDownloadButton: true,
  showRecycleBinButton: false
})

const emit = defineEmits<Emits>()

const importDialogVisible = ref<boolean>(false)
const importing = ref<boolean>(false)
const uploadRef = ref<UploadInstance>()
const importFile = ref<File | null>(null)
const importMode = ref<string>('skip') // 导入模式：skip/update/overwrite

const getItemKey = (item: any): string | number => {
  return item[props.idField]
}

const getItemId = (item: any): string | number => {
  return item[props.idField]
}

const handleAdd = (): void => {
  emit('add')
}

const handleImport = (): void => {
  // 重置导入模式和文件
  importMode.value = 'skip'
  importFile.value = null
  importDialogVisible.value = true
}

const handleDownloadTemplate = (): void => {
  emit('download-template')
}

const handleRecycleBin = (): void => {
  emit('recycle-bin')
}

const handleBatchDelete = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${props.selectedIds.length} 个项目吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('batch-delete')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

const handleCardClick = (item: any): void => {
  emit('card-click', item)
}

const handleSelect = (id: string | number, selected: boolean): void => {
  emit('select', id, selected)
}

const handleView = (item: any): void => {
  emit('view', item)
}

const handleDelete = async (item: any): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定要删除该项目吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('delete', item)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleSizeChange = (size: number): void => {
  emit('size-change', size)
}

const handlePageChange = (page: number): void => {
  emit('page-change', page)
}

const handleFileChange = (file: UploadFile): void => {
  importFile.value = file.raw as File
}

const handleExceed = (): void => {
  ElMessage.warning('只能上传一个文件')
}

const handleImportSubmit = async (): Promise<void> => {
  if (!importFile.value) {
    ElMessage.warning('请选择要导入的Excel文件')
    return
  }

  importing.value = true
  try {
    // 传递文件和导入模式
    emit('import-submit', importFile.value, importMode.value)
    importDialogVisible.value = false
    importFile.value = null
  } catch (error) {
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.universal-list {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-form {
  margin-bottom: 20px;
}

.list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
  min-height: 400px;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  
  .page-size-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    
    label {
      color: #606266;
      font-size: 14px;
    }
  }
}
</style>
