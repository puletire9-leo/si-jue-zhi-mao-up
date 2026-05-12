import request from '@/utils/request'
import type {
  ApiResponse,
  LoginData,
  LoginResponse,
  User,
  UserListParams,
  UserListResponse
} from '@/types/api'

export const userApi = {
  login(data: LoginData): Promise<ApiResponse<LoginResponse>> {
    return request({
      url: '/api/v1/auth/login',
      method: 'post',
      data
    })
  },

  logout(): Promise<ApiResponse<null>> {
    return request({
      url: '/api/v1/auth/logout',
      method: 'post'
    })
  },

  refreshToken(data: { refresh_token: string }): Promise<ApiResponse<LoginResponse>> {
    return request({
      url: '/api/v1/auth/refresh',
      method: 'post',
      data
    })
  },

  getCurrentUser(): Promise<ApiResponse<User>> {
    return request({
      url: '/api/v1/auth/me',
      method: 'get'
    })
  },

  getList(params: UserListParams): Promise<ApiResponse<UserListResponse>> {
    return request({
      url: '/api/v1/users',
      method: 'get',
      params
    })
  },

  getDetail(id: string): Promise<ApiResponse<User>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: 'get'
    })
  },

  create(data: any): Promise<ApiResponse<User>> {
    return request({
      url: '/api/v1/users',
      method: 'post',
      data
    })
  },

  update(id: string, data: any): Promise<ApiResponse<User>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: 'put',
      data
    })
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: 'delete'
    })
  },

  updatePassword(id: string, password: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}/password`,
      method: 'put',
      data: { password }
    })
  },

  updateRole(id: string, role: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}/role`,
      method: 'put',
      data: { role }
    })
  }
}
