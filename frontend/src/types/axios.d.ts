import { InternalAxiosRequestConfig } from 'axios'

// 扩展InternalAxiosRequestConfig接口，添加自定义属性
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    // 请求开始时间，用于计算请求耗时
    _startTime?: number
    // 重试计数，用于请求重试机制
    __retryCount?: number
  }
}
