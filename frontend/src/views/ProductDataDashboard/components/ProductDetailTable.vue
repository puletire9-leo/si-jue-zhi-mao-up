<template>
  <div class="product-detail-table bg-white rounded-lg shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">
        产品明细
        <el-tag v-if="selectedCategory" class="ml-2" type="info">
          {{ currentCategoryLabel }}
        </el-tag>
      </h3>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">共 {{ total }} 条数据</span>
        <el-button type="primary" size="small" @click="handleExport">
          <el-icon class="mr-1"><Download /></el-icon>
          导出
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="products"
      style="width: 100%"
      :header-cell-style="{ background: '#F9FAFB', color: '#374151', fontWeight: 600 }"
      row-key="asin"
      @sort-change="handleSortChange"
    >
      <!-- 展开列 -->
      <el-table-column type="expand" width="50">
        <template #default="{ row }">
          <div class="expanded-content p-4 bg-gray-50 rounded-lg">
            <el-row :gutter="20">
              <!-- 基础信息 -->
              <el-col :span="8">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">基础信息</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Parent ASIN:</span>
                    <span class="font-medium">{{ row.parent_asin || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">MSKU:</span>
                    <span class="font-medium">{{ row.msku }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">SKU:</span>
                    <span class="font-medium">{{ row.sku }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">品牌:</span>
                    <span class="font-medium">{{ row.brand || '-' }}</span>
                  </div>
                </div>
              </el-col>

              <!-- 类目信息 -->
              <el-col :span="8">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">类目信息</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">一级类目:</span>
                    <span class="font-medium">{{ row.category_level1 }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">二级类目:</span>
                    <span class="font-medium">{{ row.category_level2 || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">三级类目:</span>
                    <span class="font-medium">{{ row.category_level3 || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">大类排名:</span>
                    <span class="font-medium">{{ row.main_category_rank }}</span>
                  </div>
                </div>
              </el-col>

              <!-- 人员信息 -->
              <el-col :span="8">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">人员信息</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">开发人员:</span>
                    <el-tag size="small">{{ row.developer }}</el-tag>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">负责人:</span>
                    <el-tag size="small" type="info">{{ row.responsible_person }}</el-tag>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">店铺:</span>
                    <span class="font-medium">{{ row.store }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">国家:</span>
                    <span class="font-medium">{{ row.country }}</span>
                  </div>
                </div>
              </el-col>
            </el-row>

            <el-divider class="my-4" />

            <el-row :gutter="20">
              <!-- 流量数据 -->
              <el-col :span="8">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">流量数据</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Sessions:</span>
                    <span class="font-medium">{{ formatNumber(row.sessions_total) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">PV:</span>
                    <span class="font-medium">{{ formatNumber(row.pv_total) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">CVR:</span>
                    <span class="font-medium" :class="getCvrClass(row.cvr)">
                      {{ row.cvr.toFixed(2) }}%
                    </span>
                  </div>
                </div>
              </el-col>

              <!-- 广告数据 -->
              <el-col :span="16">
                <h4 class="text-sm font-semibold text-gray-700 mb-3">广告数据</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">广告花费:</span>
                    <span class="font-medium">${{ row.ad_spend.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">广告销售额:</span>
                    <span class="font-medium">${{ row.ad_sales_amount.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">ACoAS:</span>
                    <el-tag :type="getAcoasType(row.acoas)" size="small">
                      {{ row.acoas.toFixed(2) }}%
                    </el-tag>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">ROAS:</span>
                    <span class="font-medium" :class="getRoasClass(row.roas)">
                      {{ row.roas.toFixed(2) }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Impressions:</span>
                    <span class="font-medium">{{ formatNumber(row.impressions) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Clicks:</span>
                    <span class="font-medium">{{ formatNumber(row.clicks) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">CTR:</span>
                    <span class="font-medium">{{ row.ctr.toFixed(2) }}%</span>
                  </div>
                </div>
              </el-col>
            </el-row>
          </div>
        </template>
      </el-table-column>

      <!-- ASIN -->
      <el-table-column label="ASIN" prop="asin" min-width="120" sortable="custom">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm">{{ row.asin }}</span>
            <el-button
              type="primary"
              link
              size="small"
              @click="copyAsin(row.asin)"
            >
              <el-icon><DocumentCopy /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>

      <!-- 产品名称 -->
      <el-table-column label="产品名称" prop="product_name" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="font-medium text-gray-800">{{ row.product_name }}</span>
        </template>
      </el-table-column>

      <!-- 分类 -->
      <el-table-column label="分类" prop="category_level1" width="120" sortable="custom">
        <template #default="{ row }">
          <el-tag size="small" :type="getCategoryType(row.category_level1)">
            {{ row.category_level1 }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 销量 -->
      <el-table-column label="销量" prop="sales_volume" width="100" align="right" sortable="custom">
        <template #default="{ row }">
          <span class="font-semibold" :class="getSalesVolumeClass(row.sales_volume)">
            {{ row.sales_volume }}
          </span>
        </template>
      </el-table-column>

      <!-- 销售额 -->
      <el-table-column label="销售额" prop="sales_amount" width="120" align="right" sortable="custom">
        <template #default="{ row }">
          <span class="font-semibold text-orange-600">
            ${{ row.sales_amount.toFixed(0) }}
          </span>
        </template>
      </el-table-column>

      <!-- 订单量 -->
      <el-table-column label="订单" prop="order_quantity" width="90" align="right" sortable="custom">
        <template #default="{ row }">
          <span class="text-gray-600">{{ row.order_quantity }}</span>
        </template>
      </el-table-column>

      <!-- ACoAS -->
      <el-table-column label="ACoAS" prop="acoas" width="100" align="center" sortable="custom">
        <template #default="{ row }">
          <el-tag :type="getAcoasType(row.acoas)" size="small">
            {{ row.acoas.toFixed(1) }}%
          </el-tag>
        </template>
      </el-table-column>

      <!-- ROAS -->
      <el-table-column label="ROAS" prop="roas" width="90" align="center" sortable="custom">
        <template #default="{ row }">
          <span class="font-medium" :class="getRoasClass(row.roas)">
            {{ row.roas.toFixed(1) }}
          </span>
        </template>
      </el-table-column>

      <!-- 开发 -->
      <el-table-column label="开发" prop="developer" width="100" sortable="custom">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ row.developer }}</el-tag>
        </template>
      </el-table-column>

      <!-- 操作 -->
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            link
            size="small"
            @click="viewDetail(row)"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="flex justify-end mt-4">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useProductDataStore } from '../../../stores/productData'
import { useProductData } from '../composables/useProductData'
import { CATEGORY_CONFIG } from '../../../types/productData'
import type { ProductData } from '../../../types/productData'
import { Download, DocumentCopy } from '@element-plus/icons-vue'

const store = useProductDataStore()
const {
  currentPage,
  pageSize,
  handlePageChange,
  handleSizeChange,
  handleSortChange
} = useProductData()

const products = computed(() => store.productList)
const total = computed(() => store.productTotal)
const loading = computed(() => store.loading.products)
const selectedCategory = computed(() => store.selectedCategory)

// 当前分类标签
const currentCategoryLabel = computed(() => {
  if (!selectedCategory.value) return ''
  return CATEGORY_CONFIG[selectedCategory.value as keyof typeof CATEGORY_CONFIG]?.label || selectedCategory.value
})

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 获取销量样式
function getSalesVolumeClass(volume: number): string {
  if (volume >= 1000) return 'text-red-600 font-bold'
  if (volume >= 500) return 'text-orange-600'
  return 'text-gray-700'
}

// 获取ACoAS类型
function getAcoasType(acoas: number): 'success' | 'warning' | 'danger' {
  if (acoas < 25) return 'success'
  if (acoas < 30) return 'warning'
  return 'danger'
}

// 获取ROAS样式
function getRoasClass(roas: number): string {
  if (roas >= 4) return 'text-green-600 font-bold'
  if (roas >= 3) return 'text-green-500'
  if (roas >= 2) return 'text-yellow-600'
  return 'text-red-500'
}

// 获取CVR样式
function getCvrClass(cvr: number): string {
  if (cvr >= 15) return 'text-green-600 font-bold'
  if (cvr >= 10) return 'text-green-500'
  if (cvr >= 5) return 'text-yellow-600'
  return 'text-red-500'
}

// 获取分类类型
function getCategoryType(category: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const typeMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    '园艺类': 'success',
    '家居类': 'warning',
    'DIY类': 'primary',
    '玩具类': 'danger'
  }
  return typeMap[category] || 'info'
}

// 复制ASIN
function copyAsin(asin: string) {
  navigator.clipboard.writeText(asin).then(() => {
    ElMessage.success('ASIN已复制到剪贴板')
  })
}

// 查看详情
function viewDetail(row: ProductData) {
  console.log('查看详情:', row)
  // 可以打开抽屉或弹窗
}

// 导出
function handleExport() {
  store.exportData()
}
</script>

<style scoped>
.expanded-content {
  margin: 8px;
}

:deep(.el-table__expanded-cell) {
  padding: 0;
}
</style>
