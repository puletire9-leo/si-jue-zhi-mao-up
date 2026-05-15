<template>
  <div class="product-data-dashboard bg-gray-50 p-4">
    <!-- 页面标题 -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-800">产品数据看板</h1>
        <p class="text-gray-500 text-sm mt-1">
          基于 main_category_rank 分类的数据分析
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- 公告栏 -->
        <AnnouncementBar />

        <!-- 数据分析按钮 -->
        <el-button
          type="primary"
          plain
          size="default"
          :icon="DataAnalysis"
          @click="handleDataAnalysis"
        >
          数据分析
        </el-button>

        <!-- 清除缓存按钮 -->
        <el-button
          type="danger"
          plain
          size="default"
          :icon="Delete"
          :loading="clearingCache"
          @click="handleClearCache"
        >
          清除缓存
        </el-button>

        <!-- 对比模式切换 -->
        <el-radio-group v-model="isCompareMode" size="default" @change="handleCompareModeChange">
          <el-radio-button :label="false">当前数据</el-radio-button>
          <el-radio-button :label="true">对比模式</el-radio-button>
        </el-radio-group>

        <!-- 时间维度选择 -->
        <el-select
          v-model="timeDimension"
          placeholder="维度"
          size="default"
          style="width: 100px"
          @change="handleDimensionChange"
        >
          <el-option label="按天" value="day" />
          <el-option label="按周" value="week" />
          <el-option label="按月" value="month" />
        </el-select>

        <!-- 本期日期范围选择 -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">本期:</span>
          <el-date-picker
            v-model="dateRangeValue"
            type="daterange"
            unlink-panels
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="default"
            style="width: 260px"
            :shortcuts="dateShortcuts"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleDateRangeChange"
          />
        </div>

        <!-- 对比期日期选择（仅在对比模式下显示） -->
        <div v-if="isCompareMode" class="flex items-center gap-2">
          <span class="text-sm text-blue-500 font-medium">对比:</span>
          <el-date-picker
            v-model="compareDateRangeValue"
            type="daterange"
            unlink-panels
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="default"
            style="width: 260px"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="compare-date-picker"
            @change="handleCompareDateRangeChange"
          />
        </div>
      </div>
    </div>

    <!-- 对比控制栏（仅在对比模式下显示） -->
    <div v-if="isCompareMode" class="compare-control-bar mb-4">
      <!-- 快速环比选择按钮组 -->
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-sm text-gray-600 font-medium">快速选择:</span>
        <el-button-group>
          <el-button
            size="small"
            :type="compareType === 'previous_period' ? 'primary' : 'default'"
            @click="handleQuickCompare('previous_period')"
          >
            <el-icon class="mr-1"><Timer /></el-icon>
            上一周期
          </el-button>
          <el-button
            size="small"
            :type="compareType === 'last_week' ? 'primary' : 'default'"
            @click="handleQuickCompare('last_week')"
          >
            <el-icon class="mr-1"><Calendar /></el-icon>
            上周
          </el-button>
          <el-button
            size="small"
            :type="compareType === 'last_month' ? 'primary' : 'default'"
            @click="handleQuickCompare('last_month')"
          >
            <el-icon class="mr-1"><Watch /></el-icon>
            上月
          </el-button>
          <el-button
            size="small"
            :type="compareType === 'last_year' ? 'primary' : 'default'"
            @click="handleQuickCompare('last_year')"
          >
            <el-icon class="mr-1"><TrendCharts /></el-icon>
            去年同期
          </el-button>
          <el-button
            size="small"
            :type="compareType === 'custom' ? 'primary' : 'default'"
            @click="handleQuickCompare('custom')"
          >
            <el-icon class="mr-1"><Setting /></el-icon>
            自定义
          </el-button>
        </el-button-group>
      </div>

      <!-- 对比时间段展示卡片 -->
      <div class="compare-period-display mt-3">
        <div class="period-box current">
          <div class="period-label">📅 本期数据</div>
          <div class="period-value">{{ formatDateRange(dateRangeValue) }}</div>
          <div class="period-days">共 {{ calculateDays(dateRangeValue) }} 天</div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="period-box compare">
          <div class="period-label">📅 对比期数据</div>
          <div class="period-value">{{ formatDateRange(compareDateRangeValue) }}</div>
          <div class="period-days">共 {{ calculateDays(compareDateRangeValue) }} 天</div>
        </div>
      </div>
    </div>

    <!-- 筛选面板 -->
    <FilterPanel />

    <!-- 管理层视图 - 可拖拽仪表盘 -->
    <template v-if="currentView === 'manager'">
      <DraggableDashboard :is-compare-mode="isCompareMode" />
    </template>

    <!-- 开发视图 -->
    <template v-else>
      <ProductDetailTable />
    </template>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ProductData' })
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useProductDataStore } from '@/stores/productData'
import { productDataApi } from '@/api/productData'
import { reportApi } from '@/api/report'
import { ElMessage } from 'element-plus'
import { Delete, Timer, Calendar, Watch, TrendCharts, Setting, DataAnalysis } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

// 导入组件
import FilterPanel from './components/FilterPanel.vue'
import DraggableDashboard from './components/DraggableDashboard.vue'
import ProductDetailTable from './components/ProductDetailTable.vue'
import AnnouncementBar from './components/AnnouncementBar.vue'

const store = useProductDataStore()
const clearingCache = ref(false)
const router = useRouter()

const currentView = computed(() => store.currentView)

// 对比模式状态
const isCompareMode = ref(false)
const compareType = ref<'previous_period' | 'last_week' | 'last_month' | 'last_year' | 'custom'>('previous_period')

// 时间维度
const timeDimension = computed({
  get: () => store.timeDimension,
  set: (val) => store.setTimeDimension(val)
})

// 本期日期范围
const dateRangeValue = computed({
  get: () => [store.dateRange[0], store.dateRange[1]],
  set: (val) => {
    if (val && val.length === 2) {
      store.setDateRange([val[0], val[1]])
    } else {
      store.setDateRange(['', ''])
    }
  }
})

// 对比期日期范围
const compareDateRangeValue = computed({
  get: () => [store.compareDateRange[0], store.compareDateRange[1]],
  set: (val) => {
    if (val && val.length === 2) {
      store.setCompareDateRange([val[0], val[1]])
    } else {
      store.setCompareDateRange(['', ''])
    }
  }
})

// 日期快捷选项
const dateShortcuts = [
  {
    text: '今日',
    value: () => {
      const end = new Date()
      const start = new Date()
      return [start, end]
    },
  },
  {
    text: '昨日',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24)
      end.setTime(end.getTime() - 3600 * 1000 * 24)
      return [start, end]
    },
  },
  {
    text: '前7天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    },
  },
  {
    text: '近7天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 6)
      return [start, end]
    },
  },
  {
    text: '前30天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    },
  },
  {
    text: '近30天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 29)
      return [start, end]
    },
  },
  {
    text: '本周',
    value: () => {
      const end = new Date()
      const start = new Date()
      const day = start.getDay() || 7
      start.setTime(start.getTime() - 3600 * 1000 * 24 * (day - 1))
      return [start, end]
    },
  },
  {
    text: '上周',
    value: () => {
      const end = new Date()
      const start = new Date()
      const day = start.getDay() || 7
      start.setTime(start.getTime() - 3600 * 1000 * 24 * (day + 6))
      end.setTime(end.getTime() - 3600 * 1000 * 24 * day)
      return [start, end]
    },
  },
  {
    text: '本月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(1)
      return [start, end]
    },
  },
  {
    text: '上月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      end.setDate(0)
      return [start, end]
    },
  },
  {
    text: '今年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setMonth(0)
      start.setDate(1)
      return [start, end]
    },
  },
  {
    text: '去年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 1)
      start.setMonth(0)
      start.setDate(1)
      end.setFullYear(end.getFullYear() - 1)
      end.setMonth(11)
      end.setDate(31)
      return [start, end]
    },
  },
]

// 处理对比模式切换
async function handleCompareModeChange(value: boolean) {
  store.setCompareMode(value)
  if (value) {
    // 开启对比模式时，自动计算默认对比期（上一周期）
    await nextTick()
    // 确保本期日期已设置
    if (!dateRangeValue.value[0] || !dateRangeValue.value[1]) {
      console.log('[Index] 本期日期未设置，等待数据加载...')
      // 等待数据加载完成
      await store.fetchAvailableMonths()
    }
    console.log('[Index] 开启对比模式，本期日期:', dateRangeValue.value)
    calculateCompareDateRange('previous_period')
  }
}

// 处理快速对比选择
function handleQuickCompare(type: 'previous_period' | 'last_week' | 'last_month' | 'last_year' | 'custom') {
  compareType.value = type
  if (type !== 'custom') {
    calculateCompareDateRange(type)
  }
}

// 计算对比期日期范围
function calculateCompareDateRange(type: 'previous_period' | 'last_week' | 'last_month' | 'last_year') {
  const currentRange = dateRangeValue.value
  if (!currentRange[0] || !currentRange[1]) return

  const start = new Date(currentRange[0])
  const end = new Date(currentRange[1])

  let compareStart: Date
  let compareEnd: Date

  switch (type) {
    case 'previous_period':
      // 上一周期（等长）
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1
      compareEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
      compareStart = new Date(compareEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
      break

    case 'last_week':
      // 上周
      const day = start.getDay() || 7
      compareStart = new Date(start.getTime() - (day + 6) * 24 * 60 * 60 * 1000)
      compareEnd = new Date(start.getTime() - day * 24 * 60 * 60 * 1000)
      break

    case 'last_month':
      // 上月
      compareStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
      compareEnd = new Date(start.getFullYear(), start.getMonth(), 0)
      break

    case 'last_year':
      // 去年同期
      compareStart = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())
      compareEnd = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
      break

    default:
      return
  }

  const formattedStart = formatDate(compareStart)
  const formattedEnd = formatDate(compareEnd)
  store.setCompareDateRange([formattedStart, formattedEnd])
  
  // 自动加载对比数据
  store.refreshCompareData()
}

// 格式化日期
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化日期范围显示
function formatDateRange(range: [string, string]): string {
  if (!range[0] || !range[1]) return '请选择日期'
  return `${range[0]} ~ ${range[1]}`
}

// 计算天数
function calculateDays(range: [string, string]): number {
  if (!range[0] || !range[1]) return 0
  const start = new Date(range[0])
  const end = new Date(range[1])
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

// 处理维度变更
function handleDimensionChange() {
  store.refresh()
}

// 处理本期日期变更
function handleDateRangeChange() {
  store.refresh()
  // 如果处于对比模式，自动重新计算对比期
  if (isCompareMode.value && compareType.value !== 'custom') {
    calculateCompareDateRange(compareType.value)
  }
}

// 处理对比期日期变更
function handleCompareDateRangeChange() {
  store.refreshCompareData()
}

// 处理数据分析按钮点击
async function handleDataAnalysis() {
  console.log('[DataAnalysis] 开始执行数据分析流程')
  try {
    // 显示加载状态
    ElMessage({
      message: '正在生成报告，请稍候...',
      type: 'info',
      duration: 0,
      showClose: true
    })
    
    console.log('[DataAnalysis] 调用报告生成API')
    // 调用报告生成API
    const response = await reportApi.generateReports()
    console.log('[DataAnalysis] API调用结果:', response)
    
    // 生成完成后跳转到报告查看页面
    ElMessage({
      message: '报告生成任务已启动，正在跳转到报告页面...',
      type: 'success',
      duration: 1000
    })
    
    console.log('[DataAnalysis] 执行路由跳转')
    // 直接执行跳转，移除延迟
    router.push('/report-viewer').then(() => {
      console.log('[DataAnalysis] 路由跳转成功')
    }).catch((error) => {
      console.error('[DataAnalysis] 路由跳转失败:', error)
      // 即使跳转失败，也显示提示信息
      ElMessage({
        message: '跳转失败，请手动导航到报告页面',
        type: 'warning',
        duration: 3000
      })
    })
  } catch (error) {
    console.error('[DataAnalysis] 生成报告失败:', error)
    ElMessage({
      message: '生成报告失败，请稍后重试',
      type: 'error',
      duration: 3000
    })
    
    // 即使发生错误，也执行跳转
    console.log('[DataAnalysis] 错误发生，仍然执行路由跳转')
    router.push('/report-viewer').then(() => {
      console.log('[DataAnalysis] 错误后路由跳转成功')
    }).catch((error) => {
      console.error('[DataAnalysis] 错误后路由跳转失败:', error)
    })
  }
}

// 清除Redis缓存
async function handleClearCache() {
  try {
    clearingCache.value = true
    const res = await productDataApi.clearCache()
    if (res.code === 200) {
      ElMessage.success(res.data.message)
      await store.refresh()
    }
  } catch (error) {
    console.error('清除缓存失败:', error)
    ElMessage.error('清除缓存失败')
  } finally {
    clearingCache.value = false
  }
}

// 监听本期日期变化，自动更新对比期
watch(dateRangeValue, (newVal) => {
  if (isCompareMode.value && compareType.value !== 'custom' && newVal[0] && newVal[1]) {
    calculateCompareDateRange(compareType.value)
  }
})

onMounted(async () => {
  try {
    await store.init()
  } catch (error) {
    console.error('初始化数据失败:', error)
    ElMessage.error('初始化失败')
  }
})
</script>

<style scoped>
.product-data-dashboard {
  padding: 16px;
  min-height: calc(100vh - 60px);
}

/* 对比日期选择器样式 */
:deep(.compare-date-picker .el-input__wrapper) {
  border-color: #409eff;
  background-color: #ecf5ff;
}

/* 对比控制栏样式 */
.compare-control-bar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
}

/* 对比时间段展示 */
.compare-period-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 15px;
}

.period-box {
  flex: 1;
  text-align: center;
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  max-width: 300px;
}

.period-box.current {
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.period-box.compare {
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.period-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.period-value {
  font-size: 16px;
  font-weight: bold;
  word-break: break-all;
}

.period-days {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 5px;
}

.vs-divider {
  font-size: 20px;
  font-weight: bold;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

/* 快速选择按钮组样式 */
:deep(.el-button-group .el-button) {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.5);
  color: #606266;
}

:deep(.el-button-group .el-button--primary) {
  background: #409eff;
  border-color: #409eff;
  color: white;
}

:deep(.el-button-group .el-button:hover:not(.el-button--primary)) {
  background: white;
  color: #409eff;
}
</style>
