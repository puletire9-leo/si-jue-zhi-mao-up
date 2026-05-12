import request from '@/utils/request'
import type {
  ApiResponse
} from '@/types/api'

// 类型定义
export interface MaterialLibrary {
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

export interface MaterialLibraryListParams {
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

export interface MaterialLibraryListResponse {
  list: MaterialLibrary[]
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

export const materialLibraryApi = {
  /**
   * 获取素材库列表
   */
  getList(params: MaterialLibraryListParams): Promise<ApiResponse<MaterialLibraryListResponse>> {
    return request({
      url: '/api/v1/material-library',
      method: 'get',
      params
    })
  },

  /**
   * 获取单个素材详情
   */
  getDetail(sku: string): Promise<ApiResponse<MaterialLibrary>> {
    return request({
      url: `/api/v1/material-library/${sku}`,
      method: 'get'
    })
  },

  /**
   * 创建新素材
   */
  create(data: any): Promise<ApiResponse<MaterialLibrary>> {
    return request({
      url: '/api/v1/material-library',
      method: 'post',
      data
    })
  },

  /**
   * 更新素材
   */
  update(sku: string, data: any): Promise<ApiResponse<MaterialLibrary>> {
    return request({
      url: `/api/v1/material-library/sku/${sku}`,
      method: 'put',
      data
    })
  },

  /**
   * 删除素材（移动到回收站）
   */
  delete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/material-library/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 批量删除素材
   */
  batchDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/material-library/batch-delete',
      method: 'post',
      data
    })
  },

  /**
   * 获取回收站素材
   */
  getRecycleBin(params: { page?: number; size?: number }): Promise<ApiResponse<MaterialLibraryListResponse>> {
    return request({
      url: '/api/v1/material-library/recycle-bin',
      method: 'get',
      params
    })
  },

  /**
   * 从回收站恢复单个素材
   */
  restore(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/material-library/recycle-bin/${sku}/restore`,
      method: 'post'
    })
  },

  /**
   * 批量恢复回收站素材
   */
  batchRestore(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/material-library/recycle-bin/batch-restore',
      method: 'post',
      data
    })
  },

  /**
   * 从回收站永久删除单个素材
   */
  permanentlyDelete(sku: string): Promise<ApiResponse<{ message: string; sku: string }>> {
    return request({
      url: `/api/v1/material-library/recycle-bin/${sku}`,
      method: 'delete'
    })
  },

  /**
   * 从回收站通过ID永久删除单个素材
   */
  permanentlyDeleteById(id: number): Promise<ApiResponse<{ message: string; id: number; deleted_count: number }>> {
    return request({
      url: `/api/v1/material-library/recycle-bin/delete-by-id/${id}`,
      method: 'delete'
    })
  },

  /**
   * 批量永久删除回收站素材
   */
  batchPermanentlyDelete(data: BatchOperationRequest): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/material-library/recycle-bin/batch',
      method: 'delete',
      data
    })
  },

  /**
   * 清空素材库回收站
   */
  clearRecycleBin(): Promise<ApiResponse<{ message: string; deleted_count: number }>> {
    return request({
      url: '/api/v1/material-library/recycle-bin/clear',
      method: 'delete'
    })
  },

  /**
   * 获取指定批次的素材数量
   */
  getBatchCount(batch: string): Promise<ApiResponse<{ batch: string; count: number }>> {
    return request({
      url: `/api/v1/material-library/batch/${batch}/count`,
      method: 'get'
    })
  },

  /**
   * 批量创建素材
   */
  batchCreate(data: any[]): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/material-library/batch-create',
      method: 'post',
      data
    })
  },

  /**
   * 批量更新素材
   */
  batchUpdate(data: any): Promise<ApiResponse<BatchOperationResponse>> {
    return request({
      url: '/api/v1/material-library/batch-update',
      method: 'post',
      data
    })
  },

  /**
   * 处理本地文件
   */
  processLocalFiles(): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/material-library/process-local-files',
      method: 'post'
    })
  },

  /**
   * 分析图片内容，识别元素标签
   */
  analyzeImage(imageUrl?: string, imageBase64?: string): Promise<ApiResponse<{
    element: string
    tags: Array<{ tag: string; confidence: number }>
  }>> {
    const data: { image_url?: string; image_base64?: string } = {}
    if (imageUrl) data.image_url = imageUrl
    if (imageBase64) data.image_base64 = imageBase64
    return request({
      url: '/api/v1/material-library/analyze-image',
      method: 'post',
      data
    })
  },

  /**
   * 详细分析图片（使用混元大模型）
   */
  analyzeImageDetailed(imageUrl?: string, imageBase64?: string): Promise<ApiResponse<{
    product_type: string
    theme: string
    elements: Array<{ name: string; english_name: string; icon: string }>
    text_content: string[]
    description: string
  }>> {
    const data: { image_url?: string; image_base64?: string } = {}
    if (imageUrl) data.image_url = imageUrl
    if (imageBase64) data.image_base64 = imageBase64
    return request({
      url: '/api/v1/material-library/analyze-image-detailed',
      method: 'post',
      data
    })
  },

  /**
   * 获取元素词库列表
   */
  getElements(): Promise<ApiResponse<string[]>> {
    return request({
      url: '/api/v1/material-library/elements',
      method: 'get'
    })
  },

  /**
   * 更新元素词库
   */
  updateElements(elements: string[]): Promise<ApiResponse<{
    updated_count: number
  }>> {
    return request({
      url: '/api/v1/material-library/elements',
      method: 'put',
      data: elements
    })
  }
}
