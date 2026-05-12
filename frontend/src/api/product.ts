import request from '@/utils/request'
import type {
  ApiResponse,
  Product,
  ProductListParams,
  ProductListResponse
} from '@/types/api'

export const productApi = {
  getList(params: ProductListParams): Promise<ApiResponse<ProductListResponse>> {
    return request({
      url: '/api/v1/products/list',
      method: 'get',
      params
    })
  },

  getDetail(sku: string): Promise<ApiResponse<Product>> {
    return request({
      url: `/api/v1/products/${sku}`,
      method: 'get'
    })
  },

  create(data: any): Promise<ApiResponse<Product>> {
    return request({
      url: '/api/v1/products',
      method: 'post',
      data
    })
  },

  update(sku: string, data: any): Promise<ApiResponse<Product>> {
    return request({
      url: `/api/v1/products/${sku}`,
      method: 'put',
      data
    })
  },

  delete(sku: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/products/${sku}`,
      method: 'delete'
    })
  },

  batchDelete(skus: string[]): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/products/batch-delete',
      method: 'post',
      data: { skus }
    })
  },

  batchUpdate(data: any): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/products/batch',
      method: 'put',
      data
    })
  },

  search(keyword: string, params: Record<string, any> = {}): Promise<ApiResponse<ProductListResponse>> {
    return request({
      url: '/api/v1/products',
      method: 'get',
      params: { keyword, ...params }
    })
  },

  export(params: Record<string, any>): Promise<Blob> {
    return request({
      url: '/api/v1/products/export',
      method: 'get',
      params,
      responseType: 'blob'
    })
  },

  import(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData()
    formData.append('file', file)
    return request({
      url: '/api/v1/products/import',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  downloadTemplate(): Promise<Blob> {
    return request({
      url: '/api/v1/import/template/products',
      method: 'get',
      responseType: 'blob'
    })
  },
}

export const productRecycleApi = {
  getRecycledProducts(params: Record<string, any>): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/product-recycle/products',
      method: 'get',
      params
    })
  },

  restoreProduct(sku: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/product-recycle/products/${sku}/restore`,
      method: 'post'
    })
  },

  batchRestoreProducts(data: { skus: string[] }): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/product-recycle/products/batch-restore',
      method: 'post',
      data
    })
  },

  permanentlyDeleteProduct(sku: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/product-recycle/products/${sku}`,
      method: 'delete'
    })
  },

  batchPermanentlyDeleteProducts(data: { skus: string[] }): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/product-recycle/products/batch',
      method: 'delete',
      data
    })
  },

  getRecycleStats(): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/product-recycle/stats',
      method: 'get'
    })
  },

  clearExpiredProducts(days: number = 30): Promise<ApiResponse<any>> {
    return request({
      url: '/api/v1/product-recycle/products/clear-expired',
      method: 'delete',
      params: { days }
    })
  },

  getAllSkus(productType?: string): Promise<ApiResponse<{ skus: string[]; total: number }>> {
    const params: any = {}
    if (productType && productType.trim()) {
      params.productType = productType
    }
    return request({
      url: '/api/v1/products/skus',
      method: 'get',
      params
    })
  }
}
