import { describe, expect, it } from 'vitest'
import { buildShopScreeningQuery, createShopScreeningFilters } from './shopScreening'

describe('shop screening query mapping', () => {
  it('maps weekly batches and multiline seller names', () => {
    const filters = createShopScreeningFilters('UK')
    filters.range.createdWeeks = ['2026-W29', '2026-W28']
    filters.sellerNamesText = 'PARKTION\nGAMZE HOME, PARKTION'
    filters.minM01HitCount = 3
    filters.avgListingDaysMax = 120
    filters.range.listingDaysMax = 90
    filters.range.weightMax = 300
    filters.sortBy = 'passedProductCount'

    expect(buildShopScreeningQuery(filters, 'ALL', 2, 30)).toMatchObject({
      marketplace: 'UK',
      scope: 'ALL',
      batchCodes: ['2026-W29', '2026-W28'],
      sellerNames: ['PARKTION', 'GAMZE HOME', 'PARKTION'],
      listingDaysMax: 90,
      weightMax: 300,
      minM01HitCount: 3,
      avgListingDaysMax: 120,
      page: 2,
      size: 30,
    })
  })

  it('does not send empty optional filters', () => {
    const query = buildShopScreeningQuery(createShopScreeningFilters(), 'WATCHLIST', 1, 20)
    expect(query.scope).toBe('WATCHLIST')
    expect(query.batchCodes).toBeUndefined()
    expect(query.sellerNames).toBeUndefined()
    expect(query.m01Only).toBeUndefined()
  })
})
