// 资源文件类型定义
export interface ResourceFile {
  id: number
  name: string
  url: string
  type: 'feishu' | 'excel' | 'link' | 'upload'
  size: string
  createTime: string
  updateTime: string
  description?: string
  tags?: string[]
  category?: string
  createdBy: string
  isPublic: boolean
  thumbnail?: string
  fileExtension?: string
  originalName?: string
}

// 文件列表参数
export interface ResourceFileListParams {
  page?: number
  size?: number
  name?: string
  type?: string
  category?: string
  tags?: string[]
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 添加文件参数
export interface AddResourceFileParams {
  name: string
  url: string
  type: 'feishu' | 'excel' | 'link'
  description?: string
  tags?: string[]
  category?: string
  isPublic?: boolean
}

// 文件上传参数
export interface UploadResourceFileParams {
  file: File
  name?: string
  description?: string
  tags?: string[]
  category?: string
  isPublic?: boolean
}

// 文件预览响应
export interface PreviewResponse {
  url: string
  type: string
  available: boolean
  message?: string
}

// 批量操作参数
export interface BatchOperationParams {
  ids: number[]
}

// 文件统计信息
export interface FileStatistics {
  total: number
  byType: {
    feishu: number
    excel: number
    link: number
    upload: number
  }
  byCategory: Record<string, number>
  totalSize: string
  recentUploads: number
}

// 文件分类
export interface FileCategory {
  id: number
  name: string
  description?: string
  color?: string
  fileCount: number
}

// 文件标签
export interface FileTag {
  id: number
  name: string
  color?: string
  fileCount: number
}

// 文件操作记录
export interface FileOperationRecord {
  id: number
  fileId: number
  fileName: string
  operation: 'create' | 'update' | 'delete' | 'download' | 'preview'
  operator: string
  operationTime: string
  details?: string
}

// 文件搜索响应
export interface FileSearchResponse {
  files: ResourceFile[]
  total: number
  page: number
  size: number
  hasMore: boolean
}