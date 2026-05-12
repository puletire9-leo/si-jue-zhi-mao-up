# timeout_middleware.py
# 超时控制中间件，用于防止请求处理时间过长
import threading
from functools import wraps
from typing import Any, Callable, Dict

class TimeoutException(Exception):
    """请求超时异常"""
    pass

def request_timeout(timeout: int = 10) -> Callable:
    """
    请求超时装饰器
    
    :param timeout: 超时时间（秒）
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            result_container = {'result': None, 'exception': None}
            
            def worker():
                try:
                    result_container['result'] = f(*args, **kwargs)
                except Exception as e:
                    result_container['exception'] = e
            
            thread = threading.Thread(target=worker)
            thread.daemon = True
            thread.start()
            thread.join(timeout=timeout)
            
            if thread.is_alive():
                raise TimeoutException(f'请求处理超时（{timeout}秒），请稍后重试')
            
            if result_container['exception']:
                raise result_container['exception']
            
            return result_container['result']
        
        return decorated_function
    return decorator

def async_timeout(timeout: int = 10) -> Callable:
    """
    异步任务超时装饰器
    
    :param timeout: 超时时间（秒）
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            result_container = {'result': None, 'exception': None}
            
            def worker():
                try:
                    result_container['result'] = f(*args, **kwargs)
                except Exception as e:
                    result_container['exception'] = e
            
            thread = threading.Thread(target=worker)
            thread.daemon = True
            thread.start()
            thread.join(timeout=timeout)
            
            if thread.is_alive():
                raise TimeoutException(f'任务执行超时（{timeout}秒）')
            
            if result_container['exception']:
                raise result_container['exception']
            
            return result_container['result']
        
        return decorated_function
    return decorator
