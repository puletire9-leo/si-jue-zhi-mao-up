<template>
  <div class="selection-page">
    <!-- 顶部工具栏 -->
    <div class="topbar">
      <div class="tb-brand"><span>思觉智贸</span> · 选品</div>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>选品中心</el-breadcrumb-item>
        <el-breadcrumb-item>品线选品</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="tb-spacer" />

      <label class="tb-select desktop-only">
        站点
        <el-select v-model="store.marketplace" size="small" style="width: 80px">
          <el-option label="US" value="US" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
        </el-select>
      </label>

      <label class="tb-select desktop-only">
        月份
        <el-select v-model="store.month" size="small" style="width: 100px">
          <el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" />
        </el-select>
      </label>

      <MobileActionSheet
        class="mobile-only"
        title="站点"
        :options="siteOptions"
        v-model="store.marketplace"
      />
      <MobileActionSheet
        class="mobile-only"
        title="月份"
        :options="monthActionOptions"
        v-model="store.month"
      />

      <el-input
        v-model="store.searchKeyword"
        placeholder="搜索商品标题..."
        clearable
        style="width: 240px"
        size="small"
        @keyup.enter="store.searchByKeyword(store.searchKeyword)"
        @clear="store.searchByKeyword('')"
      />

      <button class="mobile-tree-btn" @click="mobileTreeOpen = true">
        <el-icon><Menu /></el-icon> 品线
      </button>
    </div>

    <!-- 统一筛选入口：筛选按钮 + 已选条件标签 -->
    <div class="unified-filter-bar">
      <el-button
        :icon="Filter"
        type="primary"
        plain
        size="small"
        @click="openFilterDrawer"
      >
        更多筛选
        <el-badge
          v-if="filterChips.length"
          :value="filterChips.length"
          class="filter-count-badge"
        />
      </el-button>
      <div class="filter-chips">
        <el-tag
          v-for="chip in filterChips"
          :key="chip.key"
          closable
          size="small"
          type="info"
          @close="removeChip(chip.key)"
        >
          {{ chip.label }}
        </el-tag>
        <el-button
          v-if="filterChips.length"
          link
          size="small"
          @click="clearAllFilters"
        >
          清除全部
        </el-button>
      </div>
    </div>

    <!-- 统一筛选抽屉 -->
    <FilterDrawer
      v-model:visible="filterDrawerVisible"
      title="筛选条件"
      :size="520"
      @reset="handleDrawerReset"
      @confirm="handleDrawerConfirm"
    >
      <div class="fd-section">
        <div class="fd-label">业务方法卡</div>

        <div class="method-card method-card--m01">
          <div class="method-card__body">
            <div class="method-card__head">
              <div class="method-card__name">M01 新品榜加速法</div>
              <el-tag
                v-if="store.activeMethodCard?.id === 'M01'"
                type="success"
                effect="light"
                size="small"
              >
                已应用
              </el-tag>
            </div>
            <div class="method-card__desc">
              clean 表去变体污染后,按价格带、重量、上架天数、销量分段或 BSR
              代理筛出新品候选。
            </div>
            <div class="method-card__meta">
              <span>适合：新品榜快筛</span>
              <span>站点：UK / DE / US</span>
              <span>数据源：competitor_products_clean</span>
            </div>
          </div>
          <div class="method-card__actions">
            <el-button
              v-if="store.activeMethodCard?.id !== 'M01'"
              type="primary"
              size="small"
              @click="applyM01Method"
            >
              应用方法
            </el-button>
            <el-button size="small" link @click="openMethodDetail('M01')">
              了解详情
            </el-button>
            <el-button
              v-if="store.activeMethodCard?.id === 'M01'"
              size="small"
              link
              @click="clearMethodCard"
            >
              退出方法
            </el-button>
          </div>
        </div>

        <div class="method-card method-card--m02">
          <div class="method-card__body">
            <div class="method-card__head">
              <div class="method-card__name">M02 郑总同行品线跟随法</div>
              <el-tag
                v-if="store.activeMethodCard?.id === 'M02'"
                type="success"
                effect="light"
                size="small"
              >
                已应用
              </el-tag>
            </div>
            <div class="method-card__desc">
              用郑总同行店铺最新批次作为基准盘子，重排品线树并标记被同行验证过的
              L1 / L2。
            </div>
            <div class="method-card__meta">
              <span>适合：同行跟随 / 品线优先级</span>
              <span>数据源：deng_zong_shop</span>
              <span v-if="store.zhengBatchDate"
                >批次：{{ store.zhengBatchDate }}</span
              >
            </div>
          </div>
          <div class="method-card__actions">
            <el-button
              v-if="store.activeMethodCard?.id !== 'M02'"
              type="primary"
              size="small"
              @click="applyM02Method"
            >
              应用方法
            </el-button>
            <el-button size="small" link @click="openMethodDetail('M02')">
              了解详情
            </el-button>
            <el-button
              v-if="store.activeMethodCard?.id === 'M02'"
              size="small"
              link
              @click="clearMethodCard"
            >
              退出方法
            </el-button>
          </div>
        </div>
      </div>

      <div class="fd-section">
        <div class="fd-label">卖家名</div>
        <el-input v-model="draftSeller" placeholder="卖家名" clearable />
      </div>
      <div class="fd-section">
        <div class="fd-label">品牌</div>
        <el-input v-model="draftBrand" placeholder="品牌" clearable />
      </div>
      <div class="fd-section">
        <div class="fd-label">区间与维度</div>
        <RangeFilterPanel
          :key="store.marketplace"
          v-model="draftRange"
          :country="store.marketplace"
          :source="drawerRangeSource"
          :snapshot-kind="drawerSnapshotKind"
          :auto-select-latest-week="drawerAutoSelectLatestWeek"
          embedded
        />
      </div>
      <div class="fd-section">
        <FilterPresetSelector
          :current-config="presetConfig"
          @apply="onPresetApply"
        />
        <QualifyRuleFilter
          v-if="false"
          :model-value="store.qualifyRules"
          @apply="store.applyQualifyRules"
        />
      </div>
    </FilterDrawer>

    <!-- 郑总店铺数据完整性确认 -->
    <div
      v-if="
        store.activeMethodCard?.id === 'M02' &&
        store.completeness &&
        !store.completeness.complete
      "
      class="completeness-banner"
    >
      <el-icon class="cb-icon"><WarningFilled /></el-icon>
      <span class="cb-text">
        本周郑总店铺数据：<b>{{ store.completeness.fetchedSellers }}</b> /
        {{ store.completeness.totalSellers }} 家有数据，缺失
        {{ store.completeness.missingSellers.length }} 家
      </span>
      <el-button size="small" type="warning" @click="goFillMissing">
        去补全
      </el-button>
    </div>

    <!-- 工作区 -->
    <div class="workspace">
      <div class="tree-wrapper" :class="{ collapsed: treeCollapsed }">
        <ProductLineTree
          :mobile-open="mobileTreeOpen"
          @close-mobile="mobileTreeOpen = false"
          @select-l1="(bsrId, name) => store.selectCategory(bsrId, name)"
        />

        <!-- 树折叠/展开按钮 -->
        <button
          class="tree-fold-btn"
          @click="treeCollapsed = !treeCollapsed"
          :title="treeCollapsed ? '展开品线树' : '收起品线树'"
        >
          <el-icon
            ><component :is="treeCollapsed ? DArrowRight : DArrowLeft"
          /></el-icon>
        </button>
      </div>

      <div
        class="tree-resize"
        v-show="!treeCollapsed"
        @mousedown="startResize"
      />

      <div class="content-area">
        <!-- 类目导航条 -->
        <div v-if="store.selectedBsrId" class="category-header">
          <span
            class="cat-l1"
            :class="{
              clickable: !!store.selectedNodeId,
              active: !store.selectedNodeId,
            }"
            @click="
              store.selectedNodeId &&
              store.selectCategory(store.selectedBsrId, store.selectedBsrName)
            "
          >
            📦 {{ store.selectedBsrName }}
          </span>
          <template v-if="store.selectedNodeId && store.selectedNodeName">
            <span class="cat-sep">/</span>
            <span class="cat-l2 active">{{ store.selectedNodeName }}</span>
          </template>
          <span v-if="!store.selectedNodeId" class="cat-hint"
            >显示大类全部商品</span
          >
          <span v-else class="cat-hint">显示该子类商品</span>
          <button
            class="l2-fold-btn"
            @click="l2Collapsed = !l2Collapsed"
            :title="l2Collapsed ? '展开子类' : '折叠子类'"
          >
            <el-icon
              ><component :is="l2Collapsed ? CaretBottom : CaretTop"
            /></el-icon>
          </button>
        </div>

        <!-- L2 子类面板：选中 L1 后显示 -->
        <div
          v-if="store.selectedBsrId && store.currentSubCategories.length"
          class="l2-panel"
          :class="{ collapsed: l2Collapsed }"
        >
          <div class="l2-search">
            <el-input
              v-model="subCategorySearch"
              placeholder="搜索子类…"
              :prefix-icon="Search"
              clearable
              size="small"
            />
            <span class="l2-count"
              >{{ displaySubCategories.length }} /
              {{ store.currentSubCategories.length }} 子类</span
            >
          </div>
          <div class="l2-list">
            <div
              v-for="cat in displaySubCategories"
              :key="cat.id"
              class="l2-item"
              :class="{ active: String(cat.nodeId) === store.selectedNodeId }"
              @click="handleL2ItemClick(cat)"
            >
              <span class="l2-item-name">{{ cat.name }}</span>
              <span class="l2-item-count">{{
                cat.productCount?.toLocaleString() || "—"
              }}</span>
            </div>
          </div>
        </div>

        <!-- 空白状态引导 -->
        <div v-if="!store.selectedBsrId" class="empty-guide">
          <div class="empty-guide-icon">
            <el-icon><FolderOpened /></el-icon>
          </div>
          <h3 class="empty-guide-title">从左侧选择品线开始</h3>
          <p class="empty-guide-desc">
            点击左侧品线大类查看该品类全部商品，<br />
            再在右侧面板中选择子类查看该子类商品。
          </p>
          <div class="empty-guide-steps">
            <div class="step">
              <span class="step-num">1</span>
              <span>选择市场与月份</span>
            </div>
            <div class="step-arrow">→</div>
            <div class="step">
              <span class="step-num">2</span>
              <span>点击左侧品线</span>
            </div>
            <div class="step-arrow">→</div>
            <div class="step">
              <span class="step-num">3</span>
              <span>浏览或筛选子类商品</span>
            </div>
          </div>
        </div>

        <!-- 筛选操作栏 —— 仅模型元素/载体筛选标签 -->
        <div
          v-if="store.selectedBsrId && store.selectedNodeId"
          class="action-bar"
        >
          <div class="filter-tags">
            <span
              v-for="f in store.activeFilters"
              :key="f.id"
              class="filter-tag"
            >
              {{ f.label }}
              <span class="close" @click="store.removeFilter(f.id)"
                >&times;</span
              >
            </span>
            <span v-if="!store.hasFilters" class="filter-hint">
              点击模型中的元素或载体加入筛选
            </span>
            <el-button
              v-if="store.hasFilters"
              size="small"
              @click="
                store.clearFilters();
                store.searchCompetitors();
              "
            >
              清除筛选
            </el-button>
          </div>
        </div>

        <!-- 商品卡片网格 -->
        <CompetitorCardGrid
          :products="store.competitorResults"
          :total="store.competitorTotal"
          :loading="store.competitorLoading"
          :current-page="store.competitorPage"
          :page-size="store.competitorPageSize"
          :selected-asins="store.selectedProducts"
          :selected-count="store.selectedCount"
          :sort-by="store.sortBy"
          @toggle-select="
            (asin: string) =>
              store.toggleProductSelection(
                asin,
                !store.selectedProducts.has(asin),
              )
          "
          @view-detail="openDetail"
          @card-click="openDetail"
          @page-change="store.goToPage"
          @size-change="
            (s) => {
              store.competitorPageSize = s;
              store.searchCompetitors();
            }
          "
          @select-all-current="store.selectAllOnPage(store.competitorResults)"
          @deselect-all-current="store.clearSelection()"
          @sort-change="store.setSortBy"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="store.selectedCount > 0" class="bottom-bar">
      <span>已选 {{ store.selectedCount }} 件</span>
      <el-button size="small" @click="store.clearSelection()">清空</el-button>
      <el-button
        type="primary"
        size="small"
        :loading="store.batchLoading"
        @click="store.batchAddToSelection()"
        >批量加入选品</el-button
      >
      <el-button
        size="small"
        :loading="store.exportLoading"
        @click="store.exportSelectedExcel()"
        >导出Excel</el-button
      >
    </div>

    <!-- 商品详情弹窗（侧边抽屉） -->
    <ProductDetailDialog
      v-model:visible="detailVisible"
      :product="detailProduct"
      mode="selection"
      use-drawer
      data-source="selection"
    />

    <!-- 方法卡详情抽屉 (复用组件) -->
    <MethodDetailDrawer
      v-model="methodDetailVisible"
      :method-id="methodDetailId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Menu,
  FolderOpened,
  Search,
  DArrowLeft,
  DArrowRight,
  CaretTop,
  CaretBottom,
  WarningFilled,
  Filter,
} from "@element-plus/icons-vue";
import { useProductLineSelectionStore } from "./store";
import ProductLineTree from "./components/ProductLineTree.vue";
import MethodDetailDrawer from "@/components/MethodDetailDrawer/index.vue";
import CompetitorCardGrid from "./components/CompetitorCardGrid.vue";
import ProductDetailDialog from "@/components/ProductDetailDialog/index.vue";
import MobileActionSheet from "@/components/MobileActionSheet/index.vue";
import QualifyRuleFilter from "@/components/QualifyRuleFilter/index.vue";
import FilterPresetSelector from "@/components/FilterPresetSelector/index.vue";
import RangeFilterPanel from "@/components/RangeFilterPanel/index.vue";
import FilterDrawer from "@/components/FilterDrawer/index.vue";
import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";
import { useSelectionAgentStore } from "@/stores/selectionAgent";
import { cloneRangeFilter, createEmptyRangeFilter } from "@/utils/rangeFilter";

const store = useProductLineSelectionStore();
const agentStore = useSelectionAgentStore();

// 方法卡详情抽屉
const methodDetailVisible = ref(false);
const methodDetailId = ref<"M01" | "M02" | null>(null);
const openMethodDetail = (id: "M01" | "M02") => {
  methodDetailId.value = id;
  methodDetailVisible.value = true;
};

// 跨页套用：悬浮卡在其他页套用筛选后跳转过来，这里消费暂存规则
function consumeAgentRules() {
  const rules = agentStore.consumePendingRules();
  if (rules && rules.length > 0) {
    store.applyAiFilterRules(rules);
    ElMessage.success("已套用 AI 推荐筛选");
  }
}
const router = useRouter();
const mobileTreeOpen = ref(false);

// ---- 筛选预设（统一面板区间）----
const presetConfig = () => ({
  ...store.rangeFilter,
  qualifyRules: store.qualifyRules,
});
function onPresetApply(cfg: Record<string, any>) {
  // 回填面板全字段（缺失补默认）
  store.applyRangeFilter({
    priceMin: cfg.priceMin ?? null,
    priceMax: cfg.priceMax ?? null,
    unitsMin: cfg.unitsMin ?? null,
    unitsMax: cfg.unitsMax ?? null,
    listingDaysMin: cfg.listingDaysMin ?? null,
    listingDaysMax: cfg.listingDaysMax ?? null,
    bsrMax: cfg.bsrMax ?? null,
    weightMax: cfg.weightMax ?? null,
    variantCountMax: cfg.variantCountMax ?? null,
    fulfillment: cfg.fulfillment ?? [],
    createdWeeks: cfg.createdWeeks ?? [],
    category: cfg.category ?? [],
    grade: cfg.grade ?? [],
    listingPreset: cfg.listingPreset ?? null,
  });
}

// ===== 统一筛选抽屉：draft(草稿) + 已提交(store) 双状态 =====
function cloneRange(r: RangeFilterValue): RangeFilterValue {
  return cloneRangeFilter(r);
}

const filterDrawerVisible = ref(false);
const draftSeller = ref("");
const draftBrand = ref("");
const draftRange = ref<RangeFilterValue>(createEmptyRangeFilter());
const drawerSnapshotKind = computed<
  "competitor_created_week" | "deng_zong_batch"
>(() =>
  store.activeMethodCard?.id === "M02"
    ? "deng_zong_batch"
    : "competitor_created_week",
);
const drawerRangeSource = computed(() => {
  if (store.activeMethodCard?.id === "M01") return "新品榜";
  if (store.activeMethodCard?.id === "M02") return "郑总店铺";
  return "";
});
const drawerAutoSelectLatestWeek = computed(() => !store.activeMethodCard);

function openFilterDrawer() {
  draftSeller.value = store.searchSellerName;
  draftBrand.value = store.searchBrand;
  draftRange.value = cloneRange(store.rangeFilter);
  filterDrawerVisible.value = true;
}

function handleDrawerConfirm() {
  store.searchSellerName = draftSeller.value;
  store.searchBrand = draftBrand.value;
  // applyRangeFilter 会回填区间并触发一次查询（卖家/品牌已写入 store，随查询带上）
  store.applyRangeFilter(cloneRange(draftRange.value));
  filterDrawerVisible.value = false;
}

function handleDrawerReset() {
  draftSeller.value = "";
  draftBrand.value = "";
  draftRange.value = createEmptyRangeFilter();
}

// 已选条件标签
interface FilterChip {
  key: string;
  label: string;
}
const filterChips = computed<FilterChip[]>(() => {
  const chips: FilterChip[] = [];
  const rf = store.rangeFilter;
  if (store.activeMethodCard)
    chips.push({
      key: "methodCard",
      label: `方法: ${store.activeMethodCard.id} ${store.activeMethodCard.name}`,
    });
  if (store.searchSellerName)
    chips.push({ key: "seller", label: `卖家: ${store.searchSellerName}` });
  if (store.searchBrand)
    chips.push({ key: "brand", label: `品牌: ${store.searchBrand}` });
  if (rf.priceMin != null || rf.priceMax != null)
    chips.push({
      key: "price",
      label: `价格: ${rf.priceMin ?? "·"}~${rf.priceMax ?? "·"}`,
    });
  if (rf.unitsMin != null || rf.unitsMax != null)
    chips.push({
      key: "units",
      label: `月销: ${rf.unitsMin ?? "·"}~${rf.unitsMax ?? "·"}`,
    });
  if (rf.listingDaysMin != null || rf.listingDaysMax != null)
    chips.push({
      key: "listingDays",
      label: `上架天数: ${rf.listingDaysMin ?? "·"}~${rf.listingDaysMax ?? "·"}`,
    });
  if (rf.bsrMax != null)
    chips.push({ key: "bsrMax", label: `BSR≤${rf.bsrMax}` });
  if (rf.weightMax != null)
    chips.push({ key: "weightMax", label: `重量≤${rf.weightMax}g` });
  if (rf.variantCountMax != null)
    chips.push({ key: "variantCountMax", label: `变体≤${rf.variantCountMax}` });
  if (rf.fulfillment.length)
    chips.push({
      key: "fulfillment",
      label: `配送: ${rf.fulfillment.join("/")}`,
    });
  if (rf.grade.length)
    chips.push({ key: "grade", label: `评级: ${rf.grade.join("/")}` });
  if (rf.createdWeeks.length)
    chips.push({
      key: "createdWeeks",
      label: `周批次: ${rf.createdWeeks.length}项`,
    });
  return chips;
});

function removeChip(key: string) {
  if (key === "methodCard") {
    store.clearMethodCard();
    return;
  }
  if (key === "seller") {
    store.searchSellerName = "";
    store.applyBasicFilters();
    return;
  }
  if (key === "brand") {
    store.searchBrand = "";
    store.applyBasicFilters();
    return;
  }
  const rf = cloneRange(store.rangeFilter);
  switch (key) {
    case "price":
      rf.priceMin = null;
      rf.priceMax = null;
      break;
    case "units":
      rf.unitsMin = null;
      rf.unitsMax = null;
      break;
    case "listingDays":
      rf.listingDaysMin = null;
      rf.listingDaysMax = null;
      rf.listingPreset = null;
      break;
    case "bsrMax":
      rf.bsrMax = null;
      break;
    case "weightMax":
      rf.weightMax = null;
      break;
    case "variantCountMax":
      rf.variantCountMax = null;
      break;
    case "fulfillment":
      rf.fulfillment = [];
      break;
    case "grade":
      rf.grade = [];
      break;
    case "createdWeeks":
      rf.createdWeeks = [];
      break;
  }
  store.applyRangeFilter(rf);
}

async function clearAllFilters() {
  await store.clearMethodCard();
  store.searchSellerName = "";
  store.searchBrand = "";
  store.applyRangeFilter(createEmptyRangeFilter());
}

async function applyM01Method() {
  await store.applyM01MethodCard();
  filterDrawerVisible.value = false;
}

async function applyM02Method() {
  await store.applyM02MethodCard();
  filterDrawerVisible.value = false;
}

async function clearMethodCard() {
  await store.clearMethodCard();
  filterDrawerVisible.value = false;
}

// 补全缺失店铺 → 跳转到店铺总览页自动勾选
function goFillMissing() {
  if (!store.completeness?.missingSellers.length) return;
  const names = store.completeness.missingSellers
    .map((s: { sellerName: string }) => s.sellerName)
    .join(",");
  router.push({
    path: "/zheng-shop-overview",
    query: { stores: names, source: "zheng", marketplace: store.marketplace },
  });
}
const detailVisible = ref(false);
const detailProduct = ref<any>(null);

// 折叠状态
const treeCollapsed = ref(false);
const l2Collapsed = ref(false);

// L2 子类面板
const subCategorySearch = ref("");
const displaySubCategories = computed(() => {
  const q = subCategorySearch.value.toLowerCase().trim();
  if (!q) return store.currentSubCategories;
  return store.currentSubCategories.filter((c) =>
    c.name.toLowerCase().includes(q),
  );
});

function handleL2ItemClick(cat: any) {
  if (String(cat.nodeId) === store.selectedNodeId) {
    // 已选中 → 回到 L1 视图
    store.selectCategory(store.selectedBsrId, store.selectedBsrName);
  } else {
    // 切换到 L2
    store.selectSubCategory(cat.nodeId, cat.name, store.selectedBsrId);
  }
}

// 切换 L1 时清空 L2 搜索词
watch(
  () => store.selectedBsrId,
  () => {
    subCategorySearch.value = "";
  },
);

// 月份动态生成：当前日期往前推12个月
const monthOptions = computed(() => {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(val);
  }
  return months;
});

// MobileActionSheet 选项
const siteOptions = [
  { label: "US", value: "US" },
  { label: "UK", value: "UK" },
  { label: "DE", value: "DE" },
];

const monthActionOptions = computed(() =>
  monthOptions.value.map((m) => ({ label: m, value: m })),
);

// 拖拽分隔线
const treeWidth = ref(280);
const resizing = ref(false);

function startResize(e: MouseEvent) {
  resizing.value = true;
  const startX = e.clientX;
  const startWidth = treeWidth.value;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const onMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX;
    treeWidth.value = Math.max(200, Math.min(400, startWidth + delta));
    document.documentElement.style.setProperty(
      "--tree-width",
      treeWidth.value + "px",
    );
  };
  const onUp = () => {
    resizing.value = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function openDetail(product: any) {
  detailProduct.value = product;
  detailVisible.value = true;
}

onMounted(async () => {
  // 品线分析默认应用 M01 新品榜加速法, 用户可从"业务方法卡"点"退出方法"回全量
  if (!store.activeMethodCard) {
    await store.applyM01MethodCard();
  } else {
    await store.initData();
  }
  consumeAgentRules();
});

onActivated(() => {
  consumeAgentRules();
});

watch(
  [() => store.marketplace, () => store.month],
  ([newMkp, newMonth], [oldMkp, oldMonth]) => {
    if (store.selectedCount > 0 || store.hasFilters) {
      ElMessageBox.confirm(
        "切换市场或月份将清空当前筛选和选中，是否继续？",
        "确认切换",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        },
      )
        .then(() => {
          store.selectedBsrId = "";
          store.selectedNodeId = "";
          store.searchKeyword = "";
          store.competitorResults = [];
          store.selectedProducts = new Set();
          store.initData();
        })
        .catch(() => {
          // 用户取消 — 回滚市场/月份到旧值
          store.marketplace = oldMkp;
          store.month = oldMonth;
        });
    } else {
      store.selectedBsrId = "";
      store.selectedNodeId = "";
      store.searchKeyword = "";
      store.competitorResults = [];
      store.selectedProducts = new Set();
      store.initData();
    }
  },
);

// 搜索输入 300ms 防抖
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(
  () => store.searchKeyword,
  (val) => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      store.searchByKeyword(val);
    }, 300);
  },
);
</script>

<script lang="ts">
export default { name: "ProductLineSelection" };
</script>

<style lang="scss" scoped>
@use "@/styles/variables.scss" as *;

// 抽屉内分区（drawer append-to-body，顶层选择器匹配 slotted 元素）
.fd-section {
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid #f0f2f5;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .fd-label {
    font-weight: 600;
    font-size: 14px;
    color: $text-primary;
    margin-bottom: 10px;
  }
}

.selection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- 顶部工具栏 ----
.topbar {
  height: 48px;
  min-height: 48px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;

  .tb-brand {
    font-size: 13px;
    font-weight: 600;
    color: $text-secondary;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .tb-brand span {
    color: $text-primary;
  }
  .tb-spacer {
    flex: 1;
  }
}

.tb-select {
  display: flex;
  position: relative;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
}

.batch-meta {
  font-size: 11px;
  color: $text-tertiary;
  font-family: $font-family-mono;
  white-space: nowrap;
}

.mobile-tree-btn {
  display: none;
  padding: 6px 12px;
  background: $bg-hover;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  font-size: 13px;
  color: $text-secondary;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    color: $text-primary;
    border-color: $primary-color;
  }
}

// ---- 树折叠相关 ----
.tree-wrapper {
  display: flex;
  position: relative;
  flex-shrink: 0;
  transition: width 0.2s ease;
  min-width: 0;

  &.collapsed {
    width: 0 !important;
    > * {
      display: none;
    }
    > .tree-fold-btn {
      display: flex;
    }
  }
}

.tree-fold-btn {
  position: absolute;
  right: -14px;
  top: 20px;
  z-index: 10;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid $border-color;
  background: $bg-color;
  box-shadow: $shadow-sm;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-secondary;
  font-size: 13px;
  transition: all $transition-fast;
  padding: 0;

  &:hover {
    background: $bg-hover;
    color: $primary-color;
    border-color: $primary-color;
    box-shadow: $shadow-md;
  }
}

.l2-fold-btn.l2-fold-btn {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-tertiary;
  font-size: 16px;
  border-radius: $radius-sm;
  flex-shrink: 0;

  &:hover {
    background: $bg-hover;
    color: $text-primary;
  }
}

.l2-panel {
  overflow: hidden;
  min-height: min-content;
  transition:
    max-height 0.25s ease,
    opacity 0.2s ease;
  max-height: 2000px;
  opacity: 1;
  min-height: min-content; // 防止 flex item 被 overflow:hidden 压缩到 0
}
.l2-panel.collapsed {
  max-height: 0 !important;
  min-height: 0 !important;
  min-height: 0 !important; // 折叠时必须允许压缩到 0
  opacity: 0;
  padding: 0;
  border-bottom: none;
}

// ---- 全局筛选栏 ----
.global-filterbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  flex-wrap: wrap;
  flex-shrink: 0;
}

// ---- 统一筛选入口栏 ----
.unified-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 16px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;

  .filter-count-badge {
    margin-left: 2px;
  }

  .filter-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

// ---- 抽屉内分区（drawer append-to-body，需顶层匹配 slotted 元素，见 :global 段）----
.method-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid #d8e8df;
  border-radius: 12px;
  background: linear-gradient(135deg, #f3fbf5 0%, #eef7ff 100%);

  &__body {
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: #1f2f25;
  }

  &__desc {
    margin-top: 6px;
    color: #52645a;
    line-height: 1.6;
    font-size: 13px;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    color: #3b8060;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }
}

// ---- 合格规则 + 预设栏 ----
.rule-filterbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

// ---- 郑总数据完整性提示 ----
.completeness-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #fef3c7;
  border-bottom: 1px solid #fcd34d;
  flex-shrink: 0;

  .cb-icon {
    color: $warning-color;
    font-size: 18px;
  }
  .cb-text {
    flex: 1;
    font-size: 13px;
    color: $text-primary;
    b {
      color: $warning-color;
    }
  }
}

// ---- 工作区 ----
.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

// 品线树宽度由 CSS 变量控制
:deep(.tree-panel) {
  width: var(--tree-width, 280px);
  flex-shrink: 0;
}

.tree-resize {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background $transition-fast;

  &:hover {
    background: $primary-color;
  }

  @media (max-width: 900px) {
    display: none;
  }
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: auto;
}

// ---- 类目导航条 ----
.category-header {
  display: flex;
  position: relative;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid $border-color;
  font-size: 14px;
  font-weight: 600;
  background: $bg-color;
}
.cat-l1 {
  color: $text-secondary;
  &.active {
    color: $primary-color;
    border: 1px solid var(--el-color-primary, #b45309);
    background: rgba(180, 83, 9, 0.04);
    padding: 4px 10px;
    border-radius: 6px;
  }
  &.clickable {
    cursor: pointer;
    &:hover {
      color: $primary-color;
      text-decoration: underline;
    }
  }
}
.cat-sep {
  color: $text-tertiary;
}
.cat-l2 {
  color: $text-secondary;
}
.cat-l2.active {
  color: $primary-color;
  background: rgba(180, 83, 9, 0.04);
  border-radius: 4px;
  padding: 4px 8px;
}
.cat-hint {
  margin-left: auto;
  font-size: 11px;
  color: $text-tertiary;
}

// ---- L2 子类面板 ----
.l2-panel {
  background: $bg-color;
  border-bottom: 1px solid $border-color;
}

.l2-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  border-bottom: 1px solid $border-color;
}

.l2-count {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  font-family: $font-family-mono;
}

.l2-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.l2-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  cursor: pointer;
  transition: all $transition-fast;
  border-left: 3px solid transparent;

  &:hover {
    background: $bg-hover;
  }

  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.04);
    border-left-color: $primary-color;
  }
}

.l2-item-name {
  flex: 1;
  font-size: 13px;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .l2-item.active & {
    color: $primary-color;
    font-weight: 600;
  }
}

.l2-item-count {
  font-size: 11px;
  color: $text-tertiary;
  white-space: nowrap;
  font-family: $font-family-mono;
  flex-shrink: 0;
}

.l2-ai-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  margin-left: 2px;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.15s;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }
}

// 移动端: L2 搜索框和列表可触摸滚动
@media (max-width: 900px) {
  .l2-list {
    max-height: 200px;
  }
}

// ---- 操作栏 ----
.action-bar {
  display: flex;
  position: relative;
  gap: 12px;
  align-items: center;
  padding: 12px 20px;
  background: $bg-color;
  border-top: 1px solid $border-color;

  .filter-tags {
    flex: 1;
    display: flex;
    position: relative;
    flex-wrap: wrap;
    gap: 6px;
  }

  .filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba($primary-color, 0.08);
    color: $primary-color;
    border-radius: $radius-sm;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid rgba($primary-color, 0.15);
  }

  .filter-tag .close {
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    opacity: 0.6;
    &:hover {
      opacity: 1;
    }
  }

  .filter-hint {
    font-size: 12px;
    color: $text-tertiary;
    font-style: italic;
  }
}

// ---- 底部操作栏 ----
.bottom-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  background: $bg-color;
  border-top: 1px solid $border-color;
  font-size: 13px;
  color: $text-secondary;
  z-index: 10;
}

// ---- 响应式 ----
.desktop-only.desktop-only {
  @media (max-width: 900px) {
    display: none;
  }
}

.mobile-only.mobile-only {
  @media (min-width: 901px) {
    display: none;
  }
}

@media (max-width: 900px) {
  .mobile-tree-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .tb-select {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .tb-select .el-select {
    min-width: 60px;
    width: auto !important;
  }
  .tb-select .el-select__wrapper {
    min-width: 54px;
  }
  .tb-select:nth-child(3) .el-select {
    min-width: 120px;
  }

  .batch-meta {
    display: none;
  }

  .topbar .el-input {
    width: 140px !important;
  }
  .topbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .bottom-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px;
  }
}

// ---- 空白状态引导 ----
.empty-guide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
  user-select: none;
}

.empty-guide-icon {
  font-size: 48px;
  color: $text-tertiary;
  opacity: 0.5;
}

.empty-guide-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
}

.empty-guide-desc {
  font-size: 14px;
  color: $text-tertiary;
  line-height: 1.7;
  margin: 0;
}

.empty-guide-steps {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: $text-secondary;
  padding: 8px 16px;
  background: $bg-color;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
}

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: $primary-color;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.step-arrow {
  color: $text-tertiary;
  font-size: 16px;
}
</style>
