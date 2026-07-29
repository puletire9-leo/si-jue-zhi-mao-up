import request from '@/utils/request'

export interface DengZongShopSeller {
  id: number
  marketplace: string
  sellerName: string
  storeUrl: string | null
  notes: string | null
  lastSyncedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface DengZongSyncResult {
  runId: string
  status: string
  requestType: 'DENG_ZONG_SHOP_SYNC'
  requestMode: 'DENG_ZONG_REPEATABLE'
  requestedCount: number
  queuedCount: number
  skippedCount: number
  skippedShops: string[]
  repeatPolicy: string
}

function unwrap<T>(promise: Promise<any>): Promise<T> {
  return promise.then(response => response?.data as T)
}

const BASE = '/api/v1/deng-zong-shop'

export const dengZongShopApi = {
  listSellers(marketplace?: string): Promise<DengZongShopSeller[]> {
    return unwrap(request({ url: `${BASE}/sellers`, method: 'get', params: marketplace ? { marketplace } : undefined }))
  },
  createSeller(data: Pick<DengZongShopSeller, 'marketplace' | 'sellerName'> & Partial<Pick<DengZongShopSeller, 'storeUrl' | 'notes'>>): Promise<DengZongShopSeller> {
    return unwrap(request({ url: `${BASE}/sellers`, method: 'post', data }))
  },
  updateSeller(id: number, data: Partial<DengZongShopSeller>): Promise<DengZongShopSeller> {
    return unwrap(request({ url: `${BASE}/sellers/${id}`, method: 'put', data }))
  },
  deleteSeller(id: number): Promise<void> {
    return unwrap(request({ url: `${BASE}/sellers/${id}`, method: 'delete' }))
  },
  createSyncTask(sellerIds: number[]): Promise<DengZongSyncResult> {
    return unwrap(request({ url: `${BASE}/sync/batch`, method: 'post', data: { sellerIds } }))
  }
}
