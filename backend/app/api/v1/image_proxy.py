"""
[参考] 图片代理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ImageProxyController.java

最终删除日期：项目稳定运行后
"""
"""
统一图片代理服务
用于代理 COS 图片访问，解决 CORS 问题
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse, Response
from typing import Optional, List
import os
import time
import io
import hashlib
import aiohttp
from PIL import Image

from ...services.cos_service import cos_service
from ...config import settings
from ...repositories import MySQLRepository

logger = __import__('logging').getLogger(__name__)

router = APIRouter(tags=["统一图片服务"])

_PLACEHOLDER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f0f2f5"/>
  <text x="256" y="240" text-anchor="middle" fill="#909399" font-size="16" font-family="sans-serif">图片暂不可用</text>
  <text x="256" y="270" text-anchor="middle" fill="#c0c4cc" font-size="12" font-family="sans-serif">{filename}</text>
</svg>"""


def _make_placeholder(filename: str = "") -> Response:
    """生成占位图片响应"""
    svg = _PLACEHOLDER_SVG.format(filename=filename)
    return Response(
        content=svg.encode('utf-8'),
        media_type="image/svg+xml",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        }
    )


def _get_content_type(data: bytes) -> str:
    """根据图片数据检测内容类型"""
    try:
        img = Image.open(io.BytesIO(data))
        return f"image/{img.format.lower() if img.format else 'jpeg'}"
    except:
        # 回退：使用 imghdr（Python 3.13 移除）
        import imghdr
        img_type = imghdr.what(None, h=data)
        return f"image/{img_type}" if img_type else "image/jpeg"


def _save_to_local(data: bytes, local_path: str) -> bool:
    """保存图片到本地缓存"""
    try:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, 'wb') as f:
            f.write(data)
        return True
    except Exception as e:
        logger.warning(f"保存到本地失败: {local_path}, 错误: {e}")
        return False


async def _fetch_image_from_url(url: str, timeout: int = 30) -> Optional[bytes]:
    """从 URL 下载图片"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                if resp.status != 200:
                    return None
                return await resp.read()
    except Exception as e:
        logger.warning(f"从URL下载失败: {url}, 错误: {e}")
        return None


async def _fetch_image_from_cos(object_key: str) -> Optional[bytes]:
    """从 COS 获取图片（SDK 方式）"""
    # 如果 COS 未启用，直接返回 None
    if not cos_service.enabled:
        logger.debug(f"COS 未启用，跳过 SDK 获取: {object_key}")
        return None

    try:
        key = object_key.lstrip('/')
        response = cos_service.client.get_object(
            Bucket=cos_service.bucket,
            Key=key
        )
        body = response['Body']
        # 读取完整数据
        data = b''
        for chunk in body:
            data += chunk
        return data if data else None
    except Exception as e:
        logger.warning(f"COS SDK 获取失败: {object_key}, 错误: {e}")
        return None


def _build_response(data: bytes, source: str = "unknown", local_path: str = None) -> Response:
    """构建图片响应"""
    content_type = _get_content_type(data)
    process_time = time.time() - _request_start_time.get("time", 0)
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": str(len(data)),
        "X-Process-Time": f"{process_time:.3f}",
        "X-Image-Size": str(len(data)),
        "X-Image-Source": source
    }
    
    return Response(content=data, media_type=content_type, headers=headers)


# 用于计算请求处理时间
_request_start_time = {"time": 0}


@router.get("/image-proxy/proxy", summary="代理图片访问")
async def proxy_image(
    object_key: Optional[str] = Query(None, description="COS对象键"),
    url: Optional[str] = Query(None, description="完整图片URL"),
):
    """
    代理图片访问（公有读 COS 优化版）
    
    流程：
    1. 直接用无签名 URL 下载（公有读，不需要签名）
    2. 失败则用 COS SDK 回退
    3. 成功后再保存到本地缓存
    """
    global _request_start_time
    _request_start_time["time"] = time.time()
    
    if not object_key and not url:
        raise HTTPException(status_code=400, detail="object_key 和 url 不能同时为空")
    
    image_data = None
    source = "unknown"
    
    # 构建下载 URL
    if object_key:
        # 公有读 COS：直接构建无签名 URL
        url = cos_service.get_full_url(object_key.lstrip('/'))
        source = "cos_public"
    
    # 第1步：直接从 URL 下载（公有读，不需要签名）
    if url:
        image_data = await _fetch_image_from_url(url)
        if image_data:
            # 保存到本地缓存
            filename = hashlib.md5(url.encode()).hexdigest()[:16]
            local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, f"proxy_{filename}.webp")
            _save_to_local(image_data, local_path)
            return _build_response(image_data, source)
    
    # 第2步：回退到 COS SDK
    if object_key:
        image_data = await _fetch_image_from_cos(object_key)
        if image_data:
            # 保存到本地缓存
            filename = os.path.basename(object_key)
            local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, filename)
            _save_to_local(image_data, local_path)
            return _build_response(image_data, "cos_sdk")
    
    logger.warning(f"图片获取失败，返回占位图: object_key={object_key}, url={url}")
    return _make_placeholder(object_key or url or "unknown")


@router.get("/image-proxy/local", summary="访问本地缩略图（自动补全）")
async def get_local_thumbnail(
    filename: str = Query(..., description="缩略图文件名"),
):
    """
    访问本地缩略图
    
    如果本地不存在，自动从 COS 下载并保存到本地。
    """
    global _request_start_time
    _request_start_time["time"] = time.time()
    
    # 验证文件名
    if not filename or filename.strip() == '' or filename == '.webp':
        raise HTTPException(status_code=400, detail="无效的文件名")
    
    local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, filename)
    
    # 检查本地是否存在
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        with open(local_path, 'rb') as f:
            image_data = f.read()
        return _build_response(image_data, "local")
    
    # 本地不存在，从 COS 下载
    # 尝试常见的路径前缀
    prefixes = [
        "images/",
        "thumbnails/",
        "final_drafts/",
        "reference_images/",
        "materials/",
        "carriers/",
        ""
    ]
    
    for prefix in prefixes:
        object_key = f"{prefix}{filename}"
        url = cos_service.get_full_url(object_key)
        
        image_data = await _fetch_image_from_url(url)
        if image_data:
            # 保存到本地
            _save_to_local(image_data, local_path)
            return _build_response(image_data, "cos_download")

    logger.warning(f"本地图片不存在且COS下载失败: {filename}")
    return _make_placeholder(filename)


@router.get("/image-proxy/local-by-path", summary="通过完整路径访问本地缩略图")
async def get_local_thumbnail_by_path(
    object_key: str = Query(..., description="COS对象键"),
):
    """
    通过完整的 COS 对象键访问图片
    
    先检查本地缓存，再从 COS 下载。
    """
    global _request_start_time
    _request_start_time["time"] = time.time()
    
    # 构建本地路径
    filename = os.path.basename(object_key)
    local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, filename)
    
    # 检查本地缓存
    if os.path.exists(local_path) and os.path.getsize(local_path) > 100:
        with open(local_path, 'rb') as f:
            image_data = f.read()
        return _build_response(image_data, "local")
    
    # 从 COS 下载
    url = cos_service.get_full_url(object_key.lstrip('/'))
    image_data = await _fetch_image_from_url(url)
    
    if image_data:
        _save_to_local(image_data, local_path)
        return _build_response(image_data, "cos_public")
    
    # 回退到 SDK
    image_data = await _fetch_image_from_cos(object_key)
    if image_data:
        _save_to_local(image_data, local_path)
        return _build_response(image_data, "cos_sdk")
    
    logger.warning(f"本地图片不存在: {filename}")
    return _make_placeholder(filename)


@router.post("/image-proxy/refresh", summary="刷新图片URL")
async def refresh_image_url(
    request: dict = Body(..., description="包含 object_key 的请求体"),
):
    """生成新的图片访问 URL（公有读模式下直接返回完整 URL）"""
    object_key = request.get("object_key")
    if not object_key:
        raise HTTPException(status_code=400, detail="object_key 不能为空")
    
    # 公有读：直接返回完整 URL
    url = cos_service.get_full_url(object_key.lstrip('/'))
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": {
            "url": url,
            "object_key": object_key
        }
    }


@router.get("/image/stats", summary="获取图片统计")
async def get_image_stats():
    """获取本地缓存统计"""
    thumbnail_dir = settings.LOCAL_THUMBNAIL_DIR
    
    if not os.path.exists(thumbnail_dir):
        return {
            "code": 200,
            "data": {
                "total_count": 0,
                "total_size_mb": 0,
                "cache_dir": thumbnail_dir
            }
        }
    
    files = [f for f in os.listdir(thumbnail_dir) if os.path.isfile(os.path.join(thumbnail_dir, f))]
    total_size = sum(os.path.getsize(os.path.join(thumbnail_dir, f)) for f in files)
    
    return {
        "code": 200,
        "data": {
            "total_count": len(files),
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "cache_dir": thumbnail_dir
        }
    }
