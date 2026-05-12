"""
图片处理工具

提供图片格式转换、压缩等功能
"""

import io
import logging
from typing import Optional, Tuple
from PIL import Image

logger = logging.getLogger(__name__)


async def convert_to_supported_format(
    image_data: bytes,
    target_format: str = "JPEG",
    max_size: Tuple[int, int] = (1920, 1920),
    quality: int = 85
) -> Optional[bytes]:
    """
    将图片转换为腾讯云支持的格式
    
    腾讯云图像识别支持的格式：PNG、JPG、JPEG、BMP、GIF
    不支持的格式：WebP
    
    Args:
        image_data: 原始图片数据
        target_format: 目标格式（默认JPEG）
        max_size: 最大尺寸（宽, 高）
        quality: JPEG质量（1-100）
        
    Returns:
        Optional[bytes]: 转换后的图片数据，失败返回None
    """
    try:
        # 打开图片
        image = Image.open(io.BytesIO(image_data))
        
        # 转换为RGB模式（去除透明通道）
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # 调整尺寸（保持宽高比）
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # 保存为指定格式
        output = io.BytesIO()
        if target_format.upper() == "JPEG":
            image.save(output, format="JPEG", quality=quality, optimize=True)
        elif target_format.upper() == "PNG":
            image.save(output, format="PNG", optimize=True)
        else:
            image.save(output, format=target_format)
        
        result = output.getvalue()
        logger.info(f"图片转换成功: {len(image_data)} bytes -> {len(result)} bytes")
        return result
        
    except Exception as e:
        logger.error(f"图片转换失败: {str(e)}")
        return None


def get_image_format(image_data: bytes) -> Optional[str]:
    """
    获取图片格式
    
    Args:
        image_data: 图片数据
        
    Returns:
        Optional[str]: 图片格式（如 'JPEG', 'PNG', 'WEBP'），失败返回None
    """
    try:
        image = Image.open(io.BytesIO(image_data))
        return image.format
    except Exception as e:
        logger.error(f"获取图片格式失败: {str(e)}")
        return None


def is_format_supported(format_name: str) -> bool:
    """
    检查图片格式是否被腾讯云支持
    
    Args:
        format_name: 图片格式名称
        
    Returns:
        bool: 是否支持
    """
    supported_formats = ['JPEG', 'JPG', 'PNG', 'BMP', 'GIF']
    return format_name.upper() in supported_formats
