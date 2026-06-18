import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { getBatches, getTree } from "@/api/product-line";
import { competitorApi } from "@/api/competitor";
import { selectionApi } from "@/api/selection";
import type {
  ProductLineGroup,
  BatchInfo,
  FilterType,
  TreeGroup,
} from "@/types/productLine";
import type { CompetitorProductRaw, QualifyRule } from "@/api/competitor";
import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";

function emptyRangeFilter(): RangeFilterValue {
  return {
    priceMin: null,
    priceMax: null,
    unitsMin: null,
    unitsMax: null,
    listingDaysMin: null,
    listingDaysMax: null,
    bsrMax: null,
    weightMax: null,
    variantCountMax: null,
    fulfillment: [],
    createdWeeks: [],
    category: [],
    grade: [],
    listingPreset: null,
  };
}

interface SubCategoryItem {
  nodeId: string | number;
  nodeName?: string;
  nodeFullPath?: string;
  productCount?: number;
  isZheng?: boolean;
}

interface FilterCondition {
  id: string;
  type: FilterType;
  label: string;
  value: string;
  source: string;
}

export const useProductLineSelectionStore = defineStore(
  "productLineSelection",
  () => {
    // ---- 状态 ----
    const marketplace = ref("UK");
    const now = new Date();
    const month = ref(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    );
    const batchVersion = ref("v3");
    const selectedBatchId = ref("");
    const selectedNodeId = ref("");
    const selectedNodeName = ref("");
    const selectedNodeHealth = ref<string>("healthy");
    const selectedBsrId = ref(""); // L1 大类 ID
    const selectedBsrName = ref(""); // L1 大类名称（面包屑用）

    const activeFilters = ref<FilterCondition[]>([]);
    const resultsVisible = ref(false);
    const treeLoading = ref(false);
    const competitorLoading = ref(false);

    const batchLoading = ref(false);
    const exportLoading = ref(false);

    const competitorResults = ref<CompetitorProductRaw[]>([]);
    const competitorTotal = ref(0);
    const competitorPage = ref(1);
    const competitorPageSize = ref(60);

    const treeData = ref<TreeGroup[]>([]);
    const batches = ref<BatchInfo[]>([]);

    // ---- 基础筛选状态（L1/L2 通用） ----
    const searchKeyword = ref("");
    const searchSellerName = ref("");
    const searchBrand = ref("");
    const selectedProducts = ref(new Set<string>());
    const sortBy = ref("");

    // ---- 统一区间筛选面板（与新品榜一致）----
    const rangeFilter = ref<RangeFilterValue>(emptyRangeFilter());

    // ---- 灵活合格规则（已由面板的上架天数/月销区间承担，默认空=不限）----
    const qualifyRules = ref<QualifyRule[]>([]);

    // 郑总盘子实际使用的最新批次日期（由 /tree 响应回填，仅展示用）
    const zhengBatchDate = ref("");

    // ---- 郑总店铺数据完整性 ----
    interface MissingSeller {
      sellerName: string;
      storeUrl?: string | null;
    }
    const completeness = ref<{
      totalSellers: number;
      fetchedSellers: number;
      missingSellers: MissingSeller[];
      complete: boolean;
    } | null>(null);

    async function fetchCompleteness() {
      try {
        const res = await competitorApi.getDengZongShopCompleteness(
          marketplace.value,
        );
        completeness.value = res?.data ?? null;
      } catch {
        completeness.value = null;
      }
    }

    // ---- 计算 ----
    const filterCount = computed(() => activeFilters.value.length);
    const hasFilters = computed(() => activeFilters.value.length > 0);
    const selectedBatchInfo = computed(
      () =>
        batches.value.find((b) => b.batchId === selectedBatchId.value) ?? null,
    );

    const selectedProductList = computed(() =>
      Array.from(selectedProducts.value),
    );
    const selectedCount = computed(() => selectedProducts.value.size);

    // 当前选中 L1 的子类列表（供右侧 L2 面板使用）
    const currentSubCategories = computed(() => {
      if (!selectedBsrId.value) return [];
      const group = treeData.value.find((g) => g.id === selectedBsrId.value);
      return group?.children ?? [];
    });

    // ---- 数据初始化 ----
    async function initData() {
      // 切换站点/月份时重置区间筛选（周批次由面板按站点重新拉取并默认最新）
      rangeFilter.value = emptyRangeFilter();
      await Promise.all([fetchTree(), fetchBatchesList(), fetchCompleteness()]);

      // 默认加载第一个大类的商品
      if (treeData.value.length > 0 && !selectedBsrId.value) {
        const first = treeData.value[0];
        selectCategory(first.id, first.name);
      }
    }

    async function fetchTree() {
      treeLoading.value = true;
      try {
        const mkp = marketplace.value;
        const mo = month.value.replace("-", "");
        const res = await getTree(mkp, mo);
        if (res?.data?.zhengBatchDate)
          zhengBatchDate.value = res.data.zhengBatchDate;
        const raw = res?.data?.productLines as ProductLineGroup[] | undefined;
        if (!raw) {
          treeData.value = [];
          return;
        }

        treeData.value = raw.map((g: ProductLineGroup) => {
          // bsrName 可能缺失，从第一个子类的 nodeFullPath 提取 L1 名称
          const l1Name =
            g.bsrName ||
            g.subCategories?.[0]?.nodeFullPath?.split(":")[0] ||
            g.bsrId;
          return {
            id: g.bsrId,
            name: l1Name,
            icon: "📦",
            expanded: false,
            isZheng: g.isZheng,
            children: (g.subCategories || []).map((sc: SubCategoryItem) => ({
              id: `${g.bsrId}_${sc.nodeId}`,
              name: sc.nodeName,
              nodeId: Number(sc.nodeId),
              status: "analyzed" as const,
              productCount: sc.productCount,
              isZheng: sc.isZheng,
            })),
          };
        });
      } catch (err) {
        ElMessage.error("品线树加载失败，请检查网络或刷新重试");
      } finally {
        treeLoading.value = false;
      }
    }

    async function fetchBatchesList() {
      try {
        const res = await getBatches(marketplace.value);
        const raw = res?.data?.batches as BatchInfo[] | undefined;
        if (raw) {
          batches.value = raw;
          if (raw.length > 0 && !selectedBatchId.value) {
            selectedBatchId.value = raw[0].batchId;
          }
        }
      } catch (err) {
        ElMessage.error("批次列表加载失败");
      }
    }

    // ---- 筛选方法 ----
    let _filterSeq = 0;
    let _productsReqId = 0; // R3.2: loadProducts 请求去重
    function addFilter(
      type: FilterType,
      label: string,
      value: string,
      source: string,
    ) {
      const exists = activeFilters.value.find(
        (f) => f.value === value && f.type === type && f.source === source,
      );
      if (exists) return;
      activeFilters.value.push({
        id: `f-${++_filterSeq}`,
        type,
        label,
        value,
        source,
      });
      searchCompetitors();
    }

    function removeFilter(id: string) {
      activeFilters.value = activeFilters.value.filter((f) => f.id !== id);
      if (selectedNodeId.value || selectedBsrId.value) searchCompetitors();
    }

    function removeFilterByLabel(label: string) {
      activeFilters.value = activeFilters.value.filter(
        (f) => !f.label.startsWith(label),
      );
      if (selectedNodeId.value || selectedBsrId.value) searchCompetitors();
    }

    function clearFilters() {
      activeFilters.value = [];
    }

    // ---- 筛选标签常量（R6.3: 去魔法字符串）----
    const FILTER_LABEL = {
      carrier: (name: string) => `载体:${name}`,
      element: (name: string) => name,
      comboItem: (name: string) => `组合:${name}`,
    };

    function clearBasicFilters() {
      searchSellerName.value = "";
      searchBrand.value = "";
    }

    // ---- 通用商品加载 ----
    async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
      const reqId = ++_productsReqId; // R3.2: 请求去重
      competitorLoading.value = true;
      resultsVisible.value = true;
      try {
        const params: Record<string, any> = {
          marketplace: marketplace.value,
          page: competitorPage.value,
          size: competitorPageSize.value,
        };
        // BUG-1 FIX: 拆分排序值 "bsr_asc" → sortBy="bsr" + sortOrder="asc"
        if (sortBy.value) {
          const [sortField, sortDir] = sortBy.value.split("_");
          if (sortField) params.sortBy = sortField;
          if (sortDir) params.sortOrder = sortDir;
        }
        if (filter.bsrId) params.bsrId = filter.bsrId;
        if (filter.nodeId) params.nodeId = filter.nodeId;
        if (searchKeyword.value) params.title = searchKeyword.value;
        if (searchSellerName.value) params.sellerName = searchSellerName.value;
        if (searchBrand.value) params.brand = searchBrand.value;
        // 统一面板区间映射（价格/销量/上架天数/BSR/重量/变体数/配送/评级/入库周）
        const rf = rangeFilter.value;
        if (rf.priceMin != null) params.priceMin = rf.priceMin;
        if (rf.priceMax != null) params.priceMax = rf.priceMax;
        if (rf.unitsMin != null) params.unitsMin = rf.unitsMin;
        if (rf.unitsMax != null) params.unitsMax = rf.unitsMax;
        if (rf.listingDaysMin != null)
          params.listingDaysMin = rf.listingDaysMin;
        if (rf.listingDaysMax != null)
          params.listingDaysMax = rf.listingDaysMax;
        if (rf.bsrMax != null) params.bsrMax = rf.bsrMax;
        if (rf.weightMax != null) params.weightMax = rf.weightMax;
        if (rf.variantCountMax != null)
          params.maxVariantCount = rf.variantCountMax;
        if (rf.fulfillment?.length > 0) params.fulfillment = rf.fulfillment;
        if (rf.grade?.length > 0) params.grade = rf.grade.join(",");
        if (rf.createdWeeks?.length > 0) {
          params.createdWeeks = [...rf.createdWeeks].sort();
        }

        // element/carrier/keyword/combo filters
        const elementFilters = activeFilters.value.filter(
          (f) => f.type === "element",
        );
        const carrierFilters = activeFilters.value.filter(
          (f) => f.type === "carrier",
        );
        const keywordFilters = activeFilters.value.filter(
          (f) => f.type === "keyword",
        );
        const comboFilters = activeFilters.value.filter(
          (f) => f.type === "combo",
        );
        let kw = "";
        if (elementFilters.length > 0)
          kw = elementFilters.map((f) => f.value).join(" ");
        if (carrierFilters.length > 0)
          kw = kw
            ? `${kw} ${carrierFilters.map((f) => f.value).join(" ")}`
            : carrierFilters.map((f) => f.value).join(" ");
        if (keywordFilters.length > 0) {
          const kwStr = keywordFilters.map((f) => f.value).join(" ");
          params.title = params.title ? `${params.title} ${kwStr}` : kwStr;
        }
        if (comboFilters.length > 0)
          kw = kw
            ? `${kw} ${comboFilters.map((f) => f.value).join(" ")}`
            : comboFilters.map((f) => f.value).join(" ");
        if (kw) params.keywords = kw;

        // 灵活合格规则：非空才下发（空=不按规则过滤，展示整个批次）
        if (qualifyRules.value.length > 0)
          params.qualifyRules = qualifyRules.value;

        const res = await competitorApi.getList({
          ...params,
          groupByParent: false,
        });
        if (reqId !== _productsReqId) return; // R3.2: 过时请求丢弃
        competitorResults.value = (res?.data?.list ??
          []) as CompetitorProductRaw[];
        competitorTotal.value = res?.data?.total ?? 0;
      } catch (err) {
        if (reqId !== _productsReqId) return; // R3.2: 过时请求不弹错
        ElMessage.error("商品数据加载失败，请重试");
      } finally {
        if (reqId === _productsReqId) competitorLoading.value = false; // R3.2: 仅最新请求控制 loading
      }
    }

    // ---- L1 大类点击 ----
    async function selectCategory(bsrId: string, name: string) {
      selectedNodeId.value = "";
      selectedNodeName.value = "";
      selectedNodeHealth.value = "healthy";
      selectedBsrId.value = bsrId;
      selectedBsrName.value = name;
      clearFilters();
      clearBasicFilters();
      closeResults();
      competitorPage.value = 1;
      sortBy.value = "";
      searchKeyword.value = "";
      selectedProducts.value = new Set();
      await loadProducts({ bsrId });
      if (competitorResults.value.length === 0) {
        ElMessage.info("该大类下暂无商品数据");
      }
    }

    // ---- L2 小类点击（取代 selectNode） ----
    async function selectSubCategory(
      nodeId: number,
      name: string,
      bsrId: string,
      health?: string,
    ) {
      selectedBsrId.value = bsrId;
      selectedNodeId.value = String(nodeId);
      selectedNodeName.value = name;
      selectedNodeHealth.value = health || "healthy";
      clearFilters();
      clearBasicFilters();
      closeResults();
      competitorPage.value = 1;
      sortBy.value = "";
      searchKeyword.value = "";
      selectedProducts.value = new Set();
      await loadProducts({ nodeId });
    }

    // ---- 竞品搜索 ----
    // 接受可选 keyword 参数避免 searchByKeyword 调用时对 searchKeyword ref 的隐式依赖
    async function searchCompetitors(keyword?: string) {
      if (keyword !== undefined) {
        searchKeyword.value = keyword;
      }
      competitorPage.value = 1;
      if (
        !hasFilters.value &&
        !selectedNodeId.value &&
        !selectedBsrId.value &&
        !searchKeyword.value
      )
        return;
      const filter: Record<string, any> = {};
      if (selectedNodeId.value) filter.nodeId = Number(selectedNodeId.value);
      else if (selectedBsrId.value) filter.bsrId = selectedBsrId.value;
      else return;
      await loadProducts(filter);
    }

    async function goToPage(page: number) {
      competitorPage.value = page;
      const filter: Record<string, any> = {};
      if (selectedNodeId.value) filter.nodeId = Number(selectedNodeId.value);
      else if (selectedBsrId.value) filter.bsrId = selectedBsrId.value;
      else return;
      await loadProducts(filter);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function openResults() {
      resultsVisible.value = true;
    }
    function closeResults() {
      resultsVisible.value = false;
    }

    // ---- 排序 ----
    function setSortBy(val: string) {
      sortBy.value = val;
      if (selectedNodeId.value || selectedBsrId.value) {
        loadProducts({
          nodeId: selectedNodeId.value
            ? Number(selectedNodeId.value)
            : undefined,
          bsrId: selectedBsrId.value || undefined,
        });
      }
    }

    // ---- 选品操作 ----

    /**
     * 切换商品选中状态
     */
    function toggleProductSelection(asin: string, selected: boolean) {
      const set = selectedProducts.value;
      if (selected) {
        set.add(asin);
      } else {
        set.delete(asin);
      }
      // 触发响应式更新
      selectedProducts.value = new Set(set);
    }

    /**
     * 全选当前页商品
     */
    function selectAllOnPage(products: CompetitorProductRaw[]) {
      const set = new Set(selectedProducts.value);
      for (const p of products) {
        if (p.asin) set.add(p.asin);
      }
      selectedProducts.value = set;
    }

    /**
     * 清空所有选中商品
     */
    function clearSelection() {
      selectedProducts.value = new Set();
    }

    /**
     * 批量加入选品
     */
    async function batchAddToSelection() {
      if (batchLoading.value) return;
      batchLoading.value = true;
      const products = Array.from(selectedProducts.value);
      if (products.length === 0) {
        batchLoading.value = false;
        return;
      }

      try {
        await selectionApi.create({
          products,
          marketplace: marketplace.value,
          nodeId: selectedNodeId.value || undefined,
          bsrId: selectedBsrId.value || undefined,
        });
        // 清空已选中
        selectedProducts.value = new Set();
        ElMessage.success(`已加入 ${products.length} 件商品到选品库`);
      } catch (err) {
        ElMessage.error("批量加入选品失败，请重试");
      } finally {
        batchLoading.value = false;
      }
    }

    /**
     * 关键词搜索：设置 searchKeyword 并触发搜索
     */
    async function searchByKeyword(keyword: string) {
      await searchCompetitors(keyword);
    }

    /**
     * 应用基础筛选（卖家/品牌/价格）并重新搜索
     */
    async function applyBasicFilters() {
      competitorPage.value = 1;
      await searchCompetitors();
    }

    /**
     * 应用统一区间筛选面板并重新搜索当前选中类目
     */
    async function applyRangeFilter(val: RangeFilterValue) {
      rangeFilter.value = val;
      competitorPage.value = 1;
      if (selectedNodeId.value || selectedBsrId.value) {
        await loadProducts({
          nodeId: selectedNodeId.value
            ? Number(selectedNodeId.value)
            : undefined,
          bsrId: selectedBsrId.value || undefined,
        });
      }
    }

    /**
     * 应用合格规则并重新搜索当前选中类目
     */
    async function applyQualifyRules(rules: QualifyRule[]) {
      qualifyRules.value = rules;
      competitorPage.value = 1;
      if (selectedNodeId.value || selectedBsrId.value) {
        await loadProducts({
          nodeId: selectedNodeId.value
            ? Number(selectedNodeId.value)
            : undefined,
          bsrId: selectedBsrId.value || undefined,
        });
      }
    }

    /**
     * 导出选中 ASIN 列表到 Excel
     */
    async function exportSelectedExcel() {
      if (exportLoading.value) return;
      exportLoading.value = true;
      const products = Array.from(selectedProducts.value);
      if (products.length === 0) {
        exportLoading.value = false;
        return;
      }

      try {
        const blob = await selectionApi.exportSelectedAsins(products);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `selected-asins-${Date.now()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        ElMessage.success(`已导出 ${products.length} 条 ASIN`);
      } catch (err) {
        ElMessage.error("导出 Excel 失败，请重试");
      } finally {
        exportLoading.value = false;
      }
    }

    function setMarketplace(val: string) {
      marketplace.value = val;
    }
    function setMonth(val: string) {
      month.value = val;
    }
    function setVersion(val: string) {
      batchVersion.value = val;
    }

    // ---- AI 选品助手：套用筛选（全局悬浮卡 / 跨页消费调用） ----

    function applyAiFilterRules(rules: QualifyRule[]) {
      qualifyRules.value = rules;
      competitorPage.value = 1;
      if (selectedNodeId.value || selectedBsrId.value) {
        loadProducts({
          nodeId: selectedNodeId.value
            ? Number(selectedNodeId.value)
            : undefined,
          bsrId: selectedBsrId.value || undefined,
        });
      }
    }

    return {
      marketplace,
      month,
      batchVersion,
      selectedNodeId,
      selectedNodeName,
      selectedNodeHealth,
      selectedBsrId,
      selectedBsrName,
      selectedBatchId,
      selectedBatchInfo,
      activeFilters,
      filterCount,
      hasFilters,
      resultsVisible,
      treeLoading,
      competitorLoading,
      treeData,
      batches,
      currentSubCategories,
      competitorResults,
      competitorTotal,
      competitorPage,
      competitorPageSize,
      goToPage,
      batchLoading,
      exportLoading,
      addFilter,
      removeFilter,
      removeFilterByLabel,
      clearFilters,
      selectCategory,
      selectSubCategory,
      openResults,
      closeResults,
      searchCompetitors,
      initData,
      fetchTree,
      fetchBatchesList,
      loadProducts,
      FILTER_LABEL,
      setMarketplace,
      setMonth,
      setVersion,
      // ---- 新增状态 ----
      searchKeyword,
      searchSellerName,
      searchBrand,
      selectedProducts,
      selectedProductList,
      selectedCount,
      sortBy,
      setSortBy,
      // ---- 合格规则 ----
      qualifyRules,
      applyQualifyRules,
      // ---- 统一区间筛选面板 ----
      rangeFilter,
      applyRangeFilter,
      // ---- 新增方法 ----
      toggleProductSelection,
      selectAllOnPage,
      clearSelection,
      batchAddToSelection,
      searchByKeyword,
      exportSelectedExcel,
      clearBasicFilters,
      applyBasicFilters,
      zhengBatchDate,
      completeness,
      fetchCompleteness,
      // AI 选品助手
      agentDrawerVisible,
      agentNodeId,
      agentNodeName,
      openAgentDrawer,
      closeAgentDrawer,
      applyAiFilterRules,
    };
  },
);
