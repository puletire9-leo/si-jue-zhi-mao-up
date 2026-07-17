import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { redactSensitiveData } from './redactSensitiveData'

// 端点特定的配置
const endpointConfigs = {
  '/api/v1/auth/me': {
    timeout: 60000, // 认证端点设置更长的超时时间
    maxRetries: 3
  },
  '/api/v1/auth/login': {
    timeout: 45000,
    maxRetries: 2
  },
  '/api/v1/auth/refresh': {
    timeout: 45000,
    maxRetries: 2
  },
  // 下载相关的端点设置更长的超时时间
  '/api/v1/download-tasks': {
    timeout: 300000, // 5分钟超时，用于大文件下载
    maxRetries: 3
  },
  '/api/v1/final-drafts/download-zip': {
    timeout: 300000, // 5分钟超时，用于大文件下载
    maxRetries: 3
  },
  '/api/v1/filter-config': {
    timeout: 120000, // 精筛保存+重新筛选，处理大量商品需更长时间
    maxRetries: 1
  }
}

// 创建axios实例
const createAxiosInstance = (): AxiosInstance => {
  // 相对路径：开发时 Vite proxy 转发 /api，生产时同源直连
  let apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

  // 关键修复：确保 baseURL 不包含重复的 /api/v1
  if (apiBaseUrl && /\/api\/v1\/?$/.test(apiBaseUrl)) {
    apiBaseUrl = apiBaseUrl.replace(/\/api\/v1\/?$/, '')
  }
  
  return axios.create({
    baseURL: apiBaseUrl,
    timeout: 45000, // 默认超时时间增加到 45s
    headers: {
      'Content-Type': 'application/json'
    },
    paramsSerializer: {
      serialize: (params: any) => {
        if (!params) return ''
        
        const parts: string[] = []
        
        const processParam = (key: string, value: any) => {
          if (Array.isArray(value)) {
            // 处理数组类型参数，将其转换为多个同名参数
            value.forEach(v => {
              if (v !== undefined && v !== null) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
              }
            })
          } else if (value !== undefined && value !== null) {
            // 处理普通参数
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          }
        }
        
        for (const key in params) {
          if (Object.prototype.hasOwnProperty.call(params, key)) {
            processParam(key, params[key])
          }
        }
        
        return parts.join('&')
      }
    }
  })
}

const request: AxiosInstance = createAxiosInstance()

const pendingRequests = new Map<string, AbortController>()

const generateRequestKey = (config: InternalAxiosRequestConfig | undefined): string => {
  if (!config) return ''
  const { method, url, params, data } = config
  return [method, url, JSON.stringify(params || {}), JSON.stringify(data || {})].join('&')
}

const addPendingRequest = (config: InternalAxiosRequestConfig | undefined): void => {
  if (!config) return
  const requestKey = generateRequestKey(config)
  const controller = new AbortController()
  config.signal = controller.signal
  
  if (pendingRequests.has(requestKey)) {
    const existingController = pendingRequests.get(requestKey)
    existingController?.abort()
    pendingRequests.delete(requestKey)
  }
  
  pendingRequests.set(requestKey, controller)
}

const removePendingRequest = (config: InternalAxiosRequestConfig | undefined): void => {
  if (!config) return
  const requestKey = generateRequestKey(config)
  if (pendingRequests.has(requestKey)) {
    pendingRequests.delete(requestKey)
  }
}

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 验证配置对象
    if (!config) {
      return Promise.reject(new Error('请求配置错误: 配置对象为undefined'))
    }

    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 记录请求开始时间，用于计算请求耗时
    config._startTime = Date.now()
    
    // 根据端点设置特定的超时时间
    const url = config.url || ''
    for (const endpoint in endpointConfigs) {
      if (url.includes(endpoint)) {
        config.timeout = endpointConfigs[endpoint].timeout
        break
      }
    }

    // 只对GET请求进行重复请求去重，避免误中止POST/PUT等重要请求
    // 对于blob类型的请求（大文件下载），不进行去重，避免下载中断
    if (config.responseType !== 'blob' && config.method?.toLowerCase() === 'get') {
      removePendingRequest(config)
      addPendingRequest(config)
    }

    return config
  },
  (error: any) => {
    return Promise.reject(error)
  }
)

// 定义请求重试配置
const RETRY_CONFIG = {
  retries: 3, // 重试次数
  delay: 1000, // 重试延迟（毫秒）
  retryableStatuses: [500, 502, 503, 504], // 可重试的状态码
  retryableErrors: ['Network Error', 'ECONNABORTED'] // 可重试的错误类型
}

// 重试延迟函数
const retryDelay = (retryCount: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, RETRY_CONFIG.delay * Math.pow(2, retryCount - 1)) // 指数退避
  })
}

request.interceptors.response.use(
  async (response: AxiosResponse) => {
    removePendingRequest(response.config as InternalAxiosRequestConfig)

    const res = response.data

    if ((response.config.responseType as string) === 'blob') {
      return response.data
    }

    // 首先检查HTTP状态码
    if (response.status === 200 || response.status === 206) {
      // 如果是200或206状态码，都认为请求成功
      if ((response.config.responseType as string) === 'blob') {
        return response.data
      }

      // 对于非blob响应，继续处理
      if (res && typeof res === 'object') {
        if (res.code === 200) {
          return res
        } else {
          // 对于业务错误，我们仍然返回响应数据，让调用者决定如何处理
          return res
        }
      } else {
        return res
      }
    }
    
    // 处理401错误（业务层）：尝试刷新 token
    if (response.status === 401 || (res && res.code === 401)) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken && !(response.config as any).__isRetryAfterRefresh) {
        try {
          const refreshRes = await request({
            url: '/api/v1/auth/refresh',
            method: 'post',
            data: { refresh_token: refreshToken }
          })
          const newToken = refreshRes?.data?.accessToken || refreshRes?.data?.access_token
          if (newToken) {
            localStorage.setItem('token', newToken)
            const newRefresh = refreshRes?.data?.refreshToken || refreshRes?.data?.refresh_token
            if (newRefresh) {
              localStorage.setItem('refresh_token', newRefresh)
            }
            // 用新 token 重试原请求
            const config = response.config
            config.headers.Authorization = `Bearer ${newToken}`
            ;(config as any).__isRetryAfterRefresh = true
            return request(config)
          }
        } catch {}
      }
      ElMessage.error('登录已过期，请重新登录')
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(new Error(res?.message || '未授权'))
    }
    
    // 处理其他HTTP错误
    const errorMessage = res?.message || `请求失败 (${response.status})`
    ElMessage.error(errorMessage)
    return Promise.reject(new Error(errorMessage))
  },
  async (error: any) => {
    const config = error.config as InternalAxiosRequestConfig | undefined
    
    if (config?.responseType === 'blob') {
      return Promise.reject(error)
    }
    
    removePendingRequest(config)

    if (axios.isCancel(error) || error.name === 'CanceledError') {
      return Promise.reject(error)
    }

    // 将错误信息发送到后端日志接口
    try {
      const fullUrl = config ? `${config.baseURL || ''}${config.url || ''}` : 'unknown'
      const errorLog = redactSensitiveData({
        timestamp: new Date().toISOString(),
        url: fullUrl,
        method: config?.method || '',
        requestConfig: {
          headers: config?.headers,
          params: config?.params,
          data: config?.data
        },
        error: {
          message: error.message,
          stack: error.stack,
          response: error.response ? {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          } : null,
          request: error.request ? {
            url: error.request.url,
            method: error.request.method
          } : null
        },
        userAgent: navigator.userAgent,
        ip: '127.0.0.1', // 前端无法获取真实IP，使用127.0.0.1代替
        processingTime: config?._startTime ? `${Date.now() - config._startTime}ms` : null
      })
      
      // 发送错误日志到后端
      fetch('/api/v1/logs/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorLog)
      })
    } catch (logError) {
      // 静默失败
    }
    
    // 检查是否需要重试
    const retryCount = config?.__retryCount || 0
    
    // 获取端点特定的重试配置
    let maxRetries = RETRY_CONFIG.retries
    const url = config?.url || ''
    for (const endpoint in endpointConfigs) {
      if (url.includes(endpoint)) {
        maxRetries = endpointConfigs[endpoint].maxRetries
        break
      }
    }
    
    const shouldRetry = 
      retryCount < maxRetries && 
      (error.response ? 
        RETRY_CONFIG.retryableStatuses.includes(error.response.status) : 
        RETRY_CONFIG.retryableErrors.some(err => error.message?.includes(err)))
    
    if (shouldRetry && config) {
      // 更新重试计数
      config.__retryCount = retryCount + 1

      // 等待重试延迟
      await retryDelay(config.__retryCount)
      
      // 重试请求
      return request(config)
    }

    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 400:
          ElMessage.error(data?.message || '请求参数错误')
          break
        case 401:
          // 检查是否为登录请求
          if (config?.url?.includes('/auth/login')) {
            // 登录请求失败，显示后端返回的具体错误信息
            ElMessage.error(data?.message || '用户名或密码错误')
          } else if (config?.url?.includes('/auth/refresh')) {
            // 刷新 token 本身失败 → 清除状态跳转登录
            ElMessage.error('登录已过期，请重新登录')
            localStorage.removeItem('token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          } else {
            // 其他请求401：尝试刷新 token 后重试一次
            if (!config.__isRetryAfterRefresh) {
              const refreshToken = localStorage.getItem('refresh_token')
              if (refreshToken) {
                try {
                  const refreshRes = await request({
                    url: '/api/v1/auth/refresh',
                    method: 'post',
                    data: { refresh_token: refreshToken }
                  })
                  const newToken = refreshRes?.data?.accessToken || refreshRes?.data?.access_token
                  if (newToken) {
                    localStorage.setItem('token', newToken)
                    const newRefresh = refreshRes?.data?.refreshToken || refreshRes?.data?.refresh_token
                    if (newRefresh) {
                      localStorage.setItem('refresh_token', newRefresh)
                    }
                    // 用新 token 重试原请求
                    config.headers.Authorization = `Bearer ${newToken}`
                    config.__isRetryAfterRefresh = true
                    return request(config)
                  }
                } catch {}
              }
            }
            // 刷新失败或没有 refresh_token → 清除状态跳转登录
            ElMessage.error('登录已过期，请重新登录')
            localStorage.removeItem('token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          }
          break
        case 403:
          ElMessage.error('拒绝访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 422:
          ElMessage.error(data?.message || '数据验证失败')
          break
        case 500:
          ElMessage.error('服务器错误')
          break
        case 502:
          ElMessage.error('网关错误')
          break
        case 503:
          ElMessage.error('服务不可用')
          break
        case 504:
          ElMessage.error('网关超时')
          break
        default:
          ElMessage.error(data?.message || `请求失败 (${status})`)
      }
    } else if (error.request) {
      ElMessage.error('网络连接失败，请检查网络设置或后端服务是否正常运行')
    } else {
      // 处理配置为undefined的情况
      if (!config) {
        ElMessage.error('请求配置错误：配置对象为undefined，请检查axios实例配置和环境变量')
      } else {
        ElMessage.error('请求配置错误或请求被取消')
      }
    }

    return Promise.reject(error)
  }
)

export default request
