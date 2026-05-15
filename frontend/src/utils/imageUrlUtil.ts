import { getFileExtension } from './download'
import { imageCache } from './imageCache'
import { imageCacheOptimizer } from './imageCacheOptimizer'
import { imageOfflineCache, blobUrlManager } from './imageOfflineCache'

/**
 * 图片尺寸类型定义
 */
export type ImageSize = 'large' | 'original' | number

/**
 * 图片尺寸映射表
 * 只保留512x512一种尺寸
 */
export const IMAGE_SIZE_MAP = {
  large: 512
}

/**
 * 图片URL处理工具类
 * 用于生成不同尺寸的缩略图URL和获取原图URL
 */
export class ImageUrlUtil {
  /**
   * 获取图片缩略图URL（异步版本，支持离线缓存）
   * @param originalUrl 原图URL
   * @param size 图片尺寸类型或具体像素值（仅支持512x512）
   * @param options 选项
   * @returns 缩略图URL
   */
  static async getThumbnailUrl(
    originalUrl: string, 
    size: ImageSize = 'large',
    options: { useOfflineCache?: boolean } = {}
  ): Promise<string> {
    if (!originalUrl) return ''
    
    const useOfflineCache = options.useOfflineCache ?? true
    
    // 检测是否为本地路径
    if (this.isLocalPath(originalUrl)) {
      console.log('使用本地路径:', originalUrl)
      const localUrl = this.getLocalPathUrl(originalUrl)
      
      const cacheKey = this.generateCacheKey(originalUrl, size)
      imageCache.setImageUrl(cacheKey, localUrl)
      imageCacheOptimizer.addImage(cacheKey, localUrl)
      
      return localUrl
    }
    
    const cacheKey = this.generateCacheKey(originalUrl, size)
    
    // 优先级1: 内存缓存
    const memoryCached = imageCacheOptimizer.getImage(cacheKey)
    if (memoryCached) {
      console.log('使用内存缓存的图片URL:', memoryCached.url)
      return memoryCached.url
    }
    
    // 优先级2: IndexedDB离线缓存（仅对COS URL启用）
    if (useOfflineCache && (originalUrl.includes('cos.myqcloud.com') || 
        originalUrl.includes('tencentcos') || 
        originalUrl.includes('qcloud.com'))) {
      try {
        const offlineCached = await imageOfflineCache.getImage(cacheKey)
        if (offlineCached) {
          console.log('使用IndexedDB离线缓存:', cacheKey)
          const localUrl = blobUrlManager.createUrl(cacheKey, offlineCached.data)
          imageCacheOptimizer.addImage(cacheKey, localUrl)
          return localUrl
        }
      } catch (offlineError) {
        console.warn('获取IndexedDB离线缓存失败:', offlineError)
      }
    }
    
    // 优先级3: localStorage缓存
    const cachedUrl = imageCache.getImageUrl(cacheKey)
    if (cachedUrl) {
      if (this.isValidCachedUrl(cachedUrl) && !this.isUrlExpired(cachedUrl)) {
        imageCacheOptimizer.addImage(cacheKey, cachedUrl)
        return cachedUrl
      }
    }
    
    // 优先级4: 本地服务器路径
    try {
      const localImageUrl = this.getLocalImageUrl(originalUrl, size)
      if (localImageUrl) {
        console.log('使用本地服务器图片:', localImageUrl)
        imageCache.setImageUrl(cacheKey, localImageUrl)
        imageCacheOptimizer.addImage(cacheKey, localImageUrl)
        return localImageUrl
      }
    } catch (localError) {
      console.warn('获取本地服务器图片失败:', localError)
    }
    
    // 获取代理URL
    const proxyUrl = await this.getProxiedUrl(originalUrl)
    
    // 尝试下载到离线缓存（仅对COS URL）
    if (useOfflineCache && (originalUrl.includes('cos.myqcloud.com') || 
        originalUrl.includes('tencentcos') || 
        originalUrl.includes('qcloud.com'))) {
      try {
        const fullProxyUrl = this.formatUrl(proxyUrl)
        const downloadedUrl = await imageOfflineCache.downloadAndCache(fullProxyUrl, cacheKey)
        if (downloadedUrl) {
          console.log('图片已下载到离线缓存:', cacheKey)
          imageCache.setImageUrl(cacheKey, proxyUrl)
          imageCacheOptimizer.addImage(cacheKey, downloadedUrl)
          return downloadedUrl
        }
      } catch (downloadError) {
        console.warn('下载图片到离线缓存失败:', downloadError)
      }
    }
    
    // 回退到代理URL
    imageCache.setImageUrl(cacheKey, proxyUrl)
    imageCacheOptimizer.addImage(cacheKey, proxyUrl)
    return proxyUrl
  }

  /**
   * 获取图片缩略图URL（同步版本，用于不支持async/await的场景）
   * @param originalUrl 原图URL
   * @param size 图片尺寸类型或具体像素值（仅支持512x512）
   * @returns 缩略图URL
   */
  static getThumbnailUrlSync(originalUrl: string, size: ImageSize = 'large'): string {
    if (!originalUrl) return ''
    
    try {
      // 检测是否为本地路径
      if (this.isLocalPath(originalUrl)) {
        console.log('使用本地路径:', originalUrl)
        const localUrl = this.getLocalPathUrl(originalUrl)
        
        // 生成缓存键
        const cacheKey = this.generateCacheKey(originalUrl, size)
        
        // 存入localStorage缓存
        imageCache.setImageUrl(cacheKey, localUrl)
        
        // 存入内存缓存
        imageCacheOptimizer.addImage(cacheKey, localUrl)
        
        return localUrl
      }
      
      // 生成缓存键，移除URL中的签名参数
      const cacheKey = this.generateCacheKey(originalUrl, size)
      
      // 首先检查内存缓存
      const memoryCached = imageCacheOptimizer.getImage(cacheKey)
      if (memoryCached) {
        console.log('使用内存缓存的图片URL:', memoryCached.url)
        return memoryCached.url
      }
      
      // 检查localStorage缓存
      const cachedUrl = imageCache.getImageUrl(cacheKey)
      if (cachedUrl) {
        console.log('使用localStorage缓存的图片URL:', cachedUrl)
        // 同时存入内存缓存
        imageCacheOptimizer.addImage(cacheKey, cachedUrl)
        return cachedUrl
      }
      
      // 尝试获取本地图片路径
      try {
        const localImageUrl = this.getLocalImageUrl(originalUrl, size)
        if (localImageUrl) {
          console.log('使用本地图片:', localImageUrl)
          // 将本地图片URL存入缓存
          imageCache.setImageUrl(cacheKey, localImageUrl)
          // 存入内存缓存
          imageCacheOptimizer.addImage(cacheKey, localImageUrl)
          return localImageUrl
        }
      } catch (localError) {
        console.error('获取本地图片路径失败，回退到使用代理URL:', localError)
      }
      
      // 首先获取代理URL
      const proxyUrl = this.getProxiedUrlSync(originalUrl)
      
      // 确保返回的是代理URL
      if (proxyUrl && !proxyUrl.includes('cos.myqcloud.com')) {
        // 将代理URL存入缓存
        imageCache.setImageUrl(cacheKey, proxyUrl)
        // 存入内存缓存
        imageCacheOptimizer.addImage(cacheKey, proxyUrl)
        return proxyUrl
      } else {
        // 如果返回的不是代理URL，尝试重新生成
        console.warn('获取的URL不是代理URL，重新生成:', proxyUrl)
        
        // 尝试使用原始URL作为备选
        if (originalUrl.includes('cos.myqcloud.com') && this.isValidPresignedUrl(originalUrl)) {
          console.log('使用原始COS URL作为备选:', originalUrl)
          imageCache.setImageUrl(cacheKey, originalUrl)
          imageCacheOptimizer.addImage(cacheKey, originalUrl)
          return originalUrl
        }
        
        const fallbackUrl = this.getDefaultPlaceholder()
        imageCache.setImageUrl(cacheKey, fallbackUrl)
        imageCacheOptimizer.addImage(cacheKey, fallbackUrl)
        return fallbackUrl
      }
    } catch (error) {
      console.error('获取缩略图URL失败:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        originalUrl: originalUrl
      })
      
      // 检测是否为本地路径
      if (this.isLocalPath(originalUrl)) {
        console.log('使用本地路径作为备选（错误处理）:', originalUrl)
        try {
          const localUrl = this.getLocalPathUrl(originalUrl)
          const cacheKey = this.generateCacheKey(originalUrl, size)
          imageCache.setImageUrl(cacheKey, localUrl)
          imageCacheOptimizer.addImage(cacheKey, localUrl)
          return localUrl
        } catch (localError) {
          console.error('获取本地路径URL失败:', localError)
        }
      }
      
      // 尝试获取本地图片路径作为备选
      try {
        const localImageUrl = this.getLocalImageUrl(originalUrl, size)
        if (localImageUrl) {
          console.log('使用本地图片作为备选（错误处理）:', localImageUrl)
          const cacheKey = this.generateCacheKey(originalUrl, size)
          imageCache.setImageUrl(cacheKey, localImageUrl)
          imageCacheOptimizer.addImage(cacheKey, localImageUrl)
          return localImageUrl
        }
      } catch (localError) {
        console.error('获取本地图片路径失败:', localError)
      }
      
      // 尝试使用原始URL作为备选
      if (originalUrl.includes('cos.myqcloud.com') && this.isValidPresignedUrl(originalUrl)) {
        console.log('使用原始COS URL作为备选（错误处理）:', originalUrl)
        const cacheKey = this.generateCacheKey(originalUrl, size)
        imageCache.setImageUrl(cacheKey, originalUrl)
        imageCacheOptimizer.addImage(cacheKey, originalUrl)
        return originalUrl
      }
      
      // 尝试使用代理URL作为最终备选
      try {
        const proxyUrl = this.getProxiedUrlSync(originalUrl)
        if (proxyUrl) {
          console.log('使用代理URL作为最终备选:', proxyUrl)
          const cacheKey = this.generateCacheKey(originalUrl, size)
          imageCache.setImageUrl(cacheKey, proxyUrl)
          imageCacheOptimizer.addImage(cacheKey, proxyUrl)
          return proxyUrl
        }
      } catch (proxyError) {
        console.error('获取代理URL失败:', proxyError)
      }
      
      return this.getDefaultPlaceholder()
    }
  }
  
  /**
   * 检查预签名URL是否有效
   * @param url COS预签名URL
   * @returns 是否有效
   */
  static isValidPresignedUrl(url: string): boolean {
    if (!url.includes('cos.myqcloud.com')) return false
    if (!url.includes('q-sign-time=')) return false
    
    // 检查签名是否过期
    const expiryTime = this.parseExpiryTime(url)
    if (!expiryTime) return false
    
    const currentTime = Math.floor(Date.now() / 1000)
    return currentTime < expiryTime
  }

  /**
   * 获取通过后端代理的图片URL
   * @param originalUrl 原图URL
   * @returns 代理后的图片URL
   */
  static async getProxiedUrl(originalUrl: string): Promise<string> {
    if (!originalUrl) return ''
    
    // 修复原始URL格式
    const fixedUrl = this.fixUrlFormat(originalUrl)
    
    // 检查是否是腾讯云COS URL
    if (fixedUrl.includes('cos.myqcloud.com') || 
        fixedUrl.includes('tencentcos') || 
        fixedUrl.includes('qcloud.com')) {
      try {
        // 解析图片对象键
        const objectKey = this.extractObjectKey(fixedUrl)
        if (!objectKey) {
          return this.getDefaultPlaceholder()
        }
        
        // 构建代理URL
        const proxyUrl = `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(objectKey)}`
        return proxyUrl
      } catch (error) {
        console.error('获取代理URL失败:', error)
        return this.getDefaultPlaceholder()
      }
    } else if (fixedUrl.startsWith('http')) {
      // 其他HTTP URL，也通过代理处理
      try {
        const encodedUrl = encodeURIComponent(fixedUrl)
        const proxyUrl = `/api/v1/image-proxy/proxy?url=${encodedUrl}`
        return proxyUrl
      } catch (error) {
        console.error('获取代理URL失败:', error)
        return this.getDefaultPlaceholder()
      }
    } else {
      // 非URL，返回默认占位图
      return this.getDefaultPlaceholder()
    }
  }

  /**
   * 获取通过后端代理的图片URL（同步版本）
   * @param originalUrl 原图URL
   * @returns 代理后的图片URL
   */
  static getProxiedUrlSync(originalUrl: string): string {
    if (!originalUrl) return ''
    
    try {
      // 修复原始URL格式
      const fixedUrl = this.fixUrlFormat(originalUrl)
      
      console.log('处理图片URL代理:', {
        originalUrl,
        fixedUrl,
        isCosUrl: fixedUrl.includes('cos.myqcloud.com') || fixedUrl.includes('tencentcos') || fixedUrl.includes('qcloud.com'),
        isHttpUrl: fixedUrl.startsWith('http'),
        timestamp: new Date().toISOString()
      })
      
      // 检查是否是腾讯云COS URL
      if (fixedUrl.includes('cos.myqcloud.com') || 
          fixedUrl.includes('tencentcos') || 
          fixedUrl.includes('qcloud.com')) {
        // 解析图片对象键
        let objectKey = ''
        try {
          objectKey = this.extractObjectKey(fixedUrl)
        } catch (extractError) {
          console.error('提取对象键失败:', extractError)
        }
        
        if (!objectKey) {
          console.warn('无法提取COS URL的对象键:', fixedUrl)
          // 尝试从路径中提取对象键
          try {
            if (fixedUrl.startsWith('http')) {
              const urlObj = new URL(fixedUrl)
              const pathname = urlObj.pathname
              if (pathname && pathname !== '/') {
                const extractedKey = pathname.substring(1) // 移除开头的斜杠
                if (extractedKey) {
                  console.log('从路径中提取对象键:', extractedKey)
                  const proxyUrl = `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(extractedKey)}`
                  return proxyUrl
                }
              }
            }
          } catch (pathError) {
            console.error('从路径提取对象键失败:', pathError)
          }
          
          // 尝试直接使用原始URL作为参数
          try {
            const encodedUrl = encodeURIComponent(fixedUrl)
            const proxyUrl = `/api/v1/image-proxy/proxy?url=${encodedUrl}`
            console.log('使用原始URL作为代理参数:', proxyUrl)
            return proxyUrl
          } catch (encodeError) {
            console.error('编码URL失败:', encodeError)
            return this.getDefaultPlaceholder()
          }
        }
        
        // 构建代理URL
        const proxyUrl = `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(objectKey)}`
        console.log('生成COS代理URL:', proxyUrl)
        return proxyUrl
      } else if (fixedUrl.startsWith('http')) {
        // 其他HTTP URL，也通过代理处理
        try {
          const encodedUrl = encodeURIComponent(fixedUrl)
          const proxyUrl = `/api/v1/image-proxy/proxy?url=${encodedUrl}`
          console.log('生成HTTP代理URL:', proxyUrl)
          return proxyUrl
        } catch (encodeError) {
          console.error('编码URL失败:', encodeError)
          return this.getDefaultPlaceholder()
        }
      } else {
        // 非URL，返回默认占位图
        console.warn('非HTTP URL，返回占位图:', fixedUrl)
        return this.getDefaultPlaceholder()
      }
    } catch (error) {
      console.error('获取代理URL失败:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        originalUrl: originalUrl
      })
      return this.getDefaultPlaceholder()
    }
  }

  /**
   * 获取默认占位图URL
   * @returns 默认占位图URL
   */
  public static getDefaultPlaceholder(): string {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect fill="#f5f5f5" width="512" height="512"/><text fill="#999" font-family="sans-serif" font-size="16" text-anchor="middle" x="256" y="262">Image Load Failed</text></svg>')
  }

  /**
   * 生成缓存键
   * @param originalUrl 原图URL
   * @param size 图片尺寸
   * @returns 缓存键
   */
  private static generateCacheKey(originalUrl: string, size: ImageSize): string {
    // 移除URL中的签名参数，生成稳定的缓存键
    let baseUrl = originalUrl
    
    // 移除腾讯云COS URL中的签名参数
    if (originalUrl.includes('cos.myqcloud.com') || 
        originalUrl.includes('tencentcos') || 
        originalUrl.includes('qcloud.com')) {
      // 保留URL的核心部分，移除查询参数
      baseUrl = originalUrl.split('?')[0]
    }
    
    // 使用处理后的URL和尺寸生成唯一缓存键
    const sizeStr = typeof size === 'number' ? size.toString() : size
    return `${baseUrl}_${sizeStr}_proxy`
  }
  
  /**
   * 验证缓存URL是否有效
   * @param cachedUrl 缓存的URL
   * @returns 是否有效
   */
  private static isValidCachedUrl(cachedUrl: string): boolean {
    if (!cachedUrl) return false
    
    // 确保缓存的URL不是原始COS URL
    if (cachedUrl.includes('cos.myqcloud.com')) {
      return false
    }
    
    // 确保缓存的URL是代理URL或占位图
    return cachedUrl.includes('/api/v1/image-proxy/proxy') || 
           cachedUrl.includes('via.placeholder.com')
  }
  
  /**
   * 获取图片原图URL
   * @param url 任意图片URL（缩略图或原图）
   * @param needOriginalSize 是否需要原始大小的图片
   * @param needOriginalImage 是否需要原图（默认true）
   * @returns 原图URL
   */
  static getOriginalUrl(url: string, needOriginalSize: boolean = false, needOriginalImage: boolean = true): string {
    if (!url) return ''
    
    // 首先修复URL格式
    const fixedUrl = this.fixUrlFormat(url)
    
    // 生成缓存键，移除URL中的签名参数
    const cacheKey = this.generateOriginalCacheKey(fixedUrl) + (needOriginalSize ? '_original_size' : '') + (needOriginalImage ? '_original_image' : '')
    
    // 首先检查缓存
    const cachedUrl = imageCache.getImageUrl(cacheKey)
    if (cachedUrl) {
      return cachedUrl
    }
    
    // 如果是占位符，直接返回
    if (fixedUrl.startsWith('http://via.placeholder.com')) {
      // 将URL存入缓存
      imageCache.setImageUrl(cacheKey, fixedUrl)
      return fixedUrl
    }
    
    // 检测并处理webp格式的缩略图
    if (fixedUrl.includes('.webp')) {
      // 尝试从webp URL中提取原始图片信息
      const originalUrl = this.convertWebpToOriginal(fixedUrl)
      if (originalUrl && originalUrl !== fixedUrl) {
        // 修复原始URL格式
        const fixedOriginalUrl = this.fixUrlFormat(originalUrl)
        // 将生成的URL存入缓存
        imageCache.setImageUrl(cacheKey, fixedOriginalUrl)
        return fixedOriginalUrl
      }
    }
    
    // 解析图片ID
    const imageId = this.parseImageId(fixedUrl)
    if (imageId) {
      // 生成原图URL
      let originalUrl = `/api/v1/images/${imageId}/file`
      // 添加查询参数
      const params = new URLSearchParams()
      if (needOriginalImage) {
        params.append('original', 'true')
      }
      if (needOriginalSize) {
        params.append('original_size', 'true')
      }
      if (params.toString()) {
        originalUrl += '?' + params.toString()
      }
      // 将生成的URL存入缓存
      imageCache.setImageUrl(cacheKey, originalUrl)
      return originalUrl
    } else {
      // 如果无法解析图片ID，返回修复后的原图
      imageCache.setImageUrl(cacheKey, fixedUrl)
      return fixedUrl
    }
  }

  /**
   * 将webp格式的缩略图URL转换为原始图片URL
   * @param webpUrl webp格式的缩略图URL
   * @returns 原始图片URL
   */
  private static convertWebpToOriginal(webpUrl: string): string {
    try {
      // 处理不同格式的webp URL
      
      // 1. 处理带有尺寸后缀的webp URL，如：xxx_512x512.webp
      let originalUrl = webpUrl.replace(/_\d+x\d+\.webp$/i, (match) => {
        // 提取文件扩展名前的部分
        const baseName = webpUrl.substring(0, webpUrl.length - match.length)
        // 尝试获取原始文件扩展名（如果有）
        // 这里假设原始图片格式为常见格式
        return '.jpg' // 默认使用jpg作为原始格式
      })
      
      // 2. 处理简单的webp URL，如：xxx.webp
      if (originalUrl.endsWith('.webp')) {
        originalUrl = originalUrl.replace(/\.webp$/i, '.jpg')
      }
      
      // 3. 处理路径中的thumbnails目录
      originalUrl = originalUrl.replace(/\/thumbnails\//i, '/')
      
      return originalUrl
    } catch (error) {
      console.error('转换webp URL失败:', error)
      return webpUrl
    }
  }

  /**
   * 生成原图缓存键
   * @param url 图片URL
   * @returns 缓存键
   */
  private static generateOriginalCacheKey(url: string): string {
    // 移除URL中的签名参数，生成稳定的缓存键
    let baseUrl = url
    
    // 移除腾讯云COS URL中的签名参数
    if (url.includes('cos.myqcloud.com') || 
        url.includes('tencentcos') || 
        url.includes('qcloud.com')) {
      // 保留URL的核心部分，移除查询参数
      baseUrl = url.split('?')[0]
    }
    
    return `original_${baseUrl}`
  }
  
  /**
   * 解析图片URL中的图片ID
   * @param url 图片URL
   * @returns 图片ID或null
   */
  private static parseImageId(url: string): number | null {
    try {
      // 从URL路径中提取图片ID
      const urlObj = new URL(url, window.location.origin)
      
      // 只匹配特定格式的URL，确保只提取真正的图片ID
      // 1. 匹配 /images/{id}/... 格式的URL
      const pathParts = urlObj.pathname.split('/')
      const imagesIndex = pathParts.indexOf('images')
      
      if (imagesIndex !== -1 && pathParts.length > imagesIndex + 1) {
        const idStr = pathParts[imagesIndex + 1]
        const id = parseInt(idStr, 10)
        // 确保ID是一个合理的图片ID，而不是日期
        // 图片ID通常是一个相对较小的整数，而日期是8位数字
        // 这里假设图片ID不会超过1000000
        if (!isNaN(id) && id < 1000000) {
          return id
        }
      }
      
      // 2. 匹配 /uploads/{id}... 格式的URL
      const uploadsIndex = pathParts.indexOf('uploads')
      if (uploadsIndex !== -1 && pathParts.length > uploadsIndex + 1) {
        const filename = pathParts[uploadsIndex + 1]
        const idMatch = filename.match(/^(\d+)\./)
        if (idMatch) {
          const id = parseInt(idMatch[1], 10)
          if (!isNaN(id) && id < 1000000) {
            return id
          }
        }
      }
      
      // 3. 匹配 /static/images/{id}... 格式的URL
      const staticIndex = pathParts.indexOf('static')
      if (staticIndex !== -1 && pathParts.length > staticIndex + 2) {
        const filename = pathParts[staticIndex + 2]
        const idMatch = filename.match(/^(\d+)\./)
        if (idMatch) {
          const id = parseInt(idMatch[1], 10)
          if (!isNaN(id) && id < 1000000) {
            return id
          }
        }
      }
      
      // 4. 匹配直接的图片ID格式，如 /12345.jpg
      if (pathParts.length > 1) {
        const filename = pathParts[pathParts.length - 1]
        const idMatch = filename.match(/^(\d+)\./)
        if (idMatch) {
          const id = parseInt(idMatch[1], 10)
          if (!isNaN(id) && id < 1000000) {
            return id
          }
        }
      }
      
      // 无法解析图片ID，返回null
      return null
    } catch (error) {
      console.error('解析图片ID失败:', error)
      return null
    }
  }
  
  /**
   * 根据展示容器大小获取推荐的图片尺寸
   * 只返回512x512尺寸
   * @param containerWidth 容器宽度
   * @param containerHeight 容器高度
   * @returns 推荐的图片尺寸类型
   */
  static getRecommendedSize(containerWidth: number, containerHeight: number): ImageSize {
    // 只返回512x512尺寸
    return 'large' // 512x512
  }
  
  /**
 * 修复URL格式，移除无效的参数
 * @param url 原始URL
 * @returns 修复后的URL
 */
  static fixUrlFormat(url: string): string {
    if (!url) return ''
    
    // 清理URL中的反引号
    let fixedUrl = url.replace(/`/g, '')
    
    // 修复 q-url-param-list=&q-signature= 格式问题
    if (fixedUrl.includes('q-url-param-list=&q-signature=')) {
      fixedUrl = fixedUrl.replace('q-url-param-list=&q-signature=', 'q-signature=')
    }
    
    // 修复 &q-url-param-list=& 格式问题
    if (fixedUrl.includes('&q-url-param-list=&')) {
      fixedUrl = fixedUrl.replace('&q-url-param-list=&', '&')
    }
    
    // 修复 q-url-param-list=& 格式问题
    if (fixedUrl.includes('q-url-param-list=&')) {
      fixedUrl = fixedUrl.replace('q-url-param-list=&', '')
    }
    
    // 修复 &q-url-param-list= 格式问题
    if (fixedUrl.includes('&q-url-param-list=')) {
      fixedUrl = fixedUrl.replace('&q-url-param-list=', '')
    }
    
    return fixedUrl
  }

  /**
   * 格式化图片URL，确保URL格式正确
   * @param url 原始URL
   * @returns 格式化后的URL
   */
  static formatUrl(url: string): string {
    if (!url) return ''
    
    // 首先修复URL格式
    const fixedUrl = this.fixUrlFormat(url)
    
    // 如果是相对URL，添加基础URL
    if (fixedUrl.startsWith('/') && !fixedUrl.startsWith('//')) {
      return `${window.location.origin}${fixedUrl}`
    }
    
    return fixedUrl
  }
  
  /**
   * 批量获取缩略图URL
   * @param originalUrls 原图URL列表
   * @param size 图片尺寸类型或具体像素值
   * @returns 缩略图URL列表
   */
  static batchGetThumbnailUrls(originalUrls: string[], size: ImageSize = 'large'): string[] {
    return originalUrls.map(url => this.getThumbnailUrlSync(url, size))
  }

  /**
   * 批量获取缩略图URL（异步版本）
   * @param originalUrls 原图URL列表
   * @param size 图片尺寸类型或具体像素值
   * @returns 缩略图URL列表Promise
   */
  static async batchGetThumbnailUrlsAsync(originalUrls: string[], size: ImageSize = 'large'): Promise<string[]> {
    const promises = originalUrls.map(url => this.getThumbnailUrl(url, size))
    return await Promise.all(promises)
  }
  
  /**
   * 批量获取原图URL
   * @param urls 图片URL列表（缩略图或原图）
   * @returns 原图URL列表
   */
  static batchGetOriginalUrls(urls: string[]): string[] {
    return urls.map(url => this.getOriginalUrl(url))
  }

  /**
   * 解析URL中的过期时间
   * @param url COS预签名URL
   * @returns 过期时间戳（秒）或null
   */
  static parseExpiryTime(url: string): number | null {
    try {
      const urlObj = new URL(url)
      const signTime = urlObj.searchParams.get('q-sign-time')
      if (signTime) {
        const [, endTime] = signTime.split(';')
        return parseInt(endTime, 10)
      }
      return null
    } catch (error) {
      console.error('解析URL过期时间失败:', error)
      return null
    }
  }

  /**
   * 检查URL是否即将过期
   * @param url COS预签名URL
   * @param threshold 过期阈值（秒），默认3600秒（1小时）
   * @returns 是否即将过期
   */
  static isUrlExpiring(url: string, threshold: number = 3600): boolean {
    const expiryTime = this.parseExpiryTime(url)
    if (!expiryTime) return false
    
    const currentTime = Math.floor(Date.now() / 1000)
    return expiryTime - currentTime < threshold
  }

  /**
   * 检查URL是否已过期
   * @param url COS预签名URL
   * @returns 是否已过期
   */
  static isUrlExpired(url: string): boolean {
    const expiryTime = this.parseExpiryTime(url)
    if (!expiryTime) return false
    
    const currentTime = Math.floor(Date.now() / 1000)
    return currentTime > expiryTime
  }

  /**
   * 刷新图片URL
   * @param originalUrl 原始图片URL
   * @returns 新的图片URL或空字符串
   */
  static async refreshImageUrl(originalUrl: string): Promise<string> {
    if (!originalUrl) return ''
    
    // 修复原始URL格式
    const fixedOriginalUrl = this.fixUrlFormat(originalUrl)
    
    // 解析图片对象键
    let objectKey = ''
    
    // 检测是否为代理URL
    if (this.isProxyUrl(fixedOriginalUrl)) {
      // 从代理URL中提取object_key
      objectKey = this.extractObjectKeyFromProxyUrl(fixedOriginalUrl)
    } else {
      // 从普通URL中提取对象键
      objectKey = this.extractObjectKey(fixedOriginalUrl)
    }
    
    if (!objectKey) {
      console.error('无法提取对象键:', fixedOriginalUrl)
      return ''
    }
    
    try {
      console.log('开始刷新图片URL:', {
        originalUrl,
        fixedOriginalUrl,
        objectKey,
        isProxyUrl: this.isProxyUrl(fixedOriginalUrl),
        timestamp: new Date().toISOString()
      })
      
      // 调用后端API获取新的预签名URL
      const response = await fetch(`/api/v1/image-proxy/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ object_key: objectKey })
      })
      
      console.log('后端API响应状态:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('后端API响应数据:', data)
        
        if (data.code === 200 && data.data?.url) {
          // 修复返回的URL格式
          const fixedNewUrl = this.fixUrlFormat(data.data.url)
          console.log('修复后的新URL:', fixedNewUrl)
          
          // 清除相关缓存，确保下次获取使用新URL
          const cacheKey = this.generateCacheKey(fixedOriginalUrl, 'large')
          const originalCacheKey = this.generateOriginalCacheKey(fixedOriginalUrl)
          
          imageCache.removeImageUrl(cacheKey)
          imageCache.removeImageUrl(originalCacheKey)
          
          console.log('图片URL刷新成功，缓存已清除')
          return fixedNewUrl
        } else {
          console.error('后端API返回无效数据:', data)
        }
      } else {
        console.error('后端API请求失败:', {
          status: response.status,
          statusText: response.statusText
        })
      }
    } catch (error) {
      console.error('刷新图片URL过程中发生错误:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        objectKey: objectKey
      })
      
      // 尝试使用备用方案：直接构建新的代理URL
      try {
        console.log('尝试使用备用方案构建新的代理URL')
        const newProxyUrl = `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(objectKey)}`
        console.log('构建的新代理URL:', newProxyUrl)
        return newProxyUrl
      } catch (backupError) {
        console.error('备用方案也失败:', backupError)
        // 即使备用方案失败，也返回一个代理URL
        return `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(objectKey)}`
      }
    }
    
    // 即使所有方法都失败，也返回一个代理URL
    console.error('图片URL刷新最终失败，返回备用代理URL')
    return `/api/v1/image-proxy/proxy?object_key=${encodeURIComponent(objectKey)}`
  }

  /**
   * 获取有效的图片URL（自动处理过期）
   * @param originalUrl 原始图片URL
   * @param size 图片尺寸
   * @returns 有效的图片URL
   */
  static async getValidImageUrl(originalUrl: string, size: ImageSize = 'large'): Promise<string> {
    if (!originalUrl) return ''
    
    // 首先检查URL是否已过期或即将过期
    if (this.isUrlExpired(originalUrl) || this.isUrlExpiring(originalUrl)) {
      console.log('图片URL已过期或即将过期，尝试刷新:', originalUrl)
      const newUrl = await this.refreshImageUrl(originalUrl)
      if (newUrl) {
        console.log('图片URL刷新成功:', newUrl)
        return newUrl
      }
    }
    
    // URL未过期，直接返回
    return originalUrl
  }

  /**
   * 从URL中提取对象键
   * @param url 原始图片URL
   * @returns 对象键或空字符串
   */
  static extractObjectKey(url: string): string {
    if (!url) return ''
    
    try {
      // 检测是否为代理URL
      if (url.startsWith('/api/v1/image-proxy/proxy')) {
        return this.extractObjectKeyFromProxyUrl(url)
      }
      
      // 检测是否为相对URL
      if (url.startsWith('/') && !url.startsWith('//')) {
        // 对于相对URL，尝试从查询参数中提取object_key
        if (url.includes('object_key=')) {
          const params = new URLSearchParams(url.split('?')[1] || '')
          const objectKey = params.get('object_key')
          if (objectKey) {
            return decodeURIComponent(objectKey)
          }
        }
        // 如果不是代理URL且没有object_key参数，返回空
        return ''
      }
      
      // 对于完整URL，使用标准URL解析
      const urlObj = new URL(url)
      
      // 检查是否包含object_key参数
      if (urlObj.searchParams.has('object_key')) {
        return decodeURIComponent(urlObj.searchParams.get('object_key') || '')
      }
      
      // 获取路径部分，去除开头的斜杠
      return urlObj.pathname.substring(1)
    } catch (error) {
      console.error('解析URL失败:', error)
      
      // 尝试备用方案：直接从字符串中提取object_key
      try {
        if (url.includes('object_key=')) {
          const match = url.match(/object_key=([^&]+)/)
          if (match && match[1]) {
            return decodeURIComponent(match[1])
          }
        }
      } catch (backupError) {
        console.error('备用方案解析失败:', backupError)
      }
      
      return ''
    }
  }

  /**
   * 从代理URL中提取对象键
   * @param proxyUrl 代理URL
   * @returns 对象键或空字符串
   */
  static extractObjectKeyFromProxyUrl(proxyUrl: string): string {
    try {
      // 解析查询参数
      const params = new URLSearchParams(proxyUrl.split('?')[1] || '')
      const objectKey = params.get('object_key')
      if (objectKey) {
        return decodeURIComponent(objectKey)
      }
      return ''
    } catch (error) {
      console.error('解析代理URL失败:', error)
      return ''
    }
  }

  /**
   * 检测是否为代理URL
   * @param url 要检测的URL
   * @returns 是否为代理URL
   */
  static isProxyUrl(url: string): boolean {
    return url.startsWith('/api/v1/image-proxy/proxy') || 
           url.includes('/image-proxy/proxy')
  }

  /**
   * 获取当前环境的基础URL
   * @returns 基础URL
   */
  static getBaseUrl(): string {
    return window.location.origin
  }

  /**
   * 检测是否为本地路径
   * @param path 路径
   * @returns 是否为本地路径
   */
  static isLocalPath(path: string): boolean {
    if (!path) return false
    
    // 检测是否为本地文件路径
    return path.includes('development/database/assets/略缩图') || 
           path.includes('production/database/assets/略缩图') ||
           path.includes('database/assets/略缩图')
  }

  /**
   * 获取本地路径的URL
   * @param localPath 本地路径
   * @returns 本地路径的URL
   */
  static getLocalPathUrl(localPath: string): string {
    if (!localPath) return this.getDefaultPlaceholder()
    
    try {
      // 提取文件名
      let filename = localPath.split('\\').pop() || localPath.split('/').pop() || ''
      
      if (!filename || filename === '.webp' || filename.trim() === '') {
        // 生成唯一文件名
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 10)
        filename = `local_${timestamp}_${randomStr}.webp`
        console.log('生成唯一文件名:', filename)
      }
      
      // 构建本地图片的相对URL
      return `/api/v1/image-proxy/local?filename=${encodeURIComponent(filename)}`
    } catch (error) {
      console.error('获取本地路径URL失败:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        localPath: localPath
      })
      return this.getDefaultPlaceholder()
    }
  }

  /**
   * 尝试获取本地图片URL
   * @param originalUrl 原图URL
   * @param size 图片尺寸
   * @returns 本地图片URL，如果不存在返回空字符串
   */
  static getLocalImageUrl(originalUrl: string, size: ImageSize = 'large'): string {
    if (!originalUrl) return ''
    
    try {
      // 清理URL中的反引号
      let cleanedUrl = originalUrl.replace(/`/g, '')
      
      // 提取图片对象键
      let objectKey = ''
      
      // 检测是否为代理URL
      if (this.isProxyUrl(cleanedUrl)) {
        objectKey = this.extractObjectKeyFromProxyUrl(cleanedUrl)
      } else {
        objectKey = this.extractObjectKey(cleanedUrl)
      }
      
      // 如果对象键提取失败，尝试从完整URL中提取
      if (!objectKey) {
        try {
          // 尝试从完整URL中提取路径部分作为对象键
          if (cleanedUrl.includes('cos.myqcloud.com')) {
            const urlObj = new URL(cleanedUrl)
            if (urlObj.pathname && urlObj.pathname !== '/') {
              objectKey = urlObj.pathname.substring(1) // 移除开头的斜杠
            }
          }
        } catch (urlError) {
          console.error('从URL提取对象键失败:', urlError)
        }
      }
      
      if (!objectKey) {
        console.warn('无法从URL提取对象键:', cleanedUrl)
        return ''
      }
      
      // 生成本地文件名
      const filename = this.generateLocalFilename(objectKey)
      if (!filename) {
        return ''
      }
      
      // 构建本地图片的相对URL
      return `/api/v1/image-proxy/local?filename=${encodeURIComponent(filename)}`
    } catch (error) {
      console.error('获取本地图片URL失败:', error)
      return ''
    }
  }

  /**
   * 基于对象键生成本地文件名
   * @param objectKey 对象键
   * @returns 本地文件名
   */
  static generateLocalFilename(objectKey: string): string {
    if (!objectKey) return ''
    
    try {
      // 从对象键中提取文件名
      const filename = objectKey.split('/').pop() || ''
      if (!filename) {
        return ''
      }
      
      // 确保文件名包含.webp扩展名
      if (!filename.endsWith('.webp')) {
        const nameWithoutExt = filename.split('.').slice(0, -1).join('.')
        return `${nameWithoutExt}.webp`
      }
      
      return filename
    } catch (error) {
      console.error('生成本地文件名失败:', error)
      return ''
    }
  }

  /**
   * 从文件名中提取图片ID
   * @param filename 文件名
   * @returns 图片ID或null
   */
  static extractImageIdFromFilename(filename: string): number | null {
    if (!filename) return null
    
    try {
      // 新的命名格式不包含图片ID，返回null
      return null
    } catch (error) {
      console.error('从文件名提取图片ID失败:', error)
      return null
    }
  }
}

/**
 * 图片URL处理工具函数
 * 用于生成不同尺寸的缩略图URL（同步版本）
 */
export const getThumbnailUrlSync = (originalUrl: string, size: ImageSize = 'large'): string => {
  return ImageUrlUtil.getThumbnailUrlSync(originalUrl, size)
}

export const getThumbnailUrl = getThumbnailUrlSync

/**
 * 图片URL处理工具函数
 * 用于生成不同尺寸的缩略图URL（异步版本，支持自动处理过期URL）
 */
export const getThumbnailUrlAsync = async (originalUrl: string, size: ImageSize = 'large'): Promise<string> => {
  return ImageUrlUtil.getThumbnailUrl(originalUrl, size)
}

/**
 * 图片URL处理工具函数
 * 用于获取原图URL
 */
export const getOriginalUrl = (url: string, needOriginalSize: boolean = false, needOriginalImage: boolean = true): string => {
  return ImageUrlUtil.getOriginalUrl(url, needOriginalSize, needOriginalImage)
}

/**
 * 图片URL处理工具函数
 * 根据容器大小获取推荐的图片尺寸
 */
export const getRecommendedImageSize = (containerWidth: number, containerHeight: number): ImageSize => {
  return ImageUrlUtil.getRecommendedSize(containerWidth, containerHeight)
}
