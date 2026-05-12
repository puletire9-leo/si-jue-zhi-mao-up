<template>
  <div class="resource-collection">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>资料库</span>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="FolderAdd"
              @click="handleAddFolder"
            >
              新建文件夹
            </el-button>
            <el-button
              type="primary"
              :icon="Link"
              @click="handleAddLink"
            >
              添加链接
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

      <!-- 面包屑导航 -->
      <div class="breadcrumb-container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item @click="handleRootClick">
            <span class="breadcrumb-root">📁 根目录</span>
          </el-breadcrumb-item>
          <el-breadcrumb-item
            v-for="(folder, index) in breadcrumbFolders"
            :key="folder.id"
            @click="handleBreadcrumbClick(folder, index)"
          >
            {{ folder.name }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <!-- 搜索区域 -->
      <el-form
        :inline="true"
        :model="searchForm"
        class="search-form"
      >
        <el-form-item label="链接名称">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入链接名称"
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

      <!-- 网格布局显示 -->
      <div
        class="grid-container"
        @drop="handleDropOnContainer"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        :class="{ 'drag-over': isDragOver }"
      >
        <!-- 文件夹列表 -->
        <div
          v-for="folder in folderList"
          :key="folder.id"
          class="grid-item folder-item"
          :class="{ 'drag-target': dragOverFolderId === folder.id }"
          draggable="true"
          @dragstart="handleFolderDragStart(folder, $event)"
          @dragover="handleFolderDragOver(folder, $event)"
          @dragleave="handleFolderDragLeave(folder)"
          @drop="handleDropOnFolder(folder, $event)"
          @click="handleFolderClick(folder)"
          @contextmenu.prevent="handleContextMenu($event, folder, 'folder')"
        >
          <div class="item-icon folder-icon">
            <el-icon :size="48"><Folder /></el-icon>
          </div>
          <div class="item-name" :title="folder.name">{{ folder.name }}</div>
          <div class="item-count">{{ folder.itemCount || 0 }} 项</div>
        </div>

        <!-- 链接列表 -->
        <div
          v-for="link in linkList"
          :key="link.id"
          class="grid-item link-item"
          draggable="true"
          @dragstart="handleLinkDragStart(link, $event)"
          @click="handleLinkClick(link)"
          @contextmenu.prevent="handleContextMenu($event, link, 'link')"
        >
          <div class="item-icon link-icon">
            <el-icon :size="40"><Link /></el-icon>
          </div>
          <div class="item-name" :title="link.name">{{ link.name }}</div>
          <div class="item-url" :title="link.url">{{ link.url }}</div>
          <div class="item-actions">
            <el-button
              type="primary"
              link
              size="small"
              :icon="View"
              @click.stop="handlePreview(link)"
            >
              预览
            </el-button>
            <el-button
              type="success"
              link
              size="small"
              :icon="Download"
              @click.stop="handleDownload(link)"
            >
              保存
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              :icon="Delete"
              @click.stop="handleDelete(link)"
            >
              删除
            </el-button>
          </div>
        </div>

        <!-- 空状态 -->
        <el-empty
          v-if="folderList.length === 0 && linkList.length === 0"
          description="暂无内容"
          :image-size="120"
        />
      </div>

      <!-- 分页 -->
      <div class="pagination-container" v-if="pagination.total > 0">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[20, 40, 60, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建文件夹对话框 -->
    <el-dialog
      v-model="folderDialogVisible"
      title="新建文件夹"
      width="400px"
    >
      <el-form
        :model="folderForm"
        :rules="folderRules"
        ref="folderFormRef"
        label-width="80px"
      >
        <el-form-item label="文件夹名" prop="name">
          <el-input v-model="folderForm.name" placeholder="请输入文件夹名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="folderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateFolder">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加链接对话框 -->
    <el-dialog
      v-model="linkDialogVisible"
      title="添加链接"
      width="500px"
    >
      <el-form
        :model="linkForm"
        :rules="linkRules"
        ref="linkFormRef"
        label-width="80px"
      >
        <el-form-item label="链接名称" prop="name">
          <el-input v-model="linkForm.name" placeholder="请输入链接名称" />
        </el-form-item>
        <el-form-item label="链接地址" prop="url">
          <el-input v-model="linkForm.url" placeholder="请输入链接地址" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="linkForm.category" placeholder="请输入分类（可选）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="linkForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="linkDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateLink">确定</el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <el-dialog
      v-model="contextMenuVisible"
      :show-close="false"
      width="150px"
      class="context-menu-dialog"
      :style="{ position: 'fixed', top: contextMenuPosition.y + 'px', left: contextMenuPosition.x + 'px' }"
    >
      <div class="context-menu">
        <div class="context-menu-item" @click="handleRename">重命名</div>
        <div class="context-menu-item" @click="handleMove">移动到</div>
        <div class="context-menu-item delete" @click="handleDeleteFromMenu">删除</div>
      </div>
    </el-dialog>

    <!-- 移动到对话框 -->
    <el-dialog
      v-model="moveDialogVisible"
      title="移动到"
      width="400px"
    >
      <div class="folder-tree">
        <div
          class="folder-tree-item"
          :class="{ selected: selectedMoveTarget === null }"
          @click="selectedMoveTarget = null"
        >
          <span>📁 根目录</span>
        </div>
        <div
          v-for="folder in allFolders"
          :key="folder.id"
          class="folder-tree-item"
          :class="{ selected: selectedMoveTarget === folder.id }"
          @click="selectedMoveTarget = folder.id"
        >
          <el-icon><Folder /></el-icon>
          <span>{{ folder.name }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="moveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmMove">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  FolderAdd,
  Link,
  Delete,
  Search,
  Refresh,
  View,
  Download,
  Folder
} from '@element-plus/icons-vue'

// 类型定义
interface Folder {
  id: number
  name: string
  parentId: number | null
  itemCount?: number
}

interface Link {
  id: number
  name: string
  url: string
  category?: string
  description?: string
  folderId: number | null
}

// 响应式数据
const folderList = ref<Folder[]>([])
const linkList = ref<Link[]>([])
const selectedIds = ref<number[]>([])
const currentFolderId = ref<number | null>(null)
const breadcrumbFolders = ref<Folder[]>([])
const isDragOver = ref(false)
const dragOverFolderId = ref<number | null>(null)
const draggingItem = ref<Link | Folder | null>(null)

// 对话框状态
const folderDialogVisible = ref(false)
const linkDialogVisible = ref(false)
const moveDialogVisible = ref(false)
const contextMenuVisible = ref(false)

// 表单数据
const folderForm = reactive({ name: '' })
const linkForm = reactive({ name: '', url: '', category: '', description: '' })

// 右键菜单
const contextMenuPosition = reactive({ x: 0, y: 0 })
const contextMenuTarget = ref<{ item: Link | Folder; type: 'folder' | 'link' } | null>(null)
const selectedMoveTarget = ref<number | null>(null)

// 搜索表单
const searchForm = reactive({ name: '', category: '' })

// 分页
const pagination = reactive({ page: 1, size: 20, total: 0 })

// 表单引用
const folderFormRef = ref()
const linkFormRef = ref()

// 验证规则
const folderRules = {
  name: [{ required: true, message: '请输入文件夹名称', trigger: 'blur' }]
}

const linkRules = {
  name: [{ required: true, message: '请输入链接名称', trigger: 'blur' }],
  url: [{ required: true, message: '请输入链接地址', trigger: 'blur' }]
}

// 所有文件夹（用于移动）
const allFolders = computed(() => {
  return folderList.value.filter(f => f.id !== contextMenuTarget.value?.item.id)
})

// 加载数据
const loadData = async () => {
  try {
    // 模拟加载文件夹
    folderList.value = [
      { id: 1, name: '工作文档', parentId: null, itemCount: 5 },
      { id: 2, name: '学习资料', parentId: null, itemCount: 3 },
      { id: 3, name: '常用工具', parentId: null, itemCount: 8 }
    ].filter(f => f.parentId === currentFolderId.value)

    // 模拟加载链接
    linkList.value = [
      { id: 101, name: '公司官网', url: 'https://www.example.com', folderId: null },
      { id: 102, name: '开发文档', url: 'https://docs.example.com', folderId: null },
      { id: 103, name: '设计规范', url: 'https://design.example.com', folderId: null }
    ].filter(l => l.folderId === currentFolderId.value)

    pagination.total = folderList.value.length + linkList.value.length
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置搜索
const handleReset = () => {
  searchForm.name = ''
  searchForm.category = ''
  pagination.page = 1
  loadData()
}

// 新建文件夹
const handleAddFolder = () => {
  folderForm.name = ''
  folderDialogVisible.value = true
}

const handleCreateFolder = async () => {
  if (!folderFormRef.value) return
  
  try {
    await folderFormRef.value.validate()
    
    const newFolder: Folder = {
      id: Date.now(),
      name: folderForm.name,
      parentId: currentFolderId.value,
      itemCount: 0
    }
    
    folderList.value.push(newFolder)
    folderDialogVisible.value = false
    ElMessage.success('文件夹创建成功')
  } catch (error) {
    // 验证失败
  }
}

// 添加链接
const handleAddLink = () => {
  linkForm.name = ''
  linkForm.url = ''
  linkForm.category = ''
  linkForm.description = ''
  linkDialogVisible.value = true
}

const handleCreateLink = async () => {
  if (!linkFormRef.value) return
  
  try {
    await linkFormRef.value.validate()
    
    const newLink: Link = {
      id: Date.now(),
      name: linkForm.name,
      url: linkForm.url,
      category: linkForm.category,
      description: linkForm.description,
      folderId: currentFolderId.value
    }
    
    linkList.value.push(newLink)
    linkDialogVisible.value = false
    ElMessage.success('链接添加成功')
  } catch (error) {
    // 验证失败
  }
}

// 文件夹点击
const handleFolderClick = (folder: Folder) => {
  currentFolderId.value = folder.id
  breadcrumbFolders.value.push(folder)
  loadData()
}

// 面包屑导航
const handleRootClick = () => {
  currentFolderId.value = null
  breadcrumbFolders.value = []
  loadData()
}

const handleBreadcrumbClick = (folder: Folder, index: number) => {
  breadcrumbFolders.value = breadcrumbFolders.value.slice(0, index + 1)
  currentFolderId.value = folder.id
  loadData()
}

// 链接点击
const handleLinkClick = (link: Link) => {
  window.open(link.url, '_blank')
}

// 拖拽处理
const handleLinkDragStart = (link: Link, event: DragEvent) => {
  draggingItem.value = link
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('type', 'link')
    event.dataTransfer.setData('id', link.id.toString())
  }
}

const handleFolderDragStart = (folder: Folder, event: DragEvent) => {
  draggingItem.value = folder
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('type', 'folder')
    event.dataTransfer.setData('id', folder.id.toString())
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleFolderDragOver = (folder: Folder, event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  dragOverFolderId.value = folder.id
}

const handleFolderDragLeave = (folder: Folder) => {
  if (dragOverFolderId.value === folder.id) {
    dragOverFolderId.value = null
  }
}

const handleDropOnFolder = (folder: Folder, event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()
  dragOverFolderId.value = null
  isDragOver.value = false
  
  const type = event.dataTransfer?.getData('type')
  const id = parseInt(event.dataTransfer?.getData('id') || '0')
  
  if (type === 'link') {
    const link = linkList.value.find(l => l.id === id)
    if (link && link.id !== folder.id) {
      link.folderId = folder.id
      folder.itemCount = (folder.itemCount || 0) + 1
      linkList.value = linkList.value.filter(l => l.id !== id)
      ElMessage.success(`已将"${link.name}"移动到"${folder.name}"`)
    }
  }
}

const handleDropOnContainer = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
}

// 右键菜单
const handleContextMenu = (event: MouseEvent, item: Link | Folder, type: 'folder' | 'link') => {
  contextMenuPosition.x = event.clientX
  contextMenuPosition.y = event.clientY
  contextMenuTarget.value = { item, type }
  contextMenuVisible.value = true
}

const handleRename = () => {
  contextMenuVisible.value = false
  if (contextMenuTarget.value) {
    const { item, type } = contextMenuTarget.value
    ElMessageBox.prompt('请输入新名称', '重命名', {
      inputValue: item.name,
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }).then(({ value }) => {
      if (value && value.trim()) {
        item.name = value.trim()
        ElMessage.success('重命名成功')
      }
    })
  }
}

const handleMove = () => {
  contextMenuVisible.value = false
  selectedMoveTarget.value = null
  moveDialogVisible.value = true
}

const handleConfirmMove = () => {
  if (contextMenuTarget.value) {
    const { item, type } = contextMenuTarget.value
    
    if (type === 'link') {
      const link = item as Link
      link.folderId = selectedMoveTarget.value
      
      if (selectedMoveTarget.value !== currentFolderId.value) {
        linkList.value = linkList.value.filter(l => l.id !== link.id)
      }
      
      ElMessage.success('移动成功')
    } else {
      const folder = item as Folder
      folder.parentId = selectedMoveTarget.value
      
      if (selectedMoveTarget.value !== currentFolderId.value) {
        folderList.value = folderList.value.filter(f => f.id !== folder.id)
      }
      
      ElMessage.success('移动成功')
    }
  }
  moveDialogVisible.value = false
}

const handleDeleteFromMenu = () => {
  contextMenuVisible.value = false
  if (contextMenuTarget.value) {
    const { item, type } = contextMenuTarget.value
    
    ElMessageBox.confirm(
      `确定要删除${type === 'folder' ? '文件夹' : '链接'}"${item.name}"吗？`,
      '确认删除',
      { type: 'warning' }
    ).then(() => {
      if (type === 'folder') {
        folderList.value = folderList.value.filter(f => f.id !== item.id)
      } else {
        linkList.value = linkList.value.filter(l => l.id !== item.id)
      }
      ElMessage.success('删除成功')
    })
  }
}

// 其他操作
const handlePreview = (link: Link) => {
  window.open(link.url, '_blank')
}

const handleDownload = (link: Link) => {
  window.open(link.url, '_blank')
  ElMessage.success('开始下载')
}

const handleDelete = (link: Link) => {
  ElMessageBox.confirm(
    `确定要删除链接"${link.name}"吗？`,
    '确认删除',
    { type: 'warning' }
  ).then(() => {
    linkList.value = linkList.value.filter(l => l.id !== link.id)
    ElMessage.success('删除成功')
  })
}

const handleBatchDelete = () => {
  ElMessageBox.confirm(
    `确定要删除选中的 ${selectedIds.value.length} 项吗？`,
    '确认删除',
    { type: 'warning' }
  ).then(() => {
    linkList.value = linkList.value.filter(l => !selectedIds.value.includes(l.id))
    selectedIds.value = []
    ElMessage.success('批量删除成功')
  })
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.size = size
  loadData()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

// 点击外部关闭右键菜单
const handleClickOutside = () => {
  contextMenuVisible.value = false
}

onMounted(() => {
  loadData()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.resource-collection {
  padding: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-actions {
      display: flex;
      gap: 10px;
    }
  }

  .breadcrumb-container {
    margin-bottom: 20px;
    padding: 10px 0;
    border-bottom: 1px solid #e4e7ed;

    .breadcrumb-root {
      cursor: pointer;
      color: #409eff;

      &:hover {
        color: #66b1ff;
      }
    }
  }

  .search-form {
    margin-bottom: 20px;

    .el-form-item {
      margin-bottom: 0;
    }
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 20px;
    padding: 20px;
    min-height: 300px;
    border: 2px dashed transparent;
    border-radius: 8px;
    transition: all 0.3s;

    &.drag-over {
      border-color: #409eff;
      background-color: #f5f7fa;
    }

    .grid-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      position: relative;

      &:hover {
        background-color: #f5f7fa;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      }

      &.drag-target {
        background-color: #ecf5ff;
        border: 2px dashed #409eff;
      }

      .item-icon {
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;

        &.folder-icon {
          color: #e6a23c;
        }

        &.link-icon {
          color: #409eff;
        }
      }

      .item-name {
        font-size: 14px;
        color: #303133;
        text-align: center;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 4px;
      }

      .item-url {
        font-size: 12px;
        color: #909399;
        text-align: center;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-count {
        font-size: 12px;
        color: #909399;
      }

      .item-actions {
        display: flex;
        gap: 4px;
        margin-top: 8px;
        opacity: 0;
        transition: opacity 0.3s;
      }

      &:hover .item-actions {
        opacity: 1;
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}

// 文件夹树样式
.folder-tree {
  max-height: 300px;
  overflow-y: auto;

  .folder-tree-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.3s;

    &:hover {
      background-color: #f5f7fa;
    }

    &.selected {
      background-color: #ecf5ff;
      color: #409eff;
    }

    .el-icon {
      color: #e6a23c;
    }
  }
}

// 右键菜单样式
.context-menu-dialog {
  :deep(.el-dialog__header) {
    display: none;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  .context-menu {
    .context-menu-item {
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        background-color: #f5f7fa;
      }

      &.delete {
        color: #f56c6c;

        &:hover {
          background-color: #fef0f0;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .resource-collection {
    padding: 10px;

    .grid-container {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
      padding: 10px;
    }
  }
}
</style>
