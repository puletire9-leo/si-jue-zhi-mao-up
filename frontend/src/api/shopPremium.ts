import request from '@/utils/request'

/** 精品店铺池记录（后端 shop_premium_pool 映射） */
export interface ShopPremiumPool {
  id: number
  marketplace: string
  sellerName: string
  sellerId: string | null
  sourceType: string
  sourceId: number | null
  reason: string | null
  tagsJson: string | null
  qualityLevel: string
  refreshFrequency: string
  lastFetchRunId: string | null
  lastFetchDate: string | null
  nextFetchDate: string | null
  refreshStatus: string
  lastErrorMessage: string | null
  systemPauseReason: string | null
  systemResumeAt: string | null
  status: string
  note: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 请求中心任务（后端 sellersprite_request_run 映射） */
export interface SellerspriteRequestRun {
  runId: string
  requestType: string
  marketplace: string | null
  triggerType: string
  triggerRef: string | null
  fetchReason: string | null
  batchCode: string | null
  batchDate: string | null
  totalCount: number
  pendingCount: number
  runningCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  apiCalls: number
  status: string
  lastErrorMessage: string | null
  systemPauseReason: string | null
  systemResumeAt: string | null
  operator: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 请求中心子项 */
export interface SellerspriteRequestItem {
  id: number
  runId: string
  seq: number
  marketplace: string
  sellerName: string
  triggerId: number | null
  sourceTaskId: number | null
  asinList: string | null
  payloadJson: string | null
  status: string
  shopFetchRunId: string | null
  total: number | null
  fetchedCount: number | null
  writtenCount: number | null
  failedCount: number | null
  apiCalls: number | null
  errorMessage: string | null
  attemptCount: number
  nextRetryAt: string | null
  errorCode: string | null
  errorSummary: string | null
  requestDispatched: boolean
  usageConfirmed: boolean
  startedAt: string | null
  finishedAt: string | null
}

/** 通用分页响应 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

export interface ShopTaskCreateResult {
  runId: string
  status: string
  requestType: string
  requestMode: 'ONCE' | 'REPEATABLE'
  requestedCount: number
  queuedCount: number
  totalCount: number
  skippedCount: number
  skippedShops: string[]
  repeatPolicy: string
}

export interface SellerspriteMonthlyUsageSummary {
  month: string
  taskCount: number
  totalApiCalls: number
}

/** dry-run 预览结果 */
export interface RefreshDryRunResult {
  totalRequested: number
  toRefreshCount: number
  skippedCount: number
  estimatedApiCallsLowerBound: number
  toRefresh: Array<{ premiumId: number; marketplace: string; sellerName: string; status: string; refreshStatus: string; nextFetchDate: string | null }>
  skipped: Array<{ premiumId: number; marketplace: string; sellerName: string; status: string; refreshStatus: string; reason: string }>
  note: string
}

/** 创建复抓任务结果 */
export interface CreateRefreshTaskResult {
  runId: string
  requestType: string
  totalCount: number
  toRefreshCount: number
  lockedPremiumIds: number[]
  message: string
}

/** consumeNext 结果 */
export interface ConsumeNextResult {
  runId: string
  consumed: number
  success: number
  failed: number
  skipped: number
  apiCalls: number
  status: string
  progress: {
    total: number
    pending: number
    success: number
    failed: number
    skipped: number
    apiCalls: number
  }
  finished?: boolean
  message?: string
}

function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T)
}

const PREMIUM_BASE = '/api/v1/modules/shop-premium'
const RC_BASE = '/api/v1/modules/request-center'

export const shopPremiumApi = {
  list(params: {
    marketplace?: string
    status?: string
    qualityLevel?: string
    refreshFrequency?: string
    tag?: string
    sellerName?: string
    page?: number
    size?: number
  }): Promise<PageResult<ShopPremiumPool>> {
    return unwrap<PageResult<ShopPremiumPool>>(request({ url: PREMIUM_BASE, method: 'get', params }))
  },

  getById(id: number): Promise<ShopPremiumPool> {
    return unwrap<ShopPremiumPool>(request({ url: `${PREMIUM_BASE}/${id}`, method: 'get' }))
  },

  promoteFromCandidate(candidateId: number, params: { tagsJson?: string; qualityLevel?: string; refreshFrequency?: string; note?: string }): Promise<ShopPremiumPool> {
    return unwrap<ShopPremiumPool>(
      request({ url: `${PREMIUM_BASE}/from-candidate/${candidateId}`, method: 'post', params })
    )
  },

  addManual(params: { marketplace: string; sellerName: string; reason?: string; tagsJson?: string; qualityLevel?: string; refreshFrequency?: string; note?: string; forceCreateImmediately?: boolean }): Promise<ShopPremiumPool> {
    return unwrap<ShopPremiumPool>(request({ url: `${PREMIUM_BASE}/manual`, method: 'post', params }))
  },

  update(id: number, params: { tagsJson?: string; qualityLevel?: string; refreshFrequency?: string; reason?: string; note?: string }): Promise<ShopPremiumPool> {
    return unwrap<ShopPremiumPool>(request({ url: `${PREMIUM_BASE}/${id}`, method: 'put', params }))
  },

  updateStatus(id: number, status: string): Promise<number> {
    return unwrap<number>(request({ url: `${PREMIUM_BASE}/${id}/status`, method: 'put', params: { status } }))
  },

  remove(id: number): Promise<number> {
    return unwrap<number>(request({ url: `${PREMIUM_BASE}/${id}`, method: 'delete' }))
  },

  refreshDryRun(premiumIds: number[]): Promise<RefreshDryRunResult> {
    return unwrap<RefreshDryRunResult>(request({ url: `${PREMIUM_BASE}/refresh/dry-run`, method: 'post', data: premiumIds }))
  },

  createRefreshTask(premiumIds: number[], operator?: string): Promise<CreateRefreshTaskResult> {
    return unwrap<CreateRefreshTaskResult>(
      request({ url: `${PREMIUM_BASE}/refresh/create-task`, method: 'post', data: premiumIds, params: operator ? { operator } : {} })
    )
  }
}

export const requestCenterApi = {
  createTask(body: {
    requestType: string
    marketplace?: string
    triggerType: string
    triggerRef?: string
    fetchReason?: string
    description?: string
    operator?: string
    items: Array<{ marketplace: string; sellerName: string; triggerId?: number }>
  }): Promise<SellerspriteRequestRun> {
    return unwrap<SellerspriteRequestRun>(request({ url: `${RC_BASE}/tasks`, method: 'post', data: body }))
  },

  dryRun(body: { requestType: string; marketplace?: string; items: Array<{ marketplace: string; sellerName: string; triggerId?: number }>; description?: string }): Promise<Record<string, any>> {
    return unwrap<Record<string, any>>(request({ url: `${RC_BASE}/dry-run`, method: 'post', data: body }))
  },

  consumeNext(runId: string, batchSize = 5): Promise<ConsumeNextResult> {
    return unwrap<ConsumeNextResult>(request({ url: `${RC_BASE}/tasks/${runId}/consume`, method: 'post', params: { batchSize }, timeout: 600000 }))
  },

  startAutoConsume(runId: string): Promise<Record<string, any>> {
    return unwrap<Record<string, any>>(request({ url: `${RC_BASE}/tasks/${runId}/start`, method: 'post' }))
  },

  pause(runId: string): Promise<number> {
    return unwrap<number>(request({ url: `${RC_BASE}/tasks/${runId}/pause`, method: 'post' }))
  },

  resume(runId: string): Promise<number> {
    return unwrap<number>(request({ url: `${RC_BASE}/tasks/${runId}/resume`, method: 'post' }))
  },

  stop(runId: string): Promise<number> {
    return unwrap<number>(request({ url: `${RC_BASE}/tasks/${runId}/stop`, method: 'post' }))
  },

  deleteTask(runId: string): Promise<number> {
    return unwrap<number>(request({ url: `${RC_BASE}/tasks/${runId}`, method: 'delete' }))
  },

  listTasks(params: { requestType?: string; triggerType?: string; status?: string; batchCode?: string; month?: string; page?: number; size?: number }): Promise<PageResult<SellerspriteRequestRun>> {
    return unwrap<PageResult<SellerspriteRequestRun>>(request({ url: `${RC_BASE}/tasks`, method: 'get', params }))
  },

  /** 普通候选店铺：同站点同店铺跨来源只允许抓取一次。 */
  createShopTaskOnce(body: {
    marketplace?: string
    triggerType: string
    triggerRef?: string
    fetchReason?: string
    operator?: string
    items: Array<{ marketplace: string; sellerName: string; triggerId?: number }>
  }): Promise<ShopTaskCreateResult> {
    return unwrap<ShopTaskCreateResult>(
      request({ url: `${RC_BASE}/shop-tasks/once`, method: 'post', data: body })
    )
  },

  /** 精品店铺：允许历史完成后周期复抓，但不允许并发重复活跃任务。 */
  createRepeatableShopTask(body: {
    marketplace?: string
    triggerRef?: string
    fetchReason?: string
    operator?: string
    items: Array<{ marketplace: string; sellerName: string; triggerId?: number }>
  }): Promise<ShopTaskCreateResult> {
    return unwrap<ShopTaskCreateResult>(
      request({ url: `${RC_BASE}/shop-tasks/repeatable`, method: 'post', data: body })
    )
  },

  monthlyUsageSummary(month?: string): Promise<SellerspriteMonthlyUsageSummary> {
    return unwrap<SellerspriteMonthlyUsageSummary>(
      request({ url: `${RC_BASE}/usage-summary`, method: 'get', params: month ? { month } : {} })
    )
  },

  getTask(runId: string): Promise<SellerspriteRequestRun> {
    return unwrap<SellerspriteRequestRun>(request({ url: `${RC_BASE}/tasks/${runId}`, method: 'get' }))
  },

  listItems(runId: string, params?: { page?: number; size?: number }): Promise<PageResult<SellerspriteRequestItem>> {
    return unwrap<PageResult<SellerspriteRequestItem>>(request({ url: `${RC_BASE}/tasks/${runId}/items`, method: 'get', params }))
  },

  retryItem(itemId: number): Promise<number> {
    return unwrap<number>(request({ url: `${RC_BASE}/items/${itemId}/retry`, method: 'post' }))
  },

  createFromStreaming(taskId: number, operator?: string, fetchReason?: string): Promise<SellerspriteRequestRun> {
    const params: Record<string, string> = {}
    if (operator) params.operator = operator
    if (fetchReason) params.fetchReason = fetchReason
    return unwrap<SellerspriteRequestRun>(
      request({ url: `${RC_BASE}/tasks/from-streaming/${taskId}`, method: 'post', params })
    )
  },
  health(): Promise<Record<string, unknown>> {
    return unwrap<Record<string, unknown>>(request({ url: `${RC_BASE}/health`, method: 'get' }))
  }
}
