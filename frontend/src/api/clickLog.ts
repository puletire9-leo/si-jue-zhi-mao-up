/**
 * 产品点击行为追踪
 * fire-and-forget: 不 await，静默失败，不阻塞 UI
 */
import { useUserStore } from '@/stores/user'
import type { ApiResponse } from '@/types/api'
import request from '@/utils/request'

export interface ClickLogParams {
  asin: string
  marketplace: string
  source: string
  action: 'click' | 'select' | 'unselect'
  productTitle: string
}

export interface SelectionUsersRequest {
  asins: string[]
  marketplace: string
}

function getUserName(): string {
  const userStore = useUserStore()
  return userStore.userInfo?.username || userStore.userInfo?.name || userStore.userInfo?.nickname || ''
}

export function trackClick(params: ClickLogParams) {
  const userStore = useUserStore()
  const userId = Number(userStore.userInfo?.id) || 1

  request({
    url: '/api/v1/click-logs',
    method: 'post',
    data: { ...params, userId, userName: getUserName() },
  }).catch(() => {})
}

/** 获取当前用户在指定站点已选中的 ASIN 列表 */
export async function fetchMySelections(marketplace: string): Promise<Set<string>> {
  try {
    const userStore = useUserStore()
    const userId = Number(userStore.userInfo?.id) || 1
    const res = await request<ApiResponse<string[]>, ApiResponse<string[]>>({
      url: `/api/v1/click-logs/my-selections`,
      method: 'get',
      params: { marketplace, userId },
    })
    if (res.code === 200 && Array.isArray(res.data)) {
      return new Set(res.data)
    }
  } catch {}
  return new Set()
}

/** 获取多个 ASIN 在指定站点的选中用户信息 */
export async function fetchSelectionUsers(asins: string[], marketplace: string): Promise<Record<string, { userId: number; userName: string }[]>> {
  if (asins.length === 0) return {}
  try {
    const res = await request<
      ApiResponse<Record<string, { userId: number; userName: string }[]>>,
      ApiResponse<Record<string, { userId: number; userName: string }[]>>
    >({
      url: '/api/v1/click-logs/selection-users',
      method: 'post',
      data: { asins, marketplace } satisfies SelectionUsersRequest,
    })
    if (res.code === 200 && res.data) {
      return res.data
    }
  } catch {}
  return {}
}
