<template>
  <div class="statistics" v-loading="globalLoading">
    <el-row :gutter="20">
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card class="stat-card">
          <el-statistic
            title="产品总数"
            :value="statistics.totalProducts"
          >
            <template #prefix>
              <el-icon
                :size="20"
                color="#409eff"
              >
                <Box />
              </el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card class="stat-card">
          <el-statistic
            title="图片总数"
            :value="statistics.totalImages"
          >
            <template #prefix>
              <el-icon
                :size="20"
                color="#67c23a"
              >
                <Picture />
              </el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card class="stat-card">
          <el-statistic
            title="用户总数"
            :value="statistics.totalUsers"
          >
            <template #prefix>
              <el-icon
                :size="20"
                color="#e6a23c"
              >
                <User />
              </el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card class="stat-card">
          <el-statistic
            title="存储使用"
            :value="statistics.totalStorageUsedMb"
            :precision="2"
            suffix="MB"
          >
            <template #prefix>
              <el-icon
                :size="20"
                color="#f56c6c"
              >
                <FolderOpened />
              </el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="20"
      style="margin-top: 20px"
    >
      <el-col
        :xs="24"
        :lg="12"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>图片上传趋势</span>
              <el-radio-group
                v-model="imageTrendDays"
                size="small"
              >
                <el-radio-button :label="7">
                  7天
                </el-radio-button>
                <el-radio-button :label="30">
                  30天
                </el-radio-button>
                <el-radio-button :label="90">
                  90天
                </el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div
            ref="imageTrendChart"
            class="chart-container"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="20"
      style="margin-top: 20px"
    >
      <el-col
        :xs="24"
        :lg="8"
      >
        <el-card>
          <template #header>
            <span>存储空间分布</span>
          </template>
          <div
            ref="storageChart"
            class="chart-container"
          />
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :lg="8"
      >
        <el-card>
          <template #header>
            <span>图片质量分析</span>
          </template>
          <div
            ref="qualityChart"
            class="chart-container"
          />
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :lg="8"
      >
        <el-card>
          <template #header>
            <span>用户活动</span>
          </template>
          <div
            ref="activityChart"
            class="chart-container"
          />
        </el-card>
      </el-col>
    </el-row>


  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Statistics' })
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { Box, Picture, User, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { statisticsApi } from '@/api/statistics'
import { getProductTypeTag } from '@/types/utils'

const loading = ref(false)
const globalLoading = ref(true)
const statistics = reactive({
  totalProducts: 0,
  totalImages: 0,
  totalUsers: 0,
  totalStorageUsedMb: 0
})

const imageTrendDays = ref(30)

const imageTrendChart = ref(null)
const storageChart = ref(null)
const qualityChart = ref(null)
const activityChart = ref(null)

let imageTrendChartInstance = null
let storageChartInstance = null
let qualityChartInstance = null
let activityChartInstance = null

const loadStatistics = async () => {
  try {
    const data = await statisticsApi.getDashboardStatistics()
    Object.assign(statistics, data.data)
  } catch (error) {
    ElMessage.error('加载统计数据失败')
    console.error('加载统计数据失败:', error)
  }
}

const loadImageTrend = async () => {
  try {
    const data = await statisticsApi.getImageTrend(imageTrendDays.value)
    renderImageTrendChart(data.data || [])
  } catch (error) {
    ElMessage.error('加载图片趋势失败')
    console.error('加载图片趋势失败:', error)
    renderImageTrendChart([])
  }
}

const loadStorageStatistics = async () => {
  try {
    const data = await statisticsApi.getStorageStatistics()
    renderStorageChart(data.data.by_type || [])
  } catch (error) {
    ElMessage.error('加载存储统计失败')
    console.error('加载存储统计失败:', error)
    renderStorageChart([])
  }
}

const loadImageQualityStatistics = async () => {
  try {
    const data = await statisticsApi.getImageQualityStatistics()
    renderQualityChart(data.data.resolution_distribution || [])
  } catch (error) {
    ElMessage.error('加载图片质量统计失败')
    console.error('加载图片质量统计失败:', error)
    renderQualityChart([])
  }
}

const loadUserActivity = async () => {
  try {
    const data = await statisticsApi.getUserActivity(30)
    renderActivityChart(data.data.daily_activity || [])
  } catch (error) {
    ElMessage.error('加载用户活动统计失败')
    console.error('加载用户活动统计失败:', error)
    renderActivityChart([])
  }
}

const renderImageTrendChart = (trend) => {
  if (!imageTrendChart.value) return

  if (imageTrendChartInstance) {
    imageTrendChartInstance.dispose()
  }

  imageTrendChartInstance = echarts.init(imageTrendChart.value)

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: trend.map(item => item.date) || []
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: trend.map(item => item.count) || [],
      type: 'line',
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
          { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
        ])
      },
      lineStyle: {
        color: '#67c23a'
      },
      itemStyle: {
        color: '#67c23a'
      }
    }],
    noDataLoadingOption: {
      text: '暂无数据',
      textStyle: {
        color: '#999',
        fontSize: 14
      }
    }
  }

  imageTrendChartInstance.setOption(option)
}

const renderStorageChart = (data) => {
  if (!storageChart.value) return

  if (storageChartInstance) {
    storageChartInstance.dispose()
  }

  storageChartInstance = echarts.init(storageChart.value)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} MB'
    },
    series: [{
      type: 'pie',
      radius: '70%',
      data: data.map(item => ({
        name: item.type,
        value: item.size_mb
      })) || [],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }],
    noDataLoadingOption: {
      text: '暂无数据',
      textStyle: {
        color: '#999',
        fontSize: 14
      }
    }
  }

  storageChartInstance.setOption(option)
}

const renderQualityChart = (data) => {
  if (!qualityChart.value) return

  if (qualityChartInstance) {
    qualityChartInstance.dispose()
  }

  qualityChartInstance = echarts.init(qualityChart.value)

  const option = {
    tooltip: {
      trigger: 'item'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: data.map(item => ({
        name: item.range || item.level,
        value: item.count
      })) || [],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }],
    noDataLoadingOption: {
      text: '暂无数据',
      textStyle: {
        color: '#999',
        fontSize: 14
      }
    }
  }

  qualityChartInstance.setOption(option)
}

const renderActivityChart = (activity) => {
  if (!activityChart.value) return

  if (activityChartInstance) {
    activityChartInstance.dispose()
  }

  activityChartInstance = echarts.init(activityChart.value)

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: activity.map(item => item.date) || []
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: activity.map(item => item.count) || [],
      type: 'bar',
      itemStyle: {
        color: '#e6a23c'
      }
    }],
    noDataLoadingOption: {
      text: '暂无数据',
      textStyle: {
        color: '#999',
        fontSize: 14
      }
    }
  }

  activityChartInstance.setOption(option)
}

watch(imageTrendDays, () => {
  loadImageTrend()
})

const initializeData = async () => {
  globalLoading.value = true
  try {
    // 并行加载所有数据
    await Promise.all([
      loadStatistics(),
      loadImageTrend(),
      loadStorageStatistics(),
      loadImageQualityStatistics(),
      loadUserActivity()
    ])
  } catch (error) {
    console.error('初始化数据失败:', error)
  } finally {
    globalLoading.value = false
  }
}

onMounted(() => {
  initializeData()

  nextTick(() => {
    window.addEventListener('resize', () => {
      imageTrendChartInstance?.resize()
      storageChartInstance?.resize()
      qualityChartInstance?.resize()
      activityChartInstance?.resize()
    })
  })
})
</script>

<style scoped lang="scss">
.statistics {
  padding: 20px;
}

.stat-card {
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  width: 100%;
  height: 350px;
}
</style>
