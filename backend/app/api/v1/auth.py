"""
[参考] 认证API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: RecycleBinController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging

from ...repositories import MySQLRepository
from ...utils.jwt_utils import decode_token

logger = logging.getLogger(__name__)

# 简单的token存储，生产环境应使用Redis
token_store: Dict[str, Dict[str, Any]] = {}

router = APIRouter(prefix="/auth", tags=["认证"])


class LoginRequest(BaseModel):
    """登录请求模型"""
    username: str
    password: str


def get_mysql_repo():
    """
    依赖注入：获取MySQL仓库实例
    
    Returns:
        MySQLRepository实例
    """
    from fastapi import Request
    
    def _get_repo(request: Request):
        return request.app.state.mysql
    
    return Depends(_get_repo)


@router.post("/login", summary="用户登录")
async def login(request: Request, login_data: LoginRequest):
    """已迁移到Java后端"""
    raise HTTPException(status_code=501, detail="已迁移到Java后端")


class RegisterRequest(BaseModel):
    """注册请求模型"""
    username: str
    password: str
    email: Optional[str] = None
    role: Optional[str] = None


@router.post("/register", summary="用户注册")
async def register(request: Request, register_data: RegisterRequest):
    """已迁移到Java后端"""
    raise HTTPException(status_code=501, detail="已迁移到Java后端")


@router.post("/logout", summary="用户登出")
async def logout(request: Request):
    """
    用户登出
    
    清除客户端的token并将token添加到黑名单
    """
    try:
        # 从请求头获取token
        token = request.headers.get("Authorization")
        
        logger.info(f'Logout request received with Authorization header: {token}')
        
        if token and token.startswith("Bearer "):
            token = token[7:]

            # Gateway 负责 token 验证，Python 侧无需维护黑名单
            # 客户端已清除 localStorage 中的 token
        else:
            logger.warning("No token found in Authorization header")
        
        return {
            "code": 200,
            "message": "登出成功",
            "data": None
        }
        
    except Exception as e:
        logger.error(f"登出失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="登出失败")


class RefreshTokenRequest(BaseModel):
    """刷新token请求模型"""
    refresh_token: str


@router.post("/refresh", summary="刷新访问令牌")
async def refresh_token_endpoint(request: Request, refresh_data: RefreshTokenRequest):
    """已迁移到Java后端"""
    raise HTTPException(status_code=501, detail="已迁移到Java后端")


@router.get("/me", summary="获取当前用户信息")
async def get_current_user(
    request: Request,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取当前登录用户的信息
    
    需要在请求头中携带token
    """
    import time
    start_time = time.time()
    
    try:
        # 从请求头获取token
        token = request.headers.get("Authorization")
        
        if not token:
            raise HTTPException(status_code=401, detail="未授权")
        
        # 移除"Bearer "前缀
        if token.startswith("Bearer "):
            token = token[7:]
        
        # 使用JWT解析token
        payload = decode_token(token)

        if not payload:
            logger.warning("无效的token")
            raise HTTPException(status_code=401, detail="无效的token")

        # 从payload中获取用户信息
        user_id = payload.get("sub")

        # 从数据库获取完整的用户信息
        user = await repo.execute_query_one(
            "SELECT id, username, email, role, developer FROM users WHERE id = %s",
            (user_id,)
        )

        if not user:
            logger.warning(f"用户不存在: {user_id}")
            raise HTTPException(status_code=401, detail="用户不存在")

        # 获取用户权限
        permissions = await repo.get_user_permissions(user['id'])
        permission_codes = [p['code'] for p in permissions]
        
        # 计算执行时间
        execution_time = (time.time() - start_time) * 1000
        
        # 记录执行时间，超过1000ms的请求会被警告
        if execution_time > 1000:
            logger.warning(f"/auth/me 执行时间较长: {execution_time:.2f}ms, 用户ID: {user['id']}")
        elif execution_time > 200:
            logger.info(f"/auth/me 执行时间: {execution_time:.2f}ms, 用户ID: {user['id']}")
        
        # 返回完整的用户信息
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role'],
                "developer": user.get('developer'),
                "permissions": permission_codes
            },
            "meta": {
                "execution_time": f"{execution_time:.2f}ms"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        logger.error(f"获取用户信息失败: {e}, 执行时间: {execution_time:.2f}ms")
        raise HTTPException(status_code=500, detail="获取用户信息失败")
