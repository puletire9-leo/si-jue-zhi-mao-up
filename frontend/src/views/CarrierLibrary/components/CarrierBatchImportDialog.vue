<template>
  <el-dialog
    v-model="dialogVisible"
    title="批量导入载体"
    width="800px"
    :before-close="handleClose"
  >
    <div class="batch-import-dialog">
      <!-- 上传区域 -->
      <div class="upload-section">
        <!-- 载体上传 -->
        <div class="upload-item">
          <h4>载体上传</h4>
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
        

      </div>
      
      <!-- 导入设置 -->
      <div class="settings-section">
        <!-- 载体名称 -->
        <el-form-item label="载体名称" prop="carrier_name">
          <el-input
            v-model="settings.carrier_name"
            placeholder="请输入载体名称，例如：帆布袋"
            clearable
          />
        </el-form-item>
      </div>
      
      <!-- 预览列表 -->
      <div v-if="importList.length > 0" class="preview-section">
        <h3>导入预览 ({{ importList.length }})</h3>
        <el-table :data="importList" stripe style="width: 100%">
          <el-table-column prop="designImage" label="载体" width="100" fixed="left">
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
          <el-table-column prop="filename" label="载体文件名" width="180" />
          <el-table-column prop="carrier_name" label="载体名称" width="200">
            <template #default="{ row }">
              <el-input
                v-model="row.carrier_name"
                placeholder="请输入载体名称"
                size="small"
              />
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
import { UploadFilled, Delete, Picture, Plus, Check, User, Van } from '@element-plus/icons-vue'
// 导入API
import { carrierLibraryApi } from '@/api/carrierLibrary'
import { imageApi } from '@/api/image'
import { systemConfigApi } from '@/api/systemConfig'
// 导入用户存储
import { useUserStore } from '@/stores/user'

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

// 用户存储实例
const userStore = useUserStore()

const uploadRef = ref()
const referenceUploadRef = ref()
const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const referenceFileList = ref<UploadUserFile[]>([])
const importList = ref<Array<{ uid: string; index: number; sku: string; filename: string; product_size: string; carrier_name: string; material: string; process: string; weight: number | undefined; packaging_method: string; packaging_size: string; price: number | undefined; min_order_quantity: number | undefined; supplier: string; supplier_link: string; designImage?: { filename: string; url?: string; uid?: string }; referenceImage?: { filename: string; url?: string; uid?: string } }>>([])

// 状态映射
const statusMap = {
  concept: '构思',
  optimizing: '未完成在优化',
  finalized: '已定稿'
}

// 图片设置
const imageSettings = reactive({
  maxImageSize: 10 // 默认10MB
})

// 导入设置
const settings = reactive({
  carrier_name: ''
})

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

// 当前正在编辑参考图的索引
const editingReferenceIndex = ref<number | null>(null)

// 方法
const resetForm = (): void => {
  fileList.value = []
  referenceFileList.value = []
  importList.value = []
  settings.carrier_name = ''
  showProgress.value = false
  importProgress.value = 0
  importStatus.value = undefined
  progressText.value = ''
  editingReferenceIndex.value = null // 重置正在编辑的参考图索引
}

// 从文件名提取SKU（去除文件扩展名）
const extractSkuFromFilename = (filename: string): string => {
  // 去除文件扩展名
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex)
  }
  return filename
}

// 更新导入列表
const updateImportList = (): void => {
  // 保存原有的导入列表到临时变量，避免在map过程中访问正在修改的数组
  const originalImportList = [...importList.value]
  
  importList.value = fileList.value.map((file, index) => {
    const filename = file.name || `image_${index}`
    const uid = String(file.uid || `uid_${Date.now()}_${index}`)
    
    // 查找是否已存在该文件的导入项，保留用户修改过的载体名称
    // 使用uid作为唯一标识符，确保文件关联正确
    const existingItem = originalImportList.find(item => 
      item.uid === uid
    )
    
    return {
      uid,
      index,
      sku: existingItem?.sku || extractSkuFromFilename(filename), // 保留sku用于兼容
      filename,
      carrier_name: existingItem?.carrier_name || settings.carrier_name || extractSkuFromFilename(filename),
      designImage: {
        filename,
        url: createObjectURL(file.raw || new Blob()) // 创建临时URL用于预览
      },
      referenceImage: existingItem?.referenceImage // 保留已关联的参考图
    }
  })
  
  // 触发参考图匹配
  matchReferenceImages()
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

// 处理参考图文件列表更新
const handleReferenceFileListUpdate = (newFileList: UploadUserFile[]) => {
  referenceFileList.value = newFileList
  matchReferenceImages()
}

// 处理参考图文件变化
const handleReferenceChange: UploadProps['onChange'] = (file, files) => {
  referenceFileList.value = [...files]
  
  // 如果有正在编辑的参考图索引，直接将新上传的图片关联到对应的载体行
  if (editingReferenceIndex.value !== null && file.status === 'ready') {
    const index = editingReferenceIndex.value
    if (importList.value[index]) {
      importList.value[index].referenceImage = {
        filename: file.name || '',
        url: createObjectURL(file.raw || new Blob()),
        uid: String(file.uid)
      }
      // 重置正在编辑的索引
      editingReferenceIndex.value = null
      return
    }
  }
  
  // 否则，使用正常的匹配机制
  matchReferenceImages()
}

// 处理参考图文件移除
const handleReferenceRemove: UploadProps['onRemove'] = (file, files) => {
  referenceFileList.value = [...files]
  matchReferenceImages()
}

// 效果图匹配逻辑 - 实现模糊匹配
const matchReferenceImages = () => {
  if (importList.value.length === 0 || referenceFileList.value.length === 0) {
    return
  }
  
  // 创建一个已匹配的效果图文件集合，避免重复匹配
  const matchedFiles = new Set<string>()
  
  // 遍历载体，匹配对应的效果图
  importList.value = importList.value.map(item => {
    const carrierName = item.carrier_name || item.sku || extractSkuFromFilename(item.filename)
    
    // 1. 先尝试完全匹配，确保匹配的准确性
    let matchingReference = referenceFileList.value.find(refFile => {
      const refFilename = refFile.name || ''
      const refCarrierName = extractSkuFromFilename(refFilename)
      return refCarrierName === carrierName && !matchedFiles.has(String(refFile.uid))
    })
    
    // 2. 如果没有完全匹配的，再尝试模糊匹配
    if (!matchingReference) {
      matchingReference = referenceFileList.value.find(refFile => {
        const refFilename = refFile.name || ''
        const refCarrierName = extractSkuFromFilename(refFilename)
        // 双向包含匹配，忽略大小写
        const lowerCaseRefCarrierName = refCarrierName.toLowerCase()
        const lowerCaseItemCarrierName = carrierName.toLowerCase()
        return (lowerCaseRefCarrierName.includes(lowerCaseItemCarrierName) || lowerCaseItemCarrierName.includes(lowerCaseRefCarrierName)) && !matchedFiles.has(String(refFile.uid))
      })
    }
    
    if (matchingReference) {
      // 标记该效果图文件已匹配
      matchedFiles.add(String(matchingReference.uid))
      return {
        ...item,
        referenceImage: {
          filename: matchingReference.name || '',
          url: createObjectURL(matchingReference.raw || new Blob()), // 创建临时URL用于预览
          uid: String(matchingReference.uid) // 保存效果图文件的uid，用于后续删除操作
        }
      }
    }
    
    // 如果没有匹配到效果图，则保留当前状态（如果是undefined，说明用户明确删除了）
    return item
  })
}

// 检查导入列表中是否存在重复载体名称
const checkDuplicateCarrierNameInImportList = (): string[] => {
  const carrierNameMap = new Map<string, string[]>()
  const duplicates: string[] = []
  
  importList.value.forEach(item => {
    const carrierName = item.carrier_name || settings.carrier_name || item.sku || item.filename.replace(/\.[^/.]+$/, '')
    if (carrierName) {
      if (carrierNameMap.has(carrierName)) {
        carrierNameMap.get(carrierName)?.push(item.filename)
      } else {
        carrierNameMap.set(carrierName, [item.filename])
      }
    }
  })
  
  // 找出重复的载体名称
  carrierNameMap.forEach((files, carrierName) => {
    if (files.length > 1) {
      duplicates.push(carrierName)
    }
  })
  
  return duplicates
}



// 监听设置变化，实时更新预览列表
watch(
  () => settings,
  () => {
    importList.value = importList.value.map(item => ({
      ...item,
      carrier_name: item.carrier_name || settings.carrier_name
    }))
  },
  { deep: true }
)

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

// 移除效果图
const removeReferenceImage = (index: number) => {
  // 从导入列表中移除对应项的效果图
  if (importList.value[index]) {
    const referenceImage = importList.value[index].referenceImage
    // 从referenceFileList中移除对应的文件
    if (referenceImage?.uid) {
      const fileIndex = referenceFileList.value.findIndex(file => String(file.uid) === referenceImage.uid)
      if (fileIndex > -1) {
        referenceFileList.value.splice(fileIndex, 1)
      }
    }
    // 移除导入列表中的效果图引用
    importList.value[index].referenceImage = undefined
    // 重新匹配效果图
    matchReferenceImages()
    ElMessage.success('效果图已删除')
  }
}

// 点击效果图，触发上传新图
const handleReferenceImageClick = (index: number) => {
  // 设置当前正在编辑的效果图索引
  editingReferenceIndex.value = index
  // 触发效果图上传组件的文件选择对话框
  if (referenceUploadRef.value) {
    (referenceUploadRef.value as any).$el.querySelector('.el-upload__input')?.click()
  }
}

// 处理效果图删除
const handleReferenceImageRemove = (index: number) => {
  // 从导入列表中移除对应项的效果图
  if (importList.value[index]) {
    const referenceImage = importList.value[index].referenceImage
    // 从referenceFileList中移除对应的文件
    if (referenceImage?.uid) {
      const fileIndex = referenceFileList.value.findIndex(file => String(file.uid) === referenceImage.uid)
      if (fileIndex > -1) {
        referenceFileList.value.splice(fileIndex, 1)
      }
    }
    // 移除导入列表中的效果图引用
    importList.value[index].referenceImage = undefined
    // 重新匹配效果图
    matchReferenceImages()
    ElMessage.success('效果图已删除')
  }
}

// 单个文件上传
const uploadSingleImage = async (file: File, sku: string): Promise<{ filename: string; url: string }> => {
  try {
    console.log(`开始上传单个图片: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB, SKU: ${sku}`)
    // 调用图片上传API，指定category为carrier，并传递sku参数
    const response = await imageApi.upload(file, 'carrier', sku)
    
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

// 定义文件-载体名称映射类型
interface FileWithCarrierName {
  file: File
  carrierName: string
}

// 批量上传图片 - 并发上传优化
const uploadImages = async (filePairs: FileWithCarrierName[]): Promise<{ filename: string; url: string }[]> => {
  try {
    console.log(`开始批量上传图片，共 ${filePairs.length} 个文件`)
    ElMessage.info({ message: '开始上传图片，请稍候...', duration: 2000 })
    
    // 并发上传配置
    const CONCURRENCY = 5
    const results: { filename: string; url: string }[] = []
    const errors: string[] = []
    
    // 分割文件数组为多个批次
    const batches = []
    for (let i = 0; i < filePairs.length; i += CONCURRENCY) {
      batches.push(filePairs.slice(i, i + CONCURRENCY))
    }
    
    console.log(`批量上传图片批次划分: 共 ${batches.length} 个批次，每批次 ${CONCURRENCY} 个文件`)
    
    // 逐个批次上传
    let batchIndex = 1
    for (const batch of batches) {
      console.log(`开始上传批次 ${batchIndex}/${batches.length}，共 ${batch.length} 个文件`)
      
      // 并行上传当前批次的文件，传递对应的载体名称
      const batchResults = await Promise.allSettled(
        batch.map(({ file, carrierName }) => uploadSingleImage(file, carrierName))
      )
      
      // 处理当前批次的结果
      batchResults.forEach((result, index) => {
        const { file, carrierName } = batch[index]
        const fileName = file.name
        if (result.status === 'fulfilled') {
          // 检查返回值是否有效
          if (result.value && typeof result.value === 'object') {
            // 检查是否有有效的URL
            const url = result.value.url || result.value.cos_url || result.value.filepath
            if (url) {
              results.push({ filename: fileName, url })
              console.log(`批次 ${batchIndex} 文件 ${index + 1} 上传成功: ${fileName}，载体名称: ${carrierName}，URL: ${url}`)
            } else {
              errors.push(fileName)
              console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 载体名称: ${carrierName}, 原因: 返回结果中没有有效的URL`)
            }
          } else {
            errors.push(fileName)
            console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 载体名称: ${carrierName}, 原因: 返回结果无效`)
          }
        } else {
          errors.push(fileName)
          console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, 载体名称: ${carrierName}, 错误:`, result.reason)
        }
      })
      
      batchIndex++
      
      // 更新进度
      const uploadedCount = results.length + errors.length
      const progress = Math.round((uploadedCount / filePairs.length) * 100)
      importProgress.value = Math.min(30, Math.round(progress * 0.3))
      progressText.value = `正在上传图片... ${uploadedCount}/${filePairs.length}`
      console.log(`批量上传进度: ${uploadedCount}/${filePairs.length} (${progress}%)`)
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
    console.log(`开始批量导入，共 ${fileList.value.length} 个载体文件`)
    submitting.value = true
    
    // 初始化进度条
    showProgress.value = true
    importProgress.value = 0
    importStatus.value = undefined
    progressText.value = '准备导入...'
    
    // 检查导入列表中是否存在重复载体名称
    console.log('检查导入列表中是否存在重复载体名称')
    const duplicateCarrierNames = checkDuplicateCarrierNameInImportList()
    if (duplicateCarrierNames.length > 0) {
      console.error('导入列表中存在重复载体名称:', duplicateCarrierNames)
      throw new Error(`导入列表中存在重复载体名称：${duplicateCarrierNames.join(', ')}`)
    }
    
    // 分离已上传的文件和待上传的文件
    console.log('分离需要上传的载体文件')
    const designFilePairs: { file: File; carrierName: string }[] = []
    for (const file of fileList.value) {
      if (file.raw) {
        // 查找对应文件的载体名称信息
        const importItem = importList.value.find(item => item.filename === file.name)
        const carrierName = importItem?.carrier_name || settings.carrier_name || importItem?.sku || extractSkuFromFilename(file.name)
        designFilePairs.push({ file: file.raw, carrierName })
        console.log(`添加载体文件到上传列表: ${file.name}，载体名称: ${carrierName}`)
      } else {
        console.warn(`载体文件缺少raw数据: ${file.name}`)
      }
    }
    
    console.log(`载体文件分离完成，共 ${designFilePairs.length} 个文件需要上传`)
    
    if (designFilePairs.length === 0) {
      console.error('没有需要上传的载体文件')
      ElMessage.warning('没有需要上传的文件')
      submitting.value = false
      return
    }
    
    // 分离需要上传的效果图文件
    console.log('分离需要上传的效果图文件')
    const referenceFilePairs: { file: File; carrierName: string }[] = []
    let referenceMatchCount = 0
    let referenceFailCount = 0
    
    for (const item of importList.value) {
      if (item.referenceImage) {
        // 使用uid进行更可靠的匹配，而不是仅依赖文件名
        const matchingReferenceFile = referenceFileList.value.find(refFile => 
          String(refFile.uid) === String(item.referenceImage?.uid)
        )
        const carrierName = item.carrier_name || settings.carrier_name || item.sku || item.filename.replace(/\.[^/.]+$/, '')
        if (matchingReferenceFile && matchingReferenceFile.raw) {
          referenceFilePairs.push({ file: matchingReferenceFile.raw, carrierName })
          referenceMatchCount++
          console.log(`效果图匹配成功（通过uid）: ${item.referenceImage?.filename}，载体名称: ${carrierName}`)
        } else {
          // 如果uid匹配失败，尝试使用文件名匹配作为备选方案
          const altMatchingFile = referenceFileList.value.find(refFile => 
            refFile.name === item.referenceImage?.filename
          )
          if (altMatchingFile && altMatchingFile.raw) {
            referenceFilePairs.push({ file: altMatchingFile.raw, carrierName })
            referenceMatchCount++
            console.log(`效果图匹配成功（通过文件名）: ${item.referenceImage?.filename}，载体名称: ${carrierName}`)
          } else {
            referenceFailCount++
            console.warn(`效果图匹配失败: ${item.referenceImage?.filename}`)
          }
        }
      }
    }
    
    console.log(`效果图文件分离完成，共 ${referenceFilePairs.length} 个文件需要上传，匹配成功 ${referenceMatchCount} 个，失败 ${referenceFailCount} 个`)
    
    // 定义上传结果类型
    interface UploadResult {
      filename: string
      url: string
    }
    
    let uploadedDesignUrls: UploadResult[] = []
    let uploadedReferenceUrls: UploadResult[] = []
    
    // 第一步：上传载体图片
    console.log(`开始上传载体图片，共 ${designFilePairs.length} 个文件`)
    progressText.value = '正在上传载体...'
    uploadedDesignUrls = await uploadImages(designFilePairs)
    console.log(`载体图片上传完成，成功 ${uploadedDesignUrls.length} 个，失败 ${designFilePairs.length - uploadedDesignUrls.length} 个`)
    importProgress.value = 30
    
    // 第二步：上传效果图图片（如果有）
    if (referenceFilePairs.length > 0) {
      console.log(`开始上传效果图图片，共 ${referenceFilePairs.length} 个文件`)
      progressText.value = '正在上传效果图...'
      uploadedReferenceUrls = await uploadImages(referenceFilePairs)
      console.log(`效果图图片上传完成，成功 ${uploadedReferenceUrls.length} 个，失败 ${referenceFilePairs.length - uploadedReferenceUrls.length} 个`)
      importProgress.value = 50
    } else {
      console.log('无效果图需要上传')
    }
    
    // 第三步：批量创建载体
    console.log('开始批量创建载体')
    progressText.value = '正在创建载体...'
    
    // 验证导入列表数据 - 检查载体名称（使用文件名或用户输入作为载体名称）
    for (const item of importList.value) {
      const carrierName = item.carrier_name || settings.carrier_name || item.sku || item.filename.replace(/\.[^/.]+$/, '')
      if (!carrierName) {
        throw new Error(`载体名称不能为空，文件：${item.filename}`)
      }
    }
    
    // 将上传结果转换为Map，使用文件名作为键，确保文件与URL正确对应
    const designUrlMap = new Map<string, string>()
    uploadedDesignUrls.forEach(result => {
      designUrlMap.set(result.filename, result.url)
    })
    
    // 准备参考图URL映射 - 使用载体文件名作为键，确保参考图与载体正确关联
    const referenceUrlMap = new Map<string, string>()
    let refIndex = 0
    for (const item of importList.value) {
      if (item.referenceImage && refIndex < uploadedReferenceUrls.length) {
        // 使用载体文件名作为键，确保参考图与载体正确关联
        referenceUrlMap.set(item.filename, uploadedReferenceUrls[refIndex].url)
        refIndex++
      }
    }
    
    // 准备批量创建请求数据 - 只处理上传成功的文件
    console.log('准备批量创建载体数据')
    const carrierDataList = importList.value
      .filter(item => designUrlMap.has(item.filename)) // 只处理上传成功的文件
      .map(item => {
        const designUrl = designUrlMap.get(item.filename)
        const carrierName = item.carrier_name || settings.carrier_name || item.sku || item.filename.replace(/\.[^/.]+$/, '')
        console.log(`添加载体数据: carrier_name=${carrierName}, 文件名=${item.filename}, 载体URL=${designUrl}`)
        return {
          carrier_name: carrierName, // 使用载体名称作为唯一标识
          images: [designUrl!] // 从Map中获取对应的URL
        }
      })
    
    console.log(`载体数据准备完成，共 ${carrierDataList.length} 个载体数据`)
    
    if (carrierDataList.length === 0) {
      console.error('没有可创建的载体数据，上传成功的文件数:', uploadedDesignUrls.length, '导入列表长度:', importList.value.length)
      throw new Error('没有可创建的载体数据')
    }
    
    // 调用批量创建API - 添加进度更新
    importProgress.value = referenceFilePairs.length > 0 ? 70 : 50
    progressText.value = '正在创建载体... 70%'
    
    // 添加进度更新定时器
    const progressInterval = setInterval(() => {
      if (importProgress.value < 85) {
        importProgress.value += 5
        progressText.value = `正在创建载体... ${importProgress.value}%`
      }
    }, 500)
    
    // 调用批量创建API
    console.log('调用批量创建载体API，共提交', carrierDataList.length, '个载体数据')
    const createResponse = await carrierLibraryApi.batchCreate(carrierDataList)
    console.log('批量创建载体API响应:', createResponse)
    
    // 清除进度定时器
    clearInterval(progressInterval)
    
    // 更新进度到90%
    importProgress.value = 90
    progressText.value = '载体创建完成，正在处理结果... 90%'
    
    if (createResponse.code === 200) {
      console.log('批量创建载体API调用成功')
      // 更新进度到100%
      importProgress.value = 100
      progressText.value = '导入完成！100%'
      importStatus.value = 'success'
      
      // 解析错误信息，提取已存在的SKU
      const existingSkus: string[] = []
      if (createResponse.data?.errors && Array.isArray(createResponse.data.errors)) {
        createResponse.data.errors.forEach(error => {
          // 提取已存在的SKU信息（根据后端返回的错误信息格式）
          const skuMatch = error.match(/SKU\s+([^\s]+)\s+已存在/)
          if (skuMatch && skuMatch[1]) {
            existingSkus.push(skuMatch[1])
          } else {
            // 如果没有匹配到SKU，直接显示错误信息
            existingSkus.push(error)
          }
        })
      }
      
      // 根据导入结果显示不同的提示信息
      const successCount = createResponse.data?.success || 0
      const failedCount = createResponse.data?.failed || 0
      
      if (successCount === 0 && failedCount > 0) {
        // 全部导入失败
        if (existingSkus.length > 0) {
          ElMessage.error({
            message: `导入失败：${failedCount} 个载体创建失败，原因：${existingSkus.join('; ')}，请修改后重新导入`,
            duration: 8000
          })
        } else {
          ElMessage.error({
            message: `批量导入失败，${failedCount} 个载体创建失败，请修改后重新导入`,
            duration: 5000
          })
        }
        
        // 全部导入失败，不关闭对话框，留在页面供用户修改
        submitting.value = false
      } else if (successCount > 0 && failedCount > 0) {
        // 部分导入失败
        if (existingSkus.length > 0) {
          ElMessage.warning({
            message: `成功导入 ${successCount} 个载体，${failedCount} 个创建失败（原因：${existingSkus.join('; ')}），请修改后重新导入`,
            duration: 8000
          })
        } else {
          ElMessage.warning({
            message: `成功导入 ${successCount} 个载体，${failedCount} 个创建失败，请修改后重新导入`,
            duration: 5000
          })
        }
        
        // 部分导入失败，不关闭对话框，留在页面供用户修改
        submitting.value = false
      } else {
        // 全部导入成功
        ElMessage.success({
          message: `成功导入 ${successCount || 0} 个载体`,
          duration: 5000
        })
        
        // 导入成功，设置submitting为false
        submitting.value = false
        
        // 3秒后关闭对话框
        setTimeout(() => {
          emit('success')
          handleClose()
        }, 3000)
      }
    } else {
      throw new Error(createResponse.message || '批量创建载体失败')
    }
  } catch (error) {
    console.error('批量导入失败:', error)
    
    // 更新进度条状态为异常
    importStatus.value = 'exception'
    importProgress.value = 100
    progressText.value = '导入失败！'
    
    const errorMsg = error instanceof Error ? error.message : '导入失败'
    
    // 根据错误类型显示不同的提示信息
    let displayErrorMsg = errorMsg
    
    // 移除可能存在的重复前缀，确保错误信息清晰
    displayErrorMsg = displayErrorMsg.replace(/^图片上传失败: /g, '')
    displayErrorMsg = displayErrorMsg.replace(/^批量上传失败: /g, '')
    displayErrorMsg = displayErrorMsg.replace(/^导入失败: /g, '')
    
    // 统一错误信息显示逻辑
    let errorMessage = ''
    let duration = 5000
    
    if (displayErrorMsg.includes('重复载体名称')) {
      // 重复载体名称错误
      errorMessage = displayErrorMsg + '，请修改后重新导入'
      duration = 8000
    } else if (displayErrorMsg.includes('载体名称不能为空')) {
      // 载体名称为空错误
      errorMessage = displayErrorMsg
    } else if (displayErrorMsg.includes('已存在')) {
      // 载体名称已存在错误
      errorMessage = displayErrorMsg + '，请修改后重新导入'
      duration = 8000
    } else {
      // 其他错误
      errorMessage = `导入失败：${displayErrorMsg}`
    }
    
    ElMessage.error({ message: errorMessage, duration })
    
    // 设置submitting为false
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = (): void => {
  resetForm()
  emit('update:modelValue', false)
}
</script>

<style scoped>
.batch-import-dialog {
  max-height: 600px;
  overflow-y: auto;
}

.upload-section {
  margin-bottom: 20px;
}

.upload-item {
  margin-bottom: 15px;
}

.upload-item h4 {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: bold;
}

.upload-component {
  margin-bottom: 10px;
}

.settings-section {
  margin-bottom: 20px;
}

.date-picker {
  width: 100%;
}

.developer-input-wrapper {
  display: flex;
  align-items: center;
}

.developer-input {
  flex: 1;
  margin-right: 10px;
}

.developer-select-btn {
  flex-shrink: 0;
}

.carrier-select-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 10px;
  height: 40px;
  cursor: pointer;
}

.carrier-display {
  flex: 1;
  color: #606266;
}

.carrier-select-btn {
  flex-shrink: 0;
}

.preview-section {
  margin-bottom: 20px;
}

.preview-section h3 {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: bold;
}

.image-container {
  position: relative;
  display: inline-block;
}

.image-wrapper {
  position: relative;
}

.remove-reference-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: 1;
}

.image-error {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border: 1px dashed #c0c4cc;
  border-radius: 4px;
}

.image-placeholder {
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border: 1px dashed #c0c4cc;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
}

.image-placeholder span {
  margin-top: 4px;
}

.carrier-input-wrapper {
  display: flex;
  align-items: center;
}

.carrier-input-wrapper .carrier-select-btn {
  margin-right: 8px;
}

.import-progress {
  margin-top: 20px;
}

.developer-list {
  max-height: 300px;
  overflow-y: auto;
}

.developer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.developer-item:hover {
  border-color: #409eff;
}

.developer-item.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.carrier-list {
  max-height: 300px;
  overflow-y: auto;
}

.carrier-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.carrier-item:hover {
  border-color: #409eff;
}

.carrier-item.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.carrier-info {
  flex: 1;
}

.carrier-name {
  display: block;
  font-weight: bold;
  margin-bottom: 4px;
}

.carrier-description {
  font-size: 12px;
  color: #909399;
}

.check-icon {
  color: #67c23a;
}
</style>