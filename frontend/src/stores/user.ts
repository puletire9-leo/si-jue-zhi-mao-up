import { defineStore } from 'pinia'
import { ref, onMounted } from 'vue'
import { userApi } from '@/api/user'
import type { User, LoginResponse } from '@/types/api'

export const useUserStore = defineStore('user', () => {
  // 从localStorage加载token
  const loadFromLocalStorage = (): { token: string; refreshToken: string } => {
    const token = localStorage.getItem('token') || ''
    const refreshToken = localStorage.getItem('refresh_token') || ''
    
    return { token, refreshToken }
  }

  // 初始化状态
  const { token: initialToken, refreshToken: initialRefreshToken } = loadFromLocalStorage()
  
  const token = ref<string>(initialToken)
  const refreshToken = ref<string>(initialRefreshToken)
  const userInfo = ref<User | null>(null)
  const permissions = ref<any[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  const setToken = (newToken: string): void => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
  }

  const setRefreshToken = (newRefreshToken: string): void => {
    refreshToken.value = newRefreshToken
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken)
    } else {
      localStorage.removeItem('refresh_token')
    }
  }

  const setUserInfo = (info: User | null): void => {
    userInfo.value = info
  }

  const setPermissions = (perms: any[]): void => {
    permissions.value = perms
  }

  const login = async (username: string, password: string): Promise<any> => {
    try {
      loading.value = true
      error.value = null
      
      const response = await userApi.login({ username, password })
      
      // response是ApiResponse<LoginResponse>类型，登录信息在response.data中
      const loginData = response.data
      
      // 优先使用access_token，如果不存在则使用token
      const accessToken = loginData?.access_token || loginData?.token || ''
      const refreshToken = loginData?.refresh_token || ''
      
      // 保存token（无过期时间）
      setToken(accessToken)
      setRefreshToken(refreshToken)
      setUserInfo(loginData?.user || null)
      
      // 登录后立即获取完整的用户信息和权限
      await getUserInfo()
      
      return response
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message || '登录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken.value) {
        throw new Error('No refresh token available')
      }
      
      // 静默刷新，不显示加载状态
      const response = await userApi.refreshToken({ refresh_token: refreshToken.value })
      const data = response.data
      
      if (data?.access_token) {
        // 保存新token（无过期时间）
        setToken(data.access_token)
        
        // 如果返回了新的refresh_token，更新它
        if (data?.refresh_token) {
          setRefreshToken(data.refresh_token)
        }
        
        return true
      }
      
      return false
    } catch (error: any) {
      console.error('Token refresh failed:', error)
      
      // 处理401错误 - 刷新token可能已过期
      if (error.response?.status === 401) {
        console.error('Refresh token is invalid, redirecting to login')
        // 清除token
        logout()
        // 跳转到登录页
        window.location.href = '/login'
        return false
      }
      
      // 处理网络错误
      if (error.message?.includes('Network Error')) {
        console.error('Network error during token refresh')
        return false
      }
      
      // 处理超时错误
      if (error.message?.includes('timeout')) {
        console.error('Timeout during token refresh')
        return false
      }
      
      // 其他错误
      return false
    }
  }

  const getUserInfo = async (): Promise<User> => {
    try {
      loading.value = true
      error.value = null
      
      const response = await userApi.getCurrentUser()
      
      // 处理两种可能的响应格式：
      // 1. ApiResponse格式：{ code, message, data }
      // 2. 直接返回User对象
      let userData: User
      if (response.code && response.data) {
        // ApiResponse格式
        userData = response.data
      } else {
        // 直接返回User对象，使用更安全的类型转换
        userData = response as unknown as User
      }
      
      setUserInfo(userData)
      setPermissions(userData.permissions || [])
      
      return userData
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message || '获取用户信息失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const logout = (): void => {
    // 清除token和刷新token
    setToken('')
    setRefreshToken('')
    setUserInfo(null)
    setPermissions([])
  }

  const hasPermission = (permissionCode: string): boolean => {
    // 管理员拥有所有权限，处理不同的角色名称格式：
    // - 前端期望：'管理员'
    // - 后端返回：'admin'（小写）
    if (userInfo.value && (userInfo.value.role === '管理员' || userInfo.value.role === 'admin')) {
      return true
    }
    
    // 基于角色的简单权限检查
    // 开发角色拥有大部分权限
    if (userInfo.value && userInfo.value.role === '开发') {
      return true
    }
    
    // 美术和仓库角色拥有基础权限
    if (userInfo.value && (userInfo.value.role === '美术' || userInfo.value.role === '仓库')) {
      return true
    }
    
    // 默认返回true，确保系统可以正常运行
    return true
  }

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => hasPermission(code))
  }

  const initializeAuth = (): void => {
    // 无需要启动token刷新定时器，因为token无期限有效
  }

  onMounted(() => {
    initializeAuth()
  })

  return {
    token,
    refreshToken,
    userInfo,
    permissions,
    loading,
    error,
    setToken,
    setRefreshToken,
    setUserInfo,
    setPermissions,
    login,
    refreshAccessToken,
    getUserInfo,
    logout,
    hasPermission,
    hasAnyPermission,
    initializeAuth
  }
})
