import request from '@/utils/request'
import type {
  ApiResponse,
  Log,
  LogListParams,
  LogListResponse,
  SystemDoc,
  SystemDocListResponse,
  UpdateRecord,
  UpdateRecordListResponse,
  Requirement,
  RequirementListResponse,
  RequirementCreate,
  RequirementUpdate
} from '@/types/api'

// 验证请求配置的函数
const validateRequestConfig = (config: any): boolean => {
  console.log('验证请求配置:', config)
  
  if (!config) {
    console.error('严重错误: 请求配置为undefined')
    return false
  }
  if (!config.url) {
    console.error('严重错误: 请求URL为undefined')
    return false
  }
  if (!config.method) {
    console.error('严重错误: 请求方法为undefined')
    return false
  }
  
  console.log('请求配置验证通过')
  return true
}

// 创建请求配置的函数
const createRequestConfig = (url: string, method: string, options: any = {}): any => {
  console.log('创建请求配置:', {
    url,
    method,
    options
  })
  
  const config = {
    url,
    method,
    ...options
  }
  
  if (!validateRequestConfig(config)) {
    const error = new Error('请求配置无效')
    console.error('请求配置创建失败:', error)
    throw error
  }
  
  console.log('请求配置创建成功:', {
    url: config.url,
    method: config.method,
    hasParams: !!config.params,
    hasData: !!config.data,
    responseType: config.responseType
  })
  
  return config
}

export const logsApi = {
  getList(params: LogListParams): Promise<ApiResponse<LogListResponse>> {
    try {
      const config = createRequestConfig('/api/v1/logs', 'get', {
        params
      })
      return request(config)
    } catch (error) {
      console.error('创建getList请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  getDetail(id: string): Promise<ApiResponse<Log>> {
    try {
      const config = createRequestConfig(`/api/v1/logs/${id}`, 'get')
      return request(config)
    } catch (error) {
      console.error('创建getDetail请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  export(params: Record<string, any>): Promise<Blob> {
    try {
      const config = createRequestConfig('/api/v1/logs/export', 'get', {
        params,
        responseType: 'blob'
      })
      return request(config)
    } catch (error) {
      console.error('创建export请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  // 系统文档相关接口
  getSystemDocs(): Promise<ApiResponse<SystemDocListResponse>> {
    try {
      const config = createRequestConfig('/api/v1/logs/system-docs', 'get')
      return request(config)
    } catch (error) {
      console.error('创建getSystemDocs请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  // 更新记录相关接口
  getUpdateRecords(): Promise<ApiResponse<UpdateRecordListResponse>> {
    try {
      const config = createRequestConfig('/api/v1/logs/update-records', 'get')
      return request(config)
    } catch (error) {
      console.error('创建getUpdateRecords请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  // 需求清单相关接口
  getRequirements(): Promise<ApiResponse<RequirementListResponse>> {
    try {
      const config = createRequestConfig('/api/v1/logs/requirements', 'get')
      return request(config)
    } catch (error) {
      console.error('创建getRequirements请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  createRequirement(data: RequirementCreate): Promise<ApiResponse<Requirement>> {
    try {
      const config = createRequestConfig('/api/v1/logs/requirements', 'post', {
        data
      })
      return request(config)
    } catch (error) {
      console.error('创建createRequirement请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  updateRequirement(id: string, data: RequirementUpdate): Promise<ApiResponse<Requirement>> {
    try {
      const config = createRequestConfig(`/api/v1/logs/requirements/${id}`, 'put', {
        data
      })
      return request(config)
    } catch (error) {
      console.error('创建updateRequirement请求配置失败:', error)
      return Promise.reject(error)
    }
  },

  deleteRequirement(id: string): Promise<ApiResponse<void>> {
    try {
      const config = createRequestConfig(`/api/v1/logs/requirements/${id}`, 'delete')
      return request(config)
    } catch (error) {
      console.error('创建deleteRequirement请求配置失败:', error)
      return Promise.reject(error)
    }
  }
}
