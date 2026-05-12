/**
 * 内存使用监控工具
 * 用于监控前端内存使用情况，检测内存泄漏，提供内存使用统计
 */

// 内存使用统计接口
export interface MemoryStats {
  /** 总内存大小 (bytes) */
  totalJSHeapSize: number;
  /** 已使用内存大小 (bytes) */
  usedJSHeapSize: number;
  /** 可使用的最大内存大小 (bytes) */
  jsHeapSizeLimit: number;
  /** 内存使用率 (%) */
  usagePercentage: number;
  /** 时间戳 */
  timestamp: number;
}

// 内存监控配置接口
export interface MemoryMonitorConfig {
  /** 监控间隔 (ms) */
  interval?: number;
  /** 内存使用阈值告警 (%) */
  warningThreshold?: number;
  /** 内存使用阈值严重告警 (%) */
  criticalThreshold?: number;
  /** 最大内存使用记录数 */
  maxHistory?: number;
}

// 内存监控类
export class MemoryMonitor {
  private config: MemoryMonitorConfig;
  private intervalId: number | null = null;
  private memoryHistory: MemoryStats[] = [];
  private callbacks: {
    onUpdate?: (stats: MemoryStats) => void;
    onWarning?: (stats: MemoryStats) => void;
    onCritical?: (stats: MemoryStats) => void;
  } = {};

  constructor(config: MemoryMonitorConfig = {}) {
    this.config = {
      interval: config.interval || 5000, // 默认5秒监控一次
      warningThreshold: config.warningThreshold || 70, // 70%警告
      criticalThreshold: config.criticalThreshold || 90, // 90%严重警告
      maxHistory: config.maxHistory || 100, // 最多保存100条记录
      ...config
    };
  }

  /**
   * 获取当前内存使用情况
   * @returns 内存使用统计对象
   */
  getCurrentMemoryStats(): MemoryStats | null {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      console.warn('浏览器不支持内存监控');
      return null;
    }

    const memory = (performance as any).memory;
    const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    const stats: MemoryStats = {
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage,
      timestamp: Date.now()
    };

    return stats;
  }

  /**
   * 开始监控内存使用
   * @param callbacks 回调函数
   */
  startMonitoring(callbacks?: {
    onUpdate?: (stats: MemoryStats) => void;
    onWarning?: (stats: MemoryStats) => void;
    onCritical?: (stats: MemoryStats) => void;
  }): void {
    if (this.intervalId) {
      console.warn('内存监控已经在运行');
      return;
    }

    if (callbacks) {
      this.callbacks = {
        ...this.callbacks,
        ...callbacks
      };
    }

    this.intervalId = window.setInterval(() => {
      const stats = this.getCurrentMemoryStats();
      if (stats) {
        this.processMemoryStats(stats);
      }
    }, this.config.interval);

    console.log('内存监控已启动');
  }

  /**
   * 停止监控内存使用
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('内存监控已停止');
    }
  }

  /**
   * 处理内存使用统计数据
   * @param stats 内存使用统计对象
   */
  private processMemoryStats(stats: MemoryStats): void {
    // 保存到历史记录
    this.memoryHistory.push(stats);
    
    // 限制历史记录数量
    if (this.memoryHistory.length > this.config.maxHistory!) {
      this.memoryHistory.shift();
    }

    // 触发更新回调
    if (this.callbacks.onUpdate) {
      this.callbacks.onUpdate(stats);
    }

    // 检查内存使用阈值
    if (stats.usagePercentage >= this.config.criticalThreshold!) {
      if (this.callbacks.onCritical) {
        this.callbacks.onCritical(stats);
      }
      console.error('⚠️ 内存使用严重警告:', this.formatMemoryStats(stats));
    } else if (stats.usagePercentage >= this.config.warningThreshold!) {
      if (this.callbacks.onWarning) {
        this.callbacks.onWarning(stats);
      }
      console.warn('⚠️ 内存使用警告:', this.formatMemoryStats(stats));
    }
  }

  /**
   * 获取内存使用历史记录
   * @returns 内存使用历史记录数组
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * 获取内存使用趋势
   * @returns 内存使用趋势对象
   */
  getMemoryTrend(): {
    averageUsage: number;
    peakUsage: number;
    minUsage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.memoryHistory.length === 0) {
      return {
        averageUsage: 0,
        peakUsage: 0,
        minUsage: 0,
        trend: 'stable'
      };
    }

    const usagePercentages = this.memoryHistory.map(stats => stats.usagePercentage);
    const averageUsage = usagePercentages.reduce((sum, usage) => sum + usage, 0) / usagePercentages.length;
    const peakUsage = Math.max(...usagePercentages);
    const minUsage = Math.min(...usagePercentages);

    // 分析趋势
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (this.memoryHistory.length >= 3) {
      const recent = this.memoryHistory.slice(-3);
      const first = recent[0].usagePercentage;
      const last = recent[2].usagePercentage;
      const change = last - first;

      if (change > 5) {
        trend = 'increasing';
      } else if (change < -5) {
        trend = 'decreasing';
      }
    }

    return {
      averageUsage,
      peakUsage,
      minUsage,
      trend
    };
  }

  /**
   * 格式化内存使用统计数据
   * @param stats 内存使用统计对象
   * @returns 格式化后的字符串
   */
  private formatMemoryStats(stats: MemoryStats): string {
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return `
内存使用情况:
  总内存: ${formatBytes(stats.totalJSHeapSize)}
  已使用: ${formatBytes(stats.usedJSHeapSize)} (${stats.usagePercentage.toFixed(2)}%)
  最大可用: ${formatBytes(stats.jsHeapSizeLimit)}
  时间: ${new Date(stats.timestamp).toLocaleString()}
    `.trim();
  }

  /**
   * 清除内存使用历史记录
   */
  clearHistory(): void {
    this.memoryHistory = [];
  }

  /**
   * 检测内存泄漏
   * @param duration 检测持续时间 (ms)
   * @param checkInterval 检查间隔 (ms)
   * @returns 内存泄漏检测结果
   */
  async detectMemoryLeak(duration: number = 30000, checkInterval: number = 2000): Promise<{
    hasLeak: boolean;
    evidence: string;
    memoryGrowth: number;
  }> {
    const initialStats = this.getCurrentMemoryStats();
    if (!initialStats) {
      return {
        hasLeak: false,
        evidence: '浏览器不支持内存监控',
        memoryGrowth: 0
      };
    }

    const startTime = Date.now();
    let checkCount = 0;
    const memorySnapshots: number[] = [initialStats.usedJSHeapSize];

    while (Date.now() - startTime < duration) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      const stats = this.getCurrentMemoryStats();
      if (stats) {
        memorySnapshots.push(stats.usedJSHeapSize);
        checkCount++;
      }
    }

    const finalStats = this.getCurrentMemoryStats();
    if (!finalStats) {
      return {
        hasLeak: false,
        evidence: '浏览器不支持内存监控',
        memoryGrowth: 0
      };
    }

    const memoryGrowth = finalStats.usedJSHeapSize - initialStats.usedJSHeapSize;
    const growthPercentage = (memoryGrowth / initialStats.usedJSHeapSize) * 100;

    // 判断是否存在内存泄漏
    // 如果内存增长超过20%且持续增长，则认为存在内存泄漏
    let hasLeak = false;
    let evidence = '';

    if (memoryGrowth > 0 && growthPercentage > 20) {
      // 检查趋势是否持续增长
      const trend = this.getMemoryTrend();
      if (trend.trend === 'increasing') {
        hasLeak = true;
        evidence = `内存持续增长: ${((memoryGrowth / 1024 / 1024).toFixed(2))} MB (${growthPercentage.toFixed(2)}%)`;
      }
    }

    return {
      hasLeak,
      evidence,
      memoryGrowth
    };
  }
}

// 创建单例实例
export const memoryMonitor = new MemoryMonitor();

// 全局内存监控工具函数
export const getMemoryStats = (): MemoryStats | null => {
  return memoryMonitor.getCurrentMemoryStats();
};

export const startMemoryMonitoring = (callbacks?: {
  onUpdate?: (stats: MemoryStats) => void;
  onWarning?: (stats: MemoryStats) => void;
  onCritical?: (stats: MemoryStats) => void;
}): void => {
  memoryMonitor.startMonitoring(callbacks);
};

export const stopMemoryMonitoring = (): void => {
  memoryMonitor.stopMonitoring();
};

export const detectMemoryLeak = async (duration?: number, checkInterval?: number): Promise<{
  hasLeak: boolean;
  evidence: string;
  memoryGrowth: number;
}> => {
  return memoryMonitor.detectMemoryLeak(duration, checkInterval);
};

// 导出工具类
export default MemoryMonitor;