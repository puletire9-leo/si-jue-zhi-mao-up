import request from '@/utils/request'
import type {
  ApiResponse,
  Category,
  CategoryListParams,
  CategoryListResponse,
  ProductListResponse
} from '@/types/api'

export const categoryApi = {
  getList(params: CategoryListParams): Promise<ApiResponse<CategoryListResponse>> {
    return request({
      url: '/api/v1/categories',
      method: 'get',
      params
    })
  },

  getDetail(id: string): Promise<ApiResponse<Category>> {
    return request({
      url: `/api/v1/categories/${id}`,
      method: 'get'
    })
  },

  create(data: any): Promise<ApiResponse<Category>> {
    return request({
      url: '/api/v1/categories',
      method: 'post',
      data
    })
  },

  update(id: string, data: any): Promise<ApiResponse<Category>> {
    return request({
      url: `/api/v1/categories/${id}`,
      method: 'put',
      data
    })
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/categories/${id}`,
      method: 'delete'
    })
  },

  getProducts(id: string, params: Record<string, any>): Promise<ApiResponse<ProductListResponse>> {
    return request({
      url: `/api/v1/categories/${id}/products`,
      method: 'get',
      params
    })
  }
}
