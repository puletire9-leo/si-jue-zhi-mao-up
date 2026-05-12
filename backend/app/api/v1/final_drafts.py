"""
[参考] 定稿管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: FinalDraftController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import os
import logging
import aiomysql
from datetime import datetime, timedelta
from urllib.parse import urlparse
import aiohttp
import zipfile
from io import BytesIO
import asyncio
import hashlib
import uuid
import tempfile

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    Image = None

from ...models import (
    FinalDraftCreate,
    FinalDraftUpdate,
    FinalDraftResponse,
    BatchOperationRequest
)

from ...models.download_task import DownloadTaskSource

from ...config import settings

from ...services.download_task_service import download_task_service, DownloadTaskStatus, DOWNLOAD_CACHE_DIR
from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/final-drafts", tags=["final_drafts"])


class DownloadStatus(Enum):
    """下载状态枚举"""
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class DownloadResult:
    """下载结果数据类"""
    filename: str
    url: str
    status: DownloadStatus
    size: int = 0
    message: str = ""
    content: Optional[bytes] = field(default=None, repr=False)


# 临时ZIP文件存储
_temp_zip_files: Dict[str, Dict] = {}


async def cleanup_expired_temp_files():
    """
    清理过期的临时ZIP文件
    
    定期清理过期的临时ZIP文件，避免占用过多存储空间
    注意：不会清理任务专属目录中的文件，这些文件由下载任务服务管理
    """
    current_time = datetime.now()
    expired_tokens = []
    
    # 找出过期的文件
    for token, file_info in _temp_zip_files.items():
        expires_at = file_info.get('expires_at')
        if expires_at and current_time > expires_at:
            expired_tokens.append(token)
    
    # 清理过期文件
    for token in expired_tokens:
        file_info = _temp_zip_files.get(token)
        if file_info:
            temp_path = file_info.get('path')
            if temp_path and os.path.exists(temp_path):
                try:
                    # 检查是否在任务专属目录中
                    task_dirs = [d for d in os.listdir(DOWNLOAD_CACHE_DIR) if os.path.isdir(os.path.join(DOWNLOAD_CACHE_DIR, d))]
                    in_task_dir = False
                    for task_dir in task_dirs:
                        if temp_path.startswith(os.path.join(DOWNLOAD_CACHE_DIR, task_dir)):
                            in_task_dir = True
                            break
                    
                    # 只清理临时文件，不清理任务专属目录中的文件
                    if not in_task_dir:
                        os.remove(temp_path)
                        logger.info(f"清理过期临时ZIP文件: {temp_path}")
                    else:
                        logger.info(f"跳过清理任务专属目录中的文件: {temp_path}")
                except Exception as e:
                    logger.error(f"清理过期临时ZIP文件失败: {e}")
            # 从字典中移除
            del _temp_zip_files[token]
    
    if expired_tokens:
        logger.info(f"清理了 {len(expired_tokens)} 个过期临时ZIP文件")


# 启动定时清理任务
async def start_temp_files_cleanup():
    """
    启动定时清理任务
    
    每5分钟清理一次过期的临时ZIP文件
    """
    async def cleanup_loop():
        while True:
            try:
                await cleanup_expired_temp_files()
            except Exception as e:
                logger.error(f"清理临时文件失败: {e}")
            # 每5分钟执行一次
            await asyncio.sleep(300)
    
    # 启动后台任务
    asyncio.create_task(cleanup_loop())
    logger.info("[OK] 临时文件定时清理任务已启动")

# 图片信息查询缓存
_image_info_cache: Dict[str, Dict] = {}
_image_info_cache_time: Dict[str, datetime] = {}
_image_cache_ttl = 300  # 缓存5分钟


def _get_cached_image_info(object_key: str) -> Optional[Dict]:
    """从缓存获取图片信息"""
    if object_key in _image_info_cache:
        cache_time = _image_info_cache_time.get(object_key)
        if cache_time and (datetime.now() - cache_time).seconds < _image_cache_ttl:
            return _image_info_cache[object_key]
        # 缓存过期，清除
        del _image_info_cache[object_key]
        del _image_info_cache_time[object_key]
    return None


def _set_cached_image_info(object_key: str, info: Optional[Dict]):
    """设置图片信息缓存"""
    _image_info_cache[object_key] = info
    _image_info_cache_time[object_key] = datetime.now()


def _clean_url(url: str) -> str:
    """
    清理URL，移除各种可能导致请求失败的字符

    Args:
        url: 原始URL字符串

    Returns:
        str: 清理后的URL字符串
    """
    if not url or not isinstance(url, str):
        return url

    # 移除首尾空白字符
    url = url.strip()

    # 移除各种引号（单引号、双引号、反引号）
    url = url.replace('`', '')
    url = url.replace("'", '')
    url = url.replace('"', '')

    # 再次清理首尾空白
    url = url.strip()

    # 移除开头的斜杠（如果是相对路径）
    if url.startswith('/') and not url.startswith('//'):
        url = url[1:]

    return url

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
                    
                # 清理URL中的反引号和特殊字符
                img_path = img_path.replace('`', '')
                
                # 检查是否已经是完整URL
                # 包括HTTP/HTTPS协议
                if img_path.startswith(('http://', 'https://')):
                    # 已经是完整URL，直接使用，确保HTTPS协议
                    img_url = img_path
                    
                    # 修复：检查URL是否被重复拼接（如 https://domain.com/https://...）
                    if 'https://' in img_url[8:] or 'http://' in img_url[8:]:
                        logger.warning(f"检测到URL被重复拼接，尝试修复: {img_url[:100]}...")
                        # 提取最后一个http://或https://后面的内容
                        if 'https://' in img_url[8:]:
                            parts = img_url.split('https://')
                            if len(parts) > 2:
                                img_url = 'https://' + parts[-1]
                                logger.info(f"修复后的URL: {img_url[:100]}...")
                        elif 'http://' in img_url[8:]:
                            parts = img_url.split('http://')
                            if len(parts) > 2:
                                img_url = 'http://' + parts[-1]
                                logger.info(f"修复后的URL: {img_url[:100]}...")
                    
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
                    # 清理URL中的反引号和特殊字符
                    img_url = img_url.replace('`', '')
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
                    # 清理URL中的反引号和特殊字符
                    img_str = img_str.replace('`', '')
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
        
        # 3. 定稿图专用路径：final_drafts/xxx_512x512.webp
        if dirname.endswith('final_drafts'):
            final_thumbnail_filename = f"{name_without_ext}_512x512.webp"
            thumbnail_keys.append(os.path.join(dirname, final_thumbnail_filename))
        
        # 去重并返回
        return list(set(thumbnail_keys))
    except Exception as e:
        logger.error(f"生成缩略图对象键失败，原图对象键: {object_key}, 错误: {str(e)}")
        return []


async def _delete_cos_images(mysql_repo, draft_id: int, draft_sku: str) -> None:
    """
    删除定稿相关的腾讯云COS图片、本地缩略图和images表记录
    
    Args:
        mysql_repo: MySQL数据库仓库实例
        draft_id: 定稿ID
        draft_sku: 定稿SKU
    """
    try:
        from ...services.cos_service import cos_service
        
        # 如果COS服务未启用，直接返回
        if not cos_service.enabled:
            logger.warning(f"COS服务未启用，跳过删除图片操作 - 定稿ID: {draft_id}, SKU: {draft_sku}")
            return
        
        # 获取回收站定稿信息
        try:
            # 尝试获取包含本地缩略图路径的信息
            recycle_draft = await mysql_repo.execute_query(
                "SELECT images, reference_images, local_thumbnail_path FROM final_draft_recycle_bin WHERE id = %s OR sku = %s", 
                (draft_id, draft_sku), 
                fetch_one=True
            )
        except Exception as e:
            # 如果local_thumbnail_path字段不存在，使用不包含该字段的查询
            logger.warning(f"获取本地缩略图路径失败，尝试使用兼容查询 - 错误: {str(e)}")
            recycle_draft = await mysql_repo.execute_query(
                "SELECT images, reference_images FROM final_draft_recycle_bin WHERE id = %s OR sku = %s", 
                (draft_id, draft_sku), 
                fetch_one=True
            )
        
        if not recycle_draft:
            logger.warning(f"回收站定稿不存在，跳过删除图片操作 - 定稿ID: {draft_id}, SKU: {draft_sku}")
            return
        
        # 处理images字段
        images = _convert_image_paths_to_urls(recycle_draft.get('images', []))
        # 处理reference_images字段
        reference_images = _convert_image_paths_to_urls(recycle_draft.get('reference_images', []))
        # 获取本地缩略图路径
        local_thumbnail_path = recycle_draft.get('local_thumbnail_path')
        
        # 合并所有图片URL
        all_images = images + reference_images
        
        logger.info(f"开始删除定稿相关的图片 - 定稿ID: {draft_id}, SKU: {draft_sku}, 图片数量: {len(all_images)}")
        
        # 删除本地缩略图
        if local_thumbnail_path:
            try:
                # 检查文件存在性
                if os.path.exists(local_thumbnail_path):
                    os.remove(local_thumbnail_path)
                    logger.info(f"成功删除本地缩略图 - 路径: {local_thumbnail_path}, 定稿ID: {draft_id}, SKU: {draft_sku}")
                else:
                    logger.warning(f"本地缩略图文件不存在，跳过删除 - 路径: {local_thumbnail_path}, 定稿ID: {draft_id}, SKU: {draft_sku}")
            except Exception as e:
                logger.error(f"删除本地缩略图失败 - 路径: {local_thumbnail_path}, 定稿ID: {draft_id}, SKU: {draft_sku}, 错误: {str(e)}")
                # 本地缩略图删除失败不影响主流程，只记录日志
        
        # 删除每张图片和对应的缩略图
        for image_url in all_images:
            # 提取COS对象键
            object_key = _extract_cos_object_key(image_url)
            if object_key:
                # 删除原图/参考图
                success, error_msg = await cos_service.delete_image(object_key)
                if success:
                    logger.info(f"成功删除COS图片 - 对象键: {object_key}, 定稿ID: {draft_id}, SKU: {draft_sku}")
                else:
                    logger.error(f"删除COS图片失败 - 对象键: {object_key}, 定稿ID: {draft_id}, SKU: {draft_sku}, 错误: {error_msg}")
                
                # 生成所有可能的缩略图对象键
                thumbnail_keys = _generate_thumbnail_object_keys(object_key)
                
                # 删除所有对应的缩略图
                for thumbnail_key in thumbnail_keys:
                    success, error_msg = await cos_service.delete_image(thumbnail_key)
                    if success:
                        logger.info(f"成功删除缩略图 - 对象键: {thumbnail_key}, 定稿ID: {draft_id}, SKU: {draft_sku}")
                    else:
                        # 缩略图删除失败不影响主流程，只记录日志
                        logger.warning(f"删除缩略图失败 - 对象键: {thumbnail_key}, 定稿ID: {draft_id}, SKU: {draft_sku}, 错误: {error_msg}")
            else:
                logger.warning(f"无法提取COS对象键，跳过删除 - URL: {image_url}, 定稿ID: {draft_id}, SKU: {draft_sku}")
        
        # 删除images表中与该定稿SKU相关的记录
        try:
            delete_images_result = await mysql_repo.execute_update(
                "DELETE FROM images WHERE sku = %s", 
                (draft_sku,)
            )
            logger.info(f"成功删除images表记录 - 定稿SKU: {draft_sku}, 删除记录数: {delete_images_result}")
        except Exception as e:
            logger.error(f"删除images表记录失败 - 定稿SKU: {draft_sku}, 错误: {str(e)}")
            # images表记录删除失败不影响主流程，只记录日志
    except Exception as e:
        logger.error(f"删除定稿COS图片失败 - 定稿ID: {draft_id}, SKU: {draft_sku}, 错误: {str(e)}", exc_info=True)


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
async def get_final_drafts_no_slash(
    search_type: Optional[str] = Query("sku", description="搜索类型"),
    search_content: Optional[str] = Query(None, description="搜索内容"),
    developer: Optional[List[str]] = Query(None, description="开发人筛选"),
    status: Optional[List[str]] = Query(None, description="状态筛选"),
    carrier: Optional[List[str]] = Query(None, description="载体筛选"),
    batch: Optional[List[str]] = Query(None, description="批次筛选"),
    sort_by: Optional[str] = Query("create_time", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    page: Optional[str] = Query("1", description="当前页码"),
    size: Optional[str] = Query("20", description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取定稿列表（无末尾斜杠路由）

    支持搜索、筛选、排序和分页
    """
    # 处理分页参数，将字符串转换为整数，处理空字符串情况
    try:
        page_int = int(page) if page and page.strip() else 1
    except (ValueError, TypeError):
        page_int = 1
    
    try:
        size_int = int(size) if size and size.strip() else 20
    except (ValueError, TypeError):
        size_int = 20
    
    # 确保参数在有效范围内
    page_int = max(1, page_int)
    size_int = max(1, min(100, size_int))
    
    # 调用带斜杠路由的处理函数
    return await get_final_drafts(
        search_type=search_type,
        search_content=search_content,
        developer=developer,
        status=status,
        carrier=carrier,
        batch=batch,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page_int,
        size=size_int,
        mysql_repo=mysql_repo
    )


@router.get("/")
async def get_final_drafts(
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
    获取定稿列表

    支持搜索、筛选、排序和分页
    """
    try:
        logger.info(f"开始获取定稿列表 - 搜索类型: {search_type}, 搜索内容: {search_content}, 页码: {page}, 每页数量: {size}")
        # 构建查询条件
        conditions = []
        params = []

        # 存储多项搜索的原始搜索项，用于后续计算未找到的项
        search_items = []
        is_multi_search = False

        # 搜索条件
        if search_content:
            # 支持多种分隔符：换行符、逗号、空格
            # 先统一替换为特殊分隔符，再分割
            import re
            # 替换换行符、逗号为空格，然后按空格分割
            normalized_content = re.sub(r'[\r\n,]+', ' ', search_content)
            # 按空格分割，去除空项
            search_items = [item.strip() for item in normalized_content.split(' ') if item.strip()]
            # 去重，保持顺序
            seen = set()
            unique_items = []
            for item in search_items:
                if item not in seen:
                    seen.add(item)
                    unique_items.append(item)
            search_items = unique_items
            is_multi_search = len(search_items) > 1

            # 添加调试日志
            logger.info(f"多项精确搜索处理 - 原始内容长度: {len(search_content)}, 分割后数量: {len(search_items)}, 搜索项: {search_items[:10]}{'...' if len(search_items) > 10 else ''}")

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
                            conditions.append(f"({' OR '.join(element_conditions)})")
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
        # 如果是多项精确搜索，取消分页限制，返回所有结果
        if is_multi_search and search_type in ["sku", "batch", "developer", "carrier", "status"]:
            # 多项精确搜索时不限制数量，返回所有匹配结果
            limit_clause = ""
            logger.info(f"多项精确搜索模式 - 取消分页限制，搜索项数量: {len(search_items)}")
        else:
            # 普通搜索使用分页
            offset = (page - 1) * size
            limit_clause = "LIMIT %s OFFSET %s"
            params.extend([size, offset])

        # 执行主查询
        query = f"SELECT * FROM final_drafts {where_clause} {order_by_clause} {limit_clause}".strip()
        # 记录SQL和参数，限制参数数量避免日志过大
        params_str = str(tuple(params))[:500] + '...' if len(str(tuple(params))) > 500 else str(tuple(params))
        logger.info(f"执行定稿列表查询 - SQL: {query}, 参数数量: {len(params)}, 参数: {params_str}")
        drafts = await mysql_repo.execute_query(query, tuple(params))
        
        # 确保drafts是数组
        if not isinstance(drafts, list):
            logger.error(f"获取定稿列表失败 - 返回数据不是数组: {type(drafts)}")
            drafts = []
        
        logger.info(f"获取定稿列表成功 - 数量: {len(drafts)}")

        # 计算总数
        count_query = f"SELECT COUNT(*) as total FROM final_drafts {where_clause}"
        # 多项精确搜索时没有分页参数，不需要切片
        if is_multi_search and search_type in ["sku", "batch", "developer", "carrier", "status"]:
            count_params = tuple(params)
        else:
            count_params = tuple(params[:-2]) if len(params) >= 2 else tuple(params)
        logger.info(f"执行定稿总数查询 - SQL: {count_query}, 参数数量: {len(count_params)}")
        count_result = await mysql_repo.execute_query(count_query, count_params, fetch_one=True)
        
        # 确保count_result是字典类型
        total = 0
        if isinstance(count_result, dict):
            total = count_result.get("total", 0)
            # 确保总数与实际数据数量一致
            if total > 0 and len(drafts) == 0:
                # 总数大于0，但实际查询到的数据为0，可能是分页或筛选条件导致，使用实际数据数量
                logger.warning(f"计数查询返回{total}，但实际查询到0条数据，可能是分页或筛选条件导致，已修正总数为0")
                total = 0
            elif total == 0 and len(drafts) > 0:
                # 如果总数为0，但实际查询到了数据，使用实际数据数量作为总数
                total = len(drafts)
                logger.warning(f"计数查询返回0，但实际查询到{len(drafts)}条数据，已使用实际数量作为总数")
            elif len(drafts) > total:
                # 实际数据数量大于计数，以实际为准
                total = len(drafts)
                logger.warning(f"实际查询到{len(drafts)}条数据，大于计数查询返回的{total}，已修正总数")
        else:
            total = len(drafts)
            logger.warning(f"计数查询返回值不是字典类型: {type(count_result)}，已使用实际查询数量作为总数")
        
        logger.info(f"获取定稿总数成功 - 总数: {total}")
        
        # 确保drafts和total一致
        if len(drafts) > total:
            # 实际数据数量大于计数，截断数据或修正计数
            logger.warning(f"实际数据数量{len(drafts)}大于计数{total}，已修正总数")
            total = len(drafts)
        elif total == 0 and len(drafts) > 0:
            # 总数为0，但实际查询到数据，重置为一致
            logger.warning(f"总数为0，但实际查询到{len(drafts)}条数据，已修正总数为实际数量")
            total = len(drafts)

        # 处理JSON字段并将图片路径转换为URL
        for draft in drafts:
            try:
                draft["images"] = _convert_image_paths_to_urls(draft["images"])
            except Exception as e:
                draft["images"] = []
                logger.error(f"处理定稿ID {draft['id']} 的images字段失败: {str(e)}")
            
            try:
                draft["reference_images"] = _convert_image_paths_to_urls(draft["reference_images"])
            except Exception as e:
                draft["reference_images"] = []
                logger.error(f"处理定稿ID {draft['id']} 的reference_images字段失败: {str(e)}")

        # 使用FinalDraftResponse模型序列化每个定稿，确保字段名转换为驼峰命名
        serialized_drafts = [FinalDraftResponse(**draft).model_dump(by_alias=True) for draft in drafts]

        # 计算未找到的搜索项（仅在多项精确搜索时）
        not_found_items = []
        if is_multi_search and search_type in ["sku", "batch", "developer", "carrier", "status"]:
            found_items = set()
            for draft in drafts:
                if search_type == "sku":
                    found_items.add(draft.get("sku"))
                elif search_type == "batch":
                    found_items.add(draft.get("batch"))
                elif search_type == "developer":
                    found_items.add(draft.get("developer"))
                elif search_type == "carrier":
                    found_items.add(draft.get("carrier"))
                elif search_type == "status":
                    found_items.add(draft.get("status"))

            # 找出未找到的项
            not_found_items = [item for item in search_items if item not in found_items]
            if not_found_items:
                logger.info(f"多项精确搜索未找到的{search_type}: {not_found_items}")

        # 构建统一格式响应，确保list始终是数组
        response_data = {
            "list": serialized_drafts or [],
            "total": total,
            "page": page,
            "size": size
        }

        # 如果有未找到的项，添加到响应中
        if not_found_items:
            response_data["not_found_items"] = not_found_items

        return {
            "code": 200,
            "message": "获取成功",
            "data": response_data
        }
    except Exception as e:
        logger.error(f"获取定稿列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取定稿列表失败: {str(e)}")


@router.post("")
async def create_final_draft_no_slash(
    draft: FinalDraftCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新定稿（无末尾斜杠路由）
    """
    return await create_final_draft(draft, mysql_repo)


@router.post("/")
async def create_final_draft(
    draft: FinalDraftCreate,
    mysql_repo=get_mysql_repo()
):
    """
    创建新定稿
    """
    try:
        logger.info(f"开始创建新定稿 - SKU: {draft.sku}, 批次: {draft.batch}, 开发人: {draft.developer}")
        
        # 检查SKU是否已存在
        check_query = "SELECT id FROM final_drafts WHERE sku = %s"
        logger.debug(f"检查SKU是否已存在 - SQL: {check_query}, 参数: ({draft.sku},)")
        existing_draft = await mysql_repo.execute_query(check_query, (draft.sku,), fetch_one=True)
        if existing_draft:
            logger.error(f"创建定稿失败 - SKU {draft.sku} 已存在")
            raise HTTPException(status_code=400, detail="该SKU已存在")

        # 插入数据
        insert_query = """
        INSERT INTO final_drafts (sku, batch, developer, carrier, element, modification_requirement, infringement_label, images, reference_images, status, local_thumbnail_path, local_thumbnail_status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            draft.sku,
            draft.batch,
            draft.developer,
            draft.carrier,
            draft.element,
            draft.modification_requirement,
            draft.infringement_label,
            json.dumps(draft.images),
            json.dumps(draft.reference_images),
            draft.status,
            None,  # local_thumbnail_path
            'pending'  # local_thumbnail_status
        ]

        logger.debug(f"执行定稿插入 - SQL: {insert_query}, 参数: {tuple(params)}")
        result = await mysql_repo.execute_insert(insert_query, tuple(params))
        draft_id = result['last_id']
        logger.info(f"定稿插入成功 - ID: {draft_id}")

        # 获取插入的数据
        created_draft = await mysql_repo.execute_query(
            "SELECT * FROM final_drafts WHERE id = %s",
            (draft_id,),
            fetch_one=True
        )

        # 处理JSON字段并将图片路径转换为URL
        try:
            if created_draft:
                # 只有当created_draft不是None时才处理
                draft_id_log = created_draft.get('id', draft_id)
                
                try:
                    created_draft["images"] = _convert_image_paths_to_urls(created_draft["images"])
                except Exception as e:
                    created_draft["images"] = []
                    logger.error(f"处理新创建的定稿ID {draft_id_log} 的images字段失败: {str(e)}")
                
                try:
                    created_draft["reference_images"] = _convert_image_paths_to_urls(created_draft["reference_images"])
                except Exception as e:
                    created_draft["reference_images"] = []
                    logger.error(f"处理新创建的定稿ID {draft_id_log} 的reference_images字段失败: {str(e)}")
                
                # 从腾讯云下载已生成的缩略图到本地
                local_thumbnail_path = None
                all_images = created_draft.get("images", []) + created_draft.get("reference_images", [])
                
                if all_images:
                    # 优先使用第一张图片
                    first_image = all_images[0]
                    logger.info(f"开始下载第一张图片的本地缩略图: {first_image}")
                    local_thumbnail_path = await _download_local_thumbnail(first_image)
                    
                    if local_thumbnail_path:
                        logger.info(f"成功下载本地缩略图: {local_thumbnail_path}")
                        # 更新数据库中的本地缩略图路径
                        update_query = """
                        UPDATE final_drafts 
                        SET local_thumbnail_path = %s, 
                            local_thumbnail_status = %s, 
                            local_thumbnail_updated_at = %s 
                        WHERE id = %s
                        """
                        update_params = [
                            local_thumbnail_path,
                            'completed',
                            datetime.now(),
                            draft_id_log
                        ]
                        await mysql_repo.execute_update(update_query, update_params)
                        # 更新created_draft中的本地缩略图路径
                        created_draft["local_thumbnail_path"] = local_thumbnail_path
                        created_draft["local_thumbnail_status"] = 'completed'
                        created_draft["local_thumbnail_updated_at"] = datetime.now().isoformat()
                    else:
                        logger.warning(f"下载本地缩略图失败: {first_image}")
                        # 更新数据库中的本地缩略图状态为失败
                        update_query = """
                        UPDATE final_drafts 
                        SET local_thumbnail_status = %s 
                        WHERE id = %s
                        """
                        await mysql_repo.execute_update(update_query, ['failed', draft_id_log])
                        created_draft["local_thumbnail_status"] = 'failed'
            else:
                logger.warning(f"获取新创建的定稿ID {draft_id} 失败，使用插入数据构建响应")
                # 如果获取失败，使用插入的数据构建响应
                created_draft = {
                "id": draft_id,
                "sku": draft.sku,
                "batch": draft.batch,
                "developer": draft.developer,
                "carrier": draft.carrier,
                "modification_requirement": draft.modification_requirement,
                "infringement_label": draft.infringement_label,
                "images": draft.images or [],
                "reference_images": draft.reference_images or [],
                "status": draft.status,
                "create_time": datetime.now().isoformat(),
                "update_time": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"处理创建的定稿数据失败: {str(e)}")
            # 发生异常时，使用默认值构建响应
            created_draft = {
                "id": draft_id,
                "sku": draft.sku,
                "batch": draft.batch,
                "developer": draft.developer,
                "carrier": draft.carrier,
                "modification_requirement": draft.modification_requirement,
                "infringement_label": draft.infringement_label,
                "images": [],
                "reference_images": [],
                "status": draft.status,
                "create_time": datetime.now().isoformat(),
                "update_time": datetime.now().isoformat()
            }

        # 使用FinalDraftResponse模型序列化，确保字段名转换为驼峰命名
        draft_response = FinalDraftResponse(**created_draft).model_dump(by_alias=True)

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "创建成功",
            "data": draft_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建定稿失败: {str(e)}")










@router.post("/batch-create")
async def batch_create_final_drafts(
    drafts: List[FinalDraftCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建定稿
    """
    return await _batch_create_final_drafts(drafts, mysql_repo)


@router.post("/batch-create/")
async def _batch_create_final_drafts(
    drafts: List[FinalDraftCreate],
    mysql_repo=get_mysql_repo()
):
    """
    批量创建定稿
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
        logger.info(f"开始批量创建定稿 - 数量: {len(drafts)}, 当前并发请求数: {current_batch_requests}")
        success = 0
        failed = 0
        errors = []

        if not drafts:
            return {
                "code": 200,
                "message": "批量创建完成",
                "data": {
                    "success": 0,
                    "failed": 0,
                    "errors": []
                }
            }

        # 1. 批量检查SKU是否存在
        skus = [draft_data.sku for draft_data in drafts]
        if skus:
            # 构建IN查询，使用参数化查询防止SQL注入
            placeholders = ','.join(['%s'] * len(skus))
            check_query = f"SELECT sku FROM final_drafts WHERE sku IN ({placeholders})"
            existing_drafts = await mysql_repo.execute_query(check_query, skus, fetch_all=True)
            existing_sku_set = {row['sku'] for row in existing_drafts}
        else:
            existing_sku_set = set()

        # 2. 准备批量插入数据和错误信息
        insert_data = []
        draft_sku_map = {draft_data.sku: draft_data for draft_data in drafts}
        
        for draft_data in drafts:
            if draft_data.sku in existing_sku_set:
                failed += 1
                errors.append(f"定稿SKU {draft_data.sku} 已存在")
                continue
            
            # 准备插入数据
            insert_data.append([
                draft_data.sku,
                draft_data.batch,
                draft_data.developer,
                draft_data.carrier,
                draft_data.element,
                draft_data.modification_requirement,
                draft_data.infringement_label,
                json.dumps(draft_data.images),
                json.dumps(draft_data.reference_images),
                draft_data.status
            ])

        # 3. 执行批量插入（如果有数据需要插入）
        if insert_data:
            # 开始事务
            await mysql_repo.execute_query("START TRANSACTION")
            try:
                insert_query = """
                INSERT INTO final_drafts (sku, batch, developer, carrier, element, modification_requirement, infringement_label, images, reference_images, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                logger.error(f"批量插入定稿失败，已回滚事务: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"批量创建定稿失败: {str(e)}")
        
        # 4. 计算失败数量
        failed = len(drafts) - success

        logger.info(f"批量创建定稿完成 - 成功: {success}, 失败: {failed}")

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
        logger.error(f"批量创建定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量创建定稿失败: {str(e)}")
    finally:
        # 减少并发请求数
        async with batch_request_lock:
            current_batch_requests -= 1
        logger.info(f"批量创建定稿完成 - 数量: {len(drafts)}, 剩余并发请求数: {current_batch_requests}")


@router.post("/batch-delete")
async def batch_delete_final_drafts(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    批量删除定稿
    """
    return await _batch_delete_final_drafts(request, mysql_repo)


@router.post("/batch-delete/")
async def _batch_delete_final_drafts(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    批量删除定稿
    """
    try:
        logger.info(f"开始批量删除定稿 - ID列表: {request.ids}, SKU列表: {request.skus}")
        success = 0
        failed = 0
        errors = []
        items_to_process = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                draft_query = "SELECT * FROM final_drafts WHERE id = %s"
                draft = await mysql_repo.execute_query(draft_query, (id,), fetch_one=True)
                if draft:
                    items_to_process.append(draft)
                else:
                    failed += 1
                    errors.append(f"定稿ID {id} 不存在")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                draft_query = "SELECT * FROM final_drafts WHERE sku = %s"
                draft = await mysql_repo.execute_query(draft_query, (sku,), fetch_one=True)
                if draft:
                    items_to_process.append(draft)
                else:
                    failed += 1
                    errors.append(f"定稿SKU {sku} 不存在")

        # 批量处理定稿
        for draft in items_to_process:
            try:
                # 开始事务
                async with mysql_repo.get_connection() as conn:
                    try:
                        # 开始事务
                        await conn.begin()
                        
                        # 移动到回收站
                        recycle_query = """
                        INSERT INTO final_draft_recycle_bin (
                            draft_id, sku, batch, developer, carrier, images, reference_images, status, deleted_by, deleted_by_name
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        recycle_params = (
                            draft["id"],
                            draft["sku"],
                            draft["batch"],
                            draft["developer"],
                            draft["carrier"],
                            draft["images"],
                            draft.get("reference_images", "[]"),
                            draft["status"],
                            1,  # 默认删除人ID
                            "system"  # 默认删除人姓名
                        )

                        async with conn.cursor(aiomysql.DictCursor) as cursor:
                            await cursor.execute(recycle_query, recycle_params)

                            # 删除原记录
                            delete_query = "DELETE FROM final_drafts WHERE id = %s"
                            await cursor.execute(delete_query, (draft["id"],))

                        # 提交事务
                        await conn.commit()

                        success += 1
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        failed += 1
                        errors.append(f"定稿SKU {draft['sku']} 删除失败: {str(e)}")
            except Exception as e:
                failed += 1
                errors.append(f"定稿SKU {draft['sku']} 删除失败: {str(e)}")

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
        logger.error(f"批量删除定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量删除定稿失败: {str(e)}")


@router.get("/recycle-bin/")
async def get_recycle_bin_slash(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站定稿（有末尾斜杠路由）
    """
    return await get_recycle_bin(page, size, mysql_repo)


@router.get("/recycle-bin")
async def get_recycle_bin(
    page: int = Query(default=1, ge=1, description="当前页码"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    mysql_repo=get_mysql_repo()
):
    """
    获取回收站定稿
    """
    try:
        offset = (page - 1) * size

        # 查询回收站定稿
        query = """
        SELECT * FROM final_draft_recycle_bin
        ORDER BY delete_time DESC
        LIMIT %s OFFSET %s
        """
        drafts = await mysql_repo.execute_query(query, (size, offset))

        # 计算总数
        count_query = "SELECT COUNT(*) as total FROM final_draft_recycle_bin"
        count_result = await mysql_repo.execute_query(count_query, fetch_one=True)
        total = count_result["total"]

        # 处理JSON字段并将图片路径转换为URL
        for draft in drafts:
            try:
                draft["images"] = _convert_image_paths_to_urls(draft["images"])
            except Exception as e:
                draft["images"] = []
                logger.error(f"处理回收站定稿ID {draft['draft_id']} 的images字段失败: {str(e)}")
            
            try:
                draft["reference_images"] = _convert_image_paths_to_urls(draft["reference_images"])
            except Exception as e:
                draft["reference_images"] = []
                logger.error(f"处理回收站定稿ID {draft['draft_id']} 的reference_images字段失败: {str(e)}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": drafts,
                "total": total,
                "page": page,
                "size": size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取回收站定稿失败: {str(e)}")


@router.post("/recycle-bin/batch-restore")
async def batch_restore_final_drafts(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量恢复定稿
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 获取回收站定稿信息
                    recycle_draft = await mysql_repo.execute_query(
                        "SELECT * FROM final_draft_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_draft:
                        failed += 1
                        errors.append(f"回收站定稿ID {id} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到定稿表
                            restore_query = """
                            INSERT INTO final_drafts (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_draft["draft_id"],
                                recycle_draft["sku"],
                                recycle_draft["batch"],
                                recycle_draft["developer"],
                                recycle_draft["carrier"],
                                recycle_draft["images"],
                                recycle_draft["reference_images"],
                                recycle_draft["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM final_draft_recycle_bin WHERE id = %s"
                                await cursor.execute(delete_query, (id,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"定稿ID {id} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"定稿ID {id} 恢复失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 获取回收站定稿信息
                    recycle_draft = await mysql_repo.execute_query(
                        "SELECT * FROM final_draft_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_draft:
                        failed += 1
                        errors.append(f"回收站定稿SKU {sku} 不存在")
                        continue

                    # 开始事务
                    async with mysql_repo.get_connection() as conn:
                        try:
                            # 开始事务
                            await conn.begin()
                            
                            # 恢复到定稿表
                            restore_query = """
                            INSERT INTO final_drafts (
                                id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """
                            restore_params = (
                                recycle_draft["draft_id"],
                                recycle_draft["sku"],
                                recycle_draft["batch"],
                                recycle_draft["developer"],
                                recycle_draft["carrier"],
                                recycle_draft["images"],
                                recycle_draft["reference_images"],
                                recycle_draft["status"],
                                datetime.now(),
                                datetime.now()
                            )

                            async with conn.cursor(aiomysql.DictCursor) as cursor:
                                await cursor.execute(restore_query, restore_params)

                                # 从回收站删除记录
                                delete_query = "DELETE FROM final_draft_recycle_bin WHERE sku = %s"
                                await cursor.execute(delete_query, (sku,))

                            # 提交事务
                            await conn.commit()

                            success += 1
                        except Exception as e:
                            # 回滚事务
                            await conn.rollback()
                            failed += 1
                            errors.append(f"定稿SKU {sku} 恢复失败: {str(e)}")
                except Exception as e:
                    failed += 1
                    errors.append(f"定稿SKU {sku} 恢复失败: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"批量恢复定稿失败: {str(e)}")


@router.delete("/recycle-bin/clear")
async def clear_final_draft_recycle_bin(
    mysql_repo=get_mysql_repo()
):
    """
    清空定稿回收站
    """
    try:
        # 获取所有回收站定稿信息
        recycle_drafts = await mysql_repo.execute_query(
            "SELECT id, sku, images, reference_images FROM final_draft_recycle_bin",
            ()
        )
        
        # 删除所有相关的腾讯云COS图片
        for draft in recycle_drafts:
            draft_id = draft.get('id')
            draft_sku = draft.get('sku')
            await _delete_cos_images(mysql_repo, draft_id, draft_sku)
        
        # 清空回收站
        result = await mysql_repo.execute_delete(
            "DELETE FROM final_draft_recycle_bin",
            ()
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "定稿回收站清空成功",
            "data": {"deleted_count": result}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空定稿回收站失败: {str(e)}")


@router.delete("/recycle-bin/batch")
async def batch_permanently_delete_final_drafts(
    request: BatchOperationRequest,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站批量永久删除定稿
    """
    try:
        success = 0
        failed = 0
        errors = []

        # 处理ID列表
        if request.ids:
            for id in request.ids:
                try:
                    # 检查回收站定稿是否存在
                    recycle_draft = await mysql_repo.execute_query(
                        "SELECT * FROM final_draft_recycle_bin WHERE id = %s", 
                        (id,), 
                        fetch_one=True
                    )

                    if not recycle_draft:
                        failed += 1
                        errors.append(f"回收站定稿ID {id} 不存在")
                        continue

                    draft_id = recycle_draft.get('id')
                    draft_sku = recycle_draft.get('sku')
                    
                    # 先删除腾讯云COS图片
                    await _delete_cos_images(mysql_repo, draft_id, draft_sku)

                    # 永久删除定稿
                    await mysql_repo.execute_delete(
                        "DELETE FROM final_draft_recycle_bin WHERE id = %s", 
                        (id,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"定稿ID {id} 永久删除失败: {str(e)}")

        # 处理SKU列表
        if request.skus:
            for sku in request.skus:
                try:
                    # 检查回收站定稿是否存在
                    recycle_draft = await mysql_repo.execute_query(
                        "SELECT * FROM final_draft_recycle_bin WHERE sku = %s", 
                        (sku,), 
                        fetch_one=True
                    )

                    if not recycle_draft:
                        failed += 1
                        errors.append(f"回收站定稿SKU {sku} 不存在")
                        continue

                    draft_id = recycle_draft.get('id')
                    draft_sku = recycle_draft.get('sku')
                    
                    # 先删除腾讯云COS图片
                    await _delete_cos_images(mysql_repo, draft_id, draft_sku)

                    # 永久删除定稿
                    await mysql_repo.execute_delete(
                        "DELETE FROM final_draft_recycle_bin WHERE sku = %s", 
                        (sku,)
                    )

                    success += 1
                except Exception as e:
                    failed += 1
                    errors.append(f"定稿SKU {sku} 永久删除失败: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"批量永久删除定稿失败: {str(e)}")


@router.post("/recycle-bin/{sku}/restore")
async def restore_final_draft(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站恢复单个定稿
    """
    try:
        # 获取回收站定稿信息
        recycle_draft = await mysql_repo.execute_query(
            "SELECT * FROM final_draft_recycle_bin WHERE sku = %s", 
            (sku,), 
            fetch_one=True
        )

        if not recycle_draft:
            raise HTTPException(status_code=404, detail="回收站定稿不存在")

        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()
                
                # 恢复到定稿表
                restore_query = """
                INSERT INTO final_drafts (
                    id, sku, batch, developer, carrier, images, reference_images, status, create_time, update_time
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                restore_params = (
                    recycle_draft["draft_id"],
                    recycle_draft["sku"],
                    recycle_draft["batch"],
                    recycle_draft["developer"],
                    recycle_draft["carrier"],
                    recycle_draft["images"],
                    recycle_draft["reference_images"],
                    recycle_draft["status"],
                    datetime.now(),
                    datetime.now()
                )

                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(restore_query, restore_params)

                    # 从回收站删除记录
                    delete_query = "DELETE FROM final_draft_recycle_bin WHERE sku = %s"
                    await cursor.execute(delete_query, (sku,))

                # 提交事务
                await conn.commit()

                # 构建统一格式响应
                return {
                    "code": 200,
                    "message": "定稿恢复成功",
                    "data": {"sku": sku}
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                raise HTTPException(status_code=500, detail=f"恢复定稿失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复定稿失败: {str(e)}")


@router.delete("/recycle-bin/{sku}")
async def permanently_delete_final_draft(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站永久删除单个定稿
    """
    try:
        # 检查回收站定稿是否存在
        recycle_draft = await mysql_repo.execute_query(
            "SELECT * FROM final_draft_recycle_bin WHERE sku = %s", 
            (sku,), 
            fetch_one=True
        )

        if not recycle_draft:
            raise HTTPException(status_code=404, detail="回收站定稿不存在")

        draft_id = recycle_draft.get('id')
        draft_sku = recycle_draft.get('sku')
        
        # 先删除腾讯云COS图片
        await _delete_cos_images(mysql_repo, draft_id, draft_sku)

        # 永久删除定稿
        await mysql_repo.execute_delete(
            "DELETE FROM final_draft_recycle_bin WHERE sku = %s", 
            (sku,)
        )

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "定稿永久删除成功",
            "data": {"sku": sku}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"永久删除定稿失败: {str(e)}")


@router.delete("/recycle-bin/delete-by-id/{id}")
async def permanently_delete_final_draft_by_id(
    id: int,
    mysql_repo=get_mysql_repo()
):
    """
    从回收站通过ID永久删除单个定稿
    """
    try:
        logger.info(f"开始永久删除回收站定稿 - ID: {id}")
        
        # 检查回收站定稿是否存在
        recycle_draft = await mysql_repo.execute_query(
            "SELECT * FROM final_draft_recycle_bin WHERE id = %s", 
            (id,), 
            fetch_one=True
        )

        if not recycle_draft:
            logger.error(f"永久删除定稿失败 - ID: {id} 不存在")
            raise HTTPException(status_code=404, detail="回收站定稿不存在")
        
        logger.info(f"找到回收站定稿 - ID: {id}, SKU: {recycle_draft['sku']}")

        # 永久删除定稿
        deleted_count = await mysql_repo.execute_delete(
            "DELETE FROM final_draft_recycle_bin WHERE id = %s", 
            (id,)
        )
        
        # 检查删除结果
        if deleted_count == 0:
            logger.error(f"永久删除定稿失败 - ID: {id} 删除行数为0")
            raise HTTPException(status_code=500, detail="删除定稿失败，受影响行数为0")
        
        logger.info(f"永久删除定稿成功 - ID: {id}, 受影响行数: {deleted_count}")

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "定稿永久删除成功",
            "data": {"id": id, "deleted_count": deleted_count}
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"永久删除定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"永久删除定稿失败: {str(e)}")


@router.get("/download-zip-file")
async def download_zip_file(
    request: Request,
    token: str = Query(..., description="临时ZIP文件token")
):
    """
    下载临时ZIP文件

    根据token下载之前生成的临时ZIP文件。
    临时文件有效期为5分钟，过期后自动删除。

    Args:
        request: FastAPI请求对象
        token: 临时文件token

    Returns:
        StreamingResponse: ZIP文件流
    """
    try:
        logger.info(f"请求下载临时ZIP文件 - Token: {token}")

        # 检查token是否存在
        if token not in _temp_zip_files:
            logger.warning(f"临时ZIP文件不存在或已过期 - Token: {token}")
            raise HTTPException(status_code=404, detail="文件不存在或已过期")

        file_info = _temp_zip_files[token]
        temp_path = file_info["path"]
        filename = file_info["filename"]
        expires_at = file_info["expires_at"]

        # 检查是否已过期
        if datetime.now() > expires_at:
            # 删除过期文件
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as e:
                logger.warning(f"删除过期临时文件失败: {e}")

            # 从字典中移除
            del _temp_zip_files[token]

            logger.warning(f"临时ZIP文件已过期 - Token: {token}")
            raise HTTPException(status_code=410, detail="文件已过期，请重新下载")

        # 检查文件是否存在
        if not os.path.exists(temp_path):
            logger.error(f"临时ZIP文件不存在 - Path: {temp_path}")
            del _temp_zip_files[token]
            raise HTTPException(status_code=404, detail="文件不存在")

        # 读取文件
        with open(temp_path, 'rb') as f:
            zip_data = f.read()

        # 删除临时文件（一次性使用）
        try:
            os.remove(temp_path)
            del _temp_zip_files[token]
            logger.info(f"临时ZIP文件已删除 - Token: {token}")
        except Exception as e:
            logger.warning(f"删除临时文件失败: {e}")

        logger.info(f"成功返回ZIP文件 - Token: {token}, 大小: {len(zip_data)} bytes")

        return StreamingResponse(
            iter([zip_data]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/zip",
                "Content-Length": str(len(zip_data)),
                "Cache-Control": "no-cache",
                "Access-Control-Expose-Headers": "Content-Disposition, Content-Length"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载ZIP文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"下载ZIP文件失败: {str(e)}")


@router.get("/{sku}")
async def get_final_draft(
    sku: str,
    mysql_repo=get_mysql_repo()
):
    """
    获取单个定稿
    """
    try:
        logger.info(f"开始获取单个定稿 - SKU: {sku}")
        
        # 查询数据
        query = "SELECT * FROM final_drafts WHERE sku = %s"
        logger.debug(f"执行定稿查询 - SQL: {query}, 参数: ({sku},)")
        draft = await mysql_repo.execute_query(query, (sku,), fetch_one=True)

        if not draft:
            logger.error(f"获取定稿失败 - SKU {sku} 不存在")
            raise HTTPException(status_code=404, detail="定稿不存在")
        logger.info(f"获取定稿成功 - SKU: {sku}, ID: {draft['id']}")

        # 处理JSON字段并将图片路径转换为URL
        try:
            draft["images"] = _convert_image_paths_to_urls(draft["images"])
        except Exception as e:
            draft["images"] = []
            logger.error(f"处理定稿SKU {draft['sku']} 的images字段失败: {str(e)}")
        
        try:
            draft["reference_images"] = _convert_image_paths_to_urls(draft["reference_images"])
        except Exception as e:
            draft["reference_images"] = []
            logger.error(f"处理定稿SKU {draft['sku']} 的reference_images字段失败: {str(e)}")

        # 使用FinalDraftResponse模型序列化，确保字段名转换为驼峰命名
        draft_response = FinalDraftResponse(**draft).model_dump(by_alias=True)

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": draft_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取定稿失败: {str(e)}")


@router.put("/sku/{sku}")
async def update_final_draft(
    sku: str,
    draft_update: FinalDraftUpdate,
    mysql_repo=get_mysql_repo()
):
    """
    更新定稿信息
    """
    try:
        logger.info(f"开始更新定稿 - SKU: {sku}")
        
        # 检查定稿是否存在，并获取旧的图片信息
        check_query = "SELECT * FROM final_drafts WHERE sku = %s"
        logger.debug(f"检查定稿是否存在并获取旧图片信息 - SQL: {check_query}, 参数: ({sku},)")
        old_draft = await mysql_repo.execute_query(check_query, (sku,), fetch_one=True)

        if not old_draft:
            logger.error(f"更新定稿失败 - SKU {sku} 不存在")
            raise HTTPException(status_code=404, detail="定稿不存在")

        # 构建更新字段
        update_fields = []
        params = []

        if draft_update.sku:
            # 检查SKU是否已被其他定稿使用
            check_sku_query = "SELECT id FROM final_drafts WHERE sku = %s AND sku != %s"
            sku_draft = await mysql_repo.execute_query(check_sku_query, (draft_update.sku, sku), fetch_one=True)
            if sku_draft:
                raise HTTPException(status_code=400, detail="该SKU已被其他定稿使用")

            update_fields.append("sku = %s")
            params.append(draft_update.sku)

        if draft_update.batch is not None:
            update_fields.append("batch = %s")
            params.append(draft_update.batch)

        if draft_update.developer is not None:
            update_fields.append("developer = %s")
            params.append(draft_update.developer)

        if draft_update.carrier is not None:
            update_fields.append("carrier = %s")
            params.append(draft_update.carrier)

        if draft_update.element is not None:
            update_fields.append("element = %s")
            params.append(draft_update.element)

        if draft_update.modification_requirement is not None:
            update_fields.append("modification_requirement = %s")
            params.append(draft_update.modification_requirement)

        if draft_update.infringement_label is not None:
            update_fields.append("infringement_label = %s")
            params.append(draft_update.infringement_label)

        if draft_update.images is not None:
            update_fields.append("images = %s")
            params.append(json.dumps(draft_update.images))

        if draft_update.reference_images is not None:
            update_fields.append("reference_images = %s")
            params.append(json.dumps(draft_update.reference_images))

        if draft_update.status is not None:
            update_fields.append("status = %s")
            params.append(draft_update.status)

        if not update_fields:
            raise HTTPException(status_code=400, detail="没有要更新的字段")

        # 处理图片更新：比较新旧图片，删除腾讯云COS上的旧图片
        from ...services.cos_service import cos_service
        
        # 获取旧的图片列表
        old_images = _convert_image_paths_to_urls(old_draft.get("images", "[]"))
        old_reference_images = _convert_image_paths_to_urls(old_draft.get("reference_images", "[]"))
        
        # 获取新的图片列表
        new_images = []
        new_reference_images = []
        
        if draft_update.images is not None:
            new_images = _convert_image_paths_to_urls(draft_update.images)
        else:
            new_images = old_images
        
        if draft_update.reference_images is not None:
            new_reference_images = _convert_image_paths_to_urls(draft_update.reference_images)
        else:
            new_reference_images = old_reference_images
        
        # 找出被删除的图片
        deleted_images = [img for img in old_images if img not in new_images]
        deleted_reference_images = [img for img in old_reference_images if img not in new_reference_images]
        deleted_all_images = deleted_images + deleted_reference_images
        
        # 删除腾讯云COS上的旧图片
        if deleted_all_images and cos_service.enabled:
            logger.info(f"开始删除定稿旧图片 - SKU: {sku}, 图片数量: {len(deleted_all_images)}")
            
            from ...services.cos_service import cos_service
            
            for image_url in deleted_all_images:
                try:
                    # 提取COS对象键
                    object_key = _extract_cos_object_key(image_url)
                    if object_key:
                        # 删除原图/参考图
                        success, error_msg = await cos_service.delete_image(object_key)
                        if success:
                            logger.info(f"成功删除COS图片 - 对象键: {object_key}, 定稿SKU: {sku}")
                        else:
                            logger.error(f"删除COS图片失败 - 对象键: {object_key}, 定稿SKU: {sku}, 错误: {error_msg}")
                        
                        # 生成所有可能的缩略图对象键
                        thumbnail_keys = _generate_thumbnail_object_keys(object_key)
                        
                        # 删除所有对应的缩略图
                        for thumbnail_key in thumbnail_keys:
                            success, error_msg = await cos_service.delete_image(thumbnail_key)
                            if success:
                                logger.info(f"成功删除缩略图 - 对象键: {thumbnail_key}, 定稿SKU: {sku}")
                            else:
                                # 缩略图删除失败不影响主流程，只记录日志
                                logger.warning(f"删除缩略图失败 - 对象键: {thumbnail_key}, 定稿SKU: {sku}, 错误: {error_msg}")
                    else:
                        logger.warning(f"无法提取COS对象键，跳过删除 - URL: {image_url}, 定稿SKU: {sku}")
                except Exception as e:
                    logger.error(f"删除定稿旧图片失败 - URL: {image_url}, 定稿SKU: {sku}, 错误: {str(e)}")
                    # 图片删除失败不影响主流程，继续处理其他图片
        
        # 执行更新
        params.append(sku)  # 添加WHERE条件参数
        update_query = f"UPDATE final_drafts SET {', '.join(update_fields)} WHERE sku = %s"
        logger.debug(f"执行定稿更新 - SQL: {update_query}, 参数: {tuple(params)}")
        await mysql_repo.execute_update(update_query, tuple(params))
        logger.info(f"定稿更新成功 - SKU: {sku}")

        # 获取更新后的数据
        updated_draft = await mysql_repo.execute_query(
            "SELECT * FROM final_drafts WHERE sku = %s",
            (draft_update.sku or sku,),
            fetch_one=True
        )

        # 处理JSON字段并将图片路径转换为URL
        try:
            if updated_draft:
                # 只有当updated_draft不是None时才处理
                try:
                    updated_draft["images"] = _convert_image_paths_to_urls(updated_draft["images"])
                except Exception as e:
                    updated_draft["images"] = []
                    logger.error(f"处理更新后的定稿SKU {updated_draft['sku']} 的images字段失败: {str(e)}")
                
                try:
                    updated_draft["reference_images"] = _convert_image_paths_to_urls(updated_draft["reference_images"])
                except Exception as e:
                    updated_draft["reference_images"] = []
                    logger.error(f"处理更新后的定稿SKU {updated_draft['sku']} 的reference_images字段失败: {str(e)}")
                
                # 从腾讯云下载已生成的缩略图到本地
                if draft_update.images is not None or draft_update.reference_images is not None:
                    local_thumbnail_path = None
                    all_images = updated_draft.get("reference_images", []) + updated_draft.get("images", [])
                    
                    if all_images:
                        # 优先使用第一张图片
                        first_image = all_images[0]
                        logger.info(f"开始下载第一张图片的本地缩略图: {first_image}")
                        local_thumbnail_path = await _download_local_thumbnail(first_image)
                        
                        if local_thumbnail_path:
                            logger.info(f"成功下载本地缩略图: {local_thumbnail_path}")
                            # 更新数据库中的本地缩略图路径
                            update_query = """
                            UPDATE final_drafts 
                            SET local_thumbnail_path = %s, 
                                local_thumbnail_status = %s, 
                                local_thumbnail_updated_at = %s 
                            WHERE sku = %s
                            """
                            update_params = [
                                local_thumbnail_path,
                                'completed',
                                datetime.now(),
                                updated_draft['sku']
                            ]
                            await mysql_repo.execute_update(update_query, update_params)
                            # 更新updated_draft中的本地缩略图路径
                            updated_draft["local_thumbnail_path"] = local_thumbnail_path
                            updated_draft["local_thumbnail_status"] = 'completed'
                            updated_draft["local_thumbnail_updated_at"] = datetime.now().isoformat()
                        else:
                            logger.warning(f"下载本地缩略图失败: {first_image}")
                            # 更新数据库中的本地缩略图状态为失败
                            update_query = """
                            UPDATE final_drafts 
                            SET local_thumbnail_status = %s 
                            WHERE sku = %s
                            """
                            await mysql_repo.execute_update(update_query, ['failed', updated_draft['sku']])
                            updated_draft["local_thumbnail_status"] = 'failed'
            else:
                # 如果获取失败，使用更新前的数据构建响应
                logger.error(f"获取更新后的定稿SKU {sku} 失败，使用默认值返回")
                updated_draft = {
                    "id": existing_draft["id"],
                    "sku": draft_update.sku or sku,
                    "batch": draft_update.batch or "",
                    "developer": draft_update.developer or "",
                    "carrier": draft_update.carrier or "",
                    "modification_requirement": draft_update.modification_requirement,
                    "images": draft_update.images or [],
                    "reference_images": draft_update.reference_images or [],
                    "status": draft_update.status or "concept",
                    "create_time": datetime.now().isoformat(),
                    "update_time": datetime.now().isoformat()
                }
        except Exception as e:
            logger.error(f"处理更新的定稿数据失败: {str(e)}")
            updated_draft = {
                "id": existing_draft["id"],
                "sku": draft_update.sku or sku,
                "batch": draft_update.batch or "",
                "developer": draft_update.developer or "",
                "carrier": draft_update.carrier or "",
                "modification_requirement": draft_update.modification_requirement,
                "infringement_label": draft_update.infringement_label,
                "images": [],
                "reference_images": [],
                "status": draft_update.status or "concept",
                "create_time": datetime.now().isoformat(),
                "update_time": datetime.now().isoformat()
            }

        # 使用FinalDraftResponse模型序列化，确保字段名转换为驼峰命名
        draft_response = FinalDraftResponse(**updated_draft).model_dump(by_alias=True)

        # 构建统一格式响应
        return {
            "code": 200,
            "message": "更新成功",
            "data": draft_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新定稿失败: {str(e)}")


@router.put("/{identifier}")
async def update_final_draft_by_identifier(
    identifier: str,
    draft_update: FinalDraftUpdate,
    mysql_repo=get_mysql_repo()
):
    """
    更新定稿

    支持通过SKU或ID更新定稿
    """
    try:
        logger.info(f"开始通过标识符更新定稿 - 标识符: {identifier}")
        
        # 检查标识符是ID还是SKU
        sku = identifier
        
        # 如果identifier是数字，尝试将其作为ID查询对应的SKU
        if identifier.isdigit():
            id = int(identifier)
            draft = await mysql_repo.execute_query(
                "SELECT sku FROM final_drafts WHERE id = %s",
                (id,),
                fetch_one=True
            )
            
            if draft:
                sku = draft["sku"]
            else:
                logger.error(f"更新定稿失败 - ID {id} 不存在")
                raise HTTPException(status_code=404, detail="定稿不存在")
        
        # 调用现有的update_final_draft函数处理更新
        return await update_final_draft(sku, draft_update, mysql_repo)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"通过标识符更新定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新定稿失败: {str(e)}")


@router.post("/batch-update")
async def batch_update_final_drafts(
    batch_update_data: dict,
    mysql_repo=get_mysql_repo()
):
    """
    批量更新定稿

    支持通过ID列表或SKU列表批量更新定稿的字段
    请求格式：
    {
        "ids": [1, 2, 3],
        "skus": ["SKU001", "SKU002"],
        "batch": "BATCH_TEST",
        "developer": "test_developer",
        "carrier": "test_carrier",
        "element": "test_element",
        "modification_requirement": "test_modification",
        "status": "finalized"
    }
    """
    try:
        logger.info(f"开始批量更新定稿 - 请求数据: {json.dumps(batch_update_data, ensure_ascii=False)}")
        
        # 提取ids和skus
        ids = batch_update_data.get("ids", [])
        skus = batch_update_data.get("skus", [])
        
        # 验证至少提供了ids或skus之一
        if not ids and not skus:
            raise HTTPException(status_code=400, detail="必须提供ids或skus之一")
        
        # 提取要更新的字段，排除ids和skus
        update_fields = {}
        for field_name, field_value in batch_update_data.items():
            if field_name not in ["ids", "skus"] and field_value is not None:
                update_fields[field_name] = field_value
        
        # 验证至少有一个字段需要更新
        if not update_fields:
            raise HTTPException(status_code=400, detail="必须提供至少一个要更新的字段")
        
        # 构建动态更新SQL语句
        set_clauses = []
        params = []
        
        for field_name, field_value in update_fields.items():
            # 将Python字段名转换为数据库字段名
            db_field_name = field_name
            if field_name == "modification_requirement":
                # 已经是数据库字段名，不需要转换
                pass
            elif field_name == "modificationRequirement":
                # 转换为数据库字段名
                db_field_name = "modification_requirement"
            
            set_clauses.append(f"{db_field_name} = %s")
            params.append(field_value)
        
        # 构建WHERE子句
        where_clauses = []
        if ids:
            where_clauses.append(f"id IN ({','.join(['%s'] * len(ids))})")
            params.extend(ids)
        
        if skus:
            where_clauses.append(f"sku IN ({','.join(['%s'] * len(skus))})")
            params.extend(skus)
        
        where_clause = " OR ".join(where_clauses)
        
        # 构建完整的更新SQL语句
        update_query = f"UPDATE final_drafts SET {','.join(set_clauses)} WHERE {where_clause}"
        logger.info(f"批量更新SQL: {update_query}")
        logger.info(f"批量更新参数: {params}")
        
        # 执行更新操作
        result = await mysql_repo.execute_update(update_query, params)
        logger.info(f"批量更新结果: {result}")
        
        # 获取影响的行数
        affected_rows = result
        logger.info(f"批量更新影响行数: {affected_rows}")
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "批量更新完成",
            "data": {
                "success": affected_rows,
                "failed": 0,
                "errors": []
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量更新定稿失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"批量更新定稿失败: {str(e)}")


@router.delete("/{identifier}")
async def delete_final_draft_by_identifier(
    identifier: str,
    mysql_repo=get_mysql_repo()
):
    """
    删除定稿

    将定稿移动到回收站，支持通过SKU或ID删除
    """
    try:
        logger.info(f"开始删除定稿 - 标识符: {identifier}")
        
        # 获取定稿信息，支持通过SKU或ID查询
        draft = await mysql_repo.execute_query(
            "SELECT * FROM final_drafts WHERE sku = %s OR id = %s", 
            (identifier, identifier), 
            fetch_one=True
        )
        logger.info(f"获取定稿信息结果: {draft}")

        if not draft:
            # 检查是否存在于回收站
            recycle_draft = await mysql_repo.execute_query(
                "SELECT * FROM final_draft_recycle_bin WHERE sku = %s OR draft_id = %s", 
                (identifier, identifier), 
                fetch_one=True
            )
            
            if recycle_draft:
                logger.error(f"删除定稿失败 - 标识符: {identifier} 已存在于回收站")
                raise HTTPException(status_code=400, detail="定稿已存在于回收站")
            else:
                logger.error(f"删除定稿失败 - 标识符: {identifier} 不存在")
                raise HTTPException(status_code=404, detail="定稿不存在")

        # 开始事务
        async with mysql_repo.get_connection() as conn:
            try:
                # 开始事务
                await conn.begin()
                logger.info(f"开始事务 - 连接ID: {id(conn)}")
                
                # 移动到回收站
                recycle_query = """
                INSERT INTO final_draft_recycle_bin (
                    draft_id, sku, batch, developer, carrier, images, reference_images, status, infringement_label, deleted_by, deleted_by_name
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                recycle_params = (
                    draft["id"],
                    draft["sku"],
                    draft["batch"],
                    draft["developer"],
                    draft["carrier"],
                    draft["images"],
                    draft.get("reference_images", "[]"),
                    draft["status"],
                    draft.get("infringement_label"),
                    1,  # 默认删除人ID
                    "system"  # 默认删除人姓名
                )

                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # 执行回收站插入
                    logger.info(f"执行回收站插入 - SQL: {recycle_query}, 参数: {recycle_params}")
                    insert_result = await cursor.execute(recycle_query, recycle_params)
                    logger.info(f"回收站插入结果 - 影响行数: {insert_result}")
                    
                    # 检查插入结果
                    if insert_result == 0:
                        raise Exception("回收站插入失败，影响行数为0")

                    # 删除原记录，使用ID确保唯一性
                    delete_query = "DELETE FROM final_drafts WHERE id = %s"
                    logger.info(f"执行原记录删除 - SQL: {delete_query}, 参数: ({draft['id']},)")
                    await cursor.execute(delete_query, (draft["id"],))
                    delete_result = cursor.rowcount
                    logger.info(f"原记录删除结果 - 影响行数: {delete_result}")
                    
                    # 检查删除结果
                    if delete_result == 0:
                        raise Exception("原记录删除失败，影响行数为0")

                # 提交事务
                await conn.commit()
                logger.info(f"事务提交成功 - 标识符: {identifier}, SKU: {draft['sku']}")

                # 构建统一格式响应
                return {
                    "code": 200,
                    "message": "定稿删除成功",
                    "data": {"sku": draft['sku'], "id": draft['id']}
                }
            except Exception as e:
                # 回滚事务
                await conn.rollback()
                logger.error(f"事务回滚 - 错误: {str(e)}")
                raise HTTPException(status_code=500, detail=f"删除定稿失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除定稿失败 - 未捕获异常: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除定稿失败: {str(e)}")


@router.get("/batch/{batch}/count")
async def get_batch_count(
    batch: str,
    mysql_repo=get_mysql_repo()
):
    """
    获取指定批次的产品数量
    
    Args:
        batch: 批次号
        mysql_repo: MySQLRepository实例
    
    Returns:
        dict: 批次数量信息
    """
    try:
        logger.info(f"开始获取批次数量 - 批次: {batch}")
        
        # 查询指定批次的产品数量
        query = "SELECT COUNT(*) as count FROM final_drafts WHERE batch = %s"
        logger.debug(f"执行批次数量查询 - SQL: {query}, 参数: ({batch},)")
        count_result = await mysql_repo.execute_query(query, (batch,), fetch_one=True)
        
        # 确保count_result是字典类型
        count = 0
        if isinstance(count_result, dict):
            count = count_result.get("count", 0)
        
        logger.info(f"获取批次数量成功 - 批次: {batch}, 数量: {count}")
        
        # 构建统一格式响应
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "batch": batch,
                "count": count
            }
        }
    except Exception as e:
        logger.error(f"获取批次数量失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取批次数量失败: {str(e)}")


def is_webp_format(content: bytes) -> bool:
    """
    检测文件是否为WebP格式
    
    Args:
        content: 文件内容
        
    Returns:
        bool: 是否为WebP格式
    """
    if not HAS_PIL or Image is None:
        logger.warning("PIL库未安装，跳过WebP格式检测")
        return False
    
    try:
        import io
        with Image.open(io.BytesIO(content)) as img:
            return img.format == 'WEBP'
    except Exception as e:
        logger.error(f"WebP格式检测失败: {e}")
        return False


def convert_webp_to_png(content: bytes) -> tuple[bytes, str]:
    """
    将WebP格式转换为PNG格式
    
    Args:
        content: WebP文件内容
        
    Returns:
        tuple[bytes, str]: (转换后的内容, 新文件扩展名)
    """
    if not HAS_PIL or Image is None:
        logger.warning("PIL库未安装，跳过WebP格式转换")
        return content, 'webp'
    
    try:
        import io
        with Image.open(io.BytesIO(content)) as img:
            # 处理不同模式
            if img.mode == 'P':
                # 转换调色板模式为RGBA
                img = img.convert('RGBA')
            elif img.mode == 'LA':
                # 转换灰度带透明度模式为RGBA
                img = img.convert('RGBA')
            # 保存为PNG，保留透明度
            png_buffer = io.BytesIO()
            img.save(png_buffer, format='PNG', optimize=True)
            return png_buffer.getvalue(), 'png'
    except Exception as e:
        logger.error(f"WebP转换失败: {e}")
        return content, 'webp'


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

# 异步下载单个文件，带指数退避重试机制
async def download_file_with_retry(session: aiohttp.ClientSession, file_info: dict, retry_count: int = 3) -> tuple[str, bytes]:
    """
    异步下载单个文件，带指数退避重试机制
    
    Args:
        session: aiohttp.ClientSession对象
        file_info: 文件信息，包含url和filename
        retry_count: 最大重试次数
    
    Returns:
        tuple[str, bytes]: 文件名和文件内容
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    filename = file_info['filename']
    url = file_info['url']
    
    # 验证和清理文件名
    if not filename or len(filename.strip()) == 0:
        # 如果文件名为空，使用默认文件名
        import uuid
        filename = f"image_{uuid.uuid4()}.jpg"
        logger.warning(f"文件名为空，使用默认文件名: {filename}")
    else:
        # 清理文件名，移除或替换无效字符
        import re
        # 保留字母、数字、中文、下划线、连字符和点
        filename = re.sub(r'[^\w\u4e00-\u9fa5\-_\.]', '_', filename)
        # 移除多余的下划线
        filename = re.sub(r'_+', '_', filename)
        # 确保文件名长度合理
        if len(filename) > 200:
            # 截取文件名，保留扩展名
            name_part, ext_part = os.path.splitext(filename)
            filename = f"{name_part[:190]}{ext_part}"
            logger.warning(f"文件名过长，已截取: {filename}")
    
    logger.info(f"开始处理文件下载: {filename}，URL: {url}")
    
    # 清理URL中的特殊字符，移除反引号等格式问题
    url = url.strip().strip('`')
    logger.info(f"清理反引号后的URL: {url}")
    
    # 移除开头的斜杠（如果URL以/开头但不是路径）
    if url.startswith('/') and not url.startswith('//'):
        logger.info(f"检测到URL以/开头，准备移除: {url}")
        url = url[1:]
        logger.info(f"移除/后的URL: {url}")
    else:
        logger.info(f"URL不需要移除/，startswith('/'): {url.startswith('/')}, startswith('//'): {url.startswith('//')}")
    
    logger.info(f"最终清理后的URL: {url}")
    
    # 检查URL是否已经是original_zips前缀的完整COS URL
    from urllib.parse import urlparse
    parsed_url = urlparse(url)
    path = parsed_url.path
    
    logger.info(f"解析URL路径: {path}")
    logger.info(f"检查URL是否包含original_zips: {'original_zips' in path}")
    
    if "original_zips" in path:
        logger.info(f"URL已经是original_zips前缀的完整COS URL，直接使用进行下载: {url}")
    else:
        # 通过数据库查询original_zip_filepath进行下载
        try:
            # 从数据库获取原始图片的original_zip_filepath
            from ...repositories.mysql_repo import MySQLRepository
            from ...config import settings
            
            logger.info(f"开始数据库查询，使用路径: {path}")
            
            mysql_repo = MySQLRepository(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DATABASE
            )
            await mysql_repo.connect()
            
            # 检查是否为 /api/v1/images/{id}/file 格式
            image_id = None
            import re
            api_pattern = r'^/api/v1/images/(\d+)/file$'
            api_match = re.match(api_pattern, path)
            
            if api_match:
                # 提取图片ID
                image_id = int(api_match.group(1))
                logger.info(f"检测到 /api/v1/images/{id}/file 格式URL，提取图片ID: {image_id}")
                
                # 使用图片ID直接查询
                image_info = await mysql_repo.execute_query(
                    "SELECT original_zip_filepath, original_zip_cos_key "
                    "FROM images WHERE id = %s "
                    "LIMIT 1",
                    (image_id,),
                    fetch_one=True
                )
                
                logger.info(f"通过图片ID查询结果: {image_info}")
            else:
                # 尝试通过COS URL路径查找图片
                logger.info(f"尝试通过COS URL路径查找original_zip_filepath: {path}")
                
                # 提取对象键（移除开头的/）
                object_key = path.lstrip('/') if path.startswith('/') else path
                logger.info(f"提取的对象键: {object_key}")
                
                # 第一步：尝试精确匹配
                image_info = await mysql_repo.execute_query(
                    "SELECT original_zip_filepath, original_zip_cos_key, cos_object_key, cos_url "
                    "FROM images WHERE cos_object_key = %s OR cos_url = %s OR cos_url LIKE %s "
                    "ORDER BY LENGTH(cos_url) DESC "
                    "LIMIT 1",
                    (object_key, path, f"%{path}%"),
                    fetch_one=True
                )
                
                # 第二步：如果精确匹配失败，尝试不带扩展名的模糊匹配
                # 因为URL中的扩展名可能与数据库中存储的不同（如.webp vs .jpg）
                if not image_info:
                    object_key_base = os.path.splitext(object_key)[0]
                    path_base = os.path.splitext(path)[0]
                    logger.info(f"精确匹配失败，尝试模糊匹配，对象键基础部分: {object_key_base}")
                    
                    image_info = await mysql_repo.execute_query(
                        "SELECT original_zip_filepath, original_zip_cos_key, cos_object_key, cos_url "
                        "FROM images WHERE cos_object_key LIKE %s OR cos_url LIKE %s "
                        "ORDER BY LENGTH(cos_url) DESC "
                        "LIMIT 1",
                        (f"%{object_key_base}.%", f"%{path_base}.%"),
                        fetch_one=True
                    )
                
                logger.info(f"通过COS URL路径查询结果: {image_info}")
            
            if image_info:
                logger.info(f"找到图片记录: {image_info}")
                
                # 检查是否有original_zip_filepath和original_zip_cos_key
                original_zip_filepath = image_info.get('original_zip_filepath')
                original_zip_cos_key = image_info.get('original_zip_cos_key')
                
                # 优先使用original_zip_cos_key进行下载
                if original_zip_cos_key:
                    logger.info(f"找到original_zip_cos_key: {original_zip_cos_key}，使用COS SDK获取对象")
                    # 尝试使用COS SDK直接获取对象
                    try:
                        from ...services.cos_service import cos_service
                        
                        if cos_service.is_enabled():
                            logger.info(f"使用COS SDK获取对象: {original_zip_cos_key}")
                            response = cos_service.client.get_object(
                                Bucket=cos_service.bucket,
                                Key=original_zip_cos_key
                            )
                            
                            # 正确读取流对象的完整内容
                            body = response['Body']
                            content = b''
                            while True:
                                chunk = body.read(4096)  # 4KB缓冲区
                                if not chunk:
                                    break
                                content += chunk
                            logger.info(f"成功使用COS SDK获取对象: {original_zip_cos_key}，大小: {len(content)} bytes")
                            
                            # 跳过后续的HTTP下载
                            await mysql_repo.disconnect()
                            
                            # 检查是否为zip文件
                            is_zip = False
                            try:
                                import zipfile
                                from io import BytesIO
                                zip_buffer = BytesIO(content)
                                with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                                    zip_files = zip_ref.namelist()
                                    if zip_files:
                                        is_zip = True
                                        logger.info(f"检测到zip文件，包含 {len(zip_files)} 个文件")
                            except Exception as zip_error:
                                logger.debug(f"不是zip文件或解压失败: {zip_error}")
                            
                            # 如果是zip文件，提取图片
                            if is_zip:
                                logger.info(f"开始处理zip文件: {filename}")
                                try:
                                    import zipfile
                                    from io import BytesIO
                                    
                                    # 解压zip文件
                                    zip_buffer = BytesIO(content)
                                    with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                                        # 列出zip中的所有文件
                                        zip_files = zip_ref.namelist()
                                        logger.info(f"zip文件内容: {zip_files}")
                                        
                                        # 过滤出图片文件
                                        image_files = []
                                        for file_name in zip_files:
                                            # 检查文件扩展名
                                            ext = os.path.splitext(file_name)[1].lower()
                                            if ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                                image_files.append(file_name)
                                        
                                        logger.info(f"找到 {len(image_files)} 个图片文件")
                                        
                                        if image_files:
                                            # 选择第一个图片文件
                                            selected_image = image_files[0]
                                            logger.info(f"选择图片文件: {selected_image}")
                                            
                                            # 读取图片内容
                                            image_content = zip_ref.read(selected_image)
                                            logger.info(f"成功提取图片: {selected_image}，大小: {len(image_content)} bytes")
                                            
                                            # 更新文件名，使用前端传递的文件名
                                            # 确保扩展名正确
                                            base_name = os.path.splitext(filename)[0]
                                            ext = os.path.splitext(selected_image)[1].lower()
                                            final_filename = f"{base_name}{ext}"
                                            logger.info(f"更新文件名: {final_filename}")
                                            
                                            # 检测是否为WebP格式并转换
                                            if is_webp_format(image_content):
                                                logger.info(f"检测到WebP格式文件: {final_filename}，开始转换")
                                                
                                                # 使用默认转换
                                                converted_content, new_ext = convert_webp_to_png(image_content)
                                                
                                                if new_ext != 'webp':
                                                    # 更新文件名
                                                    base_name = os.path.splitext(final_filename)[0]
                                                    new_filename = f"{base_name}.{new_ext}"
                                                    logger.info(f"WebP转换成功: {final_filename} -> {new_filename}，大小: {len(converted_content)} bytes")
                                                    logger.info(f"最终文件名: {new_filename}")
                                                    return new_filename, converted_content
                                                else:
                                                    logger.warning(f"WebP转换失败，使用原始格式: {final_filename}")
                                                    logger.info(f"最终文件名: {final_filename}")
                                                    return final_filename, image_content
                                            else:
                                                logger.info(f"最终文件名: {final_filename}")
                                                return final_filename, image_content
                                        else:
                                            logger.error(f"zip文件中没有找到图片文件")
                                            raise Exception("zip文件中没有找到图片文件")
                                except Exception as zip_process_error:
                                    logger.error(f"处理zip文件失败: {zip_process_error}")
                                    # 如果处理zip文件失败，继续使用原始内容
                                    logger.warning(f"使用原始文件内容")
                            
                            # 检测是否为WebP格式并转换
                            if is_webp_format(content):
                                logger.info(f"检测到WebP格式文件: {filename}，开始转换")
                                
                                # 使用默认转换
                                converted_content, new_ext = convert_webp_to_png(content)
                                
                                if new_ext != 'webp':
                                    # 更新文件名
                                    base_name = os.path.splitext(filename)[0]
                                    new_filename = f"{base_name}.{new_ext}"
                                    logger.info(f"WebP转换成功: {filename} -> {new_filename}，大小: {len(converted_content)} bytes")
                                    logger.info(f"最终文件名: {new_filename}")
                                    return new_filename, converted_content
                                else:
                                    logger.warning(f"WebP转换失败，使用原始格式: {filename}")
                                    logger.info(f"最终文件名: {filename}")
                            else:
                                logger.info(f"最终文件名: {filename}")
                            
                            return filename, content
                        else:
                            logger.error(f"COS服务未启用，无法使用COS SDK获取对象")
                            await mysql_repo.disconnect()
                            raise Exception("COS服务未启用，无法下载原图")
                    except Exception as cos_error:
                        logger.warning(f"使用COS SDK获取对象失败: {cos_error}，尝试使用URL下载")
                        # COS SDK获取失败，尝试使用original_zip_filepath URL下载
                        if original_zip_filepath:
                            logger.info(f"尝试使用URL下载: {original_zip_filepath}")
                            url = original_zip_filepath
                        else:
                            await mysql_repo.disconnect()
                            raise Exception(f"使用COS SDK获取对象失败且无备用URL: {str(cos_error)}")
                else:
                    # 没有找到original_zip_cos_key，尝试使用original_zip_filepath
                    if original_zip_filepath:
                        logger.info(f"未找到original_zip_cos_key，使用URL下载: {original_zip_filepath}")
                        url = original_zip_filepath
                    else:
                        logger.error(f"未找到original_zip_cos_key和original_zip_filepath，无法下载原图")
                        raise Exception("未找到原始文件路径，无法下载原图")
            else:
                # 未找到对应图片记录，无法下载原图
                logger.error(f"未找到对应图片记录，无法下载原图")
                raise Exception("未找到原始文件记录，无法下载原图")
            
            await mysql_repo.disconnect()
        except Exception as e:
            logger.error(f"获取original_zip_filepath失败: {e}", exc_info=True)
            raise

    for attempt in range(retry_count):
        try:
            logger.info(f"开始下载文件: {filename}，URL: {url}，尝试次数: {attempt + 1}/{retry_count}")
            
            # 启用SSL验证，移除ssl=False
            async with session.get(url, timeout=30, headers=headers, allow_redirects=True) as resp:
                logger.info(f"HTTP响应状态码: {resp.status}")
                logger.info(f"HTTP响应头: {dict(resp.headers)}")
                resp.raise_for_status()  # 检查HTTP错误
                
                # 读取文件内容
                content = await resp.read()
                logger.info(f"成功下载文件: {filename}，大小: {len(content)} bytes")
                logger.info(f"文件内容类型: {resp.headers.get('Content-Type', '未知')}")
                
                # 检查是否为zip文件
                is_zip = False
                try:
                    import zipfile
                    from io import BytesIO
                    zip_buffer = BytesIO(content)
                    with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                        zip_files = zip_ref.namelist()
                        if zip_files:
                            is_zip = True
                            logger.info(f"检测到zip文件，包含 {len(zip_files)} 个文件")
                except Exception as zip_error:
                    logger.debug(f"不是zip文件或解压失败: {zip_error}")
                
                # 如果是zip文件，提取图片
                if is_zip:
                    logger.info(f"开始处理zip文件: {filename}")
                    try:
                        import zipfile
                        from io import BytesIO
                        
                        # 解压zip文件
                        zip_buffer = BytesIO(content)
                        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                            # 列出zip中的所有文件
                            zip_files = zip_ref.namelist()
                            logger.info(f"zip文件内容: {zip_files}")
                            
                            # 过滤出图片文件
                            image_files = []
                            for file_name in zip_files:
                                # 检查文件扩展名
                                ext = os.path.splitext(file_name)[1].lower()
                                if ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                    image_files.append(file_name)
                            
                            logger.info(f"找到 {len(image_files)} 个图片文件")
                            
                            if image_files:
                                # 选择第一个图片文件
                                selected_image = image_files[0]
                                logger.info(f"选择图片文件: {selected_image}")
                                
                                # 读取图片内容
                                image_content = zip_ref.read(selected_image)
                                logger.info(f"成功提取图片: {selected_image}，大小: {len(image_content)} bytes")
                                
                                # 更新文件名，使用前端传递的文件名
                                # 确保扩展名正确
                                base_name = os.path.splitext(filename)[0]
                                ext = os.path.splitext(selected_image)[1].lower()
                                final_filename = f"{base_name}{ext}"
                                logger.info(f"更新文件名: {final_filename}")
                                
                                # 检测是否为WebP格式并转换
                                if is_webp_format(image_content):
                                    logger.info(f"检测到WebP格式文件: {final_filename}，开始转换")
                                    
                                    # 使用默认转换
                                    converted_content, new_ext = convert_webp_to_png(image_content)
                                    
                                    if new_ext != 'webp':
                                        # 更新文件名
                                        base_name = os.path.splitext(final_filename)[0]
                                        new_filename = f"{base_name}.{new_ext}"
                                        logger.info(f"WebP转换成功: {final_filename} -> {new_filename}，大小: {len(converted_content)} bytes")
                                        logger.info(f"最终文件名: {new_filename}")
                                        return new_filename, converted_content
                                    else:
                                        logger.warning(f"WebP转换失败，使用原始格式: {final_filename}")
                                        logger.info(f"最终文件名: {final_filename}")
                                        return final_filename, image_content
                                else:
                                    logger.info(f"最终文件名: {final_filename}")
                                    return final_filename, image_content
                            else:
                                logger.error(f"zip文件中没有找到图片文件")
                                raise Exception("zip文件中没有找到图片文件")
                    except Exception as zip_process_error:
                        logger.error(f"处理zip文件失败: {zip_process_error}")
                        # 如果处理zip文件失败，继续使用原始内容
                        logger.warning(f"使用原始文件内容")
                
                # 检测是否为WebP格式并转换
                if is_webp_format(content):
                    logger.info(f"检测到WebP格式文件: {filename}，开始转换")
                    
                    # 使用默认转换
                    converted_content, new_ext = convert_webp_to_png(content)
                    
                    if new_ext != 'webp':
                        # 更新文件名
                        base_name = os.path.splitext(filename)[0]
                        new_filename = f"{base_name}.{new_ext}"
                        logger.info(f"WebP转换成功: {filename} -> {new_filename}，大小: {len(converted_content)} bytes")
                        logger.info(f"最终文件名: {new_filename}")
                        return new_filename, converted_content
                    else:
                        logger.warning(f"WebP转换失败，使用原始格式: {filename}")
                        logger.info(f"最终文件名: {filename}")
                else:
                    logger.info(f"最终文件名: {filename}")
                
                return filename, content
        except aiohttp.ClientError as e:
            logger.error(f"下载文件时HTTP错误: {filename}，错误: {str(e)}，URL: {url}", exc_info=True)
            logger.info(f"HTTP错误详情: 状态码={getattr(e, 'status', '未知')}，消息={getattr(e, 'message', '未知')}")
            if attempt < retry_count - 1:
                # 指数退避，延迟时间为 0.5 * (2 ** attempt) 秒
                delay = 0.5 * (2 ** attempt)
                logger.info(f"将在 {delay:.2f} 秒后重试下载: {filename}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"下载失败: {str(e)}，已尝试 {retry_count} 次")
                raise
        except Exception as e:
            logger.error(f"处理文件时出错: {filename}，错误: {str(e)}，URL: {url}", exc_info=True)
            raise
async def download_files_concurrently(files: list[dict], max_concurrent: int = 20) -> list[tuple[str, bytes]]:
    """
    并发下载文件，限制并发数
    
    Args:
        files: 文件列表
        max_concurrent: 最大并发数
    
    Returns:
        list[tuple[str, bytes]]: 成功下载的文件列表
    """
    results = []
    
    async with aiohttp.ClientSession() as session:
        # 分批处理，每批max_concurrent个文件
        batch_size = max_concurrent
        total_batches = (len(files) + batch_size - 1) // batch_size
        
        for i in range(0, len(files), batch_size):
            batch = files[i:i+batch_size]
            batch_num = i // batch_size + 1
            
            # 减少日志，只记录批次开始和结束
            if batch_num % 5 == 1 or batch_num == total_batches:
                logger.info(f"开始处理批次 {batch_num}/{total_batches}，文件数量: {len(batch)}")
            
            # 创建任务列表
            tasks = []
            for file in batch:
                tasks.append(download_file_with_retry(session, file))
            
            # 并发执行任务
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 处理结果
            success_count = 0
            for result in batch_results:
                if isinstance(result, tuple):
                    filename, content = result
                    results.append(result)
                    success_count += 1
                else:
                    logger.error(f"下载失败: {result}")
            
            # 减少日志，只记录批次结果
            if batch_num % 5 == 0 or batch_num == total_batches:
                logger.info(f"批次 {batch_num}/{total_batches} 处理完成，成功: {success_count}/{len(batch_results)}")
    
    logger.info(f"所有批次处理完成，成功下载 {len(results)} 个文件")
    return results

async def _download_single_file_optimized(
    session: aiohttp.ClientSession,
    file_info: dict,
    mysql_repo=None
) -> DownloadResult:
    """
    优化的单文件下载函数，支持复用数据库连接
    
    Args:
        session: aiohttp会话
        file_info: 文件信息
        mysql_repo: 可选的MySQLRepository实例，用于复用连接
        
    Returns:
        DownloadResult: 下载结果对象
    """
    url = file_info.get('url', '')
    filename = file_info.get('filename', '')

    if not url or not filename:
        return DownloadResult(
            filename=filename or 'unknown',
            url=url,
            status=DownloadStatus.FAILED,
            message="URL或文件名为空"
        )

    # 记录原始URL（用于调试）
    logger.debug(f"下载文件 - 原始URL: {url}")

    # 清理文件名
    import re
    original_filename = filename
    filename = re.sub(r'[^\w\u4e00-\u9fa5\-_\.]', '_', filename)
    filename = re.sub(r'_+', '_', filename)
    if len(filename) > 200:
        name_part, ext_part = os.path.splitext(filename)
        filename = f"{name_part[:190]}{ext_part}"

    # 使用统一的URL清理函数
    url = _clean_url(url)

    # 记录清理后的URL
    logger.debug(f"下载文件 - 清理后URL: {url}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    # 获取下载缓存目录
    
    async def download_implementation():
        """下载实现函数，用于设置超时"""
        # 检查是否需要查询数据库
        current_url = url
        parsed_url = urlparse(current_url)
        path = parsed_url.path
        
        # 生成临时文件路径
        temp_file_path = DOWNLOAD_CACHE_DIR / f"{uuid.uuid4()}_{filename}"
        
        # 优先尝试使用COS SDK下载（适用于定稿图片等存储在COS中的文件）
        object_key = path.lstrip('/') if path.startswith('/') else path
        
        # 如果是COS URL（包含cos域名），尝试使用COS SDK下载
        if 'cos.' in parsed_url.netloc and 'myqcloud.com' in parsed_url.netloc:
            try:
                from ...services.cos_service import cos_service
                if cos_service.is_enabled():
                    logger.debug(f"尝试使用COS SDK下载文件 - 对象键: {object_key}")
                    response = cos_service.client.get_object(
                        Bucket=cos_service.bucket,
                        Key=object_key
                    )
                    body = response['Body']
                    
                    # 直接写入文件，避免将整个文件存储在内存中
                    total_size = 0
                    with open(temp_file_path, 'wb') as f:
                        while True:
                            chunk = body.read(4096)
                            if not chunk:
                                break
                            f.write(chunk)
                            total_size += len(chunk)
                    
                    logger.debug(f"使用COS SDK成功下载文件 - 对象键: {object_key}, 大小: {total_size} bytes")
                    
                    # 读取文件内容（用于后续处理）
                    with open(temp_file_path, 'rb') as f:
                        content = f.read()
                    
                    # 删除临时文件
                    temp_file_path.unlink()
                    
                    return DownloadResult(
                        filename=filename,
                        url=current_url,
                        status=DownloadStatus.SUCCESS,
                        size=total_size,
                        message="COS SDK下载成功",
                        content=content
                    )
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"COS SDK下载失败，尝试HTTP下载: {error_msg}")
                # 如果COS下载失败，继续尝试其他方式
                # 清理临时文件
                if temp_file_path.exists():
                    temp_file_path.unlink()
        
        # 如果不是COS URL或COS下载失败，尝试查询数据库获取原始文件路径
        if "original_zips" not in path and mysql_repo is not None:
            try:
                # 首先检查缓存
                image_info = _get_cached_image_info(object_key)
                
                if image_info is None:
                    # 缓存未命中，查询数据库
                    # 首先使用精确匹配查询cos_object_key
                    image_info = await mysql_repo.execute_query(
                        "SELECT original_zip_filepath, original_zip_cos_key "
                        "FROM images WHERE cos_object_key = %s "
                        "LIMIT 1",
                        (object_key,),
                        fetch_one=True
                    )
                    
                    # 如果精确匹配失败，尝试使用前缀匹配（忽略扩展名）
                    # 使用前缀匹配可以利用索引，而通配符在开头会导致全表扫描
                    if not image_info and '.' in object_key:
                        object_key_no_ext = os.path.splitext(object_key)[0]
                        # 尝试几种常见的扩展名组合
                        extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.zip']
                        for ext in extensions:
                            test_key = object_key_no_ext + ext
                            image_info = await mysql_repo.execute_query(
                                "SELECT original_zip_filepath, original_zip_cos_key "
                                "FROM images WHERE cos_object_key = %s "
                                "LIMIT 1",
                                (test_key,),
                                fetch_one=True
                            )
                            if image_info:
                                break
                    
                    # 缓存查询结果（包括None）
                    _set_cached_image_info(object_key, image_info)
                else:
                    logger.debug(f"使用缓存的图片信息: {object_key}")
                
                if image_info:
                    original_zip_cos_key = image_info.get('original_zip_cos_key')
                    original_zip_filepath = image_info.get('original_zip_filepath')
                    
                    # 优先使用COS SDK获取
                    if original_zip_cos_key:
                        try:
                            from ...services.cos_service import cos_service
                            if cos_service.is_enabled():
                                response = cos_service.client.get_object(
                                    Bucket=cos_service.bucket,
                                    Key=original_zip_cos_key
                                )
                                body = response['Body']
                                
                                # 直接写入文件，避免将整个文件存储在内存中
                                total_size = 0
                                with open(temp_file_path, 'wb') as f:
                                    while True:
                                        chunk = body.read(4096)
                                        if not chunk:
                                            break
                                        f.write(chunk)
                                        total_size += len(chunk)
                                
                                # 读取文件内容（用于后续处理）
                                with open(temp_file_path, 'rb') as f:
                                    content = f.read()
                                
                                # 检查是否为ZIP文件，如果是则解压提取图片
                                if original_zip_cos_key.endswith('.zip'):
                                    try:
                                        zip_buffer = BytesIO(content)
                                        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                                            zip_files = zip_ref.namelist()
                                            logger.debug(f"下载的ZIP文件包含: {zip_files}")
                                            
                                            # 查找与请求文件名匹配的图片
                                            target_name = os.path.splitext(filename)[0].lower()
                                            for zip_file in zip_files:
                                                zip_ext = os.path.splitext(zip_file)[1].lower()
                                                if zip_ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                                    # 检查文件名是否匹配（忽略扩展名）
                                                    zip_name = os.path.splitext(os.path.basename(zip_file))[0].lower()
                                                    if zip_name == target_name or target_name in zip_file.lower():
                                                        extracted_content = zip_ref.read(zip_file)
                                                        logger.info(f"从ZIP中提取图片: {zip_file} -> {filename}")
                                                        # 删除临时文件
                                                        temp_file_path.unlink()
                                                        return DownloadResult(
                                                            filename=filename,
                                                            url=current_url,
                                                            status=DownloadStatus.SUCCESS,
                                                            size=len(extracted_content),
                                                            message=f"从ZIP包中提取: {zip_file}",
                                                            content=extracted_content
                                                        )
                                            
                                            # 如果没有匹配的文件，返回第一个图片
                                            for zip_file in zip_files:
                                                zip_ext = os.path.splitext(zip_file)[1].lower()
                                                if zip_ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                                    extracted_content = zip_ref.read(zip_file)
                                                    logger.info(f"从ZIP中提取第一个图片: {zip_file} -> {filename}")
                                                    # 删除临时文件
                                                    temp_file_path.unlink()
                                                    return DownloadResult(
                                                        filename=filename,
                                                        url=current_url,
                                                        status=DownloadStatus.SUCCESS,
                                                        size=len(extracted_content),
                                                        message=f"从ZIP包中提取: {zip_file}",
                                                        content=extracted_content
                                                    )
                                        
                                        logger.warning(f"ZIP文件中没有找到图片: {original_zip_cos_key}")
                                        # 删除临时文件
                                        temp_file_path.unlink()
                                        return DownloadResult(
                                            filename=filename,
                                            url=current_url,
                                            status=DownloadStatus.FAILED,
                                            message=f"ZIP文件中没有找到图片: {original_zip_cos_key}"
                                        )
                                    except Exception as zip_error:
                                        logger.warning(f"解压ZIP文件失败: {zip_error}")
                                        # 删除临时文件
                                        temp_file_path.unlink()
                                        return DownloadResult(
                                            filename=filename,
                                            url=current_url,
                                            status=DownloadStatus.FAILED,
                                            message=f"解压ZIP文件失败: {str(zip_error)}"
                                        )
                                
                                # 删除临时文件
                                temp_file_path.unlink()
                                return DownloadResult(
                                    filename=filename,
                                    url=current_url,
                                    status=DownloadStatus.SUCCESS,
                                    size=total_size,
                                    message="COS SDK下载成功",
                                    content=content
                                )
                        except Exception as cos_error:
                            logger.warning(f"COS SDK下载original_zip失败: {cos_error}")
                            # 清理临时文件
                            if temp_file_path.exists():
                                temp_file_path.unlink()
                    
                    # 使用URL下载
                    if original_zip_filepath:
                        current_url = original_zip_filepath
            except Exception as e:
                logger.warning(f"数据库查询失败，使用原始URL: {e}")
                # 清理临时文件
                if temp_file_path.exists():
                    temp_file_path.unlink()
        
        # HTTP下载
        retry_count = 3
        last_error = None
        for attempt in range(retry_count):
            try:
                async with session.get(current_url, timeout=30, headers=headers) as resp:
                    resp.raise_for_status()
                    
                    # 直接写入文件，避免将整个文件存储在内存中
                    total_size = 0
                    with open(temp_file_path, 'wb') as f:
                        while True:
                            chunk = await resp.content.read(4096)
                            if not chunk:
                                break
                            f.write(chunk)
                            total_size += len(chunk)
                    
                    # 读取文件内容（用于后续处理）
                    with open(temp_file_path, 'rb') as f:
                        content = f.read()
                    
                    # 删除临时文件
                    temp_file_path.unlink()
                    
                    return DownloadResult(
                        filename=filename,
                        url=current_url,
                        status=DownloadStatus.SUCCESS,
                        size=total_size,
                        message=f"HTTP下载成功（重试{attempt}次）" if attempt > 0 else "HTTP下载成功",
                        content=content
                    )
            except Exception as e:
                last_error = e
                # 清理临时文件
                if temp_file_path.exists():
                    temp_file_path.unlink()
                if attempt < retry_count - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                else:
                    break
        
        # 所有下载方式都失败
        error_message = f"下载失败，已重试{retry_count}次"
        if last_error:
            error_message += f": {str(last_error)}"
        
        return DownloadResult(
            filename=filename,
            url=current_url,
            status=DownloadStatus.FAILED,
            message=error_message
        )
    
    # 设置25秒超时
    try:
        return await asyncio.wait_for(download_implementation(), timeout=25)
    except asyncio.TimeoutError:
        logger.warning(f"下载超时: {filename}, URL: {url}")
        return DownloadResult(
            filename=filename,
            url=url,
            status=DownloadStatus.FAILED,
            message="下载超时（超过25秒）"
        )
    except Exception as e:
        logger.error(f"下载过程中发生错误: {filename}, 错误: {str(e)}")
        return DownloadResult(
            filename=filename,
            url=url,
            status=DownloadStatus.FAILED,
            message=f"下载失败: {str(e)}"
        )


async def _download_files_batch(
    files: list,
    mysql_repo=None,
    max_concurrent: int = 10
) -> List[DownloadResult]:
    """
    批量下载文件，使用连接池复用
    
    Args:
        files: 文件列表
        mysql_repo: MySQLRepository实例
        max_concurrent: 最大并发数
        
    Returns:
        List[DownloadResult]: 下载结果列表
    """
    results = []
    
    async with aiohttp.ClientSession() as session:
        # 分批处理，避免过多并发
        for i in range(0, len(files), max_concurrent):
            batch = files[i:i + max_concurrent]
            batch_num = i // max_concurrent + 1
            total_batches = (len(files) + max_concurrent - 1) // max_concurrent
            
            logger.info(f"处理批次 {batch_num}/{total_batches}, 文件数: {len(batch)}")
            
            # 创建任务
            tasks = []
            for file_info in batch:
                tasks.append(_download_single_file_optimized(session, file_info, mysql_repo))
            
            # 并发下载
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 处理结果
            for idx, result in enumerate(batch_results):
                file_info = batch[idx]
                if isinstance(result, DownloadResult):
                    results.append(result)
                    if result.status == DownloadStatus.SUCCESS:
                        logger.info(f"[OK] 下载成功: {result.filename} ({result.size} bytes) - {result.message}")
                    else:
                        logger.warning(f"[FAIL] 下载失败: {result.filename} - {result.message}")
                elif isinstance(result, Exception):
                    filename = file_info.get('filename', 'unknown')
                    url = file_info.get('url', '')
                    error_result = DownloadResult(
                        filename=filename,
                        url=url,
                        status=DownloadStatus.FAILED,
                        message=f"下载异常: {str(result)}"
                    )
                    results.append(error_result)
                    logger.error(f"[FAIL] 下载异常: {filename} - {result}")
            
            # 记录批次统计
            success_count = sum(1 for r in batch_results if isinstance(r, DownloadResult) and r.status == DownloadStatus.SUCCESS)
            failed_count = len(batch_results) - success_count
            logger.info(f"批次 {batch_num}/{total_batches} 完成 - 成功: {success_count}, 失败: {failed_count}")
    
    # 记录总体统计
    total_success = sum(1 for r in results if r.status == DownloadStatus.SUCCESS)
    total_failed = sum(1 for r in results if r.status == DownloadStatus.FAILED)
    logger.info(f"批量下载完成 - 总计: {len(results)}, 成功: {total_success}, 失败: {total_failed}")
    
    return results


@router.post("/download-zip")
async def download_zip(
    request: Request,
    response: Response,
    user_info: dict = Depends(auth_middleware.require_auth)
):
    """
    下载文件并打包成ZIP（优化版）
    
    优化点：
    - 复用MySQL连接池，避免连接过多
    - 流式ZIP生成，边下载边打包
    - 控制并发数，避免资源耗尽
    - 返回详细的下载结果，包括成功/失败状态和原因
    - 同步创建下载任务记录
    
    Args:
        request: FastAPI请求对象
        response: FastAPI响应对象
    
    Returns:
        JSONResponse: 包含下载结果和临时ZIP文件URL
    """
    mysql_repo = None
    task_id = None
    
    try:
        logger.info("开始处理ZIP下载请求")
        
        # 获取数据库连接池
        mysql_repo = request.app.state.mysql
        if not mysql_repo:
            raise HTTPException(status_code=500, detail="数据库连接不可用")
        
        # 设置下载任务服务的数据库连接
        download_task_service.set_mysql_repo(mysql_repo)
        
        # 解析请求体
        request_body = await request.json()
        
        # 处理不同的请求格式
        files = []
        custom_filename = None
        if isinstance(request_body, list):
            files = request_body
        elif isinstance(request_body, dict) and "files" in request_body:
            files = request_body["files"]
            # 获取自定义文件名
            custom_filename = request_body.get("filename")
        else:
            raise HTTPException(status_code=400, detail="无效的请求格式")
        
        if not files:
            raise HTTPException(status_code=400, detail="文件列表不能为空")
        
        # 过滤无效文件并清理URL
        valid_files = []
        for file in files:
            if isinstance(file, dict) and file.get("url") and file.get("filename"):
                # 清理URL中的特殊字符
                original_url = file.get("url", "")
                cleaned_url = _clean_url(original_url)
                if cleaned_url != original_url:
                    logger.debug(f"URL清理 - 原始: {original_url}, 清理后: {cleaned_url}")
                file["url"] = cleaned_url
                valid_files.append(file)

        if not valid_files:
            raise HTTPException(status_code=400, detail="没有有效的文件可以下载")
        
        logger.info(f"有效文件数量: {len(valid_files)}")
        
        # 创建下载任务
        if custom_filename:
            # 使用自定义文件名作为任务名称
            task_name = custom_filename.replace('.zip', '')
        else:
            task_name = f"定稿下载_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        # 获取当前用户ID
        current_user_id = user_info.get('id') if user_info else None
        
        task_id = await download_task_service.create_task(
            name=task_name,
            source=DownloadTaskSource.FINAL_DRAFT,
            skus=[file['filename'] for file in valid_files],
            user_id=current_user_id
        )
        
        logger.info(f"创建下载任务成功: {task_id}")
        
        # 下载所有文件（复用数据库连接）
        download_results = await _download_files_batch(
            valid_files,
            mysql_repo=mysql_repo,
            max_concurrent=5  # 控制并发数
        )
        
        # 准备返回的下载结果（不包含content字段）
        result_list = []
        image_files = []  # 用于生成ZIP的图片文件
        failed_files = []  # 记录失败的文件
        temp_zip_path = None  # 临时ZIP文件路径
        
        for result in download_results:
            result_dict = {
                "filename": result.filename,
                "url": result.url,
                "status": result.status.value,
                "size": result.size,
                "message": result.message
            }
            result_list.append(result_dict)
            
            # 收集成功的图片文件用于生成ZIP
            if result.status == DownloadStatus.SUCCESS and result.content:
                ext = os.path.splitext(result.filename)[1].lower()
                if ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                    image_files.append((result.filename, result.content))
            elif result.status == DownloadStatus.FAILED:
                # 记录失败的文件
                failed_files.append({
                    "filename": result.filename,
                    "error": result.message
                })
        
        # 统计信息
        success_count = sum(1 for r in download_results if r.status == DownloadStatus.SUCCESS)
        failed_count = sum(1 for r in download_results if r.status == DownloadStatus.FAILED)
        total_size = sum(r.size for r in download_results if r.status == DownloadStatus.SUCCESS)
        
        logger.info(f"下载完成 - 总计: {len(download_results)}, 成功: {success_count}, 失败: {failed_count}")
        logger.info(f"有效图片文件: {len(image_files)} 个")
        
        # 生成详细的错误信息
        error_details = []
        for failed_file in failed_files:
            error_details.append(f"SKU {failed_file['filename']}: {failed_file['error']}")
        
        # 创建ZIP文件
        zip_data = b''
        # 使用自定义文件名（如果提供）
        if custom_filename:
            # 确保文件名以.zip结尾
            if not custom_filename.endswith('.zip'):
                custom_filename += '.zip'
            zip_filename = custom_filename
        else:
            zip_filename = f"drafts_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
        zip_url = None
        zip_token = None
        
        # 只有当有成功下载的文件时才生成ZIP
        if success_count > 0 and image_files:
            # 保存ZIP文件到持久化目录
            
            # 创建任务专属目录
            task_dir = os.path.join(DOWNLOAD_CACHE_DIR, task_id)
            os.makedirs(task_dir, exist_ok=True)
            
            # 保存ZIP文件
            temp_zip_path = os.path.join(task_dir, zip_filename)
            
            # 直接写入文件，避免将整个ZIP数据存储在内存中
            # 使用ZIP_DEFLATED压缩格式减小文件大小
            with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for filename, content in image_files:
                    # 将图片转换为PNG格式
                    try:
                        if HAS_PIL and Image is not None:
                            with Image.open(BytesIO(content)) as img:
                                # 处理不同模式，保留透明度
                                if img.mode == 'P':
                                    # 转换调色板模式为RGBA
                                    img = img.convert('RGBA')
                                elif img.mode == 'LA':
                                    # 转换灰度带透明度模式为RGBA
                                    img = img.convert('RGBA')
                                
                                # 保存为PNG格式
                                png_buffer = BytesIO()
                                img.save(png_buffer, format='PNG', optimize=True)
                                png_content = png_buffer.getvalue()
                                
                                # 修改文件名为.png后缀
                                png_filename = f"{os.path.splitext(filename)[0]}.png"
                                zip_file.writestr(png_filename, png_content)
                                logger.debug(f"转换图片为PNG格式: {filename} -> {png_filename}")
                        else:
                            # PIL不可用，直接写入原始内容
                            zip_file.writestr(filename, content)
                    except Exception as e:
                        logger.warning(f"转换图片为PNG格式失败: {filename}, 错误: {e}")
                        # 转换失败，写入原始内容
                        zip_file.writestr(filename, content)
            
            # 获取ZIP文件大小
            zip_size = os.path.getsize(temp_zip_path)
            
            logger.info(f"ZIP文件生成成功，大小: {zip_size / 1024 / 1024:.2f} MB, 路径: {temp_zip_path}")
            
            # 清理临时内容，释放内存
            del image_files
        
        # 更新任务状态
        task_status = DownloadTaskStatus.COMPLETED if success_count > 0 else DownloadTaskStatus.FAILED
        error_message = "; ".join(error_details) if error_details else None
        
        # 导入下载任务服务的内部方法
        await download_task_service._update_task_status(
            task_id,
            task_status,
            progress=100,
            completed_files=success_count,
            failed_files=failed_count,
            total_size=total_size,
            local_path=temp_zip_path if success_count > 0 and temp_zip_path else None,
            error_message=error_message
        )
        
        logger.info(f"更新下载任务状态成功: {task_id}, 状态: {task_status.value}")
        
        # 生成返回消息
        if success_count > 0:
            message = f"下载完成，成功 {success_count} 个，失败 {failed_count} 个"
            if error_details:
                message += "；失败详情：" + "; ".join(error_details[:3])  # 只显示前3个失败详情，避免消息过长
                if len(error_details) > 3:
                    message += f" 等{len(error_details)}个文件"
        else:
            message = "所有文件下载失败"
            if error_details:
                message += "：" + "; ".join(error_details)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": success_count > 0,
                "message": message,
                "data": {
                    "download_results": result_list,
                    "total": len(download_results),
                    "success_count": success_count,
                    "failed_count": failed_count,
                    "failed_files": failed_files,
                    "error_details": error_details,
                    "task_id": task_id
                }
            }
        )
        
    except HTTPException:
        # 如果发生HTTP异常，也更新任务状态为失败
        if task_id:
            try:
                await download_task_service._update_task_status(
                    task_id,
                    DownloadTaskStatus.FAILED,
                    error_message="请求参数错误"
                )
            except Exception as e:
                logger.error(f"更新任务状态失败: {e}")
        raise
    except json.JSONDecodeError:
        # 如果发生JSON解析错误，也更新任务状态为失败
        if task_id:
            try:
                await download_task_service._update_task_status(
                    task_id,
                    DownloadTaskStatus.FAILED,
                    error_message="无效的JSON格式"
                )
            except Exception as e:
                logger.error(f"更新任务状态失败: {e}")
        raise HTTPException(status_code=400, detail="无效的JSON格式")
    except Exception as e:
        # 如果发生其他异常，也更新任务状态为失败
        if task_id:
            try:
                await download_task_service._update_task_status(
                    task_id,
                    DownloadTaskStatus.FAILED,
                    error_message=str(e)
                )
            except Exception as update_error:
                logger.error(f"更新任务状态失败: {update_error}")
        logger.error(f"生成ZIP文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成ZIP文件失败: {str(e)}")


@router.post("/download-zip-async")
async def download_zip_async(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    异步创建下载任务
    
    功能：
    - 接收文件列表，创建异步下载任务
    - 立即返回任务ID，不等待下载完成
    - 后台执行文件下载和ZIP打包
    
    请求格式：
    {
        "files": [
            {"url": "http://example.com/image1.jpg", "filename": "image1.jpg"},
            {"url": "http://example.com/image2.jpg", "filename": "image2.jpg"}
        ]
    }
    
    响应格式：
    {
        "code": 200,
        "message": "下载任务已创建",
        "data": {
            "task_id": "uuid-string",
            "status": "pending"
        }
    }
    
    Args:
        request: FastAPI请求对象
        background_tasks: 后台任务
        
    Returns:
        dict: 包含任务ID的响应
    """
    try:
        logger.info("开始创建异步下载任务")
        
        # 解析请求体
        request_body = await request.json()
        
        # 处理不同的请求格式
        files = []
        
        if isinstance(request_body, list):
            files = request_body
            logger.info(f"直接接收文件列表，数量: {len(files)}")
        elif isinstance(request_body, dict):
            if "files" in request_body:
                files = request_body["files"]
                logger.info(f"从请求体中提取文件列表，数量: {len(files)}")
        else:
            logger.error(f"无效的请求格式: {type(request_body)}")
            raise HTTPException(status_code=400, detail="无效的请求格式")
        
        # 验证输入
        if not files:
            raise HTTPException(status_code=400, detail="文件列表不能为空")
        
        # 过滤无效文件
        valid_files = []
        for file in files:
            if not isinstance(file, dict) or "url" not in file or "filename" not in file:
                logger.warning(f"无效的文件条目: {file}")
                continue
            if not file["url"] or not file["filename"]:
                logger.warning(f"文件URL或文件名不能为空: {file}")
                continue
            valid_files.append(file)
        
        if not valid_files:
            raise HTTPException(status_code=400, detail="没有有效的文件可以下载")
        
        logger.info(f"有效文件数量: {len(valid_files)}")
        
        # 创建下载任务
        task_id = await download_task_service.create_task(valid_files)
        
        # 启动后台任务执行下载
        background_tasks.add_task(download_task_service.execute_task, task_id)
        
        logger.info(f"异步下载任务已创建: {task_id}")
        
        return {
            "code": 200,
            "message": "下载任务已创建",
            "data": {
                "task_id": task_id,
                "status": "pending",
                "total_files": len(valid_files)
            }
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"解析请求体失败: {str(e)}")
        raise HTTPException(status_code=400, detail="无效的JSON格式")
    except Exception as e:
        logger.error(f"创建下载任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建下载任务失败: {str(e)}")


@router.get("/download-tasks/{task_id}")
async def get_download_task_status(task_id: str):
    """
    获取下载任务状态
    
    功能：
    - 查询指定任务的状态和进度
    - 返回任务详细信息，包括进度百分比
    
    响应格式：
    {
        "code": 200,
        "message": "获取成功",
        "data": {
            "task_id": "uuid-string",
            "status": "processing",
            "total_files": 100,
            "processed_files": 50,
            "success_files": 48,
            "failed_files": 2,
            "progress_percent": 50.0,
            "zip_size": 10485760
        }
    }
    
    Args:
        task_id: 任务ID
        
    Returns:
        dict: 任务状态信息
    """
    try:
        task_status = download_task_service.get_task_status_dict(task_id)
        
        if not task_status:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": task_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}")


@router.post("/download-tasks/{task_id}/cancel")
async def cancel_download_task(task_id: str):
    """
    取消下载任务
    
    功能：
    - 取消正在等待或执行中的任务
    
    Args:
        task_id: 任务ID
        
    Returns:
        dict: 取消结果
    """
    try:
        success = await download_task_service.cancel_task(task_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="任务不存在或无法取消")
        
        return {
            "code": 200,
            "message": "任务已取消",
            "data": {"task_id": task_id}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"取消任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")
