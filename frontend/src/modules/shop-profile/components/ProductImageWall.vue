<template>
  <div class="product-image-wall" v-loading="loading">
    <!-- A 利润层代表商品 -->
    <div class="wall-section" v-if="tierProducts.A.length">
      <div class="wall-section__header">
        <span class="wall-tier-badge" :style="{ background: tierColors.A }">A</span>
        <span class="wall-section__title">利润层代表商品</span>
        <span class="wall-section__count">{{ tierProducts.A.length }} 件</span>
      </div>
      <div class="wall-grid">
        <div
          v-for="p in tierProducts.A"
          :key="p.asin"
          class="wall-card"
          @click="openProduct(p)"
        >
          <div class="wall-card__img">
            <LazyImage
              v-if="p.imageUrl"
              :image-id="p.asin"
              :src="p.imageUrl"
              :width="120"
              :height="120"
              fit="contain"
            />
            <div v-else class="wall-card__empty">
              <el-icon><PictureFilled /></el-icon>
            </div>
          </div>
          <div class="wall-card__info">
            <div class="wall-card__asin">{{ p.asin }}</div>
            <div class="wall-card__title" :title="p.title">{{ p.title }}</div>
            <div class="wall-card__meta">
              <span v-if="p.units != null">{{ p.units }} 月销</span>
              <span v-if="p.bsr != null">#{{ p.bsr.toLocaleString() }}</span>
              <span v-if="p.price != null">{{ currencySymbol }}{{ p.price }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ABC 稳定盘代表商品 -->
    <div class="wall-section" v-if="tierProducts.ABC.length">
      <div class="wall-section__header">
        <span class="wall-tier-badge" :style="{ background: tierColors.ABC }">ABC</span>
        <span class="wall-section__title">稳定盘代表商品</span>
        <span class="wall-section__count">{{ tierProducts.ABC.length }} 件</span>
      </div>
      <div class="wall-grid wall-grid--wide">
        <div
          v-for="p in tierProducts.ABC"
          :key="p.asin"
          class="wall-card wall-card--compact"
          @click="openProduct(p)"
        >
          <div class="wall-card__img">
            <LazyImage
              v-if="p.imageUrl"
              :image-id="p.asin"
              :src="p.imageUrl"
              :width="96"
              :height="96"
              fit="contain"
            />
            <div v-else class="wall-card__empty">
              <el-icon><PictureFilled /></el-icon>
            </div>
          </div>
          <div class="wall-card__info">
            <div class="wall-card__asin">{{ p.asin }}</div>
            <div class="wall-card__title" :title="p.title">{{ p.title }}</div>
            <div class="wall-card__meta">
              <span v-if="p.units != null">{{ p.units }} 月销</span>
              <span class="wall-tier-tag" :style="{ color: tierColors[p.salesTier] }">{{ p.salesTier }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- D 测品池代表商品 -->
    <div class="wall-section" v-if="tierProducts.D.length">
      <div class="wall-section__header">
        <span class="wall-tier-badge" :style="{ background: tierColors.D }">D</span>
        <span class="wall-section__title">测品池代表商品</span>
        <span class="wall-section__count">{{ tierProducts.D.length }} 件</span>
      </div>
      <div class="wall-grid wall-grid--wide">
        <div
          v-for="p in tierProducts.D"
          :key="p.asin"
          class="wall-card wall-card--compact"
          @click="openProduct(p)"
        >
          <div class="wall-card__img">
            <LazyImage
              v-if="p.imageUrl"
              :image-id="p.asin"
              :src="p.imageUrl"
              :width="96"
              :height="96"
              fit="contain"
            />
            <div v-else class="wall-card__empty">
              <el-icon><PictureFilled /></el-icon>
            </div>
          </div>
          <div class="wall-card__info">
            <div class="wall-card__asin">{{ p.asin }}</div>
            <div class="wall-card__title" :title="p.title">{{ p.title }}</div>
            <div class="wall-card__meta">
              <span v-if="p.units != null">{{ p.units }} 月销</span>
              <span v-if="p.price != null">{{ currencySymbol }}{{ p.price }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-empty
      v-if="!loading && !hasAnyProducts"
      description="暂无商品图片数据"
      :image-size="80"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, type Ref } from 'vue'
import { PictureFilled } from '@element-plus/icons-vue'
import { shopProfileApi } from '@/api/shopProfile'
import type { Marketplace, SalesTier, ShopProfileProduct } from '@/types/shopProfile'
import { TIER_COLOR, CURRENCY_SYMBOL } from '../utils'
import LazyImage from '@/components/LazyImage/index.vue'

interface Props {
  marketplace: Marketplace
  sellerName: string
  batchDate?: string
  /** 最多展示条数，默认 8 */
  maxPerTier?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxPerTier: 8,
})

const emit = defineEmits<{
  (e: 'open', product: ShopProfileProduct): void
}>()

const loading = ref(false)
const aProducts = ref<ShopProfileProduct[]>([])
const abcProducts = ref<ShopProfileProduct[]>([])
const dProducts = ref<ShopProfileProduct[]>([])

const tierColors = TIER_COLOR
const currencySymbol = computed(() => CURRENCY_SYMBOL[props.marketplace] || '£')

const tierProducts = computed(() => ({
  A: aProducts.value.slice(0, props.maxPerTier),
  ABC: abcProducts.value.slice(0, props.maxPerTier),
  D: dProducts.value.slice(0, props.maxPerTier),
}))

const hasAnyProducts = computed(
  () => aProducts.value.length + abcProducts.value.length + dProducts.value.length > 0,
)

async function fetchTier(tier: SalesTier): Promise<ShopProfileProduct[]> {
  try {
    const res = await shopProfileApi.products(props.marketplace, props.sellerName, {
      batchDate: props.batchDate,
      salesTier: tier,
      size: props.maxPerTier,
      page: 1,
    })
    // API 返回 PageResult，data.list 是商品列表
    const list = (res as any)?.list || (res as any)?.data?.list || []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function loadTier(tier: SalesTier, target: Ref<ShopProfileProduct[]>) {
  target.value = await fetchTier(tier)
}

async function loadAbcProducts() {
  const [bProducts, cProducts] = await Promise.all([
    fetchTier('B'),
    fetchTier('C'),
  ])

  abcProducts.value = [...bProducts, ...cProducts]
    .sort((left, right) => (right.units ?? -1) - (left.units ?? -1))
    .slice(0, props.maxPerTier)
}

async function loadAll() {
  loading.value = true
  await Promise.all([
    loadTier('A', aProducts),
    loadAbcProducts(),
    loadTier('D', dProducts),
  ])
  loading.value = false
}

function openProduct(p: ShopProfileProduct) {
  // 优先打开 Amazon 链接
  if (p.productUrl) {
    window.open(p.productUrl, '_blank')
  } else {
    emit('open', p)
  }
}

onMounted(loadAll)

watch(
  () => [props.marketplace, props.sellerName, props.batchDate],
  () => loadAll(),
)
</script>

<style scoped lang="scss">
.product-image-wall {
  padding: 16px 0;
}

.wall-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.wall-section__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.wall-tier-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.wall-section__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.wall-section__count {
  font-size: 12px;
  color: #909399;
}

.wall-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.wall-grid--wide {
  gap: 10px;
}

.wall-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  width: 280px;
  background: #fff;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: #409eff;
  }
}

.wall-card--compact {
  width: 240px;
}

.wall-card__img {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;

  .wall-card--compact & {
    width: 96px;
    height: 96px;
  }
}

.wall-card__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 28px;
  color: #cbd5e1;
}

.wall-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wall-card__asin {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wall-card__title {
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wall-card__meta {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;

  span {
    white-space: nowrap;
  }
}

.wall-tier-tag {
  font-weight: 600;
  font-size: 11px;
}
</style>
