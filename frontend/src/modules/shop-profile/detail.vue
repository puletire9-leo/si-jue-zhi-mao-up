<template>
  <div class="sp-detail" v-loading="detailLoading">
    <!-- 面包屑 + 返回 -->
    <div class="sp-detail__crumb">
      <nav class="crumb">
        <a @click="goList">店铺画像</a>
        <span class="sep">/</span>
        <span class="cur">{{ decodedSeller }}</span>
      </nav>
      <el-button size="small" @click="goList">返回列表</el-button>
    </div>

    <!-- 店铺头部 -->
    <el-card shadow="never" class="sp-detail__head">
      <div class="head-row">
        <div class="head-left">
          <div class="head-avatar" :style="marketBadgeStyle(marketplace)">{{ marketplace }}</div>
          <div>
            <div class="head-name">
              {{ decodedSeller }}
              <span class="sp-badge-market" :style="marketBadgeStyle(marketplace)">{{ marketplace }}</span>
            </div>
            <div class="head-meta">
              <span>批次 <b>{{ summary?.latestBatchDate || batchDate || '—' }}</b></span>
              <span>商品数 <b>{{ num(summary?.productCount) }}</b></span>
              <span>变体模式 <b>{{ summary?.variationMode || 'Y' }}</b></span>
              <span v-if="summary?.sellerId">sellerId <b class="mono">{{ summary.sellerId }}</b></span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 结构总览 -->
    <div class="sp-detail__overview" v-if="summary">
      <el-card shadow="never" class="ov-card">
        <div class="ov-title">等级分布</div>
        <div v-for="t in tierRows" :key="t.key" class="ov-tier">
          <div class="ov-tier__head">
            <span class="ov-tier__badge" :style="{ background: t.color + '22', color: t.color }">{{ t.key }}</span>
            <span class="ov-tier__label">{{ t.label }}</span>
            <span class="ov-tier__count">{{ num(t.count) }}<span class="dim"> · {{ pct(t.ratio) }}</span></span>
          </div>
          <div class="ov-bar"><div class="ov-bar__fill" :style="{ width: pct(t.ratio), background: t.color }" /></div>
        </div>
      </el-card>

      <el-card shadow="never" class="ov-card">
        <div class="ov-title">核心类目</div>
        <div class="ov-cat" v-if="summary.topACategory">
          <el-tag type="danger" size="small" effect="light">A</el-tag>
          <span class="ov-cat__text">{{ summary.topACategory }}</span>
        </div>
        <div class="ov-cat" v-if="summary.topABCCategory">
          <el-tag type="primary" size="small" effect="light">ABC</el-tag>
          <span class="ov-cat__text">{{ summary.topABCCategory }}</span>
        </div>
        <div class="ov-cat" v-if="summary.topDCategory">
          <el-tag type="info" size="small" effect="light">D</el-tag>
          <span class="ov-cat__text">{{ summary.topDCategory }}</span>
        </div>
        <el-empty
          v-if="!summary.topACategory && !summary.topABCCategory && !summary.topDCategory"
          description="暂无类目"
          :image-size="60"
        />
      </el-card>

      <el-card shadow="never" class="ov-card ov-card--profile">
        <div class="ov-title">画像类型</div>
        <div class="ov-profile">
          <el-tag v-if="summary.profileType" type="warning" size="large" effect="light">{{ summary.profileType }}</el-tag>
          <span v-else class="dim">未标注</span>
        </div>
        <div class="ov-advice">
          A/ABC/D 占比 <b>{{ pct(summary.aRatio) }}</b> / <b>{{ pct(summary.abcRatio) }}</b> / <b>{{ pct(summary.dRatio) }}</b>。
          A 为利润层，ABC 为稳定盘，D 为测品池。
        </div>
      </el-card>

      <el-card shadow="never" class="ov-card ov-card--positioning" v-loading="positioningLoading">
        <div class="ov-title ov-title--inline">
          <span>基线定位</span>
          <el-select
            v-model="activeBaselineCode"
            size="small"
            placeholder="选择基线"
            style="width: 150px"
            :loading="baselineLoading"
            @change="loadPositioningDetail"
          >
            <el-option
              v-for="b in selectableBaselines"
              :key="b.baselineCode"
              :label="b.baselineName"
              :value="b.baselineCode"
            />
          </el-select>
        </div>
        <template v-if="positioning">
          <div class="pos-score">
            <span class="pos-score__num" :style="{ color: similarityColor(positioning.similarityScore) }">
              {{ positioning.similarityScore != null ? positioning.similarityScore.toFixed(3) : '—' }}
            </span>
            <el-tag v-if="positioning.positioningLabel" size="small" effect="light">
              {{ positioning.positioningLabel }}
            </el-tag>
          </div>
          <div class="pos-ratios mono">
            A/AB/ABC/D {{ pct(positioning.aRatio, 0) }} / {{ pct(positioning.abRatio, 0) }} /
            {{ pct(positioning.abcRatio, 0) }} / {{ pct(positioning.dRatio, 0) }}
          </div>
          <div class="ov-advice">{{ positioning.profileAdvice || '暂无定位解释' }}</div>
        </template>
        <div v-else class="pos-empty dim">
          {{ selectableBaselines.length ? '选择基线查看相似度和差异解释' : '暂无可用基线' }}
        </div>
      </el-card>
    </div>

    <!-- Tabs -->
    <el-card shadow="never" body-style="padding:0;">
      <el-tabs v-model="activeTab" class="sp-tabs" @tab-change="onTabChange">
        <el-tab-pane label="全部商品" name="ALL" />
        <el-tab-pane label="A 利润层" name="A" />
        <el-tab-pane label="B 成长层" name="B" />
        <el-tab-pane label="C 稳定层" name="C" />
        <el-tab-pane label="D 测品池" name="D" />
        <el-tab-pane label="类目结构" name="CATEGORY" />
      </el-tabs>

      <div class="sp-tabs__body">
        <CategoryRankTable v-if="activeTab === 'CATEGORY'" :rows="categories" :loading="catLoading" />
        <ProductTierTable
          v-else
          :rows="products"
          :loading="prodLoading"
          :total="prodTotal"
          :page="prodPage"
          :size="prodSize"
          :marketplace="marketplace"
          @page-change="onPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { shopProfileApi, shopProfileBaselineApi } from '@/api/shopProfile'
import type {
  Marketplace,
  SalesTier,
  ShopProfileSummary,
  ShopProfileProduct,
  ShopProfileCategory,
  ShopProfileBaseline,
  ShopProfilePositioningResult
} from '@/types/shopProfile'
import { num, pct, marketColor, TIER_COLOR, MARKETPLACES, similarityColor } from './utils'
import CategoryRankTable from './components/CategoryRankTable.vue'
import ProductTierTable from './components/ProductTierTable.vue'

const route = useRoute()
const router = useRouter()

const marketplace = computed<Marketplace>(() => {
  const m = String(route.params.marketplace || 'UK').toUpperCase()
  return (MARKETPLACES as string[]).includes(m) ? (m as Marketplace) : 'UK'
})
const decodedSeller = computed(() => {
  const raw = String(route.params.sellerName || '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
})
const batchDate = computed(() => (route.query.batchDate ? String(route.query.batchDate) : undefined))

const detailLoading = ref(false)
const summary = ref<ShopProfileSummary | null>(null)
const categories = ref<ShopProfileCategory[]>([])
const catLoading = ref(false)
const baselines = ref<ShopProfileBaseline[]>([])
const baselineLoading = ref(false)
const activeBaselineCode = ref('')
const positioning = ref<ShopProfilePositioningResult | null>(null)
const positioningLoading = ref(false)

const activeTab = ref<'ALL' | 'A' | 'B' | 'C' | 'D' | 'CATEGORY'>('ALL')

const products = ref<ShopProfileProduct[]>([])
const prodLoading = ref(false)
const prodTotal = ref(0)
const prodPage = ref(1)
const prodSize = ref(60)

const tierRows = computed(() => {
  const s = summary.value
  if (!s) return []
  return [
    { key: 'A', label: '利润层', count: s.aCount, ratio: s.aRatio, color: TIER_COLOR.A },
    { key: 'B', label: '成长层', count: s.bCount, ratio: ratioOf(s.bCount, s.productCount), color: TIER_COLOR.B },
    { key: 'C', label: '稳定层', count: s.cCount, ratio: ratioOf(s.cCount, s.productCount), color: TIER_COLOR.C },
    { key: 'D', label: '测品池', count: s.dCount, ratio: s.dRatio, color: TIER_COLOR.D }
  ]
})

const selectableBaselines = computed(() => {
  return baselines.value.filter((b) => {
    const scope = (b.marketplaceScope || '').split(',').map((s) => s.trim()).filter(Boolean)
    return scope.length === 0 || scope.includes(marketplace.value)
  })
})

function ratioOf(part?: number, total?: number): number {
  if (!part || !total) return 0
  return part / total
}

function marketBadgeStyle(m: string) {
  const c = marketColor(m)
  return { background: c.bg, color: c.fg }
}

async function loadDetail() {
  detailLoading.value = true
  try {
    const d = await shopProfileApi.detail(marketplace.value, decodedSeller.value, { batchDate: batchDate.value })
    summary.value = d.summary
    categories.value = d.categories || []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载店铺详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadProducts() {
  prodLoading.value = true
  try {
    const res = await shopProfileApi.products(marketplace.value, decodedSeller.value, {
      batchDate: batchDate.value,
      salesTier: activeTab.value === 'ALL' ? undefined : (activeTab.value as SalesTier),
      page: prodPage.value,
      size: prodSize.value
    })
    products.value = res.list || []
    prodTotal.value = res.total || 0
  } catch (e: any) {
    products.value = []
    prodTotal.value = 0
    ElMessage.error(e?.message || '加载商品失败')
  } finally {
    prodLoading.value = false
  }
}

async function loadCategories() {
  catLoading.value = true
  try {
    categories.value = await shopProfileApi.categories(marketplace.value, decodedSeller.value, {
      batchDate: batchDate.value
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载类目失败')
  } finally {
    catLoading.value = false
  }
}

async function loadBaselines() {
  baselineLoading.value = true
  try {
    baselines.value = await shopProfileBaselineApi.list({ status: 'ACTIVE' })
    const queryCode = route.query.baselineCode ? String(route.query.baselineCode) : ''
    const preferred = selectableBaselines.value.find((b) => b.baselineCode === queryCode)
      || selectableBaselines.value[0]
    activeBaselineCode.value = preferred?.baselineCode || ''
    if (activeBaselineCode.value) await loadPositioningDetail()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载基线失败')
  } finally {
    baselineLoading.value = false
  }
}

async function loadPositioningDetail() {
  if (!activeBaselineCode.value) {
    positioning.value = null
    return
  }
  positioningLoading.value = true
  try {
    positioning.value = await shopProfileApi.positioningDetail(marketplace.value, decodedSeller.value, {
      baselineCode: activeBaselineCode.value,
      batchDate: batchDate.value
    })
  } catch (e: any) {
    positioning.value = null
    ElMessage.error(e?.message || '加载基线定位失败')
  } finally {
    positioningLoading.value = false
  }
}

function onTabChange() {
  if (activeTab.value === 'CATEGORY') {
    loadCategories()
  } else {
    prodPage.value = 1
    loadProducts()
  }
}

function onPageChange(page: number, size: number) {
  prodPage.value = page
  prodSize.value = size
  loadProducts()
}

function goList() {
  router.push({ name: 'ShopProfileList' })
}

onMounted(() => {
  loadDetail()
  loadProducts()
  loadBaselines()
})
</script>

<style scoped lang="scss">
.sp-detail {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp-detail__crumb {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crumb {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  a {
    cursor: pointer;
    color: #e8621c;
    &:hover {
      text-decoration: underline;
    }
  }
  .sep {
    margin: 0 6px;
    color: var(--el-text-color-placeholder);
  }
  .cur {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }
}
.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}
.head-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.head-meta {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  b {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }
}
.sp-badge-market {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.sp-detail__overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.ov-card {
  min-height: 180px;
}
.ov-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 14px;
  &--inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
}
.ov-tier {
  margin-bottom: 12px;
  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin-bottom: 5px;
  }
  &__badge {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
  }
  &__label {
    color: var(--el-text-color-secondary);
  }
  &__count {
    margin-left: auto;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}
.ov-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  overflow: hidden;
  &__fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
}
.ov-cat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  margin-bottom: 8px;
  &__text {
    font-size: 13px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.ov-profile {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
.ov-advice {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  background: #fffbeb;
  border: 1px solid #fff0d6;
  border-radius: 8px;
  padding: 10px 12px;
  b {
    color: #d97706;
  }
}
.pos-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  &__num {
    font-family: var(--el-font-family-mono, 'Consolas', monospace);
    font-size: 24px;
    font-weight: 700;
  }
}
.pos-ratios {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.pos-empty {
  min-height: 94px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.sp-tabs {
  padding: 0 16px;
}
.sp-tabs__body {
  padding: 0 12px 12px;
}
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.dim {
  color: var(--el-text-color-secondary);
}
</style>
