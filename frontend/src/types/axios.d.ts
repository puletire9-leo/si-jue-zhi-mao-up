import 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig<D = any> {
    _startTime?: number
    __retryCount?: number
    __isRetryAfterRefresh?: boolean
  }
}
