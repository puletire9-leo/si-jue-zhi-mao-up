from typing import List, Dict, Any, Optional, Tuple
import os
import asyncio
import logging
from datetime import datetime
from PIL import Image
import io

from ..config import settings
from .local_file_service import local_file_service
from .cos_service import cos_service
from .image_service import ImageService
from ..repositories import MySQLRepository, RedisRepository, QdrantRepository

logger = logging.getLogger(__name__)


class LibraryImageService:
    """
    素材库和载体库图片服务
    
    功能：
    - 读取本地目录中的图片文件
    - 提取图片元数据
    - 生成缩略图
    - 上传到腾讯云COS
    - 保存图片信息到数据库
    """
    
    def __init__(
        self,
        mysql_repo: MySQLRepository,
        redis_repo: Optional[RedisRepository] = None,
        qdrant_repo: Optional[QdrantRepository] = None
    ):
        """
        初始化素材库和载体库图片服务
        
        Args:
            mysql_repo: MySQL仓库
            redis_repo: Redis仓库（可选）
            qdrant_repo: Qdrant仓库（可选）
        """
        self.mysql = mysql_repo
        self.redis = redis_repo
        self.qdrant = qdrant_repo
        self.image_service = ImageService(mysql_repo, redis_repo, qdrant_repo)
    
    async def process_library_images(self, library_type: str) -> Dict[str, Any]:
        """
        处理指定类型库的图片
        
        Args:
            library_type: 库类型，可选值："material"（素材库）或 "carrier"（载体库）
            
        Returns:
            处理结果
        """
        try:
            logger.info(f"开始处理{library_type}库图片")
            
            # 确定目录路径和目标文件夹
            if library_type == "material":
                directory = local_file_service.material_library_dir
                cos_folder = "素材库"
                table_name = "material_library"
                image_type = "material"
            elif library_type == "carrier":
                directory = local_file_service.carrier_library_dir
                cos_folder = "载体库"
                table_name = "carrier_library"
                image_type = "carrier"
            else:
                raise ValueError(f"不支持的库类型: {library_type}")
            
            # 读取目录中的图片文件
            files = await local_file_service.read_directory(directory)
            logger.info(f"找到 {len(files)} 个图片文件")
            
            # 批量处理图片
            results = await self._batch_process_images(
                files=files,
                library_type=library_type,
                cos_folder=cos_folder,
                table_name=table_name,
                image_type=image_type
            )
            
            logger.info(f"{library_type}库图片处理完成")
            return results
            
        except Exception as e:
            logger.error(f"处理{library_type}库图片失败: {str(e)}")
            raise
    
    async def process_all_libraries(self) -> Dict[str, Any]:
        """
        处理所有库的图片
        
        Returns:
            处理结果
        """
        try:
            logger.info("开始处理所有库图片")
            
            # 并行处理素材库和载体库
            tasks = [
                self.process_library_images("material"),
                self.process_library_images("carrier")
            ]
            
            material_result, carrier_result = await asyncio.gather(*tasks)
            
            results = {
                "material_library": material_result,
                "carrier_library": carrier_result,
                "total_processed": material_result.get("processed", 0) + carrier_result.get("processed", 0),
                "total_failed": material_result.get("failed", 0) + carrier_result.get("failed", 0)
            }
            
            logger.info(f"所有库图片处理完成: 总计处理 {results['total_processed']} 个，失败 {results['total_failed']} 个")
            return results
            
        except Exception as e:
            logger.error(f"处理所有库图片失败: {str(e)}")
            raise
    
    async def _batch_process_images(
        self,
        files: List[Dict[str, Any]],
        library_type: str,
        cos_folder: str,
        table_name: str,
        image_type: str
    ) -> Dict[str, Any]:
        """
        批量处理图片
        
        Args:
            files: 图片文件信息列表
            library_type: 库类型
            cos_folder: COS文件夹
            table_name: 数据库表名
            image_type: 图片类型
            
        Returns:
            处理结果
        """
        processed = 0
        failed = 0
        failed_files = []
        successful_files = []
        
        for file_info in files:
            try:
                # 处理单个图片
                result = await self._process_single_image(
                    file_info=file_info,
                    library_type=library_type,
                    cos_folder=cos_folder,
                    table_name=table_name,
                    image_type=image_type
                )
                
                if result["success"]:
                    processed += 1
                    successful_files.append(result)
                else:
                    failed += 1
                    failed_files.append({
                        "filename": file_info.get("filename"),
                        "error": result.get("error")
                    })
                
                # 每处理10个文件暂停一下，避免系统过载
                if processed % 10 == 0:
                    await asyncio.sleep(0.5)
                    
            except Exception as e:
                failed += 1
                failed_files.append({
                    "filename": file_info.get("filename"),
                    "error": str(e)
                })
                logger.error(f"处理图片失败: {file_info.get('filename')}, 错误: {str(e)}")
        
        return {
            "processed": processed,
            "failed": failed,
            "failed_files": failed_files,
            "successful_files": successful_files,
            "total": len(files)
        }
    
    async def _process_single_image(
        self,
        file_info: Dict[str, Any],
        library_type: str,
        cos_folder: str,
        table_name: str,
        image_type: str
    ) -> Dict[str, Any]:
        """
        处理单个图片
        
        Args:
            file_info: 图片文件信息
            library_type: 库类型
            cos_folder: COS文件夹
            table_name: 数据库表名
            image_type: 图片类型
            
        Returns:
            处理结果
        """
        try:
            file_path = file_info.get("file_path")
            filename = file_info.get("filename")
            
            if not file_path or not filename:
                return {
                    "success": False,
                    "error": "文件路径或文件名缺失"
                }
            
            logger.info(f"处理图片: {filename}")
            
            # 生成缩略图
            thumbnail_data = await self._generate_thumbnail(file_path)
            
            # 上传到腾讯云COS
            cos_result = await self._upload_to_cos(
                thumbnail_data=thumbnail_data,
                filename=filename,
                cos_folder=cos_folder,
                image_type=image_type
            )
            
            if not cos_result["success"]:
                return {
                    "success": False,
                    "error": f"上传到COS失败: {cos_result.get('error')}"
                }
            
            # 保存到数据库
            db_result = await self._save_to_database(
                file_info=file_info,
                cos_result=cos_result,
                table_name=table_name,
                library_type=library_type
            )
            
            if not db_result["success"]:
                return {
                    "success": False,
                    "error": f"保存到数据库失败: {db_result.get('error')}"
                }
            
            return {
                "success": True,
                "filename": filename,
                "cos_url": cos_result.get("cos_url"),
                "image_id": db_result.get("image_id")
            }
            
        except Exception as e:
            logger.error(f"处理单个图片失败: {file_info.get('filename')}, 错误: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _generate_thumbnail(self, file_path: str) -> bytes:
        """
        生成缩略图
        
        Args:
            file_path: 图片文件路径
            
        Returns:
            缩略图数据
        """
        try:
            # 读取图片
            with Image.open(file_path) as img:
                # 调整尺寸为512x512（保持宽高比）
                max_size = (512, 512)
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 转换为RGB模式（如果不是）
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # 保存为WebP格式
                thumbnail_buffer = io.BytesIO()
                img.save(thumbnail_buffer, format='WEBP', quality=70, optimize=True)
                thumbnail_data = thumbnail_buffer.getvalue()
                
            logger.debug(f"生成缩略图成功，大小: {len(thumbnail_data)} bytes")
            return thumbnail_data
            
        except Exception as e:
            logger.error(f"生成缩略图失败: {str(e)}")
            raise
    
    async def _upload_to_cos(
        self,
        thumbnail_data: bytes,
        filename: str,
        cos_folder: str,
        image_type: str
    ) -> Dict[str, Any]:
        """
        上传到腾讯云COS
        
        Args:
            thumbnail_data: 缩略图数据
            filename: 文件名
            cos_folder: COS文件夹
            image_type: 图片类型
            
        Returns:
            上传结果
        """
        try:
            if not cos_service.is_enabled():
                return {
                    "success": False,
                    "error": "腾讯云COS未启用"
                }
            
            # 生成唯一文件名
            import uuid
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            random_suffix = str(uuid.uuid4())[:8]
            thumbnail_filename = f"{timestamp}_{random_suffix}.webp"
            
            # 上传缩略图
            success, object_key, cos_url = await cos_service.upload_thumbnail(
                thumbnail_data=thumbnail_data,
                original_filename=thumbnail_filename,
                image_type=image_type
            )
            
            if not success:
                return {
                    "success": False,
                    "error": cos_url  # cos_url 包含错误信息
                }
            
            return {
                "success": True,
                "cos_url": cos_url,
                "object_key": object_key,
                "filename": thumbnail_filename
            }
            
        except Exception as e:
            logger.error(f"上传到COS失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _save_to_database(
        self,
        file_info: Dict[str, Any],
        cos_result: Dict[str, Any],
        table_name: str,
        library_type: str
    ) -> Dict[str, Any]:
        """
        保存到数据库
        
        Args:
            file_info: 图片文件信息
            cos_result: COS上传结果
            table_name: 数据库表名
            library_type: 库类型
            
        Returns:
            保存结果
        """
        try:
            # 构建插入数据
            data = {
                "sku": self._generate_sku(file_info.get("filename"), library_type),
                "batch": datetime.now().strftime("%Y%m%d_%H%M%S"),
                "developer": "system",
                "carrier": library_type,
                "images": cos_result.get("cos_url"),
                "reference_images": "",
                "status": "active",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            # 插入数据
            query = f"""
                INSERT INTO {table_name} (
                    sku, batch, developer, carrier, images, 
                    reference_images, status, created_at, updated_at
                ) VALUES (
                    :sku, :batch, :developer, :carrier, :images, 
                    :reference_images, :status, :created_at, :updated_at
                )
            """
            
            result = await self.mysql.execute_query(
                query=query,
                params=data,
                fetch_one=True
            )
            
            # 获取插入的ID
            image_id = result.get("last_id") if isinstance(result, dict) else result
            
            return {
                "success": True,
                "image_id": image_id
            }
            
        except Exception as e:
            logger.error(f"保存到数据库失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _generate_sku(self, filename: str, library_type: str) -> str:
        """
        生成SKU
        
        Args:
            filename: 文件名
            library_type: 库类型
            
        Returns:
            SKU
        """
        # 移除扩展名
        name_without_ext = os.path.splitext(filename)[0]
        # 生成SKU
        prefix = "MAT" if library_type == "material" else "CAR"
        timestamp = datetime.now().strftime("%Y%m%d")
        # 使用文件名的前10个字符
        name_part = name_without_ext[:10].replace(" ", "_")
        # 生成SKU
        sku = f"{prefix}_{timestamp}_{name_part}"
        return sku
    
    async def get_library_images(
        self,
        library_type: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        获取库中的图片
        
        Args:
            library_type: 库类型
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            图片列表
        """
        try:
            table_name = "material_library" if library_type == "material" else "carrier_library"
            
            query = f"""
                SELECT * FROM {table_name} 
                WHERE status = 'active' 
                ORDER BY created_at DESC 
                LIMIT :limit OFFSET :offset
            """
            
            results = await self.mysql.execute_query(
                query=query,
                params={"limit": limit, "offset": offset}
            )
            
            return results
            
        except Exception as e:
            logger.error(f"获取库图片失败: {str(e)}")
            raise
    
    async def delete_library_image(
        self,
        library_type: str,
        image_id: int
    ) -> bool:
        """
        删除库中的图片
        
        Args:
            library_type: 库类型
            image_id: 图片ID
            
        Returns:
            是否删除成功
        """
        try:
            table_name = "material_library" if library_type == "material" else "carrier_library"
            
            # 更新状态为删除
            query = f"""
                UPDATE {table_name} 
                SET status = 'deleted', updated_at = :updated_at 
                WHERE id = :image_id
            """
            
            result = await self.mysql.execute_query(
                query=query,
                params={"image_id": image_id, "updated_at": datetime.now()}
            )
            
            return result > 0
            
        except Exception as e:
            logger.error(f"删除库图片失败: {str(e)}")
            raise


# 全局库图片服务实例
library_image_service = None

def get_library_image_service(
    mysql_repo: MySQLRepository,
    redis_repo: Optional[RedisRepository] = None,
    qdrant_repo: Optional[QdrantRepository] = None
) -> LibraryImageService:
    """
    获取库图片服务实例
    
    Args:
        mysql_repo: MySQL仓库
        redis_repo: Redis仓库（可选）
        qdrant_repo: Qdrant仓库（可选）
        
    Returns:
        库图片服务实例
    """
    global library_image_service
    if library_image_service is None:
        library_image_service = LibraryImageService(
            mysql_repo=mysql_repo,
            redis_repo=redis_repo,
            qdrant_repo=qdrant_repo
        )
    return library_image_service
