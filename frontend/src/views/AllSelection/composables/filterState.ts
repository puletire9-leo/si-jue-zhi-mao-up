import { computed, ref, type ComputedRef, type Ref } from "vue";

import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";
import { cloneRangeFilter, createEmptyRangeFilter } from "@/utils/rangeFilter";

import type { SelectionFilterState } from "./queryPlan";

export type FilterState = SelectionFilterState;

export interface MethodCardSelection {
  id: string;
  name: string;
}

export interface FilterChip {
  key: string;
  label: string;
}

interface UseSelectionFilterStateOptions {
  activeMethodCard: Ref<MethodCardSelection | null>;
  getQualifyRules: () => unknown[];
  setQualifyRules: (rules: unknown[]) => void;
  applyQuery: () => void;
  syncMarketplaceScope: (marketplace?: string) => void;
  normalizeMethodMarketplace?: (value?: string) => string;
  patchQueryParams: (config: Record<string, any>) => void;
  initialCountry?: string;
}

const COUNTRY_LABEL: Record<string, string> = {
  US: "美国",
  UK: "英国",
  DE: "德国",
};

export function emptyRange(): RangeFilterValue {
  return createEmptyRangeFilter();
}

export function cloneRange(range: RangeFilterValue): RangeFilterValue {
  return cloneRangeFilter(range);
}

export function cloneFilterState(state: FilterState): FilterState {
  return {
    ...state,
    category: [...state.category],
    range: cloneRange(state.range),
  };
}

function createDefaultFilterState(country: string): FilterState {
  return {
    country,
    sellerSelect: "",
    category: [],
    sortField: "createdAt",
    sortOrder: "desc",
    range: emptyRange(),
  };
}

function createFilterStateFromConfig(config: Record<string, any>): FilterState {
  const category = Array.isArray(config.category) ? [...config.category] : [];

  return {
    country: config.country ?? "",
    sellerSelect: config.sellerSelect ?? "",
    category,
    sortField: config.sortField === "score" ? "createdAt" : (config.sortField ?? "createdAt"),
    sortOrder: config.sortOrder ?? "desc",
    range: {
      priceMin: config.priceMin ?? null,
      priceMax: config.priceMax ?? null,
      unitsMin: config.unitsMin ?? null,
      unitsMax: config.unitsMax ?? null,
      listingDaysMin: config.listingDaysMin ?? null,
      listingDaysMax: config.listingDaysMax ?? null,
      bsrMax: config.bsrMax ?? null,
      weightMax: config.weightMax ?? null,
      variantCountMax: config.variantCountMax ?? null,
      fulfillment: Array.isArray(config.fulfillment)
        ? [...config.fulfillment]
        : [],
      createdWeeks: Array.isArray(config.createdWeeks)
        ? [...config.createdWeeks]
        : [],
      category,
      grade: [],
      listingPreset: config.listingPreset ?? null,
    },
  };
}

export function buildPresetConfig(
  filters: FilterState,
  qualifyRules: unknown[],
): Record<string, any> {
  return {
    ...filters.range,
    category: [...filters.category],
    country: filters.country || "",
    sellerSelect: filters.sellerSelect || "",
    sortField: filters.sortField === "score" ? "createdAt" : (filters.sortField || "createdAt"),
    sortOrder: filters.sortOrder || "desc",
    qualifyRules,
  };
}

export function useSelectionFilterState(
  options: UseSelectionFilterStateOptions,
): {
  activeFilters: Ref<FilterState>;
  draftFilters: Ref<FilterState>;
  filterDrawerVisible: Ref<boolean>;
  activeFilterChips: ComputedRef<FilterChip[]>;
  handleReset: () => void;
  onBarCountryChange: (val: string) => void;
  onBarCategoryChange: () => void;
  openFilterDrawer: () => void;
  handleDrawerConfirm: () => void;
  handleDrawerReset: () => void;
  removeChip: (key: string) => void;
  clearAllFilters: () => void;
  getCurrentFilterConfig: () => Record<string, any>;
  handlePresetApply: (config: Record<string, any>) => void;
  setCountry: (country: string) => void;
} {
  const initialCountry = options.initialCountry || "UK";
  const activeFilters = ref<FilterState>(
    createDefaultFilterState(initialCountry),
  );
  const draftFilters = ref<FilterState>(
    createDefaultFilterState(initialCountry),
  );
  const filterDrawerVisible = ref(false);

  const normalizeCountry = (value?: string) => {
    if (
      !options.activeMethodCard.value ||
      !options.normalizeMethodMarketplace
    ) {
      return value || "";
    }
    return options.normalizeMethodMarketplace(value);
  };

  const syncDraftWithActiveIfNeeded = () => {
    if (filterDrawerVisible.value) {
      draftFilters.value = cloneFilterState(activeFilters.value);
    }
  };

  const activeFilterChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const filters = activeFilters.value;

    if (options.activeMethodCard.value) {
      chips.push({
        key: "methodCard",
        label: `方法: ${options.activeMethodCard.value.id} ${options.activeMethodCard.value.name}`,
      });
    }

    if (filters.country) {
      chips.push({
        key: "country",
        label: `站点: ${COUNTRY_LABEL[filters.country] || filters.country}`,
      });
    }

    if (filters.sellerSelect) {
      chips.push({ key: "seller", label: `卖家: ${filters.sellerSelect}` });
    }

    if (filters.category.length) {
      chips.push({
        key: "category",
        label: `大类: ${filters.category.length}项`,
      });
    }

    const range = filters.range;

    if (range.priceMin != null || range.priceMax != null) {
      chips.push({
        key: "price",
        label: `价格: ${range.priceMin ?? "-"}~${range.priceMax ?? "-"}`,
      });
    }

    if (range.unitsMin != null || range.unitsMax != null) {
      chips.push({
        key: "units",
        label: `月销: ${range.unitsMin ?? "-"}~${range.unitsMax ?? "-"}`,
      });
    }

    if (range.listingDaysMin != null || range.listingDaysMax != null) {
      chips.push({
        key: "listingDays",
        label: `上架天数: ${range.listingDaysMin ?? "-"}~${range.listingDaysMax ?? "-"}`,
      });
    }

    if (range.bsrMax != null) {
      chips.push({ key: "bsrMax", label: `BSR<=${range.bsrMax}` });
    }

    if (range.weightMax != null) {
      chips.push({ key: "weightMax", label: `重量<=${range.weightMax}g` });
    }

    if (range.variantCountMax != null) {
      chips.push({
        key: "variantCountMax",
        label: `变体<=${range.variantCountMax}`,
      });
    }

    if (range.fulfillment.length) {
      chips.push({
        key: "fulfillment",
        label: `配送: ${range.fulfillment.join("/")}`,
      });
    }

    if (range.createdWeeks.length) {
      chips.push({
        key: "createdWeeks",
        label: `批次: ${range.createdWeeks.length}项`,
      });
    }

    return chips;
  });

  const handleReset = () => {
    const country = activeFilters.value.country;
    options.activeMethodCard.value = null;
    activeFilters.value = createDefaultFilterState(country);
    syncDraftWithActiveIfNeeded();
    options.applyQuery();
  };

  const onBarCountryChange = (val: string) => {
    activeFilters.value.country = normalizeCountry(val);
    activeFilters.value.sellerSelect = "";
    options.syncMarketplaceScope(activeFilters.value.country || undefined);
    options.applyQuery();
  };

  const onBarCategoryChange = () => {
    options.applyQuery();
  };

  const openFilterDrawer = () => {
    draftFilters.value = cloneFilterState(activeFilters.value);
    options.syncMarketplaceScope(activeFilters.value.country || undefined);
    filterDrawerVisible.value = true;
  };

  const handleDrawerConfirm = () => {
    const nextFilters = cloneFilterState(draftFilters.value);
    nextFilters.country = normalizeCountry(nextFilters.country);
    activeFilters.value = nextFilters;
    filterDrawerVisible.value = false;
    options.applyQuery();
  };

  const handleDrawerReset = () => {
    draftFilters.value = {
      country: activeFilters.value.country,
      sellerSelect: "",
      category: [...activeFilters.value.category],
      sortField: "createdAt",
      sortOrder: "desc",
      range: emptyRange(),
    };
  };

  const removeChip = (key: string) => {
    const nextFilters = cloneFilterState(activeFilters.value);
    const range = nextFilters.range;

    switch (key) {
      case "methodCard":
        options.activeMethodCard.value = null;
        break;
      case "country":
        nextFilters.country = "";
        break;
      case "seller":
        nextFilters.sellerSelect = "";
        break;
      case "category":
        nextFilters.category = [];
        break;
      case "price":
        range.priceMin = null;
        range.priceMax = null;
        break;
      case "units":
        range.unitsMin = null;
        range.unitsMax = null;
        break;
      case "listingDays":
        range.listingDaysMin = null;
        range.listingDaysMax = null;
        range.listingPreset = null;
        break;
      case "bsrMax":
        range.bsrMax = null;
        break;
      case "weightMax":
        range.weightMax = null;
        break;
      case "variantCountMax":
        range.variantCountMax = null;
        break;
      case "fulfillment":
        range.fulfillment = [];
        break;
      case "createdWeeks":
        range.createdWeeks = [];
        break;
    }

    activeFilters.value = nextFilters;
    syncDraftWithActiveIfNeeded();
    options.applyQuery();
  };

  const clearAllFilters = () => {
    const country = activeFilters.value.country;
    options.activeMethodCard.value = null;
    activeFilters.value = createDefaultFilterState(country);
    syncDraftWithActiveIfNeeded();
    options.applyQuery();
  };

  const getCurrentFilterConfig = () =>
    buildPresetConfig(activeFilters.value, options.getQualifyRules());

  const handlePresetApply = (config: Record<string, any>) => {
    // preset 里 category/fulfillment/createdWeeks 存的是数组,
    // 但 SelectionQueryParams 里 category 是逗号分隔字符串;
    // 其他数组字段不属于查询表单,只属于 activeFilters,不应回灌到 formData
    options.patchQueryParams({
      country: config.country ?? undefined,
      sellerSelect: config.sellerSelect ?? undefined,
      category: Array.isArray(config.category)
        ? config.category.join(",")
        : (config.category ?? undefined),
    });
    if (Array.isArray(config?.qualifyRules)) {
      options.setQualifyRules(config.qualifyRules);
    }
    activeFilters.value = createFilterStateFromConfig(config);
    activeFilters.value.country = normalizeCountry(activeFilters.value.country);
    syncDraftWithActiveIfNeeded();
    options.applyQuery();
  };

  const setCountry = (country: string) => {
    activeFilters.value.country = country;
    draftFilters.value.country = country;
  };

  return {
    activeFilters,
    draftFilters,
    filterDrawerVisible,
    activeFilterChips,
    handleReset,
    onBarCountryChange,
    onBarCategoryChange,
    openFilterDrawer,
    handleDrawerConfirm,
    handleDrawerReset,
    removeChip,
    clearAllFilters,
    getCurrentFilterConfig,
    handlePresetApply,
    setCountry,
  };
}
