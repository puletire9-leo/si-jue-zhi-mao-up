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
              <div v-if="mode === 'selection' && (product.listingDate || product.availableDate)" class="info-item">
                <div class="info-label">
                  上架时间：
                </div>
                <div class="info-value">
                  {{ formatDate(product.listingDate || product.availableDate) }}
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