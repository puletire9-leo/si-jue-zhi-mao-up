<template>
  <div class="zheng-shop-overview">
    <!-- 顶部统计卡片 -->
    <div class="stats-cards">
      <div
        v-for="stat in gradeStats"
        :key="stat.key"
        class="stat-card"
        :class="{ active: gradeFilter === stat.key }"
        @click="gradeFilter = gradeFilter === stat.key ? '' : stat.key"
      >
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-value">{{ stat.count }}</span>
      </div>
    </div>

    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">店铺总览</span>
            <span class="summary-text">
              共 {{ filteredStores.length }} 个店铺 | {{ filteredProducts }} 个商品
            </span>
          </div>
          <div class="header-actions">
            <el-select v-model="marketplace" placeholder="全部站点" clearable size="small" style="width: 110px">
              <el-option label="UK" value="UK" />
              <el-option label="DE" value="DE" />
              <el-option label="US" value="US" />
            </el-select>
            <el-select v-model="sourceFilter" placeholder="全部来源" clearable size="small" style="width: 110px">
              <el-option label="郑总店铺" value="zheng" />
              <el-option label="选品管理" value="selection" />
            </el-select>
            <el-select v-model="sortBy" placeholder="排序" size="small" style="width: 120px">
              <el-option label="商品数量" value="productCount" />
              <el-option label="店铺评分" value="storeScore" />
              <el-option label="等级" value="grade" />
            </el-select>
            <el-button-group size="small">
              <el-button :type="sortOrder === 'desc' ? 'primary' : ''" @click="sortOrder = 'desc'">降序</el-button>
              <el-button :type="sortOrder === 'asc' ? 'primary' : ''" @click="sortOrder = 'asc'">升序</el-button>
            </el-button-group>
            <el-input v-model="searchText" placeholder="搜索店铺" clearable size="small" style="width: 180px" />
            <el-button type="primary" size="small" :loading="syncing" @click="handleSyncAll">
              {{ syncing ? `同步中 ${syncProgress}/${syncTotal}` : '同步全部' }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="shop-list">
        <div
          v-for="shop in displayedStores"
          :key="shop.key"
          class="shop-card"
        >
          <!-- 店铺卡片 -->
          <div class="shop-header" @click="goToStorePage(shop.data)">
            <div class="shop-info">
              <div class="shop-name-row">
                <el-tag :type="gradeTagType(shop.data.grade)" size="small" effect="dark" class="grade-tag">
                  {{ gradeLabel(shop.data.grade) }}
                </el-tag>
                <span class="shop-name" :title="shop.data.storeName">{{ shop.data.storeName }}</span>
                <el-tag v-if="shop.data.marketplace" :type="marketplaceTagType(shop.data.marketplace)" size="small" effect="plain">
                  {{ shop.data.marketplace }}
                </el-tag>
                <el-tag v-if="shop.data.source === 'selection'" type="info" size="small" effect="plain">选品</el-tag>
                <span v-if="shop.data.latestMonth" class="shop-month">{{ shop.data.latestMonth }}</span>
                <span class="product-count-badge">{{ shop.data.productCount }} 个商品</span>
              </div>
              <div class="shop-meta">
                <template v-if="shop.data.source === 'zheng'">
                  <span>营收 {{ formatRevenueByMarket(shop.data.totalRevenue || 0, shop.data.marketplace) }}</span>
                  <span class="divider">|</span>
                  <span>评分 {{ shop.data.avgRating }}</span>
                  <span class="divider">|</span>
                  <span>{{ formatNumber(shop.data.totalUnits || 0) }} 销量</span>
                </template>
                <template v-else>
                  <span>店铺评分 {{ shop.data.storeScore }}</span>
                  <span class="divider">|</span>
                  <span v-if="shop.data.gradeDistribution">
                    <span v-if="shop.data.gradeDistribution.S" class="grade-dist grade-s">S{{ shop.data.gradeDistribution.S }}</span>
                    <span v-if="shop.data.gradeDistribution.A" class="grade-dist grade-a">A{{ shop.data.gradeDistribution.A }}</span>
                    <span v-if="shop.data.gradeDistribution.B" class="grade-dist grade-b">B{{ shop.data.gradeDistribution.B }}</span>
                    <span v-if="shop.data.gradeDistribution.C" class="grade-dist grade-c">C{{ shop.data.gradeDistribution.C }}</span>
                    <span v-if="shop.data.gradeDistribution.D" class="grade-dist grade-d">D{{ shop.data.gradeDistribution.D }}</span>
                  </span>
                  <span v-if="shop.data.avgListingDays" class="divider">|</span>
                  <span v-if="shop.data.avgListingDays" class="listing-days">
                    平均上架 {{ shop.data.avgListingDays }} 天
                  </span>
                </template>
              </div>
              <div v-if="shop.data.notes" class="shop-notes">{{ shop.data.notes }}</div>
            </div>
            <div class="shop-actions">
              <el-button
                v-if="shop.data.storeUrl"
                type="primary"
                link
                size="small"
                @click.stop="openStore(shop.data.storeUrl)"
              >
                Amazon 店铺
              </el-button>
              <el-button
                v-if="shop.data.source === 'zheng'"
                type="warning"
                size="small"
                link
                :loading="syncingShop === shop.key"
                @click.stop="handleSyncShop(shop.data)"
              >
                同步
              </el-button>
              <el-button type="primary" size="small" @click.stop="goToStorePage(shop.data)">
                查看商品
              </el-button>
            </div>
          </div>
        </div>

        <!-- 加载更多店铺 -->
        <div v-if="displayCount < filteredStores.length" class="load-more-stores">
          <el-button link type="primary" @click="loadMoreStores">
            加载更多店铺 ({{ filteredStores.length - displayCount }} 个未显示)
          </el-button>
        </div>

        <el-empty v-if="!loading && filteredStores.length === 0" description="暂无店铺数据" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { competitorApi } from '@/api/competitor'
import { selectionApi } from '@/api/selection'

defineOptions({ name: 'ZhengShopOverview' })

type StoreGrade = 'zheng' | 'premium' | 'normal' | 'poor'
type StoreSource = 'zheng' | 'selection'

interface GradeDistribution {
  S: number
  A: number
  B: number
  C: number
  D: number
}

interface UnifiedStore {
  storeName: string
  marketplace: string
  storeUrl?: string
  source: StoreSource
  grade: StoreGrade
  productCount: number
  totalRevenue?: number
  totalUnits?: number
  avgRating?: number
  storeScore?: number
  gradeDistribution?: GradeDistribution
  avgListingDays?: number
  sellerId?: number
  notes?: string
  latestMonth?: string
}

const STORE_PAGE_SIZE = 20

const router = useRouter()
const loading = ref(false)
const marketplace = ref('')
const searchText = ref('')
const stores = ref<UnifiedStore[]>([])
const syncingShop = ref('')
const syncing = ref(false)
const syncProgress = ref(0)
const syncTotal = ref(0)

// 筛选/排序状态
const gradeFilter = ref('')
const sourceFilter = ref('')
const sortBy = ref('productCount')
const sortOrder = ref<'asc' | 'desc'>('desc')

// 分页显示
const displayCount = ref(STORE_PAGE_SIZE)

const shopKey = (shop: UnifiedStore) => `${shop.source}:${shop.storeName}`

// 等级统计（单次遍历）
const gradeStats = computed(() => {
  const counts = { zheng: 0, premium: 0, normal: 0, poor: 0 }
  for (const s of stores.value) {
    counts[s.grade]++
  }
  return [
    { key: '', label: '全部', count: stores.value.length },
    { key: 'zheng', label: '郑总', count: counts.zheng },
    { key: 'premium', label: '优质', count: counts.premium },
    { key: 'normal', label: '一般', count: counts.normal },
    { key: 'poor', label: '差', count: counts.poor },
  ]
})

// 筛选 + 排序
const filteredStores = computed(() => {
  let list = stores.value

  // 站点筛选（仅对郑总店铺生效，选品店铺无站点信息）
  if (marketplace.value) {
    list = list.filter(s => s.source !== 'zheng' || s.marketplace === marketplace.value)
  }

  // 等级筛选
  if (gradeFilter.value) {
    list = list.filter(s => s.grade === gradeFilter.value)
  }

  // 来源筛选
  if (sourceFilter.value) {
    list = list.filter(s => s.source === sourceFilter.value)
  }

  // 搜索
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s => s.storeName.toLowerCase().includes(q))
  }

  // 排序（避免 mutating 原数组）
  const gradeOrder: Record<StoreGrade, number> = { zheng: 4, premium: 3, normal: 2, poor: 1 }
  const sorted = [...list]
  sorted.sort((a, b) => {
    let va: number, vb: number
    if (sortBy.value === 'grade') {
      va = gradeOrder[a.grade] || 0
      vb = gradeOrder[b.grade] || 0
    } else if (sortBy.value === 'storeScore') {
      va = a.storeScore || (a.grade === 'zheng' ? 100 : 0)
      vb = b.storeScore || (b.grade === 'zheng' ? 100 : 0)
    } else {
      va = a.productCount
      vb = b.productCount
    }
    return sortOrder.value === 'desc' ? vb - va : va - vb
  })

  return sorted
})

// 带 key 的显示列表（预计算 key，避免模板中重复调用）
const displayedStores = computed(() => {
  return filteredStores.value.slice(0, displayCount.value).map(s => ({
    key: shopKey(s),
    data: s,
  }))
})

const filteredProducts = computed(() => filteredStores.value.reduce((sum, s) => sum + s.productCount, 0))

const currencySymbol = (mp: string) => {
  if (mp === 'UK') return '£'
  if (mp === 'DE') return '€'
  return '$'
}

const marketplaceTagType = (mp: string): 'primary' | 'success' | 'warning' => {
  if (mp === 'UK') return 'primary'
  if (mp === 'DE') return 'success'
  return 'warning'
}

const gradeTagType = (grade: StoreGrade): 'danger' | 'success' | 'primary' | 'info' => {
  const map: Record<StoreGrade, 'danger' | 'success' | 'primary' | 'info'> = {
    zheng: 'danger',
    premium: 'success',
    normal: 'primary',
    poor: 'info',
  }
  return map[grade] || 'info'
}

const gradeLabel = (grade: StoreGrade) => {
  const map: Record<StoreGrade, string> = { zheng: '郑总', premium: '优质', normal: '一般', poor: '差' }
  return map[grade] || grade
}

const formatNumber = (num: number) => {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

const formatRevenueByMarket = (num: number, mp: string) => {
  return currencySymbol(mp) + formatNumber(num)
}

const loadMoreStores = () => {
  displayCount.value += STORE_PAGE_SIZE
}

// 加载郑总店铺
const loadZhengShops = async (): Promise<UnifiedStore[]> => {
  try {
    const params: Record<string, string> = {}
    if (marketplace.value) params.marketplace = marketplace.value
    const res = await competitorApi.getDengZongShopSellerSummary(params)
    return (res.data || []).map((s: any) => ({
      storeName: s.sellerName,
      marketplace: s.marketplace,
      storeUrl: s.storeUrl,
      source: 'zheng' as StoreSource,
      grade: 'zheng' as StoreGrade,
      productCount: s.productCount || 0,
      totalRevenue: s.totalRevenue || 0,
      totalUnits: s.totalUnits || 0,
      avgRating: s.avgRating || 0,
      sellerId: s.sellerId,
      notes: s.notes,
      latestMonth: s.latestMonth,
    }))
  } catch {
    ElMessage.error('加载郑总店铺失败')
    return []
  }
}

// 加载选品店铺（含等级）- 分页加载全部
const loadSelectionStores = async (): Promise<UnifiedStore[]> => {
  try {
    let allStores: UnifiedStore[] = []
    let page = 1
    const size = 500
    let total = Infinity

    while (allStores.length < total) {
      const res = await selectionApi.getStoresWithGrades({ page, size })
      const data = res.data
      if (!data || !data.list) break

      total = data.total
      const mapped = data.list.map((s: any) => ({
        storeName: s.storeName,
        marketplace: '',
        storeUrl: s.storeUrl,
        source: 'selection' as StoreSource,
        grade: s.grade as StoreGrade,
        productCount: s.productCount || 0,
        storeScore: s.storeScore || 0,
        gradeDistribution: s.gradeDistribution,
        avgListingDays: s.avgListingDays,
      }))
      allStores.push(...mapped)
      page++
    }

    return allStores
  } catch {
    ElMessage.error('加载选品店铺失败')
    return []
  }
}

// 合并两个数据源
const loadAllStores = async () => {
  loading.value = true
  try {
    const [zhengStores, selectionStores] = await Promise.all([
      loadZhengShops(),
      loadSelectionStores(),
    ])

    // 去重：如果选品店铺名已在郑总中出现，跳过
    const zhengNames = new Set(zhengStores.map(s => s.storeName.toLowerCase()))
    const filteredSelection = selectionStores.filter(
      s => !zhengNames.has(s.storeName.toLowerCase())
    )

    stores.value = [...zhengStores, ...filteredSelection]
    displayCount.value = STORE_PAGE_SIZE
  } catch {
    ElMessage.error('加载店铺列表失败')
  } finally {
    loading.value = false
  }
}

// 点击店铺 → 跳转到对应选品页面
const goToStorePage = (shop: UnifiedStore) => {
  if (shop.source === 'zheng') {
    router.push({
      path: '/zheng-products',
      query: { storeName: shop.storeName, marketplace: shop.marketplace }
    })
  } else {
    router.push({
      path: '/all-selection',
      query: { storeName: shop.storeName }
    })
  }
}

const openStore = (url: string) => {
  window.open(url, '_blank')
}

const handleSyncShop = async (shop: UnifiedStore) => {
  if (shop.source !== 'zheng') return
  const key = shopKey(shop)
  syncingShop.value = key
  try {
    await competitorApi.syncDengZongShop({ sellerName: shop.storeName, marketplace: shop.marketplace })
    ElMessage.success(`${shop.storeName} 同步完成`)
    await loadAllStores()
  } catch {
    ElMessage.error(`${shop.storeName} 同步失败`)
  } finally {
    syncingShop.value = ''
  }
}

const handleSyncAll = async () => {
  if (syncing.value) return
  const zhengShops = stores.value.filter(s => s.source === 'zheng')
  if (zhengShops.length === 0) {
    ElMessage.warning('没有可同步的郑总店铺')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将同步 ${zhengShops.length} 个郑总店铺的数据，可能需要较长时间。继续？`,
      '同步确认',
      { confirmButtonText: '开始同步', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  syncing.value = true
  syncTotal.value = zhengShops.length
  syncProgress.value = 0
  let failed = 0
  try {
    for (const shop of zhengShops) {
      syncProgress.value++
      try {
        await competitorApi.syncDengZongShop({ sellerName: shop.storeName, marketplace: shop.marketplace })
      } catch {
        failed++
      }
    }
    if (failed === 0) {
      ElMessage.success('全部同步完成')
    } else {
      ElMessage.warning(`同步完成，${failed} 个店铺失败`)
    }
    await loadAllStores()
  } catch {
    ElMessage.error('同步过程中出错')
  } finally {
    syncing.value = false
    syncProgress.value = 0
  }
}

onMounted(() => {
  loadAllStores()
})
</script>

<style scoped>
.zheng-shop-overview {
  padding: 20px;
}

/* 统计卡片 */
.stats-cards {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.stat-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.summary-text {
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* 店铺网格 */
.shop-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.shop-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.shop-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.shop-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: #fafafa;
  transition: background 0.2s;
  height: 100%;
  box-sizing: border-box;
}

.shop-header:hover {
  background: #f0f2f5;
}

.shop-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.shop-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.grade-tag {
  flex-shrink: 0;
}

.shop-name {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-month {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

.product-count-badge {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.shop-meta {
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.shop-meta .divider {
  margin: 0 6px;
  color: #dcdfe6;
}

/* 等级分布标签 */
.grade-dist {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-right: 4px;
}

.grade-s { background: #f0f9eb; color: #67c23a; }
.grade-a { background: #ecf5ff; color: #409eff; }
.grade-b { background: #fdf6ec; color: #e6a23c; }
.grade-c { background: #f4f4f5; color: #909399; }
.grade-d { background: #fef0f0; color: #f56c6c; }

.listing-days {
  color: #67c23a;
  font-size: 12px;
}

.shop-notes {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.shop-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 8px;
}

.load-more-stores {
  text-align: center;
  padding: 16px 0;
}
</style>
