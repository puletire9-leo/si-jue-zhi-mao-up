<template>
  <el-dialog
    v-model="dialogVisible"
    title="批量导入素材"
    width="800px"
    :before-close="handleClose"
  >
    <div class="batch-import-dialog">
      <!-- 上传区域 -->
      <div class="upload-section">
        <!-- 素材上传 -->
        <div class="upload-item">
          <h4>素材上传</h4>
          <el-upload
            ref="uploadRef"
            :file-list="fileList"
            @update:file-list="handleFileListUpdate"
            action="#"
            list-type="text"
            :auto-upload="false"
            :multiple="true"
            :limit="100"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            :on-remove="handleRemove"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            class="upload-component"
            :drag="true"
          >
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，最大{{ imageSettings.maxImageSize }}MB</div>
          </el-upload>
        </div>
        
        <!-- 批量元素输入 -->
        <div class="batch-element-input">
          <h4>批量元素设置</h4>
          <div class="batch-element-tags-container">
            <el-tag
              v-for="(tag, index) in batchElementTags"
              :key="index"
              size="small"
              closable
              @close="removeBatchElement(index)"
              class="batch-element-tag"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-model="currentBatchElement"
              placeholder="请输入元素"
              size="small"
              @keyup.enter="addBatchElement"
              @blur="addBatchElementIfNotEmpty"
              style="flex: 1; min-width: 120px"
            >
              <template #append>
                <el-button
                  size="small"
                  @click="addBatchElement"
                  :disabled="!currentBatchElement.trim()"
                >
                  确认
                </el-button>
              </template>
            </el-input>
          </div>
          <div class="batch-element-input-row">
            <el-button
              type="primary"
              size="small"
              @click="applyBatchElement"
              :disabled="batchElementTags.length === 0 || importList.length === 0"
            >
              应用到所有素材
            </el-button>
          </div>
        </div>
      </div>

      <!-- 预览列表 -->
      <div v-if="importList.length > 0" class="preview-section">
        <h3>导入预览 ({{ importList.length }})</h3>
        <el-table :data="importList" stripe style="width: 100%">
          <el-table-column prop="designImage" label="素材" width="100" fixed="left">
            <template #default="{ row }">
              <el-image
                v-if="row.designImage && fileList[row.index]?.raw"
                :src="createObjectURL(fileList[row.index].raw)"
                fit="cover"
                style="width: 60px; height: 60px; border-radius: 4px; cursor: pointer;"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>暂无图片</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="filename" label="素材文件名" width="180" />
          <el-table-column prop="element" label="元素" width="300">
            <template #default="{ row }">
              <div class="element-cell">
                <!-- 标签输入区域 -->
                <div class="element-tags-container">
                  <el-tag
                    v-for="(tag, index) in row.elementTagsList"
                    :key="index"
                    size="small"
                    closable
                    @close="removeElementFromRow(row, index)"
                    class="element-tag"
                  >
                    {{ tag }}
                  </el-tag>
                  <el-input
                    v-model="row.currentElement"
                    placeholder="请输入元素"
                    size="small"
                    @keyup.enter="addElementToRow(row)"
                    @blur="addElementToRowIfNotEmpty(row)"
                    :disabled="row.analyzing"
                  >
                    <template #append>
                      <el-button
                        size="small"
                        @click="addElementToRow(row)"
                        :disabled="!row.currentElement.trim() || row.analyzing"
                      >
                        确认
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div v-if="row.analyzing" class="analyzing-status">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>AI分析中...</span>
                </div>
                <div v-else-if="row.elementTags && row.elementTags.length > 0" class="ai-tags">
                  <div class="ai-tags-tip">点击标签选择：</div>
                  <el-tag
                    v-for="tag in row.elementTags"
                    :key="tag.tag"
                    size="small"
                    type="success"
                    class="ai-tag clickable"
                    @click="() => selectTag(row, tag.tag)"
                  >
                    {{ tag.tag }} ({{ tag.confidence }}%)
                  </el-tag>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="() => reAnalyzeImage(row)"
                  >
                    重新分析
                  </el-button>
                </div>
                <div v-else-if="row.analyzed && row.elementTagsList.length === 0" class="no-result">
                  <span>未识别到元素</span>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="() => reAnalyzeImage(row)"
                  >
                    重新分析
                  </el-button>
                </div>
                <div v-else class="ai-analyze-btn">
                  <el-button
                    type="primary"
                    size="small"
                    @click="() => analyzeImageForRow(row)"
                  >
                    <el-icon><Search /></el-icon>
                    AI分析
                  </el-button>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="removeImportItem(row.index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 导入进度 -->
      <el-progress
        v-if="showProgress"
        :percentage="importProgress"
        :status="importStatus"
        :text-inside="true"
        :stroke-width="20"
        class="import-progress"
      >
        <template #format>
          {{ importProgress }}% {{ progressText }}
        </template>
      </el-progress>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          v-if="importList.length > 0"
          type="success"
          @click="batchAnalyzeImages"
          :loading="batchAnalyzing"
          :disabled="batchAnalyzing || importList.every(item => item.analyzed)"
        >
          <el-icon><Search /></el-icon>
          {{ batchAnalyzing ? 'AI分析中...' : '批量AI分析' }}
        </el-button>
        <el-button
          type="primary"
          @click="handleImport"
          :loading="submitting"
          :disabled="fileList.length === 0"
        >
          {{ submitting ? '导入中...' : '开始导入' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, type UploadProps, type UploadUserFile, type FormInstance } from 'element-plus'
import { Delete, Picture, Plus, Loading, Search } from '@element-plus/icons-vue'
// 导入API
import { materialLibraryApi } from '@/api/materialLibrary'
import { imageApi } from '@/api/image'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// 定义Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

// 响应式数据
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const uploadRef = ref()
const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const importList = ref<Array<{
  uid: string
  index: number
  filename: string
  element: string
  elementTagsList: string[]
  currentElement: string
  analyzing: boolean
  analyzed: boolean
  elementTags: Array<{ tag: string; confidence: number }>
  designImage?: { filename: string; url?: string; uid?: string }
}>>([])

// 批量元素输入
const batchElement = ref('')
const batchElementTags = ref<string[]>([])
const currentBatchElement = ref('')

// 图片设置
const imageSettings = reactive({
  maxImageSize: 10 // 默认10MB
})

// 批量AI分析状态
const batchAnalyzing = ref(false)

// 添加createObjectURL辅助函数，确保跨环境兼容
const createObjectURL = (file: File | Blob): string => {
  // 确保在所有环境中都能正确访问URL对象
  const urlApi = window.URL || window.webkitURL || (window as any).mozURL || (window as any).msURL;
  if (urlApi && typeof urlApi.createObjectURL === 'function') {
    return urlApi.createObjectURL(file);
  }
  // 如果所有方法都失败，返回一个默认的占位符URL
  return '';
};

// 导入进度相关
const showProgress = ref(false)
const importProgress = ref(0)
const importStatus = ref<'success' | 'exception' | 'warning'>()
const progressText = ref('')

// 方法
const resetForm = (): void => {
  fileList.value = []
  importList.value = []
  batchElement.value = ''
  batchElementTags.value = []
  currentBatchElement.value = ''
  showProgress.value = false
  importProgress.value = 0
  importStatus.value = undefined
  progressText.value = ''
}

// 更新导入列表
const updateImportList = (): void => {
  // 保存原有的导入列表到临时变量，避免在map过程中访问正在修改的数组
  const originalImportList = [...importList.value]

  importList.value = fileList.value.map((file, index) => {
    const filename = file.name || `image_${index}`
    const uid = String(file.uid || `uid_${Date.now()}_${index}`)

    // 查找是否已存在该文件的导入项，保留用户修改过的元素和分析结果
    // 使用uid作为唯一标识符，确保文件关联正确
    const existingItem = originalImportList.find(item =>
      item.uid === uid
    )

    const item = {
      uid,
      index,
      filename,
      element: existingItem?.element || '', // 保留用户修改的元素，默认为空
      elementTagsList: existingItem?.elementTagsList || (existingItem?.element ? existingItem.element.split(/\s+/).filter(t => t.trim()) : []),
      currentElement: existingItem?.currentElement || '',
      analyzing: false,
      analyzed: existingItem?.analyzed || false,
      elementTags: existingItem?.elementTags || [],
      designImage: {
        filename,
        url: createObjectURL(file.raw || new Blob()) // 创建临时URL用于预览
      }
    }

    // 注意：不再自动进行AI分析，需要用户手动点击"AI分析"按钮

    return item
  })
}

// 将 blob URL 转换为 base64
const blobToBase64 = (blobUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      const dataURL = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataURL)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = blobUrl
  })
}

// 分析单张图片的 AI 元素
const analyzeImageForRow = async (row: typeof importList.value[0]): Promise<void> => {
  if (!row.designImage?.url) return

  // 标记为分析中
  const itemIndex = importList.value.findIndex(item => item.uid === row.uid)
  if (itemIndex === -1) return

  importList.value[itemIndex].analyzing = true
  importList.value[itemIndex].analyzed = false

  try {
    // 判断是否为本地 blob URL
    let imageData: { image_url?: string; image_base64?: string } = {}
    
    if (row.designImage.url.startsWith('blob:')) {
      // 本地 blob URL，转换为 base64
      console.log('转换 blob URL 为 base64...')
      const base64 = await blobToBase64(row.designImage.url)
      imageData = { image_base64: base64 }
    } else {
      // 远程 URL
      imageData = { image_url: row.designImage.url }
    }

    // 调用 AI 分析 API
    const response = await materialLibraryApi.analyzeImage(
      imageData.image_url,
      imageData.image_base64
    )

    if (response.code === 200 && response.data) {
      const analysisResult = response.data

      // 更新分析结果 - 不再自动填入元素字段，让用户自己选择
      importList.value[itemIndex].elementTags = analysisResult.tags || []
      importList.value[itemIndex].analyzed = true

      console.log(`AI 分析完成: ${row.filename}`, analysisResult)
    } else {
      console.warn(`AI 分析失败: ${row.filename}`, response.message)
      importList.value[itemIndex].analyzed = true
    }
  } catch (error) {
    console.error(`AI 分析异常: ${row.filename}`, error)
    importList.value[itemIndex].analyzed = true
  } finally {
    importList.value[itemIndex].analyzing = false
  }
}

// 重新分析图片
const reAnalyzeImage = async (row: typeof importList.value[0]): Promise<void> => {
  await analyzeImageForRow(row)
}

/**
 * 更新行元素
 * @param row 行数据
 */
const updateRowElement = (row: typeof importList.value[0]) => {
  row.element = row.elementTagsList.join(' ')
}

/**
 * 添加元素到行
 * @param row 行数据
 */
const addElementToRow = (row: typeof importList.value[0]) => {
  const value = row.currentElement.trim()
  if (value && !row.elementTagsList.includes(value)) {
    row.elementTagsList.push(value)
    row.currentElement = ''
    updateRowElement(row)
  }
}

/**
 * 当输入框失去焦点时添加元素到行
 * @param row 行数据
 */
const addElementToRowIfNotEmpty = (row: typeof importList.value[0]) => {
  addElementToRow(row)
}

/**
 * 从行中删除元素
 * @param row 行数据
 * @param index 元素索引
 */
const removeElementFromRow = (row: typeof importList.value[0], index: number) => {
  row.elementTagsList.splice(index, 1)
  updateRowElement(row)
}

// 选择标签
const selectTag = (row: typeof importList.value[0], tag: string): void => {
  const itemIndex = importList.value.findIndex(item => item.uid === row.uid)
  if (itemIndex === -1) return

  // 将选中的标签添加到元素字段
  if (!row.elementTagsList.includes(tag)) {
    row.elementTagsList.push(tag)
    updateRowElement(row)
    ElMessage.success(`已选择标签: ${tag}`)
  }
}

// 批量分析所有图片
const batchAnalyzeImages = async (): Promise<void> => {
  if (importList.value.length === 0) {
    ElMessage.warning('请先上传图片')
    return
  }

  // 筛选出未分析的图片
  const unanalyzedItems = importList.value.filter(item => !item.analyzed && !item.analyzing)

  if (unanalyzedItems.length === 0) {
    ElMessage.info('所有图片已分析完成')
    return
  }

  batchAnalyzing.value = true
  ElMessage.info(`开始批量AI分析，共 ${unanalyzedItems.length} 张图片`)

  try {
    // 串行分析，避免并发过多请求
    for (const item of unanalyzedItems) {
      await analyzeImageForRow(item)
    }

    // 统计结果
    const analyzedCount = importList.value.filter(item => item.analyzed).length
    const withElementCount = importList.value.filter(item => item.element).length

    ElMessage.success(`批量AI分析完成！已分析 ${analyzedCount} 张图片，识别到元素 ${withElementCount} 张`)
  } catch (error) {
    console.error('批量AI分析失败:', error)
    ElMessage.error('批量AI分析失败，请重试')
  } finally {
    batchAnalyzing.value = false
  }
}

// 处理文件列表更新
const handleFileListUpdate = (newFileList: UploadUserFile[]) => {
  fileList.value = newFileList
  updateImportList()
}

const handleChange: UploadProps['onChange'] = (file, files) => {
  fileList.value = [...files]
  updateImportList()
}

const handleRemove: UploadProps['onRemove'] = (file, files) => {
  fileList.value = [...files]
  updateImportList()
}

// 处理元素输入变化
const handleElementInput = (row: { uid: string; index: number; filename: string; element: string }, value: string) => {
  // 确保元素更新被Vue检测到
  // 直接更新整个importList数组，确保Vue能够检测到变化
  importList.value = importList.value.map(item => {
    if (item.uid === row.uid) {
      return { ...item, element: value }
    }
    return item
  })
  console.log(`元素已更新: ${value} 对于文件: ${row.filename}`)
}

const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning('最多只能上传100张图片')
}

// 验证图片类型的函数
const validateImageType = (file: File): boolean => {
  const isJPGOrPNG = file.type === 'image/jpeg' || file.type === 'image/png'

  if (!isJPGOrPNG) {
    ElMessage.error('上传图片只能是 JPG/PNG 格式!')
    return false
  }
  return true
}

// 验证图片大小的函数
const validateImageSize = (file: File): boolean => {
  const isLtMaxSize = file.size / 1024 / 1024 < imageSettings.maxImageSize

  if (!isLtMaxSize) {
    ElMessage.error(`上传图片大小不能超过 ${imageSettings.maxImageSize}MB!`)
    return false
  }
  return true
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  return validateImageType(file) && validateImageSize(file)
}

// 自定义上传逻辑（这里只是模拟，实际上传在导入时处理）
const handleUpload: UploadProps['httpRequest'] = async (options) => {
  // 模拟上传过程
  await new Promise(resolve => setTimeout(resolve, 1000))

  const result = {
    url: URL.createObjectURL(options.file),
    name: options.file.name
  }

  options.onSuccess(result)
}

// 移除导入项
const removeImportItem = (index: number) => {
  fileList.value.splice(index, 1)
  updateImportList()
}

/**
 * 更新批量元素
 */
const updateBatchElement = () => {
  batchElement.value = batchElementTags.value.join(' ')
}

/**
 * 添加批量元素
 */
const addBatchElement = () => {
  const value = currentBatchElement.value.trim()
  if (value && !batchElementTags.value.includes(value)) {
    batchElementTags.value.push(value)
    currentBatchElement.value = ''
    updateBatchElement()
  }
}

/**
 * 当输入框失去焦点时添加批量元素
 */
const addBatchElementIfNotEmpty = () => {
  addBatchElement()
}

/**
 * 删除批量元素
 * @param index 元素索引
 */
const removeBatchElement = (index: number) => {
  batchElementTags.value.splice(index, 1)
  updateBatchElement()
}

// 应用批量元素到所有素材
const applyBatchElement = () => {
  if (batchElementTags.value.length === 0) {
    ElMessage.warning('请至少添加一个元素')
    return
  }
  
  if (importList.value.length === 0) {
    ElMessage.warning('请先上传素材')
    return
  }
  
  const elementValue = batchElementTags.value.join(' ')
  
  // 将批量元素应用到所有素材
  importList.value = importList.value.map(item => ({
    ...item,
    element: elementValue,
    elementTagsList: [...batchElementTags.value],
    currentElement: ''
  }))
  
  ElMessage.success(`已将元素 "${elementValue}" 应用到所有 ${importList.value.length} 个素材`)
}

// 单个文件上传
const uploadSingleImage = async (file: File): Promise<{ filename: string; url: string }> => {
  try {
    console.log(`开始上传单个图片: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    // 调用图片上传API，指定category为material
    const response = await imageApi.upload(file, 'material')

    console.log(`图片上传API响应 (${file.name}):`, response)

    // 统一成功响应的判断标准
    let success = false
    let url = ''
    let message = ''

    // 标准响应格式：{ code: 200, data: { url: 'xxx' } }
    if (response.code === 200) {
      // 检查data中的url
      if (response.data?.url) {
        success = true
        url = response.data.url
        message = response.message || '图片上传成功'
      }
      // 检查data中的cos_url
      else if ((response.data as any)?.cos_url) {
        success = true
        url = (response.data as any).cos_url
        message = response.message || '图片上传成功'
      }
      // 检查data中的filepath
      else if ((response.data as any)?.filepath) {
        success = true
        url = (response.data as any).filepath
        message = response.message || '图片上传成功'
      }
    }
    // 其他可能的成功响应格式
    else if ((response as any).success === true && ((response as any).url || (response.data as any)?.url)) {
      success = true
      url = (response as any).url || (response.data as any).url
      message = response.message || '图片上传成功'
    }

    if (success) {
      console.log(`图片上传成功 (${file.name}): ${message}, URL: ${url}`)
      return { filename: file.name, url }
    } else {
      // 构建准确的错误信息
      const errorMsg = response.message || '图片上传失败'
      console.error(`图片上传失败 (${file.name}): ${errorMsg}`)
      throw new Error(errorMsg)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '图片上传异常'
    console.error(`图片上传异常 (${file.name}):`, error)
    throw error
  }
}

// 批量上传图片 - 并发上传优化
const uploadImages = async (files: File[]): Promise<{ filename: string; url: string }[]> => {
  try {
    console.log(`开始批量上传图片，共 ${files.length} 个文件`)
    ElMessage.info({ message: '开始上传图片，请稍候...', duration: 2000 })

    // 并发上传配置
    const CONCURRENCY = 5
    const results: { filename: string; url: string }[] = []
    const errors: string[] = []

    // 分割文件数组为多个批次
    const batches = []
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      batches.push(files.slice(i, i + CONCURRENCY))
    }

    console.log(`批量上传图片批次划分: 共 ${batches.length} 个批次，每批次 ${CONCURRENCY} 个文件`)

    // 逐个批次上传
    let batchIndex = 1
    for (const batch of batches) {
      console.log(`开始上传批次 ${batchIndex}/${batches.length}，共 ${batch.length} 个文件`)

      // 并行上传当前批次的文件
      const batchResults = await Promise.allSettled(
        batch.map((file) => uploadSingleImage(file))
      )

      // 处理当前批次的结果
      batchResults.forEach((result, index) => {
        const file = batch[index]
        const fileName = file.name
        if (result.status === 'fulfilled') {
          // 检查返回值是否有效
          if (result.value && typeof result.value === 'object') {
            // 检查是否有有效的URL
            const url = result.value.url || result.value.cos_url || result.value.filepath
            if (url) {
              results.push({ filename: fileName, url })
              console.log(`批次 ${batchIndex} 文件 ${index + 1} 上传成功: ${fileName}，URL: ${url}`)
            } else {
              errors.push(fileName)
              console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 原因: 返回结果中没有有效的URL`)
            }
          } else {
            errors.push(fileName)
            console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 原因: 返回结果无效`)
          }
        } else {
          errors.push(fileName)
          console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 错误:`, result.reason)
        }
      })

      batchIndex++

      // 更新进度
      const uploadedCount = results.length + errors.length
      const progress = Math.round((uploadedCount / files.length) * 100)
      importProgress.value = Math.min(30, Math.round(progress * 0.3))
      progressText.value = `正在上传图片... ${uploadedCount}/${files.length}`
      console.log(`批量上传进度: ${uploadedCount}/${files.length} (${progress}%)`)
    }

    console.log(`批量上传完成: 成功 ${results.length} 个，失败 ${errors.length} 个`)

    // 检查是否有成功上传的文件
    if (results.length === 0) {
      console.error('批量上传失败: 没有文件上传成功')
      throw new Error(`批量上传失败: 没有文件上传成功，失败文件: ${errors.join(', ')}`)
    }

    // 显示上传结果
    if (errors.length > 0) {
      console.log(`批量上传结果: 部分成功，成功 ${results.length} 个，失败 ${errors.length} 个，失败文件:`, errors)
      ElMessage.warning(`图片上传完成: 成功 ${results.length} 个，失败 ${errors.length} 个`)
    } else {
      console.log(`批量上传结果: 全部成功，共 ${results.length} 个文件`)
      ElMessage.success(`图片上传成功: ${results.length} 个`)
    }

    return results
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '批量上传失败'
    console.error('批量上传图片异常:', error)
    ElMessage.error({ message: `图片上传失败: ${errorMsg}`, duration: 5000 })
    throw error
  }
}

// 开始导入
const handleImport = async (): Promise<void> => {
  console.log('开始执行批量导入操作')

  if (fileList.value.length === 0) {
    console.log('批量导入取消：未选择图片')
    ElMessage.warning('请先选择要导入的图片')
    return
  }

  try {
    console.log(`开始批量导入，共 ${fileList.value.length} 个素材文件`)
    submitting.value = true

    // 初始化进度条
    showProgress.value = true
    importProgress.value = 0
    importStatus.value = undefined
    progressText.value = '准备导入...'

    // 分离已上传的文件和待上传的文件
    console.log('分离需要上传的素材文件')
    const designFiles: File[] = []
    for (const file of fileList.value) {
      if (file.raw) {
        designFiles.push(file.raw)
        console.log(`添加素材文件到上传列表: ${file.name}`)
      } else {
        console.warn(`素材文件缺少raw数据: ${file.name}`)
      }
    }

    console.log(`素材文件分离完成，共 ${designFiles.length} 个文件需要上传`)

    if (designFiles.length === 0) {
      console.error('没有需要上传的素材文件')
      ElMessage.warning('没有需要上传的文件')
      submitting.value = false
      return
    }

    // 定义上传结果类型
    interface UploadResult {
      filename: string
      url: string
    }

    let uploadedDesignUrls: UploadResult[] = []

    // 第一步：上传素材图片
    console.log(`开始上传素材图片，共 ${designFiles.length} 个文件`)
    progressText.value = '正在上传素材...'
    uploadedDesignUrls = await uploadImages(designFiles)
    console.log(`素材图片上传完成，成功 ${uploadedDesignUrls.length} 个，失败 ${designFiles.length - uploadedDesignUrls.length} 个`)
    importProgress.value = 50

    // 第二步：批量创建素材
    console.log('开始批量创建素材')
    progressText.value = '正在创建素材...'

    // 验证导入列表数据 - 元素必填
    for (const item of importList.value) {
      if (!item.element || item.element.trim() === '') {
        throw new Error(`元素不能为空，文件：${item.filename}`)
      }
    }

    // 将上传结果转换为Map，使用文件名作为键，确保文件与URL正确对应
    const designUrlMap = new Map<string, string>()
    uploadedDesignUrls.forEach(result => {
      designUrlMap.set(result.filename, result.url)
    })

    // 准备批量创建请求数据 - 只处理上传成功的文件
    console.log('准备批量创建素材数据')
    const materialDataList = importList.value
      .filter(item => designUrlMap.has(item.filename)) // 只处理上传成功的文件
      .map(item => {
        const designUrl = designUrlMap.get(item.filename)
        console.log(`添加素材数据: 文件名=${item.filename}, 元素=${item.element}, 素材URL=${designUrl}`)
        return {
          element: item.element, // 使用用户修改后的元素值
          images: [designUrl!] // 从Map中获取对应的URL
        }
      })

    console.log(`素材数据准备完成，共 ${materialDataList.length} 个素材数据`)

    if (materialDataList.length === 0) {
      console.error('没有可创建的素材数据，上传成功的文件数:', uploadedDesignUrls.length, '导入列表长度:', importList.value.length)
      throw new Error('没有可创建的素材数据')
    }

    // 调用批量创建API - 添加进度更新
    importProgress.value = 70
    progressText.value = '正在创建素材... 70%'

    // 调用批量创建API
    const response = await materialLibraryApi.batchCreate(materialDataList)
    console.log('批量创建素材API响应:', response)

    importProgress.value = 100
    importStatus.value = 'success'
    progressText.value = '导入完成'

    ElMessage.success(`批量导入成功: ${materialDataList.length} 个素材`)

    // 触发成功事件
    emit('success')

    // 关闭对话框
    handleClose()
  } catch (error) {
    importStatus.value = 'exception'
    const errorMsg = error instanceof Error ? error.message : '批量导入失败'
    console.error('批量导入素材异常:', error)
    ElMessage.error({ message: `批量导入失败: ${errorMsg}`, duration: 5000 })
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  resetForm()
  dialogVisible.value = false
}

// 组件挂载时重置表单
onMounted(() => {
  resetForm()
})

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理创建的临时URL
  importList.value.forEach(item => {
    if (item.designImage?.url && item.designImage.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.designImage.url)
    }
  })
})
</script>

<style scoped lang="scss">
.batch-import-dialog {
  padding: 20px 0;

  .upload-section {
    margin-bottom: 20px;

    .upload-item {
      h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #606266;
      }
    }
    
    .batch-element-input {
        margin-top: 20px;
        padding: 15px;
        background-color: #f5f7fa;
        border-radius: 8px;
        
        h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #606266;
        }
        
        .batch-element-tags-container {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border: 1px solid #dcdfe6;
          border-radius: 4px;
          min-height: 32px;
          margin-bottom: 10px;
          
          .batch-element-tag {
            margin-right: 8px;
          }
        }
        
        .batch-element-input-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }
      }
  }

  .preview-section {
    margin-top: 20px;

    h3 {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #303133;
    }
  }

  .element-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .element-tags-container {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      min-height: 32px;
      
      .element-tag {
        margin-right: 8px;
      }
    }

    .analyzing-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #409eff;
    }

    .ai-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;

      .ai-tags-tip {
        width: 100%;
        font-size: 12px;
        color: #909399;
        margin-bottom: 4px;
      }

      .ai-tag {
        margin-right: 2px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        &.clickable {
          cursor: pointer;
        }
      }
    }

    .no-result {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #909399;
    }

    .ai-analyze-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;

      .el-button {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }

  .import-progress {
    margin-top: 20px;
  }

  .image-error {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f7fa;
    border-radius: 4px;
    color: #909399;
  }

  .image-placeholder {
    width: 60px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #f5f7fa;
    border-radius: 4px;
    color: #909399;
    font-size: 12px;

    span {
      margin-top: 4px;
    }
  }
}

:deep(.upload-component) {
  .el-upload-dragger {
    width: 100%;
    height: 180px;
  }

  .upload-icon {
    font-size: 48px;
    color: #409eff;
    margin-bottom: 10px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
