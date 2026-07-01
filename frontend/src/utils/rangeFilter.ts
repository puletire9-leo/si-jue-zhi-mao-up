import type { RangeFilterValue } from "@/components/RangeFilterPanel/index.vue";

export function createEmptyRangeFilter(): RangeFilterValue {
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

export function cloneRangeFilter(v: RangeFilterValue): RangeFilterValue {
  return {
    priceMin: v.priceMin ?? null,
    priceMax: v.priceMax ?? null,
    unitsMin: v.unitsMin ?? null,
    unitsMax: v.unitsMax ?? null,
    listingDaysMin: v.listingDaysMin ?? null,
    listingDaysMax: v.listingDaysMax ?? null,
    bsrMax: v.bsrMax ?? null,
    weightMax: v.weightMax ?? null,
    variantCountMax: v.variantCountMax ?? null,
    fulfillment: [...(v.fulfillment ?? [])],
    createdWeeks: [...(v.createdWeeks ?? [])],
    category: [...(v.category ?? [])],
    grade: [...(v.grade ?? [])],
    listingPreset: v.listingPreset ?? null,
  };
}
