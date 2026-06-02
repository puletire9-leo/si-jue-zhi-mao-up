"""
下载工具函数模块

从 final_drafts.py 提取的核心下载逻辑，供 API 端点和 Celery 任务共享。
"""

import asyncio
import logging
import os
import re
import uuid
import zipfile
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    Image = None

# 下载缓存目录
CURRENT_FILE = Path(__file__).resolve()
DOWNLOAD_CACHE_DIR = CURRENT_FILE.parent.parent.parent / "下载缓存"


class DownloadStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class DownloadResult:
    filename: str
    url: str
    status: DownloadStatus
    size: int = 0
    message: str = ""
    content: Optional[bytes] = field(default=None, repr=False)


# 图片信息查询缓存
_image_info_cache: Dict[str, Dict] = {}
_image_info_cache_time: Dict[str, datetime] = {}
_image_cache_ttl = 300


def _get_cached_image_info(object_key: str) -> Optional[Dict]:
    if object_key in _image_info_cache:
        cache_time = _image_info_cache_time.get(object_key)
        if cache_time and (datetime.now() - cache_time).seconds < _image_cache_ttl:
            return _image_info_cache[object_key]
        del _image_info_cache[object_key]
        del _image_info_cache_time[object_key]
    return None


def _set_cached_image_info(object_key: str, info: Optional[Dict]):
    _image_info_cache[object_key] = info
    _image_info_cache_time[object_key] = datetime.now()


def clean_url(url: str) -> str:
    """清理URL，移除各种可能导致请求失败的字符"""
    if not url or not isinstance(url, str):
        return url

    url = url.strip()
    url = url.replace('`', '')
    url = url.replace("'", '')
    url = url.replace('"', '')
    url = url.strip()

    if url.startswith('/') and not url.startswith('//'):
        url = url[1:]

    return url


async def download_single_file_optimized(
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

    logger.debug(f"下载文件 - 原始URL: {url}")

    original_filename = filename
    filename = re.sub(r'[^\w一-龥\-_\.]', '_', filename)
    filename = re.sub(r'_+', '_', filename)
    if len(filename) > 200:
        name_part, ext_part = os.path.splitext(filename)
        filename = f"{name_part[:190]}{ext_part}"

    url = clean_url(url)
    logger.debug(f"下载文件 - 清理后URL: {url}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    async def download_implementation():
        current_url = url
        parsed_url = urlparse(current_url)
        path = parsed_url.path

        temp_file_path = DOWNLOAD_CACHE_DIR / f"{uuid.uuid4()}_{filename}"

        object_key = path.lstrip('/') if path.startswith('/') else path

        # 如果是COS URL，尝试使用COS SDK下载
        if 'cos.' in parsed_url.netloc and 'myqcloud.com' in parsed_url.netloc:
            try:
                from ..services.cos_service import cos_service
                if cos_service.is_enabled():
                    logger.debug(f"尝试使用COS SDK下载文件 - 对象键: {object_key}")
                    response = cos_service.client.get_object(
                        Bucket=cos_service.bucket,
                        Key=object_key
                    )
                    body = response['Body']

                    total_size = 0
                    with open(temp_file_path, 'wb') as f:
                        while True:
                            chunk = body.read(4096)
                            if not chunk:
                                break
                            f.write(chunk)
                            total_size += len(chunk)

                    logger.debug(f"使用COS SDK成功下载文件 - 对象键: {object_key}, 大小: {total_size} bytes")

                    with open(temp_file_path, 'rb') as f:
                        content = f.read()

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
                if temp_file_path.exists():
                    temp_file_path.unlink()

        # 如果不是COS URL或COS下载失败，尝试查询数据库获取原始文件路径
        if "original_zips" not in path and mysql_repo is not None:
            try:
                image_info = _get_cached_image_info(object_key)

                if image_info is None:
                    image_info = await mysql_repo.execute_query(
                        "SELECT original_zip_filepath, original_zip_cos_key "
                        "FROM images WHERE cos_object_key = %s "
                        "LIMIT 1",
                        (object_key,),
                        fetch_one=True
                    )

                    if not image_info and '.' in object_key:
                        object_key_no_ext = os.path.splitext(object_key)[0]
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

                    _set_cached_image_info(object_key, image_info)
                else:
                    logger.debug(f"使用缓存的图片信息: {object_key}")

                if image_info:
                    original_zip_cos_key = image_info.get('original_zip_cos_key')
                    original_zip_filepath = image_info.get('original_zip_filepath')

                    if original_zip_cos_key:
                        try:
                            from ..services.cos_service import cos_service
                            if cos_service.is_enabled():
                                response = cos_service.client.get_object(
                                    Bucket=cos_service.bucket,
                                    Key=original_zip_cos_key
                                )
                                body = response['Body']

                                total_size = 0
                                with open(temp_file_path, 'wb') as f:
                                    while True:
                                        chunk = body.read(4096)
                                        if not chunk:
                                            break
                                        f.write(chunk)
                                        total_size += len(chunk)

                                with open(temp_file_path, 'rb') as f:
                                    content = f.read()

                                if original_zip_cos_key.endswith('.zip'):
                                    try:
                                        zip_buffer = BytesIO(content)
                                        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                                            zip_files = zip_ref.namelist()
                                            logger.debug(f"下载的ZIP文件包含: {zip_files}")

                                            target_name = os.path.splitext(filename)[0].lower()
                                            for zip_file in zip_files:
                                                zip_ext = os.path.splitext(zip_file)[1].lower()
                                                if zip_ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                                    zip_name = os.path.splitext(os.path.basename(zip_file))[0].lower()
                                                    if zip_name == target_name or target_name in zip_file.lower():
                                                        extracted_content = zip_ref.read(zip_file)
                                                        logger.info(f"从ZIP中提取图片: {zip_file} -> {filename}")
                                                        temp_file_path.unlink()
                                                        return DownloadResult(
                                                            filename=filename,
                                                            url=current_url,
                                                            status=DownloadStatus.SUCCESS,
                                                            size=len(extracted_content),
                                                            message=f"从ZIP包中提取: {zip_file}",
                                                            content=extracted_content
                                                        )

                                            for zip_file in zip_files:
                                                zip_ext = os.path.splitext(zip_file)[1].lower()
                                                if zip_ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                                                    extracted_content = zip_ref.read(zip_file)
                                                    logger.info(f"从ZIP中提取第一个图片: {zip_file} -> {filename}")
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
                                        temp_file_path.unlink()
                                        return DownloadResult(
                                            filename=filename,
                                            url=current_url,
                                            status=DownloadStatus.FAILED,
                                            message=f"ZIP文件中没有找到图片: {original_zip_cos_key}"
                                        )
                                    except Exception as zip_error:
                                        logger.warning(f"解压ZIP文件失败: {zip_error}")
                                        temp_file_path.unlink()
                                        return DownloadResult(
                                            filename=filename,
                                            url=current_url,
                                            status=DownloadStatus.FAILED,
                                            message=f"解压ZIP文件失败: {str(zip_error)}"
                                        )

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
                            if temp_file_path.exists():
                                temp_file_path.unlink()

                    if original_zip_filepath:
                        current_url = original_zip_filepath
            except Exception as e:
                logger.warning(f"数据库查询失败，使用原始URL: {e}")
                if temp_file_path.exists():
                    temp_file_path.unlink()

        # HTTP下载
        retry_count = 3
        last_error = None
        for attempt in range(retry_count):
            try:
                async with session.get(current_url, timeout=30, headers=headers) as resp:
                    resp.raise_for_status()

                    total_size = 0
                    with open(temp_file_path, 'wb') as f:
                        while True:
                            chunk = await resp.content.read(4096)
                            if not chunk:
                                break
                            f.write(chunk)
                            total_size += len(chunk)

                    with open(temp_file_path, 'rb') as f:
                        content = f.read()

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
                if temp_file_path.exists():
                    temp_file_path.unlink()
                if attempt < retry_count - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                else:
                    break

        error_message = f"下载失败，已重试{retry_count}次"
        if last_error:
            error_message += f": {str(last_error)}"

        return DownloadResult(
            filename=filename,
            url=current_url,
            status=DownloadStatus.FAILED,
            message=error_message
        )

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


async def download_files_batch(
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
        for i in range(0, len(files), max_concurrent):
            batch = files[i:i + max_concurrent]
            batch_num = i // max_concurrent + 1
            total_batches = (len(files) + max_concurrent - 1) // max_concurrent

            logger.info(f"处理批次 {batch_num}/{total_batches}, 文件数: {len(batch)}")

            tasks = []
            for file_info in batch:
                tasks.append(download_single_file_optimized(session, file_info, mysql_repo))

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

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

            success_count = sum(1 for r in batch_results if isinstance(r, DownloadResult) and r.status == DownloadStatus.SUCCESS)
            failed_count = len(batch_results) - success_count
            logger.info(f"批次 {batch_num}/{total_batches} 完成 - 成功: {success_count}, 失败: {failed_count}")

    total_success = sum(1 for r in results if r.status == DownloadStatus.SUCCESS)
    total_failed = sum(1 for r in results if r.status == DownloadStatus.FAILED)
    logger.info(f"批量下载完成 - 总计: {len(results)}, 成功: {total_success}, 失败: {total_failed}")

    return results


def build_zip_from_images(
    image_files: List[tuple],
    zip_path: str,
) -> int:
    """
    将图片文件列表构建为ZIP文件，自动转换图片为PNG格式

    Args:
        image_files: [(filename, content_bytes), ...] 列表
        zip_path: 目标ZIP文件路径

    Returns:
        int: 成功打包的图片数量
    """
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    packed_count = 0

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for filename, content in image_files:
            try:
                if HAS_PIL and Image is not None:
                    with Image.open(BytesIO(content)) as img:
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        elif img.mode == 'LA':
                            img = img.convert('RGBA')

                        png_buffer = BytesIO()
                        img.save(png_buffer, format='PNG', optimize=True)
                        png_content = png_buffer.getvalue()

                        png_filename = f"{os.path.splitext(filename)[0]}.png"
                        zip_file.writestr(png_filename, png_content)
                        logger.debug(f"转换图片为PNG格式: {filename} -> {png_filename}")
                else:
                    zip_file.writestr(filename, content)
                packed_count += 1
            except Exception as e:
                logger.warning(f"转换图片为PNG格式失败: {filename}, 错误: {e}")
                zip_file.writestr(filename, content)
                packed_count += 1

    return packed_count
