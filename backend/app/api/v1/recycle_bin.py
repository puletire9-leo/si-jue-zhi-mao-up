"""
[参考] 公共回收站API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: RecycleBinController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
import logging

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recycle-bin", tags=["回收站管理"])


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


@router.get("/stats", summary="获取回收站统计")
async def get_recycle_bin_stats(repo: MySQLRepository = get_mysql_repo()):
    """
    获取回收站统计信息
    
    返回：
    - 总产品数
    - 即将过期的产品数（7天内）
    """
    try:
        # 检查回收站表是否存在
        check_table = await repo.execute_query(
            "SHOW TABLES LIKE 'recycle_bin'"
        )
        
        if not check_table:
            return {
                "code": 200,
                "message": "获取成功",
                "data": {
                    "total_products": 0,
                    "expiring_products": 0
                }
            }
        
        # 获取总产品数
        total_result = await repo.execute_query("SELECT COUNT(*) as count FROM recycle_bin")
        total_count = total_result[0]['count'] if total_result else 0
        
        # 获取即将过期的产品（7天内）
        expiring_result = await repo.execute_query(
            """
            SELECT COUNT(*) as count 
            FROM recycle_bin 
            WHERE expires_at <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            """
        )
        expiring_count = expiring_result[0]['count'] if expiring_result else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "total_products": total_count,
                "expiring_products": expiring_count
            }
        }
        
    except Exception as e:
        logger.error(f"获取回收站统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站统计失败")


@router.get("/products", summary="获取回收站产品列表")
async def get_recycle_bin_products(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    q: Optional[str] = Query(None, description="搜索关键词"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取回收站产品列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大100）
    - **q**: 搜索关键词（可选）
    - **start_date**: 开始日期（可选）
    - **end_date**: 结束日期（可选）
    
    返回产品列表和分页信息
    """
    try:
        offset = (page - 1) * size
        
        where_conditions = []
        params = []
        
        if q:
            where_conditions.append("(product_sku LIKE %s)")
            params.append(f"%{q}%")
        
        if start_date:
            where_conditions.append("deleted_at >= %s")
            params.append(start_date)
        
        if end_date:
            where_conditions.append("deleted_at <= %s")
            params.append(end_date)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        products = await repo.execute_query(
            f"""
            SELECT 
                id, product_sku, deleted_at, expires_at
            FROM recycle_bin
            WHERE {where_clause}
            ORDER BY deleted_at DESC
            LIMIT {size} OFFSET {offset}
            """,
            tuple(params)
        )
        
        total_result = await repo.execute_query(
            f"SELECT COUNT(*) as count FROM recycle_bin WHERE {where_clause}",
            tuple(params)
        )
        total = total_result[0]['count'] if total_result else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": products,
                "total": total,
                "page": page,
                "size": size
            }
        }
        
    except Exception as e:
        logger.error(f"获取回收站产品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站产品列表失败")


@router.post("/restore/{sku}", summary="恢复产品")
async def restore_product(
    sku: str,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    从回收站恢复产品
    
    - **sku**: 产品SKU
    
    返回恢复结果
    """
    try:
        # 检查产品是否在回收站中
        recycle_products = await repo.execute_query(
            "SELECT * FROM recycle_bin WHERE product_sku = %s",
            (sku,)
        )
        
        if not recycle_products:
            raise HTTPException(status_code=404, detail="产品不在回收站中")
        
        # 解析原始数据
        import json
        product = recycle_products[0]
        original_data = json.loads(product.get('original_data', '{}'))  # original_data字段
        
        # 恢复产品到products表
        await repo.execute_query(
            """
            INSERT INTO products (sku, name, product_type, description, 
                             developer, image_url, local_path, thumb_path,
                             create_time, update_time, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            """,
            (original_data.get('sku'), original_data.get('name'), original_data.get('product_type'),
             original_data.get('description'), original_data.get('developer'), original_data.get('image_url'),
             original_data.get('local_path'), original_data.get('thumb_path'), original_data.get('create_time'),
             original_data.get('update_time'))
        )
        
        # 从回收站删除
        await repo.execute_query(
            "DELETE FROM recycle_bin WHERE product_sku = %s",
            (sku,)
        )
        
        return {
            "code": 200,
            "message": "恢复成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"恢复产品失败: {e}")
        raise HTTPException(status_code=500, detail="恢复产品失败")


@router.post("/batch-restore", summary="批量恢复产品")
async def batch_restore_products(
    skus: List[str],
    repo: MySQLRepository = get_mysql_repo()
):
    """
    批量恢复产品
    
    - **skus**: 产品SKU列表
    
    返回恢复结果
    """
    try:
        success_count = 0
        error_count = 0
        errors = []
        
        for sku in skus:
            try:
                # 检查产品是否在回收站中
                recycle_products = await repo.execute_query(
                    "SELECT * FROM recycle_bin WHERE sku = %s",
                    (sku,)
                )
                
                if not recycle_products:
                    error_count += 1
                    errors.append({"sku": sku, "error": "产品不在回收站中"})
                    continue
                
                # 恢复产品
                product = recycle_products[0]
                await repo.execute_query(
                    """
                    INSERT INTO products (sku, name, product_type, description, 
                                     developer, image_url, local_path, thumb_path,
                                     create_time, update_time)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (product['sku'], product['name'], product['product_type'],
                     product['description'], product['developer'], product['image_url'],
                     product['local_path'], product['thumb_path'], product['create_time'],
                     product['update_time'])
                )
                
                # 从回收站删除
                await repo.execute_query(
                    "DELETE FROM recycle_bin WHERE sku = %s",
                    (sku,)
                )
                
                success_count += 1
            except Exception as e:
                error_count += 1
                errors.append({"sku": sku, "error": str(e)})
        
        return {
            "code": 200,
            "message": f"批量恢复完成：成功 {success_count} 条，失败 {error_count} 条",
            "data": {
                "success": success_count,
                "error": error_count,
                "errors": errors
            }
        }
        
    except Exception as e:
        logger.error(f"批量恢复产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量恢复产品失败")


@router.delete("/{sku}", summary="永久删除产品")
async def delete_product_permanently(
    sku: str,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    永久删除回收站中的产品
    
    - **sku**: 产品SKU
    
    返回删除结果
    """
    try:
        await repo.execute_query(
            "DELETE FROM recycle_bin WHERE sku = %s",
            (sku,)
        )
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except Exception as e:
        logger.error(f"永久删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="永久删除产品失败")


@router.delete("/batch", summary="批量永久删除产品")
async def batch_delete_products_permanently(
    skus: List[str],
    repo: MySQLRepository = get_mysql_repo()
):
    """
    批量永久删除产品
    
    - **skus**: 产品SKU列表
    
    返回删除结果
    """
    try:
        if not skus:
            raise HTTPException(status_code=400, detail="请选择要删除的产品")
        
        placeholders = ','.join(['%s'] * len(skus))
        await repo.execute_query(
            f"DELETE FROM recycle_bin WHERE sku IN ({placeholders})",
            tuple(skus)
        )
        
        return {
            "code": 200,
            "message": f"成功删除 {len(skus)} 个产品",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量永久删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量永久删除产品失败")


@router.delete("/expired", summary="清理过期产品")
async def clean_expired_products(repo: MySQLRepository = get_mysql_repo()):
    """
    清理回收站中过期的产品
    
    返回清理结果
    """
    try:
        result = await repo.execute_query(
            "DELETE FROM recycle_bin WHERE expire_time < CURDATE()"
        )
        
        return {
            "code": 200,
            "message": f"清理了 {result} 个过期产品",
            "data": {
                "deleted_count": result
            }
        }
        
    except Exception as e:
        logger.error(f"清理过期产品失败: {e}")
        raise HTTPException(status_code=500, detail="清理过期产品失败")
