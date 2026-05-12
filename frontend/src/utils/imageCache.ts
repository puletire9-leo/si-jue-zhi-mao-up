/**
 * 图片缓存管理工具类
 * 用于缓存图片URL和元数据，减少重复请求
 */

// 图片缓存项接口
export interface ImageCacheItem {
  url: string;
  timestamp: number;
  expires: number;
  metadata?: Record<string, any>;
}

// 图片缓存类
export class ImageCache {
  private prefix = 'image_cache_';
  private defaultExpires = 7 * 24 * 60 * 60 * 1000; // 7天，单位：毫秒

  /**
   * 获取缓存的图片URL
   * @param key 缓存键，通常是图片ID或唯一标识符
   * @returns 缓存的图片URL，如果不存在或已过期则返回null
   */
  getImageUrl(key: string): string | null {
    try {
      const cacheKey = this.getCacheKey(key);
      const cachedStr = localStorage.getItem(cacheKey);
      
      if (!cachedStr) {
        return null;
      }

      const cacheItem: ImageCacheItem = JSON.parse(cachedStr);
      const now = Date.now();
      
      // 检查是否过期
      if (now > cacheItem.expires) {
        // 清除过期缓存
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cacheItem.url;
    } catch (error) {
      console.error('获取图片缓存失败:', error);
      return null;
    }
  }

  /**
   * 缓存图片URL
   * @param key 缓存键，通常是图片ID或唯一标识符
   * @param url 图片URL
   * @param expires 过期时间（毫秒），默认7天
   * @param metadata 图片元数据
   */
  setImageUrl(key: string, url: string, expires?: number, metadata?: Record<string, any>): void {
    try {
      const cacheKey = this.getCacheKey(key);
      const now = Date.now();
      const expireTime = now + (expires || this.defaultExpires);
      
      const cacheItem: ImageCacheItem = {
        url,
        timestamp: now,
        expires: expireTime,
        metadata
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('设置图片缓存失败:', error);
    }
  }

  /**
   * 批量获取图片URL缓存
   * @param keys 缓存键数组
   * @returns 缓存的图片URL映射，格式：{ key: url | null }
   */
  batchGetImageUrls(keys: string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    
    keys.forEach(key => {
      result[key] = this.getImageUrl(key);
    });
    
    return result;
  }

  /**
   * 批量设置图片URL缓存
   * @param items 缓存项数组，格式：{ key: url, expires?: number, metadata?: Record<string, any> }
   */
  batchSetImageUrls(items: Array<{
    key: string;
    url: string;
    expires?: number;
    metadata?: Record<string, any>;
  }>): void {
    items.forEach(item => {
      this.setImageUrl(item.key, item.url, item.expires, item.metadata);
    });
  }

  /**
   * 清除指定图片的缓存
   * @param key 缓存键
   */
  removeImageUrl(key: string): void {
    try {
      const cacheKey = this.getCacheKey(key);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('清除图片缓存失败:', error);
    }
  }

  /**
   * 清除所有图片缓存
   */
  clearAllImageUrls(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('清除所有图片缓存失败:', error);
    }
  }

  /**
   * 清除过期的图片缓存
   * @returns 清除的过期缓存数量
   */
  clearExpiredCache(): number {
    try {
      const keys = Object.keys(localStorage);
      let removedCount = 0;
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const cachedStr = localStorage.getItem(key);
          if (cachedStr) {
            try {
              const cacheItem: ImageCacheItem = JSON.parse(cachedStr);
              if (now > cacheItem.expires) {
                localStorage.removeItem(key);
                removedCount++;
              }
            } catch (parseError) {
              // 如果解析失败，视为无效缓存并清除
              localStorage.removeItem(key);
              removedCount++;
            }
          }
        }
      });
      
      return removedCount;
    } catch (error) {
      console.error('清除过期图片缓存失败:', error);
      return 0;
    }
  }

  /**
   * 获取缓存键，添加前缀防止冲突
   * @param key 原始键
   * @returns 添加前缀后的缓存键
   */
  private getCacheKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计对象
   */
  getCacheStats(): {
    total: number;
    expired: number;
    valid: number;
  } {
    try {
      const keys = Object.keys(localStorage);
      let total = 0;
      let expired = 0;
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          total++;
          const cachedStr = localStorage.getItem(key);
          if (cachedStr) {
            try {
              const cacheItem: ImageCacheItem = JSON.parse(cachedStr);
              if (now > cacheItem.expires) {
                expired++;
              }
            } catch (parseError) {
              // 解析失败视为过期
              expired++;
            }
          } else {
            // 缓存值为空视为过期
            expired++;
          }
        }
      });
      
      return {
        total,
        expired,
        valid: total - expired
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        total: 0,
        expired: 0,
        valid: 0
      };
    }
  }
}

// 创建单例实例
export const imageCache = new ImageCache();

// 页面加载时清除过期缓存
window.addEventListener('load', () => {
  const removedCount = imageCache.clearExpiredCache();
  if (removedCount > 0) {
    console.log(`清除了 ${removedCount} 个过期图片缓存`);
  }
});
