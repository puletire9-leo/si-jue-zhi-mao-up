<!-- 系统下载管理中心 - 统一管理所有下载任务 -->
<template>
  <div class="download-manager">
    <div class="page-header">
      <div class="header-left">
        <h2>下载管理中心</h2>
        <el-tag type="info" effect="plain">统一管理所有下载任务</el-tag>
      </div>
      <div class="header-right">
        <el-button :icon="Refresh" @click="refreshList" :loading="loading">
          刷新
        </el-button>
        <el-button type="danger" :icon="Delete" @click="clearAllCompleted" :disabled="completedCount === 0">
          清空已完成
        </el-button>
      </div>
    </div>

    <!-- 统计概览卡片 -->
    <div class="stats-overview">
      <el-row :gutter="16">
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card total" @click="filterByStatus('all')">
            <div class="stat-icon">
              <el-icon :size="28"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">全部任务</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card processing" @click="filterByStatus('processing')">
            <div class="stat-icon">
              <el-icon :size="28" class="is-loading"><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.processing }}</div>
              <div class="stat-label">进行中</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card completed" @click="filterByStatus('completed')">
            <div class="stat-icon">
              <el-icon :size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card failed" @click="filterByStatus('failed')">
            <div class="stat-icon">
              <el-icon :size="28"><CircleClose /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.failed }}</div>
              <div class="stat-label">失败</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card pending" @click="filterByStatus('pending')">
            <div class="stat-icon">
              <el-icon :size="28"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">等待中</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="4">
          <div class="stat-card storage">
            <div class="stat-icon">
              <el-icon :size="28"><FolderOpened /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatStorage(stats.totalSize) }}</div>
              <div class="stat-label">总大小</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 筛选和搜索工具栏 -->
    <div class="toolbar">
      <div class="filter-section">
        <el-radio-group v-model="currentFilter.status" size="default" @change="handleFilterChange">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="processing">进行中</el-radio-button>
          <el-radio-button label="completed">已完成</el-radio-button>
          <el-radio-button label="failed">失败</el-radio-button>
          <el-radio-button label="pending">等待中</el-radio-button>
        </el-radio-group>

        <el-select 
          v-model="currentFilter.source" 
          placeholder="来源筛选" 
          clearable
          style="width: 140px; margin-left: 12px;"
          @change="handleFilterChange"
        >
          <el-option 
            v-for="item in sourceOptions" 
            :key="item.value" 
            :label="item.label" 
            :value="item.value" 
          />
        </el-select>

        <el-select 
          v-model="currentFilter.dateRange" 
          placeholder="时间范围" 
          clearable
          style="width: 140px; margin-left: 12px;"
          @change="handleFilterChange"
        >
          <el-option label="今天" value="today" />
          <el-option label="最近7天" value="week" />
          <el-option label="最近30天" value="month" />
          <el-option label="全部" value="all" />
        </el-select>
      </div>

      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务名称或文件名"
          prefix-icon="Search"
          clearable
          style="width: 280px"
          @input="handleSearch"
        />
      </div>
    </div>

    <!-- 下载任务列表 -->
    <el-card class="task-list-card" v-loading="loading">
      <el-table
        :data="filteredTasks"
        style="width: 100%"
        :default-sort="{ prop: 'created_at', order: 'descending' }"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column label="任务信息" min-width="280">
          <template #default="{ row }">
            <div class="task-info-cell">
              <div class="task-icon" :class="row.source">
                <el-icon :size="20">
                  <component :is="getSourceIcon(row.source)" />
                </el-icon>
              </div>
              <div class="task-detail">
                <div class="task-name" :title="row.name">{{ row.name }}</div>
                <div class="task-meta">
                  <el-tag size="small" effect="plain" :type="getSourceType(row.source)">
                    {{ getSourceLabel(row.source) }}
                  </el-tag>
                  <span class="file-count">{{ row.total_files }} 个文件</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="120" sortable prop="status">
          <template #default="{ row }">
            <div class="status-cell">
              <el-icon v-if="row.status === 'processing'" class="is-loading"><Loading /></el-icon>
              <el-icon v-else-if="row.status === 'completed'" class="success-icon"><CircleCheck /></el-icon>
              <el-icon v-else-if="row.status === 'failed'" class="error-icon"><CircleClose /></el-icon>
              <el-icon v-else class="info-icon"><Clock /></el-icon>
              <el-tag :type="getStatusType(row.status)" effect="light" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="进度" width="180">
          <template #default="{ row }">
            <div v-if="row.status === 'processing'" class="progress-cell">
              <el-progress 
                :percentage="row.progress" 
                :stroke-width="8"
                :show-text="false"
              />
              <span class="progress-text">{{ row.progress }}%</span>
            </div>
            <div v-else-if="row.status === 'completed'" class="success-info">
              <el-icon><CircleCheck /></el-icon>
              <span>{{ formatFileSize(row.total_size) }}</span>
            </div>
            <div v-else-if="row.status === 'failed'" class="error-info">
              <el-icon><Warning /></el-icon>
              <span>{{ row.failed_files }} 个失败</span>
            </div>
            <div v-else class="wait-info">
              <el-icon><Clock /></el-icon>
              <span>等待中</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="160" sortable prop="created_at">
          <template #default="{ row }">
            <div class="time-cell">
              <div class="time-main">{{ formatDate(row.created_at) }}</div>
              <div class="time-sub">{{ formatTime(row.created_at) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button
                v-if="row.status === 'completed'"
                type="primary"
                size="small"
                :icon="Download"
                @click="downloadFile(row)"
              >
                下载
              </el-button>
              <el-button
                v-else-if="row.status === 'failed'"
                type="warning"
                size="small"
                :icon="RefreshRight"
                @click="retryTask(row)"
              >
                重试
              </el-button>
              <el-button
                v-else-if="row.status === 'processing'"
                type="info"
                size="small"
                disabled
              >
                <el-icon class="is-loading"><Loading /></el-icon>
                进行中
              </el-button>
              <el-button
                v-else
                type="info"
                size="small"
                disabled
              >
                等待中
              </el-button>

              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, row)">
                <el-button link size="small">
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="detail" :icon="View">查看详情</el-dropdown-item>
                    <el-dropdown-item v-if="row.status === 'completed'" command="preview" :icon="View">预览文件</el-dropdown-item>
                    <el-dropdown-item divided command="delete" :icon="Delete" class="danger-item">删除任务</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 批量操作栏 -->
      <div class="batch-actions" v-if="selectedTasks.length > 0">
        <span class="selected-count">已选择 {{ selectedTasks.length }} 项</span>
        <el-button type="primary" size="small" @click="batchDownload" :disabled="!hasCompletedSelected">
          <el-icon><Download /></el-icon>
          批量下载
        </el-button>
        <el-button type="danger" size="small" @click="batchDelete">
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 文件预览弹窗 -->
    <el-dialog
      v-model="previewDialogVisible"
      title="文件预览"
      width="900px"
      destroy-on-close
      class="preview-dialog"
    >
      <div v-if="previewFileList.length > 0" class="preview-container">
        <!-- 当前图片预览 -->
        <div class="preview-image-wrapper">
          <img
            :src="previewFileList[currentPreviewIndex]?.url"
            :alt="previewFileList[currentPreviewIndex]?.name"
            class="preview-image"
            @error="$event.target.src = '/placeholder-image.png'"
          />
        </div>

        <!-- 文件名显示 -->
        <div class="preview-filename">
          <span class="filename-text">{{ previewFileList[currentPreviewIndex]?.name }}</span>
          <span class="file-counter">{{ currentPreviewIndex + 1 }} / {{ previewFileList.length }}</span>
        </div>

        <!-- 导航按钮 -->
        <div class="preview-navigation">
          <el-button
            type="primary"
            :disabled="currentPreviewIndex === 0"
            @click="currentPreviewIndex--"
          >
            <el-icon><ArrowLeft /></el-icon>
            上一张
          </el-button>
          <el-button
            type="primary"
            :disabled="currentPreviewIndex === previewFileList.length - 1"
            @click="currentPreviewIndex++"
          >
            下一张
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <!-- 缩略图列表 -->
        <div v-if="previewFileList.length > 1" class="preview-thumbnails">
          <div
            v-for="(file, index) in previewFileList"
            :key="index"
            class="thumbnail-item"
            :class="{ active: index === currentPreviewIndex }"
            @click="currentPreviewIndex = index"
          >
            <img :src="file.url" :alt="file.name" @error="$event.target.src = '/placeholder-image.png'" />
            <span class="thumbnail-name">{{ file.name }}</span>
          </div>
        </div>
      </div>
      <div v-else class="preview-empty">
        <el-empty description="没有可预览的文件" />
      </div>
    </el-dialog>

    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="下载任务详情"
      width="700px"
      destroy-on-close
    >
      <div v-if="currentTask" class="task-detail-dialog">
        <div class="detail-header">
          <div class="detail-icon" :class="currentTask.source">
            <el-icon :size="32">
              <component :is="getSourceIcon(currentTask.source)" />
            </el-icon>
          </div>
          <div class="detail-info">
            <h3>{{ currentTask.name }}</h3>
            <el-tag :type="getStatusType(currentTask.status)" effect="light">
              {{ getStatusText(currentTask.status) }}
            </el-tag>
          </div>
        </div>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务ID">{{ currentTask.id }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ getSourceLabel(currentTask.source) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentTask.created_at }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ currentTask.completed_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总文件数">{{ currentTask.total_files }} 个</el-descriptions-item>
          <el-descriptions-item label="成功/失败">{{ currentTask.completed_files }} / {{ currentTask.failed_files }}</el-descriptions-item>
          <el-descriptions-item label="总大小" :span="2">{{ formatFileSize(currentTask.total_size) }}</el-descriptions-item>
          <el-descriptions-item v-if="currentTask.error_message" label="错误信息" :span="2">
            <span class="error-text">{{ currentTask.error_message }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="file-list-section" v-if="currentTask.files && currentTask.files.length > 0">
          <h4>文件列表</h4>
          <el-table :data="currentTask.files" size="small" max-height="300">
            <el-table-column prop="name" label="文件名" min-width="200" />
            <el-table-column prop="size" label="大小" width="100">
              <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  Refresh, Download, RefreshRight, Delete, CircleCheck, CircleClose,
  Clock, Loading, Document, FolderOpened, Check, Warning, More, View,
  Picture, Box, List, Star, Folder, ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getDownloadTasks,
  getDownloadTaskDetail,
  downloadTaskFile,
  deleteDownloadTask,
  retryDownloadTask,
  type DownloadTask as ApiDownloadTask
} from '@/api/downloadTask'

// 下载任务接口
interface DownloadFile {
  name: string
  size: number
  status: 'success' | 'failed'
  error?: string
}

interface DownloadTask {
  id: string
  name: string
  source: 'final-draft' | 'product' | 'selection' | 'material' | 'carrier' | 'system'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  total_files: number
  completed_files: number
  failed_files: number
  total_size: number
  created_at: string
  completed_at?: string
  download_url?: string
  error_message?: string
  files?: DownloadFile[]
}

// 加载状态
const loading = ref(false)

// 搜索关键词
const searchKeyword = ref('')

// 当前筛选条件
const currentFilter = reactive({
  status: 'all',
  source: '',
  dateRange: 'all'
})

// 来源选项
const sourceOptions = [
  { value: 'final-draft', label: '定稿管理' },
  { value: 'product', label: '产品管理' },
  { value: 'selection', label: '选品管理' },
  { value: 'material', label: '素材库' },
  { value: 'carrier', label: '载体库' },
  { value: 'system', label: '系统导出' }
]

// 下载任务数据
const downloadTasks = ref<DownloadTask[]>([])

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 5
})

// 选中的任务
const selectedTasks = ref<DownloadTask[]>([])

// 详情弹窗
const detailDialogVisible = ref(false)
const currentTask = ref<DownloadTask | null>(null)

// 预览弹窗
const previewDialogVisible = ref(false)
const previewFileList = ref<Array<{ name: string; url: string; type: string }>>([])
const currentPreviewIndex = ref(0)

// 统计数据
const stats = computed(() => {
  const tasks = downloadTasks.value
  return {
    total: tasks.length,
    processing: tasks.filter(t => t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    totalSize: tasks.reduce((sum, t) => sum + (t.total_size || 0), 0)
  }
})

// 已完成任务数量
const completedCount = computed(() => stats.value.completed)

// 是否有已完成的选中项
const hasCompletedSelected = computed(() => 
  selectedTasks.value.some(t => t.status === 'completed')
)

// 过滤后的任务列表
const filteredTasks = computed(() => {
  let result = downloadTasks.value

  // 按状态筛选
  if (currentFilter.status !== 'all') {
    result = result.filter(t => t.status === currentFilter.status)
  }

  // 按来源筛选
  if (currentFilter.source) {
    result = result.filter(t => t.source === currentFilter.source)
  }

  // 按时间范围筛选
  if (currentFilter.dateRange && currentFilter.dateRange !== 'all') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    result = result.filter(t => {
      const taskDate = new Date(t.created_at)
      switch (currentFilter.dateRange) {
        case 'today':
          return taskDate >= today
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          return taskDate >= weekAgo
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          return taskDate >= monthAgo
        default:
          return true
      }
    })
  }

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(t => 
      t.name.toLowerCase().includes(keyword) ||
      t.id.toLowerCase().includes(keyword)
    )
  }

  return result
})

// 获取来源图标
const getSourceIcon = (source: string) => {
  const icons: Record<string, any> = {
    'final-draft': Check,
    'product': Box,
    'selection': List,
    'material': Picture,
    'carrier': Folder,
    'system': Document
  }
  return icons[source] || Document
}

// 获取来源标签
const getSourceLabel = (source: string) => {
  const labels: Record<string, string> = {
    'final-draft': '定稿管理',
    'product': '产品管理',
    'selection': '选品管理',
    'material': '素材库',
    'carrier': '载体库',
    'system': '系统导出'
  }
  return labels[source] || source
}

// 获取来源类型（用于标签颜色）
const getSourceType = (source: string) => {
  const types: Record<string, string> = {
    'final-draft': 'success',
    'product': 'primary',
    'selection': 'warning',
    'material': 'info',
    'carrier': 'danger',
    'system': ''
  }
  return types[source] || ''
}

// 获取状态类型
const getStatusType = (status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '等待中',
    processing: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

// 格式化文件大小
const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// 格式化存储大小（简化版）
const formatStorage = (bytes: number) => {
  if (bytes === 0) return '0 MB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

// 格式化日期
const formatDate = (time: string) => {
  return new Date(time).toLocaleDateString('zh-CN')
}

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 筛选状态
const filterByStatus = (status: string) => {
  currentFilter.status = status
}

// 处理筛选变化
const handleFilterChange = () => {
  pagination.page = 1
}

// 处理搜索
const handleSearch = () => {
  pagination.page = 1
}

// 刷新列表
// 防止并发请求的标志
let isRefreshing = false

const refreshList = async (showMessage = true) => {
  // 防止并发请求
  if (isRefreshing) {
    console.log('刷新正在进行中，跳过本次请求')
    return
  }
  
  isRefreshing = true
  loading.value = true
  
  try {
    const params: any = {
      page: pagination.page,
      page_size: pagination.pageSize
    }
    
    if (currentFilter.status !== 'all') {
      params.status = currentFilter.status
    }
    
    if (currentFilter.source) {
      params.source = currentFilter.source
    }
    
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    
    const response = await getDownloadTasks(params)
    
    // 处理后端返回的数据结构，可能是 { total, items } 或 { code, data: { total, items } }
    const result = response.data || response
    
    if (!result || !result.items) {
      console.warn('后端返回数据格式不正确:', response)
      downloadTasks.value = []
      pagination.total = 0
      return
    }
    
    downloadTasks.value = result.items.map((item: DownloadTask) => ({
      ...item,
      download_url: `/api/v1/download-tasks/${item.id}/download`
    }))
    pagination.total = result.total || 0
    
    // 只在手动刷新时显示成功消息
    if (showMessage) {
      ElMessage.success('刷新成功')
    }
  } catch (error: any) {
    console.error('获取下载任务列表失败:', error)
    ElMessage.error(`获取下载任务列表失败: ${error.message || '未知错误'}`)
  } finally {
    loading.value = false
    isRefreshing = false
  }
}

// 清空已完成
const clearAllCompleted = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有已完成的下载任务吗？',
      '确认清空',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    
    const completedTasks = downloadTasks.value.filter(t => t.status === 'completed')
    const ids = completedTasks.map(t => t.id)
    
    // 并行删除所有已完成的任务
    await Promise.all(ids.map(id => deleteDownloadTask(id)))
    
    // 从列表中移除
    downloadTasks.value = downloadTasks.value.filter(t => t.status !== 'completed')
    pagination.total = Math.max(0, pagination.total - ids.length)
    
    ElMessage.success(`已清空 ${ids.length} 个已完成任务`)
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('清空已完成任务失败:', error)
      ElMessage.error(`清空失败: ${error.message || '未知错误'}`)
    }
  }
}

// 选择变化
const handleSelectionChange = (selection: DownloadTask[]) => {
  selectedTasks.value = selection
}

// 清空选择
const clearSelection = () => {
  selectedTasks.value = []
}

// 下载文件
const downloadFile = async (task: DownloadTask) => {
  try {
    await downloadTaskFile(task.id, `${task.name}.zip`)
    ElMessage.success('开始下载')
  } catch (error: any) {
    console.error('下载文件失败:', error)
    ElMessage.error(`下载文件失败: ${error.message || '未知错误'}`)
  }
}

// 重试任务
const retryTask = async (task: DownloadTask) => {
  try {
    await ElMessageBox.confirm(
      `确定要重新下载 "${task.name}" 吗？`,
      '确认重试',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    
    await retryDownloadTask(task.id)
    ElMessage.success('已开始重新下载')
    
    // 刷新列表
    await refreshList()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('重试任务失败:', error)
      ElMessage.error(`重试任务失败: ${error.message || '未知错误'}`)
    }
  }
}

// 查看详情
const viewDetails = async (task: DownloadTask) => {
  try {
    const detail = await getDownloadTaskDetail(task.id)
    currentTask.value = {
      ...detail,
      files: detail.files?.map(f => ({
        name: f.file_name,
        size: f.file_size,
        status: f.status === 'success' ? 'success' : 'failed'
      }))
    }
    detailDialogVisible.value = true
  } catch (error: any) {
    console.error('获取任务详情失败:', error)
    ElMessage.error(`获取任务详情失败: ${error.message || '未知错误'}`)
  }
}

/**
 * 预览文件
 * 显示下载任务中的图片文件预览
 * 下载ZIP文件并解压其中的图片进行预览
 */
const previewFiles = async (task: DownloadTask) => {
  try {
    // 显示加载提示
    const loadingInstance = ElMessage.info('正在加载预览文件...')

    // 下载ZIP文件
    const response = await fetch(`/api/v1/download-tasks/${task.id}/download`)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }

    const zipBlob = await response.blob()
    console.log('ZIP文件大小:', (zipBlob.size / 1024).toFixed(2), 'KB')

    // 使用JSZip解压
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBlob)

    // 提取图片文件
    const imageFiles: Array<{ name: string; url: string }> = []

    // 遍历ZIP中的文件
    const filePromises: Promise<void>[] = []
    zip.forEach((relativePath: string, file: any) => {
      // 检查是否是图片文件
      const ext = relativePath.toLowerCase().split('.').pop()
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
        const promise = file.async('blob').then((blob: Blob) => {
          const url = URL.createObjectURL(blob)
          imageFiles.push({
            name: relativePath,
            url: url
          })
        })
        filePromises.push(promise)
      }
    })

    // 等待所有文件解压完成
    await Promise.all(filePromises)

    // 关闭加载提示
    loadingInstance.close()

    if (imageFiles.length === 0) {
      ElMessage.warning('该ZIP文件中没有图片文件可供预览')
      return
    }

    // 按文件名排序
    imageFiles.sort((a, b) => a.name.localeCompare(b.name))

    console.log('解压完成，共', imageFiles.length, '个图片文件')

    // 构建预览文件列表
    previewFileList.value = imageFiles

    currentPreviewIndex.value = 0
    previewDialogVisible.value = true
  } catch (error: any) {
    console.error('获取文件预览失败:', error)
    ElMessage.error(`获取文件预览失败: ${error.message || '未知错误'}`)
  }
}

// 处理下拉菜单命令
const handleCommand = (command: string, task: DownloadTask) => {
  switch (command) {
    case 'detail':
      viewDetails(task)
      break
    case 'preview':
      previewFiles(task)
      break
    case 'delete':
      deleteTask(task)
      break
  }
}

// 删除任务
const deleteTask = async (task: DownloadTask) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务 "${task.name}" 吗？删除后无法恢复。`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'danger' }
    )
    
    await deleteDownloadTask(task.id)
    
    // 从列表中移除
    downloadTasks.value = downloadTasks.value.filter(t => t.id !== task.id)
    pagination.total = Math.max(0, pagination.total - 1)
    
    ElMessage.success('删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除任务失败:', error)
      ElMessage.error(`删除任务失败: ${error.message || '未知错误'}`)
    }
  }
}

// 批量下载
const batchDownload = async () => {
  const completedTasks = selectedTasks.value.filter(t => t.status === 'completed')
  
  for (const task of completedTasks) {
    try {
      await downloadTaskFile(task.id, `${task.name}.zip`)
      // 添加短暂延迟，避免浏览器同时下载过多文件
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`下载任务 ${task.id} 失败:`, error)
    }
  }
  
  ElMessage.success(`已开始下载 ${completedTasks.length} 个文件`)
}

// 批量删除
const batchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedTasks.value.length} 个任务吗？`,
      '确认批量删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'danger' }
    )
    
    const ids = selectedTasks.value.map(t => t.id)
    
    // 并行删除多个任务
    await Promise.all(ids.map(id => deleteDownloadTask(id)))
    
    // 从列表中移除
    downloadTasks.value = downloadTasks.value.filter(t => !ids.includes(t.id))
    pagination.total = Math.max(0, pagination.total - ids.length)
    selectedTasks.value = []
    
    ElMessage.success('批量删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error(`批量删除失败: ${error.message || '未知错误'}`)
    }
  }
}

// 分页变化
const handleSizeChange = (val: number) => {
  pagination.pageSize = val
}

const handleCurrentChange = (val: number) => {
  pagination.page = val
}

// 定时刷新（每3秒刷新一次）
let refreshInterval: number | null = null

onMounted(() => {
  // 初始加载数据（显示消息）
  refreshList(true)

  // 设置定时刷新（每3秒刷新一次）
  refreshInterval = window.setInterval(() => {
    // 只要有非已完成的任务就刷新（包括pending和processing）
    const hasIncomplete = downloadTasks.value.some(t => t.status === 'processing' || t.status === 'pending')
    if (hasIncomplete) {
      // 有未完成的任务时自动刷新（不显示消息）
      refreshList(false)
    }
  }, 3000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped lang="scss">
.download-manager {
  padding: 20px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
      }
    }

    .header-right {
      display: flex;
      gap: 10px;
    }
  }

  .stats-overview {
    margin-bottom: 20px;

    .stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }

      .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f7fa;
        color: #606266;
      }

      .stat-info {
        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #303133;
          line-height: 1.2;
        }
        .stat-label {
          font-size: 13px;
          color: #909399;
          margin-top: 4px;
        }
      }

      &.total .stat-icon { background: #ecf5ff; color: #409eff; }
      &.processing .stat-icon { background: #fdf6ec; color: #e6a23c; }
      &.completed .stat-icon { background: #f0f9eb; color: #67c23a; }
      &.failed .stat-icon { background: #fef0f0; color: #f56c6c; }
      &.pending .stat-icon { background: #f4f4f5; color: #909399; }
      &.storage .stat-icon { background: #f0f9ff; color: #1890ff; }
    }
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .filter-section {
      display: flex;
      align-items: center;
    }
  }

  .task-list-card {
    .task-info-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .task-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f7fa;
        flex-shrink: 0;

        &.final-draft { background: #f0f9eb; color: #67c23a; }
        &.product { background: #ecf5ff; color: #409eff; }
        &.selection { background: #fdf6ec; color: #e6a23c; }
        &.material { background: #f0f9ff; color: #1890ff; }
        &.carrier { background: #fef0f0; color: #f56c6c; }
        &.system { background: #f4f4f5; color: #606266; }
      }

      .task-detail {
        min-width: 0;

        .task-name {
          font-weight: 500;
          color: #303133;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-meta {
          display: flex;
          align-items: center;
          gap: 8px;

          .file-count {
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }

    .status-cell {
      display: flex;
      align-items: center;
      gap: 6px;

      .success-icon { color: #67c23a; }
      .error-icon { color: #f56c6c; }
      .info-icon { color: #909399; }
    }

    .progress-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .el-progress {
        flex: 1;
      }

      .progress-text {
        font-size: 12px;
        color: #606266;
        min-width: 36px;
      }
    }

    .success-info, .error-info, .wait-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      .el-icon {
        font-size: 14px;
      }
    }

    .success-info { color: #67c23a; }
    .error-info { color: #f56c6c; }
    .wait-info { color: #909399; }

    .time-cell {
      .time-main {
        font-size: 13px;
        color: #303133;
      }
      .time-sub {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }

    .action-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .batch-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-top: 16px;
      background: #f5f7fa;
      border-radius: 6px;

      .selected-count {
        font-size: 14px;
        color: #606266;
        margin-right: auto;
      }
    }

    .pagination-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #ebeef5;
    }
  }

  .task-detail-dialog {
    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ebeef5;

      .detail-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f7fa;

        &.final-draft { background: #f0f9eb; color: #67c23a; }
        &.product { background: #ecf5ff; color: #409eff; }
        &.selection { background: #fdf6ec; color: #e6a23c; }
        &.material { background: #f0f9ff; color: #1890ff; }
        &.carrier { background: #fef0f0; color: #f56c6c; }
        &.system { background: #f4f4f5; color: #606266; }
      }

      .detail-info {
        h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
        }
      }
    }

    .error-text {
      color: #f56c6c;
    }

    .file-list-section {
      margin-top: 20px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #606266;
      }
    }
  }
}

:deep(.danger-item) {
  color: #f56c6c;
}

// 预览对话框样式
.preview-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    .preview-image-wrapper {
      width: 100%;
      height: 500px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f5f7fa;
      border-radius: 8px;
      overflow: hidden;

      .preview-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    }

    .preview-filename {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 12px 16px;
      background-color: #f5f7fa;
      border-radius: 6px;

      .filename-text {
        font-size: 14px;
        color: #303133;
        font-weight: 500;
        word-break: break-all;
        flex: 1;
        margin-right: 12px;
      }

      .file-counter {
        font-size: 13px;
        color: #909399;
        white-space: nowrap;
      }
    }

    .preview-navigation {
      display: flex;
      gap: 16px;

      .el-button {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    .preview-thumbnails {
      width: 100%;
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 12px;
      background-color: #f5f7fa;
      border-radius: 6px;

      .thumbnail-item {
        flex-shrink: 0;
        width: 100px;
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 4px;
        overflow: hidden;
        transition: all 0.3s;

        &.active {
          border-color: #409eff;
        }

        &:hover {
          border-color: #a0cfff;
        }

        img {
          width: 100%;
          height: 80px;
          object-fit: cover;
          display: block;
        }

        .thumbnail-name {
          display: block;
          padding: 4px 6px;
          font-size: 11px;
          color: #606266;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          background-color: #fff;
        }
      }
    }
  }

  .preview-empty {
    padding: 40px 0;
  }
}
</style>
