import request from '@/utils/request'

export type DeveloperLibraryBucket = 'GOOD' | 'BAD'

export interface DeveloperSelectionSnapshot {
  asin: string
  marketplace?: string
  originScene?: 'NEW_PRODUCTS' | 'REFERENCE_PRODUCTS' | string
  originSource?: string
  snapshotKey?: string
  title?: string
  brand?: string
  imageUrl?: string
  price?: number
  units?: number
  bsr?: number
  ratings?: number
  rating?: number
  listingDays?: number
  weightG?: number
  sellerName?: string
  nodeLabelPath?: string
  productUrl?: string
  snapshot?: Record<string, unknown>
}

export interface DeveloperSelectionLibraryItem {
  id: string
  userId: string
  developerName: string
  marketplace: string
  asin: string
  bucket: DeveloperLibraryBucket
  batchId: string | null
  batchName: string | null
  originScene: string | null
  originSource: string | null
  snapshotKey: string | null
  title: string | null
  brand: string | null
  imageUrl: string | null
  price: number | null
  units: number | null
  bsr: number | null
  ratings: number | null
  rating: number | null
  listingDays: number | null
  weightG: number | null
  sellerName: string | null
  nodeLabelPath: string | null
  productUrl: string | null
  snapshotJson: string | null
  createdAt: string
  updatedAt: string
}

export interface DeveloperSelectionPage {
  list: DeveloperSelectionLibraryItem[]
  total: number
  page: number
  size: number
  adminView: boolean
}

export interface DeveloperOption {
  userId: string
  developerName: string
  itemCount: number
}

export interface DeveloperLibraryWeekOption {
  week: string
  count: number
  startDate: string
  endDate: string
}

export interface DeveloperSelectionBatch {
  id: string
  userId: string
  developerName: string
  bucket: DeveloperLibraryBucket
  batchName: string
  batchDate: string
  createdAt: string
  updatedAt: string
}

export interface DeveloperSelectionLibraryQueryParams {
  bucket: DeveloperLibraryBucket
  marketplace?: string
  keyword?: string
  developerId?: string
  batchId?: string
  unassigned?: boolean
  page?: number
  size?: number
  createdWeeks?: string[]
  priceMin?: number
  priceMax?: number
  unitsMin?: number
  unitsMax?: number
  listingDaysMin?: number
  listingDaysMax?: number
  bsrMax?: number
  weightMax?: number
  variantCountMax?: number
  fulfillment?: string[]
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

const BASE = '/api/v1/modules/developer-selection-library'

function devIdentityHeaders(): Record<string, string> | undefined {
  if (!import.meta.env.DEV) return undefined
  try {
    const user = JSON.parse(localStorage.getItem('userInfo') || '{}') as Record<string, unknown>
    const token = localStorage.getItem('token') || ''
    const payloadPart = token.split('.')[1] || ''
    const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')
    const payload = payloadPart
      ? JSON.parse(atob(paddedPayload)) as Record<string, unknown>
      : {}
    const id = String(payload.sub || user.id || '')
    if (!id) return undefined
    return {
      'X-User-Id': id,
      'X-Username': String(payload.username || user.username || ''),
      'X-User-Role': String(payload.role || user.role || '')
    }
  } catch {
    return undefined
  }
}

function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return promise.then((response) => (response as ApiResponse<T>).data)
}

export const developerSelectionLibraryApi = {
  add(payload: {
    bucket: DeveloperLibraryBucket
    targetUserId?: string
    developerName?: string
    items: DeveloperSelectionSnapshot[]
  }): Promise<{
    inserted: number
    updated: number
    total: number
    bucket: DeveloperLibraryBucket
    userId: string
    developerName: string
  }> {
    return unwrap(request({
      url: `${BASE}/items`,
      method: 'post',
      data: payload,
      headers: devIdentityHeaders()
    }))
  },

  list(params: DeveloperSelectionLibraryQueryParams): Promise<DeveloperSelectionPage> {
    return unwrap(request({
      url: `${BASE}/items`,
      method: 'get',
      params,
      headers: devIdentityHeaders()
    }))
  },

  developers(): Promise<DeveloperOption[]> {
    return unwrap(request({
      url: `${BASE}/developers`,
      method: 'get',
      headers: devIdentityHeaders()
    }))
  },

  weeks(params: Pick<DeveloperSelectionLibraryQueryParams, 'bucket' | 'marketplace' | 'developerId'>): Promise<DeveloperLibraryWeekOption[]> {
    return unwrap(request({
      url: `${BASE}/weeks`,
      method: 'get',
      params,
      headers: devIdentityHeaders()
    }))
  },

  batches(params: Pick<DeveloperSelectionLibraryQueryParams, 'bucket' | 'developerId'>): Promise<DeveloperSelectionBatch[]> {
    return unwrap(request({
      url: `${BASE}/batches`,
      method: 'get',
      params,
      headers: devIdentityHeaders()
    }))
  },

  createBatch(payload: {
    bucket: DeveloperLibraryBucket
    batchName: string
    targetUserId?: string
    developerName?: string
  }): Promise<DeveloperSelectionBatch> {
    return unwrap(request({
      url: `${BASE}/batches`,
      method: 'post',
      data: payload,
      headers: devIdentityHeaders()
    }))
  },

  assignBatch(ids: string[], batchId: string): Promise<{ assigned: number }> {
    return unwrap(request({
      url: `${BASE}/batches/assign`,
      method: 'post',
      data: { ids, batchId },
      headers: devIdentityHeaders()
    }))
  },

  unassignBatch(ids: string[]): Promise<{ unassigned: number }> {
    return unwrap(request({
      url: `${BASE}/batches/unassign`,
      method: 'post',
      data: { ids },
      headers: devIdentityHeaders()
    }))
  },

  convert(ids: string[], targetBucket: DeveloperLibraryBucket): Promise<{ converted: number }> {
    return unwrap(request({
      url: `${BASE}/convert`,
      method: 'post',
      data: { ids, targetBucket },
      headers: devIdentityHeaders()
    }))
  },

  remove(ids: string[]): Promise<{ deleted: number }> {
    return unwrap(request({
      url: `${BASE}/items`,
      method: 'delete',
      data: { ids },
      headers: devIdentityHeaders()
    }))
  }
}
