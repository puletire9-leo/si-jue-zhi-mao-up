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
    expect(plan.params.filterMode).toBeUndefined();
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

  it("passes all selected created weeks into M01 plans", () => {
    const intent = buildSelectionFilterIntent({
      scene: "all",
      methodId: "M01",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        range: {
          ...createRange(),
          createdWeeks: ["2026-W29", "2026-W28"],
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

    expect(plan.params.createdWeeks).toEqual(["2026-W29", "2026-W28"]);
    expect(plan.params.createdWeek).toBeUndefined();
    expect(plan.unsupportedFilters).not.toContain("snapshotKeys");
  });

  it("passes selected ranking categories into M01 product queries", () => {
    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: "M01",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        country: "US",
        category: ["Home & Kitchen", "Arts, Crafts & Sewing"],
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });

    expect(plan.executor).toBe("method_card");
    if (plan.executor !== "method_card") {
      throw new Error("expected method card plan");
    }
    expect(plan.params.marketplace).toBe("US");
    expect(plan.params.categories).toEqual([
      "Home & Kitchen",
      "Arts, Crafts & Sewing",
    ]);
    expect(plan.unsupportedFilters).not.toContain("category");
  });

  it.each(["M01", "M03"] as const)(
    "keeps %s on shop_products in the reference scene",
    (methodId) => {
      const intent = buildSelectionFilterIntent({
        scene: "reference",
        methodId,
        queryParams: createQueryParams(),
        activeFilters: createFilterState(),
        useCleanTable: true,
      });

      const plan = buildSelectionQueryPlan({ intent, page: 2, size: 60 });

      expect(plan.executor).toBe("shop_products");
      if (plan.executor !== "shop_products") {
        throw new Error("expected shop-products plan");
      }
      expect(plan.targetSource).toBe("shop_products");
      expect(plan.methodId).toBe(methodId);
      expect(plan.params.methodId).toBe(methodId);
    },
  );

  it("treats an empty active category array as an explicit clear", () => {
    const intent = buildSelectionFilterIntent({
      scene: "reference",
      methodId: "M01",
      queryParams: createQueryParams({ category: "Stale Category" }),
      activeFilters: createFilterState({ category: [] }),
      useCleanTable: false,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
    expect(plan.executor).toBe("shop_products");
    if (plan.executor !== "shop_products") {
      throw new Error("expected shop-products plan");
    }
    expect(plan.params.categories).toBeUndefined();
  });

  it("preserves commas inside full shop category paths", () => {
    const fullPath =
      "Arts, Crafts & Sewing:Crafting:Patio, Lawn & Garden";
    const intent = buildSelectionFilterIntent({
      scene: "reference",
      methodId: "M01",
      queryParams: createQueryParams(),
      activeFilters: createFilterState({ category: [fullPath] }),
      useCleanTable: false,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
    expect(plan.executor).toBe("shop_products");
    if (plan.executor !== "shop_products") {
      throw new Error("expected shop-products plan");
    }
    expect(plan.params.categories).toEqual([fullPath]);
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

    // 核心断言: 数组输入没有触发 raw.split is not a function 崩溃。
    // 多 ASIN 会进入精准搜索模式，因此其他普通筛选应被忽略。
    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }
    expect(plan.params.asin).toEqual(["B01", "B02"]);
    expect(plan.params.category).toBeUndefined();
  });

  it("passes every ASIN from multiline precise search without intersecting normal filters", () => {
    const qualifyRules: QualifyRule[] = [
      {
        conditions: [
          { field: "listingDays", op: "le", value: 30 },
          { field: "units", op: "gt", value: 30 },
        ],
      },
    ];
    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: "M01",
      queryParams: createQueryParams({
        asin: "B0H1C5W6KV\nB0H3YW76MV\r\nB0H6PDFPSD",
        dataFilterMode: "MODE1",
      }),
      activeFilters: createFilterState({
        category: ["Toys & Games"],
        range: {
          ...createRange(),
          unitsMin: 30,
          listingDaysMax: 30,
          createdWeeks: ["2026-W29"],
        },
      }),
      useCleanTable: true,
      qualifyRules,
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
    expect(plan.params.asin).toEqual([
      "B0H1C5W6KV",
      "B0H3YW76MV",
      "B0H6PDFPSD",
    ]);
    expect(plan.methodId).toBeNull();
    expect(plan.params.filterMode).toBeUndefined();
    expect(plan.params.category).toBeUndefined();
    expect(plan.params.unitsMin).toBeUndefined();
    expect(plan.params.listingDaysMax).toBeUndefined();
    expect(plan.params.createdWeeks).toBeUndefined();
    expect(plan.params.qualifyRules).toBeUndefined();
    expect(plan.latestSnapshotFallback).toBeUndefined();
  });

  it("treats a single ASIN as an exact lookup and bypasses M01 and normal filters", () => {
    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: "M01",
      queryParams: createQueryParams({
        asin: "B0H5K617VH",
        productTitle: "ignored title",
      }),
      activeFilters: createFilterState({
        category: ["Ignored category"],
        range: {
          ...createRange(),
          unitsMin: 30,
          listingDaysMax: 30,
          createdWeeks: ["2026-W29", "2026-W30"],
        },
      }),
      useCleanTable: true,
      qualifyRules: [
        {
          conditions: [{ field: "units", op: "gt", value: 30 }],
        },
      ],
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });

    expect(plan.executor).toBe("competitor");
    if (plan.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }
    expect(plan.params.asin).toEqual(["B0H5K617VH"]);
    expect(plan.methodId).toBeNull();
    expect(plan.params.title).toBeUndefined();
    expect(plan.params.category).toBeUndefined();
    expect(plan.params.unitsMin).toBeUndefined();
    expect(plan.params.listingDaysMax).toBeUndefined();
    expect(plan.params.createdWeeks).toBeUndefined();
    expect(plan.params.qualifyRules).toBeUndefined();
    expect(plan.latestSnapshotFallback).toBeUndefined();
  });

  it.each([
    ["reference", "shop_products"],
    ["premium", "premium_products"],
    ["zheng", "deng_zong"],
  ] as const)(
    "keeps single-ASIN lookup semantics unified for %s",
    (scene, expectedExecutor) => {
      const intent = buildSelectionFilterIntent({
        scene,
        methodId: scene === "zheng" ? null : "M01",
        queryParams: createQueryParams({ asin: "B0H5K617VH" }),
        activeFilters: createFilterState({
          category: ["Ignored"],
          range: {
            ...createRange(),
            unitsMin: 10,
            listingDaysMax: 90,
            createdWeeks: ["2026-W29"],
          },
        }),
        useCleanTable: true,
      });

      const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
      expect(plan.executor).toBe(expectedExecutor);
      expect(plan.methodId).toBeNull();

      if (plan.executor === "competitor" || plan.executor === "premium_products") {
        expect(plan.params.asin).toEqual(["B0H5K617VH"]);
        expect(plan.params.unitsMin).toBeUndefined();
        expect(plan.params.listingDaysMax).toBeUndefined();
        expect(plan.params.createdWeeks).toBeUndefined();
      } else if (plan.executor === "shop_products") {
        expect(plan.params.asins).toEqual(["B0H5K617VH"]);
        expect(plan.params.unitsMin).toBeUndefined();
        expect(plan.params.listingDaysMax).toBeUndefined();
        expect(plan.params.batchDates).toBeUndefined();
      } else if (plan.executor === "deng_zong") {
        expect(plan.params.asins).toEqual(["B0H5K617VH"]);
        expect(plan.params.unitsMin).toBeUndefined();
        expect(plan.params.listingDaysMax).toBeUndefined();
        expect(plan.params.batchDate).toBeUndefined();
      } else {
        throw new Error("exact ASIN lookup must not use a method-card executor");
      }
    },
  );

  it("passes all visible zheng filters and listing-date sorting to the backend", () => {
    const intent = buildSelectionFilterIntent({
      scene: "zheng",
      methodId: null,
      queryParams: createQueryParams(),
      activeFilters: createFilterState({
        sortField: "listingDate",
        sortOrder: "desc",
        range: {
          ...createRange(),
          unitsMin: 10,
          unitsMax: 200,
          listingDaysMin: 5,
          listingDaysMax: 90,
          weightMax: 300,
          fulfillment: ["FBA"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 2, size: 60 });
    expect(plan.executor).toBe("deng_zong");
    if (plan.executor !== "deng_zong") throw new Error("expected zheng plan");

    expect(plan.params.unitsMin).toBe(10);
    expect(plan.params.unitsMax).toBe(200);
    expect(plan.params.listingDaysMin).toBe(5);
    expect(plan.params.listingDaysMax).toBe(90);
    expect(plan.params.weightMax).toBe(300);
    expect(plan.params.fulfillment).toEqual(["FBA"]);
    expect(plan.params.sortBy).toBe("listingDate");
    expect(plan.params.sortOrder).toBe("desc");
    expect(plan.unsupportedFilters).toEqual([]);
  });

  it("passes precise ASIN searches to the zheng backend without normal filters", () => {
    const intent = buildSelectionFilterIntent({
      scene: "zheng",
      methodId: null,
      queryParams: createQueryParams({
        asin: "B0H1C5W6KV\nB0H3YW76MV",
      }),
      activeFilters: createFilterState({
        range: { ...createRange(), unitsMin: 10, listingDaysMax: 90 },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
    expect(plan.executor).toBe("deng_zong");
    if (plan.executor !== "deng_zong") throw new Error("expected zheng plan");
    expect(plan.params.asins).toEqual(["B0H1C5W6KV", "B0H3YW76MV"]);
    expect(plan.params.unitsMin).toBeUndefined();
    expect(plan.params.listingDaysMax).toBeUndefined();
  });

  it("shows premium raw data by default without applying a method card", () => {
    const intent = buildSelectionFilterIntent({
      scene: "premium",
      methodId: null,
      queryParams: createQueryParams(),
      activeFilters: createFilterState(),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
    expect(plan.executor).toBe("premium_products");
    if (plan.executor !== "premium_products") {
      throw new Error("expected premium plan");
    }
    expect(plan.targetSource).toBe("premium_products");
    expect(plan.methodId).toBeNull();
    expect(plan.params.methodId).toBeUndefined();
    expect(plan.params.useCleanTable).toBe(false);
    expect(plan.params.source).toBeUndefined();
    expect(plan.latestSnapshotFallback?.kind).toBe("premium_created_week");
  });

  it("keeps M01 and visible filters on premium_products", () => {
    const intent = buildSelectionFilterIntent({
      scene: "premium",
      methodId: "M01",
      queryParams: createQueryParams({ productTitle: "lamp" }),
      activeFilters: createFilterState({
        category: ["Home"],
        range: {
          ...createRange(),
          priceMin: 5,
          unitsMin: 10,
          listingDaysMax: 90,
          createdWeeks: ["2026-W29"],
        },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 2, size: 100 });
    expect(plan.executor).toBe("premium_products");
    if (plan.executor !== "premium_products") {
      throw new Error("expected premium plan");
    }
    expect(plan.params.methodId).toBe("M01");
    expect(plan.params.title).toBe("lamp");
    expect(plan.params.category).toBe("Home");
    expect(plan.params.priceMin).toBe(5);
    expect(plan.params.unitsMin).toBe(10);
    expect(plan.params.listingDaysMax).toBe(90);
    expect(plan.params.createdWeeks).toEqual(["2026-W29"]);
  });

  it("does not combine precise premium ASIN search with M01 or normal filters", () => {
    const intent = buildSelectionFilterIntent({
      scene: "premium",
      methodId: "M01",
      queryParams: createQueryParams({
        asin: "B0H1C5W6KV\nB0H3YW76MV",
        productTitle: "ignored",
      }),
      activeFilters: createFilterState({
        category: ["Ignored"],
        range: { ...createRange(), unitsMin: 10, createdWeeks: ["2026-W29"] },
      }),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({ intent, page: 1, size: 60 });
    expect(plan.executor).toBe("premium_products");
    if (plan.executor !== "premium_products") {
      throw new Error("expected premium plan");
    }
    expect(plan.params.asin).toEqual(["B0H1C5W6KV", "B0H3YW76MV"]);
    expect(plan.params.methodId).toBeUndefined();
    expect(plan.params.title).toBeUndefined();
    expect(plan.params.category).toBeUndefined();
    expect(plan.params.unitsMin).toBeUndefined();
    expect(plan.params.createdWeeks).toBeUndefined();
  });
});
