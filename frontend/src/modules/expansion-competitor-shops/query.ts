import type { ShopProductSelectionParams } from '@/api/shopCollection'

export type ExpansionMarketplace = 'UK' | 'DE' | 'US'
export type ListingWindow = 'ALL' | '30' | '90'
export type ExpansionSort = 'salesVolume' | 'listingDate' | 'price' | 'createdAt'

export interface ExpansionProductFilters {
  marketplace: ExpansionMarketplace
  batch: string
  keyword: string
  sellerName: string
  listingWindow: ListingWindow
  sortBy: ExpansionSort
  sortOrder: 'asc' | 'desc'
}

const ASIN_PATTERN = /^[A-Z0-9]{10}$/

export function createExpansionFilters(
  marketplace: ExpansionMarketplace = 'UK',
): ExpansionProductFilters {
  return {
    marketplace,
    batch: '',
    keyword: '',
    sellerName: '',
    listingWindow: 'ALL',
    sortBy: 'salesVolume',
    sortOrder: 'desc',
  }
}

export function buildExpansionProductQuery(
  filters: ExpansionProductFilters,
  page: number,
  size: number,
): ShopProductSelectionParams {
  const keyword = filters.keyword.trim()
  const normalizedAsin = keyword.toUpperCase()
  const isAsin = ASIN_PATTERN.test(normalizedAsin)

  return {
    marketplace: filters.marketplace,
    page,
    size,
    batchDates: filters.batch ? [filters.batch] : undefined,
    asins: isAsin ? [normalizedAsin] : undefined,
    title: keyword && !isAsin ? keyword : undefined,
    sellerName: filters.sellerName.trim() || undefined,
    listingDaysMax:
      filters.listingWindow === 'ALL'
        ? undefined
        : Number(filters.listingWindow),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }
}
