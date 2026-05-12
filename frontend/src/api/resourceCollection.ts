import request from '@/utils/request'

// 获取文件列表
export const getResourceFiles = (params: any) => {
  // 转换参数以匹配后端API
  const transformedParams = {
    library_type: params.library_type || 'resource-library',
    page: params.page || 1,
    size: params.size || 10,
    keyword: params.name || '',
    category: params.category || '',
    link_type: params.type || '',
    status: params.status || ''
  }
  
  return request({
    url: '/file-links',
    method: 'get',
    params: transformedParams
  })
}

// 添加文件链接
export const addResourceFile = (data: any) => {
  return request({
    url: '/file-links',
    method: 'post',
    data
  })
}

// 上传文件
export const uploadResourceFile = (file: File, options: any = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', options.title || file.name)
  formData.append('library_type', options.library_type || 'resource-library')
  if (options.description) {
    formData.append('description', options.description)
  }
  if (options.tags) {
    formData.append('tags', JSON.stringify(options.tags))
  }
  if (options.category) {
    formData.append('category', options.category)
  }
  
  return request({
    url: '/file-links/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 删除文件
export const deleteResourceFile = (id: number) => {
  return request({
    url: `/file-links/${id}`,
    method: 'delete'
  })
}

// 批量删除文件
export const batchDeleteResourceFiles = (ids: number[]) => {
  return request({
    url: '/file-links/batch-delete',
    method: 'post',
    data: ids
  })
}

// 获取文件信息
export const getResourceFileInfo = (id: number) => {
  return request({
    url: `/file-links/${id}`,
    method: 'get'
  })
}

// 更新文件信息
export const updateResourceFile = (id: number, data: any) => {
  return request({
    url: `/file-links/${id}`,
    method: 'put',
    data
  })
}

// 获取分类列表
export const getResourceCategories = (libraryType: string) => {
  return request({
    url: `/file-links/${libraryType}/categories`,
    method: 'get'
  })
}

// 检查链接状态
export const checkResourceLinkStatus = (id: number) => {
  return request({
    url: `/file-links/${id}/check`,
    method: 'post'
  })
}