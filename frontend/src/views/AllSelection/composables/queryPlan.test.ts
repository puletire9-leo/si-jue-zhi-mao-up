import { describe, expect, it } from "vitest";

import type { QualifyRule } from "@/api/competitor";
import type { SelectionQueryParams } from "@/components/SelectionQueryForm/types";

import {
  buildSelectionFilterIntent,
  buildSelectionQueryPlan,
  type SelectionFilterState,
} from "./queryPlan";

function createRange() {
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

function createQueryParams(
  overrides: Partial<SelectionQueryParams> = {},
): SelectionQueryParams {
  return {
    asin: "",
    productTitle: "",
    keyword: "",
    searchType: "asin",
    productType: "",
    storeName: "",
    sellerSelect: "",
    category: "",
    country: "",
    dataFilterMode: "",
    listingDateStart: "",
    listingDateEnd: "",
    grade: "",
    weekTag: "",
    isCurrent: "",
    sortField: "score",
    sortOrder: "desc",
    startDate: "",
    endDate: "",
    ...overrides,
  };
}

function createFilterState(
  overrides: Partial<SelectionFilterState> = {},
): SelectionFilterState {
  return {
    country: "UK",
    sellerSelect: "",
    category: [],
    sortField: "score",
    sortOrder: "desc",
    range: createRange(),
    ...overrides,
  };
}

describe("buildSelectionQueryPlan", () => {
  it("includes unified drawer filters and qualify rules in competitor plans", () => {
    const qualifyRules: QualifyRule[] = [
      {
        conditions: [{ field: "units", op: "gt", value: 30 }],
      },
    ];

    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: null,
      queryParams: createQueryParams({
        productTitle: "desk lamp",
        storeName: "query-store",
        dataFilterMode: "MODE1",
      }),
      activeFilters: createFilterState({
        sellerSelect: "drawer-store",
        category: ["Home", "Kitchen"],
        sortField: "createdAt",
        sortOrder: "asc",
        range: {
          ...createRange(),
          variantCountMax: 3,
          fulfillment: ["FBA"],
          createdWeeks: ["2026-W26"],
        },
      }),
      useCleanTable: true,
      qualifyRules,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 2,
      size: 60,
    });

    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }

    expect(plan.params.sellerName).toBe("drawer-store");
    expect(plan.params.category).toBe("Home,Kitchen");
    expect(plan.params.maxVariantCount).toBe(3);
    expect(plan.params.fulfillment).toEqual(["FBA"]);
    expect(plan.params.createdWeeks).toEqual(["2026-W26"]);
    expect(plan.params.qualifyRules).toEqual(qualifyRules);
    expect(plan.params.title).toBe("desk lamp");
    expect(plan.params.filterMode).toBe("MODE1");
    expect(plan.params.sortBy).toBe("createdAt");
    expect(plan.params.sortOrder).toBe("asc");
  });

  it("keeps zheng batch filters as batch-date csv instead of competitor weeks", () => {
    const intent = buildSelectionFilterIntent({
      scene: "zheng",
      methodId: null,
      queryParams: createQueryParams({
        productTitle: "storage box",
      }),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          variantCountMax: 2,
          createdWeeks: ["20260629", "20260622"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("deng_zong");
    if (plan.executor !== "deng_zong") {
      throw new Error("expected zheng plan");
    }

    expect(plan.params.batchDate).toBe("20260629,20260622");
    expect(plan.params.maxVariantCount).toBe(2);
    expect(plan.latestSnapshotFallback).toBeUndefined();
  });

  it("lets M02 consume selected batch dates instead of flagging them unsupported", () => {
    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: "M02",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["20260629"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }

    expect(plan.params.batchDate).toBe("20260629");
    expect(plan.unsupportedFilters).not.toContain("snapshotKeys");
  });

  it("passes a single selected created week into M01 plans", () => {
    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: "M01",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["2026-W26"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }

    expect(plan.params.createdWeek).toBe("2026-W26");
    expect(plan.unsupportedFilters).not.toContain("snapshotKeys");
  });

  it("keeps M03 independent from stale snapshots and product-line scope", () => {
    const intent = buildSelectionFilterIntent({
      scene: "fbm",
      methodId: "M03",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["2026-W26"],
        },
      }),
      useCleanTable: true,
      overrides: {
        bsrId: "2076534031",
        nodeId: 2076534031,
      },
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(intent.scope.businessSource).toBeUndefined();
    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }

    expect(plan.methodId).toBe("M03");
    expect(plan.params.createdWeek).toBeUndefined();
    expect(plan.params.bsrId).toBeUndefined();
    expect(plan.params.nodeId).toBeUndefined();
    expect(plan.forcedFilters).toContain("latestM03EffectiveWeek");
    expect(plan.unsupportedFilters).toContain("snapshotKeys");
  });

  it("marks multi-selected snapshots unsupported for single-snapshot method cards", () => {
    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: "M02",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["20260629", "20260622"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }

    expect(plan.params.batchDate).toBeUndefined();
    expect(plan.unsupportedFilters).toContain("snapshotKeys(single-only)");
  });

  it("accepts product-line overrides for competitor plans", () => {
    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: null,
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        sortField: "price",
        sortOrder: "asc",
      }),
      useCleanTable: true,
      overrides: {
        marketplace: "UK",
        bsrId: "BSR-100",
        nodeId: 12345,
        brand: "ACME",
        keywords: "magnetic foldable",
        groupByParent: false,
        title: "desk organizer",
        sellerName: "demo-seller",
      },
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 3,
      size: 20,
    });

    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }

    expect(plan.params.marketplace).toBe("UK");
    expect(plan.params.bsrId).toBe("BSR-100");
    expect(plan.params.nodeId).toBe(12345);
    expect(plan.params.brand).toBe("ACME");
    expect(plan.params.keywords).toBe("magnetic foldable");
    expect(plan.params.groupByParent).toBe(false);
    expect(plan.params.title).toBe("desk organizer");
    expect(plan.params.sellerName).toBe("demo-seller");
    expect(plan.params.sortBy).toBe("price");
    expect(plan.params.sortOrder).toBe("asc");
  });

  it("passes product-line scope into M02 method-card plans", () => {
    const intent = buildSelectionFilterIntent({
      scene: "zheng",
      methodId: "M02",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["20260629"],
        },
      }),
      useCleanTable: true,
      overrides: {
        bsrId: "BSR-200",
        nodeId: 9988,
      },
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }

    expect(plan.params.batchDate).toBe("20260629");
    expect(plan.params.bsrId).toBe("BSR-200");
    expect(plan.params.nodeId).toBe(9988);
  });

  it("keeps qualify rules for product-line competitor plans when requested", () => {
    const qualifyRules: QualifyRule[] = [
      {
        conditions: [{ field: "bsr", op: "lt", value: 5000 }],
      },
    ];

    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: null,
      queryParams: createQueryParams(),
      activeFilters: createFilterState(),
      useCleanTable: true,
      qualifyRules,
      qualifyRulesMode: "always",
      overrides: {
        bsrId: "BSR-300",
      },
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }

    expect(plan.params.bsrId).toBe("BSR-300");
    expect(plan.params.qualifyRules).toEqual(qualifyRules);
    expect(plan.unsupportedFilters).not.toContain("qualifyRules");
  });

  // 回归: preset apply 会把数组 patch 到 queryParams, splitCsv/splitSearchValues
  // 必须能吃下数组而不是崩 raw.split is not a function
  it("tolerates array-valued asin and category coming from preset apply", () => {
    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: null,
      queryParams: createQueryParams({
        // preset 里 category 是数组; asin 若被误灌数组同样不能崩
        category: ["Home & Kitchen", "Toys"] as unknown as string,
        asin: ["B01", "B02"] as unknown as string,
      }),
      activeFilters: createFilterState(),
      useCleanTable: true,
      qualifyRules: [],
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    // 核心断言: 数组输入没有触发 raw.split is not a function 崩溃
    // 并且 category 数组被正确消化成逗号串 (asin 在 new 场景下会被 method
    // 声明为 unsupported, 因此不再检查具体值)
    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }
    expect(plan.params.category).toBe("Home & Kitchen,Toys");
  });
});
