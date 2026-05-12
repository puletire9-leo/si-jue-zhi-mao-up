import request from '@/utils/request'
import type {
  ApiResponse,
  SelectionProduct,
  SelectionProductListParams,
  SelectionProductListResponse,
  SelectionStats,
  StoreListResponse
} from '@/types/api'

export const selectionApi = {
  getList(params: SelectionProductListParams): Promise<ApiResponse<SelectionProductListResponse>> {
    return request({
      url: '/api/v1/selection/products/list',
      method: 'get',
      params
    })
  },

  getNewProductsList(params: SelectionProductListParams): Promise<ApiResponse<SelectionProductListResponse>> {
    return request({
      url: '/api/v1/selection/new/list',
      method: 'get',
      params
    })
  },

  getReferenceProductsList(params: SelectionProductListParams): Promise<ApiResponse<SelectionProductListResponse>> {
    return request({
      url: '/api/v1/selection/reference/list',
      method: 'get',
      params
    })
  },

  getAllSelectionList(params: SelectionProductListParams): Promise<ApiResponse<SelectionProductListResponse>> {
    return request({
      url: '/api/v1/selection/all/list',
      method: 'get',
      params
    })
  },

  getDetail(id: string): Promise<ApiResponse<SelectionProduct>> {
    return request({
      url: `/api/v1/selection/products/${id}`,
      method: 'get'
    })
  },

  create(data: any): Promise<ApiResponse<SelectionProduct>> {
    return request({
      url: '/api/v1/selection/products',
      method: 'post',
      data
    })
  },

  update(id: string, data: any): Promise<ApiResponse<SelectionProduct>> {
    return request({
      url: `/api/v1/selection/products/${id}`,
      method: 'put',
      data
    })
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/selection/products/${id}`,
      method: 'delete'
    })
  },

  batchDelete(asins: string[]): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/selection/products/batch-delete',
      method: 'post',
      data: { asins }
    })
  },

  getStats(): Promise<ApiResponse<SelectionStats>> {
    return request({
      url: '/api/v1/selection/stats/summary',
      method: 'get'
    })
  },

  getStores(): Promise<ApiResponse<StoreListResponse>> {
    return request({
      url: '/api/v1/selection/stores',
      method: 'get'
    })
  },

  getCategories(source?: string): Promise<ApiResponse<Array<{ category: string; count: number }>>> {
    return request({
      url: '/api/v1/selection/categories',
      method: 'get',
      params: source ? { source } : undefined
    })
  },

  import(file: File, productType: string = 'new', mode: string = 'skip', autoScore: boolean = true): Promise<ApiResponse<any>> {
    const formData = new FormData()
    formData.append('file', file)
    return request({
      url: '/api/v1/selection/import',
      method: 'post',
      data: formData,
      params: { productType, mode, auto_score: autoScore },
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  downloadTemplate(): Promise<Blob> {
    return request({
      url: '/api/v1/selection/template',
      method: 'get',
      responseType: 'blob'
    })
  },

  clearAll(): Promise<ApiResponse<{ deleted_count: number }>> {
    return request({
      url: '/api/v1/selection/products/clear-all',
      method: 'delete'
    })
  },

  getRecycleBinList(params: SelectionProductListParams): Promise<ApiResponse<SelectionProductListResponse>> {
    return request({
      url: '/api/v1/selection/recycle/products',
      method: 'get',
      params
    })
  },

  restoreFromRecycleBin(asins: string[]): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/selection/recycle/products/batch-restore',
      method: 'post',
      data: { recycle_ids: asins }
    })
  },

  deleteFromRecycleBin(asins: string[]): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/selection/recycle/delete',
      method: 'post',
      data: { asins }
    })
  },

  clearRecycleBin(): Promise<ApiResponse<{ deleted_count: number }>> {
    return request({
      url: '/api/v1/selection/recycle/clear',
      method: 'delete'
    })
  },

  getAllAsins(productType?: string): Promise<ApiResponse<{ asins: string[]; total: number }>> {
    const params: any = {}
    if (productType && productType.trim()) {
      params.productType = productType
    }
    return request({
      url: '/api/v1/selection/products/asins',
      method: 'get',
      params
    })
  },

  exportSelectedAsins(asins: string[]): Promise<Blob> {
    return request({
      url: '/api/v1/selection/products/export-asins',
      method: 'post',
      data: { asins },
      responseType: 'blob'
    })
  },

  // 评分相关 API
  getScoringConfig(): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/scoring/config',
      method: 'get'
    })
  },

  updateScoringConfig(data: any): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/scoring/config',
      method: 'put',
      data
    })
  },

  recalculateScores(scope: string = 'all'): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/scoring/recalculate',
      method: 'post',
      data: { scope }
    })
  },

  scoreCurrentWeek(): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/scoring/score-current-week',
      method: 'post'
    })
  },

  getGradeStats(scope: string = 'all'): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/scoring/grade-stats',
      method: 'get',
      params: { scope }
    })
  }
}
