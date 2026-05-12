import asyncio
import time
from typing import Callable
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
import anyio

logger = logging.getLogger(__name__)


class TimeoutMiddleware(BaseHTTPMiddleware):
    """
    请求超时处理中间件
    
    功能：
    - 为每个请求设置超时时间
    - 超时后自动取消请求并返回504错误
    - 支持不同路径设置不同的超时时间
    - 记录超时事件
    
    使用场景：
    - 防止长时间运行的请求占用资源
    - 提高系统响应性
    - 保护系统免受慢速攻击
    """
    
    def __init__(
        self,
        app: ASGIApp,
        default_timeout: float = 30.0,
        path_timeouts: dict = None,
        skip_paths: list = None
    ):
        """
        初始化超时中间件
        
        Args:
            app: ASGI应用实例
            default_timeout: 默认超时时间（秒）
            path_timeouts: 特定路径的超时时间配置（路径: 超时时间）
            skip_paths: 跳过超时检查的路径列表
        """
        super().__init__(app)
        self.default_timeout = default_timeout
        self.path_timeouts = path_timeouts or {}
        self.skip_paths = skip_paths or ["/health", "/metrics"]
    
    def get_timeout(self, path: str) -> float:
        """
        获取指定路径的超时时间
        
        Args:
            path: 请求路径
            
        Returns:
            float: 超时时间（秒）
        """
        # 检查是否在跳过列表中
        if path in self.skip_paths:
            return float('inf')
        
        # 检查是否有特定路径的超时配置
        for pattern, timeout in self.path_timeouts.items():
            if path.startswith(pattern):
                return timeout
        
        # 返回默认超时时间
        return self.default_timeout
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并应用超时控制
        
        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP响应对象
            
        Raises:
            HTTPException: 请求超时时抛出504 Gateway Timeout错误
        """
        # 跳过OPTIONS预检请求（CORS）
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # 获取请求ID
        request_id = getattr(request.state, "request_id", "unknown")
        
        # 获取超时时间
        timeout = self.get_timeout(request.url.path)
        
        # 如果超时时间为无限大，直接处理请求
        if timeout == float('inf'):
            return await call_next(request)
        
        # 记录请求开始
        start_time = time.time()
        logger.debug(f"[{request_id}] 请求超时设置: {timeout}秒")
        
        try:
            # 使用asyncio.wait_for实现超时控制
            response = await asyncio.wait_for(
                call_next(request),
                timeout=timeout
            )
            
            # 记录请求完成时间
            process_time = time.time() - start_time
            logger.debug(
                f"[{request_id}] 请求完成 | "
                f"处理时间: {process_time:.3f}秒 | "
                f"超时设置: {timeout}秒"
            )
            
            return response
            
        except asyncio.TimeoutError:
            # 记录超时事件
            process_time = time.time() - start_time
            logger.warning(
                f"[{request_id}] 请求超时 | "
                f"处理时间: {process_time:.3f}秒 | "
                f"超时设置: {timeout}秒 | "
                f"路径: {request.url.path} | "
                f"方法: {request.method}"
            )
            
            # 返回504 Gateway Timeout错误
            raise HTTPException(
                status_code=504,
                detail=f"请求超时，超过{timeout}秒限制"
            )
        except anyio.EndOfStream:
            # 捕获流结束异常（客户端连接关闭）
            process_time = time.time() - start_time
            logger.warning(
                f"[{request_id}] 客户端连接关闭 | "
                f"处理时间: {process_time:.3f}秒 | "
                f"路径: {request.url.path} | "
                f"方法: {request.method}"
            )
            
            # 返回499 Client Closed Request错误
            raise HTTPException(
                status_code=499,
                detail="客户端连接已关闭"
            )


class SlowRequestMiddleware(BaseHTTPMiddleware):
    """
    慢请求监控中间件
    
    功能：
    - 监控处理时间过长的请求
    - 记录慢请求的详细信息
    - 不中断请求，仅记录日志
    - 支持配置慢请求阈值
    
    使用场景：
    - 性能监控和优化
    - 识别性能瓶颈
    - 系统健康检查
    """
    
    def __init__(
        self,
        app: ASGIApp,
        slow_threshold: float = 5.0,
        log_level: str = "warning"
    ):
        """
        初始化慢请求监控中间件
        
        Args:
            app: ASGI应用实例
            slow_threshold: 慢请求阈值（秒）
            log_level: 日志级别（warning, info, debug）
        """
        super().__init__(app)
        self.slow_threshold = slow_threshold
        self.log_level = log_level.lower()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并监控慢请求
        
        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP响应对象
        """
        # 跳过OPTIONS预检请求（CORS）
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # 获取请求ID
        request_id = getattr(request.state, "request_id", "unknown")
        
        # 记录请求开始时间
        start_time = time.time()
        
        # 调用下一个中间件或路由处理函数
        response = await call_next(request)
        
        # 计算请求处理时间
        process_time = time.time() - start_time
        
        # 检查是否为慢请求
        if process_time > self.slow_threshold:
            client_host = request.client.host if request.client else "unknown"
            method = request.method
            path = request.url.path
            
            # 根据日志级别记录慢请求
            log_message = (
                f"[{request_id}] 慢请求检测 | "
                f"处理时间: {process_time:.3f}秒 | "
                f"阈值: {self.slow_threshold}秒 | "
                f"客户端: {client_host} | "
                f"方法: {method} | "
                f"路径: {path}"
            )
            
            if self.log_level == "warning":
                logger.warning(log_message)
            elif self.log_level == "info":
                logger.info(log_message)
            else:
                logger.debug(log_message)
        
        return response


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """
    请求大小限制中间件
    
    功能：
    - 限制请求体大小
    - 防止大文件上传攻击
    - 支持不同路径设置不同的限制
    - 记录超过限制的请求
    
    使用场景：
    - 防止DoS攻击
    - 保护服务器资源
    - 控制上传文件大小
    """
    
    def __init__(
        self,
        app: ASGIApp,
        max_size: int = 10 * 1024 * 1024,  # 默认10MB
        path_sizes: dict = None,
        skip_paths: list = None
    ):
        """
        初始化请求大小限制中间件
        
        Args:
            app: ASGI应用实例
            max_size: 默认最大请求体大小（字节）
            path_sizes: 特定路径的大小限制（路径: 大小）
            skip_paths: 跳过大小检查的路径列表
        """
        super().__init__(app)
        self.max_size = max_size
        self.path_sizes = path_sizes or {}
        self.skip_paths = skip_paths or ["/health", "/metrics"]
    
    def get_max_size(self, path: str) -> int:
        """
        获取指定路径的最大请求体大小
        
        Args:
            path: 请求路径
            
        Returns:
            int: 最大请求体大小（字节）
        """
        # 检查是否在跳过列表中
        if path in self.skip_paths:
            return float('inf')
        
        # 检查是否有特定路径的大小限制
        for pattern, size in self.path_sizes.items():
            if path.startswith(pattern):
                return size
        
        # 返回默认大小限制
        return self.max_size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并检查请求体大小
        
        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP响应对象
            
        Raises:
            HTTPException: 请求体超过限制时抛出413 Payload Too Large错误
        """
        # 跳过OPTIONS预检请求（CORS）
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # 获取请求ID
        request_id = getattr(request.state, "request_id", "unknown")
        
        # 获取最大请求体大小
        max_size = self.get_max_size(request.url.path)
        
        # 如果大小限制为无限大，直接处理请求
        if max_size == float('inf'):
            return await call_next(request)
        
        # 检查请求体大小（仅针对POST、PUT、PATCH请求）
        if request.method in ["POST", "PUT", "PATCH"]:
            content_length = request.headers.get("content-length")
            
            if content_length:
                try:
                    content_size = int(content_length)
                    
                    # 检查是否超过限制
                    if content_size > max_size:
                        logger.warning(
                            f"[{request_id}] 请求体过大 | "
                            f"大小: {content_size}字节 | "
                            f"限制: {max_size}字节 | "
                            f"路径: {request.url.path}"
                        )
                        
                        raise HTTPException(
                            status_code=413,
                            detail=f"请求体过大，最大允许{max_size}字节"
                        )
                except ValueError:
                    logger.warning(
                        f"[{request_id}] 无效的Content-Length: {content_length}"
                    )
        
        # 调用下一个中间件或路由处理函数
        return await call_next(request)
