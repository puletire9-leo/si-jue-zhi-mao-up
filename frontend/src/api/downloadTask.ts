/**
 * 下载任务API服务
 * 
 * 提供下载任务的创建、查询、下载、删除等接口
 */

import request from '@/utils/request'

export interface DownloadTask {
  id: string
  name: string
  source: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  total_files: number
  completed_files: number
  failed_files: number
  total_size: number
  created_at: string
  completed_at?: string
  error_message?: string
}

export interface DownloadTaskListResponse {
  total: number
  items: DownloadTask[]
}

export interface QueryParams {
  status?: string
  source?: string
  keyword?: string
  page?: number
  page_size?: number
}

/**
 * 创建定稿下载任务
 * @param skus SKU列表
 * @returns 任务ID和消息
 */
export const createFinalDraftDownloadTask = async (skus: string[]): Promise<{ task_id: string; message: string }> => {
  const response = await request.post('/api/v1/download-tasks/final-draft', { skus })
  // request拦截器已经返回了response.data，这里直接返回response
  // 如果后端返回的是 { code, data, message } 格式，需要取 response.data
  // 如果后端直接返回 { task_id, message }，则直接返回 response
  return response.data || response
}

/**
 * 获取下载任务列表
 * @param params 查询参数
 * @returns 任务列表和总数
 */
export const getDownloadTasks = async (params: QueryParams = {}): Promise<any> => {
  const response = await request.get('/api/v1/download-tasks', { params })
  return response
}

/**
 * 获取下载任务详情
 * @param taskId 任务ID
 * @returns 任务详情
 */
export const getDownloadTaskDetail = async (taskId: string): Promise<DownloadTask> => {
  const response = await request.get(`/api/v1/download-tasks/${taskId}`)
  return response.data || response
}

/**
 * 下载任务文件
 * @param taskId 任务ID
 * @param fileName 文件名
 */
export const downloadTaskFile = async (taskId: string, fileName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('开始下载任务文件:', taskId, fileName)
    
    // 获取认证token
    const token = localStorage.getItem('token')
    console.log('Token:', token ? '存在' : '不存在')
    
    // 构建完整URL
    const apiUrl = `/api/v1/download-tasks/${taskId}/download`
    console.log('请求URL:', apiUrl)
    
    // 使用XMLHttpRequest代替fetch，更稳定
    const xhr = new XMLHttpRequest()
    xhr.open('GET', apiUrl, true)
    xhr.responseType = 'blob'
    
    // 设置请求头
    xhr.setRequestHeader('Accept', 'application/zip, application/octet-stream')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    
    // 进度回调
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100
        console.log(`下载进度: ${percentComplete.toFixed(2)}%`)
      }
    }
    
    // 加载完成回调
    xhr.onload = function() {
      console.log('XHR状态:', xhr.status, xhr.statusText)
      
      if (xhr.status === 200) {
        const blob = xhr.response
        console.log('Blob大小:', blob.size, 'bytes')
        console.log('Blob类型:', blob.type)
        
        if (blob.size === 0) {
          reject(new Error('下载的文件为空'))
          return
        }
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', fileName)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        console.log('下载完成:', fileName)
        resolve()
      } else {
        // 尝试解析错误信息
        let errorMessage = `HTTP error! status: ${xhr.status}`
        try {
          const reader = new FileReader()
          reader.onload = function() {
            try {
              const errorData = JSON.parse(reader.result as string)
              errorMessage = errorData.detail || errorData.message || errorMessage
            } catch {
              // 无法解析JSON
            }
            reject(new Error(errorMessage))
          }
          reader.readAsText(xhr.response)
        } catch {
          reject(new Error(errorMessage))
        }
      }
    }
    
    // 错误回调
    xhr.onerror = function() {
      console.error('XHR请求失败')
      reject(new Error('网络请求失败，请检查网络连接'))
    }
    
    // 超时回调
    xhr.ontimeout = function() {
      console.error('XHR请求超时')
      reject(new Error('请求超时，请稍后重试'))
    }
    
    // 发送请求
    console.log('发送XHR请求...')
    xhr.send()
  })
}

/**
 * 删除下载任务
 * @param taskId 任务ID
 */
export const deleteDownloadTask = async (taskId: string): Promise<{ message: string }> => {
  const response = await request.delete(`/api/v1/download-tasks/${taskId}`)
  return response.data || response
}

/**
 * 重试下载任务
 * @param taskId 任务ID
 */
export const retryDownloadTask = async (taskId: string): Promise<{ message: string }> => {
  const response = await request.post(`/api/v1/download-tasks/${taskId}/retry`)
  return response.data || response
}

/**
 * 批量删除下载任务
 * @param taskIds 任务ID列表
 */
export const batchDeleteDownloadTasks = async (taskIds: string[]): Promise<void> => {
  // 并行删除多个任务
  await Promise.all(taskIds.map(id => deleteDownloadTask(id)))
}

/**
 * 批量下载任务文件
 * @param tasks 任务列表
 */
export const batchDownloadTaskFiles = async (tasks: DownloadTask[]): Promise<void> => {
  const completedTasks = tasks.filter(task => task.status === 'completed')
  
  for (const task of completedTasks) {
    try {
      await downloadTaskFile(task.id, `${task.name}.zip`)
      // 添加短暂延迟，避免浏览器同时下载过多文件
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`下载任务 ${task.id} 失败:`, error)
    }
  }
}

/**
 * 清理过期下载任务（管理员）
 * @param days 过期天数
 */
export const cleanupExpiredTasks = async (days: number = 7): Promise<{ message: string }> => {
  const response = await request.post('/api/v1/download-tasks/cleanup', null, {
    params: { days }
  })
  return response.data || response
}

export default {
  createFinalDraftDownloadTask,
  getDownloadTasks,
  getDownloadTaskDetail,
  downloadTaskFile,
  deleteDownloadTask,
  retryDownloadTask,
  batchDeleteDownloadTasks,
  batchDownloadTaskFiles,
  cleanupExpiredTasks
}
