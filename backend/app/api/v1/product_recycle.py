"""
[参考] 产品回收站API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ProductRecycleController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
import logging

from ...services.product_recycle_service import ProductRecycleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/product-recycle", tags=["产品回收站"])


def get_product_recycle_service():
    """
    依赖注入：获取产品回收站服务实例
    
    Returns:
        ProductRecycleService实例
    """
    from fastapi import Request
    
    def _get_service(request: Request):
        mysql = request.app.state.mysql
        redis = getattr(request.app.state, 'redis', None)
        return ProductRecycleService(mysql, redis)
    
    return Depends(_get_service)


@router.get("/stats", summary="获取回收站统计信息")
async def get_recycle_stats(
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    获取产品回收站统计信息
    
    返回回收站产品总数、按类型统计、最近删除时间等信息
    """
    try:
        stats = await service.get_recycle_stats()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"获取回收站统计信息失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站统计信息失败")


@router.get("/products", summary="获取回收站产品列表")
async def get_recycled_products(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=96, description="每页数量"),
    sku: Optional[str] = Query(None, description="产品SKU"),
    name: Optional[str] = Query(None, description="产品名称"),
    type: Optional[str] = Query(None, description="产品类型"),
    category: Optional[str] = Query(None, description="产品分类"),
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    获取回收站产品列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大96）
    - **sku**: 产品SKU筛选（可选）
    - **name**: 产品名称筛选（可选）
    - **type**: 产品类型筛选（可选）
    - **category**: 产品分类筛选（可选）
    
    返回回收站产品列表和分页信息
    """
    try:
        products_data = await service.get_recycled_products(
            page=page,
            size=size,
            sku=sku,
            name=name,
            type=type,
            category=category
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": products_data
        }
        
    except Exception as e:
        logger.error(f"获取回收站产品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站产品列表失败")


@router.post("/products/{sku}/restore", summary="恢复产品")
async def restore_product(
    sku: str,
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    从回收站恢复产品
    
    - **sku**: 产品SKU
    
    返回恢复结果
    """
    try:
        success = await service.restore_product(sku)
        
        if not success:
            raise HTTPException(status_code=404, detail="产品不存在或不在回收站中")
        
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


@router.post("/products/batch-restore", summary="批量恢复产品")
async def batch_restore_products(
    request_data: Dict[str, Any] = Body(..., description="批量恢复请求"),
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    批量恢复产品
    
    - **skus**: 产品SKU列表
    
    返回恢复结果
    """
    try:
        skus = request_data.get("skus", [])
        
        if not skus:
            raise HTTPException(status_code=400, detail="请提供要恢复的产品SKU列表")
        
        restored_count = await service.batch_restore_products(skus)
        
        return {
            "code": 200,
            "message": f"批量恢复成功，共恢复 {restored_count} 个产品",
            "data": {
                "restored_count": restored_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量恢复产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量恢复产品失败")


@router.delete("/products/{sku}", summary="永久删除产品")
async def permanently_delete_product(
    sku: str,
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    永久删除回收站中的产品
    
    - **sku**: 产品SKU
    
    返回删除结果
    """
    try:
        success = await service.permanently_delete_product(sku)
        
        if not success:
            raise HTTPException(status_code=404, detail="产品不存在或不在回收站中")
        
        return {
            "code": 200,
            "message": "永久删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"永久删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="永久删除产品失败")


@router.delete("/products/batch", summary="批量永久删除产品")
async def batch_permanently_delete_products(
    request_data: Dict[str, Any] = Body(..., description="批量永久删除请求"),
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    批量永久删除产品
    
    - **skus**: 产品SKU列表
    
    返回删除结果
    """
    try:
        skus = request_data.get("skus", [])
        
        if not skus:
            raise HTTPException(status_code=400, detail="请提供要删除的产品SKU列表")
        
        deleted_count = await service.batch_permanently_delete_products(skus)
        
        return {
            "code": 200,
            "message": f"批量永久删除成功，共删除 {deleted_count} 个产品",
            "data": {
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量永久删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量永久删除产品失败")


@router.delete("/products/clear-expired", summary="清理过期产品")
async def clear_expired_products(
    days: int = Query(30, ge=1, le=365, description="保留天数"),
    service: ProductRecycleService = get_product_recycle_service()
):
    """
    清理回收站中过期的产品
    
    - **days**: 保留天数（默认30天）
    
    返回清理结果
    """
    try:
        cleared_count = await service.clear_expired_products(days)
        
        return {
            "code": 200,
            "message": f"清理过期产品成功，共清理 {cleared_count} 个产品",
            "data": {
                "cleared_count": cleared_count
            }
        }
        
    except Exception as e:
        logger.error(f"清理过期产品失败: {e}")
        raise HTTPException(status_code=500, detail="清理过期产品失败")