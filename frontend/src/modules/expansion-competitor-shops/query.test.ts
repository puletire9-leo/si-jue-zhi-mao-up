import { describe, expect, it } from 'vitest'
import {
  buildExpansionProductQuery,
  createExpansionFilters,
} from './query'

describe('expansion competitor shop query', () => {
  it('keeps the selected batch and maps an ASIN to exact search', () => {
    const filters = createExpansionFilters('UK')
    filters.batch = '2026-W32'
    filters.keyword = 'b0h4fmhwn4'
    filters.listingWindow = '30'

    expect(buildExpansionProductQuery(filters, 2, 48)).toEqual({
      marketplace: 'UK',
      page: 2,
      size: 48,
      batchDates: ['2026-W32'],
      asins: ['B0H4FMHWN4'],
      title: undefined,
      sellerName: undefined,
      listingDaysMax: 30,
      sortBy: 'salesVolume',
      sortOrder: 'desc',
    })
  })

  it('uses title and seller filters without adding empty values', () => {
    const filters = createExpansionFilters('DE')
    filters.keyword = 'wall decor'
    filters.sellerName = '  Example Shop  '

    expect(buildExpansionProductQuery(filters, 1, 96)).toMatchObject({
      marketplace: 'DE',
      title: 'wall decor',
      sellerName: 'Example Shop',
      asins: undefined,
      listingDaysMax: undefined,
    })
  })
})
