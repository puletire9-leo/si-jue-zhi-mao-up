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
from datetime import datetime
import hashlib
import secrets
import bcrypt

from ...repositories import MySQLRepository
from ...utils.jwt_utils import create_access_token, create_refresh_token, verify_token

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
async def login(
    request: Request,
    login_data: LoginRequest,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    用户登录
    
    - **username**: 用户名
    - **password**: 密码
    
    返回登录成功后的用户信息和token
    """
    start_time = datetime.now()
    logger.info(f"[{start_time.strftime('%H:%M:%S.%f')}] >>> 登录流程开始: {login_data.username}")
    try:
        # 查询用户
        query_start = datetime.now()
        users = await repo.execute_query(
            """
            SELECT id, username, email, password, role, created_at
            FROM users
            WHERE username = %s
            """,
            (login_data.username,)
        )
        query_end = datetime.now()
        logger.info(f"[{query_end.strftime('%H:%M:%S.%f')}] 数据库查询耗时: {(query_end - query_start).total_seconds():.4f}s")
        
        if not users:
            logger.warning(f"用户不存在: {login_data.username}")
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        
        user = users[0]
        
        # 密码验证
        bcrypt_start = datetime.now()
        try:
            if user['password'].startswith('$2'):
                password_match = bcrypt.checkpw(login_data.password.encode(), user['password'].encode())
            else:
                md5_hash = hashlib.md5(login_data.password.encode()).hexdigest()
                md5_match = (md5_hash == user['password'])
                plaintext_match = (login_data.password == user['password'])
                password_match = md5_match or plaintext_match
                
                if password_match:
                    logger.info("验证成功，自动升级密码哈希为 bcrypt")
                    hashed_password = bcrypt.hashpw(login_data.password.encode(), bcrypt.gensalt(12)).decode()
                    await repo.execute_query("UPDATE users SET password = %s WHERE id = %s", (hashed_password, user['id']))
        except Exception as e:
            logger.error(f"密码验证逻辑异常: {e}")
            raise HTTPException(status_code=500, detail="密码验证失败")
        finally:
            bcrypt_end = datetime.now()
            logger.info(f"[{bcrypt_end.strftime('%H:%M:%S.%f')}] 密码验证耗时: {(bcrypt_end - bcrypt_start).total_seconds():.4f}s")
        
        if not password_match:
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        
        # Token 生成
        token_start = datetime.now()
        access_token = create_access_token(data={"sub": str(user['id']), "username": user['username'], "role": user['role']})
        refresh_token = create_refresh_token(data={"sub": str(user['id'])})
        token_end = datetime.now()
        logger.info(f"[{token_end.strftime('%H:%M:%S.%f')}] JWT Token 生成耗时: {(token_end - token_start).total_seconds():.4f}s")
        
        total_duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"[{datetime.now().strftime('%H:%M:%S.%f')}] <<< 登录流程完成，总耗时: {total_duration:.4f}s")
        
        # 返回用户信息和token
        return {
            "code": 200,
            "message": "登录成功",
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": 604800,  # 7天 = 7*24*60*60 = 604800秒
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "email": user['email'],
                    "role": user['role'],
                    "developer": user.get('developer')
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登录失败: {e}")
        raise HTTPException(status_code=500, detail="登录失败")


class RegisterRequest(BaseModel):
    """注册请求模型"""
    username: str
    password: str
    email: Optional[str] = None
    role: Optional[str] = None


@router.post("/register", summary="用户注册")
async def register(
    request: Request,
    register_data: RegisterRequest,
    repo: MySQLRepository = get_mysql_repo()
):
    """用户注册"""
    logger.info(f">>> 注册请求: {register_data.username}")
    try:
        if len(register_data.username) < 3:
            logger.warning(f"注册失败: 用户名过短 ({register_data.username})")
            raise HTTPException(status_code=400, detail="用户名至少3个字符")
        if len(register_data.password) < 6:
            raise HTTPException(status_code=400, detail="密码至少6个字符")

        existing = await repo.execute_query(
            "SELECT id FROM users WHERE username = %s",
            (register_data.username,)
        )
        if existing:
            logger.warning(f"注册失败: 用户名已存在 ({register_data.username})")
            raise HTTPException(status_code=400, detail="用户名已存在")

        hashed = bcrypt.hashpw(register_data.password.encode(), bcrypt.gensalt(12)).decode()

        email = register_data.email or f"{register_data.username}@example.com"
        role = register_data.role or 'user'
        await repo.execute_update(
            """INSERT INTO users (username, password, email, role, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 1, NOW(), NOW())""",
            (register_data.username, hashed, email, role)
        )

        new_user = await repo.execute_query(
            "SELECT id, username, email, role FROM users WHERE username = %s",
            (register_data.username,)
        )
        user = new_user[0]

        access_token = create_access_token(data={"sub": str(user['id']), "username": user['username'], "role": user['role']})
        refresh_token = create_refresh_token(data={"sub": str(user['id'])})

        logger.info(f"<<< 注册成功: {register_data.username} (ID={user['id']})")

        return {
            "code": 200,
            "message": "注册成功",
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": 604800,
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "email": user['email'],
                    "role": user['role']
                }
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"注册失败: {e}")
        raise HTTPException(status_code=500, detail="注册失败")


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
            logger.info(f'Extracted token: {token[:20]}...')
            
            # 直接导入认证中间件中的token_blacklist
            import sys
            sys.path.insert(0, '/')
            from backend.app.middleware.auth_middleware import token_blacklist
            
            logger.info(f'Using token_blacklist from auth_middleware: {id(token_blacklist)}')
            logger.info(f'Current blacklist size before adding: {len(token_blacklist)}')
            
            # 添加到黑名单
            token_blacklist.add(token)
            logger.info(f'Token manually added to auth_middleware blacklist')
            
            logger.info(f'Current blacklist size after adding: {len(token_blacklist)}')
            logger.info(f'Token in blacklist: {token in token_blacklist}')
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
async def refresh_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    刷新访问令牌
    
    - **refresh_token**: 刷新令牌
    
    返回新的访问令牌
    """
    try:
        logger.info(f"刷新token请求")
        
        # 验证刷新令牌
        payload = verify_token(refresh_data.refresh_token)
        
        if not payload:
            logger.warning(f"无效的refresh token")
            raise HTTPException(status_code=401, detail="无效的刷新令牌")
        
        # 检查是否为刷新令牌
        if payload.get("type") != "refresh":
            logger.warning(f"无效的refresh token类型")
            raise HTTPException(status_code=401, detail="无效的刷新令牌类型")
        
        # 从payload中获取用户信息
        user_id = payload.get("sub")
        logger.info(f"刷新token验证成功 -> 用户ID: {user_id}")
        
        # 从数据库获取用户信息
        user = await repo.execute_query_one(
            "SELECT id, username, email, role FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not user:
            logger.warning(f"用户不存在: {user_id}")
            raise HTTPException(status_code=401, detail="用户不存在")
        
        # 生成新的访问令牌
        access_token = create_access_token(data={"sub": str(user['id']), "username": user['username'], "role": user['role']})
        
        # 生成新的刷新令牌
        refresh_token = create_refresh_token(data={"sub": str(user['id'])})
        
        logger.info(f"Token刷新成功: 用户ID = {user['id']}, 用户名 = {user['username']}")
        
        # 返回新的令牌
        return {
            "code": 200,
            "message": "令牌刷新成功",
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": 604800,  # 7天 = 7*24*60*60 = 604800秒
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "email": user['email'],
                    "role": user['role'],
                    "developer": user.get('developer')
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"刷新令牌失败: {e}")
        raise HTTPException(status_code=500, detail="刷新令牌失败")


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
        
        # 特殊处理：允许使用"admin"作为token进行认证
        if token == "admin":
            logger.info("使用特殊token 'admin' 进行认证")
            
            # 从数据库获取管理员用户信息
            user = await repo.execute_query_one(
                "SELECT id, username, email, role, developer FROM users WHERE role IN ('admin', '管理员') LIMIT 1",
                ()
            )
            
            if not user:
                # 如果没有管理员用户，尝试获取第一个用户
                user = await repo.execute_query_one(
                    "SELECT id, username, email, role FROM users LIMIT 1",
                    ()
                )
                
                if not user:
                    raise HTTPException(status_code=401, detail="用户不存在")
        else:
            # 使用JWT验证token
            payload = verify_token(token)
            
            if not payload:
                logger.warning(f"无效的token: {token}")
                raise HTTPException(status_code=401, detail="无效的token")
            
            # 从payload中获取用户信息
            user_id = payload.get("sub")
            logger.info(f"Token验证成功: {token} -> 用户ID: {user_id}")
            
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
