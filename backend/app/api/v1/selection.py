"""
[参考] 选品管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: SelectionController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File, Body
from typing import Optional, List, Dict, Any
import logging
import os
import aiomysql
from datetime import datetime

from ...models.selection import (
    SelectionProductCreate,
    SelectionProductUpdate,
    SelectionProductResponse,
    SelectionProductListResponse,
    SelectionProductQueryParams,
    SelectionStatsResponse,
    StoreInfo,
    BatchImportSelectionRequest,
    BatchImportSelectionResponse
)
from ...services.selection_service import SelectionService
from ...config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/selection", tags=["选品管理"])


def get_selection_service():
    """
    依赖注入：获取选品服务实例
    
    Returns:
        SelectionService实例
    """
    from fastapi import Request
    
    def _get_service(request: Request):
        mysql = request.app.state.mysql
        redis = getattr(request.app.state, 'redis', None)
        return SelectionService(mysql, redis)
    
    return Depends(_get_service)


@router.post("/products", summary="创建选品产品")
async def create_selection_product(
    product: SelectionProductCreate,
    service: SelectionService = get_selection_service()
):
    """
    创建新的选品产品
    
    - **asin**: 产品ASIN（必需）
    - **product_title**: 商品标题（必需）
    - **price**: 商品价格（可选）
    - **image_url**: 商品图片URL（可选）
    - **local_path**: 本地图片路径（可选）
    - **thumb_path**: 缩略图路径（可选）
    - **store_name**: 店铺名称（可选）
    - **store_url**: 店铺URL（可选）
    - **category**: 产品分类（可选）
    - **tags**: 产品标签列表（可选）
    - **notes**: 备注信息（可选）
    - **product_type**: 产品类型（必需，默认：new，可选值：new/reference）
    - **country**: 国家（可选，英国/德国）
    - **data_filter_mode**: 数据筛选模式（可选，模式一/模式二）
    
    返回创建的选品产品信息
    """
    try:
        result = await service.create_product(product)
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"创建选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="创建选品产品失败")


@router.get("/products/list", summary="获取选品产品列表")
async def get_selection_products_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(60, ge=1, le=500, description="每页数量"),
    asin: Optional[str] = Query(None, description="产品ASIN"),
    productTitle: Optional[str] = Query(None, description="商品标题", alias="product_title"),
    productType: Optional[str] = Query(None, description="产品类型：new/reference", alias="product_type"),
    storeName: Optional[str] = Query(None, description="店铺名称", alias="store_name"),
    category: Optional[str] = Query(None, description="产品分类"),
    sort_by: Optional[str] = Query("createdAt", description="排序字段", alias="sortBy"),
    sort_order: Optional[str] = Query("desc", description="排序方向：asc/desc", alias="sortOrder"),
    service: SelectionService = get_selection_service()
):
    """
    获取选品产品列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认60，最大500）
    - **asin**: 产品ASIN（可选）
    - **product_title**: 商品标题（可选）
    - **product_type**: 产品类型（可选）
    - **store_name**: 店铺名称（可选）
    - **category**: 产品分类（可选）
    - **sort_by**: 排序字段（默认created_at）
    - **sort_order**: 排序方向（默认desc）
    
    返回选品产品列表和分页信息
    """
    try:
        params = SelectionProductQueryParams(
            asin=asin,
            product_title=productTitle,
            product_type=productType,
            store_name=storeName,
            category=category,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        result = await service.get_products(page, size, params)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"获取选品产品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取选品产品列表失败")


@router.get("/products/asins", summary="获取所有选品ASIN列表")
async def get_all_selection_asins(
    product_type: Optional[str] = Query(None, description="产品类型：new/reference，不传则返回所有类型"),
    service: SelectionService = get_selection_service()
):
    """
    获取所有选品的ASIN列表
    
    - **product_type**: 产品类型（可选），new/reference，不传则返回所有类型
    
    返回ASIN列表
    """
    try:
        asins = await service.get_all_asins(product_type)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "asins": asins,
                "total": len(asins)
            }
        }
        
    except Exception as e:
        logger.error(f"获取ASIN列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取ASIN列表失败")


@router.get("/products/{product_id}", summary="获取选品产品详情")
async def get_selection_product_by_id(
    product_id: int,
    service: SelectionService = get_selection_service()
):
    """
    获取选品产品详细信息
    
    - **product_id**: 产品ID
    
    返回产品的详细信息
    """
    try:
        product = await service.get_product_by_id(product_id)
        
        if not product:
            raise HTTPException(status_code=404, detail="产品不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": product
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="获取选品产品失败")


@router.put("/products/{product_id}", summary="更新选品产品")
async def update_selection_product(
    product_id: int,
    product: SelectionProductUpdate,
    service: SelectionService = get_selection_service()
):
    """
    更新选品产品信息
    
    - **product_id**: 产品ID
    - **product_title**: 商品标题（可选）
    - **price**: 商品价格（可选）
    - **image_url**: 商品图片URL（可选）
    - **local_path**: 本地图片路径（可选）
    - **thumb_path**: 缩略图路径（可选）
    - **store_name**: 店铺名称（可选）
    - **store_url**: 店铺URL（可选）
    - **category**: 产品分类（可选）
    - **tags**: 产品标签列表（可选）
    - **notes**: 备注信息（可选）
    - **country**: 国家（可选，英国/德国）
    - **data_filter_mode**: 数据筛选模式（可选，模式一/模式二）
    
    返回更新结果
    """
    try:
        result = await service.update_product(product_id, product)
        
        return {
            "code": 200,
            "message": "更新成功",
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="更新选品产品失败")


@router.delete("/products/clear-all", summary="清空所有选品数据")
async def clear_all_selection_products(
    service: SelectionService = get_selection_service()
):
    """
    清空所有选品数据
    
    清空所有选品产品数据
    
    返回删除的产品数量
    """
    try:
        deleted_count = await service.clear_all_products()
        
        return {
            "code": 200,
            "message": f"清空成功，共删除 {deleted_count} 条记录",
            "data": {
                "deleted_count": deleted_count
            }
        }
        
    except Exception as e:
        logger.error(f"清空所有选品数据失败: {e}")
        raise HTTPException(status_code=500, detail="清空所有选品数据失败")


@router.delete("/products/{product_identifier}", summary="删除选品产品")
async def delete_selection_product(
    product_identifier: str,
    service: SelectionService = get_selection_service()
):
    """
    删除选品产品
    
    - **product_identifier**: 产品ID或ASIN
    
    删除选品产品
    """
    try:
        # 尝试将参数转换为整数（ID）
        try:
            product_id = int(product_identifier)
            success = await service.delete_product(product_id)
        except ValueError:
            # 如果转换失败，将其作为ASIN处理
            success = await service.delete_product_by_asin(product_identifier)
        
        if not success:
            raise HTTPException(status_code=404, detail="产品不存在")
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="删除选品产品失败")


@router.post("/products/batch-delete", summary="批量删除选品产品")
async def batch_delete_selection_products(
    request_data: Dict[str, Any] = Body(..., description="批量删除请求"),
    service: SelectionService = get_selection_service()
):
    """
    批量删除选品产品
    
    - **product_ids**: 产品ID列表
    
    批量删除选品产品
    """
    try:
        from ..dependencies import get_settings
        settings = get_settings()
        
        # 获取产品ID列表
        product_ids = request_data.get("product_ids", [])
        
        if not product_ids:
            raise HTTPException(status_code=400, detail="请提供要删除的产品ID列表")
        
        # 添加批量删除数量限制
        if len(product_ids) > settings.BATCH_DELETE_MAX:
            raise HTTPException(
                status_code=400,
                detail=f"批量删除最多支持{settings.BATCH_DELETE_MAX}个产品"
            )
        
        # 将字符串ID转换为整数
        try:
            product_ids_int = list(map(int, product_ids))
        except ValueError as e:
            logger.error(f"批量删除选品产品失败: 无效的产品ID格式: {e}")
            raise HTTPException(status_code=400, detail="产品ID格式无效，请提供有效的整数ID列表")
        
        # 使用批量删除产品方法（按ID）
        deleted_count = await service.batch_delete_products(product_ids_int)
        
        # 计算成功和失败的数量
        success_count = deleted_count
        failed_count = len(product_ids) - deleted_count
        
        logger.info(f"[OK] 批量删除完成 | 成功: {success_count} | 失败: {failed_count}")
        
        return {
            "code": 200,
            "message": f"批量删除完成 | 成功: {success_count} | 失败: {failed_count}",
            "data": {
                "total": len(product_ids),
                "success_count": success_count,
                "failed_count": failed_count,
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量删除选品产品失败")


@router.post("/products/batch-delete-by-asin", summary="通过ASIN批量删除选品产品")
async def batch_delete_selection_products_by_asin(
    request_data: Dict[str, Any] = Body(..., description="通过ASIN批量删除请求"),
    service: SelectionService = get_selection_service()
):
    """
    通过ASIN批量删除选品产品
    
    - **asins**: 产品ASIN列表
    
    通过ASIN批量删除选品产品
    """
    try:
        from ..dependencies import get_settings
        settings = get_settings()
        
        # 获取ASIN列表
        asins = request_data.get("asins", [])
        
        if not asins:
            raise HTTPException(status_code=400, detail="请提供要删除的产品ASIN列表")
        
        # 添加批量删除数量限制
        if len(asins) > settings.BATCH_DELETE_MAX:
            raise HTTPException(
                status_code=400,
                detail=f"批量删除最多支持{settings.BATCH_DELETE_MAX}个产品"
            )
        
        # 使用批量删除产品方法（按ASIN）
        deleted_count = await service.batch_delete_products_by_asin(asins)
        
        # 计算成功和失败的数量
        success_count = deleted_count
        failed_count = len(asins) - deleted_count
        
        logger.info(f"[OK] 通过ASIN批量删除完成 | 成功: {success_count} | 失败: {failed_count}")
        
        return {
            "code": 200,
            "message": f"通过ASIN批量删除完成 | 成功: {success_count} | 失败: {failed_count}",
            "data": {
                "total": len(asins),
                "success_count": success_count,
                "failed_count": failed_count,
                "deleted_count": deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"通过ASIN批量删除选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="通过ASIN批量删除选品产品失败")


@router.get("/new/list", summary="获取新品榜列表")
async def get_new_products_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(60, ge=1, le=500, description="每页数量"),
    asin: Optional[str] = Query(None, description="产品ASIN"),
    product_title: Optional[str] = Query(None, description="商品标题"),
    category: Optional[str] = Query(None, description="产品分类"),
    country: Optional[str] = Query(None, description="国家（英国/德国）"),
    data_filter_mode: Optional[str] = Query(None, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode"),
    listing_date_start: Optional[str] = Query(None, description="上架时间开始日期（格式：YYYY-MM-DD）", alias="listingDateStart"),
    listing_date_end: Optional[str] = Query(None, description="上架时间结束日期（格式：YYYY-MM-DD）", alias="listingDateEnd"),
    grade: Optional[str] = Query(None, description="等级筛选（S/A/B/C/D，多个用逗号分隔）"),
    is_current: Optional[int] = Query(None, description="本周/往期筛选（1=本周, 0=往期）", alias="isCurrent"),
    sort_by: Optional[str] = Query("createdAt", description="排序字段", alias="sortBy"),
    sort_order: Optional[str] = Query("desc", description="排序方向：asc/desc", alias="sortOrder"),
    service: SelectionService = get_selection_service()
):
    """
    获取新品榜列表（source包含'新品榜'）

    - **page**: 页码（默认1）
    - **size**: 每页数量（默认60，最大500）
    - **asin**: 产品ASIN（可选）
    - **product_title**: 商品标题（可选）
    - **category**: 产品分类（可选）
    - **country**: 国家（可选，英国/德国）
    - **data_filter_mode**: 数据筛选模式（可选，模式一/模式二）
    - **listing_date_start**: 上架时间开始日期（可选，格式：YYYY-MM-DD）
    - **listing_date_end**: 上架时间结束日期（可选，格式：YYYY-MM-DD）
    - **grade**: 等级筛选（可选，S/A/B/C/D，多个用逗号分隔）
    - **is_current**: 本周/往期筛选（可选，1=本周, 0=往期）
    - **sort_by**: 排序字段（默认created_at）
    - **sort_order**: 排序方向（默认desc）

    返回新品榜列表和分页信息
    """
    try:
        # 调试日志：打印接收到的参数
        logger.info(f"=== API 接收参数调试 ===")
        logger.info(f"country: {country}")
        logger.info(f"data_filter_mode: {data_filter_mode}")
        logger.info(f"listing_date_start: {listing_date_start}")
        logger.info(f"listing_date_end: {listing_date_end}")
        logger.info(f"grade: {grade}")
        logger.info(f"is_current: {is_current}")

        params = SelectionProductQueryParams(
            asin=asin,
            product_title=product_title,
            product_type="new",
            source="新品榜",
            category=category,
            country=country,
            data_filter_mode=data_filter_mode,
            listing_date_start=listing_date_start,
            listing_date_end=listing_date_end,
            grade=grade,
            is_current=is_current,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # 调试日志：打印模型参数
        logger.info(f"=== SelectionProductQueryParams 模型参数 ===")
        logger.info(f"params.country: {params.country}")
        logger.info(f"params.data_filter_mode: {params.data_filter_mode}")
        logger.info(f"params.source: {params.source}")

        result = await service.get_products_by_source(page, size, params)

        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }

    except Exception as e:
        logger.error(f"获取新品榜列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取新品榜列表失败")


@router.get("/reference/list", summary="获取竞品店铺列表")
async def get_reference_products_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(60, ge=1, le=500, description="每页数量"),
    asin: Optional[str] = Query(None, description="产品ASIN"),
    product_title: Optional[str] = Query(None, description="商品标题"),
    store_name: Optional[str] = Query(None, description="店铺名称"),
    category: Optional[str] = Query(None, description="产品分类"),
    country: Optional[str] = Query(None, description="国家（英国/德国）"),
    data_filter_mode: Optional[str] = Query(None, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode"),
    listing_date_start: Optional[str] = Query(None, description="上架时间开始日期（格式：YYYY-MM-DD）", alias="listingDateStart"),
    listing_date_end: Optional[str] = Query(None, description="上架时间结束日期（格式：YYYY-MM-DD）", alias="listingDateEnd"),
    grade: Optional[str] = Query(None, description="等级筛选（S/A/B/C/D，多个用逗号分隔）"),
    is_current: Optional[int] = Query(None, description="本周/往期筛选（1=本周, 0=往期）", alias="isCurrent"),
    sort_by: Optional[str] = Query("createdAt", description="排序字段", alias="sortBy"),
    sort_order: Optional[str] = Query("desc", description="排序方向：asc/desc", alias="sortOrder"),
    service: SelectionService = get_selection_service()
):
    """
    获取竞品店铺列表（source包含'竞品'）

    - **page**: 页码（默认1）
    - **size**: 每页数量（默认60，最大500）
    - **asin**: 产品ASIN（可选）
    - **product_title**: 商品标题（可选）
    - **store_name**: 店铺名称（可选）
    - **category**: 产品分类（可选）
    - **country**: 国家（可选，英国/德国）
    - **data_filter_mode**: 数据筛选模式（可选，模式一/模式二）
    - **listing_date_start**: 上架时间开始日期（可选，格式：YYYY-MM-DD）
    - **listing_date_end**: 上架时间结束日期（可选，格式：YYYY-MM-DD）
    - **grade**: 等级筛选（可选，S/A/B/C/D，多个用逗号分隔）
    - **is_current**: 本周/往期筛选（可选，1=本周, 0=往期）
    - **sort_by**: 排序字段（默认created_at）
    - **sort_order**: 排序方向（默认desc）

    返回竞品店铺列表和分页信息
    """
    try:
        params = SelectionProductQueryParams(
            asin=asin,
            product_title=product_title,
            product_type="reference",
            source="竞品",
            store_name=store_name,
            category=category,
            country=country,
            data_filter_mode=data_filter_mode,
            listing_date_start=listing_date_start,
            listing_date_end=listing_date_end,
            grade=grade,
            is_current=is_current,
            sort_by=sort_by,
            sort_order=sort_order
        )

        result = await service.get_products_by_source(page, size, params)

        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }

    except Exception as e:
        logger.error(f"获取竞品店铺列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取竞品店铺列表失败")


@router.get("/all/list", summary="获取总选品列表")
async def get_all_selection_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(60, ge=1, le=500, description="每页数量"),
    asin: Optional[str] = Query(None, description="产品ASIN"),
    product_title: Optional[str] = Query(None, description="商品标题"),
    product_type: Optional[str] = Query(None, description="产品类型：new/reference"),
    store_name: Optional[str] = Query(None, description="店铺名称"),
    category: Optional[str] = Query(None, description="产品分类"),
    country: Optional[str] = Query(None, description="国家（英国/德国）"),
    data_filter_mode: Optional[str] = Query(None, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode"),
    listing_date_start: Optional[str] = Query(None, description="上架时间开始日期（格式：YYYY-MM-DD）", alias="listingDateStart"),
    listing_date_end: Optional[str] = Query(None, description="上架时间结束日期（格式：YYYY-MM-DD）", alias="listingDateEnd"),
    grade: Optional[str] = Query(None, description="等级筛选（S/A/B/C/D，多个用逗号分隔）"),
    is_current: Optional[int] = Query(None, description="本周/往期筛选（1=本周, 0=往期）", alias="isCurrent"),
    sort_by: Optional[str] = Query("createdAt", description="排序字段", alias="sortBy"),
    sort_order: Optional[str] = Query("desc", description="排序方向：asc/desc", alias="sortOrder"),
    service: SelectionService = get_selection_service()
):
    """
    获取总选品列表（包含所有来源的商品数据）

    - **page**: 页码（默认1）
    - **size**: 每页数量（默认60，最大500）
    - **asin**: 产品ASIN（可选）
    - **product_title**: 商品标题（可选）
    - **product_type**: 产品类型（可选，不传则返回所有类型）
    - **store_name**: 店铺名称（可选）
    - **category**: 产品分类（可选）
    - **country**: 国家（可选，英国/德国）
    - **data_filter_mode**: 数据筛选模式（可选，模式一/模式二）
    - **listing_date_start**: 上架时间开始日期（可选，格式：YYYY-MM-DD）
    - **listing_date_end**: 上架时间结束日期（可选，格式：YYYY-MM-DD）
    - **grade**: 等级筛选（可选，S/A/B/C/D，多个用逗号分隔）
    - **is_current**: 本周/往期筛选（可选，1=本周, 0=往期）
    - **sort_by**: 排序字段（默认created_at）
    - **sort_order**: 排序方向（默认desc）

    返回总选品列表和分页信息
    """
    try:
        # 调试日志：打印接收到的参数
        print(f"=== get_all_selection_list API 接收参数调试 ===")
        print(f"country: {country}")
        print(f"data_filter_mode: {data_filter_mode}")
        print(f"listing_date_start: {listing_date_start}")
        print(f"listing_date_end: {listing_date_end}")
        print(f"grade: {grade}")
        print(f"is_current: {is_current}")

        params = SelectionProductQueryParams(
            asin=asin,
            product_title=product_title,
            product_type=product_type,
            store_name=store_name,
            category=category,
            country=country,
            data_filter_mode=data_filter_mode,
            listing_date_start=listing_date_start,
            listing_date_end=listing_date_end,
            grade=grade,
            is_current=is_current,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # 调试日志：打印模型参数
        print(f"=== SelectionProductQueryParams 模型参数 ===")
        print(f"params.country: {params.country}")
        print(f"params.data_filter_mode: {params.data_filter_mode}")
        
        result = await service.get_products(page, size, params)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"获取总选品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取总选品列表失败")


@router.get("/stats/summary", summary="获取选品统计")
async def get_selection_stats(
    service: SelectionService = get_selection_service()
):
    """
    获取选品统计信息
    
    返回选品的统计数据，包括：
    - 新品榜总数
    - 竞品店铺总数
    - 总产品数
    - 总店铺数
    - 总图片数
    """
    try:
        stats = await service.get_stats()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"获取选品统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取选品统计失败")


@router.get("/categories", summary="获取大类榜单名统计")
async def get_selection_categories(
    source: Optional[str] = Query(None, description="来源筛选关键词，用于模糊匹配source字段"),
    service: SelectionService = get_selection_service()
):
    """
    获取大类榜单名统计

    根据source筛选条件返回大类榜单名及其产品数量，按数量降序排列
    - 新品榜页面传入 source="新品榜"
    - 竞品店铺页面传入 source="竞品"
    - 不传source则返回所有产品的分类统计
    """
    try:
        categories = await service.get_categories(source=source)

        return {
            "code": 200,
            "message": "获取成功",
            "data": categories
        }

    except Exception as e:
        logger.error(f"获取大类榜单名统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取大类榜单名统计失败")


@router.get("/stores", summary="获取店铺统计")
async def get_selection_stores(
    service: SelectionService = get_selection_service()
):
    """
    获取店铺统计
    
    返回所有店铺及其产品数量，按产品数量降序排列
    """
    try:
        stores = await service.get_stores()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": stores
        }
        
    except Exception as e:
        logger.error(f"获取店铺统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取店铺统计失败")


@router.post("/import", summary="导入选品产品")
async def import_selection_products(
    file: UploadFile = File(...),
    product_type: str = Query("new", description="产品类型：new/reference/all"),
    mode: str = Query("skip", description="导入模式：skip(跳过已存在)/update(更新已存在)/overwrite(覆盖已存在)"),
    auto_score: bool = Query(True, description="导入后是否自动评分"),
    service: SelectionService = get_selection_service()
):
    """
    导入选品产品（Excel文件）
    
    - **file**: Excel文件
    - **product_type**: 产品类型（默认new，all表示根据来源自动判断）
    - **mode**: 导入模式（默认skip）
      - skip: 跳过已存在的ASIN
      - update: 更新已存在的ASIN
      - overwrite: 删除已存在的ASIN后重新插入
    
    返回导入结果
    """
    try:
        import pandas as pd
        import io
        
        logger.info(f"[INBOX] 开始导入选品产品 | 文件名: {file.filename} | 产品类型: {product_type} | 导入模式: {mode}")
        
        # 验证文件类型（只检查扩展名，不限制文件名）
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="只支持.xlsx或.xls格式的Excel文件")
        
        # 验证导入模式
        if mode not in ['skip', 'update', 'overwrite']:
            raise HTTPException(status_code=400, detail="导入模式必须是skip、update或overwrite")
        
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        logger.info(f"[CHART] 读取Excel文件成功 | 行数: {len(df)} | 列数: {len(df.columns)}")
        logger.info(f"[LIST] Excel列名: {list(df.columns)}")
        
        success_count = 0
        update_count = 0
        skip_count = 0
        failed_count = 0
        skipped_count = 0
        errors = []
        
        # 列名映射 - 支持多种列名变体
        column_mapping = {
            'asin': ['asin', 'ASIN', 'Asin', '产品ASIN', '产品ASIN码'],
            '商品标题': ['商品标题', '产品标题', '标题', 'product_title', 'Product Title'],
            '商品链接': ['商品链接', '产品链接', '链接', 'product_link', 'Product Link'],
            '价格': ['价格', '售价', 'price', 'Price'],
            '图片URL': ['图片URL', '图片链接', '图片', 'image_url', 'Image URL', '图片链接'],
            '店铺名': ['店铺名', '店铺名称', '店铺', 'store_name', 'Store Name'],
            '店铺链接': ['店铺链接', '店铺URL', 'store_url', 'Store URL'],
            '店铺ID': ['店铺ID', '店铺id', 'Store ID', 'store_id'],
            '销量': ['销量', '销售量', 'sales_volume', 'Sales Volume'],
            '上架时间': ['上架时间', 'listing_date', 'Listing Date'],
            '配送方式': ['配送方式', 'delivery_method', 'Delivery Method'],
            '相似商品': ['相似商品', '相似商品链接', 'similar_products', 'Similar Products'],
            '来源': ['来源', 'source', 'Source'],
            'main_category_name': ['大类榜单名', '分类', 'category', 'Category'],
            'main_category_rank': ['榜单排名', '排名'],
            'main_category_bsr_growth': ['大类BSR增长数', '大类BSR增长'],
            'main_category_bsr_growth_rate': ['大类BSR增长率'],
            '国家': ['国家', 'country', 'Country'],
            '数据筛选模式': ['数据筛选模式', '数据筛选', 'data_filter_mode', 'Data Filter Mode']
        }
        
        # 创建反向映射：Excel列名 -> 标准列名
        excel_to_standard = {}
        for standard_name, variants in column_mapping.items():
            for variant in variants:
                excel_to_standard[variant] = standard_name
        
        # 去除Excel列名中的空格
        df.columns = df.columns.str.strip()
        
        # 重命名Excel列名
        df_renamed = df.rename(columns=excel_to_standard)
        logger.info(f"[SYNC] 列名映射完成 | 标准列名: {list(df_renamed.columns)}")
        
        # 准备批量插入的数据
        valid_products = []
        duplicate_asins = set()
        
        logger.info(f"[SYNC] 开始处理数据，总行数: {len(df_renamed)}")
        
        for index, row in df_renamed.iterrows():
            try:
                asin = str(row.get('asin', '')).strip()
                product_title = str(row.get('商品标题', '')).strip()
                image_url_value = str(row.get('图片URL', '')) if pd.notna(row.get('图片URL')) else None
                
                if index < 3:
                    logger.info(f"[NOTE] 第{index + 2}行数据 | ASIN: '{asin}' | 标题: '{product_title}' | 图片URL: '{image_url_value}'")
                
                # 跳过空行（ASIN为空或为'nan'）
                if not asin or asin.lower() == 'nan':
                    skipped_count += 1
                    continue
                
                # 验证ASIN格式（应该以B0开头，10个字符）
                if len(asin) != 10 or not asin.startswith('B0'):
                    failed_count += 1
                    errors.append(f"第{index + 2}行: ASIN格式错误，应为10位字符且以B0开头，当前值: '{asin}'")
                    continue
                
                # 验证商品标题（不应该以http开头）
                if not product_title or product_title.startswith('http'):
                    failed_count += 1
                    errors.append(f"第{index + 2}行: 商品标题格式错误，不应为链接，当前值: '{product_title[:50]}...'")
                    continue
                
                # 验证图片URL（应该以http开头）
                if image_url_value and not image_url_value.startswith('http'):
                    failed_count += 1
                    errors.append(f"第{index + 2}行: 图片URL格式错误，应以http开头，当前值: '{image_url_value}'")
                    continue
                
                # 检查重复ASIN
                if asin in duplicate_asins:
                    failed_count += 1
                    errors.append(f"第{index + 2}行: ASIN {asin} 在文件中重复")
                    continue
                duplicate_asins.add(asin)
                
                # 处理销量字段 - 支持多种无效值
                sales_value = row.get('销量', 0)
                invalid_values = ['未知', 'N/A', 'NA', 'null', 'None', '', '-', '--', '---']
                try:
                    sales_volume = int(sales_value) if pd.notna(sales_value) and str(sales_value).strip() not in invalid_values else None
                except (ValueError, TypeError):
                    sales_volume = None
                
                # 处理上架时间字段 - 支持多种无效值
                listing_date_value = row.get('上架时间', '')
                listing_date = None
                if listing_date_value and pd.notna(listing_date_value) and str(listing_date_value).strip() not in invalid_values:
                    try:
                        # 尝试解析日期格式
                        if isinstance(listing_date_value, datetime):
                            listing_date = listing_date_value.date()
                        else:
                            # 支持多种日期格式
                            date_str = str(listing_date_value).strip()
                            # 尝试不同的日期格式
                            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y', '%d-%m-%Y', '%d/%m/%Y']:
                                try:
                                    listing_date = datetime.strptime(date_str, fmt).date()
                                    break
                                except ValueError:
                                    continue
                    except Exception:
                        listing_date = None
                
                # 处理价格字段 - 支持多种无效值
                price_value = row.get('价格', 0)
                try:
                    price = float(price_value) if pd.notna(price_value) and str(price_value).strip() not in invalid_values else None
                except (ValueError, TypeError):
                    price = None
                
                # 处理大类BSR增长数字段
                main_category_bsr_growth_value = row.get('main_category_bsr_growth', 0)
                try:
                    main_category_bsr_growth = int(main_category_bsr_growth_value) if pd.notna(main_category_bsr_growth_value) and str(main_category_bsr_growth_value).strip() not in invalid_values else None
                except (ValueError, TypeError):
                    main_category_bsr_growth = None
                
                # 处理大类BSR增长率字段
                main_category_bsr_growth_rate_value = row.get('main_category_bsr_growth_rate', 0)
                try:
                    main_category_bsr_growth_rate = float(main_category_bsr_growth_rate_value) if pd.notna(main_category_bsr_growth_rate_value) and str(main_category_bsr_growth_rate_value).strip() not in invalid_values else None
                except (ValueError, TypeError):
                    main_category_bsr_growth_rate = None
                
                # 根据来源字段确定product_type
                source = str(row.get('来源', '')) if pd.notna(row.get('来源')) else None
                if product_type == 'all':
                    if source and ('新品榜' in source or 'new' in source.lower()):
                        actual_product_type = 'new'
                    elif source and ('竞品' in source or 'reference' in source.lower()):
                        actual_product_type = 'reference'
                    else:
                        actual_product_type = 'new'
                else:
                    actual_product_type = product_type
                
                # 处理国家和数据筛选模式字段
                country = str(row.get('国家', '')) if pd.notna(row.get('国家')) else None
                data_filter_mode = str(row.get('数据筛选模式', '')) if pd.notna(row.get('数据筛选模式')) else None
                
                valid_products.append({
                    'asin': asin,
                    'product_title': product_title,
                    'price': price,
                    'image_url': str(row.get('图片URL', '')) if pd.notna(row.get('图片URL')) else None,
                    'store_name': str(row.get('店铺名', '')) if pd.notna(row.get('店铺名')) else None,
                    'store_url': str(row.get('店铺链接', '')) if pd.notna(row.get('店铺链接')) else None,
                    'shop_id': str(row.get('店铺ID', '')) if pd.notna(row.get('店铺ID')) else None,
                    'product_link': str(row.get('商品链接', '')) if pd.notna(row.get('商品链接')) else None,
                    'sales_volume': sales_volume,
                    'listing_date': listing_date,
                    'delivery_method': str(row.get('配送方式', '')) if pd.notna(row.get('配送方式')) else None,
                    'similar_products': str(row.get('相似商品', '')) if pd.notna(row.get('相似商品')) else None,
                    'source': source,
                    'main_category_name': str(row.get('main_category_name', '')) if pd.notna(row.get('main_category_name')) else None,
                    'main_category_rank': int(row.get('main_category_rank', 0)) if pd.notna(row.get('main_category_rank')) else None,
                    'product_type': actual_product_type,
                    'main_category_bsr_growth': main_category_bsr_growth,
                    'main_category_bsr_growth_rate': main_category_bsr_growth_rate,
                    'country': country,
                    'data_filter_mode': data_filter_mode
                })
                
            except Exception as e:
                failed_count += 1
                errors.append(f"第{index + 2}行: {str(e)}")
                if index < 3:
                    logger.error(f"[FAIL] 第{index + 2}行处理失败: {str(e)}")
        
        logger.info(f"[OK] 数据处理完成 | 有效产品: {len(valid_products)} | 失败: {failed_count} | 错误: {len(errors)}")
        
        # 开始事务
        conn = await service.mysql.begin_transaction()
        
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                if valid_products:
                    # 检查数据库中已存在的ASIN
                    asins_to_check = [p['asin'] for p in valid_products]
                    placeholders = ','.join(['%s'] * len(asins_to_check))
                    await cursor.execute(
                        f"SELECT asin, id FROM selection_products WHERE asin IN ({placeholders})",
                        asins_to_check
                    )
                    existing_records = {row['asin']: row['id'] for row in await cursor.fetchall()}
                    logger.info(f"[SEARCH] 检查数据库中已存在的ASIN | 检查数: {len(asins_to_check)} | 已存在: {len(existing_records)}")
                    
                    # 根据导入模式处理
                    products_to_insert = []
                    products_to_update = []
                    
                    print(f"=== 导入模式处理调试 ===")
                    print(f"导入模式: {mode}")
                    print(f"有效产品数: {len(valid_products)}")
                    print(f"已存在ASIN数: {len(existing_records)}")
                    print(f"已存在ASIN列表: {list(existing_records.keys())[:10]}...")  # 只显示前10个
                    
                    for p in valid_products:
                        if p['asin'] in existing_records:
                            print(f"ASIN {p['asin']} 已存在")
                            if mode == 'skip':
                                skip_count += 1
                                errors.append(f"ASIN {p['asin']} 已存在，已跳过")
                                print(f"  -> 跳过")
                            elif mode == 'update':
                                products_to_update.append(p)
                                print(f"  -> 添加到更新列表")
                            elif mode == 'overwrite':
                                # 先删除已存在的记录
                                await cursor.execute(
                                    "DELETE FROM selection_products WHERE id = %s",
                                    (existing_records[p['asin']],)
                                )
                                products_to_insert.append(p)
                                print(f"  -> 删除并添加到插入列表")
                        else:
                            products_to_insert.append(p)
                            print(f"ASIN {p['asin']} 不存在，添加到插入列表")
                    
                    print(f"=== 处理结果 ===")
                    print(f"待插入: {len(products_to_insert)}")
                    print(f"待更新: {len(products_to_update)}")
                    print(f"跳过: {skip_count}")
                    
                    logger.info(f"[NOTE] 待插入: {len(products_to_insert)} | 待更新: {len(products_to_update)} | 跳过: {skip_count}")
                    
                    # 批量插入
                    if products_to_insert:
                        now = datetime.now()
                        insert_query = """
                            INSERT INTO selection_products 
                            (asin, product_title, price, image_url, local_path, thumb_path, 
                             store_name, store_url, shop_id, tags, notes, product_type,
                             product_link, sales_volume, listing_date, delivery_method, 
                             similar_products, source, main_category_name, main_category_rank, 
                             main_category_bsr_growth, main_category_bsr_growth_rate, 
                             country, data_filter_mode, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        
                        insert_params = [
                            (
                                p['asin'],
                                p['product_title'],
                                p['price'],
                                p['image_url'],
                                None,
                                None,
                                p['store_name'],
                                p['store_url'],
                                p['shop_id'],
                                None,
                                None,
                                p['product_type'],
                                p['product_link'],
                                p['sales_volume'],
                                p['listing_date'],
                                p['delivery_method'],
                                p['similar_products'],
                                p['source'],
                                p['main_category_name'],
                                p['main_category_rank'],
                                p['main_category_bsr_growth'],
                                p['main_category_bsr_growth_rate'],
                                p['country'],
                                p['data_filter_mode'],
                                now,
                                now
                            )
                            for p in products_to_insert
                        ]
                        
                        await cursor.executemany(insert_query, insert_params)
                        success_count = len(products_to_insert)
                    
                    # 批量更新
                    if products_to_update:
                        now = datetime.now()
                        update_query = """
                            UPDATE selection_products SET
                                product_title = %s,
                                price = %s,
                                image_url = %s,
                                store_name = %s,
                                store_url = %s,
                                shop_id = %s,
                                product_link = %s,
                                sales_volume = %s,
                                listing_date = %s,
                                delivery_method = %s,
                                similar_products = %s,
                                source = %s,
                                main_category_name = %s,
                                main_category_rank = %s,
                                main_category_bsr_growth = %s,
                                main_category_bsr_growth_rate = %s,
                                country = %s,
                                data_filter_mode = %s,
                                updated_at = %s
                            WHERE asin = %s
                        """
                        
                        update_params = [
                            (
                                p['product_title'],
                                p['price'],
                                p['image_url'],
                                p['store_name'],
                                p['store_url'],
                                p['shop_id'],
                                p['product_link'],
                                p['sales_volume'],
                                p['listing_date'],
                                p['delivery_method'],
                                p['similar_products'],
                                p['source'],
                                p['main_category_name'],
                                p['main_category_rank'],
                                p['main_category_bsr_growth'],
                                p['main_category_bsr_growth_rate'],
                                p['country'],
                                p['data_filter_mode'],
                                now,
                                p['asin']
                            )
                            for p in products_to_update
                        ]
                        
                        await cursor.executemany(update_query, update_params)
                        update_count = len(products_to_update)
            
            # 提交事务
            await service.mysql.commit_transaction(conn)

        except Exception as e:
            # 回滚事务
            await service.mysql.rollback_transaction(conn)
            logger.error(f"导入选品产品失败，已回滚事务: {e}")
            raise HTTPException(status_code=500, detail=f"导入选品产品失败: {str(e)}")

        # 导入后自动评分 + 周标记
        scoring_result = None
        if auto_score and (success_count > 0 or update_count > 0):
            try:
                from ...services.scoring_engine import ScoringEngine
                engine = ScoringEngine(service.mysql)
                week_tag = await engine.get_current_week_tag()

                # 标记周（如果是新周，旧数据自动降级）
                await engine.mark_week(week_tag)

                # 更新本批导入数据的 week_tag 和 is_current
                imported_asins = [p['asin'] for p in valid_products if p['asin'] not in duplicate_asins]
                if imported_asins:
                    placeholders = ','.join(['%s'] * len(imported_asins))
                    await service.mysql.execute_update(
                        f"UPDATE selection_products SET week_tag = %s, is_current = 1 WHERE asin IN ({placeholders})",
                        [week_tag] + imported_asins
                    )

                    # 计算评分
                    query = f"""SELECT id, asin, delivery_method, listing_date, sales_volume,
                               main_category_rank, price FROM selection_products WHERE asin IN ({placeholders})"""
                    products_to_score = await service.mysql.execute_query(query, tuple(imported_asins))

                    results = await engine.score_products_batch(products_to_score)
                    for r in results:
                        await service.mysql.execute_update(
                            "UPDATE selection_products SET score = %s, grade = %s WHERE id = %s",
                            (r['score'], r['grade'], r['id'])
                        )

                    # 统计各等级
                    grade_stats = {}
                    for r in results:
                        g = r['grade']
                        grade_stats[g] = grade_stats.get(g, 0) + 1

                    scoring_result = {
                        "week_tag": week_tag,
                        "scored_count": len(results),
                        "grade_stats": grade_stats
                    }
                    logger.info(f"[OK] 自动评分完成 | 周: {week_tag} | 评分数量: {len(results)} | 等级分布: {grade_stats}")
            except Exception as e:
                logger.error(f"[WARN] 自动评分失败（不影响导入结果）: {e}")
                scoring_result = {"error": str(e)}

        # 根据导入结果返回不同的状态码和消息
        if failed_count > 0 and success_count == 0:
            # 所有数据都失败
            return {
                "code": 400,
                "message": f"导入失败，所有{failed_count}条数据都有错误，请检查Excel文件格式",
                "data": {
                    "success": success_count,
                    "update": update_count,
                    "skip": skip_count,
                    "failed": failed_count,
                    "errors": errors[:20]
                }
            }
        elif failed_count > 0:
            # 部分数据失败
            message = f"导入完成，成功{success_count}条，更新{update_count}条，跳过{skip_count}条，失败{failed_count}条"
            if skipped_count > 0:
                message += f"（跳过{skipped_count}个空行）"
            data = {
                "success": success_count,
                "update": update_count,
                "skip": skip_count,
                "failed": failed_count,
                "skipped": skipped_count,
                "errors": errors[:20]
            }
            if scoring_result:
                data["scoring"] = scoring_result
            return {
                "code": 200,
                "message": message,
                "data": data
            }
        else:
            # 全部成功
            message = f"导入完成，成功{success_count}条，更新{update_count}条，跳过{skip_count}条"
            if skipped_count > 0:
                message += f"（跳过{skipped_count}个空行）"
            data = {
                "success": success_count,
                "update": update_count,
                "skip": skip_count,
                "failed": failed_count,
                "skipped": skipped_count,
                "errors": errors[:20]
            }
            if scoring_result:
                data["scoring"] = scoring_result
            return {
                "code": 200,
                "message": message,
                "data": data
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入选品产品失败: {e}")
        raise HTTPException(status_code=500, detail="导入选品产品失败")


@router.get("/template", summary="下载选品导入模板")
async def download_selection_template():
    """
    下载选品导入模板
    
    返回包含所有必需字段的Excel模板文件
    """
    try:
        import pandas as pd
        from io import BytesIO
        from fastapi.responses import Response
        
        template_data = {
            'ASIN': ['B08XXXXX', 'B09XXXXX'],
            '商品标题': ['示例商品标题1', '示例商品标题2'],
            '商品链接': ['https://amazon.com/dp/B08XXXXX', 'https://amazon.com/dp/B09XXXXX'],
            '价格': [99.99, 199.99],
            '图片链接': ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
            '店铺名称': ['示例店铺1', '示例店铺2'],
            '店铺链接': ['https://amazon.com/shop/store1', 'https://amazon.com/shop/store2'],
            '店铺ID': ['A1XXXXX', 'A2XXXXX'],
            '销量': [1000, 500],
            '上架时间(天)': [30, 60],
            '配送方式': ['FBA', 'FBM'],
            '相似商品链接': ['https://amazon.com/dp/B08YYYYY,https://amazon.com/dp/B08ZZZZZ', 'https://amazon.com/dp/B09YYYYY,https://amazon.com/dp/B09ZZZZZ'],
            '来源': ['新品榜', '竞品店铺'],
            '大类榜单名': ['电子产品', '家居用品'],
            '榜单排名': [10, 20],
            '大类BSR增长数': [100, 200],
            '大类BSR增长率': [5.5, 10.2],
            '国家': ['英国', '德国'],
            '数据筛选模式': ['模式一', '模式二']
        }
        
        df = pd.DataFrame(template_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='选品导入模板')
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=selection_import_template.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"下载选品模板失败: {e}")
        raise HTTPException(status_code=500, detail="下载选品模板失败")


@router.post("/products/export-asins", summary="导出选中商品的ASIN")
async def export_selected_asins(
    request_data: Dict[str, Any] = Body(..., description="导出请求"),
    service: SelectionService = get_selection_service()
):
    """
    导出选中商品的ASIN到文本文件
    
    - **asins**: 要导出的ASIN列表
    
    返回包含ASIN列表的文本文件
    """
    try:
        # 获取ASIN列表
        asins = request_data.get("asins", [])
        
        if not asins:
            raise HTTPException(status_code=400, detail="请选择要导出的商品")
        
        logger.info(f"[OUTBOX] 开始导出ASIN | 数量: {len(asins)}")
        
        # 生成文本文件内容
        content = "\n".join(asins)
        
        # 创建文件名（包含时间戳）
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"selected_asins_{timestamp}.txt"
        
        # 返回文件
        from fastapi.responses import Response
        return Response(
            content=content.encode('utf-8'),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出ASIN失败: {e}")
        raise HTTPException(status_code=500, detail="导出ASIN失败")
