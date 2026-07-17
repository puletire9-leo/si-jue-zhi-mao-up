<template>
  <component
    :is="useDrawer ? 'el-drawer' : 'el-dialog'"
    v-model="dialogVisible"
    :title="dialogTitle"
    :class="[
      useDrawer ? 'product-detail-drawer' : 'product-detail-dialog',
      { 'selection-product-detail-dialog': mode === 'selection' },
    ]"
    v-bind="
      useDrawer
        ? { size: '65%', direction: 'rtl', destroyOnClose: true }
        : {
            width: mode === 'selection' ? '90%' : '80%',
            top: mode === 'selection' ? '4vh' : '15vh',
            closeOnClickModal: mode !== 'selection',
            closeOnPressEscape: true,
          }
    "
    @close="handleClose"
  >
    <SkeletonWrapper :loading="loading" variant="list">
      <div class="dialog-content">
        <div
          v-if="product"
          class="detail-container"
          :class="{
            'selection-detail-container': mode === 'selection',
            'selection-detail-container--drawer':
              mode === 'selection' && useDrawer,
          }"
        >
          <div class="detail-header">
            <div class="product-image">
              <el-image
                :src="getImageUrl(product)"
                :preview-src-list="getPreviewImages()"
                :fit="mode === 'selection' ? 'contain' : 'cover'"
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

              <template v-if="mode === 'selection'">
                <div class="selection-identity-row">
                  <div class="identity-tags">
                    <el-tag size="small" effect="dark">
                      {{ selectionMarketplace || "未知站点" }}
                    </el-tag>
                    <el-tag size="small" type="info" effect="plain">
                      {{ detailSourceText }}
                    </el-tag>
                    <el-tag
                      v-if="hasValue(product.fulfillment || product.deliveryMethod)"
                      size="small"
                      type="success"
                      effect="plain"
                    >
                      {{ detailText(product.fulfillment || product.deliveryMethod) }}
                    </el-tag>
                    <el-tag
                      v-for="badge in contentBadges"
                      :key="badge"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      {{ badge }}
                    </el-tag>
                  </div>
                  <div class="identity-actions">
                    <el-button size="small" link @click="handleCopyAsin">
                      <el-icon><DocumentCopy /></el-icon>
                      复制 ASIN
                    </el-button>
                    <el-button
                      v-if="hasValue(product.imageUrl)"
                      size="small"
                      link
                      @click="handleOpenOriginalImage"
                    >
                      <el-icon><View /></el-icon>
                      查看原图
                    </el-button>
                  </div>
                </div>

                <div class="selection-secondary-line">
                  <span><b>品牌</b>{{ detailText(product.brand) }}</span>
                  <span class="category-path" :title="detailText(product.nodeLabelPath || product.category)">
                    <b>类目</b>{{ detailText(product.nodeLabelPath || product.category) }}
                  </span>
                  <span><b>店铺</b>{{ detailText(product.storeName || product.sellerName) }}</span>
                </div>

                <div class="decision-metrics">
                  <div
                    v-for="metric in decisionMetrics"
                    :key="metric.key"
                    class="decision-metric"
                    :class="`metric-${metric.tone}`"
                  >
                    <div class="metric-label">{{ metric.label }}</div>
                    <div class="metric-value">{{ metric.value }}</div>
                    <div class="metric-extra">{{ metric.extra }}</div>
                  </div>
                </div>

                <el-tabs
                  v-model="selectionActiveTab"
                  class="selection-detail-tabs"
                >
                  <el-tab-pane label="概览" name="overview">
                    <div class="tab-scroll-area">
                      <div class="detail-section-grid">
                        <section class="compact-detail-section">
                          <h4>市场与价格</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in overviewMarketFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                        <section class="compact-detail-section">
                          <h4>商品与规格</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in overviewProductFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong :title="field.value">{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </el-tab-pane>

                  <el-tab-pane label="市场竞争" name="market">
                    <div class="tab-scroll-area">
                      <div class="detail-section-grid">
                        <section class="compact-detail-section">
                          <h4>销售与排名</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in marketPerformanceFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                        <section class="compact-detail-section">
                          <h4>评分与竞争</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in competitionFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                      </div>
                      <section v-if="subcategoryRows.length" class="compact-detail-section subcategory-section">
                        <h4>子类目排名</h4>
                        <div class="subcategory-list">
                          <span v-for="item in subcategoryRows" :key="`${item.code}-${item.rank}`">
                            {{ item.label || item.code }} <b>#{{ formatInteger(item.rank) }}</b>
                          </span>
                        </div>
                      </section>
                    </div>
                  </el-tab-pane>

                  <el-tab-pane label="规格物流" name="specification">
                    <div class="tab-scroll-area">
                      <div class="detail-section-grid">
                        <section class="compact-detail-section">
                          <h4>商品规格</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in specificationFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                        <section class="compact-detail-section">
                          <h4>物流与成本</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in logisticsFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </el-tab-pane>

                  <el-tab-pane label="卖家内容" name="seller">
                    <div class="tab-scroll-area">
                      <div class="detail-section-grid">
                        <section class="compact-detail-section">
                          <h4>卖家与店铺</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in sellerFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong :title="field.value">{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                        <section class="compact-detail-section">
                          <h4>内容质量</h4>
                          <div class="compact-field-grid">
                            <div v-for="field in contentFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </el-tab-pane>

                  <el-tab-pane
                    v-if="showVariantsTab"
                    :label="`变体 ${variants.length || detailVariantCount}`"
                    name="variants"
                  >
                    <div class="tab-scroll-area variants-tab-area">
                      <div v-if="variantsLoading" class="variants-loading">正在加载变体…</div>
                      <div v-else class="variant-table">
                        <button
                          v-for="v in variants"
                          :key="v.asin"
                          type="button"
                          class="variant-row"
                          :class="{ 'variant-current': v.asin === product.asin }"
                          @click="selectVariant(v)"
                        >
                          <el-image :src="v.imageUrl" fit="contain" class="variant-row-image">
                            <template #error><div class="variant-image-placeholder"><el-icon><Picture /></el-icon></div></template>
                          </el-image>
                          <span class="variant-row-asin">{{ v.asin }}</span>
                          <span class="variant-row-title" :title="v.title">{{ v.title || "—" }}</span>
                          <span>{{ formatMoney(v.price, v) }}</span>
                          <span>月销 {{ formatNumber(v.units) }}</span>
                          <span>BSR {{ formatInteger(v.bsr) }}</span>
                        </button>
                      </div>
                    </div>
                  </el-tab-pane>

                  <el-tab-pane label="数据来源" name="source">
                    <div class="tab-scroll-area">
                      <section class="compact-detail-section">
                        <div class="compact-field-grid source-field-grid">
                          <div v-for="field in sourceFields" :key="field.label" class="compact-field">
                            <span>{{ field.label }}</span><strong :title="field.value">{{ field.value }}</strong>
                          </div>
                        </div>
                      </section>
                      <el-collapse class="technical-collapse">
                        <el-collapse-item title="技术字段（低频）" name="technical">
                          <div class="compact-field-grid source-field-grid">
                            <div v-for="field in technicalFields" :key="field.label" class="compact-field">
                              <span>{{ field.label }}</span><strong :title="field.value">{{ field.value }}</strong>
                            </div>
                          </div>
                        </el-collapse-item>
                      </el-collapse>
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </template>

              <div v-else class="info-grid">
                <!-- 选品特有字段 - 放在第一位 -->
                <div
                  v-if="
                    mode === 'selection' &&
                    (product.listingDate || product.availableDate)
                  "
                  class="info-item"
                >
                  <div class="info-label">上架时间：</div>
                  <div class="info-value">
                    {{
                      formatDate(product.listingDate || product.availableDate)
                    }}
                  </div>
                </div>

                <div
                  v-if="
                    mode === 'selection' &&
                    realtimeListingDays(product) !== undefined &&
                    realtimeListingDays(product) !== null
                  "
                  class="info-item"
                >
                  <div class="info-label">上架天数：</div>
                  <div class="info-value">{{ realtimeListingDays(product) }} 天</div>
                </div>

                <div v-if="product.type" class="info-item">
                  <div class="info-label">产品类型：</div>
                  <div class="info-value">
                    <el-tag :type="getProductTypeTag(product.type)">
                      {{ product.type }}
                    </el-tag>
                  </div>
                </div>

                <div v-if="product.developer" class="info-item">
                  <div class="info-label">开发负责人：</div>
                  <div class="info-value">
                    {{ product.developer }}
                  </div>
                </div>

                <div v-if="product.price" class="info-item">
                  <div class="info-label">价格：</div>
                  <div class="info-value price">¥{{ product.price }}</div>
                </div>

                <div v-if="product.salesVolume" class="info-item">
                  <div class="info-label">销量：</div>
                  <div class="info-value">
                    {{ formatSalesVolume(product.salesVolume) }}
                  </div>
                </div>

                <div v-if="product.stock !== undefined" class="info-item">
                  <div class="info-label">库存：</div>
                  <div class="info-value">
                    {{ product.stock }}
                  </div>
                </div>

                <div v-if="product.category" class="info-item">
                  <div class="info-label">分类：</div>
                  <div class="info-value">
                    {{ product.category }}
                  </div>
                </div>

                <div
                  v-if="product.storeName || product.sellerName"
                  class="info-item"
                >
                  <div class="info-label">店铺名称：</div>
                  <div class="info-value">
                    {{ product.storeName || product.sellerName }}
                    <el-button
                      v-if="(product.storeName || product.sellerName) && (product.marketplace || product.country)"
                      size="small"
                      type="primary"
                      link
                      @click="goShopProfile"
                    >
                      查看店铺画像
                    </el-button>
                  </div>
                </div>

                <div v-if="product.imageUrl" class="info-item">
                  <div class="info-label">网络图片链接：</div>
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

                <div
                  v-if="product.productLink || product.productUrl"
                  class="info-item"
                >
                  <div class="info-label">产品链接：</div>
                  <div class="info-value">
                    <el-link
                      :href="product.productLink || product.productUrl"
                      target="_blank"
                      type="primary"
                    >
                      点击查看产品
                    </el-link>
                  </div>
                </div>

                <!-- 相似商品链接 -->
                <div
                  v-if="
                    product.similarProducts ||
                    product.similarProductsLink ||
                    product.similarUrl
                  "
                  class="info-item"
                >
                  <div class="info-label">相似商品链接：</div>
                  <div class="info-value">
                    <el-link
                      :href="
                        product.similarProducts ||
                        product.similarProductsLink ||
                        product.similarUrl
                      "
                      target="_blank"
                      type="primary"
                    >
                      点击查看相似商品
                    </el-link>
                  </div>
                </div>

                <div
                  v-if="mode === 'selection' && product.mainCategoryBsrGrowth"
                  class="info-item"
                >
                  <div class="info-label">大类BSR增长数：</div>
                  <div class="info-value">
                    {{ product.mainCategoryBsrGrowth }}
                  </div>
                </div>

                <div
                  v-if="
                    mode === 'selection' && product.mainCategoryBsrGrowthRate
                  "
                  class="info-item"
                >
                  <div class="info-label">大类BSR增长率：</div>
                  <div class="info-value">
                    {{ product.mainCategoryBsrGrowthRate }}%
                  </div>
                </div>

                <!-- 店铺链接 -->
                <div
                  v-if="
                    product.storeLink || product.storeUrl || product.shopLink
                  "
                  class="info-item"
                >
                  <div class="info-label">店铺链接：</div>
                  <div class="info-value">
                    <el-link
                      :href="
                        product.storeLink ||
                        product.storeUrl ||
                        product.shopLink
                      "
                      target="_blank"
                      type="primary"
                    >
                      点击查看店铺
                    </el-link>
                  </div>
                </div>

                <!-- 店铺ID -->
                <div
                  v-if="product.storeId || product.sellerId"
                  class="info-item"
                >
                  <div class="info-label">店铺ID：</div>
                  <div class="info-value">
                    {{ product.storeId || product.sellerId }}
                  </div>
                </div>

                <!-- 配送方式 -->
                <div
                  v-if="product.deliveryMethod || product.fulfillment"
                  class="info-item"
                >
                  <div class="info-label">配送方式：</div>
                  <div class="info-value">
                    {{ product.deliveryMethod || product.fulfillment }}
                  </div>
                </div>

                <!-- 品牌 -->
                <div v-if="product.brand" class="info-item">
                  <div class="info-label">品牌：</div>
                  <div class="info-value">
                    {{ product.brand }}
                  </div>
                </div>

                <!-- BSR -->
                <div
                  v-if="product.bsr !== undefined && product.bsr !== null"
                  class="info-item"
                >
                  <div class="info-label">BSR：</div>
                  <div class="info-value">
                    {{ product.bsr }}
                  </div>
                </div>

                <!-- 评分 -->
                <div v-if="product.rating" class="info-item">
                  <div class="info-label">评分：</div>
                  <div class="info-value">
                    {{ product.rating }} ({{ product.ratings || 0 }}评)
                  </div>
                </div>

                <!-- 重量 -->
                <div v-if="product.weight || product.weightG" class="info-item">
                  <div class="info-label">重量：</div>
                  <div class="info-value">
                    {{ product.weight || ""
                    }}{{ product.weightG ? " (" + product.weightG + "g)" : "" }}
                  </div>
                </div>

                <!-- 新增字段：来源 -->
                <div v-if="product.source" class="info-item">
                  <div class="info-label">来源：</div>
                  <div class="info-value">
                    <el-tag type="info" size="small">{{
                      product.source
                    }}</el-tag>
                  </div>
                </div>

                <!-- 新增字段：大类榜单名 -->
                <div v-if="product.mainCategoryName" class="info-item">
                  <div class="info-label">大类榜单名：</div>
                  <div class="info-value">
                    {{ product.mainCategoryName }}
                  </div>
                </div>

                <!-- 新增字段：榜单排名 -->
                <div v-if="product.rank" class="info-item">
                  <div class="info-label">榜单排名：</div>
                  <div class="info-value">
                    {{ product.rank }}
                  </div>
                </div>

                <!-- 新增字段：国家 -->
                <div v-if="product.country" class="info-item">
                  <div class="info-label">国家：</div>
                  <div class="info-value">
                    <el-tag type="success" size="small">{{
                      product.country
                    }}</el-tag>
                  </div>
                </div>

                <div v-if="product.description" class="info-item full-width">
                  <div class="info-label">产品描述：</div>
                  <div class="info-value">
                    {{ product.description }}
                  </div>
                </div>

                <div
                  v-if="product.tags && product.tags.length > 0"
                  class="info-item full-width"
                >
                  <div class="info-label">标签：</div>
                  <div class="info-value">
                    <el-tag
                      v-for="(tag, index) in product.tags"
                      :key="index"
                      size="small"
                      type="info"
                      effect="plain"
                      style="margin-right: 8px; margin-bottom: 8px"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <div
                class="action-buttons"
                :class="{ 'selection-action-buttons': mode === 'selection' }"
              >
                <el-button
                  type="primary"
                  :icon="Promotion"
                  @click="handleOpenProductLink"
                >
                  打开 Amazon
                </el-button>
                <el-button
                  v-if="mode === 'selection' && (product.storeName || product.sellerName)"
                  @click="goShopProfile"
                >
                  <el-icon><Shop /></el-icon>
                  店铺画像
                </el-button>
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
                <el-button
                  v-if="showDeveloperLibraryActions"
                  type="success"
                  :icon="Collection"
                  :loading="developerLibraryLoading === 'GOOD'"
                  @click="handleAddToDeveloperLibrary('GOOD')"
                >
                  加入选品库
                </el-button>
                <el-button
                  v-if="showDeveloperLibraryActions"
                  type="warning"
                  :icon="Warning"
                  :loading="developerLibraryLoading === 'BAD'"
                  @click="handleAddToDeveloperLibrary('BAD')"
                >
                  加入差品库
                </el-button>
              </div>
            </div>
          </div>

          <!-- 变体列表 -->
          <div
            v-if="mode !== 'selection' && variants && variants.length >= 1"
            class="variants-section"
          >
            <div class="section-title">
              {{
                variants.length > 1
                  ? `变体列表（${variants.length}个 / 父ASIN: ${product.parentAsin || product.asin}）`
                  : `独立品（无变体 / ASIN: ${product.asin}）`
              }}
            </div>
            <div class="variants-grid">
              <div
                v-for="v in variants"
                :key="v.asin"
                class="variant-card"
                :class="{ 'variant-current': v.asin === product.asin }"
                @click="selectVariant(v)"
              >
                <div class="variant-img-wrapper">
                  <el-image
                    :src="v.imageUrl"
                    :preview-src-list="[v.imageUrl]"
                    fit="cover"
                    class="variant-img"
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon><Picture /></el-icon>
                      </div>
                    </template>
                  </el-image>
                </div>
                <div class="variant-info">
                  <div class="variant-title" :title="v.title">
                    {{ v.title }}
                  </div>
                  <div class="variant-meta">
                    <span v-if="v.price">€{{ v.price }}</span>
                    <span v-if="v.units">销量 {{ v.units }}</span>
                    <span v-if="v.bsr">BSR {{ v.bsr }}</span>
                  </div>
                </div>
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
                  <div class="sub-card-sku">SKU：{{ sub.sku }}</div>
                  <div class="sub-card-name" :title="sub.name || '未知名称'">
                    {{ sub.name || "未知名称" }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <el-empty v-else description="暂无详细信息" />
      </div>
    </SkeletonWrapper>
  </component>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Picture,
  Edit,
  Delete,
  Promotion,
  Collection,
  Warning,
  DocumentCopy,
  View,
  Shop,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { productApi } from "@/api/product";
import { selectionApi } from "@/api/selection";
import { competitorApi } from "@/api/competitor";
import { getProductTypeTag } from "@/types/utils";
import {
  cleanDetailValue,
  detailText,
  firstDetailValue,
  formatDetailInteger,
  formatDetailMoney,
  formatDetailNumber,
  formatDetailPercent,
  getDetailUnits,
  getDetailVariantCount,
  getDetailWeight,
  hasDetailValue,
  isPositiveDetailFlag,
  normalizeDetailMarketplace,
} from "./productDetail";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  product: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    default: "product",
  },
  dataSource: {
    type: String,
    default: "zheng",
  },
  useDrawer: {
    type: Boolean,
    default: false,
  },
  showEditButton: {
    type: Boolean,
    default: false,
  },
  showDeleteButton: {
    type: Boolean,
    default: false,
  },
  showDeveloperLibraryActions: {
    type: Boolean,
    default: false,
  },
  developerLibraryLoading: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "update:visible",
  "edit",
  "delete",
  "select-product",
  "add-to-developer-library",
]);

const router = useRouter();

// 从商品跳店铺画像：店铺维度统一进店铺总览，用 snapshots 判断是否抓过全集由目标页处理。
function goShopProfile() {
  const sellerName = props.product?.storeName || props.product?.sellerName;
  const marketplace = normalizeMarketplace(
    props.product?.marketplace || props.product?.country,
  );
  if (!sellerName || !marketplace) {
    ElMessage.warning("该商品缺少店铺名或标准市场码，无法跳转店铺画像");
    return;
  }
  emit("update:visible", false);
  router.push({
    name: "module-shop-collection-shops-ShopCollectionShops",
    query: { marketplace, sellerName, tab: "products" },
  });
}

function normalizeMarketplace(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const map = {
    UK: "UK",
    GB: "UK",
    "UNITED KINGDOM": "UK",
    英国: "UK",
    DE: "DE",
    GER: "DE",
    GERMANY: "DE",
    德国: "DE",
    US: "US",
    USA: "US",
    "UNITED STATES": "US",
    美国: "US",
  };
  return map[upper] || map[raw] || "";
}

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const loading = ref(false);
const subProducts = ref([]);
const variants = ref([]);
const variantsLoading = ref(false);
const selectionActiveTab = ref("overview");

const selectionProduct = computed(() => props.product || {});

const selectionMarketplace = computed(() =>
  normalizeDetailMarketplace(
    firstDetailValue(selectionProduct.value, "marketplace", "country"),
  ),
);

const detailSourceText = computed(() => {
  const explicit = cleanDetailValue(selectionProduct.value.source);
  if (explicit) return String(explicit);
  if (props.dataSource === "premium") return "精品榜";
  if (props.dataSource === "selection") return "新品/竞品";
  if (props.dataSource === "zheng") return "非标店铺";
  return "选品数据";
});

const hasValue = hasDetailValue;
const formatNumber = formatDetailNumber;
const formatInteger = formatDetailInteger;
const formatPercent = formatDetailPercent;
const formatFlag = (value) =>
  hasDetailValue(value) ? (isPositiveDetailFlag(value) ? "有" : "无") : "—";

const formatMoney = (
  value,
  record = selectionProduct.value,
  allowNegative = false,
) =>
  formatDetailMoney(
    value,
    firstDetailValue(record, "marketplace", "country") ||
      selectionMarketplace.value,
    record.symbol,
    allowNegative,
  );

const detailVariantCount = computed(() =>
  getDetailVariantCount(selectionProduct.value),
);

const contentBadges = computed(() => {
  const badges = [];
  const product = selectionProduct.value;
  if (isPositiveDetailFlag(product.bestSeller)) badges.push("Best Seller");
  if (isPositiveDetailFlag(product.amazonChoice)) badges.push("Amazon Choice");
  if (isPositiveDetailFlag(product.newRelease)) badges.push("New Release");
  return badges;
});

const listingDateValue = computed(() =>
  firstDetailValue(selectionProduct.value, "listingDate", "availableDate"),
);

const listingDaysValue = computed(() =>
  realtimeListingDays(selectionProduct.value),
);

const ratingSummary = computed(() => {
  const rating = formatNumber(selectionProduct.value.rating);
  const ratings = formatInteger(selectionProduct.value.ratings);
  return rating === "—" && ratings === "—" ? "—" : `${rating} / ${ratings}评`;
});

const decisionMetrics = computed(() => [
  {
    key: "price",
    label: "价格",
    value: formatMoney(selectionProduct.value.price),
    extra:
      hasDetailValue(selectionProduct.value.primePrice)
        ? `Prime ${formatMoney(selectionProduct.value.primePrice)}`
        : "当前售价",
    tone: "primary",
  },
  {
    key: "units",
    label: "月销量",
    value: formatNumber(getDetailUnits(selectionProduct.value)),
    extra:
      hasDetailValue(selectionProduct.value.unitsGr)
        ? `增长 ${formatPercent(selectionProduct.value.unitsGr)}`
        : "月度估算",
    tone: "success",
  },
  {
    key: "revenue",
    label: "月销售额",
    value: formatMoney(selectionProduct.value.revenue),
    extra: "月度估算",
    tone: "success",
  },
  {
    key: "listing",
    label: "上架时间",
    value:
      listingDaysValue.value === null || listingDaysValue.value === undefined
        ? "—"
        : `${listingDaysValue.value}天`,
    extra: formatDate(listingDateValue.value, true),
    tone: "warning",
  },
  {
    key: "bsr",
    label: "BSR",
    value: formatInteger(selectionProduct.value.bsr),
    extra: detailText(
      firstDetailValue(selectionProduct.value, "nodeLabelPath", "category"),
    ),
    tone: "neutral",
  },
  {
    key: "rating",
    label: "评分 / 评论",
    value: ratingSummary.value,
    extra:
      hasDetailValue(selectionProduct.value.ratingsRate)
        ? `评论增长 ${formatPercent(selectionProduct.value.ratingsRate)}`
        : "Amazon 评论",
    tone: "neutral",
  },
  {
    key: "variants",
    label: "变体 / 卖家",
    value:
      detailVariantCount.value > 1
        ? `${detailVariantCount.value}变体`
        : "无变体",
    extra: `${formatNumber(selectionProduct.value.sellers)}个卖家`,
    tone: "neutral",
  },
  {
    key: "weight",
    label: "重量 / 配送",
    value: getDetailWeight(selectionProduct.value),
    extra: detailText(
      firstDetailValue(selectionProduct.value, "fulfillment", "deliveryMethod"),
    ),
    tone: "neutral",
  },
]);

const fields = (...items) =>
  items.map(([label, value]) => ({ label, value: detailText(value) }));

const overviewMarketFields = computed(() => [
  { label: "Prime 价", value: formatMoney(selectionProduct.value.primePrice) },
  { label: "配送费", value: formatMoney(selectionProduct.value.deliveryPrice) },
  { label: "FBA 费用", value: formatMoney(selectionProduct.value.fba) },
  { label: "利润", value: formatMoney(selectionProduct.value.profit, selectionProduct.value, true) },
  { label: "卖家数", value: formatInteger(selectionProduct.value.sellers) },
  { label: "评论数", value: formatInteger(selectionProduct.value.ratings) },
]);

const overviewProductFields = computed(() =>
  fields(
    ["商品重量", getDetailWeight(selectionProduct.value)],
    ["商品尺寸", selectionProduct.value.dimension],
    ["包装尺寸", selectionProduct.value.pkgDimensions],
    ["包装重量", selectionProduct.value.pkgWeight],
    ["配送方式", selectionProduct.value.fulfillment],
    ["品牌", selectionProduct.value.brand],
  ),
);

const marketPerformanceFields = computed(() => [
  { label: "月销量", value: formatNumber(getDetailUnits(selectionProduct.value)) },
  { label: "销量增长", value: formatPercent(selectionProduct.value.unitsGr) },
  { label: "Amazon 销量", value: formatNumber(selectionProduct.value.amzUnit) },
  { label: "Amazon 销售额", value: formatMoney(selectionProduct.value.amzSales) },
  { label: "月销售额", value: formatMoney(selectionProduct.value.revenue) },
  { label: "BSR", value: formatInteger(selectionProduct.value.bsr) },
  { label: "BSR 变化率", value: formatPercent(selectionProduct.value.bsrCr) },
  { label: "BSR 变化值", value: formatInteger(selectionProduct.value.bsrCv) },
]);

const competitionFields = computed(() => [
  { label: "评分", value: formatNumber(selectionProduct.value.rating) },
  { label: "评论数", value: formatInteger(selectionProduct.value.ratings) },
  { label: "评论增长率", value: formatPercent(selectionProduct.value.ratingsRate) },
  { label: "评论变化值", value: formatNumber(selectionProduct.value.ratingsCv) },
  { label: "评分变化", value: formatNumber(selectionProduct.value.ratingDelta) },
  { label: "卖家数", value: formatInteger(selectionProduct.value.sellers) },
  { label: "变体数", value: formatInteger(detailVariantCount.value) },
  { label: "类目", value: detailText(selectionProduct.value.nodeLabelPath) },
]);

const specificationFields = computed(() =>
  fields(
    ["商品重量", getDetailWeight(selectionProduct.value)],
    ["标准重量(g)", firstDetailValue(selectionProduct.value, "weightG", "weight_g")],
    ["商品尺寸", selectionProduct.value.dimension],
    ["尺寸单位", selectionProduct.value.dimensionsType],
    ["包装尺寸", selectionProduct.value.pkgDimensions],
    ["包装尺寸单位", selectionProduct.value.pkgDimensionType],
    ["包装重量", selectionProduct.value.pkgWeight],
    ["SKU", selectionProduct.value.sku],
  ),
);

const logisticsFields = computed(() => [
  { label: "配送方式", value: detailText(selectionProduct.value.fulfillment) },
  { label: "当前价格", value: formatMoney(selectionProduct.value.price) },
  { label: "Prime 价", value: formatMoney(selectionProduct.value.primePrice) },
  { label: "配送费", value: formatMoney(selectionProduct.value.deliveryPrice) },
  { label: "FBA 费用", value: formatMoney(selectionProduct.value.fba) },
  { label: "利润", value: formatMoney(selectionProduct.value.profit, selectionProduct.value, true) },
]);

const sellerFields = computed(() =>
  fields(
    ["店铺名称", firstDetailValue(selectionProduct.value, "storeName", "sellerName")],
    ["卖家 ID", firstDetailValue(selectionProduct.value, "storeId", "sellerId")],
    ["卖家国家", selectionProduct.value.sellerNation],
    ["卖家数量", selectionProduct.value.sellers],
    ["品牌", selectionProduct.value.brand],
    ["配送方式", selectionProduct.value.fulfillment],
  ),
);

const contentFields = computed(() =>
  [
    { label: "Listing 质量分", value: detailText(selectionProduct.value.lqs) },
    { label: "Best Seller", value: formatFlag(selectionProduct.value.bestSeller) },
    { label: "Amazon Choice", value: formatFlag(selectionProduct.value.amazonChoice) },
    { label: "New Release", value: formatFlag(selectionProduct.value.newRelease) },
    { label: "A+ / EBC", value: formatFlag(selectionProduct.value.ebc) },
    { label: "视频", value: formatFlag(selectionProduct.value.video) },
  ],
);

const sourceFields = computed(() =>
  fields(
    ["站点", selectionMarketplace.value],
    ["数据来源", detailSourceText.value],
    ["月份", selectionProduct.value.month],
    ["周批次", selectionProduct.value.weekTag],
    ["入库时间", firstDetailValue(selectionProduct.value, "createdAt", "created_at")],
    ["更新时间", firstDetailValue(selectionProduct.value, "updatedAt", "updated_at")],
    ["八爪鱼任务", selectionProduct.value.bazhuayuTaskName],
    ["采集批次", firstDetailValue(selectionProduct.value, "sourceRunId", "batchDate", "batchCode")],
  ),
);

const technicalFields = computed(() =>
  fields(
    ["数据库 ID", selectionProduct.value.id],
    ["父 ASIN", selectionProduct.value.parentAsin],
    ["节点 ID", selectionProduct.value.nodeId],
    ["节点路径", selectionProduct.value.nodeIdPath],
    ["BSR ID", selectionProduct.value.bsrId],
    ["任务 ID", selectionProduct.value.bazhuayuTaskId],
  ),
);

const subcategoryRows = computed(() => {
  const rows = selectionProduct.value.subcategories;
  return Array.isArray(rows) ? rows : [];
});

const showVariantsTab = computed(
  () => variantsLoading.value || variants.value.length > 1 || detailVariantCount.value > 1,
);

const dialogTitle = computed(() => {
  if (!props.product) return "产品详情";
  if (props.mode === "selection") {
    if (props.dataSource === "zheng") {
      return `非标产品详情 - ${props.product.asin}`;
    }
    if (props.dataSource === "premium") {
      return `精品详情 - ${props.product.asin}`;
    }
    return `选品详情 - ${props.product.asin}`;
  }
  return `产品详情 - ${props.product.sku}`;
});

const productIdText = computed(() => {
  if (!props.product) return "";
  if (props.mode === "selection") {
    return `ASIN：${props.product.asin}`;
  }
  return `SKU：${props.product.sku}`;
});

const productNameText = computed(() => {
  if (!props.product) return "";
  if (props.mode === "selection") {
    return props.product.productTitle || props.product.title || "未知名称";
  }
  return props.product.name || "未知名称";
});

const getImageUrl = (product) => {
  if (!product) return "/images/default.png";
  if (product.image) {
    return product.image;
  }
  if (product.localPath) {
    return `/images/${product.localPath}`;
  }
  if (product.thumbPath) {
    return `/images/${product.thumbPath}`;
  }
  if (product.imageUrl) {
    return product.imageUrl;
  }
  return "/images/default.png";
};

const getPreviewImages = () => {
  if (!props.product) return [];
  const images = [];
  if (props.product.image) {
    images.push(props.product.image);
  }
  if (props.product.localPath) {
    images.push(`/images/${props.product.localPath}`);
  }
  if (props.product.thumbPath) {
    images.push(`/images/${props.product.thumbPath}`);
  }
  if (props.product.imageUrl) {
    images.push(props.product.imageUrl);
  }
  return images;
};

const formatDate = (dateValue, dateOnly = false) => {
  if (dateValue === null || dateValue === undefined || dateValue === "")
    return "—";
  // available_date 是毫秒时间戳（bigint），JSON 里可能是数字或纯数字字符串；
  // 其余情况按普通日期字符串解析。
  const raw = typeof dateValue === "string" ? dateValue.trim() : dateValue;
  const isEpochMs =
    typeof raw === "number" ||
    (typeof raw === "string" && /^\d{10,}$/.test(raw));
  const date = isEpochMs ? new Date(Number(raw)) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(dateOnly
      ? {}
      : {
          hour: "2-digit",
          minute: "2-digit",
        }),
  });
};

// 实时上架天数：优先用 available_date（今天 - 上架日，每天自动增长）；
// 没有真实上架时间戳时，回退到后端 listing_days 快照。
const realtimeListingDays = (product) => {
  const availableDate = product?.availableDate ?? product?.listingDate;
  if (availableDate != null && availableDate !== "") {
    const raw =
      typeof availableDate === "string" ? availableDate.trim() : availableDate;
    const isEpochMs =
      typeof raw === "number" ||
      (typeof raw === "string" && /^\d{10,}$/.test(raw));
    const date = isEpochMs ? new Date(Number(raw)) : new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    }
  }
  return product?.listingDays;
};

const formatSalesVolume = (volume) => {
  if (!volume) return "0";
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`;
  }
  return volume.toString();
};

const loadSubProducts = async () => {
  if (!props.product || props.product.type !== "组合产品") return;

  loading.value = true;
  try {
    const response = await productApi.getList({
      parent_sku: props.product.sku,
    });
    subProducts.value = response.data?.list || [];
  } catch (error) {
    console.error("加载子产品失败:", error);
  } finally {
    loading.value = false;
  }
};

const loadVariants = async () => {
  if (!props.product || props.mode !== "selection") return;
  const parentAsin = props.product.parentAsin || props.product.asin;
  const marketplace = normalizeDetailMarketplace(
    props.product.marketplace || props.product.country,
  );
  if (!parentAsin || !marketplace) return;

  variantsLoading.value = true;
  try {
    const res =
      props.dataSource === "premium"
        ? await competitorApi.getPremiumVariants(marketplace, parentAsin)
        : props.dataSource === "selection"
          ? await competitorApi.getVariants(marketplace, parentAsin)
          : await competitorApi.getDengZongVariants(marketplace, parentAsin);
    variants.value = res.data || [];
  } catch (e) {
    console.error("加载变体失败:", e);
    variants.value = [];
  } finally {
    variantsLoading.value = false;
  }
};

const handleClose = () => {
  emit("update:visible", false);
  subProducts.value = [];
  variants.value = [];
  variantsLoading.value = false;
  selectionActiveTab.value = "overview";
};

const handleEdit = () => {
  emit("edit", props.product);
};

const handleAddToDeveloperLibrary = (bucket) => {
  emit("add-to-developer-library", props.product, bucket);
};

const handleCopyAsin = async () => {
  const asin = String(props.product?.asin || "").trim();
  if (!asin) {
    ElMessage.warning("当前商品缺少 ASIN");
    return;
  }
  try {
    await navigator.clipboard.writeText(asin);
    ElMessage.success(`已复制 ${asin}`);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = asin;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    ElMessage.success(`已复制 ${asin}`);
  }
};

const handleOpenOriginalImage = () => {
  const imageUrl = cleanDetailValue(props.product?.imageUrl);
  if (imageUrl) window.open(String(imageUrl), "_blank", "noopener,noreferrer");
};

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      "确定要删除吗？删除后可从回收站恢复。",
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    emit("delete", props.product);
    emit("update:visible", false);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const selectVariant = (v) => {
  emit("select-product", v);
};

const getAmazonUrl = () => {
  if (!props.product) return "";
  const raw = props.product.productLink || props.product.productUrl || "";
  if (raw) return raw;
  // 详情操作始终针对当前 ASIN，避免切换子变体后仍打开父体。
  const asin = props.product.asin || props.product.parentAsin;
  const mkp = normalizeDetailMarketplace(
    props.product.marketplace || props.product.country,
  );
  if (asin && mkp) {
    const domains = {
      US: "www.amazon.com",
      UK: "www.amazon.co.uk",
      DE: "www.amazon.de",
      CA: "www.amazon.ca",
      JP: "www.amazon.co.jp",
      FR: "www.amazon.fr",
      IT: "www.amazon.it",
      ES: "www.amazon.es",
    };
    return `https://${domains[mkp] || "www.amazon.com"}/dp/${asin}`;
  }
  return "";
};

const handleOpenProductLink = () => {
  const url = getAmazonUrl();
  if (url) window.open(url, "_blank");
};

const viewSubProduct = (subProduct) => {
  emit("update:visible", false);
  emit("edit", subProduct);
};

watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.product) {
      if (props.mode === "product" && props.product.type === "组合产品") {
        loadSubProducts();
      }
      if (props.mode === "selection") {
        loadVariants();
      }
    }
  },
);
</script>

<style scoped lang="scss">
.product-detail-dialog {
  :deep(.el-dialog__body) {
    max-height: 70vh;
    overflow-y: auto;
  }
}

.selection-product-detail-dialog {
  :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 16px 22px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  }

  :deep(.el-dialog__body) {
    max-height: 84vh;
    padding: 0;
    overflow: hidden;
  }
}

.product-detail-drawer {
  :deep(.el-drawer__body) {
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
  background: linear-gradient(
    135deg,
    var(--el-fill-color-lighter, #f8fafc) 0%,
    var(--el-border-color-extra-light, #e2e8f0) 100%
  );
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 48px;
  color: var(--el-text-color-disabled, #cbd5e1);
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.product-id {
  font-size: 24px;
  color: var(--el-text-color-primary, #2c3e50);
  margin-bottom: 8px;
  font-weight: bold;
}

.product-name {
  font-size: 18px;
  color: var(--el-text-color-regular, #34495e);
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--el-border-color-extra-light, #f0f0f0);
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
  background-color: var(--el-fill-color-light, #f8f9fa);
  border-radius: 4px;

  &.full-width {
    grid-column: 1 / -1;
  }
}

.info-label {
  width: 100px;
  color: var(--el-text-color-secondary, #7f8c8d);
  font-weight: 500;
  font-size: 14px;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  color: var(--el-text-color-primary, #2c3e50);
  font-size: 14px;
  word-break: break-all;

  &.price {
    font-size: 18px;
    font-weight: bold;
    color: var(--el-color-danger, #e74c3c);
  }
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
}

.sub-products-section {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid var(--el-border-color-light, #e2e8f0);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary, #2c3e50);
  margin-bottom: 20px;
}

.sub-products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.sub-product-card {
  background-color: var(--el-bg-color, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light, #e2e8f0);
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
  background: linear-gradient(
    135deg,
    var(--el-fill-color-lighter, #f8fafc) 0%,
    var(--el-border-color-extra-light, #e2e8f0) 100%
  );
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
  color: var(--el-text-color-placeholder, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.sub-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary, #1e293b);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Variants */
.variants-section {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid var(--el-border-color-light, #e2e8f0);
}

.variants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.variant-card {
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light, #e2e8f0);
  overflow: hidden;
  transition: all 0.2s;
  display: flex;
  gap: 10px;
  padding: 10px;

  &:hover {
    border-color: var(--el-color-primary, #409eff);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
  }

  &.variant-current {
    border-color: var(--el-color-success, #67c23a);
    background: var(--el-color-success-light-9, #f0f9eb);
  }
}

.variant-img-wrapper {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color-light, #f5f7fa);
}

.variant-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.variant-info {
  flex: 1;
  min-width: 0;
}

.variant-title {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-primary, #303133);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4px;
}

.variant-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder, #909399);
}

/* 选品决策详情 */
.selection-detail-container {
  height: calc(86vh - 60px);
  min-height: 620px;
  max-height: 720px;
  padding: 18px 22px 0;
  overflow: hidden;

  .detail-header {
    height: 100%;
    gap: 26px;
    margin: 0;
  }

  .product-image {
    width: clamp(280px, 28vw, 390px);
    height: clamp(360px, 62vh, 660px);
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter, #ebeef5);
    border-radius: 12px;
    background: var(--el-bg-color, #fff);
  }

  .main-image {
    background: #fff;
  }

  .product-id {
    margin-bottom: 6px;
    font-size: 22px;
    line-height: 1.2;
  }

  .product-name {
    display: -webkit-box;
    min-height: 48px;
    margin-bottom: 8px;
    padding-bottom: 10px;
    overflow: hidden;
    font-size: 16px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
}

.selection-identity-row,
.selection-secondary-line,
.identity-tags,
.identity-actions {
  display: flex;
  align-items: center;
}

.selection-identity-row {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.identity-tags,
.identity-actions {
  flex-wrap: wrap;
  gap: 6px;
}

.identity-actions {
  flex-shrink: 0;
}

.selection-secondary-line {
  gap: 8px 18px;
  margin-bottom: 12px;
  overflow: hidden;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;

  span {
    display: inline-flex;
    min-width: 0;
    gap: 6px;
    white-space: nowrap;
  }

  b {
    color: var(--el-text-color-placeholder, #909399);
    font-weight: 500;
  }

  .category-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.decision-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.decision-metric {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light, #fafafa);

  &.metric-primary {
    border-color: var(--el-color-primary-light-7, #a0cfff);
    background: var(--el-color-primary-light-9, #ecf5ff);
  }

  &.metric-success {
    border-color: var(--el-color-success-light-7, #b3e19d);
  }

  &.metric-warning {
    border-color: var(--el-color-warning-light-7, #f3d19e);
  }
}

.metric-label {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 11px;
}

.metric-value {
  overflow: hidden;
  color: var(--el-text-color-primary, #303133);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-extra {
  margin-top: 3px;
  overflow: hidden;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-detail-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;

  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }

  :deep(.el-tabs__item) {
    height: 36px;
    padding: 0 14px;
    font-size: 13px;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.tab-scroll-area {
  height: 100%;
  min-height: 150px;
  padding-right: 5px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
}

.detail-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.compact-detail-section {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  background: var(--el-bg-color, #fff);

  h4 {
    margin: 0 0 8px;
    color: var(--el-text-color-primary, #303133);
    font-size: 13px;
  }
}

.compact-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.compact-field {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--el-border-color-extra-light, #f2f3f5);
  font-size: 12px;

  span {
    flex-shrink: 0;
    color: var(--el-text-color-secondary, #909399);
  }

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--el-text-color-primary, #303133);
    font-weight: 600;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.subcategory-section {
  margin-top: 10px;
}

.subcategory-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    padding: 5px 8px;
    border-radius: 6px;
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-text-color-regular, #606266);
    font-size: 11px;
  }
}

.source-field-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.technical-collapse {
  margin-top: 8px;

  :deep(.el-collapse-item__header) {
    height: 36px;
    font-size: 12px;
  }
}

.variants-tab-area {
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
}

.variants-loading {
  padding: 40px;
  color: var(--el-text-color-secondary, #909399);
  text-align: center;
}

.variant-table {
  display: flex;
  flex-direction: column;
}

.variant-row {
  display: grid;
  grid-template-columns: 42px 100px minmax(180px, 1fr) 90px 85px 95px;
  gap: 10px;
  min-height: 52px;
  align-items: center;
  padding: 5px 10px;
  border: 0;
  border-bottom: 1px solid var(--el-border-color-extra-light, #f2f3f5);
  background: #fff;
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
  font-size: 11px;
  text-align: left;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
  }

  &.variant-current {
    background: var(--el-color-success-light-9, #f0f9eb);
    box-shadow: inset 3px 0 0 var(--el-color-success, #67c23a);
  }
}

.variant-row-image,
.variant-image-placeholder {
  width: 38px;
  height: 38px;
}

.variant-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder, #a8abb2);
}

.variant-row-asin {
  color: var(--el-text-color-primary, #303133);
  font-weight: 700;
}

.variant-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-action-buttons {
  position: sticky;
  z-index: 5;
  bottom: 0;
  align-items: center;
  margin: 8px -4px 0;
  padding: 10px 4px 12px;
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}

.selection-detail-container--drawer {
  height: auto;
  min-height: 100%;
  max-height: none;
  overflow-y: auto;

  .detail-header {
    display: block;
    height: auto;
  }

  .product-image {
    width: 100%;
    height: 300px;
    margin-bottom: 18px;
  }

  .decision-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tab-scroll-area {
    height: 300px;
  }
}

@media (max-width: 1200px) {
  .selection-detail-container {
    .product-image {
      width: 300px;
    }
  }

  .decision-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tab-scroll-area {
    height: 185px;
  }
}

@media (max-width: 768px) {
  .selection-detail-container {
    height: auto;
    max-height: none;
    overflow-y: auto;

    .product-image {
      width: 100%;
      height: 280px;
    }
  }

  .decision-metrics,
  .detail-section-grid,
  .compact-field-grid,
  .source-field-grid {
    grid-template-columns: 1fr;
  }

  .selection-secondary-line {
    flex-wrap: wrap;
  }

  .tab-scroll-area {
    height: auto;
    max-height: 300px;
  }

  .variant-row {
    grid-template-columns: 42px 90px minmax(120px, 1fr);

    span:nth-last-child(-n + 3) {
      display: none;
    }
  }
}
</style>
