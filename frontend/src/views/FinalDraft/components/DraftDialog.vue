<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    :before-close="handleClose"
  >
    <el-form 
      ref="formRef" 
      :model="formData" 
      :rules="formRules" 
      label-width="80px"
      :validate-on-rule-change="false"
    >
      <!-- 元素输入 -->
      <el-form-item label="元素" prop="element">
        <el-input
          v-model="formData.element"
          placeholder="请输入元素"
          clearable
        />
      </el-form-item>

      <!-- SKU输入 -->
      <el-form-item label="SKU" prop="sku">
        <el-input
          v-model="formData.sku"
          placeholder="请输入SKU"
          clearable
        />
      </el-form-item>

      <!-- 批次输入 -->
      <el-form-item label="批次" prop="batch">
        <el-input
          v-model="formData.batch"
          placeholder="请输入批次"
          clearable
        />
      </el-form-item>

      <!-- 开发人输入 -->
      <el-form-item label="开发人" prop="developer">
        <div class="developer-input-wrapper">
          <el-input
            v-model="formData.developer"
            placeholder="请输入开发人"
            clearable
            class="developer-input"
          />
          <el-button
            type="primary"
            :icon="User"
            circle
            size="small"
            class="developer-select-btn"
            @click="handleDeveloperSelect"
          />
        </div>
      </el-form-item>

      <!-- 日期选择 -->
      <el-form-item label="日期" prop="createTime">
        <el-date-picker
          v-model="formData.createTime"
          type="date"
          placeholder="选择日期"
          format="YYYYMMDD"
          value-format="YYYYMMDD"
          class="date-picker"
          @change="handleDateChange"
        />
      </el-form-item>

      <!-- 载体选择 -->
      <el-form-item label="载体" prop="carrier">
        <div class="carrier-select-wrapper">
          <span class="carrier-display">{{ formData.carrier || '请选择载体' }}</span>
          <el-button
              type="primary"
              :icon="Van"
              circle
              size="small"
              class="carrier-select-btn"
              @click="handleCarrierSelect"
            />
        </div>
      </el-form-item>

      <!-- 修改要求 -->
      <el-form-item label="修改要求" prop="modificationRequirement">
        <el-input
          v-model="formData.modificationRequirement"
          placeholder="请输入修改要求"
          type="textarea"
          :rows="3"
          clearable
        />
      </el-form-item>

      <!-- 侵权标注 -->
      <el-form-item label="侵权标注" prop="infringementLabel">
        <el-input
          v-model="formData.infringementLabel"
          placeholder="请输入侵权标注"
          type="textarea"
          :rows="3"
          clearable
        />
      </el-form-item>

      <!-- 设计稿上传 -->
      <el-form-item label="设计稿">
        <div class="upload-area">
          <!-- 设计稿上传组件 - Element Plus会自动处理显示逻辑 -->
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
            <!-- 直接放置内容，不使用额外的el-upload-dragger -->
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，单张不超过10MB</div>
          </el-upload>
        </div>
      </el-form-item>
      
      <!-- 效果图上传 -->
      <el-form-item label="效果图">
        <div class="upload-area">
          <!-- 效果图上传组件 - Element Plus会自动处理显示逻辑 -->
          <el-upload
            ref="referenceUploadRef"
            :file-list="referenceFileList"
            @update:file-list="handleReferenceFileListUpdate"
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :multiple="true"
            :limit="10"
            :on-exceed="handleExceed"
            :on-change="handleReferenceChange"
            :on-remove="handleReferenceRemove"
            :on-preview="handlePreview"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            class="upload-component"
            :class="{ 'is-filled': referenceFileList.length > 0 }"
            :drag="true"
          >
            <!-- 直接放置内容，不使用额外的el-upload-dragger -->
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，单张不超过10MB</div>
          </el-upload>
        </div>
      </el-form-item>

      <!-- 状态选择 -->
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio label="concept">构思</el-radio>
          <el-radio label="optimizing">未完成在优化</el-radio>
          <el-radio label="finalized">已定稿</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 开发人选择对话框 -->
  <el-dialog
    v-model="developerDialogVisible"
    title="选择开发人"
    width="400px"
    :before-close="handleDeveloperDialogClose"
  >
    <div class="developer-list">
      <div
        v-for="developer in developerList"
        :key="developer"
        class="developer-item"
        :class="{ selected: selectedDeveloper === developer }"
        @click="selectDeveloper(developer)"
      >
        <div class="developer-info">
          <span class="developer-name">{{ developer }}</span>
        </div>
        <el-icon v-if="selectedDeveloper === developer" class="check-icon">
          <Check />
        </el-icon>
      </div>
      
      <el-empty
        v-if="developerList.length === 0"
        description="暂无开发人数据"
        :image-size="100"
      />
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleDeveloperDialogClose">取消</el-button>
        <el-button type="primary" @click="confirmDeveloperSelection" :disabled="!selectedDeveloper">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 载体选择对话框 -->
  <el-dialog
    v-model="carrierDialogVisible"
    title="选择载体"
    width="700px"
    :before-close="handleCarrierDialogClose"
  >
    <div class="carrier-list">
      <div
        v-for="carrier in carrierList"
        :key="carrier.value"
        class="carrier-item"
        :class="{ selected: selectedCarrier === carrier.value }"
        @click="selectCarrier(carrier)"
      >
        <div class="carrier-info">
          <span class="carrier-name">{{ carrier.name }}</span>
          <span class="carrier-description">{{ carrier.description }}</span>
        </div>
        <el-icon v-if="selectedCarrier === carrier.value" class="check-icon">
          <Check />
        </el-icon>
      </div>
      
      <el-empty
        v-if="carrierList.length === 0"
        description="暂无载体数据"
        :image-size="100"
      />
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCarrierDialogClose">取消</el-button>
        <el-button type="primary" @click="confirmCarrierSelection" :disabled="!selectedCarrier">
          确定
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElImageViewer, type UploadProps, type UploadUserFile, type FormInstance } from 'element-plus'
import { UploadFilled, Delete, Picture, User, Van, Plus, Check } from '@element-plus/icons-vue'
// 导入API
import { finalDraftApi } from '@/api/finalDraft'
import { imageApi } from '@/api/image'
import { systemConfigApi } from '@/api/systemConfig'
import { userApi } from '@/api/user'
// 导入用户状态管理
import { useUserStore } from '@/stores/user'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'
interface Props {
  modelValue: boolean
  category?: 'final' | 'material' | 'carrier'
  draft?: {
    id: number
    sku: string
    batch: string
    developer: string
    carrier: string
    element?: string
    modificationRequirement?: string
    infringementLabel?: string
    images: string[]
    referenceImages?: string[]
    reference_images?: string[]
    createTime: string
    updateTime: string
    status: 'finalized' | 'optimizing' | 'concept'
  }
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

const formRef = ref<FormInstance>()
const uploadRef = ref()
const referenceUploadRef = ref()
const submitting = ref(false)

// 图片预览相关数据
const previewVisible = ref(false)
const previewImage = ref('')
const previewImageList = ref<string[]>([])
const scale = ref(1)
const minScale = ref(0.1)
const maxScale = ref(5)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const translateX = ref(0)
const translateY = ref(0)

const formData = reactive({
  element: '',
  sku: '',
  batch: '',
  developer: '',
  carrier: '',
  modificationRequirement: '',
  infringementLabel: '',
  createTime: '',
  updateTime: '',
  images: [] as string[],
  reference_images: [] as string[],
  status: 'finalized' as 'finalized' | 'optimizing' | 'concept'
})

const fileList = ref<UploadUserFile[]>([])
const referenceFileList = ref<UploadUserFile[]>([])

// 开发人选择相关数据
const developerDialogVisible = ref(false)
const selectedDeveloper = ref<string>('')
const developerList = ref<string[]>([])

// 加载开发人列表
const loadDeveloperList = async () => {
  try {
    const response = await systemConfigApi.getDeveloperList()
    if (response.code === 200 && response.data && Array.isArray(response.data.developerList)) {
      developerList.value = response.data.developerList
    } else {
      // 默认开发人列表
      developerList.value = ['admin', 'user1', 'user2']
    }
  } catch (error) {
    console.error('加载开发人列表失败:', error)
    developerList.value = ['admin', 'user1', 'user2']
  }
}

// 载体选择相关数据
const carrierDialogVisible = ref(false)
const selectedCarrier = ref<string>('')
const carrierList = ref<{value: string, name: string, description: string}[]>([])

// 加载载体列表
const loadCarrierList = async () => {
  try {
    const response = await systemConfigApi.getCarrierList()
    if (response.code === 200 && response.data && Array.isArray(response.data.carrierList)) {
      // 将获取到的载体列表转换为组件需要的格式
      carrierList.value = response.data.carrierList.map(carrier => ({
        value: carrier,
        name: carrier,
        description: `${carrier}载体`
      }))
    } else {
      // 默认载体列表
      carrierList.value = []
    }
  } catch (error) {
    console.error('加载载体列表失败:', error)
    carrierList.value = []
  }
}

// 初始化加载开发人列表和载体列表
loadDeveloperList()
loadCarrierList()

// 表单验证规则
const formRules = {
  sku: [
    { required: true, message: '请输入SKU', trigger: 'submit' }
  ]
}

// 用户状态管理
const userStore = useUserStore()

// 计算属性
const dialogTitle = computed(() => {
  return props.draft ? '编辑定稿' : '新增定稿'
})

// 方法
const resetForm = (): void => {
  formData.element = ''
  formData.sku = ''
  formData.batch = ''
  formData.developer = ''
  formData.carrier = ''
  formData.modificationRequirement = ''
  formData.infringementLabel = ''
  formData.createTime = ''
  formData.updateTime = ''
  formData.images = []
  formData.reference_images = []
  formData.status = 'finalized'
  fileList.value = []
  referenceFileList.value = []

  // 自动填写开发人（如果用户是开发角色并且关联了开发人）
  autoFillDeveloper()
}

// 自动填写开发人
const autoFillDeveloper = (): void => {
  console.log('[AutoFillDeveloper] 开始执行自动填写开发人')
  const currentUser = userStore.userInfo
  console.log('[AutoFillDeveloper] 当前用户信息:', currentUser)
  
  if (currentUser) {
    console.log('[AutoFillDeveloper] 用户角色:', currentUser.role)
    console.log('[AutoFillDeveloper] 用户名:', currentUser.username)
    
    // 检查用户是否为开发角色（支持多种角色名称格式）
    const isDeveloperRole = ['开发', 'developer'].includes(currentUser.role)
    console.log('[AutoFillDeveloper] 是否为开发角色:', isDeveloperRole)
    
    // 如果是开发角色，尝试自动填写开发人
    if (isDeveloperRole) {
      // 用户名到开发名的映射
      const usernameToDeveloperMap: Record<string, string> = {
        'liumiao': '刘淼'
        // 可以添加更多映射
      }
      
      // 首先检查当前用户对象中的 developer 字段
      if ((currentUser as any).developer) {
        formData.developer = (currentUser as any).developer
        console.log('[AutoFillDeveloper] 从用户对象的 developer 字段获取开发人:', (currentUser as any).developer)
      }
      // 其次使用硬编码映射
      else if (usernameToDeveloperMap[currentUser.username]) {
        formData.developer = usernameToDeveloperMap[currentUser.username]
        console.log('[AutoFillDeveloper] 从硬编码映射获取开发人:', formData.developer)
      }
      // 最后使用用户名作为 fallback
      else {
        formData.developer = currentUser.username
        console.log('[AutoFillDeveloper] 使用用户名作为开发人:', currentUser.username)
      }
      
      console.log('[AutoFillDeveloper] 最终填写的开发人:', formData.developer)
    } else {
      console.log('[AutoFillDeveloper] 用户不是开发角色，跳过自动填写')
    }
  } else {
    console.log('[AutoFillDeveloper] 用户信息为空，跳过自动填写')
  }
}

// 监听用户信息变化，当用户信息加载完成后执行自动填写
watch(
  () => userStore.userInfo,
  (newUserInfo) => {
    if (newUserInfo) {
      console.log('[DraftDialog] 用户信息变化，执行自动填写开发人')
      autoFillDeveloper()
    }
  },
  { deep: true }
)

// 组件挂载时执行自动填写
onMounted(() => {
  console.log('[DraftDialog] 组件挂载，执行自动填写开发人')
  autoFillDeveloper()
  
  // 延迟执行，确保用户信息已完全加载
  setTimeout(() => {
    console.log('[DraftDialog] 延迟执行自动填写开发人')
    autoFillDeveloper()
  }, 1000)
})

// 监听props.draft变化，初始化表单数据
watch(() => props.draft, (newDraft) => {
  if (newDraft) {
    // 获取参考图数据，同时检查reference_images和referenceImages字段
    const referenceImages = [...(newDraft.reference_images || newDraft.referenceImages || [])]
    
    Object.assign(formData, {
      element: newDraft.element || '',
      sku: newDraft.sku,
      batch: newDraft.batch,
      developer: newDraft.developer,
      carrier: newDraft.carrier || '',
      modificationRequirement: newDraft.modificationRequirement || '',
      infringementLabel: newDraft.infringementLabel || '',
      createTime: newDraft.createTime,
      updateTime: newDraft.updateTime,
      images: [...newDraft.images],
      reference_images: referenceImages,
      status: newDraft.status
    })
    
    // 初始化文件列表
    fileList.value = newDraft.images.map((image, index) => ({
      name: `image_${index}.jpg`,
      url: ImageUrlUtil.getThumbnailUrlSync(image)
    }))
    
    // 初始化参考图文件列表
    referenceFileList.value = referenceImages.map((image, index) => ({
      name: `reference_image_${index}.jpg`,
      url: ImageUrlUtil.getThumbnailUrlSync(image)
    }))
  } else {
    resetForm()
    // 新增模式，自动填写开发人
    autoFillDeveloper()
  }
}, { immediate: true })

const handleClose = (): void => {
  dialogVisible.value = false
  resetForm()
  // 清除表单验证状态，确保下次打开时没有残留的错误提示
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 处理日期变化
const handleDateChange = (dateValue: string): void => {
  if (dateValue) {
    // 无论批次字段是否为空，都自动填充为日期值
    formData.batch = dateValue
  }
}

// 开发人选择相关方法
const handleDeveloperSelect = (): void => {
  developerDialogVisible.value = true
  selectedDeveloper.value = formData.developer
}

const handleDeveloperDialogClose = (): void => {
  developerDialogVisible.value = false
  selectedDeveloper.value = ''
}

const selectDeveloper = (developer: string): void => {
  selectedDeveloper.value = developer
}

const confirmDeveloperSelection = (): void => {
  formData.developer = selectedDeveloper.value
  developerDialogVisible.value = false
}

// 载体选择相关方法
const handleCarrierSelect = (): void => {
  carrierDialogVisible.value = true
  selectedCarrier.value = formData.carrier
}

const handleCarrierDialogClose = (): void => {
  carrierDialogVisible.value = false
  selectedCarrier.value = ''
}

const selectCarrier = (carrier: {value: string, name: string, description: string}): void => {
  selectedCarrier.value = carrier.value
}

const confirmCarrierSelection = (): void => {
  const selectedCarrierObj = carrierList.value.find(item => item.value === selectedCarrier.value)
  if (selectedCarrierObj) {
    formData.carrier = selectedCarrierObj.name
  }
  carrierDialogVisible.value = false
}

// 手动获取用户信息并执行自动填写
const fetchUserInfoAndAutoFill = async () => {
  try {
    console.log('[DraftDialog] 手动获取用户信息')
    await userStore.getUserInfo()
    console.log('[DraftDialog] 获取用户信息后执行自动填写')
    autoFillDeveloper()
  } catch (error) {
    console.error('[DraftDialog] 获取用户信息失败:', error)
  }
}

// 监听对话框关闭事件，确保在对话框关闭时清除验证状态
watch(dialogVisible, async (newVal) => {
  if (!newVal) {
    if (formRef.value) {
      // 对话框关闭时清除验证状态
      formRef.value.clearValidate()
    }
  } else {
    // 对话框打开时，重新初始化表单数据，无论props.draft是否变化
    if (props.draft) {
      // 获取参考图数据，同时检查reference_images和referenceImages字段
      const referenceImages = [...(props.draft.reference_images || props.draft.referenceImages || [])]
      
      Object.assign(formData, {
        element: props.draft.element || '',
        sku: props.draft.sku,
        batch: props.draft.batch,
        developer: props.draft.developer,
        carrier: props.draft.carrier || '',
        modificationRequirement: props.draft.modificationRequirement || '',
        infringementLabel: props.draft.infringementLabel || '',
        createTime: props.draft.createTime,
        updateTime: props.draft.updateTime,
        images: [...props.draft.images],
        reference_images: referenceImages,
        status: props.draft.status
      })
      
      // 重新初始化文件列表
        fileList.value = props.draft.images.map((image, index) => ({
          name: `image_${index}.jpg`,
          url: ImageUrlUtil.getThumbnailUrlSync(image)
        }))
        
        // 重新初始化参考图文件列表
        referenceFileList.value = referenceImages.map((image, index) => ({
          name: `reference_image_${index}.jpg`,
          url: ImageUrlUtil.getThumbnailUrlSync(image)
        }))
    } else {
      // 新增模式，手动获取用户信息并自动填写开发人
      console.log('[DraftDialog] 对话框打开，手动获取用户信息并执行自动填写')
      await fetchUserInfoAndAutoFill()
    }
  }
})

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return

  try {
    // 手动验证必填字段
    const requiredFields = [
      { name: 'sku', value: formData.sku, label: 'SKU' }
    ]
    
    // 检查必填字段
    const missingFields = requiredFields.filter(field => !field.value)
    if (missingFields.length > 0) {
      // 显示缺失字段提示，5秒后消失
      const missingLabels = missingFields.map(field => field.label).join('、')
      ElMessage.error({
        message: `请填写以下必填字段：${missingLabels}`,
        duration: 5000
      })
      return
    }

    submitting.value = true
    
    // 处理图片上传
    await handleImageUpload()
    await handleReferenceImageUpload()
    
    // 准备API请求数据
    const apiData = {
      sku: formData.sku,
      batch: formData.batch,
      developer: formData.developer,
      carrier: formData.carrier,
      element: formData.element,
      modification_requirement: formData.modificationRequirement,
      infringement_label: formData.infringementLabel,
      images: formData.images,
      reference_images: formData.reference_images,
      status: formData.status
    }
    
    // 调用真实API
    let response
    if (props.draft) {
      // 编辑模式
      response = await finalDraftApi.update(props.draft.sku, apiData)
    } else {
      // 新增模式
      response = await finalDraftApi.create(apiData)
    }
    
    if (response.code === 200) {
      ElMessage.success({
        message: props.draft ? '编辑成功' : '新增成功',
        duration: 2000
      })
      emit('success')
      handleClose()
    } else {
      ElMessage.error({
        message: response.message || '操作失败',
        duration: 5000
      })
    }
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error({
      message: '操作失败',
      duration: 5000
    })
  } finally {
    submitting.value = false
  }
}

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
        // 已经是有效的URL，直接使用
        // 检查是否是代理URL，如果是则转换回原始COS URL
        if (file.url.includes('/api/v1/image-proxy/proxy')) {
          // 从代理URL中提取object_key并构造原始COS URL
          const urlParams = new URLSearchParams(file.url.split('?')[1] || '')
          const objectKey = urlParams.get('object_key')
          if (objectKey) {
            const originalCosUrl = `https://sijuelishi-1328246743.cos.ap-guangzhou.myqcloud.com/${decodeURIComponent(objectKey)}`
            newImages.push(originalCosUrl)
          } else {
            newImages.push(file.url)
          }
        } else {
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
      // 调用批量上传API，根据category属性使用正确的分类参数
      const uploadCategory = props.category || 'final'
      ElMessage.info({ message: '开始上传图片，请稍候...', duration: 2000 })
      
      const response = await imageApi.batchUpload(filesToUpload, uploadCategory, formData.sku)
      
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
            ElMessage.warning(`部分图片上传失败: ${failedCount} 个文件上传失败`)
          }
        } else if (data?.url) {
          // 单文件上传返回格式
          const url = data.url
          uploadedUrls = [url]
        }
        
        // 检查是否有成功上传的文件
        if (uploadedUrls.length === 0) {
          throw new Error('图片上传失败: 没有文件上传成功')
        }
        
        // 更新newImages数组
        newImages.push(...uploadedUrls)
        
        // 更新fileList中的文件对象，将blob URL替换为真实URL
        for (let i = 0; i < uploadedUrls.length; i++) {
          if (i < blobUrlFiles.length) {
            const { index } = blobUrlFiles[i]
            // 为前端显示创建代理URL
            const proxyUrl = ImageUrlUtil.getThumbnailUrlSync(uploadedUrls[i])
            fileList.value[index].url = proxyUrl
          }
        }
        
        ElMessage.success('图片上传成功')
      } else {
        // 上传失败，回滚fileList
        fileList.value = originalFileList
        const errorMsg = response.message || '图片上传失败'
        ElMessage.error({ message: `图片上传失败: ${errorMsg}`, duration: 5000 })
        throw new Error(`图片上传失败: ${errorMsg}`)
      }
    } catch (error) {
      // 上传失败，回滚fileList
      fileList.value = originalFileList
      
      const errorMsg = error instanceof Error ? error.message : '图片上传失败'
      console.error('图片上传失败:', error)
      ElMessage.error({ message: `图片上传失败: ${errorMsg}`, duration: 5000 })
      throw error
    }
  }
  
  // 只有在上传成功时才更新formData
  formData.images = newImages
}

const handleReferenceImageUpload = async (): Promise<void> => {
  // 实现效果图上传到腾讯云COS
  const newReferenceImages: string[] = []
  const filesToUpload: File[] = []
  const blobUrlFiles: { file: UploadUserFile; index: number }[] = []
  
  // 保存原始referenceFileList，用于上传失败时回滚
  const originalReferenceFileList = [...referenceFileList.value]
  
  // 分离已上传的图片和待上传的文件
  for (const [index, file] of referenceFileList.value.entries()) {
    if (file.url) {
      // 检查是否是本地预览URL，如果是则需要上传，否则直接使用
      if (file.url.startsWith('blob:')) {
        if (file.raw) {
          filesToUpload.push(file.raw)
          blobUrlFiles.push({ file, index })
        }
      } else {
        // 已经是有效的URL，直接使用
        // 检查是否是代理URL，如果是则转换回原始COS URL
        if (file.url.includes('/api/v1/image-proxy/proxy')) {
          // 从代理URL中提取object_key并构造原始COS URL
          const urlParams = new URLSearchParams(file.url.split('?')[1] || '')
          const objectKey = urlParams.get('object_key')
          if (objectKey) {
            const originalCosUrl = `https://sijuelishi-1328246743.cos.ap-guangzhou.myqcloud.com/${decodeURIComponent(objectKey)}`
            newReferenceImages.push(originalCosUrl)
          } else {
            newReferenceImages.push(file.url)
          }
        } else {
          newReferenceImages.push(file.url)
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
      // 调用批量上传API，指定category为'reference'，表示这是效果图
      ElMessage.info({ message: '开始上传效果图，请稍候...', duration: 2000 })
      
      const response = await imageApi.batchUpload(filesToUpload, 'reference', formData.sku)
      
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
            ElMessage.warning(`部分效果图上传失败: ${failedCount} 个文件上传失败`)
          }
        } else if (data?.url) {
          // 单文件上传返回格式
          const url = data.url
          uploadedUrls = [url]
        }
        
        // 检查是否有成功上传的文件
        if (uploadedUrls.length === 0) {
          throw new Error('效果图上传失败: 没有文件上传成功')
        }
        
        // 更新newReferenceImages数组
        newReferenceImages.push(...uploadedUrls)
        
        // 更新referenceFileList中的文件对象，将blob URL替换为真实URL并转换为代理URL用于显示
        for (let i = 0; i < uploadedUrls.length; i++) {
          if (i < blobUrlFiles.length) {
            const { index } = blobUrlFiles[i]
            const uploadedUrl = uploadedUrls[i]
            // 为前端显示创建代理URL
            const proxyUrl = ImageUrlUtil.getThumbnailUrlSync(uploadedUrl)
            referenceFileList.value[index].url = proxyUrl
          }
        }
        
        ElMessage.success('效果图上传成功')
      } else {
        // 上传失败，回滚referenceFileList
        referenceFileList.value = originalReferenceFileList
        const errorMsg = response.message || '效果图上传失败'
        ElMessage.error({ message: `效果图上传失败: ${errorMsg}`, duration: 5000 })
        throw new Error(`效果图上传失败: ${errorMsg}`)
      }
    } catch (error) {
      // 上传失败，回滚referenceFileList
      referenceFileList.value = originalReferenceFileList
      
      const errorMsg = error instanceof Error ? error.message : '效果图上传失败'
      console.error('效果图上传失败:', error)
      ElMessage.error({ message: `效果图上传失败: ${errorMsg}`, duration: 5000 })
      throw error
    }
  }
  
  // 只有在上传成功时才更新formData
  formData.reference_images = newReferenceImages
}

const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning('最多只能上传10张图片')
}

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

// 参考图相关处理函数
const handleReferenceFileListUpdate = (newFileList: UploadUserFile[]) => {
  console.log('Reference file list updated:', newFileList)
  referenceFileList.value = newFileList
}

const handleReferenceChange: UploadProps['onChange'] = (file, files) => {
  // 简化事件处理，让Element Plus管理文件列表
  // 只在文件状态变化时进行必要处理
  if (file.status === 'ready' && file.raw) {
    // 验证图片类型
    const isValid = validateImageType(file.raw)
    if (!isValid) {
      // 验证失败，从文件列表中移除
      referenceFileList.value = files.filter(item => item.uid !== file.uid)
    }
  }
}

const handleReferenceRemove: UploadProps['onRemove'] = (file, files) => {
  // 使用Element Plus提供的最新文件列表，确保状态一致
  referenceFileList.value = [...files]
}

// 验证图片类型的函数，供点击上传和拖拽上传共同使用
// 只验证图片类型，不设置大小限制
const validateImageType = (file: File): boolean => {
  const isJPGOrPNG = file.type === 'image/jpeg' || file.type === 'image/png'
  
  if (!isJPGOrPNG) {
    ElMessage.error('上传图片只能是 JPG/PNG 格式!')
    return false
  }
  return true
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  return validateImageType(file)
}

const handleUpload: UploadProps['httpRequest'] = async (options) => {
  // 自定义上传逻辑
  const { file, onSuccess, onError } = options
  
  try {
    // 模拟上传过程
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const result = {
      url: URL.createObjectURL(file),
      name: file.name
    }
    
    onSuccess(result)
  } catch (error) {
    onError({ 
      name: 'UploadError',
      status: 500, 
      method: 'POST', 
      url: '', 
      message: error instanceof Error ? error.message : '上传失败' 
    })
  }
}

const removeImage = (index: number): void => {
  formData.images.splice(index, 1)
  fileList.value.splice(index, 1)
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
  // 重置缩放和位移
  resetZoom()
}

// 重置缩放和位移（保留用于兼容性）
const resetZoom = (): void => {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}
</script>

<style scoped lang="scss">
.upload-area {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 15px 0;
    
    /* 确保已上传文件列表正常显示 */
    :deep(.el-upload-list--picture-card) {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 0;
      margin: 0;
    }
    
    /* 调整上传组件样式，确保整洁 */
    :deep(.el-upload--picture-card) {
      /* 移除默认的margin，确保紧凑显示 */
      margin: 0;
      padding: 0;
      display: inline-block;
      position: relative;
    }
    
    /* 确保图片和上传按钮显示正常 */
    :deep(.el-upload-list__item) {
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 150px;
      height: 150px;
      border-radius: 8px;
      border: 1px solid #ebeef5;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      }
    }
    
    /* 确保图片缩略图显示 */
    :deep(.el-upload-list__item-thumbnail) {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 8px;
    }
    
    /* 确保上传的图片显示正常 */
    :deep(.el-upload-list__item img) {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    
    /* 调整图片项操作按钮 */
    :deep(.el-upload-list__item-actions) {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      color: #fff;
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 12px 0;
      opacity: 0;
      transition: opacity 0.3s ease;
      border-radius: 0 0 8px 8px;
    }
    
    /* 鼠标悬停时显示操作按钮 */
    :deep(.el-upload-list__item:hover .el-upload-list__item-actions) {
      opacity: 1;
    }
    
    /* 调整操作图标大小 */
    :deep(.el-icon) {
      font-size: 18px;
      cursor: pointer;
      
      &:hover {
        color: #409eff;
      }
    }
    
    /* 响应式设计 */
    @media (max-width: 900px) {
      max-width: 100%;
      
      :deep(.el-upload-list__item) {
        width: 130px;
        height: 130px;
      }
      
      :deep(.el-upload-list--picture-card) {
        gap: 16px;
      }
    }
    
    @media (max-width: 768px) {
      :deep(.el-upload-list__item) {
        width: 110px;
        height: 110px;
      }
      
      :deep(.el-upload-list--picture-card) {
        gap: 14px;
      }
    }
    
    @media (max-width: 480px) {
      :deep(.el-upload-list__item) {
        width: 100px;
        height: 100px;
      }
      
      :deep(.el-upload-list--picture-card) {
        gap: 12px;
      }
    }
    
    @media (max-width: 360px) {
      :deep(.el-upload-list__item) {
        width: 90px;
        height: 90px;
      }
      
      :deep(.el-upload-list--picture-card) {
        gap: 10px;
      }
    }
  }
  
  /* 调整上传组件的提示文本样式 */
  :deep(.upload-component .el-upload__text) {
    display: none;
  }
  
  :deep(.upload-component .el-upload__tip) {
    display: none;
  }

.developer-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .developer-input {
    flex: 1;
  }
  
  .developer-select-btn {
    flex-shrink: 0;
  }
}

// 开发人选择对话框样式
.developer-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  
  .developer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #fafafa;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    
    &:hover {
      border-color: #409eff;
      background-color: #ecf5ff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    &.selected {
      border-color: #409eff;
      background-color: #ecf5ff;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
    }
    
    .developer-info {
      display: flex;
      align-items: center;
      
      .developer-name {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }
    }
    
    .check-icon {
      color: #409eff;
      font-size: 18px;
      transition: all 0.3s ease;
    }
  }
}

/* 载体选择相关样式 */
.carrier-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;

  .carrier-display {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    background-color: #f5f7fa;
    color: #606266;
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  .carrier-select-btn {
    flex-shrink: 0;
  }
}

.carrier-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* 减小最小宽度 */
  gap: 10px; /* 调整间距 */

  .carrier-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 20px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #fafafa;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    &:hover {
      border-color: #409eff;
      background-color: #ecf5ff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.selected {
      border-color: #409eff;
      background-color: #ecf5ff;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
    }

    .carrier-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;

      .carrier-name {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }

      .carrier-description {
        font-size: 13px;
        color: #606266;
        opacity: 0.9;
      }
    }

    .check-icon {
      color: #409eff;
      font-size: 20px;
      transition: all 0.3s ease;
      align-self: flex-end;
      margin-top: 8px;
    }
  }
}

.image-preview-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.preview-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 4px;
  overflow: hidden;
  border: none;

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover .preview-actions {
    opacity: 1;
  }
}



.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 图片预览对话框样式 */
.image-preview-dialog {
  max-width: 95vw;
  max-height: 95vh;
  
  :deep(.el-dialog__body) {
    padding: 0;
    overflow: hidden;
  }
  
  :deep(.el-dialog__header) {
    padding: 12px 20px;
    border-bottom: none;
  }
  
  :deep(.el-dialog__footer) {
    padding: 12px 20px;
    border-top: none;
  }
}

/* 图片预览容器样式 */
.image-preview-container {
  width: 100%;
  height: calc(100% - 112px); /* 减去头部和底部的高度 */
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #000;
  overflow: hidden;
  padding: 20px;
  position: relative;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
}

/* 预览图片包装器样式 */
.preview-image-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-origin: center center;
}

/* 预览图片样式 */
.preview-image {
  width: auto;
  height: auto;
  display: block;
  
  :deep(.el-image__inner) {
    max-width: none;
    max-height: none;
    object-fit: contain;
    width: auto;
    height: auto;
    display: block;
  }
  
  :deep(.el-image__error) {
    width: 300px;
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    background-color: rgba(255, 0, 0, 0.1);
  }
}
</style>