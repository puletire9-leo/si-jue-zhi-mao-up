<template>
  <div class="draggable-dashboard">
    <!-- 拖拽区域 -->
    <div class="dashboard-container">
      <div
        v-for="(item, index) in visibleWidgets"
        :key="item.id"
        class="dashboard-widget"
        :class="{ 
          'widget-full': item.width === 'full',
          'widget-half': item.width === 'half',
          'widget-collapsed': item.collapsed,
          'widget-dragging': draggingIndex === index 
        }"
        :style="{ order: item.order }"
        @dragover.prevent
        @drop="handleDrop($event, index)"
      >
        <!-- 卡片头部 -->
        <div class="widget-header" @click="toggleCollapse(item.id)">
          <div class="widget-title">
            <el-icon 
              class="drag-handle"
              draggable="true"
              @dragstart="handleDragStart($event, index)"
              @dragend="handleDragEnd"
            >
              <Rank />
            </el-icon>
            <span>{{ item.title }}</span>
          </div>
          <div class="widget-actions">
            <!-- 宽度切换按钮 -->
            <el-button 
              type="info" 
              link 
              size="small"
              :title="item.width === 'full' ? '切换为半宽' : '切换为全宽'"
              @click.stop="toggleWidth(item.id)"
            >
              <el-icon>
                <FullScreen v-if="item.width === 'half'" />
                <Crop v-else />
              </el-icon>
            </el-button>
            <el-button 
              type="primary" 
              link 
              size="small"
              @click.stop="toggleCollapse(item.id)"
            >
              <el-icon>
                <ArrowUp v-if="!item.collapsed" />
                <ArrowDown v-else />
              </el-icon>
            </el-button>
            <el-button 
              type="danger" 
              link 
              size="small"
              @click.stop="removeWidget(item.id)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
        
        <!-- 卡片内容 -->
        <div v-show="!item.collapsed" class="widget-content">
          <component :is="item.component" />
        </div>
      </div>
    </div>

    <!-- 添加组件按钮 -->
    <div class="add-widget-section">
      <el-dropdown @command="addWidget">
        <el-button type="primary">
          <el-icon class="mr-1"><Plus /></el-icon>
          添加组件
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item 
              v-for="widget in availableWidgets" 
              :key="widget.id"
              :command="widget.id"
              :disabled="isWidgetActive(widget.id)"
            >
              {{ widget.title }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      
      <el-button @click="resetLayout">
        <el-icon class="mr-1"><Refresh /></el-icon>
        重置布局
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import { Rank, ArrowUp, ArrowDown, Close, Plus, Refresh, FullScreen, Crop } from '@element-plus/icons-vue'
import SalesTrendChart from './SalesTrendChart.vue'
import OrderAnalysisChart from './OrderAnalysisChart.vue'
import AdPerformanceChart from './AdPerformanceChart.vue'
import TopProductsGrid from './TopProductsGrid.vue'
import CategoryRankingTable from './CategoryRankingTable.vue'
import AdEffectCard from './AdEffectCard.vue'
import ExposureClickCard from './ExposureClickCard.vue'
import CategoryPieChart from './CategoryPieChart.vue'

interface Widget {
  id: string
  title: string
  component: any
  width: 'half' | 'full'
  order: number
  collapsed: boolean
}

// 核心指标组件
import MetricCards from './MetricCards.vue'
import MetricOverview from './MetricOverview.vue'

// 所有可用组件
const allWidgets: Widget[] = [
  { 
    id: 'metric-overview', 
    title: '核心指标总览', 
    component: markRaw(MetricOverview), 
    width: 'full', 
    order: 0, 
    collapsed: false 
  },
  {
    id: 'category-pie',
    title: '分类占比分析',
    component: markRaw(CategoryPieChart),
    width: 'full',
    order: 1,
    collapsed: false
  },
  {
    id: 'metric-cards',
    title: '核心指标',
    component: markRaw(MetricCards),
    width: 'full',
    order: 10,
    collapsed: true
  },
  { 
    id: 'sales-trend', 
    title: '销售趋势', 
    component: markRaw(SalesTrendChart), 
    width: 'half', 
    order: 2, 
    collapsed: false 
  },
  { 
    id: 'order-analysis', 
    title: '自然订单分析', 
    component: markRaw(OrderAnalysisChart), 
    width: 'half', 
    order: 3, 
    collapsed: false 
  },
  { 
    id: 'top-products', 
    title: 'TOP热销产品', 
    component: markRaw(TopProductsGrid), 
    width: 'half', 
    order: 4, 
    collapsed: false 
  },
  { 
    id: 'ad-performance', 
    title: '广告效果分析', 
    component: markRaw(AdPerformanceChart), 
    width: 'half', 
    order: 5, 
    collapsed: false 
  },
  {
    id: 'ad-effect',
    title: '广告效果',
    component: markRaw(AdEffectCard),
    width: 'half',
    order: 6,
    collapsed: false
  },
  {
    id: 'exposure-click',
    title: '曝光点击',
    component: markRaw(ExposureClickCard),
    width: 'half',
    order: 7,
    collapsed: false
  },
  { 
    id: 'category-ranking', 
    title: '分类排名', 
    component: markRaw(CategoryRankingTable), 
    width: 'full', 
    order: 8, 
    collapsed: false 
  }
]

// 当前显示的组件
const activeWidgets = ref<Widget[]>([...allWidgets])

// 拖拽状态
const draggingIndex = ref<number>(-1)

// 可见组件（按order排序）
const visibleWidgets = computed(() => {
  return [...activeWidgets.value].sort((a, b) => a.order - b.order)
})

// 可用组件列表
const availableWidgets = computed(() => {
  return allWidgets
})

// 检查组件是否已激活
function isWidgetActive(id: string): boolean {
  return activeWidgets.value.some(w => w.id === id)
}

// 切换折叠状态
function toggleCollapse(id: string) {
  const widget = activeWidgets.value.find(w => w.id === id)
  if (widget) {
    widget.collapsed = !widget.collapsed
  }
}

// 切换宽度
function toggleWidth(id: string) {
  // 分类占比分析组件禁止切换宽度
  if (id === 'category-pie') {
    return
  }
  activeWidgets.value = activeWidgets.value.map(widget => 
    widget.id === id 
      ? { ...widget, width: widget.width === 'full' ? 'half' : 'full' } 
      : widget
  )
}

// 移除组件
function removeWidget(id: string) {
  activeWidgets.value = activeWidgets.value.filter(w => w.id !== id)
}

// 添加组件
function addWidget(id: string) {
  const widget = allWidgets.find(w => w.id === id)
  if (widget && !isWidgetActive(id)) {
    activeWidgets.value.push({ ...widget, order: activeWidgets.value.length })
  }
}

// 重置布局
function resetLayout() {
  activeWidgets.value = allWidgets.map((w, i) => ({ ...w, order: i, collapsed: false }))
}

// 拖拽开始
function handleDragStart(event: DragEvent, index: number) {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

// 放置
function handleDrop(event: DragEvent, dropIndex: number) {
  event.preventDefault()
  const dragIndex = Number(event.dataTransfer?.getData('text/plain'))
  
  if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
    const widgets = [...activeWidgets.value]
    const draggedWidget = widgets[dragIndex]
    const droppedWidget = widgets[dropIndex]
    
    // 交换order
    const tempOrder = draggedWidget.order
    draggedWidget.order = droppedWidget.order
    droppedWidget.order = tempOrder
    
    activeWidgets.value = widgets
  }
  
  draggingIndex.value = -1
}

// 拖拽结束
function handleDragEnd() {
  draggingIndex.value = -1
}
</script>

<style scoped>
.draggable-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.dashboard-widget {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.dashboard-widget:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.widget-half {
  flex: 1 1 calc(50% - 8px);
  min-width: 400px;
}

.widget-full {
  flex: 1 1 100%;
}

.widget-collapsed {
  height: auto !important;
  min-height: unset !important;
}

.widget-collapsed.widget-half {
  flex: 1 1 calc(50% - 8px) !important;
}

.widget-collapsed.widget-full {
  flex: 1 1 100% !important;
}

.widget-collapsed .widget-content {
  display: none !important;
  height: 0 !important;
  overflow: hidden !important;
  padding: 0 !important;
}

.widget-dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

@media (max-width: 900px) {
  .widget-half {
    flex: 1 1 100%;
    min-width: auto;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #374151;
}

.drag-handle {
  cursor: grab;
  color: #9ca3af;
}

.drag-handle:active {
  cursor: grabbing;
}

.widget-actions {
  display: flex;
  gap: 4px;
}

.widget-content {
  padding: 16px;
}

.add-widget-section {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
