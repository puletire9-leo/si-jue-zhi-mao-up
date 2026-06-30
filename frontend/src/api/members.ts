import request from '@/utils/request'

export interface MembersResponse {
  developers: string[]
  operators: string[]
  purchasers: string[]
}

export async function fetchMembers(): Promise<MembersResponse> {
  const resp = await request({
    url: '/api/v1/auth/members',
    method: 'get'
  })
  return resp?.data ?? { developers: [], operators: [], purchasers: [] }
}
