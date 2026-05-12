import request from '@/utils/request'
import type {
  ApiResponse
} from '@/types/api'

// 类型定义
export interface CarrierLibrary {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  modificationRequirement?: string
  images: string[]
  reference_images?: string[]
  status: 'finalized' | 'optimizing' | 'concept'
  createTime: string
  updateTime: string
  delete_time?: string
}

export interface CarrierLibraryListParams {
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

export interface CarrierLibraryListResponse {
  list: CarrierLibrary[]
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

export const carrierLibraryApi = {
  /**
   * 获取载体库列表
   */
  getList(params: CarrierLibraryListParams): Promise<ApiResponse<CarrierLibraryListResponse>> {
    return request({
      url: '/api/v1/carrier-library',
      method: 'get',
      params
    })
  },

  /**
   * 获取单个载体详情
   */
  getDetail(sku: string): Promise<ApiResponse<CarrierLibrary>> {
    return request({
      url: `/api/v1/carrier-library/${sku}`,
      method: 'get'
    })
  },

  /**
   * 创建新载体
   */
  create(data: any): Promise<ApiResponse<CarrierLibrary>> {
    return request({
      url: '/api/v1/carrier-library',
      method: 'post',
      data
    })
  },

  /**
   * 更新载体
   */
  update(id: number, data: any): Promise<ApiResponse<CarrierLibrary>> {
    return request({
      url: `/api/v1/carrier-library/${id}`,
      method: 'put',
      data
    })
  },

  /**
   * 删除载体（移动到回收站）
   */
  delete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/carrier-library/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 批量删除载体
   */
  batchDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/carrier-library/batch-delete',
      method: 'post',
      data
    })
  },

  /**
   * 获取回收站载体
   */
  getRecycleBin(params: { page?: number; size?: number }): Promise<ApiResponse<CarrierLibraryListResponse>> {
    return request({
      url: '/api/v1/carrier-library/recycle-bin',
      method: 'get',
      params
    })
  },

  /**
   * 从回收站恢复单个载体
   */
  restore(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/carrier-library/recycle-bin/${sku}/restore`,
      method: 'post'
    })
  },

  /**
   * 批量恢复回收站载体
   */
  batchRestore(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/carrier-library/recycle-bin/batch-restore',
      method: 'post',
      data
    })
  },

  /**
   * 从回收站永久删除单个载体
   */
  permanentlyDelete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/carrier-library/recycle-bin/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 从回收站通过ID永久删除单个载体
   */
  permanentlyDeleteById(id: number): Promise<ApiResponse<{ message: string; id: number; deleted_count: number }>> {
    return request({
      url: `/api/v1/carrier-library/recycle-bin/delete-by-id/${id}`,
      method: 'delete'
    })
  },

  /**
   * 批量永久删除回收站载体
   */
  batchPermanentlyDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/carrier-library/recycle-bin/batch',
      method: 'delete',
      data
    })
  },

  /**
   * 清空载体库回收站
   */
  clearRecycleBin(): Promise<ApiResponse<{ message: string; deleted_count: number }>> {
    return request({
      url: '/api/v1/carrier-library/recycle-bin/clear',
      method: 'delete'
    })
  },

  /**
   * 获取指定批次的载体数量
   */
  getBatchCount(batch: string): Promise<ApiResponse<{ batch: string; count: number }>> {
    return request({
      url: `/api/v1/carrier-library/batch/${batch}/count`,
      method: 'get'
    })
  },

  /**
   * 批量创建载体
   */
  batchCreate(data: any[]): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/carrier-library/batch-create',
      method: 'post',
      data
    })
  },

  /**
   * 批量更新载体
   */
  batchUpdate(data: any): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/carrier-library/batch-update',
      method: 'post',
      data
    })
  },

  /**
   * 处理本地文件
   */
  processLocalFiles(): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/carrier-library/process-local-files',
      method: 'post'
    })
  }
}
