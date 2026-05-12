<template>
  <div 
    class="virtual-list"
    ref="containerRef"
    :style="containerStyle"
    @scroll="handleScroll"
  >
    <div 
      class="virtual-list-content"
      :style="{ height: totalHeight + 'px' }"
    >
      <div 
        v-for="item in visibleItems" 
        :key="item[keyField]"
        class="virtual-list-item"
        :style="{ 
          position: 'absolute' as const,
          top: getTop(item.index) + 'px',
          height: itemHeight + 'px',
          width: '100%'
        }"
      >
        <slot :item="item" :index="item.index" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  /** 数据源数组 */
  items: any[]
  /** 每项高度 (px) */
  itemHeight: number
  /** 键字段，用于v-for的key */
  keyField: string
  /** 容器高度 (px)，默认500 */
  containerHeight?: number
  /** 预渲染数量，默认20 */
  bufferSize?: number
}>()

const emit = defineEmits<{
  /** 滚动事件 */
  scroll: [event: Event]
  /** 可见项变化事件 */
  visibleChange: [items: any[]]
}>()

const containerRef = ref<HTMLElement | null>(null)
const startIndex = ref(0)
const endIndex = ref(0)
const scrollTop = ref(0)

// 计算容器样式
const containerStyle = computed(() => {
  return {
    height: (props.containerHeight || 500) + 'px',
    overflow: 'auto' as const,
    position: 'relative' as const
  }
})

// 计算总高度
const totalHeight = computed(() => {
  return props.items.length * props.itemHeight
})

// 计算可见项
const visibleItems = computed(() => {
  const start = Math.max(0, startIndex.value)
  const end = Math.min(props.items.length - 1, endIndex.value)
  return props.items.slice(start, end + 1).map((item, index) => ({
    ...item,
    index: start + index
  }))
})

// 获取指定索引项的顶部位置
const getTop = (index: number) => {
  return index * props.itemHeight
}

// 计算可见范围
const calculateVisibleRange = () => {
  if (!containerRef.value) return

  const containerHeight = containerRef.value.clientHeight
  const bufferSize = props.bufferSize || 20
  
  // 计算可见起始索引
  const start = Math.floor(scrollTop.value / props.itemHeight) - bufferSize
  // 计算可见结束索引
  const end = Math.ceil((scrollTop.value + containerHeight) / props.itemHeight) + bufferSize
  
  startIndex.value = Math.max(0, start)
  endIndex.value = Math.min(props.items.length - 1, end)
  
  // 触发可见项变化事件
  emit('visibleChange', visibleItems.value)
}

// 处理滚动事件
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  calculateVisibleRange()
  emit('scroll', event)
}

// 监听数据源变化
watch(
  () => props.items,
  () => {
    calculateVisibleRange()
  },
  { deep: true }
)

// 监听容器高度变化
watch(
  () => props.containerHeight,
  () => {
    calculateVisibleRange()
  }
)

// 组件挂载时初始化
onMounted(() => {
  calculateVisibleRange()
})

// 组件卸载时清理
onUnmounted(() => {
  // 清理逻辑
})
</script>

<style scoped lang="scss">
.virtual-list {
  width: 100%;
  background: #f5f7fa;
  border-radius: 4px;
  
  &-content {
    position: relative;
    width: 100%;
  }
  
  &-item {
    box-sizing: border-box;
    padding: 12px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    transition: background-color 0.3s ease;
    
    &:hover {
      background: #ecf5ff;
    }
    
    &:last-child {
      border-bottom: none;
    }
  }
}
</style>