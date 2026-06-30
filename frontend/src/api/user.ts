import request from "@/utils/request";
import type {
  ApiResponse,
  LoginData,
  LoginResponse,
  User,
  UserListParams,
  UserListResponse,
} from "@/types/api";

export const userApi = {
  login(data: LoginData): Promise<ApiResponse<LoginResponse>> {
    return request({
      url: "/api/v1/auth/login",
      method: "post",
      data,
    });
  },

  logout(): Promise<ApiResponse<null>> {
    return request({
      url: "/api/v1/auth/logout",
      method: "post",
    });
  },

  refreshToken(data: {
    refresh_token: string;
  }): Promise<ApiResponse<LoginResponse>> {
    return request({
      url: "/api/v1/auth/refresh",
      method: "post",
      data,
    });
  },

  getCurrentUser(): Promise<ApiResponse<User>> {
    return request({
      url: "/api/v1/auth/me",
      method: "get",
    });
  },

  // 修改本人密码（需旧密码校验）
  updateSelfPassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<null>> {
    return request({
      url: "/api/v1/auth/me/password",
      method: "put",
      data: { oldPassword, newPassword },
    });
  },

  getList(params: UserListParams): Promise<ApiResponse<UserListResponse>> {
    return request({
      url: "/api/v1/users",
      method: "get",
      params,
    });
  },

  getDetail(id: string): Promise<ApiResponse<User>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: "get",
    });
  },

  create(data: any): Promise<ApiResponse<User>> {
    return request({
      url: "/api/v1/users",
      method: "post",
      data,
    });
  },

  update(id: string, data: any): Promise<ApiResponse<User>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: "put",
      data,
    });
  },

  delete(id: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}`,
      method: "delete",
    });
  },

  updatePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}/password`,
      method: "put",
      data: { oldPassword, newPassword },
    });
  },

  updateRole(id: string, role: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}/role`,
      method: "put",
      data: { role },
    });
  },

  // 管理员重置他人密码（无需旧密码，仅 admin 可调用）
  resetPassword(id: string, newPassword: string): Promise<ApiResponse<null>> {
    return request({
      url: `/api/v1/users/${id}/password/reset`,
      method: "put",
      data: { newPassword },
    });
  },
};
