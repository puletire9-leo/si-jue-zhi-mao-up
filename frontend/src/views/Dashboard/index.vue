<template>
  <div class="dashboard">
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
              <span>今日新增</span>
            </div>
          </template>
          <div class="today-stats">
            <div class="stat-item">
              <div class="stat-label">
                新增产品
              </div>
              <div class="stat-value">
                {{ statistics.todayProducts }}
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label">
                新增图片
              </div>
              <div class="stat-value">
                {{ statistics.todayImages }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :lg="12"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>产品类型分布</span>
            </div>
          </template>
          <div class="type-distribution">
            <div
              v-for="item in statistics.productTypeDistribution"
              :key="item.type"
              class="type-item"
            >
              <div class="type-info">
                <span class="type-name">{{ item.type }}</span>
                <span class="type-count">{{ item.count }}</span>
              </div>
              <el-progress
                :percentage="getTypePercentage(item.count)"
                :color="getTypeColor(item.type)"
              />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="20"
      style="margin-top: 20px"
    >
      <el-col
        :xs="24"
        :lg="16"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近添加的产品</span>
              <el-button
                text
                @click="goToProducts"
              >
                查看全部
              </el-button>
            </div>
          </template>
          <el-table
            v-loading="loading"
            :data="recentProducts"
            style="width: 100%"
          >
            <el-table-column
              prop="sku"
              label="SKU"
              width="150"
            />
            <el-table-column
              prop="name"
              label="产品名称"
              show-overflow-tooltip
            />
            <el-table-column
              prop="type"
              label="类型"
              width="120"
            >
              <template #default="{ row }">
                <el-tag
                  :type="getProductTypeTag(row.type)"
                  size="small"
                >
                  {{ row.type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="createdAt"
              label="创建时间"
              width="180"
            >
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :lg="8"
      >
        <el-card>
          <template #header>
            <span>快速操作</span>
          </template>
          <div class="quick-actions">
            <el-button
              type="primary"
              :icon="Plus"
              @click="goToAddProduct"
            >
              添加产品
            </el-button>
            <el-button
              type="success"
              :icon="Upload"
              @click="goToImport"
            >
              批量导入
            </el-button>
            <el-button
              type="warning"
              :icon="Download"
              @click="goToExport"
            >
              导出数据
            </el-button>
            <el-button
              type="info"
              :icon="Setting"
              @click="goToSettings"
            >
              系统设置
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="20"
      style="margin-top: 20px"
    >
      <el-col :xs="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近活跃用户</span>
            </div>
          </template>
          <el-table
            :data="statistics.recentUsers"
            style="width: 100%"
          >
            <el-table-column
              prop="username"
              label="用户名"
              width="150"
            />
            <el-table-column
              prop="last_login_time"
              label="最后登录时间"
            >
              <template #default="{ row }">
                {{ formatDate(row.last_login_time) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Picture, User, FolderOpened, Plus, Upload, Download, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { productApi } from '@/api/product'
import { statisticsApi } from '@/api/statistics'
import { getProductTypeTag } from '@/types/utils'

defineOptions({
  name: 'Dashboard'
})

const router = useRouter()
const loading = ref(false)

const statistics = reactive({
  totalProducts: 0,
  totalImages: 0,
  totalUsers: 0,
  totalStorageUsedMb: 0,
  todayProducts: 0,
  todayImages: 0,
  productTypeDistribution: [],
  recentUsers: []
})

const recentProducts = ref([])

const loadStatistics = async () => {
  try {
    const data = await statisticsApi.getDashboardStatistics()
    Object.assign(statistics, data)
  } catch (error) {
    console.error('加载统计数据失败:', error)
    ElMessage.error('加载统计数据失败')
  }
}

const loadRecentProducts = async () => {
  loading.value = true
  try {
    const data = await productApi.getList({ page: 1, size: 5 })
    recentProducts.value = data.list || []
  } catch (error) {
    ElMessage.error('加载最近产品失败')
  } finally {
    loading.value = false
  }
}

const getTypePercentage = (count) => {
  const total = statistics.productTypeDistribution.reduce((sum, item) => sum + item.count, 0)
  return total > 0 ? Math.round((count / total) * 100) : 0
}

const getTypeColor = (type) => {
  const colorMap = {
    '普通产品': '#409eff',
    '组合产品': '#67c23a',
    '定制产品': '#e6a23c'
  }
  return colorMap[type] || '#909399'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const goToProducts = () => {
  router.push('/products')
}

const goToAddProduct = () => {
  router.push('/products')
}

const goToImport = () => {
  router.push('/products')
}

const goToExport = () => {
  router.push('/products')
}

const goToSettings = () => {
  router.push('/settings')
}

onMounted(() => {
  loadStatistics()
  loadRecentProducts()
})
</script>

<style scoped lang="scss">
.dashboard {
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

.today-stats {
  display: flex;
  gap: 20px;
  padding: 20px 0;

  .stat-item {
    flex: 1;
    text-align: center;

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #303133;
    }
  }
}

.type-distribution {
  .type-item {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .type-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;

      .type-name {
        font-size: 14px;
        color: #606266;
      }

      .type-count {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }
    }
  }
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .el-button {
    width: 100%;
  }
}
</style>
