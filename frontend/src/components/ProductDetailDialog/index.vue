<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="80%"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    class="product-detail-dialog"
    @close="handleClose"
  >
    <div v-loading="loading" class="dialog-content">
      <div v-if="product" class="detail-container">
        <div class="detail-header">
          <div class="product-image">
            <el-image
              :src="getImageUrl(product)"
              :preview-src-list="getPreviewImages()"
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
            <div class="product-id">
              {{ productIdText }}
            </div>
            <div class="product-name">
              {{ productNameText }}
            </div>

            <div class="info-grid">
              <!-- 选品特有字段 - 放在第一位 -->
              <div v-if="mode === 'selection' && product.listingDate !== undefined" class="info-item">
                <div class="info-label">
                  上架时间：
                </div>
                <div class="info-value">
                  {{ formatDate(product.listingDate) }}
                </div>
              </div>
              
              <div v-if="mode === 'selection' && product.listingDays !== undefined" class="info-item">
                <div class="info-label">
                  上架时间(天)：
                </div>
                <div class="info-value">
                  {{ product.listingDays }} 天
                </div>
              </div>

              <div v-if="product.type" class="info-item">
                <div class="info-label">
                  产品类型：
                </div>
                <div class="info-value">
                  <el-tag :type="getProductTypeTag(product.type)">
                    {{ product.type }}
                  </el-tag>
                </div>
              </div>

              <div v-if="product.developer" class="info-item">
                <div class="info-label">
                  开发负责人：
                </div>
                <div class="info-value">
                  {{ product.developer }}
                </div>
              </div>



              <div v-if="product.price" class="info-item">
                <div class="info-label">
                  价格：
                </div>
                <div class="info-value price">
                  ¥{{ product.price }}
                </div>
              </div>

              <div v-if="product.salesVolume" class="info-item">
                <div class="info-label">
                  销量：
                </div>
                <div class="info-value">
                  {{ formatSalesVolume(product.salesVolume) }}
                </div>
              </div>

              <div v-if="product.stock !== undefined" class="info-item">
                <div class="info-label">
                  库存：
                </div>
                <div class="info-value">
                  {{ product.stock }}
                </div>
              </div>

              <div v-if="product.category" class="info-item">
                <div class="info-label">
                  分类：
                </div>
                <div class="info-value">
                  {{ product.category }}
                </div>
              </div>

              <div v-if="product.storeName" class="info-item">
                <div class="info-label">
                  店铺名称：
                </div>
                <div class="info-value">
                  {{ product.storeName }}
                </div>
              </div>

              <div v-if="product.imageUrl" class="info-item">
                <div class="info-label">
                  网络图片链接：
                </div>
                <div class="info-value">
                  <el-link
                    :href="product.imageUrl"
                    target="_blank"
                    type="primary"
                  >
                    点击查看原图
                  </el-link>
                </div>
              </div>

              <div v-if="product.productLink" class="info-item">
                <div class="info-label">
                  产品链接：
                </div>
                <div class="info-value">
                  <el-link
                    :href="product.productLink"
                    target="_blank"
                    type="primary"
                  >
                    点击查看产品
                  </el-link>
                </div>
              </div>

              <!-- 相似商品链接 -->
              <div v-if="product.similarProducts || product.similarProductsLink" class="info-item">
                <div class="info-label">
                  相似商品链接：
                </div>
                <div class="info-value">
                  <el-link
                    :href="product.similarProducts || product.similarProductsLink"
                    target="_blank"
                    type="primary"
                  >
                    点击查看相似商品
                  </el-link>
                </div>
              </div>

              <div v-if="mode === 'selection' && product.mainCategoryBsrGrowth" class="info-item">
                <div class="info-label">
                  大类BSR增长数：
                </div>
                <div class="info-value">
                  {{ product.mainCategoryBsrGrowth }}
                </div>
              </div>

              <div v-if="mode === 'selection' && product.mainCategoryBsrGrowthRate" class="info-item">
                <div class="info-label">
                  大类BSR增长率：
                </div>
                <div class="info-value">
                  {{ product.mainCategoryBsrGrowthRate }}%
                </div>
              </div>

              <!-- 新增字段：店铺链接 -->
              <div v-if="product.storeLink" class="info-item">
                <div class="info-label">
                  店铺链接：
                </div>
                <div class="info-value">
                  <el-link
                    :href="product.storeLink"
                    target="_blank"
                    type="primary"
                  >
                    点击查看店铺
                  </el-link>
                </div>
              </div>

              <!-- 新增字段：店铺ID -->
              <div v-if="product.storeId" class="info-item">
                <div class="info-label">
                  店铺ID：
                </div>
                <div class="info-value">
                  {{ product.storeId }}
                </div>
              </div>

              <!-- 新增字段：配送方式 -->
              <div v-if="product.deliveryMethod" class="info-item">
                <div class="info-label">
                  配送方式：
                </div>
                <div class="info-value">
                  {{ product.deliveryMethod }}
                </div>
              </div>

              <!-- 新增字段：来源 -->
              <div v-if="product.source" class="info-item">
                <div class="info-label">
                  来源：
                </div>
                <div class="info-value">
                  <el-tag type="info" size="small">{{ product.source }}</el-tag>
                </div>
              </div>

              <!-- 新增字段：大类榜单名 -->
              <div v-if="product.mainCategoryName" class="info-item">
                <div class="info-label">
                  大类榜单名：
                </div>
                <div class="info-value">
                  {{ product.mainCategoryName }}
                </div>
              </div>

              <!-- 新增字段：榜单排名 -->
              <div v-if="product.rank" class="info-item">
                <div class="info-label">
                  榜单排名：
                </div>
                <div class="info-value">
                  {{ product.rank }}
                </div>
              </div>

              <!-- 新增字段：国家 -->
              <div v-if="product.country" class="info-item">
                <div class="info-label">
                  国家：
                </div>
                <div class="info-value">
                  <el-tag type="success" size="small">{{ product.country }}</el-tag>
                </div>
              </div>

              <!-- 新增字段：数据筛选模式 -->
              <div v-if="product.dataFilterMode" class="info-item">
                <div class="info-label">
                  数据筛选模式：
                </div>
                <div class="info-value">
                  <el-tag type="warning" size="small">{{ product.dataFilterMode }}</el-tag>
                </div>
              </div>

              <div v-if="product.description" class="info-item full-width">
                <div class="info-label">
                  产品描述：
                </div>
                <div class="info-value">
                  {{ product.description }}
                </div>
              </div>

              <div v-if="product.tags && product.tags.length > 0" class="info-item full-width">
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
                v-if="showEditButton"
                type="primary"
                :icon="Edit"
                @click="handleEdit"
              >
                编辑
              </el-button>
              <el-button
                v-if="showDeleteButton"
                type="danger"
                :icon="Delete"
                @click="handleDelete"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>

        <div
          v-if="subProducts && subProducts.length > 0"
          class="sub-products-section"
        >
          <div class="section-title">
            组合产品包含单品（{{ subProducts.length }}个）
          </div>
          <div class="sub-products-grid">
            <div
              v-for="sub in subProducts"
              :key="sub.sku"
              class="sub-product-card"
              @click="viewSubProduct(sub)"
            >
              <div class="sub-card-img-wrapper">
                <el-image
                  :src="getImageUrl(sub)"
                  :preview-src-list="[getImageUrl(sub)]"
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
        </div>
      </div>

      <el-empty v-else description="暂无详细信息" />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Picture, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi } from '@/api/product'
import { selectionApi } from '@/api/selection'
import { getProductTypeTag } from '@/types/utils'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  product: {
    type: Object,
    default: null
  },
  mode: {
    type: String,
    default: 'product'
  },
  showEditButton: {
    type: Boolean,
    default: false
  },
  showDeleteButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'edit', 'delete'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const loading = ref(false)
const subProducts = ref([])

const dialogTitle = computed(() => {
  if (!props.product) return '产品详情'
  if (props.mode === 'selection') {
    return `选品详情 - ${props.product.asin}`
  }
  return `产品详情 - ${props.product.sku}`
})

const productIdText = computed(() => {
  if (!props.product) return ''
  if (props.mode === 'selection') {
    return `ASIN：${props.product.asin}`
  }
  return `SKU：${props.product.sku}`
})

const productNameText = computed(() => {
  if (!props.product) return ''
  if (props.mode === 'selection') {
    return props.product.productTitle || '未知名称'
  }
  return props.product.name || '未知名称'
})

const getImageUrl = (product) => {
  if (!product) return '/images/default.png'
  if (product.image) {
    return product.image
  }
  if (product.localPath) {
    return `/images/${product.localPath}`
  }
  if (product.thumbPath) {
    return `/images/${product.thumbPath}`
  }
  if (product.imageUrl) {
    return product.imageUrl
  }
  return '/images/default.png'
}

const getPreviewImages = () => {
  if (!props.product) return []
  const images = []
  if (props.product.image) {
    images.push(props.product.image)
  }
  if (props.product.localPath) {
    images.push(`/images/${props.product.localPath}`)
  }
  if (props.product.thumbPath) {
    images.push(`/images/${props.product.thumbPath}`)
  }
  if (props.product.imageUrl) {
    images.push(props.product.imageUrl)
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

const formatSalesVolume = (volume) => {
  if (!volume) return '0'
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`
  }
  return volume.toString()
}

const loadSubProducts = async () => {
  if (!props.product || props.product.type !== '组合产品') return
  
  loading.value = true
  try {
    const response = await productApi.getList({ parent_sku: props.product.sku })
    subProducts.value = response.data?.list || []
  } catch (error) {
    console.error('加载子产品失败:', error)
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  emit('update:visible', false)
  subProducts.value = []
}

const handleEdit = () => {
  emit('edit', props.product)
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要删除吗？删除后可从回收站恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('delete', props.product)
    emit('update:visible', false)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const viewSubProduct = (subProduct) => {
  emit('update:visible', false)
  emit('edit', subProduct)
}

watch(() => props.visible, (newVal) => {
  if (newVal && props.product) {
    if (props.mode === 'product' && props.product.type === '组合产品') {
      loadSubProducts()
    }
  }
})
</script>

<style scoped lang="scss">
.product-detail-dialog {
  :deep(.el-dialog__body) {
    max-height: 70vh;
    overflow-y: auto;
  }
}

.dialog-content {
  min-height: 400px;
}

.detail-container {
  padding: 20px;
}

.detail-header {
  display: flex;
  gap: 30px;
  margin-bottom: 30px;
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    gap: 20px;
  }
}

.product-image {
  flex-shrink: 0;
  width: 350px;
  height: 350px;
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

.product-id {
  font-size: 24px;
  color: #2c3e50;
  margin-bottom: 8px;
  font-weight: bold;
}

.product-name {
  font-size: 18px;
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
  width: 100px;
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

.sub-products-section {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #e2e8f0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20px;
}

.sub-products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
</style>
