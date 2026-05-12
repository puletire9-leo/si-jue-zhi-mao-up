<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑素材' : '新增素材'"
    width="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="80px"
      class="dialog-form"
    >
      <!-- 元素输入 - 必填 -->
      <el-form-item label="元素" prop="element">
        <div class="element-input-wrapper">
          <!-- 标签输入区域 -->
          <div class="element-tags-container">
            <el-tag
              v-for="(tag, index) in elementTagsList"
              :key="index"
              size="small"
              closable
              @close="removeElement(index)"
              class="element-tag"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-model="currentElement"
              placeholder="请输入元素"
              size="small"
              @keyup.enter="addElement"
              @blur="addElementIfNotEmpty"
              :disabled="analyzing"
              class="element-input"
            >
              <template #append>
                <el-button
                  size="small"
                  @click="addElement"
                  :disabled="!currentElement.trim() || analyzing"
                >
                  确认
                </el-button>
              </template>
            </el-input>
          </div>
          <div class="element-buttons">
            <el-button
              v-if="fileList.length > 0"
              type="primary"
              size="small"
              :loading="analyzing"
              :disabled="analyzing"
              @click="handleAnalyze"
            >
              {{ analyzing ? '分析中...' : 'AI分析' }}
            </el-button>
            <el-button
              v-if="fileList.length > 0"
              type="success"
              size="small"
              :loading="detailedAnalyzing"
              :disabled="detailedAnalyzing"
              @click="handleDetailedAnalyze"
            >
              <el-icon><View /></el-icon>
              {{ detailedAnalyzing ? '分析中...' : '图片分析' }}
            </el-button>
          </div>
        </div>
        <!-- AI分析结果展示区域 -->
        <div v-if="elementTags.length > 0" class="ai-tags-display">
          <div class="ai-tags-header">
            <el-icon><InfoFilled /></el-icon>
            <span>点击标签可快速添加元素</span>
          </div>
          <div class="ai-tags-list">
            <el-tag
              v-for="(tag, index) in elementTags"
              :key="tag.tag"
              size="small"
              :type="getTagType(index)"
              class="ai-tag-item clickable"
              :class="{ 'high-confidence': tag.confidence >= 50, 'medium-confidence': tag.confidence >= 20 && tag.confidence < 50 }"
              @click="addElementByTag(tag.tag)"
              :title="`置信度: ${tag.confidence}% - 点击添加此元素`"
            >
              <span class="tag-name">{{ tag.tag }}</span>
              <span class="tag-confidence">{{ tag.confidence }}%</span>
            </el-tag>
          </div>
        </div>
        <!-- 无匹配结果提示 -->
        <div v-else-if="analyzed && elementTags.length === 0" class="ai-tags-empty">
          <el-icon><Warning /></el-icon>
          <span>未识别到匹配的元素标签，请手动输入</span>
        </div>
      </el-form-item>

      <!-- 素材图片上传 - 必填 -->
      <el-form-item label="素材图片" prop="images" required>
        <div class="upload-area">
          <el-upload
            ref="uploadRef"
            :file-list="fileList"
            @update:file-list="handleFileListUpdate"
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :multiple="true"
            :limit="10"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            :on-remove="handleRemove"
            :on-preview="handlePreview"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            class="upload-component"
            :class="{ 'is-filled': fileList.length > 0 }"
            :drag="true"
          >
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，单张不超过10MB</div>
          </el-upload>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitting"
        >
          {{ submitting ? '提交中...' : '确定' }}
        </el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 图片查看器 -->
  <el-image-viewer
    v-if="previewVisible"
    :url-list="previewImageList"
    :initial-index="0"
    :hide-on-click-modal="true"
    :hide-on-press-escape="true"
    @close="handlePreviewClose"
  />

  <!-- 图片分析结果对话框 -->
  <el-dialog
    v-model="detailedAnalysisVisible"
    title="图片分析结果"
    width="700px"
    :close-on-click-modal="true"
  >
    <div v-if="detailedAnalysisResult" class="detailed-analysis-content">
      <!-- 图片预览 -->
      <div class="analysis-image-section">
        <el-image
          :src="detailedAnalysisResult.imageUrl"
          :preview-src-list="[detailedAnalysisResult.imageUrl]"
          fit="contain"
          class="analysis-image"
        />
      </div>

      <!-- 分析结果 -->
      <div class="analysis-result-section">
        <!-- 产品类型 -->
        <div class="result-item" v-if="detailedAnalysisResult.product_type">
          <div class="result-label">产品类型</div>
          <div class="result-value">{{ detailedAnalysisResult.product_type }}</div>
        </div>

        <!-- 主题 -->
        <div class="result-item" v-if="detailedAnalysisResult.theme">
          <div class="result-label">主题</div>
          <div class="result-value">{{ detailedAnalysisResult.theme }}</div>
        </div>

        <!-- 元素列表 -->
        <div class="result-item" v-if="detailedAnalysisResult.elements && detailedAnalysisResult.elements.length > 0">
          <div class="result-label">识别元素</div>
          <div class="elements-grid">
            <el-tag
              v-for="(elem, index) in detailedAnalysisResult.elements"
              :key="index"
              size="large"
              type="success"
              class="element-tag"
            >
              <span class="element-icon">{{ elem.icon }}</span>
              <span class="element-name">{{ elem.name }}</span>
              <span class="element-english">({{ elem.english_name }})</span>
            </el-tag>
          </div>
        </div>

        <!-- 文字内容 -->
        <div class="result-item" v-if="detailedAnalysisResult.text_content && detailedAnalysisResult.text_content.length > 0">
          <div class="result-label">文字内容</div>
          <div class="text-content-list">
            <el-tag
              v-for="(text, index) in detailedAnalysisResult.text_content"
              :key="index"
              size="small"
              type="warning"
            >
              {{ text }}
            </el-tag>
          </div>
        </div>

        <!-- 整体描述 -->
        <div class="result-item" v-if="detailedAnalysisResult.description">
          <div class="result-label">整体描述</div>
          <div class="result-description">{{ detailedAnalysisResult.description }}</div>
        </div>
      </div>
    </div>
    <div v-else class="loading-state">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
      <span>正在分析图片，请稍候...</span>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="detailedAnalysisVisible = false">关闭</el-button>
        <el-button type="primary" @click="applyDetailedAnalysisResult">
          应用到素材
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElImageViewer, type FormInstance, type UploadProps, type UploadUserFile } from 'element-plus'
import { Picture, Plus, InfoFilled, Warning, View, Loading } from '@element-plus/icons-vue'
import { materialLibraryApi } from '@/api/materialLibrary'
import { imageApi } from '@/api/image'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'

interface Props {
  modelValue: boolean
  isEdit?: boolean
  materialData?: any
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  materialData: () => ({})
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

// 响应式数据
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => props.isEdit)
const materialData = computed(() => props.materialData)

// 表单数据 - 只保留元素和图片
const formData = reactive({
  element: '',
  images: [] as string[]
})

// 元素标签列表
const elementTagsList = ref<string[]>([])
// 当前输入的元素
const currentElement = ref('')

// 表单验证规则
const rules = {
  element: [
    { required: true, message: '请输入元素', trigger: 'blur' }
  ]
}

const formRef = ref<FormInstance>()
const uploadRef = ref()
const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])

// AI 分析相关
const analyzing = ref(false)
const analyzed = ref(false)  // 标记是否已完成分析
const elementTags = ref<Array<{ tag: string; confidence: number }>>([])

// 详细图片分析相关
const detailedAnalyzing = ref(false)
const detailedAnalysisVisible = ref(false)
const detailedAnalysisResult = ref<{
  imageUrl: string
  product_type: string
  theme: string
  elements: Array<{ name: string; english_name: string; icon: string }>
  text_content: string[]
  description: string
} | null>(null)

/**
 * 根据置信度索引获取标签类型
 * @param index 标签索引
 * @returns 标签类型
 */
const getTagType = (index: number): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  if (index === 0) return 'success'  // 第一名 - 绿色
  if (index === 1) return 'warning'  // 第二名 - 橙色
  if (index === 2) return 'info'     // 第三名 - 蓝色
  return 'info'
}

/**
 * 更新表单数据中的元素字段
 */
const updateFormDataElement = () => {
  formData.element = elementTagsList.value.join(' ')
}

/**
 * 添加元素
 */
const addElement = () => {
  const value = currentElement.value.trim()
  if (value && !elementTagsList.value.includes(value)) {
    elementTagsList.value.push(value)
    currentElement.value = ''
    updateFormDataElement()
  }
}

/**
 * 当输入框失去焦点时添加元素
 */
const addElementIfNotEmpty = () => {
  addElement()
}

/**
 * 删除元素
 * @param index 元素索引
 */
const removeElement = (index: number) => {
  elementTagsList.value.splice(index, 1)
  updateFormDataElement()
}

/**
 * 通过标签添加元素
 * @param tag 标签内容
 */
const addElementByTag = (tag: string) => {
  if (!elementTagsList.value.includes(tag)) {
    elementTagsList.value.push(tag)
    updateFormDataElement()
    ElMessage.success(`已添加元素: ${tag}`)
  }
}

// 图片预览相关数据
const previewVisible = ref(false)
const previewImage = ref('')
const previewImageList = ref<string[]>([])

/**
 * 初始化表单数据
 * 用于对话框打开时加载素材数据到表单
 */
const initFormData = () => {
  if (isEdit.value && materialData.value) {
    console.log('[MaterialDialog] 初始化表单数据')
    formData.element = materialData.value.element || ''
    formData.images = materialData.value.images || []

    // 解析元素数据为标签列表
    if (formData.element) {
      elementTagsList.value = formData.element.split(/\s+/).filter(tag => tag.trim())
    } else {
      elementTagsList.value = []
    }

    // 更新文件列表，显示已上传的图片
    if (formData.images.length > 0) {
      fileList.value = formData.images
        .filter(image => typeof image === 'string' && image.trim() !== '')
        .map((image, index) => {
          let url = image
          // 对每个图片URL生成缩略图URL
          try {
            const thumbnailUrl = ImageUrlUtil.getThumbnailUrlSync(image, 'large')
            if (thumbnailUrl && thumbnailUrl !== ImageUrlUtil.getDefaultPlaceholder()) {
              url = thumbnailUrl
            }
          } catch (error) {
            console.error('生成图片缩略图URL失败:', error)
          }
          return {
            uid: index,
            name: `material_${index}.jpg`,
            status: 'success' as const,
            url: url
          }
        })
        .filter(item => item.url && item.url !== ImageUrlUtil.getDefaultPlaceholder())
    } else {
      // 如果formData.images为空，重置fileList
      fileList.value = []
    }
  } else {
    // 新增模式，重置表单
    formData.element = ''
    formData.images = []
    fileList.value = []
    elementTagsList.value = []
  }
  // 重置输入状态
  currentElement.value = ''
  // 重置 AI 分析状态
  analyzing.value = false
  analyzed.value = false
  elementTags.value = []
}

// 监听materialData变化，当编辑模式下数据变化时更新表单
watch(
  () => materialData.value,
  () => {
    initFormData()
  },
  { deep: true, immediate: true }
)

// 监听对话框显示状态，当对话框打开时重新初始化表单
watch(
  () => dialogVisible.value,
  (visible) => {
    if (visible) {
      console.log('[MaterialDialog] 对话框打开，重新初始化表单')
      initFormData()
    }
  }
)

// 处理fileList更新事件
const handleFileListUpdate = (newFileList: UploadUserFile[]) => {
  console.log('File list updated:', newFileList)
  fileList.value = newFileList
}

const handleChange: UploadProps['onChange'] = (file, files) => {
  // 简化事件处理，让Element Plus管理文件列表
  // 只在文件状态变化时进行必要处理
  if (file.status === 'ready' && file.raw) {
    // 验证图片类型
    const isValid = validateImageType(file.raw)
    if (!isValid) {
      // 验证失败，从文件列表中移除
      fileList.value = files.filter(item => item.uid !== file.uid)
    }
  }
}

const handleRemove: UploadProps['onRemove'] = (file, files) => {
  // 使用Element Plus提供的最新文件列表，确保状态一致
  fileList.value = [...files]
}

// 处理文件超出限制
const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning('最多只能上传10张图片')
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

// 验证图片大小
const validateImageSize = (file: File): boolean => {
  const isLtMaxSize = file.size / 1024 / 1024 < 10 // 10MB
  if (!isLtMaxSize) {
    ElMessage.error('上传图片大小不能超过 10MB!')
    return false
  }
  return true
}

// 上传前验证
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  return validateImageType(file) && validateImageSize(file)
}

// 自定义上传逻辑
const handleUpload: UploadProps['httpRequest'] = async (options) => {
  try {
    // 模拟上传过程
    await new Promise(resolve => setTimeout(resolve, 1000))

    const result = {
      url: URL.createObjectURL(options.file),
      name: options.file.name
    }

    options.onSuccess(result)
  } catch (error) {
    options.onError({
      name: 'UploadError',
      status: 500,
      method: 'POST',
      url: '',
      message: error instanceof Error ? error.message : '上传失败'
    })
  }
}

// 图片预览相关方法
const handlePreview = (file: UploadUserFile): void => {
  // 设置预览图片URL
  previewImage.value = file.url || ''
  // 设置预览图片列表（只包含当前图片）
  previewImageList.value = [file.url || '']
  // 显示预览对话框
  previewVisible.value = true
}

const handlePreviewClose = (): void => {
  // 关闭预览对话框
  previewVisible.value = false
  // 清空预览图片URL
  previewImage.value = ''
  // 清空预览图片列表
  previewImageList.value = []
}

// 上传素材图片
const handleImageUpload = async (): Promise<void> => {
  // 实现真正的图片上传到腾讯云COS
  const newImages: string[] = []
  const filesToUpload: File[] = []
  const blobUrlFiles: { file: UploadUserFile; index: number }[] = []

  // 保存原始fileList，用于上传失败时回滚
  const originalFileList = [...fileList.value]

  // 分离已上传的图片和待上传的文件
  for (const [index, file] of fileList.value.entries()) {
    if (file.url) {
      // 检查是否是本地预览URL，如果是则需要上传，否则直接使用
      if (file.url.startsWith('blob:')) {
        if (file.raw) {
          filesToUpload.push(file.raw)
          blobUrlFiles.push({ file, index })
        }
      } else {
        // 已经是有效的URL
        // 检查是否为代理URL，如果是则使用 materialData 中的原始 URL
        const isProxyUrl = file.url && (
          file.url.startsWith('/api/v1/image-proxy/proxy') ||
          file.url.includes('/image-proxy/proxy')
        )
        
        if (isProxyUrl && materialData.value?.images) {
          // 从 materialData 中找到对应的原始 URL
          // 通过比较 file.url 中的 object_key 来匹配
          const objectKey = ImageUrlUtil.extractObjectKey(file.url)
          if (objectKey) {
            // 在原始图片列表中找到匹配的 URL
            const originalImageUrl = materialData.value.images.find(imgUrl => {
              const imgObjectKey = ImageUrlUtil.extractObjectKey(imgUrl)
              return imgObjectKey === objectKey
            })
            if (originalImageUrl) {
              newImages.push(originalImageUrl)
            } else {
              // 如果找不到匹配的，使用当前 URL
              newImages.push(file.url)
            }
          } else {
            // 如果无法提取 object_key，使用当前 URL
            newImages.push(file.url)
          }
        } else {
          // 非代理 URL，直接使用
          newImages.push(file.url)
        }
      }
    } else if (file.raw) {
      // 待上传的文件
      filesToUpload.push(file.raw)
      blobUrlFiles.push({ file, index })
    }
  }

  // 上传待上传的文件
  if (filesToUpload.length > 0) {
    try {
      // 调用批量上传API，使用'material'分类
      ElMessage.info({ message: '开始上传素材图片，请稍候...', duration: 2000 })

      // 编辑模式下使用 materialData 中的 sku，新增模式下不传递 sku
      const sku = isEdit.value ? materialData.value?.sku : undefined
      const response = await imageApi.batchUpload(filesToUpload, 'material', sku)

      if (response.code === 200) {
        // 处理上传成功的图片URL
        let uploadedUrls: string[] = []
        const data = response.data as any
        if (Array.isArray(data)) {
          // 上传成功，添加返回的URL
          uploadedUrls = data.map(item => {
            const url = (item as any).filepath || ''
            return url
          })
        } else if (data?.success) {
          // 批量上传返回的是成功和失败的结果
          uploadedUrls = data.success.map(item => {
            const url = (item as any).cos_url || (item as any).url || ''
            return url
          })

          // 检查是否有上传失败的文件
          if (data.failed && Array.isArray(data.failed) && data.failed.length > 0) {
            const failedCount = data.failed.length
            ElMessage.warning(`部分素材图片上传失败: ${failedCount} 个文件上传失败`)
          }
        } else if (data?.url) {
          // 单文件上传返回格式
          const url = data.url
          uploadedUrls = [url]
        }

        // 检查是否有成功上传的文件
        if (uploadedUrls.length === 0) {
          throw new Error('素材图片上传失败: 没有文件上传成功')
        }

        // 更新newImages数组
        newImages.push(...uploadedUrls)

        // 更新fileList中的文件对象，将blob URL替换为真实URL
        for (let i = 0; i < uploadedUrls.length; i++) {
          if (i < blobUrlFiles.length) {
            const { index } = blobUrlFiles[i]
            fileList.value[index].url = uploadedUrls[i]
          }
        }

        ElMessage.success('素材图片上传成功')
      } else {
        // 上传失败，回滚fileList
        fileList.value = originalFileList
        const errorMsg = response.message || '素材图片上传失败'
        ElMessage.error({ message: `素材图片上传失败: ${errorMsg}`, duration: 5000 })
        throw new Error(`素材图片上传失败: ${errorMsg}`)
      }
    } catch (error) {
      // 上传失败，回滚fileList
      fileList.value = originalFileList

      const errorMsg = error instanceof Error ? error.message : '素材图片上传失败'
      console.error('素材图片上传失败:', error)
      ElMessage.error({ message: `素材图片上传失败: ${errorMsg}`, duration: 5000 })
      throw error
    }
  }

  // 只有在上传成功时才更新formData
  formData.images = newImages
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

// AI 分析图片元素
const handleAnalyze = async (): Promise<void> => {
  // 获取第一张图片的 URL
  // 优先使用 formData.images 中的原始COS URL，而不是 fileList 中的缩略图URL
  let imageUrl = ''
  
  if (formData.images && formData.images.length > 0) {
    // 使用数据库中存储的原始图片URL（COS URL）
    imageUrl = formData.images[0]
    console.log('使用原始COS URL进行AI分析:', imageUrl)
  } else {
    // 回退到使用 fileList 中的URL
    const firstFile = fileList.value.find(f => f.url)
    if (!firstFile?.url) {
      ElMessage.warning('请先上传图片')
      return
    }
    imageUrl = firstFile.url
    console.log('使用fileList URL进行AI分析:', imageUrl)
  }

  analyzing.value = true
  analyzed.value = false
  elementTags.value = []

  try {
    // 判断是否为本地 blob URL
    let imageData: { image_url?: string; image_base64?: string } = {}

    if (imageUrl.startsWith('blob:')) {
      // 本地 blob URL，转换为 base64
      console.log('转换 blob URL 为 base64...')
      const base64 = await blobToBase64(imageUrl)
      imageData = { image_base64: base64 }
    } else {
      // 远程 URL（COS URL）
      imageData = { image_url: imageUrl }
    }

    // 调用 AI 分析 API
    const response = await materialLibraryApi.analyzeImage(
      imageData.image_url,
      imageData.image_base64
    )

    if (response.code === 200 && response.data) {
      const analysisResult = response.data

      // 保存分析标签
      elementTags.value = analysisResult.tags || []
      analyzed.value = true

      // 如果有识别结果，自动填充第一个高置信度标签到元素字段
      if (elementTags.value.length > 0) {
        // 使用第一个标签（置信度最高的）
        formData.element = elementTags.value[0].tag
        ElMessage.success(`AI 分析完成，识别到 ${elementTags.value.length} 个匹配标签`)
      } else {
        formData.element = ''
        ElMessage.warning('未识别到匹配的元素标签，请手动输入')
      }
    } else {
      ElMessage.warning(response.message || 'AI 分析失败')
    }
  } catch (error) {
    console.error('AI 分析异常:', error)
    ElMessage.error('AI 分析失败，请重试')
  } finally {
    analyzing.value = false
  }
}

// 详细图片分析
const handleDetailedAnalyze = async (): Promise<void> => {
  // 获取第一张图片的 URL
  let imageUrl = ''

  if (formData.images && formData.images.length > 0) {
    imageUrl = formData.images[0]
  } else {
    const firstFile = fileList.value.find(f => f.url)
    if (!firstFile?.url) {
      ElMessage.warning('请先上传图片')
      return
    }
    imageUrl = firstFile.url
  }

  detailedAnalyzing.value = true
  detailedAnalysisVisible.value = true
  detailedAnalysisResult.value = null

  try {
    // 判断是否为本地 blob URL
    let imageData: { image_url?: string; image_base64?: string } = {}

    if (imageUrl.startsWith('blob:')) {
      const base64 = await blobToBase64(imageUrl)
      imageData = { image_base64: base64 }
    } else {
      imageData = { image_url: imageUrl }
    }

    // 调用详细分析 API
    const response = await materialLibraryApi.analyzeImageDetailed(
      imageData.image_url,
      imageData.image_base64
    )

    if (response.code === 200 && response.data) {
      detailedAnalysisResult.value = {
        imageUrl: imageUrl,
        ...response.data
      }
      ElMessage.success('图片分析完成')
    } else {
      ElMessage.warning(response.message || '图片分析失败')
      detailedAnalysisVisible.value = false
    }
  } catch (error) {
    console.error('图片分析异常:', error)
    ElMessage.error('图片分析失败，请重试')
    detailedAnalysisVisible.value = false
  } finally {
    detailedAnalyzing.value = false
  }
}

// 应用详细分析结果到素材
const applyDetailedAnalysisResult = () => {
  if (!detailedAnalysisResult.value) return

  // 将分析结果的元素添加到标签列表
  const elements = detailedAnalysisResult.value.elements
  if (elements && elements.length > 0) {
    elements.forEach(element => {
      const elementName = element.name.trim()
      if (elementName && !elementTagsList.value.includes(elementName)) {
        elementTagsList.value.push(elementName)
      }
    })
    updateFormDataElement()
    ElMessage.success('已应用分析结果到素材')
  }

  detailedAnalysisVisible.value = false
}

// 提交表单
const handleSubmit = async (): Promise<void> => {
  // 表单验证
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    ElMessage.warning('请填写必填项')
    return
  }

  // 验证是否有图片
  if (fileList.value.length === 0) {
    ElMessage.warning('请上传至少一张素材图片')
    return
  }

  try {
    submitting.value = true

    // 检查是否有新上传的图片（blob URL）
    const hasNewImages = fileList.value.some(file => file.url?.startsWith('blob:'))

    // 构建提交数据 - 默认只包含元素
    // 处理空格分隔的元素，将多个连续空格视为一个分隔符
    let processedElement = formData.element
    if (processedElement) {
      processedElement = processedElement.replace(/\s+/g, ' ').trim()
    }
    const submitData: any = {
      element: processedElement
    }

    // 处理图片数据
    if (hasNewImages) {
      // 有新图片上传，先上传图片
      await handleImageUpload()
      // 添加图片数据到提交数据
      submitData.images = formData.images
    } else if (isEdit.value) {
      // 编辑模式且没有新图片
      // 直接使用 materialData 中的原始图片数据
      if (materialData.value?.images && materialData.value.images.length > 0) {
        submitData.images = materialData.value.images
      }
    }

    console.log('提交素材数据:', submitData)

    let response
    if (isEdit.value) {
      // 编辑模式 - 更新素材，使用 materialData 中的 sku
      const sku = materialData.value?.sku
      if (!sku) {
        ElMessage.error('无法获取素材SKU，请重试')
        return
      }
      response = await materialLibraryApi.update(sku, submitData)
    } else {
      // 新增模式 - 创建素材
      response = await materialLibraryApi.create(submitData)
    }

    if (response.code === 200) {
      ElMessage.success(isEdit.value ? '素材更新成功' : '素材创建成功')
      emit('success')
      handleClose()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    console.error('提交素材失败:', error)
    ElMessage.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  // 重置表单
  formData.element = ''
  formData.images = []
  fileList.value = []
  elementTagsList.value = []
  currentElement.value = ''
  // 重置 AI 分析状态
  analyzing.value = false
  analyzed.value = false
  elementTags.value = []
  formRef.value?.resetFields()
  dialogVisible.value = false
}

// 初始化
onMounted(() => {
  console.log('[MaterialDialog] 组件挂载')
})
</script>

<style scoped lang="scss">
.dialog-form {
  padding: 20px 0;

  .element-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;

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

      .element-input {
        flex: 1;
        min-width: 120px;
      }
    }

    .element-buttons {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
  }

  .ai-tags-display {
    margin-top: 8px;
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 8px;
    border: 1px solid #e4e7ed;

    .ai-tags-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
      color: #606266;
      font-size: 12px;

      .el-icon {
        color: #409eff;
      }
    }

    .ai-tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ai-tag-item {
      cursor: pointer;
      transition: all 0.3s ease;
      padding: 4px 10px;
      font-size: 13px;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      &.high-confidence {
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(103, 194, 58, 0.2);
      }

      &.medium-confidence {
        font-weight: 500;
      }

      .tag-name {
        margin-right: 4px;
      }

      .tag-confidence {
        opacity: 0.8;
        font-size: 11px;
      }
    }
  }

  .ai-tags-empty {
    margin-top: 8px;
    padding: 12px;
    background-color: #fdf6ec;
    border-radius: 8px;
    border: 1px solid #f5dab1;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #e6a23c;
    font-size: 13px;

    .el-icon {
      font-size: 16px;
    }
  }

  .upload-area {
    width: 100%;

    .upload-component {
      width: 100%;

      :deep(.el-upload-dragger) {
        width: 100%;
        height: 180px;
      }

      .upload-icon {
        font-size: 48px;
        color: #409eff;
        margin-bottom: 10px;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

// 详细图片分析结果样式
.detailed-analysis-content {
  max-height: 600px;
  overflow-y: auto;

  .analysis-image-section {
    margin-bottom: 20px;
    text-align: center;

    .analysis-image {
      max-width: 100%;
      max-height: 300px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .analysis-result-section {
    .result-item {
      margin-bottom: 16px;

      .result-label {
        font-weight: 600;
        color: #303133;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .result-value {
        color: #606266;
        font-size: 14px;
        padding: 8px 12px;
        background-color: #f5f7fa;
        border-radius: 4px;
      }

      .elements-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .element-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;

          .element-icon {
            font-size: 16px;
          }

          .element-name {
            font-weight: 500;
          }

          .element-english {
            color: #909399;
            font-size: 12px;
          }
        }
      }

      .text-content-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .result-description {
        color: #606266;
        font-size: 14px;
        line-height: 1.6;
        padding: 12px;
        background-color: #f5f7fa;
        border-radius: 4px;
        white-space: pre-wrap;
      }
    }
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
  color: #909399;
}
</style>
