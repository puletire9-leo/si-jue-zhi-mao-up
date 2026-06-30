import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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
    if (info) {
      localStorage.setItem('userInfo', JSON.stringify(info))
    } else {
      localStorage.removeItem('userInfo')
    }
  }

  const login = async (username: string, password: string): Promise<any> => {
    try {
      loading.value = true
      error.value = null
      
      const response = await userApi.login({ username, password })

      // response是ApiResponse<LoginResponse>类型，登录信息在response.data中
      const loginData = response.data

      const accessToken = loginData?.accessToken || loginData?.token || ''
      const refreshToken = loginData?.refreshToken || ''

      setToken(accessToken)
      setRefreshToken(refreshToken)
      setUserInfo(loginData?.userInfo || loginData?.user || null)

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
      
      if (data?.accessToken || data?.access_token) {
        // 保存新token（无过期时间）
        setToken(data.accessToken || data.access_token)

        // 如果返回了新的refresh_token，更新它
        if (data?.refreshToken || data?.refresh_token) {
          setRefreshToken(data.refreshToken || data.refresh_token)
        }
        
        return true
      }
      
      return false
    } catch (error: any) {
      // 处理401错误 - 刷新token可能已过期
      if (error.response?.status === 401) {
        logout()
        window.location.href = '/login'
        return false
      }

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
    error.value = null
  }

  const isAdmin = computed(() => {
    return userInfo.value?.role?.includes('管理员') || userInfo.value?.role?.includes('admin')
  })

  return {
    token,
    refreshToken,
    userInfo,
    loading,
    error,
    isAdmin,
    setToken,
    setRefreshToken,
    setUserInfo,
    login,
    refreshAccessToken,
    getUserInfo,
    logout
  }
})
