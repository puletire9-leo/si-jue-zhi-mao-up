/**
 * 下载工具函数
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// 类型定义
type FileInfo = { url: string; filename: string };

type DownloadResult = {
  success: number;
  failed: number;
};

/**
 * 检查JSZip和FileSaver是否可用
 * @returns {Object} 包含JSZip和FileSaver是否可用的信息
 */
const checkDependencies = (): { hasJSZip: boolean; hasSaveAs: boolean } => {
  const hasJSZip = typeof JSZip !== 'undefined';
  const hasSaveAs = typeof saveAs !== 'undefined';
  
  console.log(`依赖检查结果: JSZip=${hasJSZip}, FileSaver=${hasSaveAs}`);
  return { hasJSZip, hasSaveAs };
};

/**
 * 下载单个文件
 * @param url 文件URL
 * @param filename 文件名
 */
export const downloadFile = async (url: string, filename: string): Promise<boolean> => {
  try {
    // 方法1：直接使用a标签下载（适用于大多数情况）
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    console.log(`直接下载成功: ${filename}`);
    return true;
  } catch (error) {
    console.error(`直接下载失败: ${filename}，尝试使用fetch方式`, error);
    
    // 方法2：使用fetch下载（适用于CORS问题或直接链接下载失败的情况）
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
      
      const response = await fetch(url, {
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      // 释放blob URL
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      
      console.log(`fetch下载成功: ${filename}`);
      return true;
    } catch (fetchError) {
      console.error(`fetch下载也失败: ${filename}`, fetchError);
      return false;
    }
  }
};

/**
 * 批量下载文件
 * @param files 文件数组，包含url和filename
 * @param delay 下载间隔时间（毫秒），防止浏览器阻塞
 * @returns {boolean} 是否成功下载了至少一个文件
 */
export const batchDownloadFiles = async (files: Array<{ url: string; filename: string }>, delay: number = 500): Promise<boolean> => {
  let success = 0;
  let failed = 0;
  
  console.log(`开始批量下载，共 ${files.length} 个文件，间隔 ${delay}ms`);
  
  for (const file of files) {
    const result = await downloadFile(file.url, file.filename);
    if (result) {
      success++;
      console.log(`✅ 下载成功: ${file.filename} (${success}/${files.length})`);
    } else {
      failed++;
      console.error(`❌ 下载失败: ${file.filename} (${failed}/${files.length})`);
    }
    
    // 添加延迟，防止浏览器阻塞
    if (files.indexOf(file) < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`📊 批量下载完成，成功 ${success} 个，失败 ${failed} 个`);
  return success > 0;
};

/**
 * 限流执行异步函数
 * @param items 要处理的项目数组
 * @param limit 同时执行的最大数量
 * @param handler 处理每个项目的异步函数
 * @returns 所有处理结果的数组
 */
async function throttleAsync<T, R>(items: T[], limit: number, handler: (item: T) => Promise<R>): Promise<R[]> {
  const promises: Promise<R>[] = [];
  const executing: Set<Promise<R>> = new Set();
  
  for (const item of items) {
    // 创建并执行异步任务
    const promise: Promise<R> = handler(item);
    promises.push(promise);
    
    // 添加到执行集合
    executing.add(promise);
    
    // 任务完成后从集合中移除
    const cleanup = () => {
      executing.delete(promise);
    };
    promise.then(cleanup).catch(cleanup);
    
    // 当执行数量达到限制时，等待一个任务完成
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  
  // 等待所有任务完成
  return Promise.all(promises);
}

/**
 * 处理URL，确保其格式正确
 * @param url 原始URL
 * @returns 处理后的URL
 */
const processUrl = (url: string): string => {
  let processedUrl = url.trim();
  
  // 如果URL是相对路径，添加协议和域名
  if (!processedUrl.startsWith('http')) {
    // 检查是否是完整的URL但缺少协议
    if (processedUrl.includes('://')) {
      // 已经有协议分隔符，可能是协议不完整
      processedUrl = `https${processedUrl}`;
    } else if (processedUrl.startsWith('//')) {
      // 缺少协议，添加https
      processedUrl = `https:${processedUrl}`;
    } else {
      // 相对路径，添加默认域名（这里使用当前域名）
      processedUrl = `${window.location.origin}${processedUrl.startsWith('/') ? '' : '/'}${processedUrl}`;
    }
  }
  
  console.log(`URL处理完成: 原始URL="${url}", 处理后URL="${processedUrl}"`);
  return processedUrl;
};

/**
 * 使用可靠方式获取图片Blob对象（专注于fetch方式，避免canvas污染问题）
 * @param url 图片URL
 * @param retryCount 剩余重试次数
 * @returns Blob对象
 */
const getImageBlob = async (url: string, retryCount: number = 2): Promise<Blob> => {
  // 处理URL，确保格式正确
  const processedUrl = processUrl(url);
  console.log(`开始获取图片Blob (${3 - retryCount}/3次尝试): ${processedUrl}`);
  
  // 方法1：尝试使用fetch方式获取Blob（适用于大多数情况）
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
    
    // 针对腾讯云COS URL的特殊处理
    const fetchOptions: RequestInit = {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-cache' // 不使用缓存，确保获取最新图片
    };
    
    // 不设置mode，让浏览器自动处理跨域
    // 对于腾讯云COS URL，浏览器会自动处理CORS
    
    const response = await fetch(processedUrl, fetchOptions);
    
    clearTimeout(timeoutId);
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // 检查Blob有效性
    if (!blob || blob.size === 0) {
      throw new Error(`Invalid blob received, size: ${blob?.size || 0}`);
    }
    
    console.log(`✅ fetch方式成功获取图片Blob: ${processedUrl}，大小: ${(blob.size / 1024).toFixed(2)}KB`);
    return blob;
  } catch (fetchError) {
    console.warn(`⚠️ fetch方式获取图片Blob失败，错误: ${fetchError.message}, 尝试使用简化版fetch: ${processedUrl}`);
    
    // 方法2：尝试使用简化版fetch（去掉自定义headers）
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
      
      // 使用最简配置的fetch
      const response = await fetch(processedUrl, {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error(`Invalid blob received, size: ${blob?.size || 0}`);
      }
      
      console.log(`✅ 简化版fetch成功获取图片Blob: ${processedUrl}，大小: ${(blob.size / 1024).toFixed(2)}KB`);
      return blob;
    } catch (simpleFetchError) {
      console.warn(`⚠️ 简化版fetch也失败，错误: ${simpleFetchError.message}`);
      
      // 如果还有重试次数，延迟后重试
      if (retryCount > 0) {
        const delay = Math.pow(2, 3 - retryCount) * 1000; // 1秒、2秒、4秒延迟
        console.log(`🔄 重试获取图片Blob，剩余次数: ${retryCount}, 延迟: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getImageBlob(processedUrl, retryCount - 1);
      } else {
        // 所有尝试都失败，抛出详细错误
        throw new Error(`所有尝试获取图片Blob都失败: ${processedUrl}, 错误: ${simpleFetchError.message}`);
      }
    }
  }
};

/**
 * 将图片打包成zip下载（支持fetch失败时降级为<a>标签下载）
 * @param files 文件数组，包含url和filename
 * @param zipFilename zip文件名
 * @returns {boolean} 是否成功下载了文件
 */
export const downloadImagesAsZip = async (files: Array<{ url: string; filename: string }>, zipFilename: string): Promise<boolean> => {
  console.log(`开始批量下载，共 ${files.length} 个文件，准备打包为 ${zipFilename}`);
  
  // 过滤掉无效的文件
  const validFiles = files.filter(file => file && file.url && file.filename);
  if (validFiles.length !== files.length) {
    console.warn(`过滤掉了 ${files.length - validFiles.length} 个无效文件`);
  }
  
  if (validFiles.length === 0) {
    console.error('❌ 没有有效的文件可以下载');
    return false;
  }
  
  // 检查依赖
  const { hasJSZip, hasSaveAs } = checkDependencies();
  
  // 情况1：依赖不可用，直接使用单个下载
  if (!hasJSZip || !hasSaveAs) {
    console.warn('⚠️ JSZip或FileSaver不可用，直接使用单个下载');
    return await batchDownloadFiles(validFiles);
  }
  
  // 情况2：依赖可用，尝试使用fetch方式打包下载
  console.log('📦 尝试使用fetch方式获取Blob并打包成ZIP...');
  
  try {
    const zip = new JSZip();
    const successFiles: Array<{ filename: string; blob: Blob }> = [];
    let failedCount = 0;
    
    // 逐个下载图片，获取Blob
    for (const file of validFiles) {
      try {
        console.log(`📄 处理文件: ${file.filename} (${successFiles.length + failedCount + 1}/${validFiles.length})`);
        
        // 尝试使用fetch方式获取Blob
        console.log('🔄 尝试使用fetch获取Blob...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
        
        const response = await fetch(file.url, {
          signal: controller.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        if (!blob || blob.size === 0) {
          throw new Error(`Invalid blob received, size: ${blob?.size || 0}`);
        }
        
        successFiles.push({ filename: file.filename, blob });
        console.log(`✅ 成功获取Blob: ${file.filename}，大小: ${(blob.size / 1024).toFixed(2)}KB`);
      } catch (fetchError) {
        console.error(`❌ fetch获取Blob失败: ${file.filename}，错误: ${fetchError.message}`);
        failedCount++;
      }
      
      // 添加小延迟，避免浏览器阻塞
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 图片下载完成，成功 ${successFiles.length} 个，失败 ${failedCount} 个`);
    
    // 如果有成功获取的Blob，打包成ZIP
    if (successFiles.length > 0) {
      console.log('📦 开始打包ZIP文件...');
      
      // 将成功获取的Blob添加到ZIP
      for (const file of successFiles) {
        zip.file(file.filename, file.blob);
      }
      
      // 生成ZIP文件
      const content = await zip.generateAsync({ type: 'blob' });
      
      // 下载ZIP文件
      saveAs(content, zipFilename);
      console.log(`✅ ZIP下载完成: ${zipFilename}`);
      
      // 如果有失败的文件，提示用户
      if (failedCount > 0) {
        console.warn(`⚠️  注意：部分文件下载失败，未包含在ZIP文件中。失败文件数量: ${failedCount}`);
      }
      
      return true;
    } else {
      console.error('❌ 所有文件fetch获取Blob失败，尝试降级为单个下载...');
      // 所有文件fetch失败，降级为单个下载
      return await batchDownloadFiles(validFiles);
    }
  } catch (zipError) {
    console.error('❌ ZIP打包失败，尝试降级为单个下载...', zipError);
    // ZIP打包失败，降级为单个下载
    return await batchDownloadFiles(validFiles);
  }
};

/**
 * 验证URL是否有效
 * @param url 要验证的URL
 * @returns 验证结果
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 使用fetch方式加载图片并转换为Blob
 * @param url 图片URL
 * @returns Blob对象
 */
const loadImageAsBlob = async (url: string, retryCount: number = 3): Promise<Blob> => {
  // 验证URL格式
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid URL: ${url}`);
  }
  
  // 修复URL（如果不完整）
  let fixedUrl = url;
  if (!fixedUrl.startsWith('http')) {
    // 如果是相对路径，添加协议
    fixedUrl = `https://${fixedUrl}`;
  }
  
  // 验证修复后的URL
  if (!isValidUrl(fixedUrl)) {
    throw new Error(`Invalid URL format after fixing: ${fixedUrl}`);
  }
  
  console.log(`开始加载图片: ${fixedUrl}, 剩余重试次数: ${retryCount}`);
  
  // 验证Blob有效性的辅助函数
  const validateBlob = (blob: Blob, mode: string): boolean => {
    if (!blob) {
      console.error(`❌ Blob无效: ${fixedUrl} - Blob为空 (mode: ${mode})`);
      return false;
    }
    
    if (blob.size === 0) {
      console.error(`❌ Blob无效: ${fixedUrl} - Blob大小为0 (mode: ${mode})`);
      return false;
    }
    
    // no-cors模式下，类型可能为空，所以不强制验证图片类型
    if (mode !== 'no-cors' && !blob.type.startsWith('image/')) {
      console.error(`❌ Blob无效: ${fixedUrl} - 不是图片类型，实际类型: ${blob.type} (mode: ${mode})`);
      return false;
    }
    
    console.log(`✅ Blob验证通过: ${fixedUrl}, 类型: ${blob.type}, 大小: ${(blob.size / 1024).toFixed(2)}KB (mode: ${mode})`);
    return true;
  };
  
  // 使用fetch加载图片，支持不同模式
  const fetchImage = async (mode: 'cors' | 'no-cors'): Promise<Blob> => {
    try {
      const controller = new AbortController();
      // 30秒超时
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(fixedUrl, {
        mode: mode,
        signal: controller.signal,
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      // no-cors模式下，response.ok总是true，所以不检查
      if (mode === 'cors' && !response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // 验证Blob有效性，no-cors模式下放宽验证
      if (!validateBlob(blob, mode)) {
        throw new Error(`Invalid blob received from server (mode: ${mode})`);
      }
      
      console.log(`✅ fetch (${mode})加载图片成功: ${fixedUrl}`);
      return blob;
    } catch (error) {
      console.error(`❌ fetch (${mode})加载图片失败: ${fixedUrl}`, error);
      throw error;
    }
  };
  
  // 使用img标签作为备选方案
  const loadImageWithImgTag = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout`));
      }, 30000);
      
      // 动态调整crossOrigin属性，根据URL和请求结果
      // 对于腾讯云等跨域图片，尝试不设置crossOrigin
      if (fixedUrl.includes('.cos.')) {
        // 腾讯云URL，不设置crossOrigin
        console.log(`⚠️ 腾讯云URL，不设置crossOrigin: ${fixedUrl}`);
      } else {
        // 其他URL，尝试设置crossOrigin
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        clearTimeout(timeoutId);
        console.log(`✅ img标签加载图片成功: ${fixedUrl}, 尺寸: ${img.width}x${img.height}`);
        
        // 创建canvas并绘制图片
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error(`Failed to get canvas context`));
          return;
        }
        
        try {
          ctx.drawImage(img, 0, 0);
        } catch (drawError) {
          console.error(`❌ 绘制图片失败: ${fixedUrl}`, drawError);
          reject(new Error(`Failed to draw image to canvas`));
          return;
        }
        
        // 尝试获取原图片格式，失败则使用PNG
        const originalFormat = getFileExtension(fixedUrl) || 'png';
        const mimeType = `image/${originalFormat}`;
        
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`✅ 图片转换为Blob成功: ${fixedUrl}, 大小: ${(blob.size / 1024).toFixed(2)}KB, 格式: ${mimeType}`);
            resolve(blob);
          } else {
            reject(new Error(`Failed to convert image to blob`));
          }
        }, mimeType);
      };
      
      img.onerror = (event) => {
        clearTimeout(timeoutId);
        console.error(`❌ img标签加载图片失败: ${fixedUrl}`, event);
        reject(new Error(`Image load error`));
      };
      
      // 先添加事件监听器，再设置src
      img.src = fixedUrl;
    });
  };
  
  try {
    // 尝试不同的请求模式
    for (const mode of ['cors', 'no-cors'] as const) {
      try {
        return await fetchImage(mode);
      } catch (modeError) {
        console.warn(`⚠️ fetch (${mode})方式失败，尝试其他方式: ${fixedUrl}`);
        // 继续尝试下一种模式
      }
    }
    
    // 如果所有fetch模式都失败，尝试使用img标签方式
    console.warn(`⚠️ 所有fetch方式失败，尝试使用img标签方式: ${fixedUrl}`);
    return await loadImageWithImgTag();
  } catch (error) {
    console.error(`❌ 图片加载失败: ${fixedUrl}`);
    
    // 重试逻辑
    if (retryCount > 0) {
      const delay = Math.pow(2, 3 - retryCount) * 1000;
      console.log(`🔄 重试加载图片，剩余次数: ${retryCount - 1}, 延迟: ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return await loadImageAsBlob(fixedUrl, retryCount - 1);
    } else {
      throw new Error(`Failed to load image after ${4 - retryCount} attempts (URL: ${fixedUrl})`);
    }
  }
};

/**
 * 获取文件扩展名
 * @param url 文件URL
 * @param originalFilename 原始文件名（可选）
 * @returns 文件扩展名
 */
export const getFileExtension = (url: string, originalFilename?: string): string => {
  try {
    // 优先从原始文件名获取扩展名
    if (originalFilename) {
      const ext = originalFilename.split('.').pop()?.toLowerCase() || '';
      if (ext) {
        return ext;
      }
    }
    
    // 从URL获取扩展名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return ext;
  } catch (error) {
    // 如果URL解析失败，尝试直接从字符串中获取扩展名
    const ext = url.split('.').pop()?.toLowerCase() || '';
    return ext;
  }
};

/**
 * 格式化文件名，移除特殊字符
 * @param filename 原始文件名
 * @returns 格式化后的文件名
 */
export const formatFilename = (filename: string): string => {
  // 移除或替换操作系统不支持的特殊字符
  return filename.replace(/[<>:"/\|?*]/g, '_');
};