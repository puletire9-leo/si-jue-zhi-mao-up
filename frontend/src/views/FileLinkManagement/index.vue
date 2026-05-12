<template>
  <div class="file-link-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ getPageTitle }}</span>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="Plus"
              @click="handleAddLink"
            >
              添加链接
            </el-button>
            <el-button
              type="primary"
              :icon="Upload"
              @click="handleUpload"
            >
              上传文件
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



      <el-form
        :inline="true"
        :model="searchForm"
        class="search-form"
      >
        <el-form-item label="链接标题">
          <el-input
            v-model="searchForm.title"
            placeholder="请输入链接标题"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>

        <el-form-item label="分类">
          <el-input
            v-model="searchForm.category"
            placeholder="请输入分类"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="Search"
            @click="handleSearch"
          >
            搜索
          </el-button>
          <el-button
            :icon="Refresh"
            @click="handleReset"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 文件链接列表 -->
      <el-table
        v-loading="loading"
        :data="fileLinks"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="title-cell">
              <el-icon class="link-icon">
                <Link />
              </el-icon>
              <span class="title-text">{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              :icon="View"
              @click="handlePreview(row)"
            >
              预览
            </el-button>
            <el-button
              size="small"
              type="success"
              link
              :icon="Download"
              @click="handleSave(row)"
            >
              保存
            </el-button>
            <el-button
              size="small"
              type="warning"
              link
              :icon="Share"
              @click="handleOpen(row)"
            >
              打开
            </el-button>
            <el-button
              size="small"
              type="danger"
              link
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 添加/编辑链接对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="链接标题" prop="title">
          <el-input v-model="formData.title" placeholder="请输入链接标题" />
        </el-form-item>
        <el-form-item label="链接地址" prop="url">
          <el-input v-model="formData.url" placeholder="请输入链接地址" />
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入链接描述"
          />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="formData.category" placeholder="请输入分类" />
        </el-form-item>
        <el-form-item label="标签" prop="tags">
          <el-select
            v-model="formData.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="请输入标签"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">
            确认
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 文件上传对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="上传文件"
      width="500px"
    >
      <el-upload
        ref="uploadRef"
        class="upload-demo"
        drag
        multiple
        :action="uploadUrl"
        :headers="uploadHeaders"
        :data="uploadData"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        :before-upload="beforeUpload"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持上传xlsx、pdf、doc等文档文件，单个文件不超过10MB
          </div>
        </template>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Plus,
  Upload,
  Delete,
  Search,
  Refresh,
  Document,
  Link,
  View,
  Download,
  Share,
  UploadFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { fileLinkApi } from '@/api/fileLink'
import type { FileLink, FileLinkCreate, FileLinkListParams } from '@/types/fileLink'

const route = useRoute()

// 设置组件名称
defineOptions({
  name: 'FileLinkManagement'
})

// 页面标题
const getPageTitle = computed(() => {
  return route.meta.title || '文件链接管理'
})

// 响应式数据
const loading = ref(false)
const fileLinks = ref<FileLink[]>([])
const selectedIds = ref<number[]>([])
const dialogVisible = ref(false)
const uploadDialogVisible = ref(false)
const isDragOver = ref(false)
const showDropZone = ref(true)

// 搜索表单
const searchForm = reactive({
  title: '',
  category: ''
})

// 分页
const pagination = reactive({
  currentPage: 1,
  size: 20,
  total: 0
})

// 表单数据
const formData = reactive({
  id: 0,
  title: '',
  url: '',
  link_type: 'standard_url',
  description: '',
  category: '',
  tags: [] as string[]
})

// 表单验证规则
const formRules: FormRules = {
  title: [{ required: true, message: '请输入链接标题', trigger: 'blur' }],
  url: [{ required: true, message: '请输入链接地址', trigger: 'blur' }]
}

// 标签选项
const tagOptions = ref<string[]>([])

// 对话框标题
const dialogTitle = computed(() => {
  return formData.id ? '编辑链接' : '添加链接'
})

// 上传配置
const uploadUrl = ref('/api/v1/file-links/upload')
const uploadHeaders = ref({})
const uploadData = reactive({
  library_type: computed(() => route.name === 'PromptLibrary' ? 'prompt-library' : 'resource-library')
})

// 表单引用
const formRef = ref<FormInstance>()
const uploadRef = ref()

// 获取文件链接列表
const fetchFileLinks = async () => {
  loading.value = true
  try {
    // 构建请求参数，过滤掉空字符串
    const params: FileLinkListParams = {
      page: pagination.currentPage,
      size: pagination.size,
      keyword: searchForm.title || undefined,
      category: searchForm.category || undefined,
      library_type: route.name === 'PromptLibrary' ? 'prompt-library' : 'resource-library'
    }

    const response = await fileLinkApi.getFileLinks(params)
    if (response.code === 200) {
      fileLinks.value = response.data.items
      pagination.total = response.data.total
    }
  } catch (error) {
    ElMessage.error('获取文件链接列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1
  fetchFileLinks()
}

// 重置搜索
const handleReset = () => {
  Object.assign(searchForm, {
    title: '',
    category: ''
  })
  pagination.currentPage = 1
  fetchFileLinks()
}

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.currentPage = 1
  fetchFileLinks()
}

// 当前页改变
const handleCurrentChange = (page: number) => {
  pagination.currentPage = page
  fetchFileLinks()
}

// 选择改变
const handleSelectionChange = (selection: FileLink[]) => {
  selectedIds.value = selection.map(item => item.id)
}

// 添加链接
const handleAddLink = () => {
  Object.assign(formData, {
    id: 0,
    title: '',
    url: '',
    linkType: 'standard_url',
    description: '',
    category: '',
    tags: []
  })
  dialogVisible.value = true
}

// 编辑链接
const handleEdit = (row: FileLink) => {
  Object.assign(formData, {
    id: row.id,
    title: row.title,
    url: row.url,
    linkType: row.linkType,
    description: row.description || '',
    category: row.category || '',
    tags: row.tags || []
  })
  dialogVisible.value = true
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    
    const fileLinkData: FileLinkCreate = {
      title: formData.title,
      url: formData.url,
      link_type: formData.link_type as any,
      description: formData.description,
      category: formData.category,
      tags: formData.tags,
      library_type: route.name === 'PromptLibrary' ? 'prompt-library' : 'resource-library'
    }

    if (formData.id) {
      // 编辑
      await fileLinkApi.updateFileLink(formData.id, fileLinkData)
      ElMessage.success('更新成功')
    } else {
      // 添加
      await fileLinkApi.createFileLink(fileLinkData)
      ElMessage.success('添加成功')
    }

    dialogVisible.value = false
    fetchFileLinks()
  } catch (error) {
    // 验证失败或API调用失败
  }
}

// 预览
const handlePreview = (row: FileLink) => {
  if (row.link_type === 'feishu_xlsx') {
    // 飞书XLSX文件预览
    window.open(row.url, '_blank')
  } else {
    // 标准链接预览
    ElMessage.info('预览功能开发中')
  }
}

// 保存
const handleSave = async (row: FileLink) => {
  try {
    // 这里可以调用下载API或直接打开链接下载
    window.open(row.url, '_blank')
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

// 打开
const handleOpen = (row: FileLink) => {
  window.open(row.url, '_blank')
}

// 删除
const handleDelete = async (row: FileLink) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除链接"${row.title}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await fileLinkApi.deleteFileLink(row.id)
    ElMessage.success('删除成功')
    fetchFileLinks()
  } catch (error) {
    // 用户取消删除
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的${selectedIds.value.length}个链接吗？`,
      '确认批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await fileLinkApi.batchDeleteFileLinks(selectedIds.value)
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchFileLinks()
  } catch (error) {
    // 用户取消删除
  }
}

// 上传文件
const handleUpload = () => {
  uploadDialogVisible.value = true
}

// 拖放上传相关
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    // 处理拖放的文件
    handleFiles(files)
  }
}

const handleFiles = async (files: FileList) => {
  try {
    const formData = new FormData()
    
    // 添加文件
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }
    
    // 添加其他必要信息
    formData.append('title', `拖放上传文件_${new Date().getTime()}`)
    formData.append('libraryType', route.name === 'PromptLibrary' ? 'prompt-library' : 'resource-library')
    formData.append('description', '通过拖放上传')
    
    // 显示上传进度
    const loading = ElLoading.service({
      lock: true,
      text: `正在上传${files.length}个文件...`,
      background: 'rgba(0, 0, 0, 0.7)'
    })
    
    // 调用上传API
    const response = await fileLinkApi.uploadFile(formData)
    
    loading.close()
    
    if (response.code === 200) {
      ElMessage.success(`成功上传${files.length}个文件`)
      fetchFileLinks()
    } else {
      ElMessage.error(response.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('文件上传失败')
    console.error('拖放上传错误:', error)
  }
}

// 上传前验证
const beforeUpload = (file: File) => {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB')
    return false
  }
  return true
}

// 上传成功
const handleUploadSuccess = (response: any) => {
  if (response.code === 200) {
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    fetchFileLinks()
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

// 上传失败
const handleUploadError = (error: any) => {
  ElMessage.error('上传失败')
}

// 状态显示
const getStatusType = (status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const statusMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    active: 'success',
    inactive: 'info',
    error: 'danger'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    active: '正常',
    inactive: '停用',
    error: '错误'
  }
  return textMap[status] || '未知'
}

// 格式化日期
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  fetchFileLinks()
})
</script>

<style scoped>
.file-link-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.drop-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 40px;
  text-align: center;
  margin-bottom: 20px;
  transition: all 0.3s;
}

.drop-zone.drag-over {
  border-color: #409EFF;
  background-color: #f5f7fa;
}

.drop-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.search-form {
  margin-bottom: 20px;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #67C23A;
}

.link-icon {
  color: #409EFF;
}

.title-text {
  flex: 1;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.upload-demo {
  width: 100%;
}
</style>