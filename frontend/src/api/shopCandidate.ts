import request from '@/utils/request'

/** 店铺候选池记录（后端 shop_candidate_pool 映射） */
export interface ShopCandidatePool {
  id: number
  marketplace: string
  sellerName: string
  sellerId: string | null
  sourceType: string
  sourceCode: string
  batchCode: string
  batchDate: string | null
  reason: string | null
  hitCount: number | null
  topCategory: string | null
  salesTierSummaryJson: string | null
  sampleProductsJson: string | null
  status: string
  watchlistId: number | null
  fetchRunId: string | null
  premiumId: number | null
  lastErrorMessage: string | null
  lastFetchAt: string | null
  operator: string | null
  note: string | null
  createdAt: string | null
  updatedAt: string | null
  requested: boolean
}

/** 店铺抓取运行记录（后端 shop_fetch_run 映射） */
export interface ShopFetchRun {
  runId: string
  marketplace: string
  sellerName: string
  triggerType: string
  triggerId: number | null
  fetchReason: string | null
  batchCode: string | null
  batchDate: string | null
  variationMode: string
  total: number | null
  fetchedCount: number | null
  writtenCount: number | null
  failedCount: number | null
  apiCalls: number | null
  status: string
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
}

/** 通用分页响应（与 shopCollection.ts 同范式） */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

/** 候选池同步结果 */
export interface CandidateSyncResult {
  methodId: string
  marketplace: string | null
  batchCode: string
  minCount: number
  limit: number
  rankedShops: number
  upserted: number
}

/** 店铺请求中心来源批次（M01 当前来自 competitor_products_clean.effective_week_tag） */
export interface ShopMethodBatchOption {
  methodId: string
  marketplace: string
  batchCode: string
  sourceTable: string
  sourceWeekField: string
  productCount: number
  sellerCount: number
  latestCreatedAt: string | null
}

/** 确认抓取结果 */
export interface ConfirmFetchResult {
  candidateId: number
  runId?: string
  watchlistId?: number
  sellerName?: string
  marketplace?: string
  total?: number
  fetchedCount?: number
  writtenCount?: number
  failedCount?: number
  apiCalls?: number
  status: string
  error?: string
}

/** Result<T> 解包 */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T)
}

const BASE = '/api/v1/modules/shop-candidates'

export const shopCandidateApi = {
  /** 店铺请求中心来源批次：用于周批次下拉，避免手输和 created_at 周次口径混用 */
  methodBatches(params: {
    methodId?: string
    marketplace?: string
    limit?: number
  }): Promise<ShopMethodBatchOption[]> {
    return unwrap<ShopMethodBatchOption[]>(
      request({ url: `${BASE}/method-batches`, method: 'get', params })
    )
  },

  /** 全部找店来源批次，不要求批次内商品通过 M01。 */
  sourceBatches(params: {
    marketplace?: string
    limit?: number
  }): Promise<ShopMethodBatchOption[]> {
    return unwrap<ShopMethodBatchOption[]>(
      request({ url: `${BASE}/source-batches`, method: 'get', params })
    )
  },

  /** 方法卡排名同步候选池（替代旧的直写观察池） */
  syncFromMethodRank(methodId = 'M01', marketplace?: string, minCount = 1, batchCode?: string, limit = 1000): Promise<CandidateSyncResult> {
    return unwrap<CandidateSyncResult>(
      request({
        url: `${BASE}/sync-from-method-rank`,
        method: 'post',
        params: { methodId, minCount, limit, ...(marketplace ? { marketplace } : {}), ...(batchCode ? { batchCode } : {}) },
        timeout: 120000
      })
    )
  },

  /** 将指定周批次的全部店铺写入候选池，不判断方法卡是否通过。 */
  syncAllFromBatch(marketplace: string | undefined, batchCode: string): Promise<CandidateSyncResult> {
    return unwrap<CandidateSyncResult>(
      request({
        url: `${BASE}/sync-all-from-batch`,
        method: 'post',
        params: { batchCode, ...(marketplace ? { marketplace } : {}) },
        timeout: 600000
      })
    )
  },

  /** 候选池分页查询 */
  list(params: {
    marketplace?: string
    batchCode?: string
    sourceType?: string
    sourceCode?: string
    status?: string
    minHitCount?: number
    sellerName?: string
    requestState?: 'UNREQUESTED' | 'REQUESTED'
    page?: number
    size?: number
  }): Promise<PageResult<ShopCandidatePool>> {
    return unwrap<PageResult<ShopCandidatePool>>(
      request({ url: BASE, method: 'get', params })
    )
  },

  /** 按当前筛选条件返回全部可抓候选（跨分页全选用） */
  listFetchable(params: {
    marketplace?: string
    batchCode?: string
    sourceType?: string
    sourceCode?: string
    status?: string
    minHitCount?: number
    sellerName?: string
    requestState?: 'UNREQUESTED' | 'REQUESTED'
    limit?: number
  }): Promise<ShopCandidatePool[]> {
    return unwrap<ShopCandidatePool[]>(
      request({ url: `${BASE}/fetchable`, method: 'get', params, timeout: 120000 })
    )
  },

  /** 单条候选详情 */
  getById(id: number): Promise<ShopCandidatePool> {
    return unwrap<ShopCandidatePool>(request({ url: `${BASE}/${id}`, method: 'get' }))
  },

  /** 状态流转 */
  updateStatus(id: number, status: string): Promise<number> {
    return unwrap<number>(
      request({ url: `${BASE}/${id}/status`, method: 'put', params: { status } })
    )
  },

  /** 确认抓取单店（消耗卖家精灵使用次数，前端必须二次确认） */
  confirmFetch(id: number): Promise<ConfirmFetchResult> {
    return unwrap<ConfirmFetchResult>(
      request({ url: `${BASE}/${id}/confirm-fetch`, method: 'post', timeout: 600000 })
    )
  },

  /** 批量确认抓取（阶段1同步小批验证；大批量后续走卖家精灵请求中心） */
  batchConfirmFetch(ids: number[]): Promise<ConfirmFetchResult[]> {
    return unwrap<ConfirmFetchResult[]>(
      request({ url: `${BASE}/batch-confirm-fetch`, method: 'post', data: ids, timeout: 600000 })
    )
  },

  /** 抓取运行记录分页查询 */
  fetchRuns(params: {
    marketplace?: string
    sellerName?: string
    triggerType?: string
    batchCode?: string
    status?: string
    page?: number
    size?: number
  }): Promise<PageResult<ShopFetchRun>> {
    return unwrap<PageResult<ShopFetchRun>>(
      request({ url: `${BASE}/fetch-runs`, method: 'get', params })
    )
  },

  /** 抓取运行记录详情 */
  getFetchRun(runId: string): Promise<ShopFetchRun> {
    return unwrap<ShopFetchRun>(request({ url: `${BASE}/fetch-runs/${runId}`, method: 'get' }))
  },

  /** 人工加入候选池 */
  addManual(marketplace: string, sellerName: string, reason?: string, note?: string): Promise<ShopCandidatePool> {
    return unwrap<ShopCandidatePool>(
      request({
        url: `${BASE}/manual`,
        method: 'post',
        params: { marketplace, sellerName, ...(reason ? { reason } : {}), ...(note ? { note } : {}) }
      })
    )
  },

  /** 删除候选记录 */
  delete(id: number): Promise<number> {
    return unwrap<number>(request({ url: `${BASE}/${id}`, method: 'delete' }))
  }
}
