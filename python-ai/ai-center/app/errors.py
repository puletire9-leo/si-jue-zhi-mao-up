"""统一异常体系：将上游/内部错误映射为稳定的 HTTP 语义。

对外错误响应结构（OpenAI 风格，便于 SDK 直接解析）：
    {"error": {"message": ..., "type": ..., "code": ...}}
"""

from __future__ import annotations

from typing import Any


class AICenterError(Exception):
    """所有中心错误的基类。

    status_code: 对外 HTTP 状态码
    error_type:  OpenAI 风格 error.type
    """

    status_code: int = 500
    error_type: str = "internal_error"

    def __init__(self, message: str, *, code: str | None = None, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.headers = headers or {}

    def to_payload(self) -> dict[str, Any]:
        return {
            "error": {
                "message": self.message,
                "type": self.error_type,
                "code": self.code,
            }
        }


class AuthenticationError(AICenterError):
    status_code = 401
    error_type = "authentication_error"


class InvalidRequestError(AICenterError):
    status_code = 400
    error_type = "invalid_request_error"


class ModelNotAllowedError(InvalidRequestError):
    error_type = "invalid_request_error"


class UpstreamRateLimitError(AICenterError):
    status_code = 429
    error_type = "rate_limit_error"


class UpstreamError(AICenterError):
    status_code = 502
    error_type = "upstream_error"


class UpstreamTimeoutError(AICenterError):
    status_code = 504
    error_type = "timeout_error"


def classify_upstream_exception(exc: Exception) -> AICenterError:
    """把 openai SDK / httpx 抛出的异常归类为稳定的中心错误。

    不泄露上游密钥或原始堆栈，只保留可安全对外的信息。
    """
    # openai SDK 异常（延迟导入，避免在无 SDK 环境下 import 失败）
    try:
        from openai import (
            APIConnectionError,
            APITimeoutError,
            AuthenticationError as OpenAIAuthError,
            BadRequestError,
            RateLimitError,
        )
        from openai import APIStatusError
    except Exception:  # pragma: no cover - SDK 缺失时的兜底
        return UpstreamError("Upstream call failed")

    if isinstance(exc, APITimeoutError):
        return UpstreamTimeoutError("Upstream request timed out")
    if isinstance(exc, APIConnectionError):
        return UpstreamError("Failed to connect to upstream provider")
    if isinstance(exc, RateLimitError):
        headers = _retry_after_headers(exc)
        return UpstreamRateLimitError("Upstream rate limit exceeded", headers=headers)
    if isinstance(exc, OpenAIAuthError):
        # 上游密钥问题属于中心配置错误，不能把 401 直接透给调用方（会误导其怀疑自己的 key）
        return UpstreamError("Upstream authentication failed (check center DEEPSEEK_API_KEY)")
    if isinstance(exc, BadRequestError):
        msg = _safe_message(exc) or "Upstream rejected the request"
        return InvalidRequestError(msg)
    if isinstance(exc, APIStatusError):
        status = getattr(exc, "status_code", 502) or 502
        if status == 429:
            return UpstreamRateLimitError("Upstream rate limit exceeded", headers=_retry_after_headers(exc))
        return UpstreamError(f"Upstream returned status {status}")
    return UpstreamError("Upstream call failed")


def _safe_message(exc: Exception) -> str | None:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and isinstance(err.get("message"), str):
            return err["message"]
        if isinstance(err, str):
            return err
    return None


def _retry_after_headers(exc: Exception) -> dict[str, str]:
    resp = getattr(exc, "response", None)
    headers = getattr(resp, "headers", None)
    if headers:
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        if retry_after:
            return {"Retry-After": str(retry_after)}
    return {}
