import request from '@/utils/request'

export interface MembersResponse {
  developers: string[]
  operators: string[]
  purchasers: string[]
}

export async function fetchMembers(): Promise<MembersResponse> {
  console.log('[API] 开始请求 /api/v1/auth/members');
  const resp = await request({
    url: '/api/v1/auth/members',
    method: 'get'
  })
  console.log('[API] /api/v1/auth/members 响应:', resp);
  const result = resp?.data ?? { developers: [], operators: [], purchasers: [] };
  console.log('[API] 解析后的数据:', result);
  return result;
}
