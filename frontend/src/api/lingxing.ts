import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

type LingxingUploadPayload = {
  url: string
  object_key: string
  filename: string
}

/**
 * 上传图片到领星 OSS
 * @param file 图片文件
 * @returns 图片 URL 和对象键
 */
export const uploadLingxingImage = async (file: File): Promise<ApiResponse<LingxingUploadPayload>> => {
  const formData = new FormData()
  formData.append('file', file)

  return request.post<ApiResponse<LingxingUploadPayload>, ApiResponse<LingxingUploadPayload>>(
    '/api/v1/lingxing/upload-image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  )
}

/**
 * 下载领星导入模板
 */
export const downloadTemplate = async (): Promise<void> => {
  const response = await request<Blob, Blob>({
    url: '/api/v1/lingxing/download-template',
    method: 'get',
    responseType: 'blob'
  })

  const url = window.URL.createObjectURL(response)
  const link = document.createElement('a')
  link.href = url
  link.download = '产品汇总表-模板.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default {
  uploadLingxingImage,
  downloadTemplate
}
