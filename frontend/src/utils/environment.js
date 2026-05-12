// 环境工具函数

/**
 * 获取当前环境
 */
export function getEnvironment() {
  return import.meta.env.VITE_ENVIRONMENT || 'development'
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment() {
  return getEnvironment() === 'development'
}

/**
 * 检查是否为生产环境
 */
export function isProduction() {
  return getEnvironment() === 'production'
}

/**
 * 获取API基础URL
 */
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || ''
}

/**
 * 环境特定的日志函数
 */
export function log(message, level = 'info') {
  if (isDevelopment() || level === 'error') {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${getEnvironment().toUpperCase()}] ${message}`)
  }
}

/**
 * 开发环境专用函数（生产环境不会执行）
 */
export function devOnly(callback) {
  if (isDevelopment()) {
    callback()
  }
}
