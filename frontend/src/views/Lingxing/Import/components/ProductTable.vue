<template>
  <div class="product-table-wrapper">
    <el-table
      :data="tableData"
      border
      stripe
      height="700"
      class="product-table"
      v-loading="loading"
      row-key="id"
    >
      <!-- 选择列 -->
      <el-table-column width="50" align="center" fixed="left">
        <template #header>
          <div class="drag-column-header">
            <el-icon :size="16"><Rank /></el-icon>
            <el-button
              v-if="selectedRowIndex !== null"
              type="danger"
              link
              size="small"
              @click="cancelRowSelection"
            >
              取消
            </el-button>
          </div>
        </template>
        <template #default="{ $index }">
          <div
            class="drag-handle"
            :class="{
              'row-selected': selectedRowIndex === $index,
              'row-selectable': selectedRowIndex !== null && selectedRowIndex !== $index
            }"
            @click="handleRowSelect($index)"
            :title="selectedRowIndex === $index ? '已选中，点击取消' : (selectedRowIndex !== null ? '点击交换' : '点击选择')"
          >
            <el-icon v-if="selectedRowIndex === $index" :size="18" color="#67c23a"><Check /></el-icon>
            <el-icon v-else-if="selectedRowIndex !== null" :size="18" color="#409eff"><Pointer /></el-icon>
            <el-icon v-else :size="18"><Rank /></el-icon>
          </div>
        </template>
      </el-table-column>

      <!-- 图片列 -->
      <el-table-column label="图片" width="130" align="center" fixed="left">
        <template #default="{ row, $index }">
          <div
            class="image-cell"
            :class="{
              'row-highlight': selectedRowIndex === $index
            }"
          >
            <el-upload
              class="image-uploader"
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="(file) => handleImageChange(file, $index)"
              accept="image/*"
            >
              <div class="upload-trigger">
                <img
                  v-if="row.imageUrl"
                  :src="row.imageUrl"
                  class="product-image"
                  style="width: 60px; height: 60px; object-fit: cover;"
                />
                <div v-else class="upload-placeholder">
                  <el-icon><Plus /></el-icon>
                  <span>上传</span>
                </div>
              </div>
            </el-upload>
            <el-button
              v-if="row.imageUrl"
              type="primary"
              link
              size="small"
              class="view-image-btn"
              @click.stop="openImagePreview(row.imageUrl)"
            >
              <el-icon><ZoomIn /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>

      <!-- SKU列 -->
      <el-table-column prop="sku" label="SKU" width="150" fixed="left">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'sku'"
            v-model="row.sku"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
            ref="skuInput"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'sku')"
          >
            {{ row.sku || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 产品名称列 -->
      <el-table-column prop="productName" label="产品名称" min-width="200">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'productName'"
            v-model="row.productName"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'productName')"
          >
            {{ row.productName || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 文件码列 -->
      <el-table-column prop="fileCode" label="文件码" width="180">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'fileCode'"
            v-model="row.fileCode"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'fileCode')"
          >
            {{ row.fileCode || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 图片URL列 -->
      <el-table-column prop="cosImageUrl" label="图片URL" width="300">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'cosImageUrl'"
            v-model="row.cosImageUrl"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell link-cell"
            @click="startEditing($index, 'cosImageUrl')"
          >
            <a
              v-if="row.cosImageUrl"
              :href="row.cosImageUrl"
              target="_blank"
              class="supplier-link"
              @click.stop
            >
              {{ row.cosImageUrl.substring(0, 30) }}...
            </a>
            <span v-else>-</span>
          </div>
        </template>
      </el-table-column>

      <!-- 长cm列 -->
      <el-table-column prop="length" label="长(cm)" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            v-if="editingCell.row === $index && editingCell.col === 'length'"
            v-model="row.length"
            :min="0"
            :precision="2"
            size="small"
            @blur="stopEditing"
            style="width: 100%"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'length')"
          >
            {{ row.length ?? '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 宽cm列 -->
      <el-table-column prop="width" label="宽(cm)" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            v-if="editingCell.row === $index && editingCell.col === 'width'"
            v-model="row.width"
            :min="0"
            :precision="2"
            size="small"
            @blur="stopEditing"
            style="width: 100%"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'width')"
          >
            {{ row.width ?? '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 高cm列 -->
      <el-table-column prop="height" label="高(cm)" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            v-if="editingCell.row === $index && editingCell.col === 'height'"
            v-model="row.height"
            :min="0"
            :precision="2"
            size="small"
            @blur="stopEditing"
            style="width: 100%"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'height')"
          >
            {{ row.height ?? '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 毛重列 -->
      <el-table-column prop="weight" label="毛重(kg)" width="100">
        <template #default="{ row, $index }">
          <el-input-number
            v-if="editingCell.row === $index && editingCell.col === 'weight'"
            v-model="row.weight"
            :min="0"
            :precision="3"
            size="small"
            @blur="stopEditing"
            style="width: 100%"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'weight')"
          >
            {{ row.weight ?? '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 采购费用列 -->
      <el-table-column prop="purchaseCost" label="采购费用" width="120">
        <template #default="{ row, $index }">
          <el-input-number
            v-if="editingCell.row === $index && editingCell.col === 'purchaseCost'"
            v-model="row.purchaseCost"
            :min="0"
            :precision="2"
            size="small"
            @blur="stopEditing"
            style="width: 100%"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'purchaseCost')"
          >
            {{ row.purchaseCost ?? '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 供应商列 -->
      <el-table-column prop="supplier" label="供应商" width="150">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'supplier'"
            v-model="row.supplier"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'supplier')"
          >
            {{ row.supplier || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 供应商链接列 -->
      <el-table-column prop="supplierLink" label="供应商链接" width="150">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'supplierLink'"
            v-model="row.supplierLink"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell link-cell"
            @click="startEditing($index, 'supplierLink')"
          >
            <a
              v-if="row.supplierLink"
              :href="row.supplierLink"
              target="_blank"
              @click.stop
              class="supplier-link"
            >
              查看链接
            </a>
            <span v-else>-</span>
          </div>
        </template>
      </el-table-column>

      <!-- 英国海关编码列 -->
      <el-table-column prop="ukCustomsCode" label="英国海关编码" width="150">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'ukCustomsCode'"
            v-model="row.ukCustomsCode"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'ukCustomsCode')"
          >
            {{ row.ukCustomsCode || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 中文报关名列 -->
      <el-table-column prop="cnDeclarationName" label="中文报关名" width="150">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'cnDeclarationName'"
            v-model="row.cnDeclarationName"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'cnDeclarationName')"
          >
            {{ row.cnDeclarationName || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 英文报关名列 -->
      <el-table-column prop="enDeclarationName" label="英文报关名" width="150">
        <template #default="{ row, $index }">
          <el-input
            v-if="editingCell.row === $index && editingCell.col === 'enDeclarationName'"
            v-model="row.enDeclarationName"
            size="small"
            @blur="stopEditing"
            @keyup.enter="stopEditing"
          />
          <div
            v-else
            class="editable-cell"
            @click="startEditing($index, 'enDeclarationName')"
          >
            {{ row.enDeclarationName || '-' }}
          </div>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ $index }">
          <el-button
            type="danger"
            link
            size="small"
            @click="handleDeleteRow($index)"
          >
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 拖拽图片预览 -->
    <div
      v-if="dragPreviewPos.show && dragImageUrl"
      class="drag-image-preview"
      :style="{ left: dragPreviewPos.x + 'px', top: dragPreviewPos.y + 'px' }"
    >
      <img :src="dragImageUrl" alt="拖拽中" />
    </div>

    <!-- 滚动提示动画 -->
    <div
      v-if="scrollIndicator.show"
      class="scroll-indicator"
      :class="{ 'scroll-up': scrollIndicator.direction === 'up', 'scroll-down': scrollIndicator.direction === 'down' }"
    >
      <el-icon :size="32">
        <ArrowUp v-if="scrollIndicator.direction === 'up'" />
        <ArrowDown v-if="scrollIndicator.direction === 'down'" />
      </el-icon>
      <span>{{ scrollIndicator.direction === 'up' ? '继续向上拖拽以滚动' : '继续向下拖拽以滚动' }}</span>
    </div>

    <!-- 操作提示 -->
    <div class="drag-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>提示：点击左侧 ⇅ 图标选择行，再点击另一行的 ⇅ 图标即可交换两者的图片、文件码、图片URL信息</span>
    </div>

    <!-- 表格底部统计 -->
    <div class="table-footer">
      <span class="total-count">共 {{ tableData.length }} 条数据</span>
    </div>

    <!-- 图片预览对话框 -->
    <el-dialog
      v-model="imagePreviewVisible"
      title="图片预览"
      width="80%"
      :close-on-click-modal="true"
      class="image-preview-dialog"
    >
      <div class="preview-image-container">
        <img :src="currentPreviewImage" alt="预览图片" class="preview-image" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 产品列表表格组件
 * 支持行内编辑、图片上传、删除操作、拖拽排序
 */
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Rank, InfoFilled, ArrowUp, ArrowDown, Check, Pointer, ZoomIn } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { ElDialog } from 'element-plus'

/**
 * 图片预览相关状态
 */
const imagePreviewVisible = ref(false)
const currentPreviewImage = ref('')

/**
 * 打开图片预览
 * @param imageUrl 图片URL
 */
const openImagePreview = (imageUrl: string) => {
  currentPreviewImage.value = imageUrl
  imagePreviewVisible.value = true
}

/**
 * 产品数据接口
 */
interface ProductData {
  /** 唯一标识 */
  id?: string
  /** SKU */
  sku: string
  /** 产品名称 */
  productName: string
  /** 长(cm) */
  length?: number
  /** 宽(cm) */
  width?: number
  /** 高(cm) */
  height?: number
  /** 毛重(kg) */
  weight?: number
  /** 采购费用 */
  purchaseCost?: number
  /** 供应商链接 */
  supplierLink?: string
  /** 供应商 */
  supplier?: string
  /** 英国海关编码 */
  ukCustomsCode?: string
  /** 中文报关名 */
  cnDeclarationName?: string
  /** 英文报关名 */
  enDeclarationName?: string
  /** 文件码 */
  fileCode?: string
  /** COS图片URL */
  cosImageUrl?: string
  /** 图片URL */
  imageUrl?: string
}

/**
 * 组件属性定义
 */
interface Props {
  /** 表格数据 */
  data: ProductData[]
  /** 加载状态 */
  loading?: boolean
}

/**
 * 组件事件定义
 */
interface Emits {
  /** 数据更新事件 */
  (e: 'update:data', data: ProductData[]): void
  /** 删除行事件 */
  (e: 'delete', index: number): void
  /** 图片上传事件 */
  (e: 'imageUpload', file: UploadFile, index: number): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

/**
 * 当前编辑的单元格
 */
const editingCell = reactive<{
  row: number
  col: string
}>({
  row: -1,
  col: ''
})

/**
 * 表格数据（添加唯一ID用于拖拽）
 */
const tableData = computed({
  get: () => {
    return props.data.map((item, index) => ({
      ...item,
      id: item.id || `row-${index}-${Date.now()}`
    }))
  },
  set: (val) => {
    // 移除id字段后更新数据
    const cleanData = val.map(({ id, ...rest }) => rest)
    emit('update:data', cleanData)
  }
})

/**
 * 开始编辑单元格
 * @param rowIndex 行索引
 * @param colKey 列标识
 */
const startEditing = (rowIndex: number, colKey: string) => {
  editingCell.row = rowIndex
  editingCell.col = colKey
}

/**
 * 停止编辑
 */
const stopEditing = () => {
  editingCell.row = -1
  editingCell.col = ''
}

/**
 * 行选择相关状态
 */
const selectedRowIndex = ref<number | null>(null)

/**
 * 处理行选择
 * @param index 行索引
 */
const handleRowSelect = (index: number) => {
  // 如果点击的是已选中的行，取消选择
  if (selectedRowIndex.value === index) {
    selectedRowIndex.value = null
    return
  }

  // 如果没有选中任何行，选中当前行
  if (selectedRowIndex.value === null) {
    selectedRowIndex.value = index
    ElMessage.info(`已选中第${index + 1}行，请点击另一行进行交换`)
    return
  }

  // 如果已经选中了其他行，交换两者的图片信息
  const sourceIndex = selectedRowIndex.value
  const targetIndex = index

  // 交换图片相关的三个字段
  const newData = [...tableData.value]
  const sourceRow = newData[sourceIndex]
  const targetRow = newData[targetIndex]

  // 保存源行的图片相关数据
  const tempImageUrl = sourceRow.imageUrl
  const tempFileCode = sourceRow.fileCode
  const tempCosImageUrl = sourceRow.cosImageUrl

  // 交换图片相关数据
  sourceRow.imageUrl = targetRow.imageUrl
  sourceRow.fileCode = targetRow.fileCode
  sourceRow.cosImageUrl = targetRow.cosImageUrl

  targetRow.imageUrl = tempImageUrl
  targetRow.fileCode = tempFileCode
  targetRow.cosImageUrl = tempCosImageUrl

  tableData.value = newData

  ElMessage.success(`已交换第${sourceIndex + 1}行和第${targetIndex + 1}行的图片信息`)

  // 重置选择状态
  selectedRowIndex.value = null
}

/**
 * 取消行选择
 */
const cancelRowSelection = () => {
  selectedRowIndex.value = null
  ElMessage.info('已取消选择')
}

/**
 * 拖拽相关状态
 */
const draggingIndex = ref<number | null>(null)
const dragImageUrl = ref<string>('')
const dragPreviewPos = reactive({ x: 0, y: 0, show: false })

/**
 * 滚动动画状态
 */
const scrollIndicator = reactive<{
  show: boolean
  direction: 'up' | 'down' | null
}>({
  show: false,
  direction: null
})

/**
 * 处理拖拽开始
 * @param event 拖拽事件
 * @param index 行索引
 */
const handleDragStart = (event: DragEvent, index: number) => {
  draggingIndex.value = index

  // 获取当前行的图片URL
  const row = tableData.value[index]
  if (row && row.imageUrl) {
    dragImageUrl.value = row.imageUrl
    dragPreviewPos.show = true
  }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
  // 添加全局拖拽监听
  document.addEventListener('dragover', handleGlobalDragOver)
  document.addEventListener('drop', handleGlobalDrop)
}

/**
 * 全局拖拽经过处理（用于滚动检测和图片跟随）
 */
const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()

  // 更新拖拽图片位置
  if (dragPreviewPos.show) {
    dragPreviewPos.x = event.clientX + 15
    dragPreviewPos.y = event.clientY + 15
  }

  // 自动滚动逻辑
  const tableWrapper = document.querySelector('.product-table .el-table__body-wrapper') as HTMLElement
  if (!tableWrapper) return

  const rect = tableWrapper.getBoundingClientRect()
  const scrollTop = tableWrapper.scrollTop
  const scrollHeight = tableWrapper.scrollHeight
  const clientHeight = tableWrapper.clientHeight
  const mouseY = event.clientY

  // 计算鼠标相对于表格的位置
  const relativeY = mouseY - rect.top
  const distanceFromBottom = rect.bottom - mouseY

  // 定义滚动触发区域（距离边缘100px，确保在表格可见区域内）
  const scrollZone = 100
  const scrollSpeed = 15

  // 向上滚动 - 鼠标在表格顶部scrollZone范围内
  if (relativeY >= 0 && relativeY < scrollZone && scrollTop > 0) {
    tableWrapper.scrollTop = Math.max(0, scrollTop - scrollSpeed)
    scrollIndicator.show = true
    scrollIndicator.direction = 'up'
  }
  // 向下滚动 - 鼠标在表格底部scrollZone范围内
  else if (distanceFromBottom >= 0 && distanceFromBottom < scrollZone && scrollTop < scrollHeight - clientHeight) {
    tableWrapper.scrollTop = Math.min(scrollHeight - clientHeight, scrollTop + scrollSpeed)
    scrollIndicator.show = true
    scrollIndicator.direction = 'down'
  }
  // 不在滚动区域，隐藏提示
  else {
    scrollIndicator.show = false
    scrollIndicator.direction = null
  }
}

/**
 * 全局拖拽放下处理
 */
const handleGlobalDrop = (event: DragEvent) => {
  // 清理全局监听
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('drop', handleGlobalDrop)
  // 隐藏拖拽图片
  dragPreviewPos.show = false
  dragImageUrl.value = ''
}

/**
 * 处理拖拽经过（行内处理）
 * @param event 拖拽事件
 * @param index 行索引
 */
const handleDragOver = (event: DragEvent, index: number) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

/**
 * 处理拖拽放下
 * 只交换图片、文件码、图片URL三列的数据
 * @param event 拖拽事件
 * @param targetIndex 目标行索引
 */
const handleDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault()

  // 清理全局监听
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('drop', handleGlobalDrop)

  const sourceIndex = draggingIndex.value

  if (sourceIndex === null || sourceIndex === targetIndex) {
    draggingIndex.value = null
    dragPreviewPos.show = false
    dragImageUrl.value = ''
    scrollIndicator.show = false
    scrollIndicator.direction = null
    return
  }

  // 只交换图片相关的三个字段
  const newData = [...tableData.value]
  const sourceRow = newData[sourceIndex]
  const targetRow = newData[targetIndex]

  // 保存源行的图片相关数据
  const tempImageUrl = sourceRow.imageUrl
  const tempFileCode = sourceRow.fileCode
  const tempCosImageUrl = sourceRow.cosImageUrl

  // 交换图片相关数据
  sourceRow.imageUrl = targetRow.imageUrl
  sourceRow.fileCode = targetRow.fileCode
  sourceRow.cosImageUrl = targetRow.cosImageUrl

  targetRow.imageUrl = tempImageUrl
  targetRow.fileCode = tempFileCode
  targetRow.cosImageUrl = tempCosImageUrl

  tableData.value = newData

  ElMessage.success(`已交换第${sourceIndex + 1}行和第${targetIndex + 1}行的图片信息`)

  draggingIndex.value = null
  dragPreviewPos.show = false
  dragImageUrl.value = ''
}

/**
 * 处理拖拽结束
 */
const handleDragEnd = () => {
  draggingIndex.value = null
  dragPreviewPos.show = false
  dragImageUrl.value = ''
  scrollIndicator.show = false
  scrollIndicator.direction = null
  // 清理全局监听
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('drop', handleGlobalDrop)
}

/**
 * 处理删除行
 * @param index 行索引
 */
const handleDeleteRow = async (index: number) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条数据吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    // 创建新数组触发更新
    const newData = [...tableData.value]
    newData.splice(index, 1)
    tableData.value = newData
    emit('delete', index)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消删除
  }
}

/**
 * 处理图片上传
 * @param uploadFile 上传的文件
 * @param index 行索引
 */
const handleImageChange = (uploadFile: UploadFile, index: number) => {
  // 验证文件类型
  const isImage = uploadFile.raw?.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('请上传图片文件')
    return
  }

  // 验证文件大小（最大5MB）
  const isLt5M = (uploadFile.size || 0) / 1024 / 1024 < 5
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过5MB')
    return
  }

  // 触发上传事件，由父组件处理
  if (uploadFile.raw) {
    emit('imageUpload', uploadFile, index)
  }
}

/**
 * 获取表格数据
 * @returns 当前表格数据
 */
const getTableData = () => {
  return tableData.value
}

/**
 * 设置表格数据
 * @param data 新的表格数据
 */
const setTableData = (data: ProductData[]) => {
  tableData.value = [...data]
}

/**
 * 添加新行
 * @param row 行数据
 */
const addRow = (row?: Partial<ProductData>) => {
  const newRow: ProductData = {
    sku: row?.sku || '',
    productName: row?.productName || '',
    length: row?.length,
    width: row?.width,
    height: row?.height,
    weight: row?.weight,
    purchaseCost: row?.purchaseCost,
    supplierLink: row?.supplierLink,
    supplier: row?.supplier,
    ukCustomsCode: row?.ukCustomsCode,
    cnDeclarationName: row?.cnDeclarationName,
    enDeclarationName: row?.enDeclarationName,
    fileCode: row?.fileCode,
    cosImageUrl: row?.cosImageUrl,
    imageUrl: row?.imageUrl
  }
  const newData = [...tableData.value, newRow]
  tableData.value = newData
}

// 暴露方法给父组件
defineExpose({
  getTableData,
  setTableData,
  addRow
})
</script>

<style scoped lang="scss">
.product-table-wrapper {
  .product-table {
    margin-bottom: 16px;

    .drag-column-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #909399;
      gap: 4px;
    }

    .drag-handle {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      color: #909399;
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        color: #409eff;
        background-color: #ecf5ff;
      }

      &.row-selected {
        background-color: #f0f9eb;
        border: 2px solid #67c23a;
      }

      &.row-selectable {
        &:hover {
          background-color: #ecf5ff;
          border: 2px solid #409eff;
        }
      }
    }

    .editable-cell {
      min-height: 24px;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s;

      &:hover {
        background-color: #f5f7fa;
      }
    }

    .link-cell {
      .supplier-link {
        color: #409eff;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .image-cell {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 60px;
      transition: all 0.2s;
      gap: 4px;

      &.row-highlight {
        .upload-trigger {
          box-shadow: 0 0 0 3px #67c23a;
        }
      }

      .view-image-btn {
        padding: 2px;
        margin: 0;

        &:hover {
          color: #409eff;
        }
      }

      .image-uploader {
        width: 100%;
        height: 100%;

        :deep(.el-upload) {
          display: block;
          width: 100%;
          height: 100%;
        }

        .upload-trigger {
          width: 60px;
          height: 60px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          border-radius: 4px;
          border: 1px dashed #d9d9d9;
          transition: border-color 0.3s;

          &:hover {
            border-color: #409eff;
          }

          .product-image {
            width: 60px;
            height: 60px;
            border-radius: 4px;
            border: none;

            &:hover {
              opacity: 0.8;
            }
          }

          .upload-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #409eff;
            font-size: 12px;

            .el-icon {
              font-size: 20px;
              margin-bottom: 4px;
            }
          }
        }
      }

      .image-error {
        width: 60px;
        height: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #f5f7fa;
        border-radius: 4px;
        color: #909399;
        font-size: 10px;

        .el-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }
      }
    }
  }

  .drag-image-preview {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    background-color: white;
    padding: 4px;

    img {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
      display: block;
    }
  }

  .scroll-indicator {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    background-color: rgba(64, 158, 255, 0.9);
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: pulse 1s ease-in-out infinite;

    &.scroll-up {
      top: 80px;
    }

    &.scroll-down {
      bottom: 80px;
    }

    .el-icon {
      animation: bounce 0.5s ease-in-out infinite alternate;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.9;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes bounce {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-5px);
    }
  }

  .drag-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #ecf5ff;
    border-radius: 4px;
    margin-bottom: 16px;
    color: #409eff;
    font-size: 13px;

    .el-icon {
      font-size: 14px;
    }
  }

  .table-footer {
    display: flex;
    justify-content: flex-end;
    padding: 8px 0;

    .total-count {
      font-size: 14px;
      color: #606266;
    }
  }
}

// 图片预览对话框样式
.image-preview-dialog {
  .preview-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
    padding: 20px;
  }

  .preview-image {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
</style>
