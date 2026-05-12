"""
[参考] 用户管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: UserController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, Body
from typing import Optional, List, Dict, Any
import logging
import hashlib

from ...repositories import MySQLRepository
from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["用户管理"])


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


@router.get("", summary="获取用户列表")
async def get_users_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取用户列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大100）
    
    返回用户列表和分页信息
    """
    try:
        offset = (page - 1) * size
        
        users = await repo.execute_query(
            """
            SELECT 
                id, username, email, role, developer, created_at, last_login_time
            FROM users
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            (size, offset)
        )
        
        total_result = await repo.execute_query("SELECT COUNT(*) as count FROM users")
        total = total_result[0]['count'] if total_result else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": users,
                "total": total,
                "page": page,
                "size": size
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"获取用户列表失败: {error_msg}")
        logger.error(f"SQL查询: SELECT id, username, email, role, developer, created_at, last_login_time FROM users ORDER BY created_at DESC LIMIT {size} OFFSET {offset}")
        raise HTTPException(status_code=500, detail=f"获取用户列表失败: {error_msg}")


@router.get("/{user_id}", summary="获取用户详情")
async def get_user(
    user_id: int,
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取用户详情
    
    - **user_id**: 用户ID
    
    返回用户详细信息
    """
    try:
        users = await repo.execute_query(
            "SELECT id, username, email, role, developer, created_at, last_login_time FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not users:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": users[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"获取用户详情失败: {error_msg}")
        logger.error(f"SQL查询: SELECT id, username, email, role, developer, created_at, last_login_time FROM users WHERE id = {user_id}")
        raise HTTPException(status_code=500, detail=f"获取用户详情失败: {error_msg}")


@router.post("", summary="创建用户")
async def create_user(
    user: dict,
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    创建新用户
    
    - **username**: 用户名（必需）
    - **password**: 密码（必需）
    - **role**: 角色（可选，默认：user）
    
    返回创建的用户信息
    """
    try:
        username = user.get('username')
        password = user.get('password')
        role = user.get('role', 'user')
        developer = user.get('developer')
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="用户名和密码不能为空")
        
        # 对密码进行MD5哈希处理
        password_hash = hashlib.md5(password.encode()).hexdigest()
        
        await repo.execute_update(
            """
            INSERT INTO users (username, password, role, developer)
            VALUES (%s, %s, %s, %s)
            """,
            (username, password_hash, role, developer)
        )
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        
        if "Duplicate entry" in error_msg and "username" in error_msg:
            logger.error(f"创建用户失败: 用户名已存在 | {e}")
            raise HTTPException(status_code=400, detail="用户名已存在，请使用其他用户名")
        else:
            logger.error(f"创建用户失败: {e}")
            raise HTTPException(status_code=500, detail="创建用户失败")


@router.put("/{user_id}", summary="更新用户")
async def update_user(
    user_id: int,
    user: dict,
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    更新用户信息
    
    - **user_id**: 用户ID
    - **username**: 用户名
    - **role**: 角色
    
    返回更新后的用户信息
    """
    try:
        update_fields = []
        params = []
        
        if 'username' in user:
            update_fields.append("username = %s")
            params.append(user['username'])
        if 'role' in user:
            update_fields.append("role = %s")
            params.append(user['role'])
        if 'developer' in user:
            update_fields.append("developer = %s")
            params.append(user['developer'])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        params.append(user_id)
        
        await repo.execute_update(
            f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s",
            tuple(params)
        )
        
        return {
            "code": 200,
            "message": "更新成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户失败: {e}")
        raise HTTPException(status_code=500, detail="更新用户失败")


@router.delete("/{user_id}", summary="删除用户")
async def delete_user(
    user_id: int,
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    删除用户
    
    - **user_id**: 用户ID
    
    返回删除结果
    """
    try:
        await repo.execute_update("DELETE FROM users WHERE id = %s", (user_id,))
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except Exception as e:
        logger.error(f"删除用户失败: {e}")
        raise HTTPException(status_code=500, detail="删除用户失败")


@router.put("/{user_id}/password", summary="更新用户密码")
async def update_user_password(
    user_id: int,
    request_data: Dict[str, Any] = Body(..., description="密码更新请求"),
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    更新用户密码
    
    - **user_id**: 用户ID
    - **old_password**: 旧密码（必需）
    - **new_password**: 新密码（必需）
    
    返回更新结果
    """
    try:
        old_password = request_data.get("old_password")
        new_password = request_data.get("new_password")
        
        if not old_password or not new_password:
            raise HTTPException(status_code=400, detail="旧密码和新密码不能为空")
        
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="新密码长度不能少于6位")
        
        # 获取用户信息
        users = await repo.execute_query(
            "SELECT id, password FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not users:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        # 验证旧密码
        old_password_hash = hashlib.md5(old_password.encode()).hexdigest()
        if users[0]['password'] != old_password_hash:
            raise HTTPException(status_code=400, detail="旧密码错误")
        
        # 更新密码
        new_password_hash = hashlib.md5(new_password.encode()).hexdigest()
        await repo.execute_query(
            "UPDATE users SET password = %s WHERE id = %s",
            (new_password_hash, user_id)
        )
        
        logger.info(f"[OK] 用户密码更新成功 | 用户ID: {user_id}")
        
        return {
            "code": 200,
            "message": "密码更新成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户密码失败: {e}")
        raise HTTPException(status_code=500, detail="更新用户密码失败")


@router.put("/{user_id}/role", summary="更新用户角色")
async def update_user_role(
    user_id: int,
    request_data: Dict[str, Any] = Body(..., description="角色更新请求"),
    user_info: dict = Depends(auth_middleware.require_admin()),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    更新用户角色
    
    - **user_id**: 用户ID
    - **role**: 新角色（必需，可选值：admin, user）
    
    返回更新结果
    """
    try:
        role = request_data.get("role")
        
        if not role:
            raise HTTPException(status_code=400, detail="角色不能为空")
        
        # 验证角色
        valid_roles = ['admin', 'user']
        if role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"无效的角色，可选值：{', '.join(valid_roles)}"
            )
        
        # 检查用户是否存在
        users = await repo.execute_query(
            "SELECT id FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not users:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        # 更新角色
        await repo.execute_query(
            "UPDATE users SET role = %s WHERE id = %s",
            (role, user_id)
        )
        
        logger.info(f"[OK] 用户角色更新成功 | 用户ID: {user_id} | 新角色: {role}")
        
        return {
            "code": 200,
            "message": "角色更新成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户角色失败: {e}")
        raise HTTPException(status_code=500, detail="更新用户角色失败")
