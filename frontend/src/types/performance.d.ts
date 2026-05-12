/**
 * Performance接口扩展类型定义
 * 添加memory属性支持，用于内存监控
 */

// 扩展Performance接口，添加memory属性
declare interface Performance {
  /**
   * 内存使用情况对象
   * 仅在Chrome等支持MemoryInfo的浏览器中可用
   */
  memory?: {
    /**
     * 总JS堆大小
     */
    totalJSHeapSize: number;
    /**
     * 已使用的JS堆大小
     */
    usedJSHeapSize: number;
    /**
     * JS堆大小限制
     */
    jsHeapSizeLimit: number;
  };
}

// 确保TypeScript识别此扩展
export {};