<template>
  <div class="shop-shops">
    <el-card shadow="never" class="header-card">
      <div class="toolbar">
        <el-select v-model="marketplace" placeholder="站点" style="width: 120px" @change="loadList">
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
          <el-option label="US" value="US" />
        </el-select>
        <el-input v-model="keyword" placeholder="店铺名筛选" clearable style="width: 200px" @keyup.enter="loadList" />
        <el-button type="primary" @click="loadList">查询</el-button>
        <div class="tip">店铺全集数据源 shop_products（variation=Y，不含变体父体口径）。点击行看单店全景。</div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe height="calc(100vh - 260px)" @row-click="openDetail">
        <el-table-column prop="sellerName" label="店铺名" min-width="170" show-overflow-tooltip />
        <el-table-column prop="productCount" label="商品数" width="90" sortable />
        <el-table-column label="结构标签" width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="profileTagType(row.profileType)">{{ row.profileType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="A/B/C/D" min-width="170">
          <template #default="{ row }">
            <span class="tier a">{{ row.aCount }}</span> /
            <span class="tier b">{{ row.bCount }}</span> /
            <span class="tier c">{{ row.cCount }}</span> /
            <span class="tier d">{{ row.dCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="ABC稳定盘" width="120">
          <template #default="{ row }">{{ row.abcCount }}（{{ pct(row.abcRatio) }}）</template>
        </el-table-column>
        <el-table-column label="D测品池" width="110">
          <template #default="{ row }">{{ row.dCount }}（{{ pct(row.dRatio) }}）</template>
        </el-table-column>
        <el-table-column prop="topABCCategory" label="ABC主类目" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="drawerVisible" :title="detailTitle" size="70%" destroy-on-close>
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <div class="snapshot-bar">
            <el-select
              v-model="selectedSourceRunId"
              placeholder="选择快照"
              style="width: 320px"
              :disabled="snapshots.length === 0"
              @change="handleSnapshotChange"
            >
              <el-option
                v-for="item in snapshots"
                :key="item.sourceRunId"
                :label="snapshotLabel(item)"
                :value="item.sourceRunId"
              />
            </el-select>
            <div v-if="currentSnapshot" class="snapshot-meta">
              <span>{{ currentSnapshot.batchCode || '-' }}</span>
              <span>{{ currentSnapshot.batchDate || '-' }}</span>
              <span>{{ currentSnapshot.sourceRunId }}</span>
              <span>{{ currentSnapshot.fetchedCount || 0 }}/{{ currentSnapshot.total || 0 }}</span>
            </div>
          </div>

          <el-descriptions v-if="detail.profile" :column="4" border size="small" title="全集画像">
            <el-descriptions-item label="商品数">{{ detail.profile.productCount }}</el-descriptions-item>
            <el-descriptions-item label="结构标签">
              <el-tag size="small" :type="profileTagType(detail.profile.profileType)">{{ detail.profile.profileType || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="A+B强候选">{{ detail.profile.abCount }}（{{ pct(detail.profile.abRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="ABC稳定盘">{{ detail.profile.abcCount }}（{{ pct(detail.profile.abcRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="A">{{ detail.profile.aCount }}</el-descriptions-item>
            <el-descriptions-item label="B">{{ detail.profile.bCount }}</el-descriptions-item>
            <el-descriptions-item label="C">{{ detail.profile.cCount }}</el-descriptions-item>
            <el-descriptions-item label="D">{{ detail.profile.dCount }}（{{ pct(detail.profile.dRatio) }}）</el-descriptions-item>
            <el-descriptions-item label="A主类目">{{ detail.profile.topACategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="ABC主类目">{{ detail.profile.topABCCategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="D主类目">{{ detail.profile.topDCategory || '-' }}</el-descriptions-item>
            <el-descriptions-item label="批次">{{ detail.profile.latestBatchDate || '-' }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="该店尚无全集数据，请先在观察池抓取" />

          <div class="promote-bar" v-if="detail.profile">
            <el-button type="success" size="small" @click="handlePromoteToPremium">加入精品店铺池</el-button>
            <span class="hint">已抓全集的店可直接入精品池（人工加入，前置快照校验）</span>
          </div>

          <div class="section-title" v-if="detail.watchlistEntries?.length">为什么进观察池</div>
          <el-table v-if="detail.watchlistEntries?.length" :data="detail.watchlistEntries" size="small" border>
            <el-table-column label="来源" width="110">
              <template #default="{ row }">{{ sourceLabel(row.sourceType) }} {{ row.sourceCode }}</template>
            </el-table-column>
            <el-table-column prop="hitCount" label="命中数" width="80" />
            <el-table-column prop="reason" label="原因" min-width="220" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>

          <div class="section-title" v-if="productWall">商品图片墙</div>
          <div v-if="productWall" v-loading="productWallLoading" class="wall-grid">
            <div v-for="tier in wallTiers" :key="tier" class="wall-section">
              <div class="wall-section-head">
                <span class="wall-tier">{{ tier }}</span>
                <span>{{ productWall.sections[tier]?.count || 0 }}</span>
              </div>
              <div class="wall-products">
                <div v-for="item in productWall.sections[tier]?.products || []" :key="item.asin" class="product-card">
                  <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.asin" />
                  <div v-else class="image-empty">{{ item.salesTier || '-' }}</div>
                  <div class="product-info">
                    <el-link v-if="item.productUrl" :href="item.productUrl" target="_blank" type="primary">{{ item.asin }}</el-link>
                    <span v-else class="asin">{{ item.asin }}</span>
                    <div class="title" :title="item.title || ''">{{ item.title || '-' }}</div>
                    <div class="metrics">
                      <span>{{ item.units ?? '-' }}</span>
                      <span>{{ item.price ?? '-' }}</span>
                      <span>{{ item.rating ?? '-' }}/{{ item.ratings ?? '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-title" v-if="snapshots.length > 1">历史对比</div>
          <div v-if="snapshots.length > 1" class="compare-bar">
            <el-select v-model="baselineRunId" placeholder="基准快照" style="width: 260px">
              <el-option v-for="item in snapshots" :key="`b-${item.sourceRunId}`" :label="snapshotLabel(item)" :value="item.sourceRunId" />
            </el-select>
            <el-select v-model="compareRunId" placeholder="对比快照" style="width: 260px">
              <el-option v-for="item in snapshots" :key="`c-${item.sourceRunId}`" :label="snapshotLabel(item)" :value="item.sourceRunId" />
            </el-select>
            <el-button :loading="compareLoading" @click="loadCompare">对比</el-button>
            <div v-if="compareResult" class="compare-summary">
              新增 {{ compareResult.summary.newCount }} / 消失 {{ compareResult.summary.goneCount }} /
              保留 {{ compareResult.summary.keptCount }} / 升级 {{ compareResult.summary.upgradedCount }} /
              降级 {{ compareResult.summary.downgradedCount }}
            </div>
          </div>

          <div class="section-title">商品明细</div>
          <el-radio-group v-model="tierFilter" size="small" @change="loadProducts" style="margin-bottom: 10px">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="A">A</el-radio-button>
            <el-radio-button label="B">B</el-radio-button>
            <el-radio-button label="C">C</el-radio-button>
            <el-radio-button label="D">D</el-radio-button>
            <el-radio-button label="UNKNOWN">未知</el-radio-button>
          </el-radio-group>
          <el-table :data="products" v-loading="productsLoading" size="small" border height="360">
            <el-table-column label="等级" width="60">
              <template #default="{ row }"><el-tag size="small" :class="'tier-' + row.salesTier">{{ row.salesTier }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="asin" label="ASIN" width="120">
              <template #default="{ row }">
                <el-link v-if="row.productUrl" :href="row.productUrl" target="_blank" type="primary">{{ row.asin }}</el-link>
                <span v-else>{{ row.asin }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
            <el-table-column prop="units" label="月销量" width="90" />
            <el-table-column prop="price" label="价格" width="90" />
            <el-table-column prop="bsr" label="BSR" width="90" />
            <el-table-column prop="categoryLeaf" label="末级类目" min-width="130" show-overflow-tooltip />
            <el-table-column label="上架日" width="110">
              <template #default="{ row }">{{ fmtDate(row.availableDate) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="prodPage"
            :page-size="prodSize"
            :total="prodTotal"
            layout="total, prev, pager, next"
            small
            style="margin-top: 10px; justify-content: flex-end"
            @current-change="loadProducts"
          />
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import shopCollectionApi, {
    type ShopProfileSummary,
    type ShopCollectionDetail,
    type ShopProfileProduct,
    type ShopSnapshot,
    type ShopProductWallResult,
    type ShopCompareResult
  } from '@/api/shopCollection'
import { shopPremiumApi } from '@/api/shopPremium'

const route = useRoute()
const marketplace = ref('UK')
const keyword = ref('')
const rows = ref<ShopProfileSummary[]>([])
const loading = ref(false)

const drawerVisible = ref(false)
const detail = ref<ShopCollectionDetail | null>(null)
const detailLoading = ref(false)
const currentSeller = ref('')
const snapshots = ref<ShopSnapshot[]>([])
const selectedSourceRunId = ref('')

const products = ref<ShopProfileProduct[]>([])
const productsLoading = ref(false)
const tierFilter = ref('')
const prodPage = ref(1)
const prodSize = ref(60)
const prodTotal = ref(0)
const productWall = ref<ShopProductWallResult | null>(null)
const productWallLoading = ref(false)
const wallTiers = ['A', 'B', 'C', 'D', 'UNKNOWN']
const baselineRunId = ref('')
const compareRunId = ref('')
const compareResult = ref<ShopCompareResult | null>(null)
const compareLoading = ref(false)

const detailTitle = computed(() => (currentSeller.value ? `${marketplace.value} · ${currentSeller.value}` : '单店全景'))
const currentSnapshot = computed(() => snapshots.value.find((item) => item.sourceRunId === selectedSourceRunId.value) || null)

async function loadList() {
  loading.value = true
  try {
    rows.value = await shopCollectionApi.summary(marketplace.value, keyword.value || undefined)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function openDetail(row: ShopProfileSummary) {
  await openSeller(row.sellerName)
}

async function openSeller(seller: string) {
  currentSeller.value = seller
  drawerVisible.value = true
  detailLoading.value = true
  tierFilter.value = ''
  prodPage.value = 1
  snapshots.value = []
  selectedSourceRunId.value = ''
  productWall.value = null
  compareResult.value = null
  try {
    snapshots.value = await shopCollectionApi.snapshots(marketplace.value, seller)
    selectedSourceRunId.value = snapshots.value[0]?.sourceRunId || ''
    baselineRunId.value = snapshots.value[1]?.sourceRunId || snapshots.value[0]?.sourceRunId || ''
    compareRunId.value = snapshots.value[0]?.sourceRunId || ''
    await loadCurrentSnapshotData()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadCurrentSnapshotData() {
  detail.value = await shopCollectionApi.detail(
    marketplace.value,
    currentSeller.value,
    undefined,
    selectedSourceRunId.value || undefined
  )
  await Promise.all([loadProductWall(), loadProducts()])
}

async function handleSnapshotChange() {
  detailLoading.value = true
  prodPage.value = 1
  compareResult.value = null
  try {
    await loadCurrentSnapshotData()
  } catch (e: any) {
    ElMessage.error(e?.message || '切换快照失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadProductWall() {
  if (!currentSeller.value || !selectedSourceRunId.value) {
    productWall.value = null
    return
  }
  productWallLoading.value = true
  try {
    productWall.value = await shopCollectionApi.productWall(
      marketplace.value,
      currentSeller.value,
      selectedSourceRunId.value,
      undefined,
      1,
      12
    )
  } finally {
    productWallLoading.value = false
  }
}

async function loadProducts() {
  if (!currentSeller.value) return
  productsLoading.value = true
  try {
    const r = await shopCollectionApi.shopProducts(
      marketplace.value,
      currentSeller.value,
      tierFilter.value || undefined,
      undefined,
      prodPage.value,
      prodSize.value,
      selectedSourceRunId.value || undefined
    )
    products.value = r.list || []
    prodTotal.value = r.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载商品失败')
  } finally {
    productsLoading.value = false
  }
}

async function loadCompare() {
  if (!currentSeller.value || !baselineRunId.value || !compareRunId.value) return
  compareLoading.value = true
  try {
    compareResult.value = await shopCollectionApi.compare(
      marketplace.value,
      currentSeller.value,
      baselineRunId.value,
      compareRunId.value
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '历史对比失败')
  } finally {
    compareLoading.value = false
  }
}

function snapshotLabel(item: ShopSnapshot) {
  return `${item.batchCode || item.batchDate || '-'} · ${item.sourceRunId} · ${item.fetchedCount || 0}/${item.total || 0}`
}

function pct(v: number | null) {
  if (v == null) return '0%'
  return (v * 100).toFixed(1) + '%'
}
function fmtDate(ts: number | null) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sourceLabel(t: string) {
  const map: Record<string, string> = {
    METHOD_CARD: '方法卡', BASELINE: '基线', MANUAL: '人工', OWN_GOOD_SIMILAR: '自有相似', CATEGORY: '类目'
  }
  return map[t] || t
}
async function handlePromoteToPremium() {
  if (!currentSeller.value || !marketplace.value) return
  try {
    await ElMessageBox.confirm(
      `将「${currentSeller.value}」(${marketplace.value}) 加入精品店铺池？该店已有全集快照，将作为人工加入。`,
      '加入精品池',
      { type: 'warning', confirmButtonText: '入池', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await shopPremiumApi.addManual({
      marketplace: marketplace.value,
      sellerName: currentSeller.value,
      reason: '从店铺全集画像页人工加入',
      qualityLevel: 'MID',
      refreshFrequency: 'MONTHLY'
    })
    ElMessage.success('已加入精品池')
  } catch (e: any) {
    ElMessage.error(e?.message || '入池失败')
  }
}

function profileTagType(t: string | null): 'success' | 'primary' | 'warning' | 'info' {
  if (!t) return 'info'
  if (t.includes('利润')) return 'success'
  if (t.includes('飞轮')) return 'primary'
  if (t.includes('测品')) return 'warning'
  return 'info'
}

onMounted(async () => {
  if (route.query.marketplace) marketplace.value = String(route.query.marketplace)
  await loadList()
  if (route.query.sellerName) {
    const seller = String(route.query.sellerName)
    const hit = rows.value.find((r) => r.sellerName === seller)
    if (hit) {
      await openDetail(hit)
    } else {
      await openSeller(seller)
    }
  }
})
</script>

<style scoped lang="scss">
.shop-shops {
  padding: 16px;
}
.header-card {
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar .tip {
  color: #909399;
  font-size: 12px;
}
.section-title {
  font-weight: 600;
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.snapshot-bar,
.compare-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.snapshot-meta,
.compare-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
  font-size: 12px;
}
.wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.wall-section {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px;
  min-width: 0;
}
.wall-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}
.wall-tier {
  font-weight: 700;
  color: #303133;
}
.wall-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
}
.product-card {
  min-width: 0;
  border: 1px solid #f0f2f5;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.product-card img,
.image-empty {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #f5f7fa;
}
.image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-weight: 600;
}
.product-info {
  padding: 6px;
  min-width: 0;
}
.asin {
  color: #409eff;
  font-size: 12px;
}
.title {
  height: 34px;
  line-height: 17px;
  margin-top: 4px;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
}
.metrics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  color: #909399;
  font-size: 11px;
}
.promote-bar {
  margin: 14px 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.promote-bar .hint {
  color: #909399;
  font-size: 12px;
}
.tier {
  font-weight: 600;
  &.a { color: #67c23a; }
  &.b { color: #409eff; }
  &.c { color: #e6a23c; }
  &.d { color: #909399; }
}
.tier-A { background: #67c23a; color: #fff; border: none; }
.tier-B { background: #409eff; color: #fff; border: none; }
.tier-C { background: #e6a23c; color: #fff; border: none; }
.tier-D { background: #909399; color: #fff; border: none; }
</style>
