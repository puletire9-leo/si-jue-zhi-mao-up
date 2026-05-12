<template>
  <div class="lazy-image-container" ref="containerRef">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="lazy-image-loading">
      <el-skeleton :rows="1" animated />
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="hasError" class="lazy-image-error">
      <el-icon class="error-icon"><PictureFilled /></el-icon>
      <div class="error-text">{{ errorText }}</div>
      <el-button type="text" @click="retryLoad" size="small">重试</el-button>
    </div>
    
    <!-- 图片容器 -->
    <div v-else class="lazy-image-wrapper">
      <template v-if="useSpan">
        <span
          class="lazy-image-span"
          :style="{
            ...imageStyle,
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: fit,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }"
          @click="$emit('click')"
        />
      </template>
      <template v-else>
        <el-image
          ref="imageRef"
          :src="imageUrl"
          :lazy="true"
          :placeholder="placeholderUrl"
          :fit="fit"
          :preview-src-list="previewSrcList"
          @load="handleLoad"
          @error="handleError"
          :style="imageStyle"
        >
          <template #placeholder>
            <div class="image-placeholder">
              <el-icon class="placeholder-icon"><PictureFilled /></el-icon>
            </div>
          </template>
        </el-image>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, PropType } from 'vue'
import { PictureFilled } from '@element-plus/icons-vue'
import { getThumbnailUrlSync, ImageSize } from '@/utils/imageUrlUtil'
import { imageCache } from '@/utils/imageCache'
import { imageCacheOptimizer } from '@/utils/imageCacheOptimizer'

// 组件属性定义
const props = defineProps({
  /** 图片ID，用于缓存 */
  imageId: {
    type: [String, Number],
    required: true
  },
  /** 图片URL，如果提供则直接使用 */
  src: {
    type: String,
    default: ''
  },
  /** 图片宽度 */
  width: {
    type: [String, Number],
    default: 'auto'
  },
  /** 图片高度 */
  height: {
    type: [String, Number],
    default: 'auto'
  },
  /** 图片填充方式 */
  fit: {
    type: String as PropType<'fill' | 'contain' | 'none' | 'cover' | 'scale-down' | ''>,
    default: 'cover'
  },
  /** 是否预加载图片 */
  preload: {
    type: Boolean,
    default: false
  },
  /** 占位符图片URL */
  placeholder: {
    type: String,
    default: ''
  },
  /** 错误提示文本 */
  errorText: {
    type: String,
    default: '图片加载失败'
  },
  /** 预览图片列表，用于大图预览 */
  previewSrcList: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  /** 是否使用span元素显示（适用于背景图方式） */
  useSpan: {
    type: Boolean,
    default: false
  },
  /** 图片尺寸类型 */
  size: {
    type: String as PropType<ImageSize>,
    default: 'large'
  }
})

// 组件事件定义
const emit = defineEmits([
  'load',      // 图片加载成功
  'error',     // 图片加载失败
  'click'      // 图片点击事件
])

// 响应式数据
const containerRef = ref<HTMLElement | null>(null)
const imageRef = ref<any>(null)
const isLoading = ref(true)
const hasError = ref(false)
const retryCount = ref(0)
const maxRetries = 3

// 计算属性
const imageUrl = computed(() => {
  if (!props.src) return ''
  
  // 使用统一的缩略图URL获取方法
  return getThumbnailUrlSync(props.src, props.size)
})

const placeholderUrl = computed(() => {
  return props.placeholder || ''
})

const imageStyle = computed(() => {
  return {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height
  }
})

// 方法定义
/**
 * 处理图片加载成功
 */
const handleLoad = (event: Event) => {
  isLoading.value = false
  hasError.value = false
  retryCount.value = 0
  
  // 缓存图片URL
  if (props.src) {
    imageCache.setImageUrl(props.imageId.toString(), props.src)
  }
  
  emit('load', event)
}

/**
 * 处理图片加载失败
 */
const handleError = (event: Event) => {
  isLoading.value = false
  hasError.value = true
  retryCount.value++
  
  emit('error', event)
}

/**
 * 重试加载图片
 */
const retryLoad = () => {
  if (retryCount.value >= maxRetries) {
    return
  }
  
  isLoading.value = true
  hasError.value = false
  retryCount.value++
  
  // 清除缓存，强制重新加载
  const cacheKey = `${props.src}_${props.size}_proxy`
  imageCache.removeImageUrl(cacheKey)
  imageCacheOptimizer.removeImage(cacheKey)
  
  // 重新加载图片
  if (props.useSpan === false && imageRef.value) {
    // 重置图片，触发重新加载
    const imgElement = imageRef.value.$el.querySelector('img')
    if (imgElement) {
      imgElement.src = ''
      setTimeout(() => {
        imgElement.src = imageUrl.value
      }, 100)
    }
  }
}

/**
 * 预加载图片
 */
const preloadImage = () => {
  if (!props.src) return
  
  const img = new Image()
  img.src = imageUrl.value
  img.onload = () => {
    console.log('预加载图片成功:', props.src)
  }
  img.onerror = (error) => {
    console.error(`预加载图片失败: ${props.src}`, error)
  }
}

/**
 * 检查元素是否在视口中
 */
const checkInViewport = () => {
  if (!containerRef.value) return false
  
  const rect = containerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  
  // 提前100px开始加载
  const offset = 100
  
  return (
    rect.top < viewportHeight + offset &&
    rect.bottom > -offset &&
    rect.left < viewportWidth + offset &&
    rect.right > -offset
  )
}

// 监听图片URL变化
watch(() => props.src, (newSrc, oldSrc) => {
  if (newSrc !== oldSrc) {
    isLoading.value = true
    hasError.value = false
    retryCount.value = 0
    
    // 如果启用了预加载，且URL变化，重新预加载
    if (props.preload) {
      preloadImage()
    }
  }
})

// 监听预加载属性变化
watch(() => props.preload, (newPreload) => {
  if (newPreload) {
    preloadImage()
  }
})

// 生命周期钩子
onMounted(() => {
  // 如果启用了预加载，立即预加载图片
  if (props.preload) {
    preloadImage()
  }
})

onUnmounted(() => {
  // 组件卸载时清理资源
})
</script>

<style scoped lang="scss">
.lazy-image-container {
  position: relative;
  display: inline-block;
  overflow: hidden;
  background-color: #f5f7fa;
  border-radius: 4px;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
}

.lazy-image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.lazy-image-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

.lazy-image-error {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  color: #909399;
  padding: 20px;
  
  .error-icon {
    font-size: 48px;
    margin-bottom: 12px;
    color: #e6a23c;
  }
  
  .error-text {
    font-size: 14px;
    margin-bottom: 8px;
  }
}

.lazy-image-wrapper :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.lazy-image-wrapper :deep(.el-image__inner) {
  transition: opacity 0.3s ease;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  
  .placeholder-icon {
    font-size: 32px;
    color: #c0c4cc;
  }
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
}

.lazy-image-span {
  display: inline-block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  transition: opacity 0.3s ease;
}

.lazy-image-span:hover {
  opacity: 0.9;
}
</style>
