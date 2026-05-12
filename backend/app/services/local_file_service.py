from typing import List, Dict, Optional, Tuple, Any
import os
import asyncio
import logging
from datetime import datetime
from PIL import Image
import hashlib

from ..config import settings

logger = logging.getLogger(__name__)


class LocalFileService:
    """
    本地文件服务
    
    功能：
    - 从指定目录读取图片文件
    - 批量处理图片文件
    - 提取图片信息
    - 生成缩略图
    """
    
    def __init__(self):
        """
        初始化本地文件服务
        """
        self.material_library_dir = r"e:\项目\开发\1\主系统-mysql\development\database\assets\素材库"
        self.carrier_library_dir = r"e:\项目\开发\1\主系统-mysql\development\database\assets\载体库"
        self.supported_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
        
        # 确保目录存在
        self._ensure_directories_exist()
    
    def _ensure_directories_exist(self):
        """
        确保必要的目录存在
        """
        try:
            os.makedirs(self.material_library_dir, exist_ok=True)
            os.makedirs(self.carrier_library_dir, exist_ok=True)
            logger.info(f"确保目录存在成功 - 素材库目录: {self.material_library_dir}")
            logger.info(f"确保目录存在成功 - 载体库目录: {self.carrier_library_dir}")
        except Exception as e:
            logger.error(f"确保目录存在失败: {str(e)}")
    
    async def read_directory(self, directory: str) -> List[Dict[str, Any]]:
        """
        读取指定目录中的图片文件
        
        Args:
            directory: 要读取的目录路径
            
        Returns:
            图片文件信息列表
        """
        try:
            logger.info(f"开始读取目录: {directory}")
            files = []
            
            if not os.path.exists(directory):
                logger.warning(f"目录不存在: {directory}")
                return files
            
            if not os.path.isdir(directory):
                logger.warning(f"路径不是目录: {directory}")
                return files
            
            # 异步读取目录
            loop = asyncio.get_event_loop()
            entries = await loop.run_in_executor(None, os.scandir, directory)
            
            for entry in entries:
                if entry.is_file():
                    file_ext = os.path.splitext(entry.name)[1].lower()
                    if file_ext in self.supported_extensions:
                        file_info = await self._get_file_info(entry.path)
                        files.append(file_info)
            
            logger.info(f"读取目录完成 - 找到 {len(files)} 个图片文件")
            return files
        except Exception as e:
            logger.error(f"读取目录失败: {str(e)}")
            return []
    
    async def _get_file_info(self, file_path: str) -> Dict[str, Any]:
        """
        获取文件信息
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件信息字典
        """
        try:
            # 获取文件基本信息
            stat = os.stat(file_path)
            file_size = stat.st_size
            modification_time = datetime.fromtimestamp(stat.st_mtime)
            
            # 获取文件名和扩展名
            filename = os.path.basename(file_path)
            name_without_ext, ext = os.path.splitext(filename)
            
            # 获取图片属性信息
            image_info = await self._get_image_info(file_path)
            
            # 计算文件MD5
            md5_hash = await self._calculate_md5(file_path)
            
            return {
                "file_path": file_path,
                "filename": filename,
                "name_without_ext": name_without_ext,
                "extension": ext.lower(),
                "file_size": file_size,
                "file_size_formatted": self._format_file_size(file_size),
                "modification_time": modification_time,
                "modification_time_formatted": modification_time.strftime("%Y-%m-%d %H:%M:%S"),
                "md5": md5_hash,
                **image_info
            }
        except Exception as e:
            logger.error(f"获取文件信息失败: {file_path}, 错误: {str(e)}")
            return {
                "file_path": file_path,
                "filename": os.path.basename(file_path),
                "error": str(e)
            }
    
    async def _get_image_info(self, file_path: str) -> Dict[str, Any]:
        """
        获取图片属性信息
        
        Args:
            file_path: 图片文件路径
            
        Returns:
            图片属性信息字典
        """
        try:
            loop = asyncio.get_event_loop()
            
            def get_image_data():
                with Image.open(file_path) as img:
                    width, height = img.size
                    mode = img.mode
                    format = img.format
                    
                    # 尝试获取分辨率
                    dpi = img.info.get('dpi', (72, 72))
                    
                    return {
                        "width": width,
                        "height": height,
                        "mode": mode,
                        "format": format,
                        "dpi": dpi,
                        "resolution": f"{dpi[0]}x{dpi[1]}"
                    }
            
            return await loop.run_in_executor(None, get_image_data)
        except Exception as e:
            logger.error(f"获取图片信息失败: {file_path}, 错误: {str(e)}")
            return {
                "width": 0,
                "height": 0,
                "mode": "unknown",
                "format": "unknown",
                "dpi": (72, 72),
                "resolution": "72x72"
            }
    
    async def _calculate_md5(self, file_path: str) -> str:
        """
        计算文件MD5值
        
        Args:
            file_path: 文件路径
            
        Returns:
            MD5哈希值
        """
        try:
            loop = asyncio.get_event_loop()
            
            def calculate_md5():
                md5_hash = hashlib.md5()
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(4096), b"" ):
                        md5_hash.update(chunk)
                return md5_hash.hexdigest()
            
            return await loop.run_in_executor(None, calculate_md5)
        except Exception as e:
            logger.error(f"计算MD5失败: {file_path}, 错误: {str(e)}")
            return ""
    
    def _format_file_size(self, size: int) -> str:
        """
        格式化文件大小
        
        Args:
            size: 文件大小（字节）
            
        Returns:
            格式化后的文件大小
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} TB"
    
    async def batch_read_directories(self, directories: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """
        批量读取多个目录
        
        Args:
            directories: 目录路径列表
            
        Returns:
            每个目录的图片文件信息列表
        """
        try:
            logger.info(f"开始批量读取目录: {directories}")
            results = {}
            
            # 并行读取多个目录
            tasks = [self.read_directory(directory) for directory in directories]
            directory_files = await asyncio.gather(*tasks)
            
            for directory, files in zip(directories, directory_files):
                results[directory] = files
            
            logger.info(f"批量读取目录完成")
            return results
        except Exception as e:
            logger.error(f"批量读取目录失败: {str(e)}")
            return {}
    
    async def read_material_library(self) -> List[Dict[str, Any]]:
        """
        读取素材库目录
        
        Returns:
            素材库图片文件信息列表
        """
        return await self.read_directory(self.material_library_dir)
    
    async def read_carrier_library(self) -> List[Dict[str, Any]]:
        """
        读取载体库目录
        
        Returns:
            载体库图片文件信息列表
        """
        return await self.read_directory(self.carrier_library_dir)
    
    async def read_all_libraries(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        读取所有库目录
        
        Returns:
            所有库的图片文件信息列表
        """
        return await self.batch_read_directories([self.material_library_dir, self.carrier_library_dir])


# 全局本地文件服务实例
local_file_service = LocalFileService()
