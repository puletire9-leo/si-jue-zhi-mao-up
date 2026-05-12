/**
 * 缓存管理工具类
 * 用于监控和管理图片缓存，实现缓存预加载和统计功能
 */
import { imageCache } from './imageCache'
import { imageCacheOptimizer } from './imageCacheOptimizer'
import { getThumbnailUrlSync } from './imageUrlUtil'

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  /** localStorage缓存统计 */
  localStorage: {
    total: number
    expired: number
    valid: number
  }
  /** 内存缓存统计 */
  memory: {
    total: number
    expired: number
    memoryUsage?: {
      used: number
      total: number
      percentage: number
    }
  }
  /** 总体统计 */
  total: {
    cachedItems: number
    memoryUsage: number
    localStorageUsage: number
  }
}

/**
 * 缓存预加载配置接口
 */
export interface CachePreloadConfig {
  /** 预加载的图片URL列表 */
  imageUrls: string[]
  /** 预加载的尺寸类型 */
  size?: 'large' | 'original' | number
  /** 预加载回调 */
  onProgress?: (progress: number, total: number) => void
  /** 预加载完成回调 */
  onComplete?: () => void
}

/**
 * 缓存管理类
 */
export class CacheManager {
  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  static getCacheStats(): CacheStats {
    // 获取localStorage缓存统计
    const localStorageStats = imageCache.getCacheStats()
    
    // 获取内存缓存统计
    const memoryStats = imageCacheOptimizer.getStats()
    
    // 计算localStorage使用情况
    let localStorageUsage = 0
    try {
      let totalSize = 0
      for (const key in localStorage) {
        if (key.startsWith('image_cache_')) {
          totalSize += localStorage[key].length
        }
      }
      localStorageUsage = totalSize
    } catch (error) {
      console.error('计算localStorage使用情况失败:', error)
    }
    
    // 计算内存使用情况
    let memoryUsage = 0
    try {
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        memoryUsage = (performance as any).memory.usedJSHeapSize
      }
    } catch (error) {
      console.error('计算内存使用情况失败:', error)
    }
    
    return {
      localStorage: localStorageStats,
      memory: memoryStats,
      total: {
        cachedItems: localStorageStats.total + memoryStats.total,
        memoryUsage,
        localStorageUsage
      }
    }
  }

  /**
   * 预加载图片到缓存
   * @param config 预加载配置
   */
  static async preloadImages(config: CachePreloadConfig): Promise<void> {
    const { imageUrls, size = 'large', onProgress, onComplete } = config
    const total = imageUrls.length
    let loaded = 0
    
    for (const url of imageUrls) {
      try {
        // 预加载图片
        await this.preloadImage(url, size)
        loaded++
        
        // 调用进度回调
        if (onProgress) {
          onProgress(loaded, total)
        }
      } catch (error) {
        console.error(`预加载图片失败: ${url}`, error)
        loaded++
        
        // 即使失败也更新进度
        if (onProgress) {
          onProgress(loaded, total)
        }
      }
    }
    
    // 调用完成回调
    if (onComplete) {
      onComplete()
    }
  }

  /**
   * 预加载单个图片
   * @param url 图片URL
   * @param size 尺寸类型
   */
  private static async preloadImage(url: string, size: 'large' | 'original' | number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 获取缩略图URL
        const thumbnailUrl = getThumbnailUrlSync(url, size)
        
        // 创建图片对象进行预加载
        const img = new Image()
        img.onload = () => {
          console.log(`预加载图片成功: ${url}`)
          resolve()
        }
        img.onerror = (error) => {
          console.error(`预加载图片失败: ${url}`, error)
          reject(error)
        }
        img.src = thumbnailUrl
      } catch (error) {
        console.error(`预加载图片失败: ${url}`, error)
        reject(error)
      }
    })
  }

  /**
   * 清理过期缓存
   * @returns 清理的缓存数量
   */
  static clearExpiredCache(): number {
    // 清理localStorage过期缓存
    const localStorageRemoved = imageCache.clearExpiredCache()
    
    // 清理内存过期缓存
    const memoryRemoved = imageCacheOptimizer.clearExpired()
    
    console.log(`清理过期缓存: localStorage=${localStorageRemoved}, memory=${memoryRemoved}`)
    return localStorageRemoved + memoryRemoved
  }

  /**
   * 清理所有缓存
   */
  static clearAllCache(): void {
    // 清理localStorage缓存
    imageCache.clearAllImageUrls()
    
    // 清理内存缓存
    imageCacheOptimizer.clearAll()
    
    console.log('清理所有缓存完成')
  }

  /**
   * 清理指定图片的缓存
   * @param imageUrls 图片URL列表
   */
  static clearImageCache(imageUrls: string[]): void {
    imageUrls.forEach(url => {
      // 生成缓存键
      const cacheKey = `${url}_large_proxy`
      
      // 清理localStorage缓存
      imageCache.removeImageUrl(cacheKey)
      
      // 清理内存缓存
      imageCacheOptimizer.removeImage(cacheKey)
    })
    
    console.log(`清理指定图片缓存: ${imageUrls.length} 张图片`)
  }

  /**
   * 获取缓存使用建议
   * @returns 缓存使用建议
   */
  static getCacheRecommendations(): {
    suggestions: string[]
    actionNeeded: boolean
  } {
    const stats = this.getCacheStats()
    const suggestions: string[] = []
    let actionNeeded = false
    
    // 检查localStorage使用情况
    if (stats.total.localStorageUsage > 5 * 1024 * 1024) { // 超过5MB
      suggestions.push('localStorage缓存使用量较大，建议清理过期缓存')
      actionNeeded = true
    }
    
    // 检查内存使用情况
    if (stats.memory.memoryUsage?.percentage && stats.memory.memoryUsage.percentage > 80) {
      suggestions.push('内存使用量较高，建议清理部分缓存')
      actionNeeded = true
    }
    
    // 检查缓存项数量
    if (stats.total.cachedItems > 200) {
      suggestions.push('缓存项数量较多，建议清理不常用的缓存')
      actionNeeded = true
    }
    
    if (suggestions.length === 0) {
      suggestions.push('缓存使用情况良好，无需特殊操作')
    }
    
    return {
      suggestions,
      actionNeeded
    }
  }

  /**
   * 优化缓存
   * @returns 优化结果
   */
  static optimizeCache(): {
    removedItems: number
    recommendations: string[]
  } {
    // 清理过期缓存
    const removedItems = this.clearExpiredCache()
    
    // 清理内存中访问次数最少的图片
    const leastAccessedRemoved = imageCacheOptimizer.clearLeastAccessedImages(20) // 清理20%访问次数最少的图片
    
    // 获取缓存使用建议
    const { suggestions } = this.getCacheRecommendations()
    
    console.log(`优化缓存: 清理过期项=${removedItems}, 清理最少访问项=${leastAccessedRemoved}`)
    
    return {
      removedItems: removedItems + leastAccessedRemoved,
      recommendations: suggestions
    }
  }

  /**
   * 监控缓存状态
   * @param callback 状态回调
   * @param interval 监控间隔（毫秒）
   * @returns 监控ID，用于停止监控
   */
  static monitorCacheStatus(
    callback: (stats: CacheStats) => void,
    interval: number = 5000
  ): number {
    // 立即执行一次
    callback(this.getCacheStats())
    
    // 设置定时监控
    const monitorId = window.setInterval(() => {
      callback(this.getCacheStats())
    }, interval)
    
    return monitorId
  }

  /**
   * 停止监控缓存状态
   * @param monitorId 监控ID
   */
  static stopMonitorCacheStatus(monitorId: number): void {
    clearInterval(monitorId)
  }
}

/**
 * 缓存管理工具函数
 */
export const getCacheStats = (): CacheStats => {
  return CacheManager.getCacheStats()
}

export const preloadImages = async (config: CachePreloadConfig): Promise<void> => {
  return CacheManager.preloadImages(config)
}

export const clearExpiredCache = (): number => {
  return CacheManager.clearExpiredCache()
}

export const clearAllCache = (): void => {
  CacheManager.clearAllCache()
}

export const clearImageCache = (imageUrls: string[]): void => {
  CacheManager.clearImageCache(imageUrls)
}

export const getCacheRecommendations = (): {
  suggestions: string[]
  actionNeeded: boolean
} => {
  return CacheManager.getCacheRecommendations()
}

export const optimizeCache = (): {
  removedItems: number
  recommendations: string[]
} => {
  return CacheManager.optimizeCache()
}

export const monitorCacheStatus = (
  callback: (stats: CacheStats) => void,
  interval: number = 5000
): number => {
  return CacheManager.monitorCacheStatus(callback, interval)
}

export const stopMonitorCacheStatus = (monitorId: number): void => {
  CacheManager.stopMonitorCacheStatus(monitorId)
}

// 导出缓存管理实例
export const cacheManager = CacheManager

// 页面加载时自动清理过期缓存
window.addEventListener('load', () => {
  const removedCount = CacheManager.clearExpiredCache()
  if (removedCount > 0) {
    console.log(`页面加载时清理了 ${removedCount} 个过期缓存`)
  }
})

// 页面卸载时自动清理内存缓存
window.addEventListener('beforeunload', () => {
  // 清理部分内存缓存，保留必要的缓存
  imageCacheOptimizer.clearLeastAccessedImages(50) // 清理50%访问次数最少的图片
  console.log('页面卸载时清理部分内存缓存')
})
