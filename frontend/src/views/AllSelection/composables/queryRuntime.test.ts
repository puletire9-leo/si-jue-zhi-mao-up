import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/competitor", () => ({
  competitorApi: {
    getList: vi.fn(),
    getDengZongShopList: vi.fn(),
  },
  getCreatedWeeks: vi.fn(),
  getDengZongBatchDates: vi.fn(),
  normalizeProduct: vi.fn((item: Record<string, any>) => ({
    ...item,
    normalized: true,
  })),
}));

vi.mock("@/api/methodCards", () => ({
  methodCardsApi: {
    getM01Products: vi.fn(),
    getM02Products: vi.fn(),
  },
}));

import {
  competitorApi,
  getCreatedWeeks,
  getDengZongBatchDates,
} from "@/api/competitor";

import {
  buildSelectionFilterIntent,
  buildSelectionQueryPlan,
  type SelectionFilterState,
} from "./queryPlan";
import {
  applyLatestSnapshotFallback,
  executeSelectionQueryPlan,
  resolveSelectionQueryPlan,
} from "./queryRuntime";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("queryRuntime", () => {
  it("passes filterMode into latest created-week fallback", async () => {
    vi.mocked(getCreatedWeeks).mockResolvedValue({
      data: [{ week: "2026-W26" }],
    } as any);

    const intent = buildSelectionFilterIntent({
      scene: "new",
      methodId: null,
      queryParams: {
        asin: "",
        productTitle: "",
        keyword: "",
        searchType: "asin",
        productType: "",
        storeName: "",
        sellerSelect: "",
        category: "",
        country: "UK",
        dataFilterMode: "MODE1",
        listingDateStart: "",
        listingDateEnd: "",
        grade: "",
        weekTag: "",
        isCurrent: "",
        sortField: "score",
        sortOrder: "desc",
        startDate: "",
        endDate: "",
      },
      activeFilters: createFilterState(),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    const resolved = await applyLatestSnapshotFallback(plan);

    expect(getCreatedWeeks).toHaveBeenCalledWith("UK", "新品榜", "MODE1");
    if (resolved.executor !== "competitor") {
      throw new Error("expected competitor plan");
    }
    expect(resolved.params.createdWeeks).toEqual(["2026-W26"]);
    expect(resolved.forcedFilters).toContain("latestWeek=2026-W26");
  });

  it("normalizes deng_zong executor results", async () => {
    vi.mocked(competitorApi.getDengZongShopList).mockResolvedValue({
      data: {
        list: [{ asin: "B001" }],
        total: 1,
      },
    } as any);

    const result = await executeSelectionQueryPlan({
      executor: "deng_zong",
      lensId: "default",
      methodId: null,
      targetSource: "deng_zong",
      params: {
        marketplace: "UK",
        page: 1,
        size: 60,
      },
      unsupportedFilters: [],
      forcedFilters: [],
    });

    expect(competitorApi.getDengZongShopList).toHaveBeenCalledWith({
      marketplace: "UK",
      page: 1,
      size: 60,
    });
    expect(result.total).toBe(1);
    expect(result.list[0]).toMatchObject({
      asin: "B001",
      normalized: true,
    });
  });

  it("resolves latest batch fallback before running deng_zong query", async () => {
    vi.mocked(getDengZongBatchDates).mockResolvedValue({
      data: [{ batchDate: "20260629", count: 12 }],
    } as any);
    vi.mocked(competitorApi.getDengZongShopList).mockResolvedValue({
      data: {
        list: [],
        total: 0,
      },
    } as any);

    const intent = buildSelectionFilterIntent({
      scene: "zheng",
      methodId: null,
      queryParams: {
        asin: "",
        productTitle: "",
        keyword: "",
        searchType: "asin",
        productType: "",
        storeName: "",
        sellerSelect: "",
        category: "",
        country: "UK",
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
      },
      activeFilters: createFilterState(),
      useCleanTable: true,
    });

    const plan = buildSelectionQueryPlan({
      intent,
      page: 1,
      size: 60,
    });

    const resolved = await resolveSelectionQueryPlan(plan);

    expect(getDengZongBatchDates).toHaveBeenCalledWith("UK");
    expect(competitorApi.getDengZongShopList).toHaveBeenCalledWith({
      marketplace: "UK",
      page: 1,
      size: 60,
      batchDate: "20260629",
      sortBy: "score",
      sortOrder: "desc",
    });
    expect(resolved.plan.forcedFilters).toContain("latestBatchDate=20260629");
  });
});
