import request from '@/utils/request'
import type {
  ApiResponse,
  DashboardStatistics,
  ImageTrendData,
  StorageStatistics,
  UserActivityData,
  ImageQualityStatistics
} from '@/types/api'

type StorageStatisticsPayload = {
  by_type?: StorageStatistics[]
}

type UserActivityPayload = {
  daily_activity?: UserActivityData[]
}

type ImageQualityPayload = {
  resolution_distribution?: ImageQualityStatistics[]
}

export const statisticsApi = {
  getDashboardStatistics(): Promise<ApiResponse<DashboardStatistics>> {
    return request({
      url: '/api/v1/statistics/dashboard',
      method: 'get'
    })
  },

  getImageTrend(days: number = 30): Promise<ApiResponse<ImageTrendData[]>> {
    return request({
      url: '/api/v1/statistics/image-trend',
      method: 'get',
      params: { days }
    })
  },
  async getStorageStatistics(): Promise<ApiResponse<StorageStatistics[]>> {
    const response = await request<ApiResponse<StorageStatisticsPayload>, ApiResponse<StorageStatisticsPayload>>({
      url: '/api/v1/statistics/storage',
      method: 'get'
    })

    return {
      code: response.code,
      message: response.message,
      data: Array.isArray(response?.data?.by_type) ? response.data.by_type : []
    }
  },

  async getUserActivity(days: number = 30): Promise<ApiResponse<UserActivityData[]>> {
    const response = await request<ApiResponse<UserActivityPayload>, ApiResponse<UserActivityPayload>>({
      url: '/api/v1/statistics/user-activity',
      method: 'get',
      params: { days }
    })

    return {
      code: response.code,
      message: response.message,
      data: Array.isArray(response?.data?.daily_activity) ? response.data.daily_activity : []
    }
  },

  async getImageQualityStatistics(): Promise<ApiResponse<ImageQualityStatistics[]>> {
    const response = await request<ApiResponse<ImageQualityPayload>, ApiResponse<ImageQualityPayload>>({
      url: '/api/v1/statistics/image-quality',
      method: 'get'
    })

    return {
      code: response.code,
      message: response.message,
      data: Array.isArray(response?.data?.resolution_distribution) ? response.data.resolution_distribution : []
    }
  }
}
