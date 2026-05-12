#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
错误日志记录系统
提供详细的错误日志记录功能，包括错误类型、时间戳、堆栈跟踪、请求参数及上下文信息
"""
import os
import sys
import traceback
import json
from datetime import datetime
from functools import wraps
from typing import Optional, Dict, Any, Callable

# 日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'logs')
ERROR_LOG_FILE = os.path.join(LOG_DIR, 'error.log')

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

class ErrorLogger:
    """错误日志记录器"""
    
    def __init__(self):
        self.log_file = ERROR_LOG_FILE
    
    def log_error(self, error_type, error_message, request_info=None, context=None):
        """
        记录错误日志
        
        :param error_type: 错误类型（如：DatabaseError, APIError, QdrantError等）
        :param error_message: 错误消息
        :param request_info: 请求信息（如：URL、方法、参数等）
        :param context: 上下文信息（如：函数名、变量值等）
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        log_entry = {
            'timestamp': timestamp,
            'error_type': error_type,
            'error_message': error_message,
            'request_info': request_info or {},
            'context': context or {},
            'stack_trace': traceback.format_exc()
        }
        
        # 写入日志文件
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False, indent=2) + '\n')
            f.write('-' * 80 + '\n')
        
        # 同时输出到控制台
        print(f"\n[{timestamp}] {error_type}: {error_message}")
        if request_info:
            print(f"请求信息: {json.dumps(request_info, ensure_ascii=False)}")
        if context:
            print(f"上下文: {json.dumps(context, ensure_ascii=False)}")
        print(f"堆栈跟踪:\n{traceback.format_exc()}\n")
    
    def get_recent_errors(self, limit=10):
        """
        获取最近的错误记录
        
        :param limit: 返回的记录数量
        :return: 错误记录列表
        """
        if not os.path.exists(self.log_file):
            return []
        
        errors = []
        with open(self.log_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip() and not line.startswith('-'):
                    try:
                        errors.append(json.loads(line))
                    except:
                        pass
        
        return errors[-limit:]

# 全局错误日志记录器实例
error_logger = ErrorLogger()

def log_error(error_type, error_message, request_info=None, context=None):
    """
    便捷函数：记录错误日志
    
    :param error_type: 错误类型
    :param error_message: 错误消息
    :param request_info: 请求信息
    :param context: 上下文信息
    """
    error_logger.log_error(error_type, error_message, request_info, context)

def handle_exception(error_type: str) -> Callable:
    """
    异常处理装饰器（通用版本，不依赖特定框架）
    
    :param error_type: 错误类型
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # 获取上下文信息
                context = {
                    'function': func.__name__,
                    'args_count': len(args),
                    'kwargs_keys': list(kwargs.keys())
                }
                
                # 记录错误
                log_error(
                    error_type=error_type,
                    error_message=str(e),
                    request_info=None,
                    context=context
                )
                
                # 重新抛出异常，让上层处理
                raise
        
        return wrapper
    return decorator

def get_user_friendly_message(error_type, error_message):
    """
    将技术错误信息转换为用户友好的提示文本
    
    :param error_type: 错误类型
    :param error_message: 原始错误消息
    :return: 用户友好的错误消息
    """
    error_messages = {
        'DatabaseError': '数据库操作失败，请稍后重试',
        'APIError': 'API请求处理失败，请检查请求参数',
        'QdrantError': '向量数据库连接失败，搜索功能暂时不可用',
        'AIModelError': 'AI模型加载失败，图片编码功能不可用',
        'RedisError': '缓存服务连接失败',
        'ValidationError': '请求参数验证失败',
        'FileError': '文件操作失败',
        'NetworkError': '网络连接失败，请检查网络设置'
    }
    
    return error_messages.get(error_type, f'系统错误：{error_message}')

def get_error_summary():
    """
    获取错误摘要信息
    
    :return: 错误统计信息
    """
    recent_errors = error_logger.get_recent_errors(100)
    
    if not recent_errors:
        return {
            'total_errors': 0,
            'by_type': {},
            'latest_error': None
        }
    
    # 按类型统计
    error_by_type = {}
    for error in recent_errors:
        error_type = error.get('error_type', 'Unknown')
        error_by_type[error_type] = error_by_type.get(error_type, 0) + 1
    
    return {
        'total_errors': len(recent_errors),
        'by_type': error_by_type,
        'latest_error': recent_errors[-1] if recent_errors else None
    }

if __name__ == '__main__':
    print("错误日志系统测试")
    log_error('TestError', '这是一个测试错误', {'url': '/test'}, {'test': 'value'})
    print("\n最近的错误记录:")
    summary = get_error_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))