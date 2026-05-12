export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PaginationParams {
  page: number
  size: number
}

export interface PaginationResponse<T> {
  list: T[]
  total: number
  page: number
  size: number
}

export interface UploadFile {
  name: string
  url: string
  uid?: string
  status?: string
}

export interface UploadResponse {
  url: string
  filename: string
  size: number
}

export interface ErrorResponse {
  code: number
  message: string
  data: null
  timestamp: string
}

export interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  params?: Record<string, any>
  data?: any
  headers?: Record<string, string>
  timeout?: number
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
