import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface RdsPing {
  ok: boolean
  message: string
  elapsedMs?: number
}

export interface RdsLivePool {
  id: string
  host: string
  port: number
  database: string
  username: string
  remote: boolean
  ping: RdsPing
}

export interface RdsDeclaredPool {
  id: string
  owner: string
  database: string
  envKeys: string
  configFile: string
  purpose: string
  liveInThisService: boolean
}

export interface RdsApiBinding {
  id: string
  poolId: string
  database: string
  routes: string[]
}

export interface RdsOverview {
  connectionRegistry: string
  sameInstanceHint: string
  livePools: RdsLivePool[]
  declaredPools: RdsDeclaredPool[]
  apiBindings: RdsApiBinding[]
  primaryOnRemote: boolean
  rdsPoolOnRemote: boolean
}

export interface PythonRdsStatus {
  livePools: RdsLivePool[]
  rdsOverrideActive: boolean
  routes: string[]
}

function unwrap<T>(response: unknown): T {
  return (response as ApiResponse<T>).data
}

export const rdsManagementApi = {
  overview() {
    return request.get('/api/v1/modules/rds-center/overview').then(unwrap<RdsOverview>)
  },
  pythonStatus() {
    return request.get('/api/v1/rds-center/status').then(unwrap<PythonRdsStatus>)
  }
}
