import request from '@/utils/request'
import type { UploadFile } from 'element-plus'

/**
 * 上传图片到领星COS
 * @param file 图片文件
 * @returns 图片URL和对象键
 */
export const uploadLingxingImage = async (file: File): Promise<{
  code: number
  message: string
  data: {
    url: string
    object_key: string
    filename: string
  }
}> => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await request.post('/api/v1/lingxing/upload-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  
  // 如果拦截器已经解包了 data，直接返回
  if (typeof response === 'object' && 'code' in response) {
    return response as { code: number; message: string; data: { url: string; object_key: string; filename: string } }
  }
  
  // 否则返回 response.data
  return (response as { data: { code: number; message: string; data: { url: string; object_key: string; filename: string } } }).data
}

/**
 * 下载领星导入模板
 */
export const downloadTemplate = () => {
  const link = document.createElement('a')
  link.href = '/templates/产品汇总表-模版.xlsx'
  link.download = '产品汇总表-模版.xlsx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default {
  uploadLingxingImage,
  downloadTemplate
}
