"""
[参考] 选品回收站API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: SelectionRecycleController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
import logging

from ...services.selection_recycle_service import SelectionRecycleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/selection/recycle", tags=["选品回收站管理"])


def get_selection_recycle_service():
    """
    依赖注入：获取选品回收站服务实例
    
    Returns:
        SelectionRecycleService实例
    """
    from fastapi import Request
    
    def _get_service(request: Request):
        mysql = request.app.state.mysql
        return SelectionRecycleService(mysql)
    
    return Depends(_get_service)


@router.get("/stats", summary="获取选品回收站统计")
async def get_selection_recycle_stats(
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    获取选品回收站统计信息
    
    返回：
    - 总产品数
    - 今天删除的产品数
    - 本周删除的产品数
    """
    try:
        stats = await service.get_recycle_stats()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"获取选品回收站统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取选品回收站统计失败")


@router.get("/products", summary="获取选品回收站产品列表")
async def get_selection_recycle_products(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    asin: Optional[str] = Query(None, description="产品ASIN"),
    product_title: Optional[str] = Query(None, description="商品标题"),
    product_type: Optional[str] = Query(None, description="产品类型：new/reference"),
    store_name: Optional[str] = Query(None, description="店铺名称"),
    category: Optional[str] = Query(None, description="产品分类"),
    start_date: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    end_date: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    获取选品回收站产品列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认20，最大100）
    - **asin**: 产品ASIN（可选）
    - **product_title**: 商品标题（可选）
    - **product_type**: 产品类型（可选）
    - **store_name**: 店铺名称（可选）
    - **category**: 产品分类（可选）
    - **start_date**: 开始日期（可选）
    - **end_date**: 结束日期（可选）
    
    返回产品列表和分页信息
    """
    try:
        result = await service.get_recycled_products(
            page=page,
            size=size,
            asin=asin,
            product_title=product_title,
            product_type=product_type,
            store_name=store_name,
            category=category,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"获取选品回收站产品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取选品回收站产品列表失败")


@router.post("/products/{recycle_id}/restore", summary="恢复选品产品")
async def restore_selection_product(
    recycle_id: int,
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    从回收站恢复选品产品
    
    - **recycle_id**: 回收站记录ID
    
    返回恢复结果
    """
    try:
        success = await service.restore_product(recycle_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="回收站记录不存在")
        
        return {
            "code": 200,
            "message": "恢复成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"恢复选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="恢复选品产品失败")


@router.post("/products/batch-restore", summary="批量恢复选品产品")
async def batch_restore_selection_products(
    request_data: Dict[str, Any] = Body(..., description="批量恢复请求"),
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    批量从回收站恢复选品产品
    
    - **recycle_ids**: 回收站记录ID列表
    
    返回恢复结果
    """
    try:
        recycle_ids = request_data.get("recycle_ids", [])
        
        if not recycle_ids:
            raise HTTPException(status_code=400, detail="请提供要恢复的回收站记录ID列表")
        
        restored_count = await service.batch_restore_products(recycle_ids)
        
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
        logger.error(f"批量恢复选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量恢复选品产品失败")


@router.delete("/products/{recycle_id}", summary="永久删除选品产品")
async def permanently_delete_selection_product(
    recycle_id: int,
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    永久删除选品产品（从回收站彻底删除）
    
    - **recycle_id**: 回收站记录ID
    
    返回删除结果
    """
    try:
        success = await service.permanently_delete_product(recycle_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="回收站记录不存在")
        
        return {
            "code": 200,
            "message": "永久删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"永久删除选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="永久删除选品产品失败")


@router.delete("/products/batch", summary="批量永久删除选品产品")
async def batch_permanently_delete_selection_products(
    request_data: Dict[str, Any] = Body(..., description="批量永久删除请求"),
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    批量永久删除选品产品（从回收站彻底删除）
    
    - **recycle_ids**: 回收站记录ID列表
    
    返回删除结果
    """
    try:
        recycle_ids = request_data.get("recycle_ids", [])
        
        if not recycle_ids:
            raise HTTPException(status_code=400, detail="请提供要删除的回收站记录ID列表")
        
        deleted_count = await service.batch_permanently_delete_products(recycle_ids)
        
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
        logger.error(f"批量永久删除选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量永久删除选品产品失败")

@router.delete("/clear", summary="清空选品回收站")
async def clear_selection_recycle(
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    清空选品回收站
    
    清空回收站中的所有选品数据，此操作将永久删除回收站中的所有产品，且不可恢复
    
    返回删除结果
    """
    try:
        deleted_count = await service.clear_recycle_bin()
        
        return {
            "code": 200,
            "message": f"清空选品回收站成功，共删除 {deleted_count} 个产品",
            "data": {
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"清空选品回收站失败: {e}")
        raise HTTPException(status_code=500, detail="清空选品回收站失败")


@router.delete("/products/clear-expired", summary="清理过期产品")
async def clear_expired_selection_products(
    days: int = Query(30, ge=1, le=365, description="过期天数（默认30天）"),
    service: SelectionRecycleService = get_selection_recycle_service()
):
    """
    清理回收站中过期的选品产品
    
    - **days**: 过期天数（默认30天）
    
    返回清理结果
    """
    try:
        query = "DELETE FROM selection_recycle_bin WHERE deleted_at <= DATE_SUB(NOW(), INTERVAL %s DAY)"
        result = await service.mysql.execute_delete(query, (days,))
        
        logger.info(f"[OK] 清理过期选品产品成功 | 清理数量: {result} | 过期天数: {days}")
        
        return {
            "code": 200,
            "message": f"清理成功，共删除 {result} 个过期产品",
            "data": {
                "deleted_count": result
            }
        }
        
    except Exception as e:
        logger.error(f"清理过期选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="清理过期选品产品失败")