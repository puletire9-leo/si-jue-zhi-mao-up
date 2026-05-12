import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export const importExportApi = {
  exportProducts(params: Record<string, any> = {}): Promise<Blob> {
    return request({
      url: '/api/v1/export/products',
      method: 'get',
      params,
      responseType: 'blob'
    })
  },

  exportImages(params: Record<string, any> = {}): Promise<Blob> {
    return request({
      url: '/api/v1/export/images',
      method: 'get',
      params,
      responseType: 'blob'
    })
  },

  exportStatistics(): Promise<Blob> {
    return request({
      url: '/api/v1/export/statistics',
      method: 'get',
      responseType: 'blob'
    })
  },

  importProducts(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData()
    formData.append('file', file)
    return request({
      url: '/api/v1/import/products',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  importImages(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData()
    formData.append('file', file)
    return request({
      url: '/api/v1/import/images',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  downloadProductTemplate(): Promise<Blob> {
    return request({
      url: '/api/v1/import/template/products',
      method: 'get',
      responseType: 'blob'
    })
  },

  downloadImageTemplate(): Promise<Blob> {
    return request({
      url: '/api/v1/import/template/images',
      method: 'get',
      responseType: 'blob'
    })
  }
}
