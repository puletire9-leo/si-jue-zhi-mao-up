import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

const BASE = '/api/v1/modules/feishu'

export interface FeishuConfigStatus {
  configured: boolean
  appIdMasked: string
  appSecretConfigured: boolean
  baseUrl: string
  requiredPermissions: string[]
}

export interface FeishuResourceTable {
  name: string
  configured: boolean
  tableId: string
}

export interface FeishuResource {
  code: string
  name: string
  configured: boolean
  appTokenConfigured: boolean
  appTokenMasked: string
  tables: FeishuResourceTable[]
}

export interface FeishuSelfCheck {
  appId: string
  status: string
  message: string
}

function unwrap<T>(response: unknown): T {
  return (response as ApiResponse<T>).data
}

export const feishuIntegrationApi = {
  status() {
    return request({ url: `${BASE}/config/status`, method: 'get' }).then(unwrap<FeishuConfigStatus>)
  },
  resources() {
    return request({ url: `${BASE}/resources`, method: 'get' }).then(unwrap<FeishuResource[]>)
  },
  saveCredentials(data: { appId?: string; appSecret?: string }) {
    return request({ url: `${BASE}/credentials`, method: 'put', data }).then(unwrap<FeishuConfigStatus>)
  },
  selfCheck() {
    return request({ url: `${BASE}/token/self-check`, method: 'get' }).then(unwrap<FeishuSelfCheck>)
  },
  checkResource(code: string) {
    return request({ url: `${BASE}/resources/${encodeURIComponent(code)}/self-check`, method: 'get' })
      .then(unwrap<Record<string, unknown>>)
  },
  listTables(appToken: string) {
    return request({ url: `${BASE}/bitable/${encodeURIComponent(appToken)}/tables`, method: 'get' })
      .then(unwrap<Record<string, unknown>>)
  }
}
