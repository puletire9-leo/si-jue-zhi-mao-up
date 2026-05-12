"""
错误处理中间件

提供全局错误捕获和统一响应格式
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ErrorMiddleware:
    """错误处理中间件类"""
    
    def __init__(self, app: FastAPI):
        """
        初始化错误处理中间件
        
        Args:
            app: FastAPI应用实例
        """
        self.app = app
        self.setup_exception_handlers()
    
    def setup_exception_handlers(self):
        """
        设置异常处理器
        """
        # 处理HTTP异常
        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(request: Request, exc: HTTPException):
            return await self.handle_http_exception(request, exc)
        
        # 处理Starlette HTTP异常
        @self.app.exception_handler(StarletteHTTPException)
        async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
            return await self.handle_http_exception(request, exc)
        
        # 处理请求验证错误
        @self.app.exception_handler(RequestValidationError)
        async def validation_exception_handler(request: Request, exc: RequestValidationError):
            return await self.handle_validation_error(request, exc)
        
        # 处理通用异常
        @self.app.exception_handler(Exception)
        async def general_exception_handler(request: Request, exc: Exception):
            return await self.handle_general_exception(request, exc)
    
    async def handle_http_exception(self, request: Request, exc: HTTPException) -> JSONResponse:
        """
        处理HTTP异常
        
        Args:
            request: FastAPI请求对象
            exc: HTTP异常
            
        Returns:
            JSONResponse: 统一格式的错误响应
        """
        error_detail = getattr(exc, "detail", "请求失败")
        
        # 构建错误响应
        error_response = {
            "code": exc.status_code,
            "message": str(error_detail),
            "data": None,
            "error": {
                "type": "HTTPException",
                "status_code": exc.status_code,
                "detail": error_detail
            }
        }
        
        # 记录错误日志
        logger.warning(f"HTTP错误: {exc.status_code} - {error_detail}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response
        )
    
    async def handle_validation_error(self, request: Request, exc: RequestValidationError) -> JSONResponse:
        """
        处理请求验证错误
        
        Args:
            request: FastAPI请求对象
            exc: 请求验证错误
            
        Returns:
            JSONResponse: 统一格式的错误响应
        """
        # 构建详细的验证错误信息
        validation_errors = []
        for error in exc.errors():
            validation_errors.append({
                "loc": error["loc"],
                "msg": error["msg"],
                "type": error["type"]
            })
        
        # 构建错误响应
        error_response = {
            "code": 422,
            "message": "请求参数验证失败",
            "data": None,
            "error": {
                "type": "ValidationError",
                "status_code": 422,
                "detail": "请求参数验证失败",
                "errors": validation_errors
            }
        }
        
        # 记录错误日志
        logger.warning(f"验证错误: {validation_errors}")
        
        return JSONResponse(
            status_code=422,
            content=error_response
        )
    
    async def handle_general_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """
        处理通用异常
        
        Args:
            request: FastAPI请求对象
            exc: 通用异常
            
        Returns:
            JSONResponse: 统一格式的错误响应
        """
        # 构建错误响应
        error_response = {
            "code": 500,
            "message": "服务器内部错误",
            "data": None,
            "error": {
                "type": "InternalServerError",
                "status_code": 500,
                "detail": "服务器内部错误"
            }
        }
        
        # 记录详细错误日志
        error_traceback = traceback.format_exc()
        logger.error(f"内部错误: {str(exc)}\n{error_traceback}")
        
        return JSONResponse(
            status_code=500,
            content=error_response
        )


def setup_error_middleware(app: FastAPI):
    """
    设置错误处理中间件
    
    Args:
        app: FastAPI应用实例
    """
    ErrorMiddleware(app)
    logger.info("错误处理中间件已初始化")
