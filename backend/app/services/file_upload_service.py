import os
import uuid
import hashlib
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import UploadFile, HTTPException
import shutil

from ..models.file_link import FileUploadResponse
from .file_link_service import FileLinkService
from ..repositories.mysql_repo import get_mysql_repo

logger = logging.getLogger(__name__)


class FileUploadService:
    """文件上传服务类"""
    
    def __init__(self, upload_dir: str = "uploads", file_link_service: FileLinkService = None):
        self.upload_dir = upload_dir
        self.file_link_service = file_link_service
        
        # 确保上传目录存在
        os.makedirs(self.upload_dir, exist_ok=True)
    
    async def upload_file(
        self, 
        file: UploadFile, 
        title: str,
        library_type: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None
    ) -> FileUploadResponse:
        """
        上传文件
        
        Args:
            file: 上传的文件
            title: 文件标题
            library_type: 所属库类型
            description: 文件描述（可选）
            tags: 标签列表（可选）
            category: 分类（可选）
            
        Returns:
            文件上传响应
        """
        try:
            # 验证文件类型
            self._validate_file_type(file.filename)
            
            # 生成唯一文件名（与COS一致的格式）
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name, ext = os.path.splitext(file.filename)
            unique_filename = f"{timestamp}_{hashlib.md5(name.encode()).hexdigest()[:8]}{ext}"
            file_path = os.path.join(self.upload_dir, unique_filename)
            
            # 保存文件
            file_size = await self._save_file(file, file_path)
            
            # 创建文件链接记录
            file_url = f"/uploads/{unique_filename}"
            
            # 使用FileLinkService创建记录
            from ..models.file_link import FileLinkCreate, FileLinkType
            
            file_link = FileLinkCreate(
                title=title,
                url=file_url,
                link_type=FileLinkType.STANDARD_URL,
                description=description,
                tags=tags,
                category=category,
                library_type=library_type
            )
            
            link_id = await self.file_link_service.create_file_link(file_link)
            
            return FileUploadResponse(
                id=link_id,
                filename=file.filename,
                file_url=file_url,
                file_size=file_size,
                upload_time=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"文件上传失败: {e}")
            raise HTTPException(status_code=500, detail=f"文件上传失败: {e}")
    
    async def upload_multiple_files(
        self, 
        files: List[UploadFile],
        library_type: str,
        category: Optional[str] = None
    ) -> List[FileUploadResponse]:
        """
        批量上传文件
        
        Args:
            files: 上传的文件列表
            library_type: 所属库类型
            category: 分类（可选）
            
        Returns:
            文件上传响应列表
        """
        results = []
        
        for file in files:
            try:
                # 使用文件名作为标题
                title = os.path.splitext(file.filename)[0]
                
                result = await self.upload_file(
                    file=file,
                    title=title,
                    library_type=library_type,
                    category=category
                )
                results.append(result)
                
            except Exception as e:
                logger.error(f"文件 {file.filename} 上传失败: {e}")
                # 继续处理其他文件
                continue
        
        return results
    
    async def delete_uploaded_file(self, file_url: str) -> bool:
        """
        删除已上传的文件
        
        Args:
            file_url: 文件URL
            
        Returns:
            是否删除成功
        """
        try:
            # 从URL中提取文件名
            filename = file_url.replace("/uploads/", "")
            file_path = os.path.join(self.upload_dir, filename)
            
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            else:
                logger.warning(f"文件不存在: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"删除文件失败: {e}")
            return False
    
    def _validate_file_type(self, filename: str):
        """验证文件类型"""
        allowed_extensions = {
            '.xlsx', '.xls', '.csv',  # Excel文件
            '.pdf', '.doc', '.docx',  # 文档文件
            '.txt', '.md',  # 文本文件
            '.jpg', '.jpeg', '.png', '.gif',  # 图片文件
            '.zip', '.rar', '.7z'  # 压缩文件
        }
        
        file_extension = os.path.splitext(filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的文件类型: {file_extension}"
            )
    
    async def _save_file(self, file: UploadFile, file_path: str) -> int:
        """保存文件到磁盘"""
        try:
            # 读取文件内容
            content = await file.read()
            file_size = len(content)
            
            # 验证文件大小（最大100MB）
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                raise HTTPException(
                    status_code=400, 
                    detail=f"文件大小超过限制: {file_size} > {max_size}"
                )
            
            # 写入文件
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            return file_size
            
        except Exception as e:
            # 如果保存失败，删除可能已创建的文件
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e
    
    def get_upload_stats(self) -> Dict[str, Any]:
        """获取上传统计信息"""
        try:
            if not os.path.exists(self.upload_dir):
                return {
                    "total_files": 0,
                    "total_size": 0,
                    "last_upload": None
                }
            
            total_files = 0
            total_size = 0
            last_upload = None
            
            for filename in os.listdir(self.upload_dir):
                file_path = os.path.join(self.upload_dir, filename)
                if os.path.isfile(file_path):
                    total_files += 1
                    total_size += os.path.getsize(file_path)
                    
                    # 获取最后修改时间
                    mtime = os.path.getmtime(file_path)
                    if last_upload is None or mtime > last_upload:
                        last_upload = mtime
            
            return {
                "total_files": total_files,
                "total_size": total_size,
                "last_upload": datetime.fromtimestamp(last_upload) if last_upload else None
            }
            
        except Exception as e:
            logger.error(f"获取上传统计失败: {e}")
            return {
                "total_files": 0,
                "total_size": 0,
                "last_upload": None
            }


# 全局FileUploadService实例
_file_upload_service_instance = None


async def get_file_upload_service() -> FileUploadService:
    """
    获取FileUploadService实例（单例模式）
    
    Returns:
        FileUploadService实例
    """
    global _file_upload_service_instance
    
    if _file_upload_service_instance is None:
        mysql_repo = await get_mysql_repo()
        file_link_service = FileLinkService(mysql_repo)
        _file_upload_service_instance = FileUploadService(file_link_service=file_link_service)
    
    return _file_upload_service_instance