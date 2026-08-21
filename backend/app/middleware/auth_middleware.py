"""
认证中间件（简化版）

优先从 Gateway 注入的 X-User-* 头读取用户信息。
无 Gateway 头时，兜底从 Authorization 头解析 JWT。
"""

from fastapi import HTTPException, Request, Depends
from typing import Dict, Any


ROLE_ALIASES = {
    "admin": "admin",
    "manager": "admin",
    "管理员": "admin",
    "developer": "developer",
    "开发": "developer",
}


def normalize_roles(role: Any) -> set[str]:
    """将数据库中文角色、JWT 英文角色和平台枚举归一为内部角色。"""
    if role is None:
        return set()

    normalized_roles: set[str] = set()
    for raw_role in str(role).split(","):
        role_name = raw_role.strip()
        if not role_name:
            continue
        normalized_roles.add(ROLE_ALIASES.get(role_name.lower(), role_name.lower()))
    return normalized_roles


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
    """判断是否管理员（兼容多角色逗号分隔）"""
    return "admin" in normalize_roles(user.get("role"))


async def require_write_role(request: Request, user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    """
    要求当前用户具有写权限（管理员或开发角色，兼容多角色逗号分隔）。
    GET/HEAD/OPTIONS 等只读方法放行，仅拦截 POST/PUT/DELETE 写操作。
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return user
    role = user.get("role", "")
    if normalize_roles(role) & {"admin", "developer"}:
        return user
    raise HTTPException(status_code=403, detail=f"角色 '{role}' 没有写操作权限")
