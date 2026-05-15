<template>
  <div class="draft-card" :class="{ selected: isSelected }">
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
    <div class="card-content" :class="{ 'only-element': onlyShowElement }">
      <!-- 元素信息 -->
      <div class="element-info">
        <el-icon class="info-icon"><CirclePlus /></el-icon>
        <span class="element-text" :title="draft.element">{{ draft.element || '未设置' }}</span>
      </div>
      
      <!-- 其他信息 - 只在非仅显示元素模式下显示 -->
      <template v-if="!onlyShowElement">
        <!-- SKU信息 -->
        <div class="sku-info">
          <el-icon class="info-icon"><PriceTag /></el-icon>
          <span class="sku-text" :title="draft.sku">{{ draft.sku }}</span>
        </div>
        
        <!-- 批次信息 -->
        <div class="batch-info">
          <el-icon class="info-icon"><Collection /></el-icon>
          <span class="batch-text" :title="draft.batch">
            {{ draft.batch }}
            <span class="batch-count" v-if="!batchCountLoading">
              ({{ batchCount }})
            </span>
            <span class="batch-count-loading" v-else>
              <el-icon class="el-icon-loading"></el-icon>
            </span>
          </span>
        </div>
        
        <!-- 开发人信息 -->
        <div class="developer-info">
          <el-icon class="info-icon"><User /></el-icon>
          <span class="developer-text" :title="developerDisplayName">{{ developerDisplayName }}</span>
        </div>
        
        <!-- 时间信息 -->
        <div class="time-info">
          <el-icon class="info-icon"><Clock /></el-icon>
          <span class="time-text">{{ formatTime(draft.createTime) }}</span>
        </div>
        
        <!-- 载体信息 -->
        <div class="carrier-info">
          <el-icon class="info-icon"><Van /></el-icon>
          <span class="carrier-text" :title="draft.carrier">{{ draft.carrier || '未选择载体' }}</span>
        </div>
        
        <!-- 修改要求 -->
        <div class="modification-info">
          <div class="modification-content">
            <el-icon class="info-icon"><EditPen /></el-icon>
            <span class="modification-text" :title="draft.modificationRequirement">{{ draft.modificationRequirement || '无' }}</span>
          </div>
          <div v-if="!onlyMaterialImages" class="status-badge" :class="draft.status">
            {{ statusText }}
          </div>
        </div>

        <!-- 侵权标注 -->
        <div v-if="draft.infringementLabel" class="infringement-info">
          <div class="infringement-label">
            <el-icon class="info-icon"><Warning /></el-icon>
            <span class="label-text">侵权标注</span>
          </div>
          <div class="infringement-content" :title="draft.infringementLabel">
            {{ draft.infringementLabel }}
          </div>
        </div>
      </template>
    </div>
    
    <!-- 操作按钮 -->
    <div class="card-actions">
      <el-button
        type="primary"
        :icon="Edit"
        circle
        size="small"
        @click.stop="handleEdit"
      />
      <el-button
        type="success"
        :icon="Download"
        circle
        size="small"
        @click.stop="handleDownload"
      />
      <el-button
        v-if="canDelete"
        type="danger"
        :icon="Delete"
        circle
        size="small"
        @click.stop="handleDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
// import { 
//   Picture, 
//   Loading, 
//   PriceTag, 
//   Collection, 
//   User, 
//   Clock,
//   Edit,
//   Download,
//   Delete,
//   Van,
//   CirclePlus,
//   EditPen
// } from '@element-plus/icons-vue'
// 使用字符串代替图标，减少内存占用
const Picture = 'Picture'
const Loading = 'Loading'
const PriceTag = 'PriceTag'
const Collection = 'Collection'
const User = 'User'
const Clock = 'Clock'
const Edit = 'Edit'
const Download = 'Download'
const Delete = 'Delete'
const Van = 'Van'
const CirclePlus = 'CirclePlus'
const EditPen = 'EditPen'
const Warning = 'Warning'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'

// 用户名到中文名称的映射
const usernameToDeveloperMap: Record<string, string> = {
  'hanjinlu': '韩金路',
  'liumiao': '刘淼'
  // 可以添加更多映射
}

// 定义Props
interface Props {
  draft: {
    id: number
    element?: string
    sku: string
    batch: string
    developer: string
    carrier: string
    modificationRequirement?: string
    infringementLabel?: string
    images: string[]
    reference_images: string[]
    createTime: string
    updateTime: string
    status: 'finalized' | 'optimizing' | 'concept'
    localThumbnailPath?: string
    localThumbnailStatus?: string
  }
  selected?: boolean
  onlyMaterialImages?: boolean
  onlyShowElement?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  onlyMaterialImages: false,
  onlyShowElement: false
})

// 定义Emits
const emit = defineEmits<{
  select: [id: number, selected: boolean]
  edit: [draft: Props['draft']]
  delete: [draft: Props['draft']]
  download: [draft: Props['draft']]
}>()

// 用户状态管理
const userStore = useUserStore()

// 判断是否有删除权限（非仓库角色）
const canDelete = computed(() => {
  const role = userStore.userInfo?.role
  return role !== '仓库'
})

// 响应式数据 - 使用computed确保响应props.selected的变化
const isSelected = computed(() => props.selected || false)

// 批次数量相关数据
const batchCount = ref(0)
const batchCountLoading = ref(false)

// 图片刷新相关数据
const imageRefreshKey = ref(0)

// 本地缩略图状态跟踪
const localThumbnailFailed = ref(false)

// 默认图片URL - 使用公开的占位图片服务
const DEFAULT_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect fill="#f0f0f0" width="300" height="200"/><text fill="#999" font-family="sans-serif" font-size="14" text-anchor="middle" x="150" y="105">No Image</text></svg>')

// 计算属性
const validImages = computed(() => {
  // 同时支持 snake_case 和 camelCase 格式的字段
  const referenceImages = (props.draft as any).reference_images || (props.draft as any).referenceImages || []
  const draftImages = (props.draft as any).images || (props.draft as any).finalDraftImages || []
  
  // 当 onlyMaterialImages 为 true 时，只使用素材图片
  // 否则合并效果图和设计稿，效果图优先
  let allImages: string[] = []
  if (props.onlyMaterialImages) {
    allImages = [...draftImages]
  } else {
    allImages = [...referenceImages, ...draftImages]
  }
  
  // 确保只包含有效的腾讯云COS URL，并修复URL格式
  return allImages.filter(image => {
    return typeof image === 'string' && image.trim() !== '' && 
           (image.includes('cos.myqcloud.com') || 
            image.includes('tencentcos') || 
            image.includes('qcloud.com') ||
            image.includes('/api/v1/image-proxy/proxy'))
  }).map(image => {
    // 修复URL格式：移除空的q-url-param-list参数
    if (typeof image === 'string') {
      // 修复 q-url-param-list=&q-signature= 格式问题
      if (image.includes('q-url-param-list=&q-signature=')) {
        return image.replace('q-url-param-list=&q-signature=', 'q-signature=')
      }
      // 修复 &q-url-param-list=& 格式问题
      if (image.includes('&q-url-param-list=&')) {
        return image.replace('&q-url-param-list=&', '&')
      }
      // 修复 q-url-param-list=& 格式问题
      if (image.includes('q-url-param-list=&')) {
        return image.replace('q-url-param-list=&', '')
      }
      // 修复 &q-url-param-list= 格式问题
      if (image.includes('&q-url-param-list=')) {
        return image.replace('&q-url-param-list=', '')
      }
    }
    return image
  })
})

const mainImage = computed(() => {
  // 获取第一张有效图片
  // 当 onlyMaterialImages 为 true 时优先显示素材图片
  // 否则优先显示效果图
  if (validImages.value.length > 0) {
    return validImages.value[0]
  }
  return null
})

const displayImage = computed(() => {
  // 返回要显示的缩略图URL，如果没有有效图片则使用默认图片
  
  // 优先使用效果图（如果存在）
  if (mainImage.value) {
    try {
      // 使用同步版本的缩略图URL生成方法，确保返回字符串类型
      // 现在会自动使用后端代理URL，避免ORB错误
      const proxyUrl = ImageUrlUtil.getThumbnailUrlSync(mainImage.value, 'large')
      
      // 验证返回的URL
      if (proxyUrl) {
        console.log('使用图片URL:', {
          draftId: props.draft.id,
          draftSku: props.draft.sku,
          url: proxyUrl,
          isProxyUrl: proxyUrl.includes('/api/v1/image-proxy/proxy'),
          isCosUrl: proxyUrl.includes('cos.myqcloud.com'),
          originalUrl: mainImage.value,
          imageType: props.draft.reference_images?.includes(mainImage.value) ? '效果图' : '设计稿'
        })
        return proxyUrl
      } else {
        console.warn('返回的URL为空，使用默认图片:', {
          draftId: props.draft.id,
          draftSku: props.draft.sku
        })
      }
    } catch (error) {
      console.error('生成图片URL失败:', {
        error: error instanceof Error ? error.message : error,
        draftId: props.draft.id,
        draftSku: props.draft.sku,
        originalUrl: mainImage.value
      })
      
      // 尝试使用原始URL作为备选
      if (mainImage.value.includes('cos.myqcloud.com')) {
        console.log('使用原始COS URL作为备选:', {
          draftId: props.draft.id,
          draftSku: props.draft.sku,
          originalUrl: mainImage.value
        })
        return mainImage.value
      }
    }
  }
  
  // 只有在没有有效图片时才使用本地缩略图路径
  if (props.draft.localThumbnailPath && !localThumbnailFailed.value) {
    console.log('使用本地缩略图路径:', {
      draftId: props.draft.id,
      draftSku: props.draft.sku,
      localThumbnailPath: props.draft.localThumbnailPath,
      localThumbnailStatus: props.draft.localThumbnailStatus,
      localThumbnailFailed: localThumbnailFailed.value
    })
    try {
      const localUrl = ImageUrlUtil.getThumbnailUrlSync(props.draft.localThumbnailPath, 'large')
      if (localUrl) {
        return localUrl
      }
    } catch (error) {
      console.error('生成本地缩略图URL失败:', {
        error: error instanceof Error ? error.message : error,
        draftId: props.draft.id,
        draftSku: props.draft.sku,
        localThumbnailPath: props.draft.localThumbnailPath
      })
    }
  } else if (localThumbnailFailed.value) {
    console.log('本地缩略图已失败，跳过本地缩略图路径:', {
      draftId: props.draft.id,
      draftSku: props.draft.sku
    })
  }
  
  // 如果没有任何有效图片，使用默认图片
  return DEFAULT_IMAGE
})

const statusText = computed(() => {
  const statusMap = {
    'finalized': '已定稿',
    'optimizing': '未完成在优化',
    'concept': '构思'
  }
  return statusMap[props.draft.status] || '未知'
})

// 计算开发者显示名称
const developerDisplayName = computed(() => {
  const developer = props.draft.developer
  if (!developer) return '未设置'
  
  // 检查是否为用户名，如果是则转换为中文名称
  if (usernameToDeveloperMap[developer]) {
    return usernameToDeveloperMap[developer]
  }
  
  return developer
})

// 获取批次数量的方法
const getBatchCount = async (): Promise<void> => {
  if (!props.draft.batch) return
  
  batchCountLoading.value = true
  try {
    // 导入finalDraftApi
    const { finalDraftApi } = await import('@/api/finalDraft')
    const response = await finalDraftApi.getBatchCount(props.draft.batch)
    if (response.code === 200) {
      batchCount.value = response.data.count
    }
  } catch (error) {
    console.error('获取批次数量失败:', error)
  } finally {
    batchCountLoading.value = false
  }
}

// 监听props.draft变化，更新批次数量
watch(() => props.draft.batch, () => {
  getBatchCount()
}, { immediate: true })

// 方法
const handleSelect = (): void => {
  // 发射select事件，传递当前卡片的id和新的选择状态（与当前状态相反）
  emit('select', props.draft.id, !isSelected.value)
}

const handleEdit = (): void => {
  emit('edit', props.draft)
}

const handleDelete = (): void => {
  emit('delete', props.draft)
}

const handleDownload = (): void => {
  emit('download', props.draft)
}

const handleImageClick = (): void => {
  // 图片点击事件，实现选择功能
  // 直接调用handleSelect，将最新的选择状态传递给父组件
  handleSelect()
}

const formatTime = (time: string): string => {
  return new Date(time).toLocaleDateString('zh-CN')
}

// 重试计数器，避免无限刷新
const imageRefreshCount = ref<Record<number, number>>({})

const handleImageError = async (e: Event) => {
  // 获取当前草稿ID
  const draftId = props.draft.id
  
  // 初始化刷新计数器
  if (!imageRefreshCount.value[draftId]) {
    imageRefreshCount.value[draftId] = 0
  }
  
  // 限制刷新次数，只刷新一次
  if (imageRefreshCount.value[draftId] >= 1) {
    console.warn('图片加载失败，已尝试刷新一次，停止继续刷新:', {
      draftId: props.draft.id,
      draftSku: props.draft.sku,
      imageUrl: displayImage.value
    })
    return
  }
  
  // 记录图片加载失败的详细信息，便于调试
  console.error('图片加载失败:', {
    imageUrl: displayImage.value,
    draftId: props.draft.id,
    draftSku: props.draft.sku,
    error: e,
    errorType: e.type,
    refreshCount: imageRefreshCount.value[draftId],
    timestamp: new Date().toISOString()
  })
  
  // 尝试刷新图片URL
  try {
    // 获取当前显示的图片URL
    const currentUrl = displayImage.value
    if (currentUrl === DEFAULT_IMAGE) return
    
    // 检查URL类型
    if (typeof currentUrl !== 'string') {
      console.error('当前URL不是字符串类型:', { type: typeof currentUrl, value: currentUrl })
      return
    }
    
    console.log('尝试刷新图片URL:', {
      currentUrl,
      draftId: props.draft.id,
      refreshCount: imageRefreshCount.value[draftId]
    })
    
    // 检查是否为本地缩略图URL
    const isLocalThumbnailUrl = currentUrl.includes('/api/v1/image-proxy/local')
    
    // 如果是本地缩略图URL失败，尝试回退到COS图片
    if (isLocalThumbnailUrl) {
      console.log('本地缩略图加载失败，尝试回退到COS图片')
      
      // 标记本地缩略图已失败
      localThumbnailFailed.value = true
      console.log('标记本地缩略图已失败:', {
        draftId: props.draft.id,
        draftSku: props.draft.sku
      })
      
      // 检查是否有有效的COS图片URL
      if (mainImage.value) {
        console.log('使用COS图片作为回退:', mainImage.value)
        
        // 增加刷新计数
        imageRefreshCount.value[draftId]++
        
        // 强制重新渲染，触发displayImage计算属性重新计算
        imageRefreshKey.value++
        console.log('已回退到COS图片并重新加载:', props.draft.id, props.draft.sku)
        return
      }
    }
    
    // 首先尝试本地修复URL格式
    let fixedUrl = currentUrl
    if (fixedUrl.includes('q-url-param-list=&')) {
      fixedUrl = fixedUrl.replace('q-url-param-list=&', '')
      console.log('本地修复URL格式:', fixedUrl)
    }
    
    if (fixedUrl !== currentUrl) {
      // 本地修复成功，强制重新渲染
      console.log('本地修复URL成功，新URL:', fixedUrl)
      imageRefreshKey.value++
      console.log('图片已重新加载:', props.draft.id, props.draft.sku)
      return
    }
    
    // 增加刷新计数
    imageRefreshCount.value[draftId]++
    
    // 调用ImageUrlUtil刷新图片URL
    const newUrl = await ImageUrlUtil.refreshImageUrl(currentUrl)
    
    if (newUrl && newUrl !== currentUrl) {
      console.log('图片URL刷新成功，新URL:', newUrl)
      
      // 验证新URL是否是代理URL
      if (newUrl.includes('/api/v1/image-proxy/proxy')) {
        // 更新imageRefreshKey，强制el-image重新渲染
        imageRefreshKey.value++
        console.log('图片已重新加载:', props.draft.id, props.draft.sku)
      } else {
        console.warn('刷新后得到的不是代理URL:', newUrl)
        // 尝试使用备用方案
        try {
          imageRefreshKey.value++
          console.log('强制重新渲染图片:', props.draft.id, props.draft.sku)
        } catch (renderError) {
          console.error('强制重新渲染失败:', renderError)
        }
      }
    } else {
      console.log('图片URL刷新失败或URL未变化:', currentUrl)
      
      // 尝试使用备用方案：直接构建代理URL
      try {
        if (currentUrl.includes('object_key=')) {
          console.log('尝试使用备用方案构建代理URL')
          imageRefreshKey.value++
          console.log('图片已通过备用方案重新加载:', props.draft.id, props.draft.sku)
        }
      } catch (backupError) {
        console.error('备用方案失败:', backupError)
      }
    }
  } catch (error) {
    console.error('刷新图片URL过程中发生错误:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      draftId: props.draft.id
    })
    
    // 尝试强制重新渲染
    try {
      imageRefreshKey.value++
      console.log('强制重新渲染图片:', props.draft.id, props.draft.sku)
    } catch (renderError) {
      console.error('强制重新渲染失败:', renderError)
    }
  }
}
</script>

<style scoped lang="scss">
.draft-card {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.3s ease;
  cursor: pointer;
  height: auto;
  min-height: 200px;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }
}

.card-image-wrapper {
  position: relative;
  height: 150px; /* 图片区域缩小 */
  overflow: hidden;
  flex-shrink: 0;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.status-badge {
    position: relative; /* 修改为相对定位 */
    padding: 4px 8px; /* 调整内边距 */
    margin-left: auto; /* 使其靠右 */
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    z-index: 2;
    white-space: nowrap;
    flex-shrink: 0;

    &.finalized {
      background: rgba(64, 158, 255, 0.15);
      color: #1890ff;
      border: 1px solid #409eff;
    }

    &.optimizing {
      background: rgba(230, 162, 60, 0.15);
      color: #fa8c16;
      border: 1px solid #e6a23c;
    }

    &.concept {
      background: rgba(245, 108, 108, 0.15);
      color: #f5222d;
      border: 1px solid #f56c6c;
    }
  }

.card-content {
  padding: 12px 16px;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  overflow: hidden;
  align-content: start;
  
  &.only-element {
    grid-template-columns: 1fr;
    padding: 8px 12px;
    gap: 4px;
    
    .element-info {
      font-size: 14px;
      font-weight: 500;
      
      .element-text {
        font-size: 14px;
        color: #303133;
      }
    }
  }
}

.element-info,
.sku-info,
.batch-info,
.developer-info,
.time-info,
.carrier-info,
.modification-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  
  .info-icon {
    color: #909399;
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .element-text,
  .sku-text,
  .batch-text,
  .developer-text,
  .time-text,
  .carrier-text,
  .modification-text {
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1; /* 文本占满剩余空间，将徽章挤到右侧 */
  }
  
  .batch-count {
    color: #606266;
    font-size: 12px;
    margin-left: 4px;
    font-weight: normal;
  }
  
  .batch-count-loading {
    font-size: 12px;
    margin-left: 4px;
    color: #909399;
  }
  
  .el-icon-loading {
    font-size: 12px;
    animation: rotating 2s linear infinite;
  }
  
  @keyframes rotating {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
}

/* 特别处理修改要求区域，确保徽章靠右 */
.modification-info {
  grid-column: span 2; /* 跨越两列，占据完整宽度 */
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: space-between; /* 两端对齐 */
}

.modification-info .modification-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1; /* 内容部分占满剩余空间 */
}

.modification-info .modification-text {
  flex: 1;
}

/* 侵权标注样式 */
.infringement-info {
  grid-column: span 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(245, 108, 108, 0.08);
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 6px;
  margin-top: 4px;
}

.infringement-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #f56c6c;
}

.infringement-label .info-icon {
  color: #f56c6c;
  font-size: 14px;
}

.infringement-content {
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
  word-break: break-all;
  padding-left: 20px;
}

// 响应式设计
@media (max-width: 900px) {
  .draft-card {
    min-height: 380px;
  }
  
  .card-image-wrapper {
    height: 220px;
  }
  
  .card-content {
    grid-template-columns: 1fr; /* 小屏幕下改为单列布局 */
  }
}

@media (max-width: 768px) {
  .draft-card {
    min-height: 360px;
  }
  
  .card-image-wrapper {
    height: 200px;
  }
  
  .card-content {
    padding: 10px 12px;
    gap: 6px;
  }
  
  .modification-info {
    flex-wrap: wrap; /* 小屏幕下允许换行 */
    gap: 6px;
    
    .modification-content {
      flex: 1 1 100%; /* 内容部分占满一行 */
    }
    
    .status-badge {
      margin-left: 0; /* 小屏幕下取消自动外边距 */
    }
  }
}

@media (max-width: 480px) {
  .draft-card {
    min-height: 340px;
  }
  
  .card-image-wrapper {
    height: 180px;
  }
  
  .card-content {
    padding: 8px 10px;
    gap: 4px;
  }
}

@media (max-width: 360px) {
  .draft-card {
    min-height: 320px;
  }
  
  .card-image-wrapper {
    height: 160px;
  }
  
  .card-content {
    font-size: 12px;
  }
}

.card-actions {
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: auto;
  
  .el-button {
    padding: 4px;
    min-width: 32px;
    height: 32px;
  }
}
</style>