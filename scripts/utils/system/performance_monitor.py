# performance_monitor.py
# 性能监控模块，提供函数性能监控装饰器
import time
import functools

# 优雅处理PyTorch导入失败的情况
torch = None
torch_available = False
try:
    import torch
    torch_available = True
except Exception as e:
    print(f"[WARNING] PyTorch导入失败，性能监控将不包含CUDA内存统计: {str(e)}")

# ---------------------- 性能监控装饰器（基础版） ----------------------
def monitor_performance(func):
    """
    性能监控装饰器，用于记录函数执行时间和性能指标
    支持CUDA内存使用监控
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        # 记录CUDA内存使用（如果可用）
        start_memory = 0
        if torch_available and torch is not None and torch.cuda.is_available():
            torch.cuda.synchronize()
            start_memory = torch.cuda.max_memory_allocated()
        
        try:
            result = func(*args, **kwargs)
        except Exception as e:
            end_time = time.time()
            print(f"[ERROR] {func.__name__} 执行失败，耗时: {end_time - start_time:.2f}秒")
            raise
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # 记录CUDA内存使用（如果可用）
        if torch_available and torch is not None and torch.cuda.is_available():
            torch.cuda.synchronize()
            end_memory = torch.cuda.max_memory_allocated()
            memory_used = (end_memory - start_memory) / (1024 * 1024)  # MB
            print(f"[STATS] {func.__name__} 执行完成，耗时: {execution_time:.2f}秒，CUDA内存使用: {memory_used:.2f}MB")
        else:
            print(f"[STATS] {func.__name__} 执行完成，耗时: {execution_time:.2f}秒")
        
        return result
    return wrapper

# ---------------------- 性能监控装饰器（高级版，带慢操作告警） ----------------------
def monitor_performance_with_alert(func):
    """
    函数性能监控装饰器，记录耗时并告警慢操作
    以毫秒为单位记录时间，超过1秒的操作会发出告警
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            elapsed_time = (time.perf_counter() - start_time) * 1000  # 转毫秒

            # 慢操作告警（超过1秒）
            if elapsed_time > 1000:
                print(f"[WARNING]  慢操作告警：{func.__name__} 耗时 {elapsed_time:.1f}ms")

            return result
        except Exception as e:
            elapsed_time = (time.perf_counter() - start_time) * 1000
            print(f"[ERROR] 操作失败：{func.__name__} 耗时 {elapsed_time:.1f}ms，错误：{str(e)}")
            raise

    return wrapper
