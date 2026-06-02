"""
认证中间件（简化版）

优先从 Gateway 注入的 X-User-* 头读取用户信息。
无 Gateway 头时，兜底从 Authorization 头解析 JWT。
"""

from fastapi import HTTPException, Request
from typing import Dict, Any


async def require_auth(request: Request) -> Dict[str, Any]:
    """从 Gateway 头或 Authorization 头获取用户信息"""
    # 优先：Gateway 注入的 X-User-* 头
    user_id = request.headers.get("X-User-Id")
    username = request.headers.get("X-Username")
    role = request.headers.get("X-User-Role")
    if user_id:
        return {"id": user_id, "username": username, "role": role}

    # 兜底：从 Authorization 头解析 JWT（请求绕过 Gateway 时）
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        from ..utils.jwt_utils import decode_token
        payload = decode_token(token)
        if payload:
            return {
                "id": payload.get("sub") or payload.get("userId", ""),
                "username": payload.get("username", ""),
                "role": payload.get("role", ""),
            }

    raise HTTPException(status_code=401, detail="未登录")


def is_admin(user: dict) -> bool:
    """判断是否管理员（仅用于业务逻辑，不做权限拦截）"""
    return user.get("role") in ("管理员", "admin")
