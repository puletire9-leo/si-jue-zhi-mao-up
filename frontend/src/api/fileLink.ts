import request from '@/utils/request'
import type {
  FileLink,
  FileLinkCreate,
  FileLinkUpdate,
  FileLinkListParams,
  FileLinkListResponse,
  FileUploadResponse,
  BatchDeleteRequest
} from '@/types/fileLink'

// 文件链接API
export const fileLinkApi = {
  // 获取文件链接列表
  getFileLinks(params: FileLinkListParams): Promise<{
    code: number
    message: string
    data: FileLinkListResponse
  }> {
    return request({
      url: '/api/v1/file-links',
      method: 'get',
      params
    })
  },

  // 获取单个文件链接
  getFileLink(id: number): Promise<{
    code: number
    message: string
    data: FileLink
  }> {
    return request({
      url: `/api/v1/file-links/${id}`,
      method: 'get'
    })
  },

  // 创建文件链接
  createFileLink(data: FileLinkCreate): Promise<{
    code: number
    message: string
    data: FileLink
  }> {
    return request({
      url: '/api/v1/file-links',
      method: 'post',
      data
    })
  },

  // 更新文件链接
  updateFileLink(id: number, data: FileLinkUpdate): Promise<{
    code: number
    message: string
    data: FileLink
  }> {
    return request({
      url: `/api/v1/file-links/${id}`,
      method: 'put',
      data
    })
  },

  // 删除文件链接
  deleteFileLink(id: number): Promise<{
    code: number
    message: string
  }> {
    return request({
      url: `/api/v1/file-links/${id}`,
      method: 'delete'
    })
  },

  // 批量删除文件链接
  batchDeleteFileLinks(ids: number[]): Promise<{
    code: number
    message: string
  }> {
    return request({
      url: '/api/v1/file-links/batch-delete',
      method: 'post',
      data: { ids }
    })
  },

  // 上传文件
  uploadFile(formData: FormData): Promise<{
    code: number
    message: string
    data: FileUploadResponse
  }> {
    return request({
      url: '/api/v1/file-links/upload',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 预览文件链接
  previewFileLink(id: number): Promise<{
    code: number
    message: string
    data: {
      previewUrl: string
      isValid: boolean
      lastChecked: string
    }
  }> {
    return request({
      url: `/api/v1/file-links/${id}/preview`,
      method: 'get'
    })
  },

  // 验证链接有效性
  validateLink(url: string): Promise<{
    code: number
    message: string
    data: {
      isValid: boolean
      statusCode: number
      contentType: string
      checkedAt: string
    }
  }> {
    return request({
      url: '/api/v1/file-links/validate',
      method: 'post',
      data: { url }
    })
  }
}