import request from '@/utils/request'
import type {
  ApiResponse,
  Tag,
  TagListParams,
  TagListResponse,
  ProductListResponse
} from '@/types/api'

export const tagApi = {
  getList(params: TagListParams): Promise<ApiResponse<TagListResponse>> {
    return request({
      url: '/api/v1/tags',
      method: 'get',
      params
    })
  },

  getDetail(id: string): Promise<ApiResponse<Tag>> {
    return request({
      url: `/api/v1/tags/${id}`,
      method: 'get'
    })
  },

  create(data: any): Promise<ApiResponse<Tag>> {
    return request({
      url: '/api/v1/tags',
      method: 'post',
      data
    })
  },

  update(id: string, data: any): Promise<ApiResponse<Tag>> {
    return request({
      url: `/api/v1/tags/${id}`,
      method: 'put',
      data
    })
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/tags/${id}`,
      method: 'delete'
    })
  },

  getProducts(id: string, params: Record<string, any>): Promise<ApiResponse<ProductListResponse>> {
    return request({
      url: `/api/v1/tags/${id}/products`,
      method: 'get',
      params
    })
  },

  batchUpdate(data: any): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/tags/batch',
      method: 'put',
      data
    })
  }
}
