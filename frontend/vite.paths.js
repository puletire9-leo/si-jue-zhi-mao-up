/**
 * 中文路径兼容性配置
 * 解决Windows中文路径在Vite开发环境中的兼容性问题
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 简化路径解析函数
 * 直接使用Node.js的resolve函数，避免不必要的编码处理
 */
export function safeResolve(...paths) {
  return resolve(__dirname, ...paths)
}

/**
 * 路径别名配置
 * 使用标准路径解析
 */
export const pathAliases = {
  '@': resolve(__dirname, 'src'),
  '@components': resolve(__dirname, 'src/components'),
  '@views': resolve(__dirname, 'src/views'),
  '@stores': resolve(__dirname, 'src/stores'),
  '@api': resolve(__dirname, 'src/api'),
  '@utils': resolve(__dirname, 'src/utils'),
  '@styles': resolve(__dirname, 'src/styles'),
  '@types': resolve(__dirname, 'src/types')
}

/**
 * 开发环境路径优化配置
 */
export const devPathConfig = {
  // 启用文件系统路径优化
  fs: {
    // 允许访问的根目录
    allow: [
      safeResolve('.'),
      safeResolve('src'),
      safeResolve('node_modules')
    ],
    // 严格模式，避免路径遍历攻击
    strict: true
  },
  // 静态资源路径处理
  assets: {
    // 资源文件扩展名
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'],
    // 资源文件大小限制
    limit: 4096
  }
}

export default {
  safeResolve,
  pathAliases,
  devPathConfig
}