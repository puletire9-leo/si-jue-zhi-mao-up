<template>
  <div class="selection-detail">
    <div class="container">
      <el-button
        class="back-btn"
        :icon="ArrowLeft"
        @click="goBack"
      >
        返回列表
      </el-button>

      <el-card
        v-if="product"
        class="detail-card"
      >
        <div class="detail-header">
          <div class="product-image">
            <el-image
              :src="getImageUrl()"
              :preview="false"
              fit="contain"
              class="main-image"
            >
              <template #error>
                <div class="image-error">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </div>

          <div class="product-info">
            <div class="product-asin">
              ASIN：{{ product.asin }}
            </div>
            <div class="product-title">
              {{ product.productTitle || '未知标题' }}
            </div>

            <div class="info-grid">
              <div
                v-if="product.listingDays"
                class="info-item"
              >
                <div class="info-label">
                  上架时间(天)：
                </div>
                <div class="info-value">
                  {{ product.listingDays }} 天
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">
                  产品类型：
                </div>
                <div class="info-value">
                  <el-tag :type="product.productType === 'new' ? 'success' : 'warning'">
                    {{ product.productType === 'new' ? '新品榜' : '竞品店铺' }}
                  </el-tag>
                </div>
              </div>

              <div
                v-if="product.source"
                class="info-item"
              >
                <div class="info-label">
                  来源：
                </div>
                <div class="info-value">
                  {{ product.source }}
                </div>
              </div>

              <div
                v-if="product.category"
                class="info-item"
              >
                <div class="info-label">
                  大类榜单名：
                </div>
                <div class="info-value">
                  {{ product.category }}
                </div>
              </div>

              <div
                v-if="product.storeName"
                class="info-item"
              >
                <div class="info-label">
                  店铺名称：
                </div>
                <div class="info-value">
                  {{ product.storeName }}
                </div>
              </div>

              <div
                v-if="product.price"
                class="info-item"
              >
                <div class="info-label">
                  价格：
                </div>
                <div class="info-value price">
                  ¥{{ product.price }}
                </div>
              </div>

              <div
                v-if="product.salesVolume"
                class="info-item"
              >
                <div class="info-label">
                  销量：
                </div>
                <div class="info-value sales">
                  <el-icon><TrendCharts /></el-icon>
                  <span>{{ formatSalesVolume(product.salesVolume) }}</span>
                </div>
              </div>

              <div
                v-if="product.deliveryMethod"
                class="info-item"
              >
                <div class="info-label">
                  配送方式：
                </div>
                <div class="info-value">
                  {{ product.deliveryMethod }}
                </div>
              </div>

              <div
                v-if="product.mainCategoryBsrGrowth"
                class="info-item"
              >
                <div class="info-label">
                  大类BSR增长数：
                </div>
                <div class="info-value">
                  {{ product.mainCategoryBsrGrowth }}
                </div>
              </div>

              <div
                v-if="product.mainCategoryBsrGrowthRate"
                class="info-item"
              >
                <div class="info-label">
                  大类BSR增长率：
                </div>
                <div class="info-value">
                  {{ product.mainCategoryBsrGrowthRate }}%
                </div>
              </div>

              <div
                v-if="product.createdAt"
                class="info-item"
              >
                <div class="info-label">
                  创建时间：
                </div>
                <div class="info-value">
                  {{ formatDate(product.createdAt) }}
                </div>
              </div>

              <div
                v-if="product.updatedAt"
                class="info-item"
              >
                <div class="info-label">
                  更新时间：
                </div>
                <div class="info-value">
                  {{ formatUpdateTime(product.createdAt, product.updatedAt) }}
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">
                  商品链接：
                </div>
                <div class="info-value">
                  <el-link
                    v-if="product.productLink"
                    :href="product.productLink"
                    target="_blank"
                    type="primary"
                  >
                    点击查看商品
                  </el-link>
                  <span v-else>无</span>
                </div>
              </div>

              <div
                v-if="product.storeUrl"
                class="info-item"
              >
                <div class="info-label">
                  店铺链接：
                </div>
                <div class="info-value">
                  <el-link
                    :href="product.storeUrl"
                    target="_blank"
                    type="success"
                  >
                    点击查看店铺
                  </el-link>
                </div>
              </div>

              <div
                v-if="product.similarProducts"
                class="info-item full-width"
              >
                <div class="info-label">
                  相似商品：
                </div>
                <div class="info-value">
                  <div class="similar-products">
                    <el-link
                      v-for="(link, index) in product.similarProducts.split(',')"
                      :key="index"
                      :href="link.trim()"
                      target="_blank"
                      type="info"
                      style="margin-right: 12px;"
                    >
                      相似商品 {{ index + 1 }}
                    </el-link>
                  </div>
                </div>
              </div>

              <div
                v-if="product.notes"
                class="info-item full-width"
              >
                <div class="info-label">
                  备注：
                </div>
                <div class="info-value">
                  {{ product.notes }}
                </div>
              </div>

              <div
                v-if="product.tags && product.tags.length > 0"
                class="info-item full-width"
              >
                <div class="info-label">
                  标签：
                </div>
                <div class="info-value">
                  <el-tag
                    v-for="(tag, index) in product.tags"
                    :key="index"
                    size="small"
                    type="info"
                    effect="plain"
                    style="margin-right: 8px; margin-bottom: 8px;"
                  >
                    {{ tag }}
                  </el-tag>
                </div>
              </div>
            </div>

            <div class="action-buttons">
              <el-button
                type="primary"
                :icon="Edit"
                @click="handleEdit"
              >
                编辑选品
              </el-button>
              <el-button
                type="danger"
                :icon="Delete"
                @click="handleDelete"
              >
                删除选品
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-card
        v-else
        class="no-data-card"
      >
        <el-empty description="暂无该选品的详细信息，请检查ASIN是否正确！" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'SelectionDetail' })
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Picture, Edit, Delete, TrendCharts } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { selectionApi } from '@/api/selection'

const route = useRoute()
const router = useRouter()

const product = ref(null)
const loading = ref(false)

const loadProductDetail = async () => {
  const id = route.params.id
  if (!id) {
    ElMessage.error('ID参数缺失')
    return
  }

  loading.value = true
  try {
    const response = await selectionApi.getDetail(id)
    product.value = response.data
  } catch (error) {
    ElMessage.error('加载选品详情失败')
  } finally {
    loading.value = false
  }
}

const getImageUrl = () => {
  if (!product.value) return '/images/default.png'
  if (product.value.thumbPath) {
    return `/images/${product.value.thumbPath}`
  }
  if (product.value.localPath) {
    return `/images/${product.value.localPath}`
  }
  if (product.value.imageUrl) {
    return product.value.imageUrl
  }
  return '/images/default.png'
}

const getPreviewImages = () => {
  if (!product.value) return []
  const images = []
  if (product.value.localPath) {
    images.push(`/images/${product.value.localPath}`)
  }
  if (product.value.imageUrl) {
    images.push(product.value.imageUrl)
  }
  return images
}

const formatDate = (dateString) => {
  if (!dateString) return '无记录'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatListingDate = (listingDays) => {
  if (!listingDays || listingDays <= 0) return '无记录'
  
  // 计算上架日期：当前时间减去上架天数
  const currentDate = new Date()
  const listingDate = new Date(currentDate.getTime() - listingDays * 24 * 60 * 60 * 1000)
  
  return listingDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }) + ` (${listingDays}天前)`
}

const formatUpdateTime = (createdAt, updatedAt) => {
  if (!updatedAt) return '无记录'
  
  // 如果更新时间与创建时间相同，说明没有更新过
  if (createdAt && updatedAt) {
    const createdDate = new Date(createdAt)
    const updatedDate = new Date(updatedAt)
    
    // 比较时间戳，如果相同则说明没有更新
    if (createdDate.getTime() === updatedDate.getTime()) {
      return '无更新'
    }
  }
  
  return formatDate(updatedAt)
}

const formatSalesVolume = (volume) => {
  if (!volume) return '0'
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`
  }
  return volume.toString()
}

const goBack = () => {
  router.back()
}

const handleEdit = () => {
  ElMessage.info('编辑选品功能开发中...')
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选品 ${product.value.asin} 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await selectionApi.delete(product.value.id)
    ElMessage.success('删除成功')
    router.push('/all-selection')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped lang="scss">
.selection-detail {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.back-btn {
  margin-bottom: 20px;
}

.detail-card {
  margin-bottom: 30px;
}

.detail-header {
  display: flex;
  gap: 30px;
  padding: 30px;
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    gap: 20px;
  }
}

.product-image {
  flex-shrink: 0;
  width: 400px;
  height: 400px;
}

@media (max-width: 768px) {
  .product-image {
    width: 100%;
    height: auto;
  }
}

.main-image {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 48px;
  color: #cbd5e1;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.product-asin {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 10px;
  font-weight: bold;
}

.product-title {
  font-size: 20px;
  color: #34495e;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 25px;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.info-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  
  &.full-width {
    grid-column: 1 / -1;
  }
}

.info-label {
  width: 120px;
  color: #7f8c8d;
  font-weight: 500;
  font-size: 14px;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  color: #2c3e50;
  font-size: 14px;
  word-break: break-all;
  
  &.price {
    font-size: 18px;
    font-weight: bold;
    color: #e74c3c;
  }
  
  &.sales {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: bold;
    color: #f093fb;
  }
  
  .el-icon {
    font-size: 18px;
  }
}

.similar-products {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.no-data-card {
  text-align: center;
  padding: 60px 20px;
}
</style>
