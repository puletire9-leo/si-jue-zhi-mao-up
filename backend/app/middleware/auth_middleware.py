"""
认证中间件

提供用户认证和授权功能，保护API端点
"""

from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, Set
import logging
import sys
from ..utils.jwt_utils import verify_token

logger = logging.getLogger(__name__)

# 简单的内存黑名单，用于测试
token_blacklist: Set[str] = set()

security = HTTPBearer()


class AuthMiddleware:
    """认证中间件类"""
    
    def __init__(self):
        self.token_cache = {}  # 简单的token缓存，生产环境应使用Redis
        self.token_cache_max_size = 1000  # 缓存最大大小
        self.token_cache_expiry = 3600  # 缓存过期时间（秒）
    
    def _update_cache(self, token: str, user_info: dict):
        """
        更新缓存
        
        Args:
            token: 要缓存的token
            user_info: 要缓存的用户信息
        """
        import datetime
        
        # 检查缓存大小
        if len(self.token_cache) >= self.token_cache_max_size:
            # 清理过期缓存
            self._clean_expired_cache()
            
            # 如果仍然超过限制，删除最旧的缓存
            if len(self.token_cache) >= self.token_cache_max_size:
                # 按时间排序，删除最旧的
                sorted_tokens = sorted(
                    self.token_cache.items(),
                    key=lambda x: x[1].get('expiry', 0) if isinstance(x[1], dict) else 0
                )
                for i in range(min(100, len(self.token_cache) - self.token_cache_max_size + 10)):
                    if sorted_tokens[i][0] in self.token_cache:
                        del self.token_cache[sorted_tokens[i][0]]
        from datetime import datetime, UTC
        
        # 计算过期时间
        expiry = datetime.now(UTC).timestamp() + self.token_cache_expiry
        
        # 更新缓存
        self.token_cache[token] = {
            'user_info': user_info,
            'expiry': expiry
        }
    
    def _clean_expired_cache(self):
        """
        清理过期的缓存项
        """
        from datetime import datetime, UTC
        
        now = datetime.now(UTC).timestamp()
        expired_tokens = []
        
        # 找出过期的缓存项
        for token, data in self.token_cache.items():
            if isinstance(data, dict) and 'expiry' in data:
                if data['expiry'] <= now:
                    expired_tokens.append(token)
        
        # 删除过期的缓存项
        for token in expired_tokens:
            if token in self.token_cache:
                del self.token_cache[token]
        
        # 清理完成后记录日志
        if expired_tokens:
            logger.info(f"清理了 {len(expired_tokens)} 个过期的token缓存项")
    
    async def verify_token(self, credentials: HTTPAuthorizationCredentials, request: Request) -> Dict[str, Any]:
        """
        验证token并返回用户信息

        Args:
            credentials: HTTP认证凭据
            request: FastAPI请求对象，用于获取应用状态中的数据库实例

        Returns:
            Dict: 用户信息

        Raises:
            HTTPException: token无效时抛出异常
        """
        import datetime

        token = credentials.credentials

        # 清理过期的缓存项
        self._clean_expired_cache()

        # 开发环境免认证：直接返回管理员用户
        from ..config import settings
        if settings.ENVIRONMENT == "development" or settings.DEBUG:
            logger.info("开发环境免认证")
            mysql_repo = request.app.state.mysql
            if mysql_repo:
                user = await mysql_repo.execute_query_one(
                    "SELECT id, username, email, role FROM users LIMIT 1"
                )
                if user:
                    return {
                        'id': user['id'],
                        'username': user['username'],
                        'email': user.get('email', ''),
                        'role': user.get('role', '管理员'),
                    }
            return {
                'id': 1,
                'username': 'admin',
                'email': 'admin@example.com',
                'role': '管理员',
            }

        # 特殊处理：允许使用"admin"作为token进行认证
        if token == "admin":
            logger.info("使用特殊token 'admin' 进行认证")
            # 从应用状态中获取MySQLRepository实例
            mysql_repo = request.app.state.mysql
            
            # 从数据库获取管理员用户信息
            user = await mysql_repo.execute_query_one(
                "SELECT id, username, email, role FROM users WHERE role IN ('admin', '管理员') LIMIT 1",
                ()
            )
            
            if not user:
                # 如果没有管理员用户，尝试获取第一个用户
                user = await mysql_repo.execute_query_one(
                    "SELECT id, username, email, role FROM users LIMIT 1",
                    ()
                )
                
                if not user:
                    raise HTTPException(status_code=401, detail="用户不存在")
            
            # 获取用户权限
            permissions = await mysql_repo.get_user_permissions(user['id'])
            permission_codes = [p['code'] for p in permissions]
            
            # 构建用户信息
            user_info = {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'permissions': permission_codes
            }
            
            # 更新缓存
            self._update_cache(token, user_info)
            
            logger.info(f"特殊token验证成功: {token} -> 用户: {user['username']}")
            return user_info
        
        # 验证token格式
        if not token or len(token) < 10:
            raise HTTPException(status_code=401, detail="无效的token")
        
        # 检查token是否在黑名单中
        is_blacklisted = token in token_blacklist
        logger.info(f'Token blacklist check for {token[:20]}...: {is_blacklisted}')
        logger.info(f'Current blacklist size: {len(token_blacklist)}')
        logger.info(f'Token in blacklist set: {is_blacklisted}')
        
        if is_blacklisted:
            # 如果token在黑名单中，从缓存中删除
            if token in self.token_cache:
                logger.info(f'Removing token from cache: {token[:20]}...')
                del self.token_cache[token]
            logger.info(f'Token {token[:20]}... is blacklisted, raising 401')
            raise HTTPException(status_code=401, detail="token已被注销")
        
        # 暂时禁用缓存，直接验证token
        logger.info(f'Token {token[:20]}... not in blacklist, proceeding with verification')
        
        # 使用JWT验证token
        try:
            # 验证JWT token
            payload = verify_token(token)
            
            if not payload:
                raise HTTPException(status_code=401, detail="无效的token")
            
            # 从payload中获取用户信息
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(status_code=401, detail="无效的token")
            
            # 从应用状态中获取MySQLRepository实例
            mysql_repo = request.app.state.mysql
            
            # 从数据库获取用户信息
            user = await mysql_repo.execute_query_one(
                "SELECT id, username, email, role FROM users WHERE id = %s",
                (user_id,)
            )
            
            if not user:
                raise HTTPException(status_code=401, detail="用户不存在")
            
            # 获取用户权限
            permissions = await mysql_repo.get_user_permissions(user['id'])
            permission_codes = [p['code'] for p in permissions]
            
            # 构建用户信息
            user_info = {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'permissions': permission_codes
            }
            
            # 更新缓存
            self._update_cache(token, user_info)
            
            logger.info(f"Token验证成功: {token} -> 用户: {user['username']}")
            return user_info
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"验证token失败: {e}")
            raise HTTPException(status_code=401, detail="token验证失败")
    
    async def require_auth(self, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
        """
        要求认证的依赖函数
        
        Args:
            request: FastAPI请求对象
            credentials: HTTP认证凭据
            
        Returns:
            Dict: 用户信息
        """
        return await self.verify_token(credentials, request)
    
    def require_permission(self, permission: str):
        """
        要求特定权限的依赖函数

        Args:
            permission: 需要的权限

        Returns:
            Callable: 依赖函数
        """
        async def permission_dependency(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
            user_info = await self.verify_token(credentials, request)

            # 管理员拥有所有权限
            if user_info.get("role") in ["管理员", "admin"]:
                return user_info

            # 开发角色拥有大部分权限
            if user_info.get("role") == "开发":
                return user_info

            # 检查用户是否有该权限
            user_permissions = user_info.get("permissions", [])
            if permission in user_permissions:
                return user_info

            # 美术和仓库角色拥有基础权限
            if user_info.get("role") in ["美术", "仓库"]:
                return user_info

            # 默认拒绝访问
            raise HTTPException(status_code=403, detail=f"缺少权限: {permission}")

        return permission_dependency
    
    def require_admin(self):
        """
        要求管理员权限的依赖函数
        
        Returns:
            Callable: 依赖函数
        """
        async def admin_dependency(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
            user_info = await self.verify_token(credentials, request)
            
            # 只有管理员角色可以访问
            if user_info.get("role") not in ["管理员", "admin"]:
                raise HTTPException(status_code=403, detail="只有管理员可以执行此操作")
            
            return user_info
        
        return admin_dependency
    
    def require_role(self, role: str):
        """
        要求特定角色的依赖函数
        
        Args:
            role: 需要的角色
            
        Returns:
            Callable: 依赖函数
        """
        async def role_dependency(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
            user_info = await self.verify_token(credentials, request)
            
            # 从数据库获取角色层级
            mysql_repo = request.app.state.mysql
            role_info = await mysql_repo.get_role_by_name(user_info['role'])
            
            if not role_info:
                raise HTTPException(status_code=403, detail="角色不存在")
            
            # 获取角色层级
            hierarchy = await mysql_repo.get_role_hierarchy(role_info['id'])
            role_names = [r['name'] for r in hierarchy]
            
            if role not in role_names:
                raise HTTPException(status_code=403, detail="角色不足")
            
            return user_info
        
        return role_dependency


# 创建全局认证中间件实例
auth_middleware = AuthMiddleware()


# 依赖函数
def get_current_user():
    """获取当前用户依赖函数"""
    return auth_middleware.require_auth


def require_product_delete():
    """要求产品删除权限依赖函数"""
    return auth_middleware.require_permission("product:delete")

def require_config_read():
    """要求配置读取权限依赖函数"""
    return auth_middleware.require_permission("system.settings")


def require_config_write():
    """要求配置写入权限依赖函数"""
    return auth_middleware.require_permission("system.settings")

def require_admin_role():
    """要求管理员角色依赖函数"""
    return auth_middleware.require_role("admin")