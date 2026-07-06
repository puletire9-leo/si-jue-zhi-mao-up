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
              共 {{ filteredStores.length }} 个店铺 |
              {{ filteredProducts }} 个商品
            </span>
          </div>
          <div class="header-actions">
            <el-select
              v-model="marketplace"
              placeholder="全部站点"
              clearable
              size="small"
              style="width: 110px"
            >
              <el-option label="UK" value="UK" />
              <el-option label="DE" value="DE" />
              <el-option label="US" value="US" />
            </el-select>
            <el-select
              v-model="sourceFilter"
              placeholder="全部来源"
              clearable
              size="small"
              style="width: 110px"
            >
              <el-option label="郑总店铺" value="zheng" />
              <el-option label="选品管理" value="selection" />
            </el-select>
            <el-select
              v-model="sortBy"
              placeholder="排序"
              size="small"
              style="width: 120px"
            >
              <el-option label="M01命中数" value="productCount" />
              <el-option label="店铺评分" value="storeScore" />
              <el-option label="等级" value="grade" />
              <el-option label="匹配度评级" value="ratingScore" />
            </el-select>
            <el-button-group size="small">
              <el-button
                :type="sortOrder === 'desc' ? 'primary' : ''"
                @click="sortOrder = 'desc'"
                >降序</el-button
              >
              <el-button
                :type="sortOrder === 'asc' ? 'primary' : ''"
                @click="sortOrder = 'asc'"
                >升序</el-button
              >
            </el-button-group>
            <el-input
              v-model="searchText"
              placeholder="搜索店铺"
              clearable
              size="small"
              style="width: 180px"
            />
            <el-button
              type="warning"
              size="small"
              :loading="ratingRunning"
              :disabled="ratingRunning"
              @click="handleStartRating"
            >
              {{
                ratingRunning
                  ? `评级中 ${ratingStep}/${ratingTotal}`
                  : "匹配度评级"
              }}
            </el-button>
          </div>
        </div>
        <!-- 批量选择 -->
        <div class="batch-controls">
          <span class="batch-label">批量选择：</span>
          <el-button size="small" @click="selectRange(0, 50)">前50</el-button>
          <el-button size="small" @click="selectRange(0, 100)">前100</el-button>
          <el-button size="small" @click="selectRange(0, 200)">前200</el-button>
          <el-input
            v-model.number="rangeStart"
            size="small"
            style="width: 70px"
            placeholder="起"
          />
          <span style="color: var(--el-text-color-secondary)">—</span>
          <el-input
            v-model.number="rangeEnd"
            size="small"
            style="width: 70px"
            placeholder="止"
          />
          <el-button
            type="primary"
            size="small"
            @click="selectRange(rangeStart - 1, rangeEnd)"
            >选择范围</el-button
          >
          <el-button
            size="small"
            :type="selectionMode ? 'warning' : ''"
            @click="selectionMode = !selectionMode"
          >
            {{ selectionMode ? "退出选择" : "选择模式" }}
          </el-button>
          <el-button
            type="success"
            size="small"
            :disabled="selectedStores.length === 0"
            @click="openBatchDrawer"
          >
            批量导入 ({{ selectedStores.length }})
          </el-button>
          <el-button
            v-if="selectedStores.length > 0"
            size="small"
            @click="selectedStores = []"
            >清空</el-button
          >
        </div>
      </template>

      <SkeletonWrapper
        :loading="loading && !hasLoaded"
        variant="list"
        :count="12"
      >
        <div v-loading="loading" class="shop-list">
          <div
            v-for="shop in displayedStores"
            :key="shop.key"
            class="shop-card"
            :class="{
              'shop-card-selected': selectedStores.some(
                (s) => shopKey(s) === shop.key,
              ),
            }"
          >
            <!-- 店铺卡片 -->
            <div
              class="shop-header"
              @click="
                selectionMode
                  ? toggleStoreSelection(shop.data)
                  : goToStorePage(shop.data)
              "
            >
              <div class="shop-info">
                <div class="shop-name-row">
                  <el-tag
                    :type="gradeTagType(shop.data.grade)"
                    size="small"
                    effect="dark"
                    class="grade-tag"
                  >
                    {{ gradeLabel(shop.data.grade) }}
                  </el-tag>
                  <span class="shop-name" :title="shop.data.storeName">{{
                    shop.data.storeName
                  }}</span>
                  <el-tag
                    v-if="shop.data.marketplace"
                    :type="marketplaceTagType(shop.data.marketplace)"
                    size="small"
                    effect="plain"
                  >
                    {{ shop.data.marketplace }}
                  </el-tag>
                  <el-tag
                    v-if="shop.data.source === 'selection'"
                    type="info"
                    size="small"
                    effect="plain"
                    >选品</el-tag
                  >
                  <span v-if="shop.data.latestMonth" class="shop-month">{{
                    shop.data.latestMonth
                  }}</span>
                  <span v-if="shop.data.lastSyncedAt" class="shop-sync-time">{{
                    formatSyncTime(shop.data.lastSyncedAt)
                  }}</span>
                  <span class="product-count-badge">
                    {{
                      shop.data.methodHitCount != null
                        ? `${shop.data.methodHitCount} M01命中`
                        : `${shop.data.productCount} 个商品`
                    }}
                  </span>
                </div>
                <div class="shop-meta">
                  <template v-if="shop.data.source === 'zheng'">
                    <span
                      >营收
                      {{
                        formatRevenueByMarket(
                          shop.data.totalRevenue || 0,
                          shop.data.marketplace,
                        )
                      }}</span
                    >
                    <span class="divider">|</span>
                    <span>评分 {{ shop.data.avgRating }}</span>
                    <span class="divider">|</span>
                    <span
                      >{{ formatNumber(shop.data.totalUnits || 0) }} 销量</span
                    >
                  </template>
                  <template v-else>
                    <span v-if="shop.data.methodHitCount != null">
                      方法卡 M01 命中 {{ shop.data.methodHitCount }}
                    </span>
                    <span v-else>店铺评分 {{ shop.data.storeScore }}</span>
                    <span class="divider">|</span>
                    <span v-if="shop.data.topCategory">
                      主类目 {{ shop.data.topCategory }}
                    </span>
                    <span v-else-if="shop.data.avgPrice != null">
                      均价 {{ currencySymbol(shop.data.marketplace) }}{{ shop.data.avgPrice }}
                    </span>
                    <span v-if="shop.data.gradeDistribution">
                      <span
                        v-if="shop.data.gradeDistribution.S"
                        class="grade-dist grade-s"
                        >S{{ shop.data.gradeDistribution.S }}</span
                      >
                      <span
                        v-if="shop.data.gradeDistribution.A"
                        class="grade-dist grade-a"
                        >A{{ shop.data.gradeDistribution.A }}</span
                      >
                      <span
                        v-if="shop.data.gradeDistribution.B"
                        class="grade-dist grade-b"
                        >B{{ shop.data.gradeDistribution.B }}</span
                      >
                      <span
                        v-if="shop.data.gradeDistribution.C"
                        class="grade-dist grade-c"
                        >C{{ shop.data.gradeDistribution.C }}</span
                      >
                      <span
                        v-if="shop.data.gradeDistribution.D"
                        class="grade-dist grade-d"
                        >D{{ shop.data.gradeDistribution.D }}</span
                      >
                    </span>
                    <span v-if="shop.data.avgListingDays" class="divider"
                      >|</span
                    >
                    <span v-if="shop.data.avgListingDays" class="listing-days">
                      平均上架 {{ shop.data.avgListingDays }} 天
                    </span>
                  </template>
                </div>
                <div v-if="shop.data.ratingScore != null" class="shop-rating">
                  <span class="rating-label">匹配度</span>
                  <el-tag
                    :type="ratingTagType(shop.data.ratingGrade)"
                    size="small"
                    effect="dark"
                  >
                    {{ shop.data.ratingGrade }}
                  </el-tag>
                  <span class="rating-score"
                    >{{ shop.data.ratingScore }} 分</span
                  >
                  <span v-if="shop.data.ratingBestMatch" class="rating-match"
                    >最佳: {{ shop.data.ratingBestMatch }}</span
                  >
                </div>
                <div v-if="shop.data.notes" class="shop-notes">
                  {{ shop.data.notes }}
                </div>
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
                <el-button
                  type="primary"
                  size="small"
                  @click.stop="goToStorePage(shop.data)"
                >
                  查看商品
                </el-button>
              </div>
            </div>
          </div>

          <!-- 加载更多店铺 -->
          <div
            v-if="displayCount < filteredStores.length"
            class="load-more-stores"
          >
            <el-button link type="primary" @click="loadMoreStores">
              加载更多店铺 ({{ filteredStores.length - displayCount }} 个未显示)
            </el-button>
          </div>

          <el-empty
            v-if="!loading && filteredStores.length === 0"
            description="暂无店铺数据"
          />
        </div>
      </SkeletonWrapper>
    </el-card>

    <!-- 批量导入抽屉 -->
    <el-drawer
      v-model="batchDrawerVisible"
      title="批量导入店铺数据"
      size="450px"
      direction="rtl"
    >
      <div class="batch-summary-card">
        <div class="batch-stat">
          <span>已选店铺：</span><b>{{ selectedStores.length }}</b> 个
        </div>
        <div class="batch-stat">
          <span>郑总店铺：</span><b>{{ zhengStoreCount }}</b> 个 →
          deng_zong_shop
        </div>
        <div class="batch-stat">
          <span>选品店铺：</span><b>{{ selectionStoreCount }}</b> 个 →
          competitor_products
        </div>
      </div>

      <el-alert
        v-if="zhengStoreCount > 0 && selectionStoreCount > 0"
        type="warning"
        :closable="false"
        style="margin: 12px 0"
      >
        混合来源将分别处理：郑总店铺 → deng_zong_shop，选品店铺 →
        competitor_products
      </el-alert>

      <div class="store-name-list">
        <div
          v-for="(store, idx) in selectedStores"
          :key="idx"
          class="store-name-item"
        >
          <el-tag
            :type="store.source === 'zheng' ? 'danger' : 'success'"
            size="small"
          >
            {{ store.source === "zheng" ? "郑总" : "选品" }}
          </el-tag>
          <span class="store-name-text">{{ store.storeName }}</span>
          <span v-if="store.marketplace" class="store-mp">{{
            store.marketplace
          }}</span>
        </div>
      </div>

      <div v-if="batchProgress.status" class="batch-progress">
        <el-progress
          :percentage="batchProgressPercent"
          :status="batchProgress.status === 'DONE' ? 'success' : undefined"
        />
        <div class="progress-detail">
          {{ batchProgress.batchCurrent }} / {{ batchProgress.batchTotal }} 卖家
          <span v-if="batchProgress.apiSuccess">
            | 入库 {{ batchProgress.apiSuccess }}</span
          >
        </div>
        <div v-if="batchProgress.progressLog" class="progress-log">
          {{ batchProgress.progressLog }}
        </div>
      </div>

      <template #footer>
        <el-button @click="batchDrawerVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="batchImporting"
          :disabled="batchProgress.status === 'RUNNING'"
          @click="handleBatchImport"
        >
          开始导入
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/request";
import { competitorApi, getDengZongMaxBatchDate } from "@/api/competitor";
import { asinImportApi } from "@/api/asinImport";
import SkeletonWrapper from "@/components/SkeletonWrapper/index.vue";

defineOptions({ name: "ZhengShopOverview" });

type StoreGrade = "zheng" | "premium" | "normal" | "poor" | "unrated";
type StoreSource = "zheng" | "selection";

interface GradeDistribution {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

interface UnifiedStore {
  storeName: string;
  marketplace: string;
  storeUrl?: string;
  source: StoreSource;
  grade: StoreGrade;
  productCount: number;
  totalRevenue?: number;
  totalUnits?: number;
  avgRating?: number;
  storeScore?: number;
  gradeDistribution?: GradeDistribution;
  avgListingDays?: number;
  sellerId?: number;
  notes?: string;
  latestMonth?: string;
  lastSyncedAt?: string;
  latestBatchDate?: string;
  ratingScore?: number | null;
  ratingGrade?: string | null;
  ratingBestMatch?: string | null;
  methodId?: string;
  methodHitCount?: number;
  topCategory?: string | null;
  avgPrice?: number | null;
}

interface ShopRatingRecord {
  sellerName: string;
  marketplace?: string;
  productCount?: number;
  ratingScore?: number;
  ratingGrade?: string;
  bestMatchSeller?: string;
  finalScore?: number;
  grade?: string;
}

interface MethodRankRecord {
  sellerName: string;
  marketplace?: string;
  hitCount?: number;
  topCategory?: string | null;
  avgPrice?: number | null;
}

const STORE_PAGE_SIZE = 20;

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const hasLoaded = ref(false);
const marketplace = ref("");
const searchText = ref("");
const stores = ref<UnifiedStore[]>([]);
const syncingShop = ref("");

// 筛选/排序状态
const selectionMode = ref(false);
const gradeFilter = ref("");
const sourceFilter = ref("");
const sortBy = ref("productCount");
const sortOrder = ref<"asc" | "desc">("desc");

// 单个店铺选择切换
const toggleStoreSelection = (store: UnifiedStore) => {
  const key = shopKey(store);
  const idx = selectedStores.value.findIndex((s) => shopKey(s) === key);
  if (idx >= 0) {
    selectedStores.value.splice(idx, 1);
  } else {
    selectedStores.value.push(store);
  }
};

// 评级状态
const ratingRunning = ref(false);
const ratingStep = ref(0);
const ratingTotal = ref(0);
let ratingPollTimer: ReturnType<typeof setInterval> | null = null;

// 分页显示
const displayCount = ref(STORE_PAGE_SIZE);

// 唯一标识店铺卡片：同一卖家可能在 UK/DE 两站点各登记一行（郑总盘子常见），
// 必须带上 marketplace，否则跨站点同名卡 Vue key 重复、勾选会串台。
const shopKey = (shop: UnifiedStore) =>
  `${shop.source}:${shop.marketplace || ""}:${shop.storeName}`;

// 等级统计（单次遍历）
const gradeStats = computed(() => {
  const counts = { zheng: 0, premium: 0, normal: 0, poor: 0, unrated: 0 };
  for (const s of stores.value) {
    if (s.source === "zheng") {
      counts.zheng++;
    } else {
      counts[s.grade]++;
    }
  }
  return [
    { key: "", label: "全部", count: stores.value.length },
    { key: "zheng", label: "郑总", count: counts.zheng },
    { key: "premium", label: "优质", count: counts.premium },
    { key: "normal", label: "一般", count: counts.normal },
    { key: "poor", label: "差", count: counts.poor },
    { key: "unrated", label: "未评级", count: counts.unrated },
  ];
});

// 筛选 + 排序
const filteredStores = computed(() => {
  let list = stores.value;

  // 站点筛选（仅对郑总店铺生效，选品店铺无站点信息）
  if (marketplace.value) {
    list = list.filter((s) => !s.marketplace || s.marketplace === marketplace.value);
  }

  // 等级筛选：郑总店铺仅在"郑总"tab显示，不串台到其他等级
  if (gradeFilter.value) {
    if (gradeFilter.value === "zheng") {
      list = list.filter((s) => s.source === "zheng");
    } else {
      list = list.filter(
        (s) => s.source !== "zheng" && s.grade === gradeFilter.value,
      );
    }
  }

  // 来源筛选
  if (sourceFilter.value) {
    list = list.filter((s) => s.source === sourceFilter.value);
  }

  // 搜索
  if (searchText.value) {
    const q = searchText.value.toLowerCase();
    list = list.filter((s) => s.storeName.toLowerCase().includes(q));
  }

  // 排序（避免 mutating 原数组）
  const gradeOrder: Record<StoreGrade, number> = {
    zheng: 5,
    premium: 4,
    normal: 3,
    poor: 2,
    unrated: 1,
  };
  const sorted = [...list];
  sorted.sort((a, b) => {
    let va: number, vb: number;
    if (sortBy.value === "grade") {
      va = gradeOrder[a.grade] || 0;
      vb = gradeOrder[b.grade] || 0;
    } else if (sortBy.value === "storeScore") {
      va = a.storeScore || (a.grade === "zheng" ? 100 : 0);
      vb = b.storeScore || (b.grade === "zheng" ? 100 : 0);
    } else if (sortBy.value === "ratingScore") {
      va = a.ratingScore ?? -1;
      vb = b.ratingScore ?? -1;
    } else {
      va = a.productCount;
      vb = b.productCount;
    }
    return sortOrder.value === "desc" ? vb - va : va - vb;
  });

  return sorted;
});

// 带 key 的显示列表（预计算 key，避免模板中重复调用）
const displayedStores = computed(() => {
  return filteredStores.value.slice(0, displayCount.value).map((s) => ({
    key: shopKey(s),
    data: s,
  }));
});

const filteredProducts = computed(() =>
  filteredStores.value.reduce((sum, s) => sum + s.productCount, 0),
);

const currencySymbol = (mp: string) => {
  if (mp === "UK") return "£";
  if (mp === "DE") return "€";
  return "$";
};

const marketplaceTagType = (mp: string): "primary" | "success" | "warning" => {
  if (mp === "UK") return "primary";
  if (mp === "DE") return "success";
  return "warning";
};

const gradeTagType = (
  grade: StoreGrade,
): "danger" | "success" | "primary" | "info" | "warning" => {
  const map: Record<
    StoreGrade,
    "danger" | "success" | "primary" | "info" | "warning"
  > = {
    zheng: "danger",
    premium: "success",
    normal: "primary",
    poor: "info",
    unrated: "warning",
  };
  return map[grade] || "info";
};

const gradeLabel = (grade: StoreGrade) => {
  const map: Record<StoreGrade, string> = {
    zheng: "郑总",
    premium: "优质",
    normal: "一般",
    poor: "差",
    unrated: "未评级",
  };
  return map[grade] || grade;
};

const ratingTagType = (
  grade?: string | null,
): "primary" | "success" | "warning" | "info" | "danger" => {
  switch (grade) {
    case "A":
      return "success";
    case "B":
      return "primary";
    case "C":
      return "warning";
    case "D":
      return "danger";
    case "F":
      return "danger";
    default:
      return "info";
  }
};

const formatNumber = (num: number) => {
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  return num.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
};

const formatRevenueByMarket = (num: number, mp: string) => {
  return currencySymbol(mp) + formatNumber(num);
};

const formatSyncTime = (dt: string) => {
  if (!dt) return "";
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1) return `${Math.floor(diffMs / 60000)} 分钟前`;
  if (diffH < 24) return `${diffH} 小时前`;
  if (diffD < 7) return `${diffD} 天前`;
  return d.toLocaleDateString("zh-CN");
};

const loadMoreStores = () => {
  displayCount.value += STORE_PAGE_SIZE;
};

// 加载郑总店铺
const loadZhengShops = async (): Promise<UnifiedStore[]> => {
  try {
    const params: Record<string, string> = {};
    if (marketplace.value) params.marketplace = marketplace.value;

    // 获取 latestBatchDate（全局最新批次日期）
    let latestBatchDate = "";
    try {
      const batchRes = await getDengZongMaxBatchDate(marketplace.value || "UK");
      if (batchRes?.data) {
        latestBatchDate = batchRes.data;
        params.batchDate = latestBatchDate;
      }
    } catch {
      // 批次日期非必须，失败不阻塞
    }

    const res = await competitorApi.getDengZongShopSellerSummary(params);
    return (res.data || []).map((s: any) => ({
      storeName: s.sellerName,
      marketplace: s.marketplace,
      storeUrl: s.storeUrl,
      source: "zheng" as StoreSource,
      grade: "zheng" as StoreGrade,
      productCount: s.productCount || 0,
      totalRevenue: s.totalRevenue || 0,
      totalUnits: s.totalUnits || 0,
      avgRating: s.avgRating || 0,
      sellerId: s.sellerId,
      notes: s.notes,
      latestMonth: s.latestMonth,
      lastSyncedAt: s.lastSyncedAt,
      latestBatchDate: latestBatchDate || s.latestBatchDate,
    }));
  } catch {
    ElMessage.error("加载郑总店铺失败");
    return [];
  }
};

// 加载选品店铺
const loadSelectionStores = async (): Promise<UnifiedStore[]> => {
  try {
    const params: Record<string, string | number> = {
      methodId: "M01",
      minCount: 1,
      limit: 500,
    };
    if (marketplace.value) params.marketplace = marketplace.value;
    const res = await request.get("/api/v1/modules/shop-rating/method-rank", {
      params,
    });
    const list = (res.data || []) as MethodRankRecord[];
    return list.map((s) => ({
      storeName: s.sellerName,
      marketplace: s.marketplace || marketplace.value,
      storeUrl: "",
      source: "selection" as StoreSource,
      productCount: s.hitCount || 0,
      methodHitCount: s.hitCount || 0,
      methodId: "M01",
      topCategory: s.topCategory || null,
      avgPrice: s.avgPrice ?? null,
      grade:
        s.hitCount >= 10
          ? ("premium" as StoreGrade)
          : s.hitCount >= 3
            ? ("normal" as StoreGrade)
            : ("unrated" as StoreGrade),
    }));
  } catch {
    ElMessage.error("加载选品店铺失败");
    return [];
  }
};

// 合并两个数据源
const loadSavedRatings = async () => {
  try {
    const res = await request.get("/api/v1/modules/shop-rating/ratings");
    const ratings = (res.data || []) as ShopRatingRecord[];
    if (!ratings.length) return;
    const ratingMap = new Map<string, ShopRatingRecord>(
      ratings.map((r) => [r.sellerName, r]),
    );
    for (const store of stores.value) {
      const r = ratingMap.get(store.storeName);
      if (r) {
        store.ratingScore = r.ratingScore;
        store.ratingGrade = r.ratingGrade;
        store.ratingBestMatch = r.bestMatchSeller;
        if (store.source !== "zheng") {
          const g = r.ratingGrade;
          if (g === "A") store.grade = "premium";
          else if (g === "B" || g === "C" || g === "D") store.grade = "normal";
          else if (g === "F") store.grade = "poor";
        }
      }
    }
  } catch {
    /* 静默失败 */
  }
};

const loadAllStores = async () => {
  loading.value = true;
  try {
    const [zhengStores, selectionStores] = await Promise.all([
      loadZhengShops(),
      loadSelectionStores(),
    ]);

    // 去重：如果选品店铺名已在郑总中出现，跳过
    const zhengNames = new Set(
      zhengStores.map((s) => s.storeName.toLowerCase()),
    );
    const filteredSelection = selectionStores.filter(
      (s) => !zhengNames.has(s.storeName.toLowerCase()),
    );

    stores.value = [...zhengStores, ...filteredSelection];
    displayCount.value = STORE_PAGE_SIZE;
    hasLoaded.value = true;

    // 加载已保存的评级
    await loadSavedRatings();
  } catch {
    ElMessage.error("加载店铺列表失败");
  } finally {
    loading.value = false;
  }
};

// 点击店铺 → 跳转到对应选品页面
const goToStorePage = (shop: UnifiedStore) => {
  if (shop.source === "zheng") {
    router.push({
      path: "/zheng-products",
      query: { storeName: shop.storeName, marketplace: shop.marketplace },
    });
  } else {
    router.push({
      path: "/all-selection",
      query: { storeName: shop.storeName },
    });
  }
};

const openStore = (url: string) => {
  window.open(url, "_blank");
};

const handleSyncShop = async (shop: UnifiedStore) => {
  if (shop.source !== "zheng") return;
  const key = shopKey(shop);
  syncingShop.value = key;
  try {
    await competitorApi.syncDengZongShop({
      sellerName: shop.storeName,
      marketplace: shop.marketplace,
    });
    ElMessage.success(`${shop.storeName} 同步完成`);
    await loadAllStores();
  } catch {
    ElMessage.error(`${shop.storeName} 同步失败`);
  } finally {
    syncingShop.value = "";
  }
};

// ========== 匹配度评级 ==========
const handleStartRating = async () => {
  if (ratingRunning.value) return;
  const mp = marketplace.value || "UK";
  ratingRunning.value = true;
  ratingStep.value = 0;
  ratingTotal.value = 0;
  try {
    const res = await request.post(
      "/api/v1/modules/shop-rating/evaluate",
      null,
      {
        params: { marketplace: mp, minCount: 5 },
      },
    );
    const taskId = res.data?.taskId;
    if (!taskId) {
      ElMessage.error("启动评级失败");
      ratingRunning.value = false;
      return;
    }
    ElMessage.success("评级任务已启动");
    // 轮询任务状态
    ratingPollTimer = setInterval(async () => {
      try {
        const taskRes = await request.get(
          `/api/v1/modules/shop-rating/task/${taskId}`,
        );
        const data = taskRes.data;
        if (!data) return;
        ratingStep.value = data.currentStep || 0;
        ratingTotal.value = data.totalSteps || 0;
        if (data.status === "COMPLETED") {
          clearInterval(ratingPollTimer!);
          ratingPollTimer = null;
          ratingRunning.value = false;
          // 合并评级结果到 stores
          if (data.results) {
            const ratingMap = new Map(
              (data.results as ShopRatingRecord[]).map((r) => [
                r.sellerName,
                r,
              ]),
            );
            // 更新已有店铺的评级
            for (const store of stores.value) {
              const r = ratingMap.get(store.storeName);
              if (r) {
                store.ratingScore = r.finalScore;
                store.ratingGrade = r.grade;
                store.ratingBestMatch = r.bestMatchSeller;
                // 选品店铺评级后同步更新 grade（用于 tab 分类）
                // 郑总店铺保持 grade='zheng'，不改变 tab 归属
                if (store.source !== "zheng") {
                  const g = r.grade;
                  if (g === "A") store.grade = "premium";
                  else if (g === "B" || g === "C" || g === "D")
                    store.grade = "normal";
                  else store.grade = "poor";
                }
                ratingMap.delete(store.storeName);
              }
            }
            // 评级结果中未匹配的店铺，加入列表
            for (const [name, r] of ratingMap) {
              const g = r.grade;
              let grade: StoreGrade = "poor";
              if (g === "A") grade = "premium";
              else if (g === "B" || g === "C" || g === "D") grade = "normal";
              stores.value.push({
                storeName: name,
                marketplace: r.marketplace || "",
                storeUrl: "",
                source: "selection",
                productCount: r.productCount || 0,
                grade,
                ratingScore: r.finalScore,
                ratingGrade: r.grade,
                ratingBestMatch: r.bestMatchSeller,
              });
            }
            ElMessage.success(`评级完成，${data.results.length} 个店铺`);
          }
        } else if (data.status === "FAILED") {
          clearInterval(ratingPollTimer!);
          ratingPollTimer = null;
          ratingRunning.value = false;
          ElMessage.error("评级失败: " + (data.error || "未知错误"));
        }
      } catch {
        // 轮询出错不中断
      }
    }, 3000);
  } catch (e: any) {
    ratingRunning.value = false;
    ElMessage.error("启动评级失败: " + (e.message || "未知错误"));
  }
};

// ========== 批量导入 ==========
const rangeStart = ref(1);
const rangeEnd = ref(50);
const selectedStores = ref<UnifiedStore[]>([]);
const batchDrawerVisible = ref(false);
const batchMarketplace = ref("UK");
const batchImporting = ref(false);
const batchProgress = reactive({
  status: "",
  batchCurrent: 0,
  batchTotal: 0,
  apiSuccess: 0,
  apiFail: 0,
  progressLog: "",
});

const zhengStoreCount = computed(
  () => selectedStores.value.filter((s) => s.source === "zheng").length,
);
const selectionStoreCount = computed(
  () => selectedStores.value.filter((s) => s.source === "selection").length,
);
const batchProgressPercent = computed(() => {
  if (!batchProgress.batchTotal) return 0;
  return Math.round(
    (batchProgress.batchCurrent / batchProgress.batchTotal) * 100,
  );
});

let batchPollingTimer: ReturnType<typeof setInterval> | null = null;

const selectRange = (start: number, end: number) => {
  const s = Math.max(0, start);
  const e = Math.min(end, filteredStores.value.length);
  selectedStores.value = filteredStores.value.slice(s, e);
  ElMessage.success(`已选择 ${selectedStores.value.length} 个店铺`);
};

const openBatchDrawer = () => {
  batchDrawerVisible.value = true;
  batchProgress.status = "";
  batchProgress.batchCurrent = 0;
  batchProgress.batchTotal = 0;
  batchProgress.apiSuccess = 0;
  batchProgress.apiFail = 0;
  batchProgress.progressLog = "";
};

const handleBatchImport = async () => {
  if (!selectedStores.value.length) return;
  if (selectedStores.value.length > 100) {
    ElMessage.warning("最多 100 个卖家，请缩小范围");
    return;
  }

  const zhengStores = selectedStores.value.filter((s) => s.source === "zheng");
  const selectionStores = selectedStores.value.filter(
    (s) => s.source === "selection",
  );

  // 按 marketplace 分组，不同国家分别请求
  const groupByMp = (stores: UnifiedStore[]) => {
    const map = new Map<string, string[]>();
    for (const s of stores) {
      const mp = s.marketplace || batchMarketplace.value || "UK";
      if (!map.has(mp)) map.set(mp, []);
      map.get(mp)!.push(s.storeName);
    }
    return map;
  };

  const tasks: Array<{ names: string[]; target: string; marketplace: string }> =
    [];
  for (const [mp, names] of groupByMp(zhengStores)) {
    tasks.push({ names, target: "deng_zong_shop", marketplace: mp });
  }
  for (const [mp, names] of groupByMp(selectionStores)) {
    tasks.push({ names, target: "competitor_products", marketplace: mp });
  }

  try {
    await ElMessageBox.confirm(
      `将为 ${selectedStores.value.length} 个卖家批量导入数据（${zhengStores.length} 郑总 + ${selectionStores.length} 选品）。确认？`,
      "确认批量导入",
      { confirmButtonText: "开始", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }

  batchImporting.value = true;
  try {
    for (const taskInfo of tasks) {
      const previewRes = await asinImportApi.sellerPreview(
        taskInfo.names,
        taskInfo.marketplace,
        taskInfo.target,
      );
      const preview = (previewRes as any).data || previewRes;

      await asinImportApi.sellerExecute(
        preview.taskId,
        undefined,
        taskInfo.target,
      );

      await new Promise<void>((resolve, reject) => {
        batchProgress.status = "RUNNING";
        batchProgress.batchTotal = preview.sellerCount;
        batchProgress.batchCurrent = 0;

        batchPollingTimer = setInterval(async () => {
          try {
            const progRes = await asinImportApi.progress(preview.taskId);
            const p = (progRes as any).data || progRes;
            batchProgress.batchCurrent = p.batchCurrent || 0;
            batchProgress.apiSuccess = p.apiSuccess || 0;
            batchProgress.apiFail = p.apiFail || 0;
            batchProgress.progressLog = p.progressLog || "";
            const taskStatus = p.status || p.taskStatus;
            if (
              ["DONE", "ERROR", "CANCELLED", "REJECTED"].includes(taskStatus)
            ) {
              if (batchPollingTimer) {
                clearInterval(batchPollingTimer);
                batchPollingTimer = null;
              }
              batchProgress.status = taskStatus;
              if (taskStatus === "DONE") resolve();
              else reject(new Error(p.errorMessage || `任务${taskStatus}`));
            }
          } catch {
            /* ignore polling errors */
          }
        }, 3000);
      });
    }

    batchProgress.status = "DONE";
    ElMessage.success("批量导入完成");
    await loadAllStores();
  } catch (e: any) {
    ElMessage.error(e.message || "批量导入失败");
  } finally {
    batchImporting.value = false;
    if (batchPollingTimer) {
      clearInterval(batchPollingTimer);
      batchPollingTimer = null;
    }
  }
};

onUnmounted(() => {
  if (batchPollingTimer) {
    clearInterval(batchPollingTimer);
    batchPollingTimer = null;
  }
  if (ratingPollTimer) {
    clearInterval(ratingPollTimer);
    ratingPollTimer = null;
  }
});

onMounted(async () => {
  await loadAllStores();
  // 深链预选：从品线完整性板块跳转过来，直接用 URL 参数构造待补全店铺并打开批量导入。
  // 注意：缺数据店铺按定义不在 stores.value（有数据汇总）中，必须用参数构造而非 filter。
  const preselect = route.query.stores;
  if (preselect) {
    const names = String(preselect)
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const src: StoreSource =
      route.query.source === "selection" ? "selection" : "zheng";
    const mp =
      typeof route.query.marketplace === "string"
        ? route.query.marketplace
        : "";
    if (names.length > 0) {
      selectedStores.value = names.map((name) => ({
        storeName: name,
        marketplace: mp,
        source: src,
        grade: (src === "zheng" ? "zheng" : "unrated") as StoreGrade,
        productCount: 0,
      }));
      selectionMode.value = true;
      if (mp) batchMarketplace.value = mp;
      openBatchDrawer();
    }
  }
});
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
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px var(--el-color-primary-light-8);
}

.stat-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
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
  color: var(--el-text-color-secondary);
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
  position: relative;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.shop-card:hover {
  box-shadow: 0 2px 12px var(--el-box-shadow-light);
}

.shop-card-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.shop-select-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: background 0.2s;
}

.shop-select-overlay:hover {
  background: var(--el-color-primary-light-9);
}

.shop-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: var(--el-fill-color-light);
  transition: background 0.2s;
  height: 100%;
  box-sizing: border-box;
}

.shop-header:hover {
  background: var(--el-fill-color-lighter);
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
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-month {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}

.shop-sync-time {
  font-size: 12px;
  color: var(--el-color-success);
  margin-left: 4px;
}

.product-count-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.shop-meta {
  font-size: 12px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.shop-meta .divider {
  margin: 0 6px;
  color: var(--el-border-color-lighter);
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

.grade-s {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.grade-a {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.grade-b {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.grade-c {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.grade-d {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.listing-days {
  color: var(--el-color-success);
  font-size: 12px;
}

.shop-notes {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.shop-rating {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;

  .rating-label {
    color: var(--el-text-color-secondary);
  }
  .rating-score {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }
  .rating-match {
    color: var(--el-text-color-secondary);
  }
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

/* 批量选择 */
.batch-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 0 4px;
  border-top: 1px solid var(--el-border-color-light);
  margin-top: 12px;
}

.batch-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

/* 批量导入抽屉 */
.batch-summary-card {
  padding: 12px;
  background: var(--el-color-success-light-9);
  border-radius: 8px;
  margin-bottom: 12px;
}

.batch-stat {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.store-name-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 8px;
}

.store-name-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.store-name-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-mp {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.batch-progress {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.progress-detail {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-top: 8px;
  text-align: center;
}

.progress-log {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
