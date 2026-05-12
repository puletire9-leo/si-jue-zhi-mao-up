"""
[参考] 标签管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: TagController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
import logging

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tags", tags=["标签管理"])


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


@router.get("", summary="获取标签列表")
async def get_tags_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取标签列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大100）
    
    返回标签列表和分页信息
    """
    try:
        offset = (page - 1) * size
        
        tags = await repo.execute_query(
            f"""
            SELECT 
                t.id, t.name, t.type, t.created_at,
                COUNT(pt.product_sku) as product_count
            FROM tags t
            LEFT JOIN product_tags pt ON t.id = pt.tag_id
            GROUP BY t.id, t.name, t.type, t.created_at
            ORDER BY t.created_at DESC
            LIMIT {size} OFFSET {offset}
            """
        )
        
        total_result = await repo.execute_query("SELECT COUNT(*) as count FROM tags")
        total = total_result[0]['count'] if total_result else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": tags,
                "total": total,
                "page": page,
                "size": size
            }
        }
        
    except Exception as e:
        logger.error(f"获取标签列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取标签列表失败")


@router.get("/{tag_id}", summary="获取标签详情")
async def get_tag(
    tag_id: int,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取标签详情
    
    - **tag_id**: 标签ID
    
    返回标签详细信息
    """
    try:
        tags = await repo.execute_query(
            f"""
            SELECT 
                t.id, t.name, t.type, t.created_at,
                COUNT(pt.product_sku) as product_count
            FROM tags t
            LEFT JOIN product_tags pt ON t.id = pt.tag_id
            WHERE t.id = {tag_id}
            GROUP BY t.id, t.name, t.type, t.created_at
            """
        )
        
        if not tags:
            raise HTTPException(status_code=404, detail="标签不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": tags[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取标签详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取标签详情失败")


@router.post("", summary="创建标签")
async def create_tag(
    tag: dict,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    创建新标签
    
    - **name**: 标签名称（必需）
    - **type**: 标签类型（可选）
    
    返回创建的标签信息
    """
    try:
        name = tag.get('name')
        tag_type = tag.get('type', '')
        
        if not name:
            raise HTTPException(status_code=400, detail="标签名称不能为空")
        
        await repo.execute_query(
            """
            INSERT INTO tags (name, type)
            VALUES (%s, %s)
            """,
            (name, tag_type)
        )
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建标签失败: {e}")
        raise HTTPException(status_code=500, detail="创建标签失败")


@router.put("/{tag_id}", summary="更新标签")
async def update_tag(
    tag_id: int,
    tag: dict,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    更新标签信息
    
    - **tag_id**: 标签ID
    - **name**: 标签名称
    - **type**: 标签类型
    
    返回更新后的标签信息
    """
    try:
        update_fields = []
        params = []
        
        if 'name' in tag:
            update_fields.append("name = %s")
            params.append(tag['name'])
        if 'type' in tag:
            update_fields.append("type = %s")
            params.append(tag['type'])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        params.append(tag_id)
        
        await repo.execute_query(
            f"UPDATE tags SET {', '.join(update_fields)} WHERE id = %s",
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
        logger.error(f"更新标签失败: {e}")
        raise HTTPException(status_code=500, detail="更新标签失败")


@router.delete("/{tag_id}", summary="删除标签")
async def delete_tag(
    tag_id: int,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    删除标签
    
    - **tag_id**: 标签ID
    
    返回删除结果
    """
    try:
        await repo.execute_query(f"DELETE FROM tags WHERE id = {tag_id}")
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except Exception as e:
        logger.error(f"删除标签失败: {e}")
        raise HTTPException(status_code=500, detail="删除标签失败")


@router.put("/batch", summary="批量更新标签")
async def batch_update_tags(
    request_data: Dict[str, Any] = Body(..., description="批量更新请求"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    批量更新标签
    
    - **ids**: 标签ID列表
    - **updates**: 要更新的字段（name, type）
    
    批量更新标签信息
    """
    try:
        # 获取标签ID列表和更新数据
        tag_ids = request_data.get("ids", [])
        updates = request_data.get("updates", {})
        
        if not tag_ids:
            raise HTTPException(status_code=400, detail="请提供要更新的标签ID列表")
        
        if not updates:
            raise HTTPException(status_code=400, detail="请提供要更新的字段")
        
        # 验证ID数量
        if len(tag_ids) > 100:
            raise HTTPException(
                status_code=400,
                detail="批量更新最多支持100个标签"
            )
        
        # 验证ID格式
        try:
            tag_ids = [int(tag_id) for tag_id in tag_ids]
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="标签ID格式错误")
        
        # 构建更新字段
        update_fields = []
        params = []
        
        if 'name' in updates:
            update_fields.append("name = %s")
            params.append(updates['name'])
        if 'type' in updates:
            update_fields.append("type = %s")
            params.append(updates['type'])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        # 执行批量更新
        results = {
            "success": [],
            "failed": [],
            "total": len(tag_ids),
            "success_count": 0,
            "failed_count": 0
        }
        
        for tag_id in tag_ids:
            try:
                update_params = params.copy()
                update_params.append(tag_id)
                
                await repo.execute_query(
                    f"UPDATE tags SET {', '.join(update_fields)} WHERE id = %s",
                    tuple(update_params)
                )
                
                results["success"].append(tag_id)
                results["success_count"] += 1
                
            except Exception as e:
                logger.error(f"[FAIL] 批量更新失败 | ID: {tag_id} | 错误: {e}")
                results["failed"].append({
                    "tag_id": tag_id,
                    "error": str(e)
                })
                results["failed_count"] += 1
        
        logger.info(f"[OK] 批量更新完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}")
        
        return {
            "code": 200,
            "message": f"批量更新完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}",
            "data": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量更新标签失败: {e}")
        raise HTTPException(status_code=500, detail="批量更新标签失败")


@router.delete("/batch", summary="批量删除标签")
async def batch_delete_tags(
    request_data: Dict[str, Any] = Body(..., description="批量删除请求"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    批量删除标签
    
    - **ids**: 标签ID列表
    
    批量删除标签
    """
    try:
        # 获取标签ID列表
        tag_ids = request_data.get("ids", [])
        
        if not tag_ids:
            raise HTTPException(status_code=400, detail="请提供要删除的标签ID列表")
        
        # 验证ID数量
        if len(tag_ids) > 100:
            raise HTTPException(
                status_code=400,
                detail="批量删除最多支持100个标签"
            )
        
        # 验证ID格式
        try:
            tag_ids = [int(tag_id) for tag_id in tag_ids]
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="标签ID格式错误")
        
        # 执行批量删除
        results = {
            "success": [],
            "failed": [],
            "total": len(tag_ids),
            "success_count": 0,
            "failed_count": 0
        }
        
        for tag_id in tag_ids:
            try:
                await repo.execute_query(f"DELETE FROM tags WHERE id = {tag_id}")
                
                results["success"].append(tag_id)
                results["success_count"] += 1
                
            except Exception as e:
                logger.error(f"[FAIL] 批量删除失败 | ID: {tag_id} | 错误: {e}")
                results["failed"].append({
                    "tag_id": tag_id,
                    "error": str(e)
                })
                results["failed_count"] += 1
        
        logger.info(f"[OK] 批量删除完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}")
        
        return {
            "code": 200,
            "message": f"批量删除完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}",
            "data": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除标签失败: {e}")
        raise HTTPException(status_code=500, detail="批量删除标签失败")
