import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

const BASE = '/api/v1/modules/lingxing/request-center'

export interface LingxingTask {
  id: number
  taskId: string
  taskType: string
  registrationCode?: string | null
  priority: number
  accountKey?: string | null
  status: string
  payloadJson?: string | null
  resultJson?: string | null
  errorMessage?: string | null
  attemptCount: number
  operator?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface LingxingRegistration {
  id?: string
  registrationCode: string
  automationJobCode: string
  taskType: string
  taskName: string
  enabled: number
  scheduleType: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'FIXED_DELAY'
  runTime?: string | null
  dayOfWeek?: number | null
  fixedDelaySeconds?: number | null
  timezone: string
  priority: number
  slotGroup: string
  slotOrder: number
  minimumGapSeconds: number
  payloadTemplateJson?: string | null
  nextRunAt?: string | null
  lastEnqueuedAt?: string | null
  lastTaskId?: string | null
  lastStatus?: string | null
  lastError?: string | null
  retryLimit: number
  remark?: string | null
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
}

export interface LingxingMcpStatus {
  configured: boolean
  protocol_version: string
  transport: string
}

export interface LingxingMcpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

function unwrap<T>(response: unknown): T {
  return (response as ApiResponse<T>).data
}

export const lingxingRuntimeApi = {
  listTasks(params: { taskType?: string; status?: string; page?: number; size?: number } = {}) {
    return request({ url: `${BASE}/tasks`, method: 'get', params }).then(unwrap<PageResult<LingxingTask>>)
  },
  listRegistrations() {
    return request({ url: `${BASE}/registrations`, method: 'get' }).then(unwrap<LingxingRegistration[]>)
  },
  listHandlers() {
    return request({ url: `${BASE}/handlers`, method: 'get' }).then(unwrap<string[]>)
  },
  dispatch(code: string) {
    return request({ url: `${BASE}/registrations/${code}/dispatch`, method: 'post' }).then(unwrap<LingxingTask>)
  },
  stop(taskId: string) {
    return request({ url: `${BASE}/tasks/${taskId}/stop`, method: 'post' }).then(unwrap<number>)
  },
  recover() {
    return request({ url: `${BASE}/recover`, method: 'post' }).then(unwrap<number>)
  },
  mcpStatus() {
    return request({ url: '/api/v1/lingxing-mcp/status', method: 'get' }) as unknown as Promise<LingxingMcpStatus>
  },
  mcpTools() {
    return request({ url: '/api/v1/lingxing-mcp/tools', method: 'get' }) as unknown as Promise<{ tools?: LingxingMcpTool[] } | LingxingMcpTool[]>
  }
}

