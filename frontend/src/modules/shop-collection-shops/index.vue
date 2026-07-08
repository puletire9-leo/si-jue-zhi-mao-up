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

          <div class="section-title" v-if="detail.watchlistEntries?.length">为什么进观察池</div>
          <el-table v-if="detail.watchlistEntries?.length" :data="detail.watchlistEntries" size="small" border>
            <el-table-column label="来源" width="110">
              <template #default="{ row }">{{ sourceLabel(row.sourceType) }} {{ row.sourceCode }}</template>
            </el-table-column>
            <el-table-column prop="hitCount" label="命中数" width="80" />
            <el-table-column prop="reason" label="原因" min-width="220" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>

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
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import shopCollectionApi, {
  type ShopProfileSummary,
  type ShopCollectionDetail,
  type ShopProfileProduct
} from '@/api/shopCollection'

const route = useRoute()
const marketplace = ref('UK')
const keyword = ref('')
const rows = ref<ShopProfileSummary[]>([])
const loading = ref(false)

const drawerVisible = ref(false)
const detail = ref<ShopCollectionDetail | null>(null)
const detailLoading = ref(false)
const currentSeller = ref('')

const products = ref<ShopProfileProduct[]>([])
const productsLoading = ref(false)
const tierFilter = ref('')
const prodPage = ref(1)
const prodSize = ref(60)
const prodTotal = ref(0)

const detailTitle = computed(() => (currentSeller.value ? `${marketplace.value} · ${currentSeller.value}` : '单店全景'))

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
  currentSeller.value = row.sellerName
  drawerVisible.value = true
  detailLoading.value = true
  tierFilter.value = ''
  prodPage.value = 1
  try {
    detail.value = await shopCollectionApi.detail(marketplace.value, row.sellerName)
    await loadProducts()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
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
      prodSize.value
    )
    products.value = r.list || []
    prodTotal.value = r.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载商品失败')
  } finally {
    productsLoading.value = false
  }
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
      currentSeller.value = seller
      drawerVisible.value = true
      detailLoading.value = true
      try {
        detail.value = await shopCollectionApi.detail(marketplace.value, seller)
        await loadProducts()
      } catch {
        // 该店可能还没抓全集，抽屉里显示空态
      } finally {
        detailLoading.value = false
      }
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
