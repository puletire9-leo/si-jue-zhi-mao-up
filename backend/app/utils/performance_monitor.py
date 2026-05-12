from typing import Dict, Any
import time
import logging
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)

class PerformanceMonitor:
    """
    性能监控工具类
    
    用于监控应用程序的性能指标，特别是热重载过程中的各阶段耗时
    """
    
    def __init__(self):
        """初始化性能监控器"""
        self.start_times: Dict[str, float] = {}
        self.durations: Dict[str, float] = {}
        self.async_tasks: Dict[str, asyncio.Task] = {}
    
    def start(self, name: str):
        """
        开始监控某个阶段的耗时
        
        Args:
            name: 阶段名称，用于标识不同的监控点
        """
        self.start_times[name] = time.time()
        logger.debug(f"[开始] 监控: {name}")
    
    def end(self, name: str):
        """
        结束监控某个阶段的耗时
        
        Args:
            name: 阶段名称，与start方法中的名称对应
        """
        if name in self.start_times:
            duration = time.time() - self.start_times[name]
            self.durations[name] = duration
            logger.info(f"[完成] {name} 耗时: {duration:.2f}秒")
        else:
            logger.warning(f"[警告] 尝试结束未开始的监控: {name}")
    
    async def async_start(self, name: str, coro):
        """
        异步开始监控某个协程的执行耗时
        
        Args:
            name: 阶段名称
            coro: 要执行的协程
        
        Returns:
            协程的返回值
        """
        start_time = time.time()
        logger.debug(f"[开始] 异步监控: {name}")

        try:
            result = await coro
            duration = time.time() - start_time
            self.durations[name] = duration
            logger.info(f"[完成] {name} 耗时: {duration:.2f}秒")
            return result
        except Exception as e:
            duration = time.time() - start_time
            self.durations[name] = duration
            logger.error(f"[失败] {name} 执行失败，耗时: {duration:.2f}秒，错误: {e}")
            raise
    
    def get_durations(self) -> Dict[str, float]:
        """
        获取所有监控阶段的耗时
        
        Returns:
            包含各阶段耗时的字典
        """
        return self.durations
    
    def log_summary(self):
        """
        记录性能监控摘要
        
        输出各阶段耗时占比，便于分析性能瓶颈
        """
        if not self.durations:
            logger.info("[信息] 没有性能监控数据")
            return

        total = sum(self.durations.values())
        logger.info(f"[摘要] 性能监控 - 总耗时: {total:.2f}秒")
        
        # 按耗时排序输出
        for name, duration in sorted(self.durations.items(), key=lambda x: x[1], reverse=True):
            percentage = (duration / total * 100) if total > 0 else 0
            logger.info(f"   {name}: {duration:.2f}秒 ({percentage:.1f}%)")
    
    def reset(self):
        """
        重置所有监控数据
        
        用于开始新的监控周期
        """
        self.start_times.clear()
        self.durations.clear()
        self.async_tasks.clear()
        logger.debug("[重置] 性能监控数据已清空")
    
    def log_hot_reload_performance(self, file_change_time: float):
        """
        记录热重载性能数据
        
        Args:
            file_change_time: 文件变化的时间戳
        """
        reload_time = time.time() - file_change_time
        logger.info(f"[热重载] 总耗时: {reload_time:.2f}秒")
        self.log_summary()
    
    @staticmethod
    def measure_function(func):
        """
        装饰器：测量函数执行时间
        
        Args:
            func: 要测量的函数
        
        Returns:
            装饰后的函数
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            monitor = PerformanceMonitor()
            monitor.start(func.__name__)
            try:
                return func(*args, **kwargs)
            finally:
                monitor.end(func.__name__)
        return wrapper
    
    @staticmethod
    async def measure_async_function(func):
        """
        装饰器：测量异步函数执行时间
        
        Args:
            func: 要测量的异步函数
        
        Returns:
            装饰后的异步函数
        """
        @wraps(func)
        async def wrapper(*args, **kwargs):
            monitor = PerformanceMonitor()
            return await monitor.async_start(func.__name__, func(*args, **kwargs))
        return wrapper
