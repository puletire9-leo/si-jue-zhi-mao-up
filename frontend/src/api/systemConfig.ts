import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

// 类型定义
export interface DeveloperListResponse {
  developerList: string[]
}

export interface CarrierListResponse {
  carrierList: string[]
}

export interface ImageSettingsResponse {
  maxImageSize: number
  productCardWidth: number
  productCardHeight: number
}

// 备份相关类型
export interface BackupRecord {
  id: number
  name: string
  type: string
  size: number
  status: 'success' | 'failed' | 'running'
  storageLocation: 'local' | 'cos'
  cosObjectKey?: string
  cosUrl?: string
  createdAt: string
}

export interface BackupRecordsResponse {
  records: BackupRecord[]
  total: number
  page: number
  limit: number
}

export interface BackupStartResponse {
  name: string
  type: string
  size: number
  status: 'success' | 'failed' | 'running'
  storageLocation: 'local' | 'cos'
  cosObjectKey?: string
  cosUrl?: string
  createdAt: string
}


export const systemConfigApi = {
  /**
   * 开始备份
   */
  async startBackup(backupType: string = 'local'): Promise<ApiResponse<BackupStartResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/backup/start',
        method: 'post',
        data: {
          backup_type: backupType
        }
      })
      
      return response as unknown as ApiResponse<BackupStartResponse>
    } catch (error) {
      console.error('开始备份失败:', error)
      throw error
    }
  },

  /**
   * 获取备份记录
   */
  async getBackupRecords(params: {
    page?: number
    limit?: number
    storageLocation?: string
  } = {}): Promise<ApiResponse<BackupRecordsResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/backup/records',
        method: 'get',
        params
      })
      
      return response as unknown as ApiResponse<BackupRecordsResponse>
    } catch (error) {
      console.error('获取备份记录失败:', error)
      throw error
    }
  },

  /**
   * 下载备份
   */
  async downloadBackup(backupId: number): Promise<ApiResponse<{ url: string }>> {
    try {
      const response = await request({
        url: `/api/v1/system-config/backup/download/${backupId}`,
        method: 'get'
      })
      
      return response as unknown as ApiResponse<{ url: string }>
    } catch (error) {
      console.error('下载备份失败:', error)
      throw error
    }
  },

  /**
   * 删除备份
   */
  async deleteBackup(backupId: number): Promise<ApiResponse<void>> {
    try {
      const response = await request({
        url: `/api/v1/system-config/backup/${backupId}`,
        method: 'delete'
      })
      
      return response as unknown as ApiResponse<void>
    } catch (error) {
      console.error('删除备份失败:', error)
      throw error
    }
  },

  /**
   * 获取过期备份记录
   */
  async getExpiredBackups(): Promise<ApiResponse<BackupRecordsResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/backup/expired',
        method: 'get'
      })
      
      return response as unknown as ApiResponse<BackupRecordsResponse>
    } catch (error) {
      console.error('获取过期备份记录失败:', error)
      throw error
    }
  },
  /**
   * 获取开发人列表
   */
  async getDeveloperList(): Promise<ApiResponse<DeveloperListResponse>> {
    try {
      // request工具在响应拦截器中已经返回了ApiResponse类型，直接使用即可
      const response = await request({
        url: '/api/v1/system-config/developer-list',
        method: 'get'
      })
      
      // 双重类型断言，先转换为unknown，再转换为ApiResponse<DeveloperListResponse>
      return response as unknown as ApiResponse<DeveloperListResponse>
    } catch (error) {
      console.error('获取开发人列表失败:', error)
      // 返回默认值，避免应用崩溃
      return {
        code: 200,
        message: '获取开发人列表失败，使用默认值',
        data: {
          developerList: []
        }
      }
    }
  },

  /**
   * 更新开发人列表
   */
  async updateDeveloperList(developerList: string[]): Promise<ApiResponse<DeveloperListResponse>> {
    try {
      // 过滤空字符串，确保数组有效
      const filteredList = developerList.filter(dev => dev.trim())
      
      const response = await request({
        url: '/api/v1/system-config/developer-list',
        method: 'put',
        data: filteredList
      })
      
      return response as unknown as ApiResponse<DeveloperListResponse>
    } catch (error) {
      console.error('更新开发人列表失败:', error)
      throw error
    }
  },

  /**
   * 获取载体列表
   */
  async getCarrierList(): Promise<ApiResponse<CarrierListResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/carrier-list',
        method: 'get'
      })
      
      return response as unknown as ApiResponse<CarrierListResponse>
    } catch (error) {
      console.error('获取载体列表失败:', error)
      // 返回默认值，避免应用崩溃
      return {
        code: 200,
        message: '获取载体列表失败，使用默认值',
        data: {
          carrierList: []
        }
      }
    }
  },

  /**
   * 更新载体列表
   */
  async updateCarrierList(carrierList: string[]): Promise<ApiResponse<CarrierListResponse>> {
    try {
      // 过滤空字符串，确保数组有效
      const filteredList = carrierList.filter(carrier => carrier.trim())
      
      const response = await request({
        url: '/api/v1/system-config/carrier-list',
        method: 'put',
        data: filteredList
      })
      
      return response as unknown as ApiResponse<CarrierListResponse>
    } catch (error) {
      console.error('更新载体列表失败:', error)
      throw error
    }
  },

  /**
   * 获取图片设置
   */
  async getImageSettings(): Promise<ApiResponse<ImageSettingsResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/image-settings',
        method: 'get'
      })
      
      return response as unknown as ApiResponse<ImageSettingsResponse>
    } catch (error) {
      console.error('获取图片设置失败:', error)
      // 返回默认值，避免应用崩溃
      return {
        code: 200,
        message: '获取图片设置失败，使用默认值',
        data: {
          maxImageSize: 10,
          productCardWidth: 200,
          productCardHeight: 200
        }
      }
    }
  },

  /**
   * 更新图片设置
   */
  async updateImageSettings(settings: ImageSettingsResponse): Promise<ApiResponse<ImageSettingsResponse>> {
    try {
      const response = await request({
        url: '/api/v1/system-config/image-settings',
        method: 'put',
        data: settings
      })
      
      return response as unknown as ApiResponse<ImageSettingsResponse>
    } catch (error) {
      console.error('更新图片设置失败:', error)
      throw error
    }
  },
  

}