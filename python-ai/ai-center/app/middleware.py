"""请求上下文中间件：贯通 X-Request-Id。

规则（对齐 Java 网关行为）：优先保留调用方传入的 X-Request-Id，缺失才生成，
并在响应头回传，方便跨服务链路追踪。
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-Id"
SERVICE_NAME_HEADER = "X-Service-Name"

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
_service_name_ctx: ContextVar[str] = ContextVar("service_name", default="")


def current_request_id() -> str:
    return _request_id_ctx.get()


def current_service_name() -> str:
    return _service_name_ctx.get()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        service_name = request.headers.get(SERVICE_NAME_HEADER) or "unknown"
        token_rid = _request_id_ctx.set(request_id)
        token_svc = _service_name_ctx.set(service_name)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token_rid)
            _service_name_ctx.reset(token_svc)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
