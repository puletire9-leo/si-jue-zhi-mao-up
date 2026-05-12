"""
[参考] 素材库API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: MaterialLibraryController.java

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
import uuid

from ...models import (
    MaterialLibraryCreate,
    MaterialLibraryUpdate,
    MaterialLibraryResponse,
    BatchOperationRequest
)

from ...config import settings
import sys
import os
# 添加项目根目录到Python路径
# 直接计算项目根目录：从当前文件向上4级
current_dir = os.path.dirname(os.path.abspath(__file__))
# 向上4级: v1 -> api -> app -> backend -> 项目根目录
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))))
# 验证项目根目录
print(f"项目根目录: {project_root}")
sys.path.insert(0, project_root)
from ...services.library_image_service import get_library_image_service
from ...services.image_analysis_service import analyze_image, analyze_image_with_scores
from ...services.baidu_image_recognition_service import analyze_image_with_baidu
from ...services.tencent_image_recognition_service import analyze_image_with_tencent
from ...services.tencent_llm_vision_service import analyze_image_with_llm
from ...services.cos_service import cos_service
from ...repositories import MySQLRepository
import re

# 导入配置
sys.path.insert(0, project_root)
from config import AI_ANALYSIS_ENGINE, BAIDU_AI_CONFIG, TENCENT_CLOUD_CONFIG

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/material-library", tags=["material_library"])

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
        # 解析URL，提取路径部分（不包含查询参数）
        parsed_url = urlparse(image_url)
        path = parsed_url.path.lstrip('/')
        
        # 腾讯云COS URL的路径就是对象键
        # 格式: {bucket}.cos.{region}.myqcloud.com/{object_key}
        # 需要去掉 bucket 部分
        
        # 提取路径中的对象键
        if path:
            return path
        return None
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
        
        # 3. 素材库专用路径：material_library/xxx_512x512.webp
        if dirname.endswith('material_library'):
            material_thumbnail_filename = f"{name_without_ext}_512x512.webp"
            thumbnail_keys.append(os.path.join(dirname, material_thumbnail_filename))
        
        # 去重并返回
        return list(set(thumbnail_keys))
    except Exception as e:
        logger.error(f"生成缩略图对象键失败，原图对象键: {object_key}, 错误: {str(e)}")
        return []


async def _delete_cos_images(mysql_repo, material_id: int, material_sku: str) -> None:
    """
    删除素材库相关的腾讯云COS图片、本地缩略图和images表记录
    
    Args:
        mysql_repo: MySQL数据库仓库实例
        material_id: 素材ID
        material_sku: 素材SKU
    """
    try:
        from ...services.cos_service import cos_service
        
        # 如果COS服务未启用，直接返回
        if not cos_service.enabled:
            logger.warning(f"COS服务未启用，跳过删除图片操作 - 素材ID: {material_id}, SKU: {material_sku}")
            return
        
        # 获取回收站素材信息
        try:
            # 尝试获取包含本地缩略图路径的信息
            recycle_material = await mysql_repo.execute_query(
                "SELECT images, reference_images, local_thumbnail_path FROM material_library_recycle_bin WHERE id = %s OR sku = %s", 
                (material_id, material_sku), 
                fetch_one=True
            )
        except Exception as e:
            # 如果local_thumbnail_path字段不存在，使用不包含该字段的查询
            logger.warning(f"获取本地缩略图路径失败，尝试使用兼容查询 - 错误: {str(e)}")
            recycle_material = await mysql_repo.execute_query(
                "SELECT images, reference_images FROM material_library_recycle_bin WHERE id = %s OR sku = %s", 
                (material_id, material_sku), 
                fetch_one=True
            )
        
        if not recycle_material:
            logger.warning(f"回收站素材不存在，跳过删除图片操作 - 素材ID: {material_id}, SKU: {material_sku}")
            return
        
        # 处理images字段
        images = _convert_image_paths_to_urls(recycle_material.get('images', []))
        # 处理reference_images字段
        reference_images = _convert_image_paths_to_urls(recycle_material.get('reference_images', []))
        # 获取本地缩略图路径
        local_thumbnail_path = recycle_material.get('local_thumbnail_path')
        
        # 合并所有图片URL
        all_images = images + reference_images
        
        logger.info(f"开始删除素材相关的图片 - 素材ID: {material_id}, SKU: {material_sku}, 图片数量: {len(all_images)}")
        
        # 删除本地缩略图
        if local_thumbnail_path:
            try:
                # 检查文件存在性
                if os.path.exists(local_thumbnail_path):
                    os.remove(local_thumbnail_path)
                    logger.info(f"成功删除本地缩略图 - 路径: {local_thumbnail_path}, 素材ID: {material_id}, SKU: {material_sku}")
                else:
                    logger.warning(f"本地缩略图文件不存在，跳过删除 - 路径: {local_thumbnail_path}, 素材ID: {material_id}, SKU: {material_sku}")
            except Exception as e:
                logger.error(f"删除本地缩略图失败 - 路径: {local_thumbnail_path}, 素材ID: {material_id}, SKU: {material_sku}, 错误: {str(e)}")
                # 本地缩略图删除失败不影响主流程，只记录日志
        
        # 删除每张图片和对应的缩略图
        for image_url in all_images:
            # 提取COS对象键
            object_key = _extract_cos_object_key(image_url)
            if object_key:
                # 删除原图/参考图
                success, error_msg = await cos_service.delete_image(object_key)
                if success:
                    logger.info(f"成功删除COS图片 - 对象键: {object_key}, 素材ID: {material_id}, SKU: {material_sku}")
                else:
                    logger.error(f"删除COS图片失败 - 对象键: {object_key}, 素材ID: {material_id}, SKU: {material_sku}, 错误: {error_msg}")
                
                # 生成所有可能的缩略图对象键
                thumbnail_keys = _generate_thumbnail_object_keys(object_key)
                
                # 删除所有对应的缩略图
                for thumbnail_key in thumbnail_keys:
                    success, error_msg = await cos_service.delete_image(thumbnail_key)
                    if success:
                        logger.info(f"成功删除缩略图 - 对象键: {thumbnail_key}, 素材ID: {material_id}, SKU: {material_sku}")
                    else:
                        # 缩略图删除失败不影响主流程，只记录日志
                        logger.warning(f"删除缩略图失败 - 对象键: {thumbnail_key}, 素材ID: {material_id}, SKU: {material_sku}, 错误: {error_msg}")
            else:
                logger.warning(f"无法提取COS对象键，跳过删除 - URL: {image_url}, 素材ID: {material_id}, SKU: {material_sku}")
        
        # 删除images表中与该素材SKU相关的记录
        try:
            delete_images_result = await mysql_repo.execute_update(
                "DELETE FROM images WHERE sku = %s", 
                (material_sku,)
            )
            logger.info(f"成功删除images表记录 - 素材SKU: {material_sku}, 删除记录数: {delete_images_result}")
        except Exception as e:
            logger.error(f"删除images表记录失败 - 素材SKU: {material_sku}, 错误: {str(e)}")
            # images表记录删除失败不影响主流程，只记录日志
    except Exception as e:
        logger.error(f"删除素材COS图片失败 - 素材ID: {material_id}, SKU: {material_sku}, 错误: {str(e)}", exc_info=True)


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
async def get_material_library_no_slash(
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
    获取素材库列表（无末尾斜杠路由）

    支持搜索、筛选、排序和分页
    """
    # 调用带斜杠路由的处理函数
    return await get_material_library(
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
async def get_material_library(
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
    获取素材库列表

    支持搜索、筛选、排序和分页
    """
    try:
        logger.info(f"开始获取素材库列表 - 搜索类型: {search_type}, 搜索内容: {search_content}, 页码: {page}, 每页数量: {size}")
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
                    if search_type == "sku":
                        # SKU多项精确搜索，使用IN条件
                        placeholders = ",".join(["%s"] * len(search_items))
                        conditions.append(f"sku IN ({placeholders})")
                        params.extend(search_items)
                    elif search_type == "batch":
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
            else:
                # 单项搜索处理（原有逻辑）
                if search_type == "sku":
                    conditions.append("sku LIKE %s")
                    params.append(f"%{search_content}%")
                elif search_type == "batch":
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
        valid_sort_fields = ["id", "sku", "batch", "developer", "carrier", "status", "create_time", "update_time"]
        if sort_by not in valid_sort_fields:
            sort_by = "create_time"

        sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"
        order_by_clause = f"ORDER BY {sort_by} {sort_order}"

        # 构建分页子句
        offset = (page - 1) * size
        limit_clause = "LIMIT %s OFFSET %s"
        params.extend([size, offset])

        # 执行主查询
        query = f"SELECT * FROM material_library {where_clause} {order_by_clause} {limit_clause}"
        logger.debug(f"执行素材库列表查询 - SQL: {query}, 参数: {tuple(params)}")
        materials = await mysql_repo.execute_query(query, tuple(params))
        
        # 确保materials是数组
        if not isinstance(materials, list):
            logger.error(f"获取素材库列表失败 - 返回数据不是数组: {type(materials)}")
            materials = []
        
        logger.info(f"获取素材库列表成功 - 数量: {len(materials)}")

        # 计算总数
        count_query = f"SELECT COUNT(*) as total FROM material_library {where_clause}"
        count_params = tuple(params[:-2]) if len(params) >= 2 else tuple(params)
        logger.debug(f"执行素材库总数查询 - SQL: {count_query}, 参数: {count_params}")
        count_result = await mysql_repo.execute_query(count_query, count_params, fetch_one=True)
        
        # 确保count_result是字典类型
        total = 0
        if isinstance(count_result, dict):
            total = count_result.get("total", 0)
            # 确保总数与实际数据数量一致
            if total > 0 and len(materials) == 0:
                # 总数大于0，但实际查询到的数据为0，可能是分页或筛选条件导致，使用实际数据数量
                logger.warning(f"计数查询返回{total}，但实际查询到0条数据，可能是分页或筛选条件导致，已修正总数为0")
                total = 0
            elif total == 0 and len(materials) > 0:
                # 如果总数为0，但实际查询到了数据，使用实际数据数量作为总数
                total = len(materials)
                logger.warning(f"计数查询返回0，但实际查询到{len(materials)}条数据，已使用实际数量作为总数")
            elif len(materials) > total:
                # 实际数据数量大于计数，以实际为准
                total = len(materials)
                logger.warning(f"实际查询到{len(materials)}条数据，大于计数查询返回的{total}，已修正总数")
        else:
            total = len(materials)
            logger.warning(f"计数查询返回值不是字典类型: {type(count_result)}，已使用实际查询数量作为总数")
        
        logger.info(f"获取素材库总数成功 - 总数: {total}")
        
        # 确保materials和total一致
        if len(materials) > total:
            # 实际数据数量大于计数，截断数据或修正计数
            logger.warning(f"实际数据数量{len(materials)}大于计数{total}，已修正总数")
            total = len(materials)
        elif total == 0 and len(materials) > 0:
            # 总数为0，但实际查询到数据，重置为一致
            logger.warning(f"总数为0，但实际查询到{len(materials)}条数据，已修正总数为实际数量")
            total = len(materials)

        # 处理JSON字段并将图片路径转换为URL
        for material in materials:
            try:
                material["images"] = _convert_image_paths_to_urls(material["images"])
            except Exception as e:
                material["images"] = []
                logger.error(f"处理素材ID {material['id']} 的images字段失败: {str(e)}")
            
            try:
                material["reference_images"] = _convert_image_paths_to_urls(material["reference_images"])
            except Exception as e:
                material["reference_images"] = []
                logger.error(f"处理素材ID {material['id']} 的reference_images字段失败: {str(e)}")
            
            try:
                material["final_draft_images"] = _convert_image_paths_to_urls(material["final_draft_images"])
            except Exception as e:
                material["final_draft_images"] = []
                logger.error(f"处理素材ID {material['id']} 的final_draft_images字段失败: {str(e)}")

        # 使用MaterialLibraryResponse模型序列化每个素材，确保字段名转换为驼峰命名
        serialized_materials = [MaterialLibraryResponse(**material) for material in materials]
        
        # 构建统一格式响应，确保list始终是数组
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": serialized_materials or [],
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        logger.error(f"获取素材库列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取素材库列表失败: {str(e)}")


@router.post("")
async def create_material_library_no_slash(
    material: MaterialLibraryCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新素材（无末尾斜杠路由）
    """
    return await create_material_library(material, mysql_repo)


@router.post("/")
async def create_material_library(
    material: MaterialLibraryCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新素材
    """
    try:
        logger.info(f"开始创建新素材 - SKU: {material.sku}, 批次: {material.batch}, 开发人: {material.developer}")

        # 检查SKU是否已存在
        check_query = "SELECT id FROM material_library WHERE sku = %s"
        logger.debug(f"检查SKU是否已存在 - SQL: {check_query}, 参数: ({material.sku},)")
        existing_material = await mysql_repo.execute_query(check_query, (material.sku,), fetch_one=True)
        if existing_material:
            logger.error(f"创建素材失败 - SKU {material.sku} 已存在")
            raise HTTPException(status_code=400, detail="该SKU已存在")

        # 自动将新元素词添加到元素库
        if material.element:
            extract_and_add_elements(material.element)

        # 插入数据
        insert_query = """
        INSERT INTO material_library (sku, batch, developer, carrier, element, modification_requirement, images, reference_images, final_draft_images, status, local_thumbnail_path, local_thumbnail_status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            material.sku,
            material.batch,
            material.developer,
            material.carrier,
            material.element,
            material.modification_requirement,
            json.dumps(material.images),
            json.dumps(material.reference_images),
            json.dumps(material.final_draft_images),
            material.status,
            None,  # local_thumbnail_path
            'pending'  # local_thumbnail_status
        ]

        logger.debug(f"执行素材插入 - SQL: {insert_query}, 参数: {tuple(params)}")
        result = await mysql_repo.execute_insert(insert_query, tuple(params))
        material_id = result['last_id']
        logger.info(f"素材插入成功 - ID: {material_id}")

        # 获取插入的数据
        created_material = await mysql_repo.execute_query(
            "SELECT * FROM material_library WHERE id = %s",
            (material_id,),
            fetch_one=True
        )

        # 处理JSON字段并将图片路径转换为URL
        try:
            if created_material:
                # 只有当created_material不是None时才处理
                material_id_log = created_material.get('id', material_id)
                
                try:
                    created_material["images"] = _convert_image_paths_to_urls(created_material["images"])
                except Exception as e:
                    created_material["images"] = []
                    logger.error(f"处理新创建的素材ID {material_id_log} 的images字段失败: {str(e)}")
                
                try:
                    created_material["reference_images"] = _convert_image_paths_to_urls(created_material["reference_images"])
                except Exception as e:
                    created_material["reference_images"] = []
                    logger.error(f"处理新创建的素材ID {material_id_log} 的reference_images字段失败: {str(e)}")
                
                # 从腾讯云下载已生成的缩略图到本地
                local_thumbnail_path = None
                all_images = created_material.get("images", []) + created_material.get("reference_images", [])
                
                if all_images:
                    # 优先使用第一张图片
                    first_image = all_images[0]
                    logger.info(f"开始下载第一张图片的本地缩略图: {first_image}")
                    local_thumbnail_path = await _download_local_thumbnail(first_image)
                    
                    if local_thumbnail_path:
                        logger.info(f"成功下载本地缩略图: {local_thumbnail_path}")
                        # 更新数据库中的本地缩略图路径
                        update_query = """
                        UPDATE material_library 
                        SET local_thumbnail_path = %s, 
                            local_thumbnail_status = %s, 
                            local_thumbnail_updated_at = %s 
                        WHERE id = %s
                        """
                        update_params = [
                            local_thumbnail_path,
                            'completed',
                            datetime.now(),
                            material_id_log
                        ]
                        await mysql_repo.execute_update(update_query, update_params)
                        # 更新created_material中的本地缩略图路径
                        created_material["local_thumbnail_path"] = local_thumbnail_path
                        created_material["local_thumbnail_status"] = 'completed'
                        created_material["local_thumbnail_updated_at"] = datetime.now().isoformat()
                    else:
                        logger.warning(f"下载本地缩略图失败: {first_image}")
                        # 更新数据库中的本地缩略图状态为失败
                        update_query = """
                        UPDATE material_library 
                        SET local_thumbnail_status = %s 
                        WHERE id = %s
                        """
                        await mysql_repo.execute_update(update_query, ['failed', material_id_log])
                        created_material["local_thumbnail_status"] = 'failed'
            else:
                logger.warning(f"获取新创建的素材ID {material_id} 失败，使用插入数据构建响应")
                # 如果获取失败，使用插入的数据构建响应
                created_material = {
                    "id": material_id,
                    "sku": material.sku,
                    "batch": material.batch,
                    "developer": material.developer,
                    "carrier": material.carrier,
                    "modification_requirement": material.modification_requirement,
                    "images": material.images or [],
                    "reference_images": material.reference_images or [],
                    "status": material.status,
                    "create_time": datetime.now().isoformat(),
                    "update_time": datetime.now().isoformat()
                }
        except Exception as e:
            logger.error(f"处理创建的素材数据失败: {str(e)}")
            # 发生异常时，使用默认值构建响应
            created_material = {
                "id": material_id,
                "sku": material.sku,
                "batch": material.batch,
                "developer": material.developer,
                "carrier": material.carrier,
                "modification_requirement": material.modification_requirement,
                "images": [],
                "reference_images": [],
                "status": material.status,
                "create_time": datetime.now().isoformat(),
                "update_time": datetime.now().isoformat()
            }

        # 使用MaterialLibraryResponse模型序列化，确保字段名转换为驼峰命名
        material_response = MaterialLibraryResponse(**created_material)
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "创建成功",
            "data": material_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建素材失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建素材失败: {str(e)}")


@router.post("/analyze-image")
async def analyze_material_image(
    request: dict
):
    """
    分析图片内容，自动识别元素标签

    支持两种AI引擎:
    - 百度AI: 识别准确率高，支持10万+物体和场景
    - Chinese CLIP: 本地模型，无需联网

    请求体:
    {
        "image_url": "图片URL地址"  // URL 或 base64 图片数据
        或
        "image_base64": "data:image/png;base64,..."  // base64 编码的图片
    }

    响应:
    {
        "code": 200,
        "message": "分析成功",
        "data": {
            "element": "猫咪,动物,卡通",  // 逗号分隔的标签
            "tags": [
                {"tag": "猫咪", "confidence": 95.5},
                {"tag": "动物", "confidence": 88.2},
                {"tag": "卡通", "confidence": 76.3}
            ]
        }
    }
    """
    try:
        image_url = request.get("image_url")
        image_base64 = request.get("image_base64")

        if not image_url and not image_base64:
            raise HTTPException(status_code=400, detail="缺少图片数据")

        logger.info(f"开始分析图片 - 使用引擎: {AI_ANALYSIS_ENGINE}, URL: {image_url}")

        tags_with_scores = []
        element = ""

        # 根据配置选择AI引擎
        if AI_ANALYSIS_ENGINE == 'tencent' and TENCENT_CLOUD_CONFIG.get('enabled'):
            # 使用腾讯云AI
            try:
                # 对于腾讯云AI，优先使用base64方式传输图片
                # 这样可以避免COS签名URL的权限问题
                analysis_url = image_url
                analysis_base64 = image_base64
                
                # 如果提供了URL但没有提供base64，尝试下载图片
                if image_url and not image_base64:
                    logger.info(f"准备下载图片用于腾讯云AI分析: {image_url}")
                    
                    # 如果是COS URL，提取对象键并生成公共访问URL（无签名）
                    download_url = image_url
                    if 'cos.' in image_url and 'myqcloud.com' in image_url:
                        object_key = _extract_cos_object_key(image_url)
                        if object_key:
                            # 生成无签名的公共访问URL
                            public_url = cos_service.get_full_url(object_key)
                            if public_url:
                                download_url = public_url
                                logger.info(f"使用公共访问URL下载图片: {download_url}")
                    
                    # 下载图片并转换为base64
                    try:
                        import aiohttp
                        import base64
                        async with aiohttp.ClientSession() as session:
                            async with session.get(download_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                                if response.status == 200:
                                    image_data = await response.read()
                                    # 转换为base64
                                    analysis_base64 = base64.b64encode(image_data).decode('utf-8')
                                    analysis_url = None  # 使用base64后不需要URL
                                    logger.info(f"图片下载成功，已转换为base64，大小: {len(image_data)} bytes")
                                else:
                                    logger.error(f"下载图片失败，状态码: {response.status}, URL: {download_url}")
                    except Exception as download_error:
                        logger.error(f"下载图片时出错: {str(download_error)}")
                        # 下载失败，继续使用URL方式
                
                logger.info(f"使用腾讯云AI分析图片 - URL: {analysis_url is not None}, Base64: {analysis_base64 is not None}")
                
                tags_with_scores = await analyze_image_with_tencent(analysis_url, analysis_base64)
                if tags_with_scores:
                    # 构建逗号分隔的元素字符串
                    element = ",".join([tag for tag, _ in tags_with_scores])
                    logger.info(f"腾讯云AI分析完成, 识别标签: {element}")
            except Exception as e:
                logger.error(f"腾讯云AI分析失败，回退到本地模型: {str(e)}")
                # 回退到本地模型
                element = await analyze_image(image_url, image_base64)
                tags_with_scores = await analyze_image_with_scores(image_url, image_base64)
        elif AI_ANALYSIS_ENGINE == 'baidu' and BAIDU_AI_CONFIG.get('enabled'):
            # 使用百度AI
            try:
                tags_with_scores = await analyze_image_with_baidu(image_url, image_base64)
                if tags_with_scores:
                    # 构建逗号分隔的元素字符串
                    element = ",".join([tag for tag, _ in tags_with_scores])
                    logger.info(f"百度AI分析完成, 识别标签: {element}")
            except Exception as e:
                logger.error(f"百度AI分析失败，回退到本地模型: {str(e)}")
                # 回退到本地模型
                element = await analyze_image(image_url, image_base64)
                tags_with_scores = await analyze_image_with_scores(image_url, image_base64)
        else:
            # 使用本地Chinese CLIP模型
            element = await analyze_image(image_url, image_base64)
            tags_with_scores = await analyze_image_with_scores(image_url, image_base64)
            logger.info(f"本地CLIP模型分析完成, 识别标签: {element}")

        if not tags_with_scores:
            return {
                "code": 200,
                "message": "分析完成，未识别到明确标签",
                "data": {
                    "element": "",
                    "tags": []
                }
            }

        # 构建标签列表
        tags = [
            {"tag": tag, "confidence": confidence}
            for tag, confidence in tags_with_scores
        ]

        return {
            "code": 200,
            "message": "分析成功",
            "data": {
                "element": element,
                "tags": tags
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"分析图片失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析图片失败: {str(e)}")


@router.post("/analyze-image-detailed")
async def analyze_material_image_detailed(
    request: dict
):
    """
    详细分析图片内容，使用腾讯云混元大模型

    请求体:
    {
        "image_url": "图片URL地址"  // URL 或 base64 图片数据
        或
        "image_base64": "data:image/png;base64,..."  // base64 编码的图片
    }

    响应:
    {
        "code": 200,
        "message": "分析成功",
        "data": {
            "product_type": "手提袋/帆布包",  // 产品类型
            "theme": "伦敦主题",  // 主题
            "elements": [  // 识别到的元素列表
                {"name": "大本钟", "english_name": "Big Ben", "icon": "[LANDMARK]️"},
                {"name": "伦敦眼", "english_name": "London Eye", "icon": "[FERRIS]"},
                ...
            ],
            "text_content": ["London", "IS ALWAYS A GOOD IDEA"],  // 文字内容
            "description": "整体描述"  // 整体描述
        }
    }
    """
    try:
        image_url = request.get("image_url")
        image_base64 = request.get("image_base64")

        if not image_url and not image_base64:
            raise HTTPException(status_code=400, detail="缺少图片数据")

        logger.info(f"开始详细分析图片 - 使用引擎: 腾讯云混元大模型, URL: {image_url}")

        # 下载图片并转换为base64（如果需要）
        analysis_url = image_url
        analysis_base64 = image_base64
        
        if image_url and not image_base64:
            logger.info(f"准备下载图片用于混元大模型分析: {image_url}")
            
            # 如果是COS URL，提取对象键并生成公共访问URL（无签名）
            download_url = image_url
            if 'cos.' in image_url and 'myqcloud.com' in image_url:
                object_key = _extract_cos_object_key(image_url)
                if object_key:
                    public_url = cos_service.get_full_url(object_key)
                    if public_url:
                        download_url = public_url
                        logger.info(f"使用公共访问URL下载图片: {download_url}")
            
            # 下载图片并转换为base64
            try:
                import aiohttp
                import base64
                async with aiohttp.ClientSession() as session:
                    async with session.get(download_url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                        if response.status == 200:
                            image_data = await response.read()
                            analysis_base64 = base64.b64encode(image_data).decode('utf-8')
                            analysis_url = None
                            logger.info(f"图片下载成功，已转换为base64，大小: {len(image_data)} bytes")
                        else:
                            logger.error(f"下载图片失败，状态码: {response.status}, URL: {download_url}")
            except Exception as download_error:
                logger.error(f"下载图片时出错: {str(download_error)}")
        
        # 使用混元大模型进行分析
        llm_result = await analyze_image_with_llm(analysis_url, analysis_base64)
        
        if not llm_result:
            return {
                "code": 200,
                "message": "分析完成，但未能识别到内容",
                "data": {
                    "product_type": "",
                    "theme": "",
                    "elements": [],
                    "text_content": [],
                    "description": ""
                }
            }
        
        # 提取元素列表，转换为标签格式
        elements = llm_result.get('elements', [])
        tags = []
        for elem in elements:
            tag_text = f"{elem.get('icon', '')} {elem.get('name', '')}"
            tags.append({
                "tag": tag_text,
                "name": elem.get('name', ''),
                "english_name": elem.get('english_name', ''),
                "icon": elem.get('icon', '')
            })
        
        # 构建返回数据
        result_data = {
            "product_type": llm_result.get('product_type', ''),
            "theme": llm_result.get('theme', ''),
            "elements": elements,
            "text_content": llm_result.get('text_content', []),
            "description": llm_result.get('description', ''),
            "tags": tags
        }
        
        logger.info(f"混元大模型分析完成: {llm_result.get('product_type', '未知')}, {llm_result.get('theme', '')}")

        return {
            "code": 200,
            "message": "分析成功",
            "data": result_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"详细分析图片失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"详细分析图片失败: {str(e)}")


@router.post("/batch-create")
async def batch_create_material_library(
    materials: List[MaterialLibraryCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建素材
    """
    return await _batch_create_material_library(materials, mysql_repo)


@router.post("/batch-create/")
async def _batch_create_material_library(
    materials: List[MaterialLibraryCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建素材
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
        logger.info(f"开始批量创建素材 - 数量: {len(materials)}, 当前并发请求数: {current_batch_requests}")
        success = 0
        failed = 0
        errors = []

        if not materials:
            return {
                "code": 200,
                "message": "批量创建完成",
                "data": {
                    "success": 0,
                    "failed": 0,
                    "errors": []
                }
            }

        # 1. 为没有 SKU 的素材生成自动 SKU
        for i, material_data in enumerate(materials):
            if not material_data.sku:
                # 生成基于 UUID 的 SKU，格式：MAT_{UUID前8位}_{时间戳}
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                short_uuid = str(uuid.uuid4())[:8]
                material_data.sku = f"MAT_{short_uuid}_{timestamp}_{i}"
                logger.info(f"为素材生成自动 SKU: {material_data.sku}")

        # 2. 批量检查SKU是否存在
        skus = [material_data.sku for material_data in materials]
        if skus:
            # 构建IN查询，使用参数化查询防止SQL注入
            placeholders = ','.join(['%s'] * len(skus))
            check_query = f"SELECT sku FROM material_library WHERE sku IN ({placeholders})"
            existing_materials = await mysql_repo.execute_query(check_query, skus, fetch_all=True)
            existing_sku_set = {row['sku'] for row in existing_materials}
        else:
            existing_sku_set = set()

        # 3. 准备批量插入数据和错误信息
        insert_data = []
        material_sku_map = {material_data.sku: material_data for material_data in materials}

        for material_data in materials:
            if material_data.sku in existing_sku_set:
                failed += 1
                errors.append(f"素材SKU {material_data.sku} 已存在")
                continue

            # 准备插入数据
            insert_data.append([
                material_data.sku,
                material_data.batch,
                material_data.developer,
                material_data.carrier,
                material_data.element,
                material_data.modification_requirement,
                json.dumps(material_data.images),
                json.dumps(material_data.reference_images),
                material_data.status
            ])

        # 3. 执行批量插入（如果有数据需要插入）
        if insert_data:
            # 开始事务
            await mysql_repo.execute_query("START TRANSACTION")
            try:
                insert_query = """
                INSERT INTO material_library (sku, batch, developer, carrier, element, modification_requirement, images, reference_images, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                logger.error(f"批量插入素材失败，已回滚事务: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"批量创建素材失败: {str(e)}")
        
        # 4. 计算失败数量
        failed = len(materials) - success

        logger.info(f"批量创建素材完成 - 成功: {success}, 失败: {failed}")

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
        logger.error(f"批量创建素材失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量创建素材失败: {str(e)}")
    finally:
        # 减少并发请求数
        async with batch_request_lock:
            current_batch_requests -= 1
        logger.info(f"批量创建素材完成 - 数量: {len(materials)}, 剩余并发请求数: {current_batch_requests}")


@router.post("/batch-delete")
async def batch_delete_material_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    批量删除素材
    """
    return await _batch_delete_material_library(request, mysql_repo)


@router.post("/batch-delete/")
async def _batch_delete_material_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    批量删除素材
    """
    try:
        logger.info(f"开始批量删除素材 - ID列表: {request.ids}, SKU列表: {request.skus}")
        success = 0
        failed = 0
        errors = []
        items_to_process = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                material_query = "SELECT * FROM material_library WHERE id = %s"
                material = await mysql_repo.execute_query(material_query, (id,), fetch_one=True)
                if material:
                    items_to_process.append(material)
                else:
                    failed += 1
                    errors.append(f"素材ID {id} 不存在")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                material_query = "SELECT * FROM material_library WHERE sku = %s"
                material = await mysql_repo.execute_query(material_query, (sku,), fetch_one=True)
                if material:
                    items_to_process.append(material)
                else:
                    failed += 1
                    errors.append(f"素材SKU {sku} 不存在")

        # 批量处理素材
        for material in items_to_process:
            try:
                # 开始事务
                async with mysql_repo.get_connection() as conn:
                    try:
                        # 开始事务
                        await conn.begin()
                        
                        # 移动到回收站
                        recycle_query = """
                        INSERT INTO material_library_recycle_bin (
                            material_id, sku, batch, developer, carrier, images, reference_images, status, deleted_by, deleted_by_name
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        recycle_params = (
                            material["id"],
                            material["sku"],
                            material["batch"],
                            material["developer"],
                            material["carrier"],
                            material["images"],
                            material.get("reference_images", "[]"),
                            material["status"],
                            1,  # 默认删除人ID
                            "system"  # 默认删除人姓名
                        )

                        async with conn.cursor(aiomysql.DictCursor) as cursor:
                            await cursor.execute(recycle_query, recycle_params)

                            # 删除原记录
                            delete_query = "DELETE FROM material_library WHERE id = %s"
                            await cursor.execute(delete_query, (material["id"],))

                        # 提交事务
                        await conn.commit()

                        success += 1
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        failed += 1
                        errors.append(f"素材SKU {material['sku']} 删除失败: {str(e)}")
            except Exception as e:
                failed += 1
                errors.append(f"素材SKU {material['sku']} 删除失败: {str(e)}")

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
        logger.error(f"批量删除素材失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量删除素材失败: {str(e)}")


@router.delete("/{sku}")
async def delete_material_library(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    删除单个素材（移动到回收站）
    """
    try:
        logger.info(f"开始删除素材 - SKU: {sku}")

        # 查询素材是否存在
        material_query = "SELECT * FROM material_library WHERE sku = %s"
        material = await mysql_repo.execute_query(material_query, (sku,), fetch_one=True)

        if not material:
            logger.warning(f"删除素材失败 - SKU {sku} 不存在")
            raise HTTPException(status_code=404, detail="素材不存在")

        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()

                # 移动到回收站
                recycle_query = """
                INSERT INTO material_library_recycle_bin (
                    material_id, sku, batch, developer, carrier, element, images, reference_images, status, deleted_by, deleted_by_name
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                recycle_params = (
                    material["id"],
                    material["sku"],
                    material["batch"],
                    material["developer"],
                    material["carrier"],
                    material.get("element", ""),
                    material["images"],
                    material.get("reference_images", "[]"),
                    material["status"],
                    1,  # 默认删除人ID
                    "system"  # 默认删除人姓名
                )

                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(recycle_query, recycle_params)

                    # 删除原记录
                    delete_query = "DELETE FROM material_library WHERE id = %s"
                    await cursor.execute(delete_query, (material["id"],))

                # 提交事务
                await conn.commit()

                logger.info(f"素材删除成功 - SKU: {sku}")

                return {
                    "code": 200,
                    "message": "删除成功",
                    "data": {
                        "sku": sku
                    }
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                logger.error(f"删除素材失败 - SKU {sku}: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"删除素材失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除素材失败 - SKU {sku}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除素材失败: {str(e)}")


@router.get("/recycle-bin/")
async def get_recycle_bin_slash(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站素材（有末尾斜杠路由）
    """
    return await get_recycle_bin(page, size, mysql_repo)


@router.get("/recycle-bin")
async def get_recycle_bin(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站素材
    """
    try:
        offset = (page - 1) * size

        # 查询回收站素材
        query = """
        SELECT * FROM material_library_recycle_bin
        ORDER BY delete_time DESC
        LIMIT %s OFFSET %s
        """
        materials = await mysql_repo.execute_query(query, (size, offset))

        # 计算总数
        count_query = "SELECT COUNT(*) as total FROM material_library_recycle_bin"
        count_result = await mysql_repo.execute_query(count_query, fetch_one=True)
        total = count_result["total"]

        # 处理JSON字段并将图片路径转换为URL
        for material in materials:
            try:
                material["images"] = _convert_image_paths_to_urls(material["images"])
            except Exception as e:
                material["images"] = []
                logger.error(f"处理回收站素材ID {material['material_id']} 的images字段失败: {str(e)}")
            
            try:
                material["reference_images"] = _convert_image_paths_to_urls(material["reference_images"])
            except Exception as e:
                material["reference_images"] = []
                logger.error(f"处理回收站素材ID {material['material_id']} 的reference_images字段失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": materials,
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取回收站素材失败: {str(e)}")


# 元素词库文件路径
ELEMENT_TAGS_FILE = os.path.join(project_root, 'scripts', '元素词库', '元素词库.txt')


def load_element_tags_from_file() -> list[str]:
    """
    从文件加载元素词库

    Returns:
        list[str]: 元素词列表
    """
    try:
        if not os.path.exists(ELEMENT_TAGS_FILE):
            logger.warning(f"元素词库文件不存在: {ELEMENT_TAGS_FILE}")
            return []

        with open(ELEMENT_TAGS_FILE, 'r', encoding='utf-8') as f:
            elements = [line.strip() for line in f if line.strip()]

        return elements
    except Exception as e:
        logger.error(f"加载元素词库文件失败: {str(e)}")
        return []


def save_element_tags_to_file(elements: list[str]) -> bool:
    """
    保存元素词库到文件

    Args:
        elements: 元素词列表

    Returns:
        bool: 是否保存成功
    """
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(ELEMENT_TAGS_FILE), exist_ok=True)

        with open(ELEMENT_TAGS_FILE, 'w', encoding='utf-8') as f:
            for element in elements:
                f.write(f"{element}\n")

        return True
    except Exception as e:
        logger.error(f"保存元素词库文件失败: {str(e)}")
        return False


@router.get("/elements")
async def get_elements():
    """
    获取当前元素词库列表

    响应:
    {
        "code": 200,
        "message": "获取成功",
        "data": [
            "猫咪",
            "狗狗",
            "兔子",
            ...
        ]
    }
    """
    try:
        logger.info("获取元素词库列表")

        # 从文件加载元素词库
        elements = load_element_tags_from_file()

        logger.info(f"元素词库获取成功 - 数量: {len(elements)}")

        return {
            "code": 200,
            "message": "获取成功",
            "data": elements
        }
    except Exception as e:
        logger.error(f"获取元素词库失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取元素词库失败: {str(e)}")


@router.put("/elements")
async def update_elements(
    elements: list[str]
):
    """
    更新元素词库

    请求体:
    [
        "猫咪",
        "狗狗",
        "兔子",
        ...
    ]

    响应:
    {
        "code": 200,
        "message": "更新成功",
        "data": {
            "updated_count": 20
        }
    }
    """
    try:
        logger.info(f"开始更新元素词库 - 新元素数量: {len(elements)}")

        # 验证输入
        if not isinstance(elements, list):
            raise HTTPException(status_code=400, detail="元素词库必须是数组格式")

        # 过滤空字符串和重复项
        elements = [element.strip() for element in elements if element.strip()]
        elements = list(set(elements))

        if not elements:
            raise HTTPException(status_code=400, detail="元素词库不能为空")

        # 保存到文件
        if not save_element_tags_to_file(elements):
            raise HTTPException(status_code=500, detail="保存元素词库文件失败")

        logger.info(f"元素词库更新成功 - 新元素数量: {len(elements)}")

        return {
            "code": 200,
            "message": "更新成功",
            "data": {
                "updated_count": len(elements)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新元素词库失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新元素词库失败: {str(e)}")


@router.post("/recycle-bin/batch-restore")
async def batch_restore_material_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量恢复素材
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站素材信息
                    recycle_material = await mysql_repo.execute_query(
                        "SELECT * FROM material_library_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_material:
                        failed += 1
                        errors.append(f"回收站素材ID {id} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到素材库表
                            restore_query = """
                            INSERT INTO material_library (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_material["material_id"],
                                recycle_material["sku"],
                                recycle_material["batch"],
                                recycle_material["developer"],
                                recycle_material["carrier"],
                                recycle_material["images"],
                                recycle_material["reference_images"],
                                recycle_material["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM material_library_recycle_bin WHERE id = %s"
                                await cursor.execute(delete_query, (id,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"素材ID {id} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"素材ID {id} 恢复失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站素材信息
                    recycle_material = await mysql_repo.execute_query(
                        "SELECT * FROM material_library_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_material:
                        failed += 1
                        errors.append(f"回收站素材SKU {sku} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到素材库表
                            restore_query = """
                            INSERT INTO material_library (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_material["material_id"],
                                recycle_material["sku"],
                                recycle_material["batch"],
                                recycle_material["developer"],
                                recycle_material["carrier"],
                                recycle_material["images"],
                                recycle_material["reference_images"],
                                recycle_material["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM material_library_recycle_bin WHERE sku = %s"
                                await cursor.execute(delete_query, (sku,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"素材SKU {sku} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"素材SKU {sku} 恢复失败: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"批量恢复素材失败: {str(e)}")


@router.post("/process-local-files")
async def process_material_library_local_files(
    mysql_repo=get_mysql_repo()
):
    """
    处理素材库本地文件
    """
    try:
        # 导入Redis和Qdrant仓库
        from ...repositories import RedisRepository, QdrantRepository
        
        # 创建仓库实例
        redis_repo = RedisRepository() if settings.CACHE_ENABLED else None
        qdrant_repo = QdrantRepository() if settings.CACHE_ENABLED else None
        
        # 获取库图片服务实例
        library_service = get_library_image_service(mysql_repo, redis_repo, qdrant_repo)
        
        # 处理素材库图片
        result = await library_service.process_library_images("material")
        
        # 构建响应
        return {
            "code": 200,
            "message": "素材库本地文件处理完成",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"处理素材库本地文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理素材库本地文件失败: {str(e)}")


@router.post("/process-all-libraries")
async def process_all_libraries_local_files(
    mysql_repo=get_mysql_repo()
):
    """
    处理所有库的本地文件
    """
    try:
        # 导入Redis和Qdrant仓库
        from ...repositories import RedisRepository, QdrantRepository
        
        # 创建仓库实例
        redis_repo = RedisRepository() if settings.CACHE_ENABLED else None
        qdrant_repo = QdrantRepository() if settings.CACHE_ENABLED else None
        
        # 获取库图片服务实例
        library_service = get_library_image_service(mysql_repo, redis_repo, qdrant_repo)
        
        # 处理所有库图片
        result = await library_service.process_all_libraries()
        
        # 构建响应
        return {
            "code": 200,
            "message": "所有库本地文件处理完成",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"处理所有库本地文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理所有库本地文件失败: {str(e)}")


@router.delete("/recycle-bin/clear")
async def clear_material_library_recycle_bin(
    mysql_repo=get_mysql_repo()
):
    """
    清空素材库回收站
    """
    try:
        # 获取所有回收站素材信息
        recycle_materials = await mysql_repo.execute_query(
            "SELECT id, sku, images, reference_images FROM material_library_recycle_bin",
            ()
        )
        
        # 删除所有相关的腾讯云COS图片
        for material in recycle_materials:
            material_id = material.get('id')
            material_sku = material.get('sku')
            await _delete_cos_images(mysql_repo, material_id, material_sku)
        
        # 清空回收站
        result = await mysql_repo.execute_delete(
            "DELETE FROM material_library_recycle_bin",
            ()
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "素材库回收站清空成功",
            "data": {"deleted_count": result}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空素材库回收站失败: {str(e)}")


@router.delete("/recycle-bin/batch")
async def batch_permanently_delete_material_library(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量永久删除素材
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站素材信息
                    recycle_material = await mysql_repo.execute_query(
                        "SELECT * FROM material_library_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_material:
                        failed += 1
                        errors.append(f"回收站素材ID {id} 不存在")
                        continue

                    # 删除相关的腾讯云COS图片
                    material_id = recycle_material.get('material_id')
                    material_sku = recycle_material.get('sku')
                    await _delete_cos_images(mysql_repo, material_id, material_sku)

                    # 从回收站删除记录
                    await mysql_repo.execute_delete(
                        "DELETE FROM material_library_recycle_bin WHERE id = %s",
                        (id,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"永久删除素材ID {id} 失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站素材信息
                    recycle_material = await mysql_repo.execute_query(
                        "SELECT * FROM material_library_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_material:
                        failed += 1
                        errors.append(f"回收站素材SKU {sku} 不存在")
                        continue

                    # 删除相关的腾讯云COS图片
                    material_id = recycle_material.get('material_id')
                    material_sku = recycle_material.get('sku')
                    await _delete_cos_images(mysql_repo, material_id, material_sku)

                    # 从回收站删除记录
                    await mysql_repo.execute_delete(
                        "DELETE FROM material_library_recycle_bin WHERE sku = %s",
                        (sku,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"永久删除素材SKU {sku} 失败: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"批量永久删除素材失败: {str(e)}")


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


def extract_and_add_elements(element_str: str):
    """
    从元素字符串中提取元素词，并自动添加到元素库

    Args:
        element_str: 元素字符串（逗号分隔）
    """
    try:
        if not element_str:
            return

        # 分割元素词
        elements = [e.strip() for e in element_str.split(',') if e.strip()]
        if not elements:
            return

        # 加载现有元素库
        existing_elements = load_element_tags_from_file()
        existing_set = set(existing_elements)

        # 找出新元素词
        new_elements = []
        for element in elements:
            if element and element not in existing_set:
                new_elements.append(element)
                existing_set.add(element)

        # 如果有新元素词，添加到元素库
        if new_elements:
            logger.info(f"发现新元素词，自动添加到元素库: {new_elements}")
            all_elements = existing_elements + new_elements
            save_element_tags_to_file(all_elements)
            logger.info(f"元素库更新成功，新增 {len(new_elements)} 个元素词")

    except Exception as e:
        logger.error(f"自动添加元素词到元素库失败: {str(e)}")


@router.put("/sku/{sku}")
async def update_material_library(
    sku: str,
    material: MaterialLibraryUpdate,
    mysql_repo=get_mysql_repo()
):
    """
    更新素材
    """
    try:
        logger.info(f"开始更新素材 - SKU: {sku}")

        # 检查SKU是否存在
        check_query = "SELECT id FROM material_library WHERE sku = %s"
        existing_material = await mysql_repo.execute_query(check_query, (sku,), fetch_one=True)
        if not existing_material:
            logger.error(f"更新素材失败 - SKU {sku} 不存在")
            raise HTTPException(status_code=404, detail="素材不存在")

        material_id = existing_material['id']

        # 自动将新元素词添加到元素库
        if material.element:
            extract_and_add_elements(material.element)

        # 准备更新数据
        update_data = {
            'batch': material.batch,
            'developer': material.developer,
            'carrier': material.carrier,
            'element': material.element,
            'modification_requirement': material.modification_requirement,
            'status': material.status
        }
        
        # 处理图片数据
        if material.images:
            update_data['images'] = json.dumps(material.images)
        if material.reference_images:
            update_data['reference_images'] = json.dumps(material.reference_images)
        if material.final_draft_images:
            update_data['final_draft_images'] = json.dumps(material.final_draft_images)
        
        # 构建更新SQL
        set_clauses = []
        params = []
        
        for key, value in update_data.items():
            if value is not None:
                set_clauses.append(f"{key} = %s")
                params.append(value)
        
        # 添加更新时间
        set_clauses.append("update_time = %s")
        params.append(datetime.now())
        
        # 添加WHERE条件
        params.append(sku)
        
        update_query = f"UPDATE material_library SET {', '.join(set_clauses)} WHERE sku = %s"
        logger.debug(f"执行素材更新 - SQL: {update_query}, 参数: {tuple(params)}")
        
        # 执行更新
        await mysql_repo.execute_update(update_query, tuple(params))
        logger.info(f"素材更新成功 - SKU: {sku}, ID: {material_id}")
        
        # 获取更新后的数据
        updated_material = await mysql_repo.execute_query(
            "SELECT * FROM material_library WHERE sku = %s",
            (sku,),
            fetch_one=True
        )
        
        # 处理JSON字段并将图片路径转换为URL
        try:
            updated_material["images"] = _convert_image_paths_to_urls(updated_material["images"])
        except Exception as e:
            updated_material["images"] = []
            logger.error(f"处理素材ID {updated_material['id']} 的images字段失败: {str(e)}")
        
        try:
            updated_material["reference_images"] = _convert_image_paths_to_urls(updated_material["reference_images"])
        except Exception as e:
            updated_material["reference_images"] = []
            logger.error(f"处理素材ID {updated_material['id']} 的reference_images字段失败: {str(e)}")
        
        try:
            updated_material["final_draft_images"] = _convert_image_paths_to_urls(updated_material["final_draft_images"])
        except Exception as e:
            updated_material["final_draft_images"] = []
            logger.error(f"处理素材ID {updated_material['id']} 的final_draft_images字段失败: {str(e)}")
        
        # 使用MaterialLibraryResponse模型序列化，确保字段名转换为驼峰命名
        material_response = MaterialLibraryResponse(**updated_material)
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "更新成功",
            "data": material_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新素材失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新素材失败: {str(e)}")
