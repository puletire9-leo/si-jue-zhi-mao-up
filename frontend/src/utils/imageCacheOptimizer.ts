/**
 * 图片缓存优化工具
 * 用于优化图片缓存管理，减少内存使用，防止内存泄漏
 */

// 图片缓存项接口
export interface OptimizedImageCacheItem {
  /** 图片URL */
  url: string;
  /** 图片数据（可选，用于Base64或Blob） */
  data?: string | Blob;
  /** 缓存时间戳 */
  timestamp: number;
  /** 访问次数 */
  accessCount: number;
  /** 过期时间 */
  expires?: number;
  /** 图片尺寸信息 */
  size?: {
    width: number;
    height: number;
  };
}

// 图片缓存配置接口
export interface ImageCacheOptimizerConfig {
  /** 最大缓存数量 */
  maxCacheSize?: number;
  /** 默认过期时间 (ms) */
  defaultExpiry?: number;
  /** 清理间隔 (ms) */
  cleanupInterval?: number;
  /** 内存使用阈值 (%) */
  memoryThreshold?: number;
}

// 图片缓存优化类
export class ImageCacheOptimizer {
  private config: ImageCacheOptimizerConfig;
  private cache: Map<string, OptimizedImageCacheItem> = new Map();
  private cleanupIntervalId: number | null = null;

  constructor(config: ImageCacheOptimizerConfig = {}) {
    this.config = {
      maxCacheSize: config.maxCacheSize || 100, // 默认缓存100张图片
      defaultExpiry: config.defaultExpiry || 3600000, // 默认1小时过期
      cleanupInterval: config.cleanupInterval || 60000, // 默认1分钟清理一次
      memoryThreshold: config.memoryThreshold || 80, // 内存使用80%时开始清理
      ...config
    };

    // 启动定时清理
    this.startCleanupInterval();
  }

  /**
   * 添加图片到缓存
   * @param key 缓存键
   * @param url 图片URL
   * @param options 选项
   */
  addImage(key: string, url: string, options?: {
    data?: string | Blob;
    expires?: number;
    size?: {
      width: number;
      height: number;
    };
  }): void {
    // 检查内存使用情况
    if (this.isMemoryUsageHigh()) {
      this.clearOldestImages(20); // 清理20%最旧的图片
    }

    // 如果缓存已满，清理最旧的图片
    if (this.cache.size >= this.config.maxCacheSize!) {
      this.clearOldestImages(10); // 清理10%最旧的图片
    }

    const now = Date.now();
    this.cache.set(key, {
      url,
      data: options?.data,
      timestamp: now,
      accessCount: 1,
      expires: options?.expires || now + this.config.defaultExpiry!,
      size: options?.size
    });
  }

  /**
   * 获取图片缓存
   * @param key 缓存键
   * @returns 缓存的图片项或null
   */
  getImage(key: string): OptimizedImageCacheItem | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问时间和次数
    item.timestamp = Date.now();
    item.accessCount++;
    this.cache.set(key, item);

    return item;
  }

  /**
   * 移除图片缓存
   * @param key 缓存键
   */
  removeImage(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清除所有图片缓存
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * 清除过期图片
   * @returns 清除的图片数量
   */
  clearExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expires && item.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 清除最旧的图片
   * @param percentage 清除的百分比
   * @returns 清除的图片数量
   */
  clearOldestImages(percentage: number): number {
    if (percentage <= 0 || percentage > 100) {
      return 0;
    }

    const count = Math.ceil((this.cache.size * percentage) / 100);
    if (count === 0) {
      return 0;
    }

    // 按访问时间排序
    const sortedItems = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // 清除最旧的图片
    const toRemove = sortedItems.slice(0, count);
    toRemove.forEach(([key]) => this.cache.delete(key));

    return toRemove.length;
  }

  /**
   * 清除访问次数最少的图片
   * @param percentage 清除的百分比
   * @returns 清除的图片数量
   */
  clearLeastAccessedImages(percentage: number): number {
    if (percentage <= 0 || percentage > 100) {
      return 0;
    }

    const count = Math.ceil((this.cache.size * percentage) / 100);
    if (count === 0) {
      return 0;
    }

    // 按访问次数排序
    const sortedItems = Array.from(this.cache.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount);

    // 清除访问次数最少的图片
    const toRemove = sortedItems.slice(0, count);
    toRemove.forEach(([key]) => this.cache.delete(key));

    return toRemove.length;
  }

  /**
   * 检查内存使用是否过高
   * @returns 是否过高
   */
  private isMemoryUsageHigh(): boolean {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return false;
    }

    const memory = (performance as any).memory;
    const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    return usagePercentage >= this.config.memoryThreshold!;
  }

  /**
   * 启动定时清理
   */
  private startCleanupInterval(): void {
    this.stopCleanupInterval();
    
    this.cleanupIntervalId = window.setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval!);
  }

  /**
   * 停止定时清理
   */
  stopCleanupInterval(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * 执行清理
   */
  private performCleanup(): void {
    // 清除过期图片
    const expiredCount = this.clearExpired();
    
    // 如果内存使用过高，清理更多图片
    if (this.isMemoryUsageHigh()) {
      this.clearLeastAccessedImages(30); // 清理30%访问次数最少的图片
    }
    
    // 如果缓存仍然超出限制，清理最旧的图片
    if (this.cache.size > this.config.maxCacheSize!) {
      const overflow = this.cache.size - this.config.maxCacheSize!;
      const removeCount = Math.ceil(overflow * 1.2); // 清理超出部分的120%
      this.clearOldestImages((removeCount / this.cache.size) * 100);
    }

    if (expiredCount > 0) {
      console.log(`图片缓存清理: 清除了 ${expiredCount} 张过期图片`);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计对象
   */
  getStats(): {
    total: number;
    expired: number;
    memoryUsage?: {
      used: number;
      total: number;
      percentage: number;
    };
  } {
    const now = Date.now();
    let expired = 0;

    for (const item of this.cache.values()) {
      if (item.expires && item.expires < now) {
        expired++;
      }
    }

    let memoryUsage;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }

    return {
      total: this.cache.size,
      expired,
      memoryUsage
    };
  }

  /**
   * 预加载图片
   * @param urls 图片URL数组
   * @param options 选项
   */
  async preloadImages(urls: string[], options?: {
    onProgress?: (index: number, total: number) => void;
    onComplete?: () => void;
  }): Promise<void> {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      await this.preloadImage(url);
      
      if (options?.onProgress) {
        options.onProgress(i + 1, urls.length);
      }
    }

    if (options?.onComplete) {
      options.onComplete();
    }
  }

  /**
   * 预加载单个图片
   * @param url 图片URL
   */
  private async preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // 可以在这里添加到缓存
        this.addImage(url, url, {
          size: {
            width: img.width,
            height: img.height
          }
        });
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.cache.clear();
  }
}

// 创建单例实例
export const imageCacheOptimizer = new ImageCacheOptimizer({
  maxCacheSize: 50, // 缓存50张图片
  defaultExpiry: 1800000, // 30分钟过期
  cleanupInterval: 30000, // 30秒清理一次
  memoryThreshold: 75 // 内存使用75%时开始清理
});

// 全局工具函数
export const optimizeImageCache = (): ImageCacheOptimizer => {
  return imageCacheOptimizer;
};

export const preloadImages = async (urls: string[], options?: {
  onProgress?: (index: number, total: number) => void;
  onComplete?: () => void;
}): Promise<void> => {
  return imageCacheOptimizer.preloadImages(urls, options);
};

export const clearImageCache = (): void => {
  imageCacheOptimizer.clearAll();
};

export const getImageCacheStats = (): {
  total: number;
  expired: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
} => {
  return imageCacheOptimizer.getStats();
};

// 导出工具类
export default ImageCacheOptimizer;