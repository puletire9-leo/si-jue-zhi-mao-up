import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    请求日志记录中间件
    
    功能：
    - 记录每个HTTP请求的详细信息
    - 记录请求处理时间
    - 生成唯一的请求ID用于追踪
    - 记录请求和响应的状态
    
    使用场景：
    - 调试和问题排查
    - 性能监控
    - 安全审计
    - 用户行为分析
    """
    
    def __init__(self, app: ASGIApp, skip_paths: list = None):
        """
        初始化日志中间件
        
        Args:
            app: ASGI应用实例
            skip_paths: 跳过日志记录的路径列表（如健康检查端点）
        """
        super().__init__(app)
        self.skip_paths = skip_paths or ["/health", "/metrics"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并记录日志
        
        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP响应对象
        """
        # 跳过指定路径的日志记录
        if request.url.path in self.skip_paths:
            return await call_next(request)
        
        # 跳过OPTIONS预检请求（CORS）
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # 生成唯一的请求ID
        request_id = str(uuid.uuid4())
        
        # 记录请求开始时间
        start_time = time.time()
        
        # 提取请求信息
        client_host = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path
        query_params = str(request.query_params) if request.query_params else ""
        user_agent = request.headers.get("user-agent", "unknown")
        
        # 记录请求信息
        logger.info(
            f"[{request_id}] 请求开始 | "
            f"客户端: {client_host} | "
            f"方法: {method} | "
            f"路径: {path} | "
            f"查询参数: {query_params} | "
            f"User-Agent: {user_agent}"
        )
        
        # 将请求ID添加到请求状态中，供后续中间件使用
        request.state.request_id = request_id
        
        try:
            # 调用下一个中间件或路由处理函数
            response = await call_next(request)
            
            # 计算请求处理时间
            process_time = time.time() - start_time
            
            # 记录响应信息
            logger.info(
                f"[{request_id}] 请求完成 | "
                f"状态码: {response.status_code} | "
                f"处理时间: {process_time:.3f}秒 | "
                f"方法: {method} | "
                f"路径: {path}"
            )
            
            # 将请求ID和处理时间添加到响应头中
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.3f}"
            
            return response
            
        except Exception as e:
            # 计算请求处理时间
            process_time = time.time() - start_time
            
            # 记录错误信息
            logger.error(
                f"[{request_id}] 请求异常 | "
                f"错误: {str(e)} | "
                f"处理时间: {process_time:.3f}秒 | "
                f"方法: {method} | "
                f"路径: {path}",
                exc_info=True
            )
            
            # 重新抛出异常，让异常处理器处理
            raise


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    请求体日志记录中间件（仅用于调试）
    
    功能：
    - 记录请求体内容
    - 记录响应体内容
    - 仅在开发环境使用
    
    警告：
    - 不要在生产环境使用
    - 可能会记录敏感信息
    - 可能会影响性能
    """
    
    def __init__(self, app: ASGIApp, enabled: bool = False):
        """
        初始化请求体日志中间件
        
        Args:
            app: ASGI应用实例
            enabled: 是否启用（默认为False）
        """
        super().__init__(app)
        self.enabled = enabled
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并记录请求体和响应体
        
        Args:
            request: HTTP请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP响应对象
        """
        if not self.enabled:
            return await call_next(request)
        
        request_id = getattr(request.state, "request_id", "unknown")
        
        # 记录请求体（仅针对非GET请求）
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if body:
                    logger.debug(f"[{request_id}] 请求体: {body.decode('utf-8', errors='ignore')}")
            except Exception as e:
                logger.warning(f"[{request_id}] 无法读取请求体: {str(e)}")
        
        # 调用下一个中间件或路由处理函数
        response = await call_next(request)
        
        # 记录响应体（仅针对错误响应）
        if response.status_code >= 400:
            try:
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk
                
                logger.debug(
                    f"[{request_id}] 响应体: "
                    f"{response_body.decode('utf-8', errors='ignore')}"
                )
                
                # 重新构建响应
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )
            except Exception as e:
                logger.warning(f"[{request_id}] 无法读取响应体: {str(e)}")
        
        return response
