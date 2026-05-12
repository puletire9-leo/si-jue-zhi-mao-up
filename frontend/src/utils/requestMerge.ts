/**
 * 请求合并工具类
 * 用于将短时间内的多个请求合并为一个批量请求，减少HTTP请求数量
 */

// 请求配置接口
export interface MergeRequestConfig {
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 请求参数 */
  params?: Record<string, any>;
  /** 请求体数据 */
  data?: any;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求响应类型 */
  responseType?: 'json' | 'blob' | 'arraybuffer' | 'text';
}

// 请求合并选项接口
export interface MergeOptions {
  /** 合并时间窗口（毫秒），默认100ms */
  delay?: number;
  /** 合并后的请求URL */
  mergeUrl?: string;
  /** 合并后的请求方法 */
  mergeMethod?: 'GET' | 'POST';
  /** 是否启用合并，默认true */
  enabled?: boolean;
  /** 最大合并请求数，默认100 */
  maxRequests?: number;
}

// 请求合并项接口
interface MergeItem {
  /** 请求ID */
  id: string;
  /** 请求配置 */
  config: MergeRequestConfig;
  /** 请求解析函数，用于从批量响应中提取当前请求的数据 */
  resolver: (response: any) => any;
  /** 成功回调 */
  resolve: (data: any) => void;
  /** 失败回调 */
  reject: (error: any) => void;
}

// 请求合并组接口
interface MergeGroup {
  /** 合并组ID */
  id: string;
  /** 合并的请求项列表 */
  items: MergeItem[];
  /** 定时器ID */
  timer: number;
  /** 合并选项 */
  options: MergeOptions;
}

/**
 * 请求合并工具类
 */
export class RequestMerger {
  /** 合并请求的Map，key为合并组ID，value为合并组 */
  private mergeGroups: Map<string, MergeGroup> = new Map();
  /** 默认合并选项 */
  private defaultOptions: MergeOptions = {
    delay: 100,
    mergeMethod: 'POST',
    enabled: true,
    maxRequests: 100
  };
  /** 请求ID计数器 */
  private requestIdCounter = 0;

  /**
   * 创建合并请求
   * @param config 请求配置
   * @param resolver 请求解析函数，用于从批量响应中提取当前请求的数据
   * @param options 合并选项
   * @returns Promise对象，包含合并请求的结果
   */
  mergeRequest<T = any>(
    config: MergeRequestConfig,
    resolver: (response: any) => T,
    options?: MergeOptions
  ): Promise<T> {
    // 如果合并未启用，直接发送请求
    const mergeOptions = { ...this.defaultOptions, ...options };
    if (!mergeOptions.enabled) {
      return this.sendSingleRequest<T>(config);
    }

    // 生成合并组ID，基于URL和方法
    const groupId = this.getGroupId(config, mergeOptions);
    
    return new Promise((resolve, reject) => {
      // 生成请求ID
      const requestId = this.generateRequestId();
      
      // 创建请求项
      const mergeItem: MergeItem = {
        id: requestId,
        config,
        resolver,
        resolve,
        reject
      };

      // 获取或创建合并组
      let mergeGroup = this.mergeGroups.get(groupId);
      if (!mergeGroup) {
        // 创建新的合并组
        mergeGroup = {
          id: groupId,
          items: [],
          timer: 0,
          options: mergeOptions
        };
        this.mergeGroups.set(groupId, mergeGroup);
      }

      // 添加请求项到合并组
      mergeGroup.items.push(mergeItem);

      // 如果达到最大请求数，立即发送合并请求
      if (mergeGroup.items.length >= mergeOptions.maxRequests!) {
        this.sendMergeRequest(groupId);
        return;
      }

      // 清除现有的定时器，重新设置
      clearTimeout(mergeGroup.timer);
      
      // 设置新的定时器，在指定延迟后发送合并请求
      mergeGroup.timer = window.setTimeout(() => {
        this.sendMergeRequest(groupId);
      }, mergeOptions.delay);
    });
  }

  /**
   * 发送单个请求
   * @param config 请求配置
   * @returns Promise对象，包含请求结果
   */
  private sendSingleRequest<T>(config: MergeRequestConfig): Promise<T> {
    // 这里可以替换为实际的请求库，如axios、fetch等
    const { url, method, params, data, headers, responseType } = config;
    
    // 使用fetch API发送请求
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: data ? JSON.stringify(data) : undefined
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 根据responseType处理响应
      switch (responseType) {
        case 'json':
          return response.json();
        case 'blob':
          return response.blob();
        case 'arraybuffer':
          return response.arrayBuffer();
        case 'text':
          return response.text();
        default:
          return response.json();
      }
    })
    .catch(error => {
      console.error('单个请求失败:', error);
      throw error;
    });
  }

  /**
   * 发送合并请求
   * @param groupId 合并组ID
   */
  private async sendMergeRequest(groupId: string): Promise<void> {
    const mergeGroup = this.mergeGroups.get(groupId);
    if (!mergeGroup) {
      return;
    }

    // 清除定时器
    clearTimeout(mergeGroup.timer);
    
    // 取出所有请求项
    const items = mergeGroup.items;
    
    // 移除合并组
    this.mergeGroups.delete(groupId);
    
    if (items.length === 0) {
      return;
    }

    try {
      // 构建合并请求配置
      const mergeConfig = this.buildMergeConfig(items, mergeGroup.options);
      
      // 发送合并请求
      const response = await this.sendSingleRequest(mergeConfig);
      
      // 处理合并响应，分发给各个请求项
      items.forEach(item => {
        try {
          // 使用解析函数提取当前请求的数据
          const data = item.resolver(response);
          item.resolve(data);
        } catch (error) {
          item.reject(error);
        }
      });
    } catch (error) {
      // 合并请求失败，所有请求项都失败
      items.forEach(item => {
        item.reject(error);
      });
    }
  }

  /**
   * 构建合并请求配置
   * @param items 请求项列表
   * @param options 合并选项
   * @returns 合并请求配置
   */
  private buildMergeConfig(items: MergeItem[], options: MergeOptions): MergeRequestConfig {
    // 从第一个请求项中获取基础配置
    const baseConfig = items[0].config;
    
    // 构建合并请求配置
    const mergeConfig: MergeRequestConfig = {
      url: options.mergeUrl || baseConfig.url,
      method: options.mergeMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...baseConfig.headers
      },
      responseType: baseConfig.responseType || 'json'
    };

    // 构建请求体，包含所有请求项的信息
    mergeConfig.data = {
      requests: items.map(item => ({
        id: item.id,
        url: item.config.url,
        method: item.config.method,
        params: item.config.params,
        data: item.config.data
      }))
    };

    return mergeConfig;
  }

  /**
   * 生成合并组ID
   * @param config 请求配置
   * @param options 合并选项
   * @returns 合并组ID
   */
  private getGroupId(config: MergeRequestConfig, options: MergeOptions): string {
    // 如果指定了mergeUrl，使用mergeUrl作为合并组ID的一部分
    if (options.mergeUrl) {
      return options.mergeUrl;
    }
    
    // 否则，基于URL和方法生成合并组ID
    return `${config.url}-${config.method}`;
  }

  /**
   * 生成请求ID
   * @returns 请求ID
   */
  private generateRequestId(): string {
    this.requestIdCounter++;
    return `request-${this.requestIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清除所有合并请求
   */
  clearAllRequests(): void {
    // 清除所有定时器
    this.mergeGroups.forEach(mergeGroup => {
      clearTimeout(mergeGroup.timer);
    });
    
    // 清空合并组
    this.mergeGroups.clear();
  }

  /**
   * 获取当前合并组数量
   * @returns 合并组数量
   */
  getMergeGroupCount(): number {
    return this.mergeGroups.size;
  }

  /**
   * 获取当前等待合并的请求总数
   * @returns 等待合并的请求总数
   */
  getPendingRequestCount(): number {
    let count = 0;
    this.mergeGroups.forEach(mergeGroup => {
      count += mergeGroup.items.length;
    });
    return count;
  }
}

// 创建单例实例
export const requestMerger = new RequestMerger();

/**
 * 批量获取图片信息的请求合并工具函数
 * @param imageIds 图片ID列表
 * @param delay 合并时间窗口（毫秒）
 * @returns Promise对象，包含所有图片信息
 */
export const batchGetImages = async (imageIds: Array<string | number>, delay: number = 100): Promise<Record<string, any>> => {
  // 去重图片ID
  const uniqueIds = Array.from(new Set(imageIds.map(id => id.toString())));
  
  if (uniqueIds.length === 0) {
    return {};
  }
  
  // 如果只有一个ID，直接发送单个请求
  if (uniqueIds.length === 1) {
    try {
      const response = await fetch(`/api/v1/images/${uniqueIds[0]}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { [uniqueIds[0]]: data.data };
    } catch (error) {
      console.error('获取图片信息失败:', error);
      return {};
    }
  }
  
  // 否则，使用请求合并发送批量请求
  return new Promise((resolve, reject) => {
    // 设置定时器，等待指定延迟后发送批量请求
    setTimeout(async () => {
      try {
        // 发送批量请求
        const response = await fetch('/api/v1/images/batch-get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ids: uniqueIds
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        resolve(data.data || {});
      } catch (error) {
        console.error('批量获取图片信息失败:', error);
        reject(error);
      }
    }, delay);
  });
};
