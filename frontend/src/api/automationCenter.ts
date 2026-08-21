import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'
import type { LingxingRegistration, LingxingTask } from './lingxingRuntimeCenter'

const BASE = '/api/v1/modules/automation'
const LINGXING_BASE = '/api/v1/modules/lingxing/request-center'

export interface AutomationJob {
  code: string
  name: string
  description: string
  configured: boolean
  enabled: boolean
  scheduleType: string
  cronExpression?: string | null
  fixedDelaySeconds?: number | null
  nextRunAt?: string | null
  lastRunAt?: string | null
}

export interface AutomationRun {
  id: string
  runNo: string
  jobCode: string
  triggerType: string
  requestedBy: string
  correlationId?: string | null
  status: string
  requestJson?: string | null
  resultJson?: string | null
  totalCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  errorMessage?: string | null
  startedAt: string
  finishedAt?: string | null
}

function unwrap<T>(response: unknown): T {
  return (response as ApiResponse<T>).data
}

export const automationCenterApi = {
  jobs() {
    return request({ url: `${BASE}/jobs`, method: 'get' }).then(unwrap<AutomationJob[]>)
  },
  runs(jobCode?: string, limit = 50) {
    return request({ url: `${BASE}/runs`, method: 'get', params: { jobCode, limit } }).then(unwrap<AutomationRun[]>)
  },
  registrations() {
    return request({ url: `${LINGXING_BASE}/registrations`, method: 'get' }).then(unwrap<LingxingRegistration[]>)
  },
  saveRegistration(value: LingxingRegistration) {
    return request({
      url: `${LINGXING_BASE}/registrations/${value.registrationCode}`,
      method: 'put',
      data: value
    }).then(unwrap<LingxingRegistration>)
  },
  dispatch(registrationCode: string) {
    return request({ url: `${LINGXING_BASE}/registrations/${registrationCode}/dispatch`, method: 'post' })
      .then(unwrap<LingxingTask>)
  }
}

