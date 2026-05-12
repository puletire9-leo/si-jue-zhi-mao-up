import request from '@/utils/request'
import type {
  ApiResponse
} from '@/types/api'

// 类型定义
export interface FinalDraft {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  element?: string
  modificationRequirement?: string
  infringementLabel?: string
  images: string[]
  reference_images?: string[]
  referenceImages?: string[]
  status: 'finalized' | 'optimizing' | 'concept'
  createTime: string
  updateTime: string
  delete_time?: string
}

export interface FinalDraftListParams {
  search_type?: string
  search_content?: string
  developer?: string[]
  status?: string[]
  carrier?: string[]
  batch?: string[]
  sort_by?: string
  sort_order?: string
  page?: number
  size?: number
}

export interface FinalDraftListResponse {
  list: FinalDraft[]
  total: number
  page: number
  size: number
}

export interface BatchOperationRequest {
  ids?: number[]
  skus?: string[]
}

export interface BatchOperationResponse {
  success: number
  failed: number
  errors: string[]
}

export const finalDraftApi = {
  /**
   * 获取定稿列表
   */
  getList(params: FinalDraftListParams): Promise<ApiResponse<FinalDraftListResponse>> {
    return request({
      url: '/api/v1/final-drafts',
      method: 'get',
      params
    })
  },

  /**
   * 获取单个定稿详情
   */
  getDetail(sku: string): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: `/api/v1/final-drafts/${sku}`,
      method: 'get'
    })
  },

  /**
   * 创建新定稿
   */
  create(data: any): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: '/api/v1/final-drafts',
      method: 'post',
      data
    })
  },

  /**
   * 更新定稿
   */
  update(sku: string, data: any): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: `/api/v1/final-drafts/sku/${sku}`,
      method: 'put',
      data
    })
  },

  /**
   * 删除定稿（移动到回收站）
   */
  delete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/final-drafts/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 批量删除定稿
   */
  batchDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/final-drafts/batch-delete',
      method: 'post',
      data
    })
  },

  /**
   * 获取回收站定稿
   */
  getRecycleBin(params: { page?: number; size?: number }): Promise<ApiResponse<FinalDraftListResponse>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin',
      method: 'get',
      params
    })
  },

  /**
   * 从回收站恢复单个定稿
   */
  restore(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/final-drafts/recycle-bin/${sku}/restore`,
      method: 'post'
    })
  },

  /**
   * 批量恢复回收站定稿
   */
  batchRestore(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/batch-restore',
      method: 'post',
      data
    })
  },

  /**
   * 从回收站永久删除单个定稿
   */
  permanentlyDelete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/final-drafts/recycle-bin/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 从回收站通过ID永久删除单个定稿
   */
  permanentlyDeleteById(id: number): Promise<ApiResponse<{ message: string; id: number; deleted_count: number }>> {
    return request({
      url: `/api/v1/final-drafts/recycle-bin/delete-by-id/${id}`,
      method: 'delete'
    })
  },

  /**
   * 批量永久删除回收站定稿
   */
  batchPermanentlyDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/batch',
      method: 'delete',
      data
    })
  },

  /**
   * 清空定稿回收站
   */
  clearRecycleBin(): Promise<ApiResponse<{ message: string; deleted_count: number }>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/clear',
      method: 'delete'
    })
  },

  /**
   * 获取指定批次的产品数量
   */
  getBatchCount(batch: string): Promise<ApiResponse<{ batch: string; count: number }>> {
    return request({
      url: `/api/v1/final-drafts/batch/${batch}/count`,
      method: 'get'
    })
  },

  /**
   * 批量创建定稿
   */
  batchCreate(data: any[]): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/final-drafts/batch-create',
      method: 'post',
      data
    })
  },

  /**
   * 批量更新定稿
   */
  batchUpdate(data: any): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/final-drafts/batch-update',
      method: 'post',
      data
    })
  },

  /**
   * 批量下载文件并打包成ZIP
   */
  downloadZip(files: Array<{ url: string; filename: string }>): Promise<Blob> {
    return request({
      url: '/api/v1/final-drafts/download-zip',
      method: 'post',
      data: files,
      responseType: 'blob'
    })
  }
}
