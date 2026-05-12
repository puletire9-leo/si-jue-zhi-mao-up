// 文件链接类型定义

export interface FileLink {
  id: number
  title: string
  url: string
  link_type: 'feishu_xlsx' | 'standard_url'
  linkType?: 'feishu_xlsx' | 'standard_url'
  description?: string
  tags?: string[]
  category?: string
  library_type: 'prompt-library' | 'resource-library'
  status: 'active' | 'inactive' | 'error'
  last_checked?: string
  check_result?: any
  created_at: string
  createdAt?: string
  updated_at: string
  updatedAt?: string
}

export interface FileLinkCreate {
  title: string
  url: string
  link_type: 'feishu_xlsx' | 'standard_url'
  description?: string
  tags?: string[]
  category?: string
  library_type: 'prompt-library' | 'resource-library'
}

export interface FileLinkUpdate extends Partial<FileLinkCreate> {
  status?: 'active' | 'inactive' | 'error'
}

export interface FileLinkListParams {
  page?: number
  size?: number
  keyword?: string
  link_type?: string
  category?: string
  library_type?: 'prompt-library' | 'resource-library'
  status?: string
}

export interface FileLinkListResponse {
  items: FileLink[]
  total: number
  page: number
  size: number
}

export interface FileUploadResponse {
  id: number
  filename: string
  fileUrl: string
  fileSize: number
  uploadTime: string
}

export interface BatchDeleteRequest {
  ids: number[]
}