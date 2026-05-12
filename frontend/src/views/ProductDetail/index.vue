<template>
  <div class="product-detail">
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
              :src="getImageUrl(product)"
              :preview="false"
              fit="cover"
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
            <div class="product-sku">
              {{ product.sku }}
            </div>
            <div class="product-name">
              {{ product.name || '未知名称' }}
            </div>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">
                  产品类型：
                </div>
                <div class="info-value">
                  <el-tag :type="getProductTypeTag(product.type)">
                    {{ product.type || '普通产品' }}
                  </el-tag>
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">
                  开发负责人：
                </div>
                <div class="info-value">
                  {{ product.developer || '未知' }}
                </div>
              </div>

              <div
                v-if="product.listingDays"
                class="info-item"
              >
                <div class="info-label">
                  上架时间：
                </div>
                <div class="info-value">
                  {{ formatListingDate(product.listingDays) }}
                </div>
              </div>

              <div
                v-else
                class="info-item"
              >
                <div class="info-label">
                  上架时间：
                </div>
                <div class="info-value">
                  {{ formatDate(product.createdAt) }}
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">
                  更新时间：
                </div>
                <div class="info-value">
                  {{ formatDate(product.updatedAt) }}
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
                v-if="product.stock !== undefined"
                class="info-item"
              >
                <div class="info-label">
                  库存：
                </div>
                <div class="info-value">
                  {{ product.stock }}
                </div>
              </div>

              <div
                v-if="product.category"
                class="info-item"
              >
                <div class="info-label">
                  分类：
                </div>
                <div class="info-value">
                  {{ product.category }}
                </div>
              </div>

              <div class="info-item">
                <div class="info-label">
                  网络图片链接：
                </div>
                <div class="info-value">
                  <el-link
                    v-if="product.imageUrl"
                    :href="product.imageUrl"
                    target="_blank"
                    type="primary"
                  >
                    点击查看原图
                  </el-link>
                  <span v-else>无</span>
                </div>
              </div>

              <div
                v-if="product.description"
                class="info-item full-width"
              >
                <div class="info-label">
                  产品描述：
                </div>
                <div class="info-value">
                  {{ product.description }}
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
                编辑产品
              </el-button>
              <el-button
                type="danger"
                :icon="Delete"
                @click="handleDelete"
              >
                删除产品
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-card
        v-if="subProducts && subProducts.length > 0"
        class="sub-products-card"
      >
        <template #header>
          <div class="card-header">
            <span>组合产品包含单品（{{ subProducts.length }}个）</span>
          </div>
        </template>

        <div class="sub-products-grid">
          <div
            v-for="sub in subProducts"
            :key="sub.sku"
            class="sub-product-card"
            @click="viewSubProduct(sub.sku)"
          >
            <div class="sub-card-img-wrapper">
              <el-image
                :src="getImageUrl(sub)"
                :preview="false"
                fit="cover"
                class="sub-card-img"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>
            <div class="sub-card-content">
              <div class="sub-card-sku">
                SKU：{{ sub.sku }}
              </div>
              <div
                class="sub-card-name"
                :title="sub.name || '未知名称'"
              >
                {{ sub.name || '未知名称' }}
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <el-card
        v-if="!product"
        class="no-data-card"
      >
        <el-empty description="暂无该产品的详细信息，请检查SKU是否正确！" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ProductDetail' })
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Picture, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi } from '@/api/product'
import { getProductTypeTag } from '@/types/utils'

const route = useRoute()
const router = useRouter()

const product = ref(null)
const subProducts = ref([])
const loading = ref(false)

const loadProductDetail = async () => {
  const sku = route.params.sku
  if (!sku) {
    ElMessage.error('SKU参数缺失')
    return
  }

  loading.value = true
  try {
    const response = await productApi.getDetail(sku)
    product.value = response.data
    
    if (product.value.type === '组合产品') {
      await loadSubProducts(sku)
    }
  } catch (error) {
    ElMessage.error('加载产品详情失败')
  } finally {
    loading.value = false
  }
}

const loadSubProducts = async (sku) => {
  try {
    const response = await productApi.getList({ parent_sku: sku })
    subProducts.value = response.data?.list || []
  } catch (error) {
    console.error('加载子产品失败:', error)
  }
}

const getImageUrl = (product) => {
  if (product.image) {
    return product.image
  }
  if (product.localPath) {
    return `/images/${product.localPath}`
  }
  if (product.thumbPath) {
    return `/images/${product.thumbPath}`
  }
  return '/images/default.png'
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

const goBack = () => {
  router.back()
}

const handleEdit = () => {
  ElMessage.info('编辑产品功能开发中...')
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该产品吗？删除后可从回收站恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await productApi.delete(product.value.sku)
    ElMessage.success('产品已移入回收站')
    router.push('/products')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const viewSubProduct = (sku) => {
  router.push(`/product/${sku}`)
}

</script>

<style scoped lang="scss">
.product-detail {
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

.product-sku {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 10px;
  font-weight: bold;
}

.product-name {
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
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.sub-products-card {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sub-products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.sub-product-card {
  background-color: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
}

.sub-card-img-wrapper {
  width: 100%;
  padding-top: 75%;
  position: relative;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  overflow: hidden;
}

.sub-card-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.sub-product-card:hover .sub-card-img {
  transform: scale(1.08);
}

.sub-card-content {
  padding: 12px;
}

.sub-card-sku {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.sub-card-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.no-data-card {
  text-align: center;
  padding: 60px 20px;
}
</style>
