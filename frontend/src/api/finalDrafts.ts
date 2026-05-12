import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

// 定义定稿相关类型
export interface FinalDraft {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  images: string[]
  reference_images: string[]
  status: string
  create_time: string
  update_time: string
}

export interface FinalDraftRecycleBin extends FinalDraft {
  draft_id: number
  deleted_by: number
  deleted_by_name: string
  delete_time: string
}

export interface FinalDraftListParams {
  page: number
  size: number
  sku?: string
  batch?: string
  developer?: string
  carrier?: string
  status?: string[]
  startDate?: string
  endDate?: string
}

export interface FinalDraftListResponse {
  list: FinalDraft[] | FinalDraftRecycleBin[]
  total: number
  page: number
  size: number
  not_found_items?: string[]
}

export interface BatchOperationRequest {
  ids: number[]
}

export const finalDraftApi = {
  // 获取定稿列表
  getList(params: FinalDraftListParams): Promise<ApiResponse<FinalDraftListResponse>> {
    return request({
      url: '/api/v1/final-drafts',
      method: 'get',
      params
    })
  },

  // 获取单个定稿
  getDetail(id: number): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: `/api/v1/final-drafts/${id}`,
      method: 'get'
    })
  },

  // 创建定稿
  create(data: any): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: '/api/v1/final-drafts',
      method: 'post',
      data
    })
  },

  // 更新定稿
  update(id: number, data: any): Promise<ApiResponse<FinalDraft>> {
    return request({
      url: `/api/v1/final-drafts/${id}`,
      method: 'put',
      data
    })
  },

  // 删除定稿（软删除，移至回收站）
  delete(id: number): Promise<ApiResponse<{ id: number }>> {
    return request({
      url: `/api/v1/final-drafts/${id}`,
      method: 'delete'
    })
  },

  // 批量删除定稿（软删除，移至回收站）
  batchDelete(ids: number[]): Promise<ApiResponse<{ success: number; failed: number; errors: string[] }>> {
    return request({
      url: '/api/v1/final-drafts/batch-delete',
      method: 'post',
      data: { ids }
    })
  },

  // 获取回收站定稿列表
  getRecycleBinList(params: FinalDraftListParams): Promise<ApiResponse<FinalDraftListResponse>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin',
      method: 'get',
      params
    })
  },

  // 恢复单个定稿
  restore(id: number): Promise<ApiResponse<{ id: number }>> {
    return request({
      url: `/api/v1/final-drafts/recycle-bin/${id}/restore`,
      method: 'post'
    })
  },

  // 批量恢复定稿
  batchRestore(ids: number[]): Promise<ApiResponse<{ success: number; failed: number; errors: string[] }>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/batch-restore',
      method: 'post',
      data: { ids }
    })
  },

  // 永久删除单个定稿
  permanentlyDelete(id: number): Promise<ApiResponse<{ id: number }>> {
    return request({
      url: `/api/v1/final-drafts/recycle-bin/${id}`,
      method: 'delete'
    })
  },

  // 批量永久删除定稿
  batchPermanentlyDelete(ids: number[]): Promise<ApiResponse<{ success: number; failed: number; errors: string[] }>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/batch',
      method: 'delete',
      data: { ids }
    })
  },

  // 清空定稿回收站
  clearRecycleBin(): Promise<ApiResponse<{ deleted_count: number }>> {
    return request({
      url: '/api/v1/final-drafts/recycle-bin/clear',
      method: 'delete'
    })
  }
}