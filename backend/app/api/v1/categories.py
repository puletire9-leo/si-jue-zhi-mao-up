"""
[参考] 分类管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: CategoryController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
import logging

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/categories", tags=["分类管理"])


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


@router.get("", summary="获取分类列表")
async def get_categories_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取分类列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大100）
    
    返回分类列表和分页信息
    """
    try:
        offset = (page - 1) * size
        
        categories = await repo.execute_query(
            f"""
            SELECT 
                c.id, c.name, c.description, c.created_at,
                COUNT(p.sku) as product_count
            FROM categories c
            LEFT JOIN products p ON c.name COLLATE utf8mb4_unicode_ci = p.category COLLATE utf8mb4_unicode_ci
            GROUP BY c.id, c.name, c.description, c.created_at
            ORDER BY c.created_at DESC
            LIMIT {size} OFFSET {offset}
            """
        )
        
        total_result = await repo.execute_query("SELECT COUNT(*) as count FROM categories")
        total = total_result[0]['count'] if total_result else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": categories,
                "total": total,
                "page": page,
                "size": size
            }
        }
        
    except Exception as e:
        logger.error(f"获取分类列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取分类列表失败")


@router.get("/{category_id}", summary="获取分类详情")
async def get_category(
    category_id: int,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取分类详情
    
    - **category_id**: 分类ID
    
    返回分类详细信息
    """
    try:
        categories = await repo.execute_query(
            f"""
            SELECT 
                c.id, c.name, c.description, c.created_at,
                COUNT(p.sku) as product_count
            FROM categories c
            LEFT JOIN products p ON c.name COLLATE utf8mb4_unicode_ci = p.category COLLATE utf8mb4_unicode_ci
            WHERE c.id = {category_id}
            GROUP BY c.id, c.name, c.description, c.created_at
            """
        )
        
        if not categories:
            raise HTTPException(status_code=404, detail="分类不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": categories[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分类详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取分类详情失败")


@router.post("", summary="创建分类")
async def create_category(
    category: dict,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    创建新分类
    
    - **name**: 分类名称（必需）
    - **description**: 分类描述（可选）
    
    返回创建的分类信息
    """
    try:
        name = category.get('name')
        description = category.get('description', '')
        
        if not name:
            raise HTTPException(status_code=400, detail="分类名称不能为空")
        
        await repo.execute_query(
            """
            INSERT INTO categories (name, description)
            VALUES (%s, %s)
            """,
            (name, description)
        )
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建分类失败: {e}")
        raise HTTPException(status_code=500, detail="创建分类失败")


@router.put("/{category_id}", summary="更新分类")
async def update_category(
    category_id: int,
    category: dict,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    更新分类信息
    
    - **category_id**: 分类ID
    - **name**: 分类名称
    - **description**: 分类描述
    
    返回更新后的分类信息
    """
    try:
        update_fields = []
        params = []
        
        if 'name' in category:
            update_fields.append("name = %s")
            params.append(category['name'])
        if 'description' in category:
            update_fields.append("description = %s")
            params.append(category['description'])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        params.append(category_id)
        
        await repo.execute_query(
            f"UPDATE categories SET {', '.join(update_fields)} WHERE id = %s",
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
        logger.error(f"更新分类失败: {e}")
        raise HTTPException(status_code=500, detail="更新分类失败")


@router.delete("/{category_id}", summary="删除分类")
async def delete_category(
    category_id: int,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    删除分类
    
    - **category_id**: 分类ID
    
    返回删除结果
    """
    try:
        await repo.execute_query(f"DELETE FROM categories WHERE id = {category_id}")
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except Exception as e:
        logger.error(f"删除分类失败: {e}")
        raise HTTPException(status_code=500, detail="删除分类失败")
