import type { RangeFilterValue } from '@/components/RangeFilterPanel/index.vue'
import type { ShopScreeningQuery } from '@/api/shopCollection'

export interface ShopScreeningFilters {
  marketplace: string
  sellerKeyword: string
  sellerNamesText: string
  minProductCount: number | null
  minPassedProductCount: number | null
  minM01HitCount: number | null
  avgListingDaysMax: number | null
  watchlistStatus: string
  sourceType: string
  m01Only: boolean
  sortBy: NonNullable<ShopScreeningQuery['sortBy']>
  sortOrder: 'asc' | 'desc'
  range: RangeFilterValue
}

export function createShopScreeningFilters(marketplace = 'UK'): ShopScreeningFilters {
  return {
    marketplace,
    sellerKeyword: '',
    sellerNamesText: '',
    minProductCount: null,
    minPassedProductCount: null,
    minM01HitCount: null,
    avgListingDaysMax: null,
    watchlistStatus: '',
    sourceType: '',
    m01Only: false,
    sortBy: 'passedProductCount',
    sortOrder: 'desc',
    range: {
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
    },
  }
}

export function cloneShopScreeningFilters(value: ShopScreeningFilters): ShopScreeningFilters {
  return {
    ...value,
    range: {
      ...value.range,
      fulfillment: [...value.range.fulfillment],
      createdWeeks: [...value.range.createdWeeks],
      category: [...value.range.category],
      grade: [...value.range.grade],
    },
  }
}

export function buildShopScreeningQuery(
  filters: ShopScreeningFilters,
  scope: 'ALL' | 'WATCHLIST',
  page: number,
  size: number,
): ShopScreeningQuery {
  const range = filters.range
  return {
    marketplace: filters.marketplace,
    scope,
    batchCodes: range.createdWeeks.length ? [...range.createdWeeks] : undefined,
    sellerNames: filters.sellerNamesText.trim()
      ? filters.sellerNamesText.split(/[,\r\n]+/).map((item) => item.trim()).filter(Boolean)
      : undefined,
    sellerKeyword: filters.sellerKeyword.trim() || undefined,
    watchlistStatus: filters.watchlistStatus || undefined,
    sourceType: filters.sourceType || undefined,
    priceMin: range.priceMin ?? undefined,
    priceMax: range.priceMax ?? undefined,
    unitsMin: range.unitsMin ?? undefined,
    unitsMax: range.unitsMax ?? undefined,
    listingDaysMin: range.listingDaysMin ?? undefined,
    listingDaysMax: range.listingDaysMax ?? undefined,
    bsrMax: range.bsrMax ?? undefined,
    weightMax: range.weightMax ?? undefined,
    maxVariantCount: range.variantCountMax ?? undefined,
    fulfillment: range.fulfillment.length ? [...range.fulfillment] : undefined,
    categories: range.category.length ? [...range.category] : undefined,
    m01Only: filters.m01Only || undefined,
    minProductCount: filters.minProductCount ?? undefined,
    minPassedProductCount: filters.minPassedProductCount ?? undefined,
    minM01HitCount: filters.minM01HitCount ?? undefined,
    avgListingDaysMax: filters.avgListingDaysMax ?? undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
    size,
  }
}
