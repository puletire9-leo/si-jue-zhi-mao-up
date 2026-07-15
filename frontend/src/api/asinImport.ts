import request from '@/utils/request'

export interface UploadPreview {
  taskId: number
  totalCount: number
  passCount: number
  priceFailCount: number
  reviewFailCount: number
  duplicateCount: number
  skipCount: number
  skipMainCount: number
  skipBlacklistCount: number
  batchTotal: number
  discardedAsins: number
}

export interface TaskProgress {
  taskId: number
  status: string
  totalCount: number
  passCount: number
  batchTotal: number
  batchCurrent: number
  apiSuccess: number
  apiFail: number
}

export interface HistoryItem {
  id: number
  marketplace: string
  status: string
  totalCount: number
  passCount: number
  priceFailCount: number
  reviewFailCount: number
  duplicateCount: number
  skipCount: number
  batchTotal: number
  apiSuccess: number
  apiFail: number
  apiRequestsUsed: number
  parentAsinCount: number
  variantAsinCount: number
  dataMonth: string
  createdAt: string
  completedAt: string
}

export interface SellerExecuteResult {
  taskId: number
  runId: string
  status: string
  batchTotal: number
}

export const asinImportApi = {
  upload(files: File | File[], marketplace: string): Promise<UploadPreview> {
    const fd = new FormData()
    const fileList = Array.isArray(files) ? files : [files]
    fileList.forEach(f => fd.append('files', f))
    return request({
      url: '/api/v1/asin-import/upload',
      method: 'post',
      data: fd,
      params: { marketplace },
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  execute(taskId: number, month?: string, marketplace?: string) {
    return request({
      url: '/api/v1/asin-import/execute',
      method: 'post',
      params: { taskId, month, marketplace }
    })
  },

  progress(taskId: number): Promise<TaskProgress> {
    return request({ url: `/api/v1/asin-import/progress/${taskId}`, method: 'get' })
  },

  cancel(taskId: number, action: 'pause' | 'stop' = 'stop') {
    return request({
      url: `/api/v1/asin-import/cancel/${taskId}`,
      method: 'post',
      params: { action }
    })
  },

  history(): Promise<HistoryItem[]> {
    return request({ url: '/api/v1/asin-import/history', method: 'get' })
  },

  results(taskId: number): Promise<{ taskId: number; total: number; byStatus: Record<string,number>; failedCount: number; failedAsins: string[] }> {
    return request({ url: `/api/v1/asin-import/results/${taskId}`, method: 'get' })
  },

  retryFailed(taskId: number): Promise<{ newTaskId: number; runId: string; status: string; total: number; duplicatesRemoved: number; batches: number }> {
    return request({ url: `/api/v1/asin-import/retry/${taskId}`, method: 'post' })
  },

  sellerPreview(sellerNames: string[], marketplace: string, target?: string): Promise<{
    taskId: number; sellerCount: number; estimatedApiCalls: number;
    marketplace: string; maxPerMinute: number; delayMs: number; estimatedDuration: number
  }> {
    return request({
      url: '/api/v1/asin-import/seller/preview',
      method: 'post',
      data: { sellerNames, marketplace, target: target || 'competitor_products' }
    })
  },

  sellerExecute(taskId: number, month?: string, target?: string): Promise<SellerExecuteResult> {
    return request({
      url: '/api/v1/asin-import/seller/execute',
      method: 'post',
      params: { taskId, month: month || '', target: target || 'competitor_products' }
    })
  }
}
