import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

/**
 * 人员名单（按职能）API。统一数据源 person_roster（Java sjzm-product/modules/roster）。
 * role_type: developer(开发人)/operator(运营)/product_manager(产品负责人)/purchaser(采购员)
 */

export interface PersonRoster {
  id: number
  name: string
  roleType: string
  sortOrder: number
  enabled: number
  remark?: string
}

const BASE = '/api/v1/modules/roster'

/** 按职能取姓名数组（下拉用） */
export const getRosterNames = async (roleType: string): Promise<string[]> => {
  try {
    const res = await request({ url: `${BASE}/names`, method: 'get', params: { roleType } })
    return ((res as unknown as ApiResponse<string[]>).data) ?? []
  } catch (error) {
    console.error(`获取名单失败(${roleType}):`, error)
    return []
  }
}

/** 按职能取完整记录（含 id，管理用） */
export const getRosterList = async (roleType?: string): Promise<PersonRoster[]> => {
  const res = await request({ url: `${BASE}/list`, method: 'get', params: roleType ? { roleType } : {} })
  return ((res as unknown as ApiResponse<PersonRoster[]>).data) ?? []
}

/** 新增/更新一条 */
export const saveRoster = (person: Partial<PersonRoster>): Promise<ApiResponse<string>> =>
  request({ url: BASE, method: 'post', data: person }) as unknown as Promise<ApiResponse<string>>

/** 删除一条 */
export const deleteRoster = (id: number): Promise<ApiResponse<string>> =>
  request({ url: `${BASE}/${id}`, method: 'delete' }) as unknown as Promise<ApiResponse<string>>

/** 整组覆盖某职能名单 */
export const batchSetRoster = (roleType: string, names: string[]): Promise<ApiResponse<string>> =>
  request({ url: `${BASE}/batch`, method: 'put', params: { roleType }, data: names }) as unknown as Promise<ApiResponse<string>>

export default { getRosterNames, getRosterList, saveRoster, deleteRoster, batchSetRoster }
