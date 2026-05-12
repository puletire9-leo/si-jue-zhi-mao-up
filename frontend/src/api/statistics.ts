import request from '@/utils/request'
import type {
  ApiResponse,
  DashboardStatistics,
  ProductTrendData,
  ImageTrendData,
  TopProduct,
  StorageStatistics,
  UserActivityData,
  ImageQualityStatistics
} from '@/types/api'

export const statisticsApi = {
  getDashboardStatistics(): Promise<ApiResponse<DashboardStatistics>> {
    return request({
      url: '/api/v1/statistics/dashboard',
      method: 'get'
    })
  },

  getProductTrend(days: number = 30): Promise<ApiResponse<ProductTrendData[]>> {
    return request({
      url: '/api/v1/statistics/product-trend',
      method: 'get',
      params: { days }
    })
  },

  getImageTrend(days: number = 30): Promise<ApiResponse<ImageTrendData[]>> {
    return request({
      url: '/api/v1/statistics/image-trend',
      method: 'get',
      params: { days }
    })
  },

  getTopProducts(limit: number = 10): Promise<ApiResponse<TopProduct[]>> {
    return request({
      url: '/api/v1/statistics/top-products',
      method: 'get',
      params: { limit }
    })
  },

  getStorageStatistics(): Promise<ApiResponse<StorageStatistics>> {
    return request({
      url: '/api/v1/statistics/storage',
      method: 'get'
    })
  },

  getUserActivity(days: number = 30): Promise<ApiResponse<UserActivityData[]>> {
    return request({
      url: '/api/v1/statistics/user-activity',
      method: 'get',
      params: { days }
    })
  },

  getImageQualityStatistics(): Promise<ApiResponse<ImageQualityStatistics>> {
    return request({
      url: '/api/v1/statistics/image-quality',
      method: 'get'
    })
  }
}
