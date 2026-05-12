import request from '@/utils/request'
import type {
  ApiResponse,
  Image,
  ImageListParams,
  ImageListResponse
} from '@/types/api'

export const imageApi = {
  getList(params: ImageListParams): Promise<ApiResponse<ImageListResponse>> {
    return request({
      url: '/api/v1/images',
      method: 'get',
      params
    })
  },

  getDetail(id: string): Promise<ApiResponse<Image>> {
    return request({
      url: `/api/v1/images/${id}`,
      method: 'get'
    })
  },

  upload(file: File, category: string = 'final', sku?: string, onProgress?: (progress: number) => void): Promise<ApiResponse<Image>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    if (sku !== undefined) {
      formData.append('sku', sku)
    }
    return request({
      url: '/api/v1/images/upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
          onProgress(progress)
        }
      }
    })
  },

  batchUpload(files: File[], category: string = 'final', sku?: string, onProgress?: (progress: number) => void): Promise<ApiResponse<Image[]>> {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('category', category)
    if (sku !== undefined) {
      formData.append('sku', sku)
    }
    return request({
      url: '/api/v1/images/batch-upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
          onProgress(progress)
        }
      }
    })
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/images/${id}`,
      method: 'delete'
    })
  },

  batchDelete(ids: string[]): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/images/batch',
      method: 'delete',
      data: { ids }
    })
  },

  update(id: string, data: any): Promise<ApiResponse<Image>> {
    return request({
      url: `/api/v1/images/${id}`,
      method: 'put',
      data
    })
  },

  search(keyword: string, params: Record<string, any> = {}): Promise<ApiResponse<ImageListResponse>> {
    return request({
      url: '/api/v1/images',
      method: 'get',
      params: { keyword, ...params }
    })
  },

  searchSimilar(imageId: string, limit: number = 10): Promise<ApiResponse<Image[]>> {
    return request({
      url: `/api/v1/images/${imageId}/similar`,
      method: 'get',
      params: { limit }
    })
  },

  searchByImage(file: File, limit: number = 10): Promise<ApiResponse<Image[]>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('limit', limit.toString())
    return request({
      url: '/api/v1/images/search-similar',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}
