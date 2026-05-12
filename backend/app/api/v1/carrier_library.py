"""
[参考] 运营商库API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: CarrierLibraryController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from typing import List, Dict, Optional
import json
import os
import logging
import aiomysql
from datetime import datetime
from urllib.parse import urlparse
import aiohttp
import zipfile
from io import BytesIO
import asyncio
import hashlib

from ...models import (
    CarrierLibraryCreate,
    CarrierLibraryUpdate,
    CarrierLibraryResponse,
    BatchOperationRequest
)

from ...config import settings
from ...services.library_image_service import get_library_image_service
from ...repositories import MySQLRepository
from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/carrier-library", tags=["carrier_library"])

# 批量导入请求限流配置
MAX_CONCURRENT_BATCH_REQUESTS = 10  # 最大并发批量导入请求数
current_batch_requests = 0  # 当前正在进行的批量导入请求数
batch_request_lock = asyncio.Lock()  # 用于保护计数器的锁


def _convert_image_paths_to_urls(images_data):
    """
    将图片路径转换为URL

    Args:
        images_data: 图片路径数据，可以是JSON格式的字符串或直接的列表

    Returns:
        list: 转换后的图片URL列表
    """
    try:
        images = []
        
        # 处理输入数据，支持JSON字符串和直接列表
        if isinstance(images_data, str):
            try:
                images = json.loads(images_data)
            except json.JSONDecodeError:
                # 如果不是有效的JSON，尝试作为单个图片URL处理
                if images_data.strip():
                    images = [images_data.strip()]
        elif isinstance(images_data, list):
            # 已经是列表，直接使用
            images = images_data
        elif isinstance(images_data, dict):
            # 如果是字典，尝试提取图片路径
            logger.warning(f"图片数据是字典类型，可能格式有误: {images_data}")
            images = []
        else:
            # 其他类型，转换为字符串列表
            logger.warning(f"图片数据类型未知: {type(images_data)}")
            if images_data:
                images = [str(images_data)]
        
        # 确保images是列表
        if not isinstance(images, list):
            images = [images]
        
        # 转换图片路径为URL
        image_urls = []
        for img_path in images:
            if isinstance(img_path, str):
                img_path = img_path.strip()
                if not img_path:
                    continue
                    
                # 检查是否已经是完整URL
                # 包括HTTP/HTTPS协议
                if img_path.startswith(('http://', 'https://')):
                    # 已经是完整URL，直接使用，确保HTTPS协议
                    img_url = img_path
                    if img_url.startswith('http://'):
                        img_url = img_url.replace('http://', 'https://')
                    image_urls.append(img_url)
                elif img_path.startswith('//'):
                    # 协议相对URL，添加HTTPS协议
                    image_urls.append(f"https:{img_path}")
                elif img_path.startswith(('/images/', '/thumbnails/')):
                    # 已经是本地URL格式，直接使用
                    image_urls.append(img_path)
                elif img_path.startswith('/'):
                    # 是本地绝对路径，转换为URL
                    filename = os.path.basename(img_path)
                    image_urls.append(f"/images/{filename}")
                else:
                    # 直接将其作为文件名处理，不添加https前缀
                    # 对于测试用的假图片路径，直接返回原路径
                    # 对于真实的相对路径，保持原有逻辑
                    logger.debug(f"处理文件名或相对路径: {img_path}")
                    image_urls.append(img_path)
            elif isinstance(img_path, dict) and img_path.get('url'):
                # 支持字典格式，如 {"url": "image.jpg"}
                img_url = img_path.get('url', '')
                if isinstance(img_url, str) and img_url.strip():
                    img_url = img_url.strip()
                    # 确保HTTPS协议
                    if img_url.startswith(('http://', 'https://')):
                        if img_url.startswith('http://'):
                            img_url = img_url.replace('http://', 'https://')
                        image_urls.append(img_url)
                    elif img_url.startswith('//'):
                        image_urls.append(f"https:{img_url}")
                    else:
                        # 直接将其作为文件名处理，不添加https前缀
                        image_urls.append(img_url)
            elif img_path:
                # 其他非空类型，转换为字符串
                img_str = str(img_path)
                if img_str.strip():
                    # 直接将其作为结果返回，不进行额外处理
                    image_urls.append(img_str)
        
        logger.debug(f"图片路径转换完成 - 原始数据: {images_data}, 转换结果: {image_urls}")
        return image_urls
    except Exception as e:
        # 处理所有可能的错误
        logger.error(f"转换图片路径时发生错误: {str(e)}", exc_info=True)
        return []


def _extract_cos_object_key(image_url: str) -> Optional[str]:
    """
    从图片URL中提取腾讯云COS对象键
    
    Args:
        image_url: 图片URL
        
    Returns:
        COS对象键，如果提取失败返回None
    """
    if not image_url:
        return None
    
    try:
        # 解析URL，提取路径部分
        parsed_url = urlparse(image_url)
        path = parsed_url.path.lstrip('/')
        
        # 对于腾讯云COS URL，路径就是对象键
        return path
    except Exception as e:
        logger.error(f"提取COS对象键失败，URL: {image_url}, 错误: {str(e)}")
        return None


def _generate_thumbnail_object_keys(object_key: str) -> list[str]:
    """
    根据原图对象键生成所有可能的缩略图对象键
    
    Args:
        object_key: 原图对象键
        
    Returns:
        缩略图对象键列表
    """
    try:
        thumbnail_keys = []
        
        # 解析对象键，获取文件名和前缀
        dirname, filename = os.path.split(object_key)
        name_without_ext, ext = os.path.splitext(filename)
        
        # 生成不同类型的缩略图对象键
        
        # 1. 缩略图专用路径格式：thumbnails/xxx
        if not dirname.endswith('thumbnails'):
            thumbnail_dir = 'thumbnails'
            thumbnail_keys.append(os.path.join(thumbnail_dir, filename))
        
        # 2. 同路径下的缩略图格式：xxx_512x512.webp
        thumbnail_filename = f"{name_without_ext}_512x512.webp"
        thumbnail_keys.append(os.path.join(dirname, thumbnail_filename))
        
        # 3. 载体库专用路径：carrier_library/xxx_512x512.webp
        if dirname.endswith('carrier_library'):
            carrier_thumbnail_filename = f"{name_without_ext}_512x512.webp"
            thumbnail_keys.append(os.path.join(dirname, carrier_thumbnail_filename))
        
        # 去重并返回
        return list(set(thumbnail_keys))
    except Exception as e:
        logger.error(f"生成缩略图对象键失败，原图对象键: {object_key}, 错误: {str(e)}")
        return []


async def _delete_cos_images(mysql_repo, carrier_id: int, carrier_sku: str) -> None:
    """
    删除载体库相关的腾讯云COS图片、本地缩略图和images表记录
    
    Args:
        mysql_repo: MySQL数据库仓库实例
        carrier_id: 载体ID
        carrier_sku: 载体SKU
    """
    try:
        from ...services.cos_service import cos_service
        
        # 如果COS服务未启用，直接返回
        if not cos_service.enabled:
            logger.warning(f"COS服务未启用，跳过删除图片操作 - 载体ID: {carrier_id}, SKU: {carrier_sku}")
            return
        
        # 获取回收站载体信息
        try:
            # 尝试获取包含本地缩略图路径的信息
            recycle_carrier = await mysql_repo.execute_query(
                "SELECT images, reference_images, local_thumbnail_path FROM carrier_library_recycle_bin WHERE id = %s OR sku = %s", 
                (carrier_id, carrier_sku), 
                fetch_one=True
            )
        except Exception as e:
            # 如果local_thumbnail_path字段不存在，使用不包含该字段的查询
            logger.warning(f"获取本地缩略图路径失败，尝试使用兼容查询 - 错误: {str(e)}")
            recycle_carrier = await mysql_repo.execute_query(
                "SELECT images, reference_images FROM carrier_library_recycle_bin WHERE id = %s OR sku = %s", 
                (carrier_id, carrier_sku), 
                fetch_one=True
            )
        
        if not recycle_carrier:
            logger.warning(f"回收站载体不存在，跳过删除图片操作 - 载体ID: {carrier_id}, SKU: {carrier_sku}")
            return
        
        # 处理images字段
        images = _convert_image_paths_to_urls(recycle_carrier.get('images', []))
        # 处理reference_images字段
        reference_images = _convert_image_paths_to_urls(recycle_carrier.get('reference_images', []))
        # 获取本地缩略图路径
        local_thumbnail_path = recycle_carrier.get('local_thumbnail_path')
        
        # 合并所有图片URL
        all_images = images + reference_images
        
        logger.info(f"开始删除载体相关的图片 - 载体ID: {carrier_id}, SKU: {carrier_sku}, 图片数量: {len(all_images)}")
        
        # 删除本地缩略图
        if local_thumbnail_path:
            try:
                # 检查文件存在性
                if os.path.exists(local_thumbnail_path):
                    os.remove(local_thumbnail_path)
                    logger.info(f"成功删除本地缩略图 - 路径: {local_thumbnail_path}, 载体ID: {carrier_id}, SKU: {carrier_sku}")
                else:
                    logger.warning(f"本地缩略图文件不存在，跳过删除 - 路径: {local_thumbnail_path}, 载体ID: {carrier_id}, SKU: {carrier_sku}")
            except Exception as e:
                logger.error(f"删除本地缩略图失败 - 路径: {local_thumbnail_path}, 载体ID: {carrier_id}, SKU: {carrier_sku}, 错误: {str(e)}")
                # 本地缩略图删除失败不影响主流程，只记录日志
        
        # 删除每张图片和对应的缩略图
        for image_url in all_images:
            # 提取COS对象键
            object_key = _extract_cos_object_key(image_url)
            if object_key:
                # 删除原图/参考图
                success, error_msg = await cos_service.delete_image(object_key)
                if success:
                    logger.info(f"成功删除COS图片 - 对象键: {object_key}, 载体ID: {carrier_id}, SKU: {carrier_sku}")
                else:
                    logger.error(f"删除COS图片失败 - 对象键: {object_key}, 载体ID: {carrier_id}, SKU: {carrier_sku}, 错误: {error_msg}")
                
                # 生成所有可能的缩略图对象键
                thumbnail_keys = _generate_thumbnail_object_keys(object_key)
                
                # 删除所有对应的缩略图
                for thumbnail_key in thumbnail_keys:
                    success, error_msg = await cos_service.delete_image(thumbnail_key)
                    if success:
                        logger.info(f"成功删除缩略图 - 对象键: {thumbnail_key}, 载体ID: {carrier_id}, SKU: {carrier_sku}")
                    else:
                        # 缩略图删除失败不影响主流程，只记录日志
                        logger.warning(f"删除缩略图失败 - 对象键: {thumbnail_key}, 载体ID: {carrier_id}, SKU: {carrier_sku}, 错误: {error_msg}")
            else:
                logger.warning(f"无法提取COS对象键，跳过删除 - URL: {image_url}, 载体ID: {carrier_id}, SKU: {carrier_sku}")
        
        # 删除images表中与该载体SKU相关的记录
        try:
            delete_images_result = await mysql_repo.execute_update(
                "DELETE FROM images WHERE sku = %s", 
                (carrier_sku,)
            )
            logger.info(f"成功删除images表记录 - 载体SKU: {carrier_sku}, 删除记录数: {delete_images_result}")
        except Exception as e:
            logger.error(f"删除images表记录失败 - 载体SKU: {carrier_sku}, 错误: {str(e)}")
            # images表记录删除失败不影响主流程，只记录日志
    except Exception as e:
        logger.error(f"删除载体COS图片失败 - 载体ID: {carrier_id}, SKU: {carrier_sku}, 错误: {str(e)}", exc_info=True)


def get_mysql_repo():
    """
    依赖注入：获取MySQLRepository实例

    Returns:
        MySQLRepository实例
    """
    from fastapi import Request

    def _get_repo(request: Request):
        return request.app.state.mysql

    return Depends(_get_repo)


@router.get("")
async def get_carrier_library_no_slash(
    search_type: Optional[str] = Query("sku", description="搜索类型"),
    search_content: Optional[str] = Query(None, description="搜索内容"),
    developer: Optional[List[str]] = Query(None, description="开发人筛选"),
    status: Optional[List[str]] = Query(None, description="状态筛选"),
    carrier: Optional[List[str]] = Query(None, description="载体筛选"),
    batch: Optional[List[str]] = Query(None, description="批次筛选"),
    sort_by: Optional[str] = Query("create_time", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    page: int = Query(1, ge=1, description="当前页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取载体库列表（无末尾斜杠路由）

    支持搜索、筛选、排序和分页
    """
    # 调用带斜杠路由的处理函数
    return await get_carrier_library(
        search_type=search_type,
        search_content=search_content,
        developer=developer,
        status=status,
        carrier=carrier,
        batch=batch,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size,
        mysql_repo=mysql_repo
    )


@router.get("/")
async def get_carrier_library(
    search_type: Optional[str] = Query("sku", description="搜索类型"),
    search_content: Optional[str] = Query(None, description="搜索内容"),
    developer: Optional[List[str]] = Query(None, description="开发人筛选"),
    status: Optional[List[str]] = Query(None, description="状态筛选"),
    carrier: Optional[List[str]] = Query(None, description="载体筛选"),
    batch: Optional[List[str]] = Query(None, description="批次筛选"),
    sort_by: Optional[str] = Query("create_time", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    page: int = Query(1, ge=1, description="当前页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取载体库列表

    支持搜索、筛选、排序和分页
    """
    try:
        logger.info(f"开始获取载体库列表 - 搜索类型: {search_type}, 搜索内容: {search_content}, 页码: {page}, 每页数量: {size}")
        # 构建查询条件
        conditions = []
        params = []

        # 搜索条件
        if search_content:
            # 检查是否包含空格，支持多项精确搜索
            has_space = ' ' in search_content
            
            if has_space:
                # 多项搜索处理
                # 拆分搜索内容为列表，去除空项和前后空格
                search_items = [item.strip() for item in search_content.split(' ') if item.strip()]
                
                if search_items:
                    if search_type == "batch":
                        # 批次多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"batch IN ({placeholders})")
                        params.extend(search_items)
                    elif search_type == "developer":
                        # 开发人多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"developer IN ({placeholders})")
                        params.extend(search_items)
                    elif search_type == "carrier":
                        # 载体多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"carrier IN ({placeholders})")
                        params.extend(search_items)
                    elif search_type == "element":
                        # 元素多项模糊搜索，使用OR条件
                        element_conditions = []
                        for item in search_items:
                            element_conditions.append(f"element LIKE %s")
                            params.append(f"%{item}%")
                        if element_conditions:
                            conditions.append(f"({') OR ('.join(element_conditions)})")
                    elif search_type == "status":
                        # 状态多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"status IN ({placeholders})")
                        params.extend(search_items)
                    elif search_type == "carrier_name":
                        # 载体名称多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"carrier_name IN ({placeholders})")
                        params.extend(search_items)
            else:
                # 单项搜索处理（原有逻辑）
                if search_type == "batch":
                    conditions.append("batch LIKE %s")
                    params.append(f"%{search_content}%")
                elif search_type == "element":
                    conditions.append("element LIKE %s")
                    params.append(f"%{search_content}%")
                elif search_type == "developer":
                    conditions.append("developer LIKE %s")
                    params.append(f"%{search_content}%")
                elif search_type == "carrier":
                    conditions.append("carrier LIKE %s")
                    params.append(f"%{search_content}%")
                elif search_type == "status":
                    conditions.append("status = %s")
                    params.append(search_content)
                elif search_type == "carrier_name":
                    conditions.append("carrier_name LIKE %s")
                    params.append(f"%{search_content}%")

        # 筛选条件
        if developer and len(developer) > 0:
            placeholders = ",".join(["%s"] * len(developer))
            conditions.append(f"developer IN ({placeholders})")
            params.extend(developer)

        if status and len(status) > 0:
            placeholders = ",".join(["%s"] * len(status))
            conditions.append(f"status IN ({placeholders})")
            params.extend(status)

        if carrier and len(carrier) > 0:
            placeholders = ",".join(["%s"] * len(carrier))
            conditions.append(f"carrier IN ({placeholders})")
            params.extend(carrier)

        if batch and len(batch) > 0:
            placeholders = ",".join(["%s"] * len(batch))
            conditions.append(f"batch IN ({placeholders})")
            params.extend(batch)

        # 构建WHERE子句
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        # 构建排序子句
        valid_sort_fields = ["id", "batch", "developer", "carrier", "carrier_name", "status", "create_time", "update_time"]
        if sort_by not in valid_sort_fields:
            sort_by = "create_time"

        sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"
        order_by_clause = f"ORDER BY {sort_by} {sort_order}"

        # 构建分页子句
        offset = (page - 1) * size
        limit_clause = "LIMIT %s OFFSET %s"
        params.extend([size, offset])

        # 执行主查询
        query = f"SELECT * FROM carrier_library {where_clause} {order_by_clause} {limit_clause}"
        logger.debug(f"执行载体库列表查询 - SQL: {query}, 参数: {tuple(params)}")
        carriers = await mysql_repo.execute_query(query, tuple(params))
        
        # 确保carriers是数组
        if not isinstance(carriers, list):
            logger.error(f"获取载体库列表失败 - 返回数据不是数组: {type(carriers)}")
            carriers = []
        
        logger.info(f"获取载体库列表成功 - 数量: {len(carriers)}")

        # 计算总数
        count_query = f"SELECT COUNT(*) as total FROM carrier_library {where_clause}"
        count_params = tuple(params[:-2]) if len(params) >= 2 else tuple(params)
        logger.debug(f"执行载体库总数查询 - SQL: {count_query}, 参数: {count_params}")
        count_result = await mysql_repo.execute_query(count_query, count_params, fetch_one=True)
        
        # 确保count_result是字典类型
        total = 0
        if isinstance(count_result, dict):
            total = count_result.get("total", 0)
            # 确保总数与实际数据数量一致
            if total > 0 and len(carriers) == 0:
                # 总数大于0，但实际查询到的数据为0，可能是分页或筛选条件导致，使用实际数据数量
                logger.warning(f"计数查询返回{total}，但实际查询到0条数据，可能是分页或筛选条件导致，已修正总数为0")
                total = 0
            elif total == 0 and len(carriers) > 0:
                # 如果总数为0，但实际查询到了数据，使用实际数据数量作为总数
                total = len(carriers)
                logger.warning(f"计数查询返回0，但实际查询到{len(carriers)}条数据，已使用实际数量作为总数")
            elif len(carriers) > total:
                # 实际数据数量大于计数，以实际为准
                total = len(carriers)
                logger.warning(f"实际查询到{len(carriers)}条数据，大于计数查询返回的{total}，已修正总数")
        else:
            total = len(carriers)
            logger.warning(f"计数查询返回值不是字典类型: {type(count_result)}，已使用实际查询数量作为总数")
        
        logger.info(f"获取载体库总数成功 - 总数: {total}")
        
        # 确保carriers和total一致
        if len(carriers) > total:
            # 实际数据数量大于计数，截断数据或修正计数
            logger.warning(f"实际数据数量{len(carriers)}大于计数{total}，已修正总数")
            total = len(carriers)
        elif total == 0 and len(carriers) > 0:
            # 总数为0，但实际查询到数据，重置为一致
            logger.warning(f"总数为0，但实际查询到{len(carriers)}条数据，已修正总数为实际数量")
            total = len(carriers)

        # 处理JSON字段并将图片路径转换为URL
        for carrier in carriers:
            try:
                carrier["images"] = _convert_image_paths_to_urls(carrier["images"])
            except Exception as e:
                carrier["images"] = []
                logger.error(f"处理载体ID {carrier['id']} 的images字段失败: {str(e)}")
            
            try:
                carrier["reference_images"] = _convert_image_paths_to_urls(carrier["reference_images"])
            except Exception as e:
                carrier["reference_images"] = []
                logger.error(f"处理载体ID {carrier['id']} 的reference_images字段失败: {str(e)}")

        # 使用CarrierLibraryResponse模型序列化每个载体，确保字段名转换为驼峰命名
        serialized_carriers = [CarrierLibraryResponse(**carrier) for carrier in carriers]
        
        # 构建统一格式响应，确保list始终是数组
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": serialized_carriers or [],
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        logger.error(f"获取载体库列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取载体库列表失败: {str(e)}")


@router.post("")
async def create_carrier_library_no_slash(
    carrier: CarrierLibraryCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新载体（无末尾斜杠路由）
    """
    return await create_carrier_library(carrier, mysql_repo)


@router.post("/")
async def create_carrier_library(
    carrier: CarrierLibraryCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新载体
    """
    try:
        logger.info(f"开始创建新载体 - 批次: {carrier.batch}, 开发人: {carrier.developer}")

        # 插入数据
        insert_query = """
        INSERT INTO carrier_library (images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, local_thumbnail_path, local_thumbnail_status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            json.dumps(carrier.images),
            carrier.product_size,
            carrier.carrier_name,
            carrier.material,
            carrier.process,
            carrier.weight,
            carrier.packaging_method,
            carrier.packaging_size,
            carrier.price,
            carrier.min_order_quantity,
            carrier.supplier,
            carrier.supplier_link,
            None,  # local_thumbnail_path
            'pending'  # local_thumbnail_status
        ]

        logger.debug(f"执行载体插入 - SQL: {insert_query}, 参数: {tuple(params)}")
        result = await mysql_repo.execute_insert(insert_query, tuple(params))
        carrier_id = result['last_id']
        logger.info(f"载体插入成功 - ID: {carrier_id}")

        # 获取插入的数据
        created_carrier = await mysql_repo.execute_query(
            "SELECT * FROM carrier_library WHERE id = %s",
            (carrier_id,),
            fetch_one=True
        )

        # 处理JSON字段并将图片路径转换为URL
        try:
            if created_carrier:
                # 只有当created_carrier不是None时才处理
                carrier_id_log = created_carrier.get('id', carrier_id)
                
                try:
                    created_carrier["images"] = _convert_image_paths_to_urls(created_carrier["images"])
                except Exception as e:
                    created_carrier["images"] = []
                    logger.error(f"处理新创建的载体ID {carrier_id_log} 的images字段失败: {str(e)}")
                
                try:
                    created_carrier["reference_images"] = _convert_image_paths_to_urls(created_carrier["reference_images"])
                except Exception as e:
                    created_carrier["reference_images"] = []
                    logger.error(f"处理新创建的载体ID {carrier_id_log} 的reference_images字段失败: {str(e)}")
                
                # 从腾讯云下载已生成的缩略图到本地
                local_thumbnail_path = None
                all_images = created_carrier.get("images", []) + created_carrier.get("reference_images", [])
                
                if all_images:
                    # 优先使用第一张图片
                    first_image = all_images[0]
                    logger.info(f"开始下载第一张图片的本地缩略图: {first_image}")
                    local_thumbnail_path = await _download_local_thumbnail(first_image)
                    
                    if local_thumbnail_path:
                        logger.info(f"成功下载本地缩略图: {local_thumbnail_path}")
                        # 更新数据库中的本地缩略图路径
                        update_query = """
                        UPDATE carrier_library 
                        SET local_thumbnail_path = %s, 
                            local_thumbnail_status = %s, 
                            local_thumbnail_updated_at = %s 
                        WHERE id = %s
                        """
                        update_params = [
                            local_thumbnail_path,
                            'completed',
                            datetime.now(),
                            carrier_id_log
                        ]
                        await mysql_repo.execute_update(update_query, update_params)
                        # 更新created_carrier中的本地缩略图路径
                        created_carrier["local_thumbnail_path"] = local_thumbnail_path
                        created_carrier["local_thumbnail_status"] = 'completed'
                        created_carrier["local_thumbnail_updated_at"] = datetime.now().isoformat()
                    else:
                        logger.warning(f"下载本地缩略图失败: {first_image}")
                        # 更新数据库中的本地缩略图状态为失败
                        update_query = """
                        UPDATE carrier_library 
                        SET local_thumbnail_status = %s 
                        WHERE id = %s
                        """
                        await mysql_repo.execute_update(update_query, ['failed', carrier_id_log])
                        created_carrier["local_thumbnail_status"] = 'failed'
            else:
                logger.warning(f"获取新创建的载体ID {carrier_id} 失败，使用插入数据构建响应")
                # 如果获取失败，使用插入的数据构建响应
                created_carrier = {
                    "id": carrier_id,
                    "sku": carrier.sku,
                    "batch": carrier.batch,
                    "developer": carrier.developer,
                    "carrier": carrier.carrier,
                    "modification_requirement": carrier.modification_requirement,
                    "images": carrier.images or [],
                    "reference_images": carrier.reference_images or [],
                    "status": carrier.status,
                    "create_time": datetime.now().isoformat(),
                    "update_time": datetime.now().isoformat()
                }
        except Exception as e:
            logger.error(f"处理创建的载体数据失败: {str(e)}")
            # 发生异常时，使用默认值构建响应
            created_carrier = {
                "id": carrier_id,
                "sku": carrier.sku,
                "batch": carrier.batch,
                "developer": carrier.developer,
                "carrier": carrier.carrier,
                "modification_requirement": carrier.modification_requirement,
                "images": [],
                "reference_images": [],
                "status": carrier.status,
                "create_time": datetime.now().isoformat(),
                "update_time": datetime.now().isoformat()
            }

        # 使用CarrierLibraryResponse模型序列化，确保字段名转换为驼峰命名
        carrier_response = CarrierLibraryResponse(**created_carrier)
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "创建成功",
            "data": carrier_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建载体失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建载体失败: {str(e)}")


@router.post("/batch-create")
async def batch_create_carrier_library(
    carriers: List[CarrierLibraryCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建载体
    """
    return await _batch_create_carrier_library(carriers, mysql_repo)


@router.post("/batch-create/")
async def _batch_create_carrier_library(
    carriers: List[CarrierLibraryCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建载体
    """
    global current_batch_requests
    
    # 检查并发请求数
    async with batch_request_lock:
        if current_batch_requests >= MAX_CONCURRENT_BATCH_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail=f"批量导入请求过于频繁，请稍后重试。当前最大并发请求数: {MAX_CONCURRENT_BATCH_REQUESTS}"
            )
        current_batch_requests += 1
    
    try:
        logger.info(f"开始批量创建载体 - 数量: {len(carriers)}, 当前并发请求数: {current_batch_requests}")
        success = 0
        failed = 0
        errors = []

        if not carriers:
            return {
                "code": 200,
                "message": "批量创建完成",
                "data": {
                    "success": 0,
                    "failed": 0,
                    "errors": []
                }
            }

        # 1. 准备批量插入数据和错误信息
        insert_data = []
        
        for carrier_data in carriers:
            # 生成唯一的SKU（使用前端传入的sku，如果没有则自动生成）
            import time
            import random
            sku = carrier_data.sku or f"CR{int(time.time() * 1000)}{random.randint(1000, 9999)}"
            
            # 准备插入数据 - 使用sku
            insert_data.append([
                sku,  # SKU（前端传入或自动生成）
                json.dumps(carrier_data.images),
                json.dumps(getattr(carrier_data, 'reference_images', [])),
                getattr(carrier_data, 'batch', ''),
                getattr(carrier_data, 'developer', ''),
                getattr(carrier_data, 'carrier', ''),
                getattr(carrier_data, 'product_size', ''),
                carrier_data.carrier_name or sku,  # carrier_name（如果没有则使用sku）
                getattr(carrier_data, 'material', ''),
                getattr(carrier_data, 'process', ''),
                getattr(carrier_data, 'weight', None),
                getattr(carrier_data, 'packaging_method', ''),
                getattr(carrier_data, 'packaging_size', ''),
                getattr(carrier_data, 'price', None),
                getattr(carrier_data, 'min_order_quantity', None),
                getattr(carrier_data, 'supplier', ''),
                getattr(carrier_data, 'supplier_link', '')
            ])

        # 3. 执行批量插入（如果有数据需要插入）
        if insert_data:
            # 开始事务
            await mysql_repo.execute_query("START TRANSACTION")
            try:
                insert_query = """
                INSERT INTO carrier_library (sku, images, reference_images, batch, developer, carrier, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                # 执行批量插入
                await mysql_repo.execute_batch(insert_query, insert_data)
                
                # 提交事务
                await mysql_repo.execute_query("COMMIT")
                
                # 更新成功计数
                success = len(insert_data)
            except Exception as e:
                # 回滚事务
                await mysql_repo.execute_query("ROLLBACK")
                logger.error(f"批量插入载体失败，已回滚事务: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"批量创建载体失败: {str(e)}")
        
        # 4. 计算失败数量
        failed = len(carriers) - success

        logger.info(f"批量创建载体完成 - 成功: {success}, 失败: {failed}")

        # 5. 构建统一格式响应
        return {
            "code": 200,
            "message": "批量创建完成",
            "data": {
                "success": success,
                "failed": failed,
                "errors": errors
            }
        }
    except Exception as e:
        logger.error(f"批量创建载体失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量创建载体失败: {str(e)}")
    finally:
        # 减少并发请求数
        async with batch_request_lock:
            current_batch_requests -= 1
        logger.info(f"批量创建载体完成 - 数量: {len(carriers)}, 剩余并发请求数: {current_batch_requests}")


@router.post("/batch-delete")
async def batch_delete_carrier_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo(),
    user_info: dict = Depends(auth_middleware.require_permission("carrier:delete"))
):
    """
    批量删除载体
    """
    return await _batch_delete_carrier_library(request, mysql_repo, user_info)


@router.post("/batch-delete/")
async def _batch_delete_carrier_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo(),
    user_info: dict = Depends(auth_middleware.require_permission("carrier:delete"))
):
    """
    批量删除载体
    """
    try:
        logger.info(f"开始批量删除载体 - ID列表: {request.ids}, SKU列表: {request.skus}, 删除人: {user_info.get('username', 'system')}")
        success = 0
        failed = 0
        errors = []
        items_to_process = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                carrier_query = "SELECT * FROM carrier_library WHERE id = %s"
                carrier = await mysql_repo.execute_query(carrier_query, (id,), fetch_one=True)
                if carrier:
                    items_to_process.append(carrier)
                else:
                    failed += 1
                    errors.append(f"载体ID {id} 不存在")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                carrier_query = "SELECT * FROM carrier_library WHERE sku = %s"
                carrier = await mysql_repo.execute_query(carrier_query, (sku,), fetch_one=True)
                if carrier:
                    items_to_process.append(carrier)
                else:
                    failed += 1
                    errors.append(f"载体SKU {sku} 不存在")

        # 批量处理载体
        for carrier in items_to_process:
            try:
                # 开始事务
                async with mysql_repo.get_connection() as conn:
                    try:
                        # 开始事务
                        await conn.begin()
                        
                        # 移动到回收站
                        recycle_query = """
                        INSERT INTO carrier_library_recycle_bin (
                            draft_id, sku, batch, developer, carrier, images, reference_images, status, deleted_by, deleted_by_name, delete_time
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        recycle_params = (
                            carrier["id"],
                            carrier["sku"],
                            carrier["batch"],
                            carrier["developer"],
                            carrier["carrier"],
                            carrier["images"],
                            carrier.get("reference_images", "[]"),
                            carrier["status"],
                            user_info.get("id", 1),  # 从用户信息中获取删除人ID
                            user_info.get("username", "system"),  # 从用户信息中获取删除人姓名
                            datetime.now()  # 添加删除时间
                        )

                        async with conn.cursor(aiomysql.DictCursor) as cursor:
                            await cursor.execute(recycle_query, recycle_params)

                            # 删除原记录
                            delete_query = "DELETE FROM carrier_library WHERE id = %s"
                            await cursor.execute(delete_query, (carrier["id"],))

                        # 提交事务
                        await conn.commit()

                        success += 1
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        failed += 1
                        errors.append(f"载体SKU {carrier['sku']} 删除失败: {str(e)}")
            except Exception as e:
                failed += 1
                errors.append(f"载体SKU {carrier['sku']} 删除失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "批量删除完成",
            "data": {
                "success": success,
                "failed": failed,
                "errors": errors
            }
        }
    except Exception as e:
        logger.error(f"批量删除载体失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量删除载体失败: {str(e)}")


@router.get("/recycle-bin/")
async def get_recycle_bin_slash(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站载体（有末尾斜杠路由）
    """
    return await get_recycle_bin(page, size, mysql_repo)


@router.get("/recycle-bin")
async def get_recycle_bin(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站载体
    """
    try:
        offset = (page - 1) * size

        # 查询回收站载体
        query = """
        SELECT * FROM carrier_library_recycle_bin
        ORDER BY delete_time DESC
        LIMIT %s OFFSET %s
        """
        carriers = await mysql_repo.execute_query(query, (size, offset))

        # 计算总数
        count_query = "SELECT COUNT(*) as total FROM carrier_library_recycle_bin"
        count_result = await mysql_repo.execute_query(count_query, fetch_one=True)
        total = count_result["total"]

        # 处理JSON字段并将图片路径转换为URL
        for carrier in carriers:
            try:
                carrier["images"] = _convert_image_paths_to_urls(carrier["images"])
            except Exception as e:
                carrier["images"] = []
                logger.error(f"处理回收站载体ID {carrier['carrier_id']} 的images字段失败: {str(e)}")
            
            try:
                carrier["reference_images"] = _convert_image_paths_to_urls(carrier["reference_images"])
            except Exception as e:
                carrier["reference_images"] = []
                logger.error(f"处理回收站载体ID {carrier['carrier_id']} 的reference_images字段失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": carriers,
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取回收站载体失败: {str(e)}")


@router.post("/recycle-bin/batch-restore")
async def batch_restore_carrier_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量恢复载体
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体ID {id} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到载体库表
                            restore_query = """
                            INSERT INTO carrier_library (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_carrier["carrier_id"],
                                recycle_carrier["sku"],
                                recycle_carrier["batch"],
                                recycle_carrier["developer"],
                                recycle_carrier["carrier"],
                                recycle_carrier["images"],
                                recycle_carrier["reference_images"],
                                recycle_carrier["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM carrier_library_recycle_bin WHERE id = %s"
                                await cursor.execute(delete_query, (id,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"载体ID {id} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"载体ID {id} 恢复失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体SKU {sku} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到载体库表
                            restore_query = """
                            INSERT INTO carrier_library (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_carrier["carrier_id"],
                                recycle_carrier["sku"],
                                recycle_carrier["batch"],
                                recycle_carrier["developer"],
                                recycle_carrier["carrier"],
                                recycle_carrier["images"],
                                recycle_carrier["reference_images"],
                                recycle_carrier["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM carrier_library_recycle_bin WHERE sku = %s"
                                await cursor.execute(delete_query, (sku,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"载体SKU {sku} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"载体SKU {sku} 恢复失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "批量恢复完成",
            "data": {
                "success": success,
                "failed": failed,
                "errors": errors
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量恢复载体失败: {str(e)}")


@router.delete("/{sku}")
async def delete_carrier_library(
    sku: str,
    mysql_repo=get_mysql_repo(),
    user_info: dict = Depends(auth_middleware.require_permission("carrier:delete"))
):
    """
    删除单个载体（软删除）
    """
    try:
        logger.info(f"开始删除载体 - SKU: {sku}")
        
        # 检查SKU是否存在
        check_query = "SELECT * FROM carrier_library WHERE sku = %s"
        carrier = await mysql_repo.execute_query(check_query, (sku,), fetch_one=True)
        if not carrier:
            raise HTTPException(status_code=404, detail="载体不存在")
        
        # 检查是否已在回收站
        recycle_check_query = "SELECT id FROM carrier_library_recycle_bin WHERE sku = %s"
        recycle_carrier = await mysql_repo.execute_query(recycle_check_query, (sku,), fetch_one=True)
        if recycle_carrier:
            raise HTTPException(status_code=400, detail="该载体已存在于回收站")
        
        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()
                
                # 移动到回收站
                recycle_query = """
                INSERT INTO carrier_library_recycle_bin (
                    carrier_id, sku, batch, developer, carrier, images, reference_images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, status, deleted_by, deleted_by_name, delete_time
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                recycle_params = (
                    carrier["id"],
                    carrier["sku"],
                    carrier.get("batch", ""),
                    carrier.get("developer", ""),
                    carrier.get("carrier", ""),
                    carrier["images"],
                    carrier.get("reference_images", "[]"),
                    carrier.get("product_size", ""),
                    carrier.get("carrier_name", ""),
                    carrier.get("material", ""),
                    carrier.get("process", ""),
                    carrier.get("weight", None),
                    carrier.get("packaging_method", ""),
                    carrier.get("packaging_size", ""),
                    carrier.get("price", None),
                    carrier.get("min_order_quantity", None),
                    carrier.get("supplier", ""),
                    carrier.get("supplier_link", ""),
                    carrier.get("status", ""),
                    user_info.get("id", 1),  # 从用户信息中获取删除人ID
                    user_info.get("username", "system"),  # 从用户信息中获取删除人姓名
                    datetime.now()
                )

                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(recycle_query, recycle_params)

                    # 删除原记录
                    delete_query = "DELETE FROM carrier_library WHERE id = %s"
                    await cursor.execute(delete_query, (carrier["id"],))

                # 提交事务
                await conn.commit()

                logger.info(f"删除载体成功 - SKU: {sku}, ID: {carrier['id']}")
                
                # 构建统一格式响应
                return {
                    "code": 200,
                    "message": "删除成功",
                    "data": {
                        "sku": sku,
                        "id": carrier["id"]
                    }
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                logger.error(f"删除载体失败 - SKU: {sku}, 错误: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"删除载体失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除载体失败 - SKU: {sku}, 错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除载体失败: {str(e)}")


@router.delete("/delete-by-id/{id}")
async def delete_carrier_library_by_id(
    id: int,
    mysql_repo=get_mysql_repo(),
    user_info: dict = Depends(auth_middleware.require_permission("carrier:delete"))
):
    """
    通过ID删除单个载体（软删除）
    """
    try:
        logger.info(f"开始删除载体 - ID: {id}")
        
        # 检查ID是否存在
        check_query = "SELECT * FROM carrier_library WHERE id = %s"
        carrier = await mysql_repo.execute_query(check_query, (id,), fetch_one=True)
        if not carrier:
            raise HTTPException(status_code=404, detail="载体不存在")
        
        # 检查是否已在回收站
        recycle_check_query = "SELECT id FROM carrier_library_recycle_bin WHERE carrier_id = %s"
        recycle_carrier = await mysql_repo.execute_query(recycle_check_query, (id,), fetch_one=True)
        if recycle_carrier:
            raise HTTPException(status_code=400, detail="该载体已存在于回收站")
        
        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()
                
                # 移动到回收站
                recycle_query = """
                INSERT INTO carrier_library_recycle_bin (
                    carrier_id, sku, batch, developer, carrier, images, reference_images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, status, deleted_by, deleted_by_name, delete_time
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                recycle_params = (
                    carrier["id"],
                    carrier["sku"],
                    carrier.get("batch", ""),
                    carrier.get("developer", ""),
                    carrier.get("carrier", ""),
                    carrier["images"],
                    carrier.get("reference_images", "[]"),
                    carrier.get("product_size", ""),
                    carrier.get("carrier_name", ""),
                    carrier.get("material", ""),
                    carrier.get("process", ""),
                    carrier.get("weight", None),
                    carrier.get("packaging_method", ""),
                    carrier.get("packaging_size", ""),
                    carrier.get("price", None),
                    carrier.get("min_order_quantity", None),
                    carrier.get("supplier", ""),
                    carrier.get("supplier_link", ""),
                    carrier.get("status", ""),
                    user_info.get("id", 1),  # 从用户信息中获取删除人ID
                    user_info.get("username", "system"),  # 从用户信息中获取删除人姓名
                    datetime.now()
                )

                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(recycle_query, recycle_params)

                    # 删除原记录
                    delete_query = "DELETE FROM carrier_library WHERE id = %s"
                    await cursor.execute(delete_query, (carrier["id"],))

                # 提交事务
                await conn.commit()

                logger.info(f"删除载体成功 - ID: {id}, SKU: {carrier['sku']}")
                
                # 构建统一格式响应
                return {
                    "code": 200,
                    "message": "删除成功",
                    "data": {
                        "id": id,
                        "sku": carrier["sku"]
                    }
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                logger.error(f"删除载体失败 - ID: {id}, 错误: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"删除载体失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除载体失败 - ID: {id}, 错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除载体失败: {str(e)}")


@router.put("/{id}")
async def update_carrier_library(
    id: int,
    carrier: CarrierLibraryUpdate,
    mysql_repo=get_mysql_repo()
):
    """
    更新载体信息
    """
    try:
        logger.info(f"开始更新载体 - ID: {id}")
        
        # 检查ID是否存在
        check_query = "SELECT id FROM carrier_library WHERE id = %s"
        logger.debug(f"检查ID是否存在 - SQL: {check_query}, 参数: ({id},)")
        existing_carrier = await mysql_repo.execute_query(check_query, (id,), fetch_one=True)
        if not existing_carrier:
            logger.error(f"更新载体失败 - ID {id} 不存在")
            raise HTTPException(status_code=400, detail="该载体不存在")

        # 构建更新语句
        update_fields = []
        params = []
        
        if carrier.images is not None:
            update_fields.append("images = %s")
            params.append(json.dumps(carrier.images))
        if carrier.product_size is not None:
            update_fields.append("product_size = %s")
            params.append(carrier.product_size)
        if carrier.carrier_name is not None:
            update_fields.append("carrier_name = %s")
            params.append(carrier.carrier_name)
        if carrier.material is not None:
            update_fields.append("material = %s")
            params.append(carrier.material)
        if carrier.process is not None:
            update_fields.append("process = %s")
            params.append(carrier.process)
        if carrier.weight is not None:
            update_fields.append("weight = %s")
            params.append(carrier.weight)
        if carrier.packaging_method is not None:
            update_fields.append("packaging_method = %s")
            params.append(carrier.packaging_method)
        if carrier.packaging_size is not None:
            update_fields.append("packaging_size = %s")
            params.append(carrier.packaging_size)
        if carrier.price is not None:
            update_fields.append("price = %s")
            params.append(carrier.price)
        if carrier.min_order_quantity is not None:
            update_fields.append("min_order_quantity = %s")
            params.append(carrier.min_order_quantity)
        if carrier.supplier is not None:
            update_fields.append("supplier = %s")
            params.append(carrier.supplier)
        if carrier.supplier_link is not None:
            update_fields.append("supplier_link = %s")
            params.append(carrier.supplier_link)
        
        # 添加更新时间
        update_fields.append("update_time = CURRENT_TIMESTAMP")
        
        # 添加ID参数
        params.append(id)
        
        # 构建完整的更新语句
        set_clause = ", ".join(update_fields)
        update_query = f"""
        UPDATE carrier_library
        SET {set_clause}
        WHERE id = %s
        """
        
        logger.debug(f"执行载体更新 - SQL: {update_query}, 参数: {tuple(params)}")
        await mysql_repo.execute_update(update_query, tuple(params))
        logger.info(f"载体更新成功 - ID: {id}")

        # 获取更新后的数据
        updated_carrier = await mysql_repo.execute_query(
            "SELECT * FROM carrier_library WHERE id = %s",
            (id,),
            fetch_one=True
        )

        # 处理JSON字段并将图片路径转换为URL
        try:
            if updated_carrier:
                # 只有当updated_carrier不是None时才处理
                carrier_id_log = updated_carrier.get('id', id)
                
                try:
                    updated_carrier["images"] = _convert_image_paths_to_urls(updated_carrier["images"])
                except Exception as e:
                    updated_carrier["images"] = []
                    logger.error(f"处理更新后的载体ID {id} 的images字段失败: {str(e)}")
        except Exception as e:
            logger.error(f"处理载体数据失败: {str(e)}")

        # 构建响应
        response_data = {
            "code": 200,
            "message": "载体更新成功",
            "data": {
                "id": id,
                "sku": updated_carrier.get("sku", "") if updated_carrier else "",
                "images": carrier.images if carrier.images is not None else (updated_carrier.get("images", []) if updated_carrier else []),
                "product_size": carrier.product_size if carrier.product_size is not None else (updated_carrier.get("product_size", "") if updated_carrier else ""),
                "carrier_name": carrier.carrier_name if carrier.carrier_name is not None else (updated_carrier.get("carrier_name", "") if updated_carrier else ""),
                "material": carrier.material if carrier.material is not None else (updated_carrier.get("material", "") if updated_carrier else ""),
                "process": carrier.process if carrier.process is not None else (updated_carrier.get("process", "") if updated_carrier else ""),
                "weight": carrier.weight if carrier.weight is not None else (updated_carrier.get("weight", None) if updated_carrier else None),
                "packaging_method": carrier.packaging_method if carrier.packaging_method is not None else (updated_carrier.get("packaging_method", "") if updated_carrier else ""),
                "packaging_size": carrier.packaging_size if carrier.packaging_size is not None else (updated_carrier.get("packaging_size", "") if updated_carrier else ""),
                "price": carrier.price if carrier.price is not None else (updated_carrier.get("price", None) if updated_carrier else None),
                "min_order_quantity": carrier.min_order_quantity if carrier.min_order_quantity is not None else (updated_carrier.get("min_order_quantity", None) if updated_carrier else None),
                "supplier": carrier.supplier if carrier.supplier is not None else (updated_carrier.get("supplier", "") if updated_carrier else ""),
                "supplier_link": carrier.supplier_link if carrier.supplier_link is not None else (updated_carrier.get("supplier_link", "") if updated_carrier else ""),
                "update_time": datetime.now().isoformat()
            }
        }
        logger.info(f"载体更新成功 - 响应: {json.dumps(response_data, ensure_ascii=False)}")
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新载体失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新载体失败: {str(e)}")


@router.post("/process-local-files")
async def process_carrier_library_local_files(
    mysql_repo=get_mysql_repo()
):
    """
    处理载体库本地文件
    """
    try:
        # 导入Redis和Qdrant仓库
        from ...repositories import RedisRepository, QdrantRepository
        
        # 创建仓库实例
        redis_repo = RedisRepository() if settings.CACHE_ENABLED else None
        qdrant_repo = QdrantRepository() if settings.CACHE_ENABLED else None
        
        # 获取库图片服务实例
        library_service = get_library_image_service(mysql_repo, redis_repo, qdrant_repo)
        
        # 处理载体库图片
        result = await library_service.process_library_images("carrier")
        
        # 构建响应
        return {
            "code": 200,
            "message": "载体库本地文件处理完成",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"处理载体库本地文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理载体库本地文件失败: {str(e)}")


@router.get("/recycle-bin")
async def get_carrier_library_recycle_bin(
    page: int = 1,
    size: int = 20,
    mysql_repo=get_mysql_repo()
):
    """
    获取载体库回收站列表
    """
    try:
        # 计算偏移量
        offset = (page - 1) * size
        
        # 获取回收站载体总数
        total_query = "SELECT COUNT(*) as total FROM carrier_library_recycle_bin"
        total_result = await mysql_repo.execute_query(total_query, (), fetch_one=True)
        total = total_result.get('total', 0)
        
        # 获取回收站载体列表
        list_query = """
        SELECT id, draft_id, sku, images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, deleted_by, deleted_by_name, delete_time
        FROM carrier_library_recycle_bin
        ORDER BY delete_time DESC
        LIMIT %s OFFSET %s
        """
        recycle_carriers = await mysql_repo.execute_query(
            list_query,
            (size, offset),
            fetch_all=True
        )
        
        # 处理结果数据
        carriers = []
        for carrier in recycle_carriers:
            # 处理images字段
            try:
                images = json.loads(carrier.get('images', '[]'))
            except:
                images = []
            
            carriers.append({
                "id": carrier.get('id'),
                "draft_id": carrier.get('draft_id'),
                "sku": carrier.get('sku'),
                "images": images,
                "product_size": carrier.get('product_size'),
                "carrier_name": carrier.get('carrier_name'),
                "material": carrier.get('material'),
                "process": carrier.get('process'),
                "weight": carrier.get('weight'),
                "packaging_method": carrier.get('packaging_method'),
                "packaging_size": carrier.get('packaging_size'),
                "price": carrier.get('price'),
                "min_order_quantity": carrier.get('min_order_quantity'),
                "supplier": carrier.get('supplier'),
                "supplier_link": carrier.get('supplier_link'),
                "deleted_by": carrier.get('deleted_by'),
                "deleted_by_name": carrier.get('deleted_by_name'),
                "delete_time": carrier.get('delete_time').isoformat() if carrier.get('delete_time') else None
            })
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": carriers,
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取回收站载体失败: {str(e)}")


@router.delete("/recycle-bin/clear")
async def clear_carrier_library_recycle_bin(
    mysql_repo=get_mysql_repo()
):
    """
    清空载体库回收站
    """
    try:
        # 获取所有回收站载体信息
        recycle_carriers = await mysql_repo.execute_query(
            "SELECT id, sku, images, reference_images FROM carrier_library_recycle_bin",
            ()
        )
        
        # 删除所有相关的腾讯云COS图片
        for carrier in recycle_carriers:
            carrier_id = carrier.get('id')
            carrier_sku = carrier.get('sku')
            await _delete_cos_images(mysql_repo, carrier_id, carrier_sku)
        
        # 清空回收站
        result = await mysql_repo.execute_delete(
            "DELETE FROM carrier_library_recycle_bin",
            ()
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "载体库回收站清空成功",
            "data": {"deleted_count": result}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空载体库回收站失败: {str(e)}")


@router.post("/recycle-bin/{sku}/restore")
async def restore_carrier_library(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站恢复单个载体
    """
    try:
        # 获取回收站载体信息
        recycle_carrier = await mysql_repo.execute_query(
            "SELECT * FROM carrier_library_recycle_bin WHERE sku = %s", 
            (sku,), 
            fetch_one=True
        )

        if not recycle_carrier:
            raise HTTPException(status_code=404, detail="回收站载体不存在")

        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()
                
                # 恢复到主表
                restore_query = """
                INSERT INTO carrier_library (id, sku, images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, create_time, update_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    images = VALUES(images),
                    product_size = VALUES(product_size),
                    carrier_name = VALUES(carrier_name),
                    material = VALUES(material),
                    process = VALUES(process),
                    weight = VALUES(weight),
                    packaging_method = VALUES(packaging_method),
                    packaging_size = VALUES(packaging_size),
                    price = VALUES(price),
                    min_order_quantity = VALUES(min_order_quantity),
                    supplier = VALUES(supplier),
                    supplier_link = VALUES(supplier_link),
                    update_time = VALUES(update_time)
                """
                restore_params = (
                    recycle_carrier["draft_id"],
                    recycle_carrier["sku"],
                    recycle_carrier["images"],
                    recycle_carrier["product_size"],
                    recycle_carrier["carrier_name"],
                    recycle_carrier["material"],
                    recycle_carrier["process"],
                    recycle_carrier["weight"],
                    recycle_carrier["packaging_method"],
                    recycle_carrier["packaging_size"],
                    recycle_carrier["price"],
                    recycle_carrier["min_order_quantity"],
                    recycle_carrier["supplier"],
                    recycle_carrier["supplier_link"],
                    datetime.now(),
                    datetime.now()
                )
                await conn.execute(restore_query, restore_params)
                
                # 从回收站删除记录
                await conn.execute("DELETE FROM carrier_library_recycle_bin WHERE sku = %s", (sku,))
                
                # 提交事务
                await conn.commit()
                
                # 构建统一格式响应
                return {
                    "code": 200,
                    "message": "恢复成功",
                    "data": {
                        "message": "载体已从回收站恢复",
                        "sku": sku
                    }
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                raise HTTPException(status_code=500, detail=f"恢复载体失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复载体失败: {str(e)}")


@router.post("/recycle-bin/batch-restore")
async def batch_restore_carrier_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量恢复载体
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体ID {id} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到主表
                            restore_query = """
                            INSERT INTO carrier_library (id, sku, images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, create_time, update_time)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                images = VALUES(images),
                                product_size = VALUES(product_size),
                                carrier_name = VALUES(carrier_name),
                                material = VALUES(material),
                                process = VALUES(process),
                                weight = VALUES(weight),
                                packaging_method = VALUES(packaging_method),
                                packaging_size = VALUES(packaging_size),
                                price = VALUES(price),
                                min_order_quantity = VALUES(min_order_quantity),
                                supplier = VALUES(supplier),
                                supplier_link = VALUES(supplier_link),
                                update_time = VALUES(update_time)
                            """
                            restore_params = (
                                recycle_carrier["draft_id"],
                                recycle_carrier["sku"],
                                recycle_carrier["images"],
                                recycle_carrier["product_size"],
                                recycle_carrier["carrier_name"],
                                recycle_carrier["material"],
                                recycle_carrier["process"],
                                recycle_carrier["weight"],
                                recycle_carrier["packaging_method"],
                                recycle_carrier["packaging_size"],
                                recycle_carrier["price"],
                                recycle_carrier["min_order_quantity"],
                                recycle_carrier["supplier"],
                                recycle_carrier["supplier_link"],
                                datetime.now(),
                                datetime.now()
                            )
                            await conn.execute(restore_query, restore_params)
                            
                            # 从回收站删除记录
                            await conn.execute("DELETE FROM carrier_library_recycle_bin WHERE id = %s", (id,))
                            
                            # 提交事务
                            await conn.commit()
                            
                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"恢复载体ID {id} 失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"恢复载体ID {id} 失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体SKU {sku} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到主表
                            restore_query = """
                            INSERT INTO carrier_library (id, sku, images, product_size, carrier_name, material, process, weight, packaging_method, packaging_size, price, min_order_quantity, supplier, supplier_link, create_time, update_time)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                images = VALUES(images),
                                product_size = VALUES(product_size),
                                carrier_name = VALUES(carrier_name),
                                material = VALUES(material),
                                process = VALUES(process),
                                weight = VALUES(weight),
                                packaging_method = VALUES(packaging_method),
                                packaging_size = VALUES(packaging_size),
                                price = VALUES(price),
                                min_order_quantity = VALUES(min_order_quantity),
                                supplier = VALUES(supplier),
                                supplier_link = VALUES(supplier_link),
                                update_time = VALUES(update_time)
                            """
                            restore_params = (
                                recycle_carrier["draft_id"],
                                recycle_carrier["sku"],
                                recycle_carrier["images"],
                                recycle_carrier["product_size"],
                                recycle_carrier["carrier_name"],
                                recycle_carrier["material"],
                                recycle_carrier["process"],
                                recycle_carrier["weight"],
                                recycle_carrier["packaging_method"],
                                recycle_carrier["packaging_size"],
                                recycle_carrier["price"],
                                recycle_carrier["min_order_quantity"],
                                recycle_carrier["supplier"],
                                recycle_carrier["supplier_link"],
                                datetime.now(),
                                datetime.now()
                            )
                            await conn.execute(restore_query, restore_params)
                            
                            # 从回收站删除记录
                            await conn.execute("DELETE FROM carrier_library_recycle_bin WHERE sku = %s", (sku,))
                            
                            # 提交事务
                            await conn.commit()
                            
                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"恢复载体SKU {sku} 失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"恢复载体SKU {sku} 失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "批量恢复完成",
            "data": {
                "success": success,
                "failed": failed,
                "errors": errors
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量恢复载体失败: {str(e)}")


@router.delete("/recycle-bin/batch")
async def batch_permanently_delete_carrier_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量永久删除载体
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体ID {id} 不存在")
                        continue

                    # 删除相关的腾讯云COS图片
                    carrier_id = recycle_carrier.get('id')
                    carrier_sku = recycle_carrier.get('sku')
                    await _delete_cos_images(mysql_repo, carrier_id, carrier_sku)

                    # 从回收站删除记录
                    await mysql_repo.execute_delete(
                        "DELETE FROM carrier_library_recycle_bin WHERE id = %s",
                        (id,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"永久删除载体ID {id} 失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站载体信息
                    recycle_carrier = await mysql_repo.execute_query(
                        "SELECT * FROM carrier_library_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_carrier:
                        failed += 1
                        errors.append(f"回收站载体SKU {sku} 不存在")
                        continue

                    # 删除相关的腾讯云COS图片
                    carrier_id = recycle_carrier.get('id')
                    carrier_sku = recycle_carrier.get('sku')
                    await _delete_cos_images(mysql_repo, carrier_id, carrier_sku)

                    # 从回收站删除记录
                    await mysql_repo.execute_delete(
                        "DELETE FROM carrier_library_recycle_bin WHERE sku = %s",
                        (sku,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"永久删除载体SKU {sku} 失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "批量永久删除完成",
            "data": {
                "success": success,
                "failed": failed,
                "errors": errors
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量永久删除载体失败: {str(e)}")


@router.delete("/recycle-bin/{sku}")
async def permanently_delete_carrier_library(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站永久删除单个载体
    """
    try:
        # 获取回收站载体信息
        recycle_carrier = await mysql_repo.execute_query(
            "SELECT * FROM carrier_library_recycle_bin WHERE sku = %s", 
            (sku,), 
            fetch_one=True
        )

        if not recycle_carrier:
            raise HTTPException(status_code=404, detail="回收站载体不存在")

        # 删除相关的腾讯云COS图片
        carrier_id = recycle_carrier.get('id')
        carrier_sku = recycle_carrier.get('sku')
        await _delete_cos_images(mysql_repo, carrier_id, carrier_sku)

        # 从回收站删除记录
        await mysql_repo.execute_delete(
            "DELETE FROM carrier_library_recycle_bin WHERE sku = %s",
            (sku,)
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "永久删除成功",
            "data": {
                "message": "载体已从回收站永久删除",
                "sku": sku
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"永久删除载体失败: {str(e)}")


@router.delete("/recycle-bin/delete-by-id/{id}")
async def permanently_delete_carrier_library_by_id(
    id: int,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站通过ID永久删除单个载体
    """
    try:
        # 获取回收站载体信息
        recycle_carrier = await mysql_repo.execute_query(
            "SELECT * FROM carrier_library_recycle_bin WHERE id = %s", 
            (id,), 
            fetch_one=True
        )

        if not recycle_carrier:
            raise HTTPException(status_code=404, detail="回收站载体不存在")

        # 删除相关的腾讯云COS图片
        carrier_id = recycle_carrier.get('id')
        carrier_sku = recycle_carrier.get('sku')
        await _delete_cos_images(mysql_repo, carrier_id, carrier_sku)

        # 从回收站删除记录
        result = await mysql_repo.execute_delete(
            "DELETE FROM carrier_library_recycle_bin WHERE id = %s",
            (id,)
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "永久删除成功",
            "data": {
                "message": "载体已从回收站永久删除",
                "id": id,
                "deleted_count": result
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"永久删除载体失败: {str(e)}")


async def _download_local_thumbnail(image_url: str) -> Optional[str]:
    """
    优先使用本地生成的缩略图，如果不存在则从腾讯云下载
    
    Args:
        image_url: 图片URL
        
    Returns:
        本地缩略图路径，如果失败返回None
    """
    try:
        logger.info(f"开始处理本地缩略图: {image_url}")
        
        # 确保本地存储目录存在
        os.makedirs(settings.LOCAL_THUMBNAIL_DIR, exist_ok=True)
        
        # 尝试从URL中提取图片ID
        image_id = None
        parsed_url = urlparse(image_url)
        path = parsed_url.path
        filename = os.path.basename(path)
        
        # 尝试从文件名中提取图片ID
        try:
            # 解析文件名，格式可能是: {image_id}_{width}x{height}.webp
            if '_' in filename:
                parts = filename.split('_')
                if parts[0].isdigit():
                    image_id = int(parts[0])
        except Exception as e:
            logger.warning(f"从文件名提取图片ID失败: {e}")
        
        # 如果找到图片ID，尝试使用本地生成的缩略图
        if image_id:
            local_thumbnail_filename = f"{image_id}_512x512.webp"
            local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, local_thumbnail_filename)
            
            if os.path.exists(local_path):
                logger.info(f"本地生成的缩略图已存在，直接使用: {local_path}")
                return local_path
        
        # 构建本地存储路径（基于原始文件名）
        if not filename:
            # 生成随机文件名
            import uuid
            filename = f"thumbnail_{uuid.uuid4()}.jpg"
        
        local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, filename)
        
        # 检查文件是否已经存在
        if os.path.exists(local_path):
            logger.info(f"缩略图已存在，直接使用: {local_path}")
            return local_path
        
        # 从腾讯云下载图片
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=30, headers=headers, allow_redirects=True) as resp:
                resp.raise_for_status()
                content = await resp.read()
                
                # 检查文件大小
                if len(content) == 0:
                    logger.error(f"下载的缩略图为空: {image_url}")
                    return None
                
                # 计算MD5哈希值
                md5_hash = hashlib.md5(content).hexdigest()
                logger.info(f"下载的缩略图大小: {len(content)} bytes, MD5: {md5_hash}")
                
                # 保存文件到本地
                with open(local_path, 'wb') as f:
                    f.write(content)
                
                logger.info(f"成功保存本地缩略图: {local_path}")
                return local_path
    except Exception as e:
        logger.error(f"处理本地缩略图失败: {str(e)}", exc_info=True)
        return None
