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
  return response?.data || response
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
  return response?.data || response
}

/**
 * 下载任务文件
 * @param taskId 任务ID
 * @param fileName 文件名
 */
export const downloadTaskFile = async (taskId: string, fileName: string): Promise<void> => {
  const response = await request.post(`/api/v1/download-tasks/${taskId}/download-session`)
  const result = response?.data || response
  if (result?.success === false) {
    throw new Error(result.message || '无法创建下载会话')
  }

  // The authenticated request above sets a short-lived HttpOnly cookie. Let the
  // browser handle the actual response so large ZIP files never become JS Blobs.
  const link = document.createElement('a')
  link.href = `/api/v1/download-tasks/${taskId}/download`
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => link.remove(), 0)
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
