import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { getTree } from "@/api/product-line";
import { competitorApi } from "@/api/competitor";
import { selectionApi } from "@/api/selection";
import type {
  ProductLineGroup,
  FilterType,
  TreeGroup,
} from "@/types/productLine";
import type { CompetitorProductRaw, QualifyRule } from "@/api/competitor";
import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";
import { createEmptyRangeFilter } from "@/utils/rangeFilter";
import {
  buildSelectionFilterIntent,
  buildSelectionQueryPlan,
  type SelectionScene,
  type SelectionFilterState,
  type SelectionQueryPlan,
} from "@/views/AllSelection/composables/queryPlan";
import { resolveSelectionQueryPlan } from "@/views/AllSelection/composables/queryRuntime";
import { downloadAllResultsCsv } from "@/views/AllSelection/composables/selectionCsv";
import {
  mergeSelectionResults,
  type SelectionSourceTag,
} from "./mergeSelection";

function emptyRangeFilter(): RangeFilterValue {
  return createEmptyRangeFilter();
}

interface SubCategoryItem {
  nodeId: string | number;
  nodeName?: string;
  nodeFullPath?: string;
  productCount?: number;
  methodHit?: boolean;
  methodHitCount?: number;
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
    // 数据源:all=合并新品榜+店铺(默认) / new=仅新品榜 / shop=仅店铺
    const dataSource = ref<"all" | "new" | "shop">("all");
    const batchVersion = ref("v3");
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
    const currentQueryPlan = ref<SelectionQueryPlan | null>(null);
    const competitorTotal = ref(0);
    const competitorPage = ref(1);
    const competitorPageSize = ref(60);

    const treeData = ref<TreeGroup[]>([]);

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
    const activeMethodCard = ref<{
      id: "M01" | "M02" | "M03";
      name: string;
    } | null>(null);

    // 方法卡视角使用的证据批次；M02 时为非标同行盘子最新批次。
    const zhengBatchDate = ref("");

    // ---- 非标店铺数据完整性 ----
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

    /** 当前选中的批次日期数组(单天 yyyy-MM-dd);为空表示"最新批次",由后端兜底。 */
    function currentBatchDates(): string[] {
      return [...(rangeFilter.value.createdWeeks ?? [])];
    }

    // ---- 数据初始化 ----
    async function initData() {
      // 切换站点时重置区间筛选（批次由面板按站点重新拉取并默认最新）
      rangeFilter.value = emptyRangeFilter();
      await Promise.all([fetchTree(), refreshMethodEvidence()]);

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
        // 品线树跟随批次 + 数据源 + 方法卡(三者同步):
        //  - methodId + dataSource 组合:后端对每个源按 M01/M03 硬筛口径重算 productCount,
        //    保证树数量=列表数量;数据源不再被方法卡屏蔽,与页面选择一致。
        const res = await getTree(mkp, {
          batchDates: currentBatchDates(),
          methodId: activeMethodCard.value?.id,
          dataSource: dataSource.value,
        });
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
            children: (g.subCategories || []).map((sc: SubCategoryItem) => ({
              id: `${g.bsrId}_${sc.nodeId}`,
              name: sc.nodeName,
              nodeId: Number(sc.nodeId),
              status: "analyzed" as const,
              productCount: sc.productCount,
            })),
          };
        });
      } catch (err) {
        ElMessage.error("品线树加载失败，请检查网络或刷新重试");
      } finally {
        treeLoading.value = false;
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

    async function refreshMethodEvidence() {
      // 当前品线选品页仅保留 M01 / M03,均无需非标证据完整性校验
      completeness.value = null;
    }

    async function reloadCurrentProducts() {
      if (!selectedNodeId.value && !selectedBsrId.value) return;
      await loadProducts({
        nodeId: selectedNodeId.value ? Number(selectedNodeId.value) : undefined,
        bsrId: selectedBsrId.value || undefined,
      });
    }

    // 未选中大类时自动选第一个,让方法卡首次应用能出商品数据
    function ensureCategorySelected() {
      if (
        !selectedBsrId.value &&
        !selectedNodeId.value &&
        treeData.value.length > 0
      ) {
        const first = treeData.value[0];
        selectCategory(first.id, first.name);
      }
    }

    async function applyM01MethodCard() {
      activeMethodCard.value = { id: "M01", name: "新品榜加速法" };
      // M01=规则,叠加在当前 dataSource(新品榜/店铺/全部)上;不重置数据源,不需要非标证据批次
      zhengBatchDate.value = "";
      completeness.value = null;
      await fetchTree();
      ensureCategorySelected();
      await reloadCurrentProducts();
    }

    async function applyM03MethodCard() {
      activeMethodCard.value = { id: "M03", name: "FBM 自发货简单道" };
      // M03 走 clean 表叠加 FBM 规则,不需要非标证据批次
      zhengBatchDate.value = "";
      completeness.value = null;
      await fetchTree();
      ensureCategorySelected();
      await reloadCurrentProducts();
    }

    async function clearMethodCard() {
      activeMethodCard.value = null;
      zhengBatchDate.value = "";
      completeness.value = null;
      await fetchTree();
      await reloadCurrentProducts();
    }

    // ---- 通用商品加载 ----
    async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
      const reqId = ++_productsReqId; // R3.2: 请求去重
      competitorLoading.value = true;
      resultsVisible.value = true;
      try {
        let sortField = "score";
        let sortOrder: "desc" | "asc" = "desc";
        if (sortBy.value) {
          const [nextSortField, nextSortDir] = sortBy.value.split("_");
          if (nextSortField) sortField = nextSortField;
          if (nextSortDir === "asc" || nextSortDir === "desc") {
            sortOrder = nextSortDir;
          }
        }

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
        let keywordTitle = searchKeyword.value;
        if (elementFilters.length > 0)
          kw = elementFilters.map((f) => f.value).join(" ");
        if (carrierFilters.length > 0)
          kw = kw
            ? `${kw} ${carrierFilters.map((f) => f.value).join(" ")}`
            : carrierFilters.map((f) => f.value).join(" ");
        if (keywordFilters.length > 0) {
          const kwStr = keywordFilters.map((f) => f.value).join(" ");
          keywordTitle = keywordTitle ? `${keywordTitle} ${kwStr}` : kwStr;
        }
        if (comboFilters.length > 0)
          kw = kw
            ? `${kw} ${comboFilters.map((f) => f.value).join(" ")}`
            : comboFilters.map((f) => f.value).join(" ");

        // 构建某个 scene 的查询意图,共享上面的筛选/排序/关键词准备。
        const makeIntent = (scene: SelectionScene) =>
          buildSelectionFilterIntent({
            scene,
            methodId: activeMethodCard.value?.id ?? null,
            queryParams: undefined,
            activeFilters: {
              country: marketplace.value,
              sellerSelect: searchSellerName.value,
              category: [],
              sortField,
              sortOrder,
              range: {
                ...rangeFilter.value,
                createdWeeks: [...(rangeFilter.value.createdWeeks ?? [])].sort(),
              },
            } satisfies SelectionFilterState,
            useCleanTable: true,
            qualifyRules: qualifyRules.value,
            qualifyRulesMode: "always",
            overrides: {
              marketplace: marketplace.value,
              bsrId: filter.bsrId,
              nodeId: filter.nodeId,
              brand: searchBrand.value,
              keywords: kw || undefined,
              groupByParent: false,
              title: keywordTitle || undefined,
              sellerName: searchSellerName.value || undefined,
            },
          });

        const resolveScene = async (scene: SelectionScene) => {
          const intent = makeIntent(scene);
          const plan = buildSelectionQueryPlan({
            intent,
            page: competitorPage.value,
            size: competitorPageSize.value,
          });
          return resolveSelectionQueryPlan(plan);
        };

        // 打来源标签,供合并去重与卡片角标使用。
        const tag = (list: any[], source: SelectionSourceTag) =>
          (list ?? []).map((item) => ({ ...item, dataSource: source }));

        let mergedList: CompetitorProductRaw[];
        let total: number;
        let primaryPlan: SelectionQueryPlan;

        if (activeMethodCard.value) {
          // 方法卡=规则,数据源=表。规则叠加在当前数据源上,与页面数据源选择同步:
          //   新品榜源→M01 走 scene"new"、M03 走 scene"fbm"(competitor_products_clean);
          //   店铺源→scene"reference"+methodId(路由到 shop_products 并套用同口径硬筛);
          //   全部→两源并行,各自套 methodId,再按排序键归并去重。
          const newScene: SelectionScene =
            activeMethodCard.value.id === "M03" ? "fbm" : "new";
          if (dataSource.value === "new") {
            const resolved = await resolveScene(newScene);
            if (reqId !== _productsReqId) return;
            primaryPlan = resolved.plan;
            mergedList = tag(
              resolved.result.list,
              "new",
            ) as CompetitorProductRaw[];
            total = resolved.result.total ?? 0;
          } else if (dataSource.value === "shop") {
            const resolved = await resolveScene("reference");
            if (reqId !== _productsReqId) return;
            primaryPlan = resolved.plan;
            mergedList = tag(
              resolved.result.list,
              "shop",
            ) as CompetitorProductRaw[];
            total = resolved.result.total ?? 0;
          } else {
            // all: 新品榜(方法卡 scene) + 店铺(reference+methodId) 并行合并。
            const [newRes, shopRes] = await Promise.all([
              resolveScene(newScene),
              resolveScene("reference"),
            ]);
            if (reqId !== _productsReqId) return;
            primaryPlan = newRes.plan;
            mergedList = mergeSelectionResults(
              tag(newRes.result.list, "new"),
              tag(shopRes.result.list, "shop"),
              { sortField, sortOrder },
            );
            total = (newRes.result.total ?? 0) + (shopRes.result.total ?? 0);
          }
        } else if (dataSource.value === "new") {
          const resolved = await resolveScene("all");
          if (reqId !== _productsReqId) return;
          primaryPlan = resolved.plan;
          mergedList = tag(
            resolved.result.list,
            "new",
          ) as CompetitorProductRaw[];
          total = resolved.result.total ?? 0;
        } else if (dataSource.value === "shop") {
          const resolved = await resolveScene("reference");
          if (reqId !== _productsReqId) return;
          primaryPlan = resolved.plan;
          mergedList = tag(
            resolved.result.list,
            "shop",
          ) as CompetitorProductRaw[];
          total = resolved.result.total ?? 0;
        } else {
          // all: 并行查两源,合并当前页并按排序键归并去重。
          const [newRes, shopRes] = await Promise.all([
            resolveScene("all"),
            resolveScene("reference"),
          ]);
          if (reqId !== _productsReqId) return;
          primaryPlan = newRes.plan;
          mergedList = mergeSelectionResults(
            tag(newRes.result.list, "new"),
            tag(shopRes.result.list, "shop"),
            { sortField, sortOrder },
          ) as CompetitorProductRaw[];
          // 合并模式总数 = 两源之和(近似;跨页全局排序非严格精确,见方案已知取舍)。
          total = (newRes.result.total ?? 0) + (shopRes.result.total ?? 0);
        }

        currentQueryPlan.value = primaryPlan;
        competitorResults.value = mergedList;
        competitorTotal.value = total;
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
      // 品线树跟随批次:批次变化时同步刷新树,再刷当前类目商品。
      await fetchTree();
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

    /** 导出当前筛选下全部分页商品的完整数据库字段 CSV。 */
    async function exportAllResultsCsv() {
      if (exportLoading.value) return;
      if (competitorTotal.value === 0) {
        ElMessage.warning("当前筛选没有可导出的商品");
        return;
      }

      exportLoading.value = true;
      try {
        const result = await downloadAllResultsCsv({
          plan: currentQueryPlan.value,
          total: competitorTotal.value,
          marketplace: marketplace.value,
        });
        ElMessage.success(`已导出全部 ${result.count} 条商品完整字段`);
      } catch (err) {
        console.error("导出全部筛选结果 CSV 失败:", err);
        ElMessage.error("导出全部 CSV 失败，请重试");
      } finally {
        exportLoading.value = false;
      }
    }

    function setMarketplace(val: string) {
      marketplace.value = val;
    }
    /** 切换数据源(all/new/shop),刷新树与当前类目商品。 */
    async function setDataSource(val: "all" | "new" | "shop") {
      if (dataSource.value === val) return;
      dataSource.value = val;
      competitorPage.value = 1;
      // 数据源切换后树按新源重拉(两源同等),再刷新当前类目商品。
      await fetchTree();
      ensureCategorySelected();
      await reloadCurrentProducts();
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
      dataSource,
      batchVersion,
      selectedNodeId,
      selectedNodeName,
      selectedNodeHealth,
      selectedBsrId,
      selectedBsrName,
      activeFilters,
      filterCount,
      hasFilters,
      resultsVisible,
      treeLoading,
      competitorLoading,
      treeData,
      currentSubCategories,
      competitorResults,
      currentQueryPlan,
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
      loadProducts,
      FILTER_LABEL,
      setMarketplace,
      setDataSource,
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
      activeMethodCard,
      applyM01MethodCard,
      applyM03MethodCard,
      clearMethodCard,
      // ---- 统一区间筛选面板 ----
      rangeFilter,
      applyRangeFilter,
      // ---- 新增方法 ----
      toggleProductSelection,
      selectAllOnPage,
      clearSelection,
      batchAddToSelection,
      searchByKeyword,
      exportAllResultsCsv,
      clearBasicFilters,
      applyBasicFilters,
      zhengBatchDate,
      completeness,
      fetchCompleteness,
      // AI 选品助手：套用筛选
      applyAiFilterRules,
    };
  },
);
