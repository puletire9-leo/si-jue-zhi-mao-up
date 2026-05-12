"""
图片加载工具

提供异步加载图片数据的功能，支持：
- 本地文件路径
- HTTP/HTTPS URL
- 相对路径（自动构造完整URL）
"""

import os
import aiohttp
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def load_image_data(image_url: str) -> Optional[bytes]:
    """
    异步加载图片数据
    
    支持多种图片来源：
    - 本地文件路径
    - HTTP/HTTPS URL
    - 相对路径（自动构造完整URL）
    
    Args:
        image_url: 图片URL或路径
        
    Returns:
        Optional[bytes]: 图片二进制数据，加载失败返回None
    """
    try:
        # 1. 如果是HTTP/HTTPS URL
        if image_url.startswith(('http://', 'https://')):
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        return await response.read()
                    else:
                        logger.error(f"下载图片失败: {image_url}, 状态码: {response.status}")
                        return None
        
        # 2. 如果是相对路径（以/开头）
        elif image_url.startswith('/'):
            # 构造完整URL（使用本地后端服务）
            backend_port = os.getenv('BACKEND_PORT', '8003')
            full_url = f"http://localhost:{backend_port}{image_url}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(full_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        return await response.read()
                    else:
                        logger.error(f"下载图片失败: {full_url}, 状态码: {response.status}")
                        return None
        
        # 3. 如果是本地文件路径
        elif os.path.exists(image_url):
            with open(image_url, 'rb') as f:
                return f.read()
        
        # 4. 无法识别的路径格式
        else:
            logger.error(f"无法识别的图片路径格式: {image_url}")
            return None
            
    except Exception as e:
        logger.error(f"加载图片失败: {image_url}, 错误: {str(e)}")
        return None
