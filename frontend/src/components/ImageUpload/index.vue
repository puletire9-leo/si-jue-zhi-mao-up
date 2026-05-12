<template>
  <div class="image-upload">
    <el-upload
      :action="uploadUrl"
      :headers="uploadHeaders"
      :on-success="handleSuccess"
      :on-error="handleError"
      :on-preview="handlePreview"
      :on-remove="handleRemove"
      :before-upload="beforeUpload"
      :limit="maxFiles"
      :on-exceed="handleExceed"
      list-type="picture-card"
      multiple
      drag
    >
      <template v-if="!modelValue || modelValue.length === 0">
        <el-icon class="upload-icon"><Plus /></el-icon>
        <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
        <div class="el-upload__tip">支持JPG、PNG、GIF、WebP格式，单张不超过{{ maxSize }}MB</div>
      </template>
      <el-icon v-else><Plus /></el-icon>
    </el-upload>

    <el-dialog
      v-model="previewVisible"
      title="图片预览"
    >
      <img
        :src="previewUrl"
        style="width: 100%"
      >
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  maxFiles: {
    type: Number,
    default: 10
  },
  maxSize: {
    type: Number,
    default: 5
  },
  acceptTypes: {
    type: Array,
    default: () => ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  }
})

const emit = defineEmits(['update:modelValue', 'upload-success'])

const uploadUrl = computed(() => {
  return import.meta.env.VITE_API_BASE_URL + '/images/upload'
})
const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
})
const previewVisible = ref(false)
const previewUrl = ref('')

const beforeUpload = (file) => {
  const isValidType = props.acceptTypes.includes(file.type)
  const isValidSize = file.size / 1024 / 1024 < props.maxSize

  if (!isValidType) {
    ElMessage.error('只能上传JPG、PNG、GIF、WebP格式的图片！')
    return false
  }
  if (!isValidSize) {
    ElMessage.error(`图片大小不能超过${props.maxSize}MB！`)
    return false
  }
  return true
}

const handleSuccess = (response, file, fileList) => {
  ElMessage.success('上传成功')
  emit('update:modelValue', fileList)
  emit('upload-success', fileList)
}

const handleError = (error, _file, _fileList) => {
  ElMessage.error('上传失败')
  console.error('上传错误:', error)
}

const handlePreview = (file) => {
  previewUrl.value = file.url
  previewVisible.value = true
}

const handleRemove = (file, fileList) => {
  emit('update:modelValue', fileList)
}

const handleExceed = (_files) => {
  ElMessage.warning(`最多只能上传${props.maxFiles}张图片`)
}
</script>

<style scoped lang="scss">
.image-upload {
  position: relative;
  
  :deep(.el-upload-list__item) {
    transition: all 0.3s ease;
  }

  :deep(.el-upload--picture-card) {
    width: 148px;
    height: 148px;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    height: 200px;
    margin-bottom: 20px;
    border: 2px dashed #dcdfe6;
    background: #fafafa;
    transition: all 0.3s ease;
    
    &.is-dragover {
      border-color: #409eff;
      background: #ecf5ff;
    }
  }

  :deep(.upload-icon) {
    font-size: 48px;
    color: #409eff;
    margin-bottom: 16px;
  }

  :deep(.el-upload__text) {
    font-size: 16px;
    color: #606266;
    margin-bottom: 8px;
  }

  :deep(.el-upload__tip) {
    font-size: 14px;
    color: #909399;
  }

  :deep(.el-upload-list__item-thumbnail) {
    object-fit: cover;
  }

  /* 当有图片时，确保上传按钮仍能正常显示 */
  :deep(.el-upload--picture-card.has-file-list) {
    margin: 0;
  }
}
</style>
