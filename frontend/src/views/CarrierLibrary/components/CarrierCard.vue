<template>
  <div 
    class="carrier-card" 
    :class="{ selected: isSelected, editing: isEditing }"
    :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }"
    ref="cardRef"
  >
    
    <!-- 图片区域 -->
    <div class="card-image-wrapper" @click.stop="handleImageClick">
      <el-image
        :src="displayImage"
        fit="contain"
        class="card-image"
        lazy
        @error="handleImageError"
        :key="imageRefreshKey"
      >
        <template #error>
          <div class="image-slot">
            <el-icon><Picture /></el-icon>
            <span>图片加载失败</span>
          </div>
        </template>
        <template #placeholder>
          <div class="image-slot">
            <el-icon><Loading /></el-icon>
            <span>图片加载中...</span>
          </div>
        </template>
      </el-image>
      
      <!-- 图片数量标签 -->
      <div v-if="validImages.length > 1" class="image-count-badge">
        <el-icon><Picture /></el-icon>
        <span>{{ validImages.length }}</span>
      </div>
    </div>
    
    <!-- 卡片内容 -->
    <div class="card-content">
      <!-- 载体名称 -->
      <div class="carrier-name-info">
        <el-icon class="info-icon"><Van /></el-icon>
        <template v-if="isEditing">
          <el-input 
            v-model="editingData.carrier_name" 
            placeholder="请输入载体名称"
            size="small"
            class="edit-input"
          />
        </template>
        <template v-else>
          <span class="carrier-name-text" :title="carrierData.carrier_name">{{ carrierData.carrier_name || '未设置' }}</span>
        </template>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions">
      <template v-if="isEditing">
        <el-button
          type="success"
          :icon="Check"
          circle
          size="small"
          @click.stop="handleSave"
          title="保存"
        />
        <el-button
          type="warning"
          :icon="Close"
          circle
          size="small"
          @click.stop="handleCancelEdit"
          title="取消"
        />
      </template>
      <template v-else>
        <el-button
          type="primary"
          :icon="Edit"
          circle
          size="small"
          @click.stop="handleEdit"
          title="编辑"
        />
        <el-button
          type="success"
          :icon="Download"
          circle
          size="small"
          @click.stop="handleDownload"
          title="下载"
        />
        <el-button
          type="danger"
          :icon="Delete"
          circle
          size="small"
          @click.stop="handleDelete"
          title="删除"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { 
  Picture, 
  Loading, 
  Collection, 
  Clock,
  Edit,
  Download,
  Delete,
  Van,
  Check,
  Close,
  Goods,
  Tools,
  PriceTag,
  List,
  UserFilled,
  Monitor,
  Link
} from '@element-plus/icons-vue'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'

// 定义Props
interface Props {
  carrier: {
    id: number
    carrier_name: string
    batch: string
    material: string
    process: string
    weight: number
    packaging_method: string
    packaging_size: string
    price: number
    minimum_order_quantity: number
    supplier: string
    supplier_order_link: string
    images: string[]
    reference_images: string[]
    create_time: string
    update_time: string
  }
  selected?: boolean
  cardWidth?: number
  cardHeight?: number
}

const props = defineProps<Props>()

// 定义Emits
const emit = defineEmits<{
  select: [id: number, selected: boolean]
  edit: [carrier: Props['carrier']]
  update: [carrier: Props['carrier']]
  delete: [carrier: Props['carrier']]
  download: [carrier: Props['carrier']]
  resize: [id: number, width: number, height: number]
}>()

// 响应式数据
const isSelected = computed(() => props.selected || false)
const isEditing = ref(false)
const cardRef = ref<HTMLElement>()
const imageRefreshKey = ref(0)

// 编辑数据
const editingData = reactive({
  carrier_name: ''
})

// 计算属性
const carrierData = computed(() => props.carrier)

const cardWidth = computed(() => props.cardWidth || 200)
const cardHeight = computed(() => props.cardHeight || 200)

const displayImage = computed(() => {
  const DEFAULT_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect fill="#f0f0f0" width="300" height="200"/><text fill="#999" font-family="sans-serif" font-size="14" text-anchor="middle" x="150" y="105">No Image</text></svg>')
  const validImages = getValidImages()

  if (validImages.length === 0) return DEFAULT_IMAGE

  try {
    const proxyUrl = ImageUrlUtil.getThumbnailUrlSync(validImages[0], 'large')
    return proxyUrl || DEFAULT_IMAGE
  } catch (error) {
    console.error('生成图片URL失败:', error)
    return DEFAULT_IMAGE
  }
})

// 方法
const getValidImages = () => {
  const referenceImages = carrierData.value.reference_images || []
  const draftImages = carrierData.value.images || []
  
  const allImages = [...referenceImages, ...draftImages]
  
  return allImages.filter(image => {
    return typeof image === 'string' && image.trim() !== '' && 
           (image.includes('cos.myqcloud.com') || 
            image.includes('tencentcos') || 
            image.includes('qcloud.com'))
  })
}

const validImages = computed(() => getValidImages())

const handleSelect = () => {
  emit('select', carrierData.value.id, !isSelected.value)
}

const handleImageClick = () => {
  handleSelect()
}

const handleEdit = () => {
  // 进入编辑模式，复制当前数据到编辑数据
  Object.assign(editingData, {
    carrier_name: carrierData.value.carrier_name
  })
  isEditing.value = true
}

const handleSave = () => {
  // 保存编辑数据
  const updatedCarrier = {
    ...carrierData.value,
    ...editingData
  }
  emit('update', updatedCarrier)
  isEditing.value = false
}

const handleCancelEdit = () => {
  isEditing.value = false
}

const handleDelete = () => {
  emit('delete', carrierData.value)
}

const handleDownload = () => {
  emit('download', carrierData.value)
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleDateString('zh-CN')
}

const handleImageError = () => {
  imageRefreshKey.value++
}
</script>

<style scoped lang="scss">
.carrier-card {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  min-height: 200px;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }

  &.editing {
    border-color: #67c23a;
    box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.2);
  }
}

.card-image-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  
  .el-icon {
    font-size: 48px;
    margin-bottom: 8px;
  }
  
  span {
    font-size: 14px;
  }
}

.image-count-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2;
}

.card-content {
  padding: 8px 12px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 32px;
  max-height: 40px;
}

.carrier-name-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  
  .info-icon {
    color: #909399;
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .carrier-name-text {
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    font-weight: 500;
  }
  
  .edit-input {
    flex: 1;
    --el-input-height: 28px;
  }
}

.card-actions {
  padding: 0 12px 8px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex: none;
}

// 响应式设计
@media (max-width: 900px) {
  .card-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .card-content {
    padding: 6px 10px;
  }
}
</style>