"""内部鉴权依赖：校验调用方 Bearer token（AI_CENTER_INTERNAL_KEY）。

安全约定：
- 与上游 DeepSeek 密钥完全隔离，调用方永远拿不到上游密钥
- 使用常量时间比较防时序侧信道
- 未配置 internal_key 时，拒绝所有业务请求（fail-closed）
"""

from __future__ import annotations

import hmac

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.errors import AuthenticationError


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if not header.startswith(prefix):
        return ""
    return header[len(prefix):].strip()


def require_internal_auth(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> None:
    expected = settings.internal_key
    if not expected:
        # fail-closed：中心未配置内部密钥时不放行任何请求
        raise AuthenticationError("AI center internal key is not configured")

    presented = _extract_bearer(request)
    if not presented or not hmac.compare_digest(presented, expected):
        raise AuthenticationError("Invalid or missing internal API key")
