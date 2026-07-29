import type { CompetitorListParams, QualifyRule } from "@/api/competitor";
import type { MethodCardListParams } from "@/api/methodCards";
import type { ShopProductSelectionParams } from "@/api/shopCollection";
import type { AiSelectionPoolListParams } from "@/api/ai-selection-pool";
import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";
import type { SelectionQueryParams } from "@/components/SelectionQueryForm/types";

export type SelectionScene =
  | "all"
  | "new"
  | "reference"
  | "premium"
  | "zheng"
  | "fbm"
  | "ai_selection";
export type SelectionMethodId = "M01" | "M02" | "M03";
export type SelectionDataView = "clean" | "raw";
export type SelectionLensId = "default" | SelectionMethodId;
export type SelectionExecutor =
  | "competitor"
  | "premium_products"
  | "deng_zong"
  | "shop_products"
  | "method_card"
  | "ai_selection";
export type SelectionSnapshotKind =
  | "competitor_created_week"
  | "premium_created_week"
  | "deng_zong_batch"
  | "shop_batch"
  | "ai_selection_batch";
export type SelectionTargetSource =
  | "competitor_clean"
  | "competitor_raw"
  | "premium_products"
  | "deng_zong"
  | "shop_products"
  | "ai_selection";
export type SelectionSemanticFilterKey =
  | "asin"
  | "title"
  | "sellerName"
  | "category"
  | "snapshotKeys"
  | "filterMode"
  | "weekTag"
  | "createdAtRange"
  | "price"
  | "units"
  | "listingDays"
  | "bsrMax"
  | "weightMax"
  | "variantCount"
  | "fulfillment"
  | "grade"
  | "qualifyRules";
export type SelectionFilterSupportMode = "supported" | "unsupported" | "single";

export interface SelectionFilterState {
  country: string;
  sellerSelect: string;
  category: string[];
  sortField: string;
  sortOrder: "desc" | "asc";
  range: RangeFilterValue;
}

export interface SelectionFilterIntent {
  scene: SelectionScene;
  lensId: SelectionLensId;
  methodId: SelectionMethodId | null;
  scope: {
    marketplace?: string;
    businessSource?: string;
    dataView: SelectionDataView;
    filterMode?: string;
    bsrId?: string;
    nodeId?: number;
    groupByParent?: boolean;
    /** 非标载体多选（仅 AI 选品场景使用） */
    carriers?: string[];
  };
  search: {
    asin: string[];
    /** ASIN 精准直查（单条或多条）：只保留站点/业务数据源，不与普通筛选条件求交集。 */
    exactAsin: boolean;
    title?: string;
    sellerName?: string;
    brand?: string;
    keywords?: string;
    categories: string[];
  };
  freshness: {
    snapshotKeys: string[];
    weekTag?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
  };
  metrics: {
    priceMin?: number;
    priceMax?: number;
    unitsMin?: number;
    unitsMax?: number;
    listingDaysMin?: number;
    listingDaysMax?: number;
    bsrMax?: number;
    weightMax?: number;
    variantCountMax?: number;
    fulfillment: string[];
    grade: string[];
  };
  sort: {
    field: string;
    order: "desc" | "asc";
  };
  qualifyRules: QualifyRule[];
}

export type SelectionQualifyRulesMode = "new-only" | "always";

export interface LatestSnapshotFallback {
  kind: SelectionSnapshotKind;
  marketplace: string;
  businessSource?: string;
  filterMode?: string;
}

export interface SelectionSourceCapability {
  targetSource: SelectionTargetSource;
  executor: SelectionExecutor;
  snapshotKind: SelectionSnapshotKind;
  supports: Record<SelectionSemanticFilterKey, SelectionFilterSupportMode>;
}

interface SelectionQueryPlanBase {
  executor: SelectionExecutor;
  lensId: SelectionLensId;
  methodId: SelectionMethodId | null;
  unsupportedFilters: string[];
  forcedFilters: string[];
  latestSnapshotFallback?: LatestSnapshotFallback;
}

export interface CompetitorQueryPlan extends SelectionQueryPlanBase {
  executor: "competitor";
  targetSource: "competitor_clean" | "competitor_raw";
  params: CompetitorListParams;
}

export interface DengZongQueryPlan extends SelectionQueryPlanBase {
  executor: "deng_zong";
  targetSource: "deng_zong";
  params: Record<string, any>;
}

export interface PremiumProductsQueryPlan extends SelectionQueryPlanBase {
  executor: "premium_products";
  targetSource: "premium_products";
  params: CompetitorListParams;
}

export interface ShopProductsQueryPlan extends SelectionQueryPlanBase {
  executor: "shop_products";
  targetSource: "shop_products";
  params: ShopProductSelectionParams;
}

export interface AiSelectionQueryPlan extends SelectionQueryPlanBase {
  executor: "ai_selection";
  targetSource: "ai_selection";
  params: AiSelectionPoolListParams;
}

export interface MethodCardQueryPlan extends SelectionQueryPlanBase {
  executor: "method_card";
  targetSource: "competitor_clean" | "deng_zong";
  params: MethodCardListParams;
}

export type SelectionQueryPlan =
  | CompetitorQueryPlan
  | PremiumProductsQueryPlan
  | DengZongQueryPlan
  | ShopProductsQueryPlan
  | AiSelectionQueryPlan
  | MethodCardQueryPlan;

interface SelectionMethodLensDefinition {
  lensId: SelectionMethodId;
  methodId: SelectionMethodId;
  targetSource: "competitor_clean" | "deng_zong";
  executor: "method_card";
  forcedFilters: string[];
  lockedScene?: SelectionScene;
  lockedDataView?: SelectionDataView;
  snapshotParam?: "createdWeek" | "createdWeeks" | "batchDate";
  snapshotSupport: SelectionFilterSupportMode;
  supports: Record<SelectionSemanticFilterKey, SelectionFilterSupportMode>;
}

const ALL_FILTER_KEYS: SelectionSemanticFilterKey[] = [
  "asin",
  "title",
  "sellerName",
  "category",
  "snapshotKeys",
  "filterMode",
  "weekTag",
  "createdAtRange",
  "price",
  "units",
  "listingDays",
  "bsrMax",
  "weightMax",
  "variantCount",
  "fulfillment",
  "grade",
  "qualifyRules",
];

function createSupportMap(
  overrides: Partial<
    Record<SelectionSemanticFilterKey, SelectionFilterSupportMode>
  > = {},
): Record<SelectionSemanticFilterKey, SelectionFilterSupportMode> {
  const supports = {} as Record<
    SelectionSemanticFilterKey,
    SelectionFilterSupportMode
  >;
  for (const key of ALL_FILTER_KEYS) {
    supports[key] = overrides[key] || "supported";
  }
  return supports;
}

export const SOURCE_CAPABILITIES: Record<
  SelectionTargetSource,
  SelectionSourceCapability
> = {
  competitor_clean: {
    targetSource: "competitor_clean",
    executor: "competitor",
    snapshotKind: "competitor_created_week",
    supports: createSupportMap(),
  },
  competitor_raw: {
    targetSource: "competitor_raw",
    executor: "competitor",
    snapshotKind: "competitor_created_week",
    supports: createSupportMap(),
  },
  deng_zong: {
    targetSource: "deng_zong",
    executor: "deng_zong",
    snapshotKind: "deng_zong_batch",
    supports: createSupportMap({
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
  premium_products: {
    targetSource: "premium_products",
    executor: "premium_products",
    snapshotKind: "premium_created_week",
    supports: createSupportMap({
      filterMode: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
  shop_products: {
    targetSource: "shop_products",
    executor: "shop_products",
    snapshotKind: "shop_batch",
    supports: createSupportMap({
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
  ai_selection: {
    targetSource: "ai_selection",
    executor: "ai_selection",
    snapshotKind: "ai_selection_batch",
    supports: createSupportMap({
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
};

export const METHOD_LENS_DEFINITIONS: Record<
  SelectionMethodId,
  SelectionMethodLensDefinition
> = {
  M01: {
    lensId: "M01",
    methodId: "M01",
    targetSource: "competitor_clean",
    executor: "method_card",
    forcedFilters: ["scene=new", "dataView=clean", "method=M01"],
    lockedScene: "new",
    lockedDataView: "clean",
    snapshotParam: "createdWeeks",
    snapshotSupport: "supported",
    supports: createSupportMap({
      snapshotKeys: "supported",
      asin: "unsupported",
      title: "unsupported",
      sellerName: "unsupported",
      category: "supported",
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      price: "unsupported",
      units: "unsupported",
      listingDays: "unsupported",
      bsrMax: "unsupported",
      weightMax: "unsupported",
      variantCount: "unsupported",
      fulfillment: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
  M02: {
    lensId: "M02",
    methodId: "M02",
    targetSource: "deng_zong",
    executor: "method_card",
    forcedFilters: ["dataView=deng_zong", "method=M02"],
    snapshotParam: "batchDate",
    snapshotSupport: "single",
    supports: createSupportMap({
      snapshotKeys: "single",
      asin: "unsupported",
      title: "unsupported",
      sellerName: "unsupported",
      category: "unsupported",
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      price: "unsupported",
      units: "unsupported",
      listingDays: "unsupported",
      bsrMax: "unsupported",
      weightMax: "unsupported",
      variantCount: "unsupported",
      fulfillment: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
  // M03 FBM 自发货简单道 - 数据源 competitor_products_clean (与 M01 同源不同筛)
  // 特点: fulfillment='FBM' 硬门槛, 无价格/重量/BSR 约束, 90 天单段销量门槛
  M03: {
    lensId: "M03",
    methodId: "M03",
    targetSource: "competitor_clean",
    executor: "method_card",
    forcedFilters: [
      "dataView=clean",
      "fulfillment=FBM",
      "method=M03",
      "latestM03EffectiveWeek",
    ],
    lockedScene: "fbm",
    lockedDataView: "clean",
    snapshotSupport: "unsupported",
    supports: createSupportMap({
      snapshotKeys: "unsupported",
      asin: "unsupported",
      title: "unsupported",
      sellerName: "unsupported",
      category: "unsupported",
      filterMode: "unsupported",
      weekTag: "unsupported",
      createdAtRange: "unsupported",
      price: "unsupported",
      units: "unsupported",
      listingDays: "unsupported",
      bsrMax: "unsupported",
      weightMax: "unsupported",
      variantCount: "unsupported",
      fulfillment: "unsupported",
      grade: "unsupported",
      qualifyRules: "unsupported",
    }),
  },
};

export function resolveSceneBusinessSource(
  scene: SelectionScene,
): string | undefined {
  const map: Partial<Record<SelectionScene, string | undefined>> = {
    all: undefined,
    new: "新品榜",
    reference: "竞品店铺",
    premium: "精品榜",
    zheng: "非标店铺",
  };
  if (scene === "fbm") return undefined;
  return map[scene];
}

// preset apply 会把 category/grade/fulfillment 等数组字段 patch 进 queryParams,
// 到这一层 raw 可能已经不是纯字符串而是数组; 收窄两种输入形态防止运行时崩溃
function splitSearchValues(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const src = Array.isArray(raw) ? raw.join(",") : raw;
  if (typeof src !== "string") return [];
  return src
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCsv(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// M01 支持 UK / DE / US 三站点; 其他站点归一为 UK
function normalizeMethodMarketplace(value?: string): "UK" | "DE" | "US" {
  if (value === "DE") return "DE";
  if (value === "US") return "US";
  return "UK";
}

function compactText(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizeCategories(
  queryParams?: SelectionQueryParams,
  activeFilters?: SelectionFilterState,
): string[] {
  // activeFilters 是统一筛选框的唯一事实来源；即使数组为空，也表示用户明确清空。
  // 只有旧调用方没有传 activeFilters 时，才兼容 URL/表单中的逗号字符串。
  if (activeFilters) {
    return Array.isArray(activeFilters.category)
      ? activeFilters.category.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }
  return splitCsv(queryParams?.category);
}

function resolveQualifyRules(input: {
  scene: SelectionScene;
  methodId: SelectionMethodId | null;
  qualifyRules?: QualifyRule[];
  qualifyRulesMode?: SelectionQualifyRulesMode;
}): QualifyRule[] {
  const {
    scene,
    methodId,
    qualifyRules,
    qualifyRulesMode = "new-only",
  } = input;
  if (!qualifyRules?.length) return [];
  if (qualifyRulesMode === "always") {
    return [...qualifyRules];
  }
  return scene === "new" && !methodId ? [...qualifyRules] : [];
}

function resolveActiveSemanticFilters(
  intent: SelectionFilterIntent,
): SelectionSemanticFilterKey[] {
  const active: SelectionSemanticFilterKey[] = [];
  if (intent.search.asin.length > 0) active.push("asin");
  if (intent.search.title) active.push("title");
  if (intent.search.sellerName) active.push("sellerName");
  if (intent.search.categories.length > 0) active.push("category");
  if (intent.freshness.snapshotKeys.length > 0) active.push("snapshotKeys");
  if (intent.scope.filterMode) active.push("filterMode");
  if (intent.freshness.weekTag) active.push("weekTag");
  if (intent.freshness.createdAtStart || intent.freshness.createdAtEnd) {
    active.push("createdAtRange");
  }
  if (intent.metrics.priceMin != null || intent.metrics.priceMax != null) {
    active.push("price");
  }
  if (intent.metrics.unitsMin != null || intent.metrics.unitsMax != null) {
    active.push("units");
  }
  if (
    intent.metrics.listingDaysMin != null ||
    intent.metrics.listingDaysMax != null
  ) {
    active.push("listingDays");
  }
  if (intent.metrics.bsrMax != null) active.push("bsrMax");
  if (intent.metrics.weightMax != null) active.push("weightMax");
  if (intent.metrics.variantCountMax != null) active.push("variantCount");
  if (intent.metrics.fulfillment.length > 0) active.push("fulfillment");
  if (intent.metrics.grade.length > 0) active.push("grade");
  if (intent.qualifyRules.length > 0) active.push("qualifyRules");
  return active;
}

function collectUnsupportedFilters(
  intent: SelectionFilterIntent,
  supports: Record<SelectionSemanticFilterKey, SelectionFilterSupportMode>,
): string[] {
  const unsupported: string[] = [];
  for (const key of resolveActiveSemanticFilters(intent)) {
    const support = supports[key] || "unsupported";
    if (support === "unsupported") {
      unsupported.push(key);
      continue;
    }
    if (support === "single" && intent.freshness.snapshotKeys.length > 1) {
      unsupported.push(`${key}(single-only)`);
    }
  }
  return unsupported;
}

function resolveDefaultTargetSource(
  intent: SelectionFilterIntent,
): SelectionTargetSource {
  if (intent.scene === "reference") {
    return "shop_products";
  }
  if (intent.scene === "premium") {
    return "premium_products";
  }
  if (intent.scene === "zheng") {
    return "deng_zong";
  }
  if (intent.scene === "ai_selection") {
    return "ai_selection";
  }
  return intent.scope.dataView === "clean"
    ? "competitor_clean"
    : "competitor_raw";
}

function resolveMethodCardSnapshot(
  intent: SelectionFilterIntent,
  lens: SelectionMethodLensDefinition,
): string | undefined {
  if (
    lens.snapshotSupport !== "single" ||
    !lens.snapshotParam ||
    intent.freshness.snapshotKeys.length !== 1
  ) {
    return undefined;
  }
  return intent.freshness.snapshotKeys[0];
}

function buildMethodCardQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
  lens: SelectionMethodLensDefinition;
}): MethodCardQueryPlan {
  const { intent, page, size, lens } = input;
  const marketplace = normalizeMethodMarketplace(intent.scope.marketplace);
  const snapshotValue = resolveMethodCardSnapshot(intent, lens);
  const params: MethodCardListParams = {
    marketplace,
    page,
    size,
  };
  if (lens.methodId !== "M03") {
    params.bsrId = intent.scope.bsrId;
    params.nodeId = intent.scope.nodeId;
  }
  if (lens.snapshotParam === "createdWeek" && snapshotValue) {
    params.createdWeek = snapshotValue;
  }
  if (intent.search.categories.length > 0) {
    params.categories = [...intent.search.categories];
  }
  if (
    lens.snapshotParam === "createdWeeks" &&
    intent.freshness.snapshotKeys.length > 0
  ) {
    params.createdWeeks = [...intent.freshness.snapshotKeys];
  }
  if (lens.snapshotParam === "batchDate" && snapshotValue) {
    params.batchDate = snapshotValue;
  }

  return {
    executor: lens.executor,
    lensId: lens.lensId,
    methodId: lens.methodId,
    targetSource: lens.targetSource,
    params,
    unsupportedFilters: collectUnsupportedFilters(intent, lens.supports),
    forcedFilters: [...lens.forcedFilters],
  };
}

function buildDengZongQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
}): DengZongQueryPlan {
  const { intent, page, size } = input;
  const marketplace = intent.scope.marketplace || "UK";
  const batchDate =
    intent.freshness.snapshotKeys.length > 0
      ? intent.freshness.snapshotKeys.join(",")
      : undefined;

  return {
    executor: "deng_zong",
    lensId: "default",
    methodId: null,
    targetSource: "deng_zong",
    params: {
      page,
      size,
      marketplace,
      asins: intent.search.asin.length > 0 ? [...intent.search.asin] : undefined,
      title: intent.search.title,
      sellerName: intent.search.sellerName,
      brand: intent.search.brand,
      category:
        intent.search.categories.length > 0
          ? intent.search.categories.join(",")
          : undefined,
      bsrId: intent.scope.bsrId,
      nodeId: intent.scope.nodeId,
      priceMin: intent.metrics.priceMin,
      priceMax: intent.metrics.priceMax,
      unitsMin: intent.metrics.unitsMin,
      unitsMax: intent.metrics.unitsMax,
      listingDaysMin: intent.metrics.listingDaysMin,
      listingDaysMax: intent.metrics.listingDaysMax,
      bsrMax: intent.metrics.bsrMax,
      weightMax: intent.metrics.weightMax,
      maxVariantCount: intent.metrics.variantCountMax,
      fulfillment:
        intent.metrics.fulfillment.length > 0
          ? [...intent.metrics.fulfillment]
          : undefined,
      batchDate,
      sortBy: intent.sort.field || "units",
      sortOrder: intent.sort.order || "desc",
    },
    unsupportedFilters: collectUnsupportedFilters(
      intent,
      SOURCE_CAPABILITIES.deng_zong.supports,
    ),
    forcedFilters: batchDate ? [] : ["latestBatchDate"],
    latestSnapshotFallback: batchDate
      ? undefined
      : {
          kind: "deng_zong_batch",
          marketplace,
        },
  };
}

function buildShopProductsQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
}): ShopProductsQueryPlan {
  const { intent, page, size } = input;
  const marketplace = intent.scope.marketplace || "UK";
  const params: ShopProductSelectionParams = {
    page,
    size,
    marketplace,
    sortBy: intent.sort.field || "salesVolume",
    sortOrder: intent.sort.order || "desc",
  };
  if (intent.methodId === "M01" || intent.methodId === "M03") {
    params.methodId = intent.methodId;
  }

  if (intent.search.asin.length > 0) params.asins = [...intent.search.asin];
  if (intent.search.title) params.title = intent.search.title;
  if (intent.search.sellerName) params.sellerName = intent.search.sellerName;
  if (intent.search.brand) params.brand = intent.search.brand;
  if (intent.search.categories.length > 0) {
    params.categories = [...intent.search.categories];
  }
  // 品线树精确筛选：把大类/小类透传给店铺选品，与新品榜口径一致。
  if (intent.scope.bsrId) params.bsrId = intent.scope.bsrId;
  if (intent.scope.nodeId != null) params.nodeId = intent.scope.nodeId;
  if (intent.freshness.snapshotKeys.length > 0) {
    params.batchDates = [...intent.freshness.snapshotKeys];
  }
  if (intent.metrics.priceMin != null) params.priceMin = intent.metrics.priceMin;
  if (intent.metrics.priceMax != null) params.priceMax = intent.metrics.priceMax;
  if (intent.metrics.unitsMin != null) params.unitsMin = intent.metrics.unitsMin;
  if (intent.metrics.unitsMax != null) params.unitsMax = intent.metrics.unitsMax;
  if (intent.metrics.listingDaysMin != null) {
    params.listingDaysMin = intent.metrics.listingDaysMin;
  }
  if (intent.metrics.listingDaysMax != null) {
    params.listingDaysMax = intent.metrics.listingDaysMax;
  }
  if (intent.metrics.bsrMax != null) params.bsrMax = intent.metrics.bsrMax;
  if (intent.metrics.weightMax != null) params.weightMax = intent.metrics.weightMax;
  if (intent.metrics.variantCountMax != null) {
    params.maxVariantCount = intent.metrics.variantCountMax;
  }
  if (intent.metrics.fulfillment.length > 0) {
    params.fulfillment = [...intent.metrics.fulfillment];
  }
  if (intent.metrics.grade.length > 0) params.grade = [...intent.metrics.grade];

  return {
    executor: "shop_products",
    lensId: intent.methodId || "default",
    methodId: intent.methodId,
    targetSource: "shop_products",
    params,
    unsupportedFilters: collectUnsupportedFilters(
      intent,
      SOURCE_CAPABILITIES.shop_products.supports,
    ),
    forcedFilters: [],
  };
}

function buildCompetitorQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
  targetSource: "competitor_clean" | "competitor_raw";
}): CompetitorQueryPlan {
  const { intent, page, size, targetSource } = input;
  const marketplace = intent.scope.marketplace || "UK";
  const capability = SOURCE_CAPABILITIES[targetSource];
  const competitorParams: CompetitorListParams = {
    page,
    size,
    marketplace,
    source: intent.scope.businessSource,
    filterMode: intent.scope.filterMode,
    useCleanTable: targetSource === "competitor_clean",
    sortBy: intent.sort.field || "createdAt",
    sortOrder: intent.sort.order || "desc",
  };

  if (intent.search.asin.length > 0) competitorParams.asin = intent.search.asin;
  if (intent.search.title) competitorParams.title = intent.search.title;
  if (intent.search.sellerName) {
    competitorParams.sellerName = intent.search.sellerName;
  }
  if (intent.search.brand) competitorParams.brand = intent.search.brand;
  if (intent.search.keywords)
    competitorParams.keywords = intent.search.keywords;
  if (intent.search.categories.length > 0) {
    competitorParams.category = intent.search.categories.join(",");
  }
  if (intent.scope.bsrId) competitorParams.bsrId = intent.scope.bsrId;
  if (intent.scope.nodeId != null)
    competitorParams.nodeId = intent.scope.nodeId;
  if (intent.scope.groupByParent != null) {
    competitorParams.groupByParent = intent.scope.groupByParent;
  }
  if (intent.metrics.grade.length > 0) {
    competitorParams.grade = intent.metrics.grade.join(",");
  }
  if (intent.freshness.weekTag)
    competitorParams.weekTag = intent.freshness.weekTag;
  if (intent.freshness.createdAtStart) {
    competitorParams.createdAtStart = intent.freshness.createdAtStart;
  }
  if (intent.freshness.createdAtEnd) {
    competitorParams.createdAtEnd = intent.freshness.createdAtEnd;
  }
  if (intent.metrics.priceMin != null)
    competitorParams.priceMin = intent.metrics.priceMin;
  if (intent.metrics.priceMax != null)
    competitorParams.priceMax = intent.metrics.priceMax;
  if (intent.metrics.unitsMin != null)
    competitorParams.unitsMin = intent.metrics.unitsMin;
  if (intent.metrics.unitsMax != null)
    competitorParams.unitsMax = intent.metrics.unitsMax;
  if (intent.metrics.listingDaysMin != null) {
    competitorParams.listingDaysMin = intent.metrics.listingDaysMin;
  }
  if (intent.metrics.listingDaysMax != null) {
    competitorParams.listingDaysMax = intent.metrics.listingDaysMax;
  }
  if (intent.metrics.bsrMax != null)
    competitorParams.bsrMax = intent.metrics.bsrMax;
  if (intent.metrics.weightMax != null) {
    competitorParams.weightMax = intent.metrics.weightMax;
  }
  if (intent.metrics.variantCountMax != null) {
    competitorParams.maxVariantCount = intent.metrics.variantCountMax;
  }
  if (intent.metrics.fulfillment.length > 0) {
    competitorParams.fulfillment = intent.metrics.fulfillment;
  }
  if (intent.freshness.snapshotKeys.length > 0) {
    competitorParams.createdWeeks = [...intent.freshness.snapshotKeys];
  }
  if (intent.qualifyRules.length > 0) {
    competitorParams.qualifyRules = intent.qualifyRules;
  }

  return {
    executor: "competitor",
    lensId: "default",
    methodId: null,
    targetSource,
    params: competitorParams,
    unsupportedFilters: collectUnsupportedFilters(intent, capability.supports),
    forcedFilters: [],
    latestSnapshotFallback:
      intent.search.exactAsin ||
      intent.freshness.snapshotKeys.length > 0 ||
      intent.freshness.weekTag ||
      intent.freshness.createdAtStart
        ? undefined
        : {
            kind: capability.snapshotKind,
            marketplace,
            businessSource: intent.scope.businessSource,
            filterMode: intent.scope.filterMode,
          },
  };
}

function buildPremiumProductsQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
}): PremiumProductsQueryPlan {
  const { intent, page, size } = input;
  const base = buildCompetitorQueryPlan({
    intent,
    page,
    size,
    targetSource: "competitor_raw",
  });
  const marketplace = intent.scope.marketplace || "UK";
  const params: CompetitorListParams = {
    ...base.params,
    source: undefined,
    filterMode: undefined,
    useCleanTable: false,
  };
  if (intent.methodId === "M01" || intent.methodId === "M03") {
    params.methodId = intent.methodId;
  }

  return {
    executor: "premium_products",
    lensId: intent.methodId || "default",
    methodId: intent.methodId,
    targetSource: "premium_products",
    params,
    unsupportedFilters: collectUnsupportedFilters(
      intent,
      SOURCE_CAPABILITIES.premium_products.supports,
    ),
    forcedFilters: ["dataSource=premium_products", "dataView=raw"],
    latestSnapshotFallback:
      intent.search.exactAsin ||
      intent.freshness.snapshotKeys.length > 0 ||
      intent.freshness.createdAtStart
        ? undefined
        : {
            kind: "premium_created_week",
            marketplace,
          },
  };
}

function buildAiSelectionQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
}): AiSelectionQueryPlan {
  const { intent, page, size } = input;
  const marketplace = intent.scope.marketplace || "UK";
  const params: AiSelectionPoolListParams = {
    page,
    size,
    marketplace,
    sortBy: intent.sort.field || "pushedAt",
    sortOrder: intent.sort.order || "desc",
  };

  // 方法卡快筛（M01/M03）：透传给后端，套用同口径门槛到 ai_selection 表。
  // M02 是郑总盘专属，AI 选品页不显示该卡，后端也会忽略。
  if (intent.methodId === "M01" || intent.methodId === "M03") {
    params.methodId = intent.methodId;
  }

  if (intent.search.asin.length > 0) params.asin = [...intent.search.asin];
  if (intent.search.title) params.title = intent.search.title;
  if (intent.search.sellerName) params.sellerName = intent.search.sellerName;
  if (intent.search.brand) params.brand = intent.search.brand;
  if (intent.search.categories.length > 0) {
    params.category = intent.search.categories.join(",");
  }
  if (intent.scope.bsrId) params.bsrId = intent.scope.bsrId;
  if (intent.scope.nodeId != null) params.nodeId = intent.scope.nodeId;
  if (intent.freshness.snapshotKeys.length > 0) {
    params.batchIds = [...intent.freshness.snapshotKeys];
  }
  if (intent.scope.carriers && intent.scope.carriers.length > 0) {
    params.carriers = [...intent.scope.carriers];
  }
  if (intent.metrics.priceMin != null) params.priceMin = intent.metrics.priceMin;
  if (intent.metrics.priceMax != null) params.priceMax = intent.metrics.priceMax;
  if (intent.metrics.unitsMin != null) params.unitsMin = intent.metrics.unitsMin;
  if (intent.metrics.unitsMax != null) params.unitsMax = intent.metrics.unitsMax;
  if (intent.metrics.listingDaysMin != null) {
    params.listingDaysMin = intent.metrics.listingDaysMin;
  }
  if (intent.metrics.listingDaysMax != null) {
    params.listingDaysMax = intent.metrics.listingDaysMax;
  }
  if (intent.metrics.bsrMax != null) params.bsrMax = intent.metrics.bsrMax;
  if (intent.metrics.weightMax != null) params.weightMax = intent.metrics.weightMax;
  if (intent.metrics.variantCountMax != null) {
    params.maxVariantCount = intent.metrics.variantCountMax;
  }
  if (intent.metrics.fulfillment.length > 0) {
    params.fulfillment = [...intent.metrics.fulfillment];
  }

  return {
    executor: "ai_selection",
    lensId: "default",
    methodId: null,
    targetSource: "ai_selection",
    params,
    unsupportedFilters: collectUnsupportedFilters(
      intent,
      SOURCE_CAPABILITIES.ai_selection.supports,
    ),
    forcedFilters: ["dataSource=ai_selection"],
  };
}

export function buildSelectionFilterIntent(input: {
  scene: SelectionScene;
  methodId: SelectionMethodId | null;
  queryParams?: SelectionQueryParams;
  activeFilters: SelectionFilterState;
  useCleanTable: boolean;
  qualifyRules?: QualifyRule[];
  qualifyRulesMode?: SelectionQualifyRulesMode;
  overrides?: {
    bsrId?: string;
    nodeId?: number;
    brand?: string;
    keywords?: string;
    groupByParent?: boolean;
    title?: string;
    sellerName?: string;
    marketplace?: string;
    carriers?: string[];
  };
}): SelectionFilterIntent {
  const {
    scene,
    methodId,
    queryParams,
    activeFilters,
    useCleanTable,
    qualifyRules,
    qualifyRulesMode,
    overrides,
  } = input;
  const asinValues = splitSearchValues(queryParams?.asin);
  // ASIN 是定位商品的主键。无论输入 1 条还是多条，都必须走当前业务数据源的
  // 精准直查，不能继续套用 M01/M02/M03 或批次、销量等普通筛选。
  // 否则新品榜默认 M01 时，单条 ASIN 会落到不支持 asin 参数的方法卡接口，
  // 表现为点击搜索后列表完全不变；店铺选品则因为走 shop_products 而正常。
  const exactAsinSearch = asinValues.length > 0;
  const sellerName =
    compactText(overrides?.sellerName) ||
    compactText(activeFilters.sellerSelect) ||
    compactText(queryParams?.sellerSelect) ||
    compactText(queryParams?.storeName);

  return {
    scene,
    // ASIN 精准直查用于直接定位商品，不能继续套方法卡规则。
    lensId: exactAsinSearch ? "default" : methodId || "default",
    methodId: exactAsinSearch ? null : methodId,
    scope: {
      marketplace:
        compactText(overrides?.marketplace) ||
        compactText(activeFilters.country) ||
        compactText(queryParams?.country),
      businessSource: resolveSceneBusinessSource(scene),
      dataView: useCleanTable ? "clean" : "raw",
      // MODE1 / MODE2 / FAIL 是旧入库分级，现行查询不再使用。
      filterMode: undefined,
      bsrId: exactAsinSearch ? undefined : compactText(overrides?.bsrId),
      nodeId: exactAsinSearch ? undefined : overrides?.nodeId,
      groupByParent: exactAsinSearch ? undefined : overrides?.groupByParent,
      // 载体多选不受 ASIN 精准直查影响（属于数据集范围过滤，可与批次并存）
      carriers: overrides?.carriers && overrides.carriers.length > 0
        ? [...overrides.carriers]
        : undefined,
    },
    search: {
      asin: asinValues,
      exactAsin: exactAsinSearch,
      title: exactAsinSearch
        ? undefined
        : compactText(overrides?.title) || compactText(queryParams?.productTitle),
      sellerName: exactAsinSearch ? undefined : sellerName,
      brand: exactAsinSearch ? undefined : compactText(overrides?.brand),
      keywords: exactAsinSearch ? undefined : compactText(overrides?.keywords),
      categories: exactAsinSearch
        ? []
        : normalizeCategories(queryParams, activeFilters),
    },
    freshness: {
      snapshotKeys: exactAsinSearch
        ? []
        : [...(activeFilters.range.createdWeeks || [])],
      weekTag: exactAsinSearch ? undefined : compactText(queryParams?.weekTag),
      createdAtStart: exactAsinSearch
        ? undefined
        : compactText(queryParams?.listingDateStart),
      createdAtEnd: exactAsinSearch
        ? undefined
        : compactText(queryParams?.listingDateEnd),
    },
    metrics: {
      priceMin: exactAsinSearch ? undefined : activeFilters.range.priceMin ?? undefined,
      priceMax: exactAsinSearch ? undefined : activeFilters.range.priceMax ?? undefined,
      unitsMin: exactAsinSearch ? undefined : activeFilters.range.unitsMin ?? undefined,
      unitsMax: exactAsinSearch ? undefined : activeFilters.range.unitsMax ?? undefined,
      listingDaysMin: exactAsinSearch
        ? undefined
        : activeFilters.range.listingDaysMin ?? undefined,
      listingDaysMax: exactAsinSearch
        ? undefined
        : activeFilters.range.listingDaysMax ?? undefined,
      bsrMax: exactAsinSearch ? undefined : activeFilters.range.bsrMax ?? undefined,
      weightMax: exactAsinSearch ? undefined : activeFilters.range.weightMax ?? undefined,
      variantCountMax: exactAsinSearch
        ? undefined
        : activeFilters.range.variantCountMax ?? undefined,
      fulfillment: exactAsinSearch
        ? []
        : [...(activeFilters.range.fulfillment || [])],
      // S/A/B/C/D 是旧评分品级，现行查询不再使用。
      grade: [],
    },
    sort: {
      field: activeFilters.sortField || "createdAt",
      order: activeFilters.sortOrder || "desc",
    },
    qualifyRules: exactAsinSearch
      ? []
      : resolveQualifyRules({
          scene,
          methodId,
          qualifyRules,
          qualifyRulesMode,
        }),
  };
}

export function buildSelectionQueryPlan(input: {
  intent: SelectionFilterIntent;
  page: number;
  size: number;
}): SelectionQueryPlan {
  const { intent, page, size } = input;

  // 店铺选品的 M01/M03 是“规则 + 当前数据源”的组合：规则只筛 shop_products，
  // 不能因为点了方法卡而回退到 competitor_products_clean。
  if (
    intent.scene === "reference" &&
    (intent.methodId === "M01" || intent.methodId === "M03")
  ) {
    return buildShopProductsQueryPlan({ intent, page, size });
  }

  // 精品默认展示独立原始表；M01/M03 只作为可选规则叠加在 premium_products 上。
  if (intent.scene === "premium") {
    if (intent.methodId === "M02") {
      throw new Error("精品选品暂不支持 M02 方法卡");
    }
    return buildPremiumProductsQueryPlan({ intent, page, size });
  }

  // AI 选品：固定读取 ai_selection 表，不支持方法卡。
  if (intent.scene === "ai_selection") {
    return buildAiSelectionQueryPlan({ intent, page, size });
  }

  if (intent.methodId) {
    return buildMethodCardQueryPlan({
      intent,
      page,
      size,
      lens: METHOD_LENS_DEFINITIONS[intent.methodId],
    });
  }

  const targetSource = resolveDefaultTargetSource(intent);
  if (targetSource === "deng_zong") {
    return buildDengZongQueryPlan({ intent, page, size });
  }
  if (targetSource === "shop_products") {
    return buildShopProductsQueryPlan({ intent, page, size });
  }
  if (targetSource === "premium_products") {
    return buildPremiumProductsQueryPlan({ intent, page, size });
  }
  if (targetSource === "ai_selection") {
    return buildAiSelectionQueryPlan({ intent, page, size });
  }

  return buildCompetitorQueryPlan({
    intent,
    page,
    size,
    targetSource,
  });
}
