<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑载体' : '新增载体'"
    width="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      class="dialog-form"
    >

      
      <!-- 载体上传 -->
      <el-form-item label="载体图片">
        <el-upload
          ref="uploadRef"
          class="upload-demo"
          :file-list="fileList"
          :auto-upload="false"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :before-upload="beforeUpload"
          :http-request="handleUpload"
          :limit="1"
          :on-exceed="handleExceed"
          :action="''"
        >
          <template #trigger>
            <el-button type="primary">
              <el-icon><Upload /></el-icon>
              选择图片
            </el-button>
          </template>
          <template #tip>
            <div class="el-upload__tip">
              支持JPG、PNG格式，最大10MB
            </div>
          </template>
        </el-upload>
        <el-image
          v-if="formData.images && formData.images.length > 0"
          :src="formData.images[0]"
          fit="cover"
          style="width: 100px; height: 100px; margin-top: 10px"
        >
          <template #error>
            <div class="image-error">
              <el-icon><Picture /></el-icon>
            </div>
          </template>
        </el-image>
      </el-form-item>
      
      <!-- 载体名称 -->
      <el-form-item label="载体名称" prop="carrier_name">
        <el-input
          v-model="formData.carrier_name"
          placeholder="请输入载体名称，例如：帆布袋"
          clearable
        />
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, type FormInstance, type UploadProps } from 'element-plus'
import { Upload, User, Van, Check, Picture } from '@element-plus/icons-vue'
import { carrierLibraryApi } from '@/api/carrierLibrary'
import { imageApi } from '@/api/image'
import { systemConfigApi } from '@/api/systemConfig'
import { useUserStore } from '@/stores/user'

interface Props {
  modelValue: boolean
  isEdit?: boolean
  carrierData?: any
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  carrierData: () => ({})
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
const carrierData = computed(() => props.carrierData)

// 表单数据
const formData = reactive({
  images: [] as string[],
  carrier_name: ''
})

// 表单验证规则
const rules = {
  carrier_name: [
    { required: true, message: '请输入载体名称', trigger: 'blur' }
  ]
}

const formRef = ref<FormInstance>()
const uploadRef = ref()

const submitting = ref(false)
const fileList = ref<any[]>([])






// 监听carrierData变化，当编辑模式下数据变化时更新表单
watch(
  () => carrierData.value,
  (newData) => {
    if (isEdit.value && newData) {
      console.log('[CarrierDialog] 编辑模式下数据变化，更新表单')
      formData.images = newData.images || []
      formData.carrier_name = newData.carrier_name || ''
    }
  },
  { deep: true, immediate: true }
)

// 初始化
onMounted(() => {
  // 初始化逻辑
})

// 处理文件变化
const handleFileChange: UploadProps['onChange'] = (file) => {
  if (file.status === 'ready') {
    fileList.value = [file]
  }
}

// 处理文件移除
const handleFileRemove: UploadProps['onRemove'] = () => {
  fileList.value = []
  formData.images = []
}



// 处理文件超出限制
const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning('只能上传一张图片')
}

// 验证图片类型
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
    // 调用图片上传API，不再使用SKU参数
    const response = await imageApi.upload(options.file, 'carrier')
    
    if (response.code === 200 && response.data?.url) {
      options.onSuccess(response)
    } else {
      // 调用onError处理失败
      options.onError({
        status: 400,
        method: 'POST',
        url: '',
        message: '上传失败',
        name: 'UploadError',
        stack: ''
      })
    }
  } catch (error) {
    // 调用onError处理异常
    options.onError({
      status: 500,
      method: 'POST',
      url: '',
      message: error instanceof Error ? error.message : '上传失败',
      name: 'UploadError',
      stack: error instanceof Error ? error.stack || '' : ''
    })
  }
}



// 上传图片
const uploadImages = async (): Promise<boolean> => {
  try {
    // 上传载体图片
    if (fileList.value.length > 0 && fileList.value[0].raw) {
      const file = fileList.value[0].raw
      const response = await imageApi.upload(file, 'carrier')
      
      if (response.code === 200 && response.data?.url) {
        formData.images = [response.data.url]
      } else {
        ElMessage.error('载体图片上传失败')
        return false
      }
    }
    

    
    return true
  } catch (error) {
    console.error('图片上传失败:', error)
    ElMessage.error('图片上传失败')
    return false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    submitting.value = true
    
    // 上传图片
    const uploadSuccess = await uploadImages()
    if (!uploadSuccess) {
      submitting.value = false
      return
    }
    
    if (isEdit.value) {
      // 编辑模式
      const response = await carrierLibraryApi.update(carrierData.value.id, formData)
      if (response.code === 200) {
        ElMessage.success('载体更新成功')
        emit('success')
        handleClose()
      } else {
        ElMessage.error(response.message || '载体更新失败')
      }
    } else {
      // 新增模式
      const response = await carrierLibraryApi.create(formData)
      if (response.code === 200) {
        ElMessage.success('载体创建成功')
        emit('success')
        handleClose()
      } else {
        ElMessage.error(response.message || '载体创建失败')
      }
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  // 重置表单
  formData.images = []
  formData.carrier_name = ''
  fileList.value = []
  submitting.value = false

  // 关闭对话框
  emit('update:modelValue', false)
}
</script>

<style scoped>
.dialog-form {
  max-height: 500px;
  overflow-y: auto;
}

.image-error {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border: 1px dashed #c0c4cc;
  border-radius: 4px;
}

.check-icon {
  color: #67c23a;
}
</style>