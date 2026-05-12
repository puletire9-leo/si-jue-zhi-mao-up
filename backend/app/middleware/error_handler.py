"""
错误处理中间件

提供统一的错误处理和异常捕获机制
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback
from typing import Dict, Any
import anyio

logger = logging.getLogger(__name__)


class ErrorHandler:
    """错误处理类"""
    
    def __init__(self):
        pass
    
    async def handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """
        统一异常处理
        
        Args:
            request: 请求对象
            exc: 异常对象
            
        Returns:
            JSONResponse: 错误响应
        """
        # 记录错误日志
        logger.error(f"请求处理异常: {request.method} {request.url}")
        logger.error(f"异常类型: {type(exc).__name__}")
        logger.error(f"异常信息: {str(exc)}")
        logger.error(f"堆栈跟踪:\n{traceback.format_exc()}")
        
        # 根据异常类型返回不同的错误码和消息
        if isinstance(exc, HTTPException):
            status_code = exc.status_code
            if status_code == 405:
                detail = "请求方法不允许，检查URL格式是否正确（有无斜杠）"
            else:
                detail = exc.detail
        elif isinstance(exc, StarletteHTTPException):
            status_code = exc.status_code
            if status_code == 405:
                detail = "请求方法不允许，检查URL格式是否正确（有无斜杠）"
            else:
                detail = exc.detail
        elif isinstance(exc, RequestValidationError):
            status_code = 422
            detail = "请求参数验证失败"
        elif isinstance(exc, anyio.EndOfStream):
            status_code = 499
            detail = "客户端连接已关闭（流结束）"
        else:
            status_code = 500
            detail = "服务器内部错误"
        
        # 构建错误响应
        error_response = {
            "code": status_code,
            "message": detail,
            "data": None,
            "timestamp": self._get_timestamp()
        }
        
        # 开发环境返回详细错误信息
        import os
        if os.getenv('DEBUG', 'False').lower() == 'true':
            error_response["debug"] = {
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "stack_trace": traceback.format_exc()
            }
        
        return JSONResponse(
            status_code=status_code,
            content=error_response
        )
    
    def _get_timestamp(self) -> str:
        """获取当前时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()


# 创建全局错误处理器实例
error_handler = ErrorHandler()


# 错误处理函数
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """全局异常处理器"""
    return await error_handler.handle_exception(request, exc)