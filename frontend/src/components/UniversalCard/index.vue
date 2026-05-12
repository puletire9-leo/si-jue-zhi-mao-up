<template>
  <div class="universal-card" :class="{ selected: isSelected }" @click="handleCardClick">
    <el-checkbox
      v-model="isSelected"
      class="card-checkbox"
      @click.stop
      @change="handleSelect"
    />
    
    <div class="card-image-wrapper">
      <el-image
        :src="getImageUrl()"
        :preview="false"
        fit="cover"
        class="card-image"
        lazy
        @click.stop="handleImageClick"
      >
        <template #error>
          <div class="image-slot">
            <el-icon><Picture /></el-icon>
          </div>
        </template>
      </el-image>
      
      <div v-if="showTypeBadge && productType" class="card-type-badge" :class="productType">
        {{ typeBadgeText }}
      </div>
      
      <div v-if="showSalesVolume && salesVolume" class="card-sales-badge">
        <el-icon><TrendCharts /></el-icon>
        <span>{{ formatSalesVolume(salesVolume) }}</span>
      </div>

      <!-- 等级徽章 -->
      <div v-if="grade" class="card-grade-badge" :style="{ background: gradeColor }">
        {{ grade }}
      </div>

      <!-- 时效标签 -->
      <div v-if="timeTag" class="card-time-tag" :class="timeTagClass">
        {{ timeTag }}
      </div>
      
      <!-- 链接按钮组 -->
      <div class="card-link-buttons">
        <!-- 产品链接按钮 -->
        <div v-if="showProductLink && productLink" class="card-link-button product-link" @click.stop="handleProductLink" title="产品链接">
          <el-icon><Link /></el-icon>
          <span class="link-text">产品</span>
        </div>
        
        <!-- 相似图片链接按钮 -->
        <div v-if="showSimilarProductsLink && similarProductsLink" class="card-link-button similar-products-link" @click.stop="handleSimilarProductsLink" title="相似图片链接">
          <el-icon><Link /></el-icon>
          <span class="link-text">相似图片</span>
        </div>
      </div>
      
      <div class="card-actions">
        <el-button
          v-if="showViewButton"
          type="primary"
          :icon="View"
          circle
          size="small"
          @click.stop="handleView"
        />
        <el-button
          type="danger"
          :icon="Delete"
          circle
          size="small"
          @click.stop="handleDelete"
        />
      </div>
    </div>
    
    <div class="card-content">
      <div v-if="showId" class="card-id" :title="idText">
        {{ idText }}
      </div>
      <div class="card-title" :title="titleText">
        {{ titleText }}
      </div>
      
      <div v-if="showMeta" class="card-meta">
        <div v-if="price" class="meta-item">
          <el-icon class="meta-icon"><Money /></el-icon>
          <span class="meta-value">¥{{ price }}</span>
        </div>
        <div v-if="storeName" class="meta-item">
          <el-icon class="meta-icon"><Shop /></el-icon>
          <span class="meta-value" :title="storeName">{{ storeName }}</span>
        </div>
        <div v-if="category" class="meta-item">
          <el-icon class="meta-icon"><Folder /></el-icon>
          <span class="meta-value">{{ category }}</span>
        </div>
      </div>
      
      <div v-if="showTags && tags && tags.length > 0" class="card-tags">
        <el-tag
          v-for="(tag, index) in tags.slice(0, 3)"
          :key="index"
          size="small"
          type="info"
          effect="plain"
        >
          {{ tag }}
        </el-tag>
        <el-tag
          v-if="tags.length > 3"
          size="small"
          type="info"
          effect="plain"
        >
          +{{ tags.length - 3 }}
        </el-tag>
      </div>
      
      <div v-if="showTypeTag && typeTagText" class="card-type-tag">
        <el-tag :type="getTypeTagType()" size="small">
          {{ typeTagText }}
        </el-tag>
      </div>
      
      <div v-if="(showCreateTime && createTime) || (props.mode === 'selection' && props.product.listingDate)" class="card-footer">
        <span class="create-time">
          {{ props.mode === 'selection' && props.product.listingDate ? formatListingDate(props.product.listingDate) : formatCreateTime(createTime) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Picture, Money, Shop, Folder, View, Delete, TrendCharts, Link } from '@element-plus/icons-vue'
import type { CheckboxValueType } from 'element-plus'

interface Props {
  product: Record<string, any>
  selected?: boolean
  mode?: 'product' | 'selection'
}

interface Emits {
  (e: 'click', product: Record<string, any>): void
  (e: 'select', id: string | number, selected: boolean): void
  (e: 'delete', product: Record<string, any>): void
  (e: 'view', product: Record<string, any>): void
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  mode: 'product'
})

const emit = defineEmits<Emits>()

const isSelected = ref<boolean>(props.selected)

watch(() => props.selected, (newVal: boolean) => {
  isSelected.value = newVal
})

const modeConfig = computed(() => {
  if (props.mode === 'selection') {
    return {
      showId: true,
      idField: 'asin',
      showTitle: true,
      titleField: 'productTitle',
      showMeta: true,
      showTags: true,
      showTypeBadge: true,
      typeField: 'productType',
      showTypeTag: false,
      showCreateTime: true,
      showViewButton: true,
      showSalesVolume: true,
      showProductLink: true,
      showSimilarProductsLink: true
    }
  }
  return {
    showId: true,
    idField: 'sku',
    showTitle: true,
    titleField: 'name',
    showMeta: false,
    showTags: false,
    showTypeBadge: false,
    typeField: null,
    showTypeTag: true,
    showCreateTime: false,
    showViewButton: false,
    showSalesVolume: false,
    showProductLink: false,
    showSimilarProductsLink: false
  }
})

const showId = computed(() => modeConfig.value.showId)
const idText = computed(() => props.product[modeConfig.value.idField] || '')
const showTitle = computed(() => modeConfig.value.showTitle)
const titleText = computed(() => props.product[modeConfig.value.titleField] || '')
const showMeta = computed(() => modeConfig.value.showMeta)
const price = computed(() => props.product.price)
const storeName = computed(() => props.product.storeName)
const category = computed(() => props.product.category)
const showTags = computed(() => modeConfig.value.showTags)
const tags = computed(() => props.product.tags)
const showTypeBadge = computed(() => modeConfig.value.showTypeBadge)
const productType = computed(() => props.product[modeConfig.value.typeField])
const typeBadgeText = computed(() => {
  if (props.mode === 'selection') {
    return props.product.productType === 'new' ? '新品' : '竞品'
  }
  return ''
})
const showTypeTag = computed(() => modeConfig.value.showTypeTag)
const typeTagText = computed(() => props.product.type || '')
const showCreateTime = computed(() => modeConfig.value.showCreateTime)
const createTime = computed(() => props.product.createdAt || props.product.created_at)
const showViewButton = computed(() => modeConfig.value.showViewButton)
const showSalesVolume = computed(() => modeConfig.value.showSalesVolume)
const salesVolume = computed(() => props.product.salesVolume)
const showProductLink = computed(() => modeConfig.value.showProductLink)
const productLink = computed(() => props.product.productLink)
const showSimilarProductsLink = computed(() => modeConfig.value.showSimilarProductsLink)
const similarProductsLink = computed(() => props.product.similarProducts || props.product.similarProductsLink)

const grade = computed(() => props.product.grade)
const gradeColor = computed(() => {
  const colors: Record<string, string> = {
    'S': '#67C23A',
    'A': '#409EFF',
    'B': '#E6A23C',
    'C': '#909399',
    'D': '#F56C6C'
  }
  return colors[props.product.grade] || '#909399'
})

// 时效标签：根据 created_at/createdAt 判断
const timeTag = computed(() => {
  // 兼容后端返回的 created_at 和前端使用的 createdAt
  const createdAt = props.product.createdAt || props.product.created_at
  if (!createdAt) return null

  const now = new Date()
  const created = new Date(createdAt)

  // 调试信息（开发时使用）
  // console.log('时效标签调试:', { createdAt, created: created.toISOString(), now: now.toISOString() })

  // 计算本周一（ISO 周，周一开始）
  const dayOfWeek = now.getDay() || 7 // 周日=7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)

  if (created >= monday) {
    return '本周上架'
  }

  // 计算天数差
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 30) {
    return '过时'
  } else if (diffDays > 7) {
    return `${diffDays}天前`
  } else if (diffDays > 0) {
    return `${diffDays}天前`
  } else {
    return '今天'
  }
})

const timeTagClass = computed(() => {
  const tag = timeTag.value
  if (tag === '本周上架' || tag === '今天') return 'time-current'
  if (tag === '过时') return 'time-outdated'
  return 'time-normal'
})

const getImageUrl = (): string => {
  // 优先显示参考图
  const referenceImages = props.product.reference_images || props.product.referenceImages || []
  if (Array.isArray(referenceImages) && referenceImages.length > 0) {
    return referenceImages[0]
  }
  
  // 检查单个参考图字段
  if (props.product.referenceImage) {
    return props.product.referenceImage
  }
  
  // 原有的图片显示逻辑
  if (props.product.thumbPath) {
    return `/images/${props.product.thumbPath}`
  }
  if (props.product.localPath) {
    return `/images/${props.product.localPath}`
  }
  if (props.product.imageUrl) {
    return props.product.imageUrl
  }
  if (props.product.image) {
    return props.product.image
  }
  return '/images/default.png'
}

const getPreviewImages = (): string[] => {
  const images: string[] = []
  
  // 优先添加参考图
  const referenceImages = props.product.reference_images || props.product.referenceImages || []
  if (Array.isArray(referenceImages)) {
    images.push(...referenceImages)
  }
  
  // 检查单个参考图字段
  if (props.product.referenceImage) {
    images.push(props.product.referenceImage)
  }
  
  // 添加原有图片
  if (props.product.localPath) {
    images.push(`/images/${props.product.localPath}`)
  }
  if (props.product.imageUrl) {
    images.push(props.product.imageUrl)
  }
  if (props.product.image) {
    images.push(props.product.image)
  }
  
  // 去重处理
  return [...new Set(images)]
}

const formatCreateTime = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes < 1 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

const formatListingDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}

const formatSalesVolume = (volume: number | null | undefined): string => {
  if (!volume) return '0'
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`
  }
  return volume.toString()
}

const getTypeTagType = (): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const type = props.product.type
  if (type === '普通产品') return 'info'
  if (type === '组合产品') return 'warning'
  if (type === '定制产品') return 'success'
  return 'info'
}

const handleClick = (): void => {
  emit('click', props.product)
}

const handleCardClick = (): void => {
  emit('click', props.product)
}

const handleImageClick = (): void => {
  emit('click', props.product)
}

const handleSelect = (value: CheckboxValueType): void => {
  const id = props.product[modeConfig.value.idField]
  emit('select', id, !!value)
}

const handleView = (): void => {
  emit('view', props.product)
}

const handleDelete = (): void => {
  emit('delete', props.product)
}

const handleProductLink = (): void => {
  if (props.product.productLink) {
    window.open(props.product.productLink, '_blank')
  }
}

const handleSimilarProductsLink = (): void => {
  const link = props.product.similarProducts || props.product.similarProductsLink
  if (link) {
    window.open(link, '_blank')
  }
}
</script>

<style scoped lang="scss">
.universal-card {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
  }

  &.selected {
    border: 2px solid #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  }
}

.card-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  overflow: hidden;

  .card-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
  }

  &:hover .card-image {
    transform: scale(1.05);
  }

  .image-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 48px;
    color: #cbd5e1;
  }

  .card-type-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;

    &.new {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.reference {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
  }

  .card-sales-badge {
    position: absolute;
    bottom: 10px;
    left: 10px;
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    display: flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
    z-index: 5;

    .el-icon {
      font-size: 14px;
    }

    span {
      font-size: 14px;
    }
  }

  .card-grade-badge {
    position: absolute;
    top: 10px;
    left: 40px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }

  .card-time-tag {
    position: absolute;
    top: 10px;
    left: 75px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    z-index: 10;
    white-space: nowrap;

    &.time-current {
      background: linear-gradient(135deg, #67C23A, #85ce61);
      box-shadow: 0 2px 6px rgba(103, 194, 58, 0.4);
    }

    &.time-outdated {
      background: linear-gradient(135deg, #909399, #b1b3b8);
      box-shadow: 0 2px 6px rgba(144, 147, 153, 0.4);
    }

    &.time-normal {
      background: linear-gradient(135deg, #409EFF, #66b1ff);
      box-shadow: 0 2px 6px rgba(64, 158, 255, 0.4);
    }
  }

  // 链接按钮组容器
  .card-link-buttons {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    z-index: 5;
  }

  .card-link-button {
    width: auto;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    gap: 4px;

    &:hover {
      transform: scale(1.05);
    }

    .el-icon {
      font-size: 14px;
      color: #fff;
    }

    .link-text {
      font-size: 12px;
      color: #fff;
      font-weight: 500;
      white-space: nowrap;
    }

    // 产品链接按钮样式
    &.product-link {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);

      &:hover {
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
      }
    }

    // 相似图片链接按钮样式
    &.similar-products-link {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);

      &:hover {
        box-shadow: 0 6px 16px rgba(17, 153, 142, 0.5);
      }
    }
  }

  .card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    gap: 4px;
    z-index: 10;
  }

  &:hover .card-actions {
    opacity: 1;
  }
}

.card-content {
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-id {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #64748b;

    .meta-icon {
      font-size: 14px;
      color: #94a3b8;
    }

    .meta-value {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.card-type-tag {
  margin-top: auto;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  margin-top: auto;

  .create-time {
    font-size: 12px;
    color: #94a3b8;
  }
}
</style>
