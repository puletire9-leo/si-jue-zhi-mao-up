from typing import Optional, List, Dict, Any
from PIL import Image
import numpy as np
import os
import io
import logging
from datetime import datetime

from ..repositories import MySQLRepository, RedisRepository, QdrantRepository
from ..config import settings
from .cos_service import cos_service

logger = logging.getLogger(__name__)


class ImageService:
    """
    图片服务
    
    功能：
    - 图片上传和管理
    - 图片元数据存储
    - 图片缩略图生成
    - 图片向量提取和存储
    - 图片搜索（基于向量）
    - 缓存管理
    
    使用场景：
    - 图片上传接口
    - 图片搜索接口
    - 图片管理接口
    """
    
    def __init__(
        self,
        mysql_repo: MySQLRepository,
        redis_repo: Optional[RedisRepository],
        qdrant_repo: Optional[QdrantRepository]
    ):
        """
        初始化图片服务
        
        Args:
            mysql_repo: MySQL仓库
            redis_repo: Redis仓库（可选）
            qdrant_repo: Qdrant仓库（可选）
        """
        self.mysql = mysql_repo
        self.redis = redis_repo
        self.qdrant = qdrant_repo
    
    async def upload_image(
        self,
        filename: str,
        filepath: str,
        category: str,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        image_type: str = "product",
        sku: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        上传图片
        
        Args:
            filename: 文件名
            filepath: 文件路径
            category: 图片分类
            tags: 图片标签列表
            description: 图片描述
            
        Returns:
            上传结果
        """
        try:
            # 读取图片数据
            with open(filepath, 'rb') as f:
                image_data = f.read()
            
            # 获取系统配置中的最大图片尺寸
            try:
                # 首先尝试从数据库获取配置
                config_query = "SELECT config_value FROM system_config WHERE config_key = 'max_image_size'"
                config_result = await self.mysql.execute_query(config_query, fetch_one=True)
                
                if config_result:
                    max_size_mb = int(config_result['config_value'])
                    max_size = max_size_mb * 1024 * 1024
                else:
                    # 如果数据库中没有配置，使用默认值
                    max_size = settings.MAX_UPLOAD_SIZE
            except Exception as e:
                logger.warning(f"获取图片大小配置失败，使用默认值: {e}")
                max_size = settings.MAX_UPLOAD_SIZE
            
            if len(image_data) > max_size:
                raise ValueError(f"图片大小超过限制：{len(image_data) // 1024 // 1024}MB > {max_size // 1024 // 1024}MB")
            
            # 获取原始图片元数据
            original_file_size = len(image_data)
            original_filename = filename
            original_width, original_height = 0, 0
            original_format = 'unknown'
            original_quality = None
            
            try:
                from PIL import Image
                import io
                import os
                
                # 加载原始图片获取元数据
                with Image.open(io.BytesIO(image_data)) as original_img:
                    original_width, original_height = original_img.size
                    original_format = original_img.format.lower() if original_img.format else 'unknown'
                    
                    # 尝试获取原始图片质量（如果可能）
                    if hasattr(original_img, 'info') and 'quality' in original_img.info:
                        original_quality = original_img.info['quality']
                        
                logger.info(f"[OK] 原始图片元数据 | 大小: {original_file_size} bytes | 尺寸: {original_width}x{original_height} | 格式: {original_format}")
            except Exception as e:
                logger.warning(f"[WARN] 获取原始图片元数据失败 | 错误: {e}")
            
            # 生成处理后的WebP图片（1920x1920尺寸，用于日常访问）
            try:
                # 加载图片
                img = Image.open(io.BytesIO(image_data))
                
                # 调整尺寸为1920x1920（保持宽高比）
                max_size = (1920, 1920)
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 转换为RGB模式（如果不是）
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # 保存为WebP格式
                processed_buffer = io.BytesIO()
                img.save(processed_buffer, format='WEBP', quality=80, optimize=True)
                processed_data = processed_buffer.getvalue()
                
                # 生成处理后的文件名
                processed_filename = f"{os.path.splitext(filename)[0]}.webp"
                processed_format = 'webp'
                
                # 读取处理后图片的尺寸
                width, height = img.size
                format = processed_format
                
                logger.info(f"[OK] 处理后的WebP图片 | 大小: {len(processed_data)} bytes | 尺寸: {width}x{height} | 格式: {processed_format}")
            except Exception as e:
                logger.warning(f"[WARN] 生成处理后的WebP图片失败，使用原始图片 | 错误: {e}")
                processed_data, processed_filename, processed_format = image_data, filename, original_format
                width, height = original_width, original_height
                format = original_format
            
            # 上传处理后的图片到腾讯云COS（如果COS启用）
            cos_object_key = ""
            cos_url = ""
            local_filepath = filepath
            
            if cos_service.is_enabled():
                try:
                    # 根据图片类型选择上传路径
                    # "final" -> 定稿图文件夹, "material" -> 素材库文件夹
                    upload_image_type = "material" if image_type == "material" else "final"
                    
                    # 上传处理后的图片到COS
                    success, cos_object_key, cos_url = await cos_service.upload_processed_image(
                        processed_data, processed_filename, image_type=upload_image_type
                    )
                    if success:
                        logger.info(f"[OK] 处理后的图片已上传到腾讯云COS | 类型: {upload_image_type} | 文件: {processed_filename} | URL: {cos_url}")
                    else:
                        logger.warning(f"[WARN] 处理后的图片COS上传失败 | 文件: {processed_filename}")
                except Exception as e:
                    logger.warning(f"[WARN] 上传处理后的图片到COS失败 | 错误: {e}")
            
            # 创建并上传原始图片zip包（如果COS启用）
            original_zip_filepath = None
            original_zip_cos_key = None
            
            if cos_service.is_enabled():
                try:
                    # 创建原始图片zip包（使用无损压缩）
                    import zipfile
                    zip_buffer = io.BytesIO()
                    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zip_file:
                        zip_file.writestr(original_filename, image_data)
                    zip_data = zip_buffer.getvalue()
                    
                    # 上传zip包到COS
                    success, zip_object_key, zip_url = await cos_service.upload_original_zip(
                        zip_data, original_filename
                    )
                    if success:
                        original_zip_filepath = zip_url
                        original_zip_cos_key = zip_object_key
                        logger.info(f"[OK] 原始图片zip包已上传到腾讯云COS | 对象键: {zip_object_key}")
                    else:
                        logger.warning(f"[WARN] 原始图片zip包COS上传失败")
                except Exception as e:
                    logger.warning(f"[WARN] 创建或上传原始图片zip包失败 | 错误: {e}")
            
            # 存储到MySQL
            result = await self.mysql.create_image(
                filename=original_filename,
                filepath=local_filepath,
                file_size=original_file_size,
                width=original_width,
                height=original_height,
                format=original_format,
                category=category,
                tags=','.join(tags) if tags else None,
                description=description,
                cos_object_key=cos_object_key,
                cos_url=cos_url,
                original_file_size=original_file_size,
                original_format=original_format,
                original_width=original_width,
                original_height=original_height,
                original_filename=original_filename,
                original_quality=original_quality,
                original_zip_filepath=original_zip_filepath,
                original_zip_cos_key=original_zip_cos_key,
                sku=sku
            )
            
            # 根据返回值类型确定image_id
            if isinstance(result, dict) and 'last_id' in result:
                image_id = result['last_id']
            else:
                image_id = result
            
            logger.info(f"[OK] 图片上传成功 | ID: {image_id} | 文件: {processed_filename}")
            
            # 生成缩略图
            await self._generate_thumbnail(filepath, image_id, image_type=image_type)
            
            # 提取并存储向量（如果Qdrant可用）
            if self.qdrant:
                await self._extract_and_store_vector(filepath, image_id, category, tags)
            
            # 清除相关缓存
            if self.redis:
                await self._clear_image_cache(category)

            # COS上传成功后清理本地临时文件
            if cos_url and os.path.exists(local_filepath):
                try:
                    os.remove(local_filepath)
                    logger.info(f"[OK] 本地临时文件已清理 | 文件: {local_filepath}")
                except Exception as e:
                    logger.warning(f"[WARN] 清理本地临时文件失败 | 文件: {local_filepath} | 错误: {e}")

            return {
                "success": True,
                "image_id": image_id,
                "filename": original_filename,
                "cos_url": cos_url,
                "message": "图片上传成功"
            }
            
        except Exception as e:
            logger.error(f"[FAIL] 图片上传失败 | 文件: {filename} | 错误: {e}")
            raise
    
    async def _generate_thumbnail(self, filepath: str, image_id: int, image_type: str = "product"):
        """
        生成单一尺寸缩略图（512x512）并上传到COS（如果启用）
        
        Args:
            filepath: 原始图片路径
            image_id: 图片ID
            image_type: 图片类型: "product"(产品图), "selection"(选品图), "final"(定稿图)
        """
        try:
            from PIL import Image
            import io
            import os
            
            logger.info(f"[SYNC] 开始生成缩略图 | ID: {image_id} | 原始路径: {filepath} | 图片类型: {image_type}")
            
            # 读取图片数据
            try:
                with open(filepath, 'rb') as f:
                    image_data = f.read()
                logger.info(f"[OK] 成功读取图片数据 | ID: {image_id} | 数据大小: {len(image_data)} bytes")
            except Exception as e:
                logger.error(f"[FAIL] 读取图片数据失败 | ID: {image_id} | 错误: {e}")
                raise
            
            # 生成单一尺寸缩略图（512x512）
            thumbnail_sizes = [(512, 512)]
            
            for width, height in thumbnail_sizes:
                try:
                    logger.info(f"[SYNC] 开始处理缩略图尺寸 | ID: {image_id} | 尺寸: {width}x{height}")
                    
                    # 加载图片
                    img = Image.open(io.BytesIO(image_data))
                    original_width, original_height = img.size
                    logger.info(f"[OK] 成功加载图片 | ID: {image_id} | 原始尺寸: {original_width}x{original_height} | 模式: {img.mode}")
                    
                    # 生成缩略图
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                    new_width, new_height = img.size
                    logger.info(f"[OK] 成功生成缩略图 | ID: {image_id} | 新尺寸: {new_width}x{new_height}")
                    
                    # 转换为RGB模式（如果不是）
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                        logger.info(f"[OK] 成功转换图片模式 | ID: {image_id} | 新模式: {img.mode}")
                    
                    # 保存为WebP格式
                    thumbnail_buffer = io.BytesIO()
                    img.save(thumbnail_buffer, format='WEBP', quality=70, optimize=True)
                    thumbnail_data = thumbnail_buffer.getvalue()
                    logger.info(f"[OK] 成功保存为WebP格式 | ID: {image_id} | 缩略图大小: {len(thumbnail_data)} bytes")
                    
                    # 生成基于时间戳的缩略图文件名
                    import datetime
                    import uuid
                    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
                    random_suffix = str(uuid.uuid4())[:8]
                    thumbnail_filename = f"{timestamp}_{random_suffix}.webp"
                    logger.info(f"[OK] 生成缩略图文件名 | ID: {image_id} | 文件名: {thumbnail_filename}")
                    
                    # 保存到本地存储目录（约定命名：{image_id}.webp，无需DB列）
                    from ..config import settings
                    local_thumbnail_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, f"{image_id}.webp")
                    os.makedirs(settings.LOCAL_THUMBNAIL_DIR, exist_ok=True)
                    with open(local_thumbnail_path, 'wb') as f:
                        f.write(thumbnail_data)
                    logger.info(f"[OK] 缩略图已保存到本地 | ID: {image_id} | 路径: {local_thumbnail_path}")

                    # 如果COS启用，上传缩略图到COS
                    thumbnail_cos_key = None
                    thumbnail_cos_url = None

                    if cos_service.is_enabled():
                        logger.info(f"[SYNC] 开始上传到COS | ID: {image_id} | 文件名: {thumbnail_filename}")
                        success, thumbnail_cos_key, thumbnail_cos_url = await cos_service.upload_thumbnail(
                            thumbnail_data, thumbnail_filename, image_type=image_type
                        )

                        if success:
                            logger.info(f"[OK] 缩略图已上传到腾讯云COS | ID: {image_id} | URL: {thumbnail_cos_url}")
                        else:
                            logger.warning(f"[WARN] 缩略图COS上传失败 | ID: {image_id}")
                    else:
                        logger.info(f"[INFO] COS未启用，跳过上传 | ID: {image_id}")

                    # 将缩略图COS信息写入已有列 cos_thumbnail_key / cos_thumbnail_url
                    try:
                        await self.mysql.update_image_thumbnail(
                            image_id=image_id,
                            thumbnail_cos_key=thumbnail_cos_key or '',
                            thumbnail_cos_url=thumbnail_cos_url or ''
                        )
                        logger.info(f"[OK] 缩略图COS信息已写入DB | ID: {image_id} | COS: {thumbnail_cos_url or '无'}")
                    except Exception as e:
                        logger.warning(f"[WARN] 缩略图COS信息写入DB失败 | ID: {image_id} | 错误: {e}")

                except Exception as e:
                    logger.warning(f"[WARN] 生成缩略图失败 | ID: {image_id} | 尺寸: {width}x{height} | 错误: {e}")

            logger.info(f"[OK] 缩略图生成成功 | ID: {image_id}")
            
        except Exception as e:
            logger.warning(f"[WARN] 缩略图生成失败 | ID: {image_id} | 错误: {e}")
    
    async def _extract_and_store_vector(
        self,
        filepath: str,
        image_id: int,
        category: str,
        tags: Optional[List[str]]
    ):
        """
        提取并存储图片向量
        
        Args:
            filepath: 图片路径
            image_id: 图片ID
            category: 图片分类
            tags: 图片标签
        """
        try:
            # 这里应该使用实际的向量提取模型
            # 目前使用随机向量作为示例
            vector = np.random.rand(settings.QDRANT_VECTOR_SIZE).tolist()
            
            # 存储到Qdrant
            await self.qdrant.insert_point(
                point_id=image_id,
                vector=vector,
                payload={
                    "category": category,
                    "tags": tags or [],
                    "image_id": image_id
                }
            )
            
            logger.debug(f"[OK] 向量存储成功 | ID: {image_id}")
            
        except Exception as e:
            logger.warning(f"[WARN] 向量存储失败 | ID: {image_id} | 错误: {e}")
    
    async def get_image(self, image_id: int) -> Optional[Dict[str, Any]]:
        """
        获取图片信息
        
        Args:
            image_id: 图片ID
            
        Returns:
            图片信息
        """
        try:
            # 检查缓存
            cache_key = f"image:{image_id}"
            if self.redis:
                cached = await self.redis.cache_get(cache_key)
                if cached:
                    logger.debug(f"[OK] 从缓存获取图片 | ID: {image_id}")
                    return cached
            
            # 从数据库获取
            image = await self.mysql.get_image_by_id(image_id)
            
            if image:
                # 存入缓存
                if self.redis:
                    await self.redis.cache_set(cache_key, image, expire=settings.CACHE_TTL)
                
                logger.debug(f"[OK] 获取图片成功 | ID: {image_id}")
                return image
            
            return None
            
        except Exception as e:
            logger.error(f"[FAIL] 获取图片失败 | ID: {image_id} | 错误: {e}")
            raise
    
    async def search_images(
        self,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        搜索图片
        
        Args:
            keyword: 搜索关键词
            category: 图片分类
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            图片列表
        """
        try:
            # 检查缓存
            cache_key = f"search:{keyword}:{category}:{limit}:{offset}"
            if self.redis:
                cached = await self.redis.cache_get(cache_key)
                if cached:
                    logger.debug(f"[OK] 从缓存获取搜索结果")
                    return cached
            
            # 执行搜索
            if keyword:
                images = await self.mysql.search_images(keyword, limit, offset)
            elif category:
                images = await self.mysql.get_images_by_category(category, limit, offset)
            else:
                images = []
            
            # 存入缓存
            if self.redis:
                await self.redis.cache_set(cache_key, images, expire=settings.SEARCH_CACHE_TTL)
            
            logger.debug(f"[OK] 搜索图片完成 | 结果数: {len(images)}")
            return images
            
        except Exception as e:
            logger.error(f"[FAIL] 搜索图片失败 | 错误: {e}")
            raise
    
    async def get_all_product_images(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        获取所有产品图片列表（支持COS URL）
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            产品图片列表
        """
        try:
            # 检查缓存
            cache_key = f"product_images:{limit}:{offset}"
            if self.redis:
                cached = await self.redis.cache_get(cache_key)
                if cached:
                    logger.debug(f"[OK] 从缓存获取产品图片列表")
                    return cached
            
            # 获取产品图片列表
            images = await self.mysql.get_all_product_images(limit, offset)
            
            # 存入缓存
            if self.redis:
                await self.redis.cache_set(cache_key, images, expire=settings.PRODUCT_IMAGES_CACHE_TTL)
            
            logger.debug(f"[OK] 获取产品图片列表完成 | 结果数: {len(images)}")
            return images
            
        except Exception as e:
            logger.error(f"[FAIL] 获取产品图片列表失败 | 错误: {e}")
            raise
    
    async def search_similar_images(
        self,
        image_id: int,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        搜索相似图片（基于向量）
        
        Args:
            image_id: 参考图片ID
            limit: 返回数量限制
            
        Returns:
            相似图片列表
        """
        try:
            if not self.qdrant:
                logger.warning("[WARN] Qdrant不可用，无法执行向量搜索")
                return []
            
            # 获取参考图片的向量
            point = await self.qdrant.get_point(image_id)
            if not point:
                logger.warning(f"[WARN] 未找到图片向量 | ID: {image_id}")
                return []
            
            # 执行相似性搜索
            results = await self.qdrant.search(
                query_vector=point['vector'],
                limit=limit + 1,  # +1 因为结果包含自己
                score_threshold=0.7
            )
            
            # 过滤掉自己
            similar_images = [
                result for result in results
                if result['id'] != image_id
            ]
            
            # 获取图片详细信息
            image_ids = [result['id'] for result in similar_images]
            images = []
            for img_id in image_ids:
                image = await self.get_image(img_id)
                if image:
                    # 添加相似度分数
                    result = next(r for r in similar_images if r['id'] == img_id)
                    image['similarity'] = result['score']
                    images.append(image)
            
            logger.debug(f"[OK] 相似图片搜索完成 | 结果数: {len(images)}")
            return images
            
        except Exception as e:
            logger.error(f"[FAIL] 相似图片搜索失败 | ID: {image_id} | 错误: {e}")
            raise

    async def search_similar_by_file(
        self,
        filepath: str,
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        基于上传的图片文件搜索相似图片（以图搜图）
        
        Args:
            filepath: 上传的图片文件路径
            limit: 返回数量限制
            category: 可选的分类过滤
            
        Returns:
            相似图片列表
        """
        try:
            if not self.qdrant:
                logger.warning("[WARN] Qdrant不可用，无法执行向量搜索")
                return []
            
            # 提取上传图片的向量
            vector = await self._extract_vector_from_file(filepath)
            
            if not vector:
                logger.warning("[WARN] 无法提取图片向量")
                return []
            
            # 构建过滤条件
            filter_condition = None
            if category:
                filter_condition = {
                    "must": [
                        {
                            "key": "category",
                            "match": {"value": category}
                        }
                    ]
                }
            
            # 执行相似性搜索
            results = await self.qdrant.search(
                query_vector=vector,
                limit=limit,
                score_threshold=0.7,
                query_filter=filter_condition
            )
            
            # 获取图片详细信息
            image_ids = [result['id'] for result in results]
            images = []
            for img_id in image_ids:
                image = await self.get_image(img_id)
                if image:
                    # 添加相似度分数
                    result = next(r for r in results if r['id'] == img_id)
                    image['similarity'] = result['score']
                    images.append(image)
            
            logger.debug(f"[OK] 以图搜图完成 | 结果数: {len(images)}")
            return images
            
        except Exception as e:
            logger.error(f"[FAIL] 以图搜图失败 | 错误: {e}")
            raise

    async def _extract_vector_from_file(self, filepath: str) -> Optional[List[float]]:
        """
        从图片文件提取向量
        
        Args:
            filepath: 图片文件路径
            
        Returns:
            图片向量
        """
        try:
            # 这里应该使用实际的向量提取模型
            # 目前使用随机向量作为示例
            vector = np.random.rand(settings.QDRANT_VECTOR_SIZE).tolist()
            return vector
            
        except Exception as e:
            logger.error(f"[FAIL] 向量提取失败 | 文件: {filepath} | 错误: {e}")
            return None
    
    async def update_image(
        self,
        image_id: int,
        **kwargs
    ) -> bool:
        """
        更新图片信息
        
        Args:
            image_id: 图片ID
            **kwargs: 要更新的字段
            
        Returns:
            是否更新成功
        """
        try:
            # 更新数据库
            affected_rows = await self.mysql.update_image(image_id, **kwargs)
            
            if affected_rows > 0:
                # 清除缓存
                cache_key = f"image:{image_id}"
                if self.redis:
                    await self.redis.cache_delete(cache_key)
                
                # 清除搜索缓存
                await self._clear_image_cache()
                
                logger.info(f"[OK] 图片更新成功 | ID: {image_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"[FAIL] 图片更新失败 | ID: {image_id} | 错误: {e}")
            raise
    
    async def delete_image(self, image_id: int) -> bool:
        """
        删除图片
        
        Args:
            image_id: 图片ID
            
        Returns:
            是否删除成功
        """
        try:
            # 获取图片信息
            image = await self.mysql.get_image_by_id(image_id)
            if not image:
                return False
            
            # 删除文件
            try:
                if os.path.exists(image['filepath']):
                    os.remove(image['filepath'])
                
                thumbnail_path = os.path.join(settings.THUMBNAIL_DIR, f"{image_id}.jpg")
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
            except Exception as e:
                logger.warning(f"[WARN] 文件删除失败 | ID: {image_id} | 错误: {e}")
            
            # 删除数据库记录
            await self.mysql.delete_image(image_id)
            
            # 删除向量
            if self.qdrant:
                await self.qdrant.delete_point(image_id)
            
            # 清除缓存
            cache_key = f"image:{image_id}"
            if self.redis:
                await self.redis.cache_delete(cache_key)
            
            # 清除搜索缓存
            await self._clear_image_cache(image.get('category'))
            
            logger.info(f"[OK] 图片删除成功 | ID: {image_id}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 图片删除失败 | ID: {image_id} | 错误: {e}")
            raise
    
    async def get_image_count(self, category: Optional[str] = None) -> int:
        """
        获取图片数量
        
        Args:
            category: 图片分类（可选）
            
        Returns:
            图片数量
        """
        try:
            return await self.mysql.get_image_count(category)
        except Exception as e:
            logger.error(f"[FAIL] 获取图片数量失败 | 错误: {e}")
            raise
    
    async def _clear_image_cache(self, category: Optional[str] = None):
        """
        清除图片相关缓存
        
        Args:
            category: 图片分类（可选）
        """
        try:
            if not self.redis:
                return
            
            # 清除图片缓存
            await self.redis.cache_clear("image:*")
            
            # 清除搜索缓存
            if category:
                pattern = f"search:*:{category}:*"
            else:
                pattern = "search:*"
            
            await self.redis.cache_clear(pattern)
            
            logger.debug(f"[OK] 缓存清除成功 | 分类: {category or '全部'}")
            
        except Exception as e:
            logger.warning(f"[WARN] 缓存清除失败 | 错误: {e}")

    async def batch_upload_images(
        self,
        files: List[tuple],
        category: str,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        image_type: str = "product",
        sku: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        批量上传图片
        
        Args:
            files: 文件列表，每个元素为(filename, filepath)的元组
            category: 图片分类
            tags: 图片标签列表
            description: 图片描述
            image_type: 图片类型: "product"(产品图), "selection"(选品图), "final"(定稿图)
            
        Returns:
            上传结果，包含成功和失败的图片信息
        """
        results = {
            "success": [],
            "failed": [],
            "total": len(files),
            "success_count": 0,
            "failed_count": 0
        }
        
        for filename, filepath in files:
            try:
                result = await self.upload_image(
                    filename=filename,
                    filepath=filepath,
                    category=category,
                    tags=tags,
                    description=description,
                    image_type=image_type,
                    sku=sku
                )
                results["success"].append({
                    "filename": filename,
                    "image_id": result["image_id"],
                    "message": result["message"],
                    "cos_url": result.get("cos_url", "")
                })
                results["success_count"] += 1
                
            except Exception as e:
                logger.error(f"[FAIL] 批量上传失败 | 文件: {filename} | 错误: {e}")
                results["failed"].append({
                    "filename": filename,
                    "error": str(e)
                })
                results["failed_count"] += 1
        
        logger.info(f"[OK] 批量上传完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}")
        return results

    async def batch_delete_images(self, image_ids: List[int]) -> Dict[str, Any]:
        """
        批量删除图片
        
        Args:
            image_ids: 图片ID列表
            
        Returns:
            删除结果，包含成功和失败的图片ID
        """
        results = {
            "success": [],
            "failed": [],
            "total": len(image_ids),
            "success_count": 0,
            "failed_count": 0
        }
        
        for image_id in image_ids:
            try:
                success = await self.delete_image(image_id)
                if success:
                    results["success"].append(image_id)
                    results["success_count"] += 1
                else:
                    results["failed"].append({
                        "image_id": image_id,
                        "error": "图片不存在"
                    })
                    results["failed_count"] += 1
                    
            except Exception as e:
                logger.error(f"[FAIL] 批量删除失败 | ID: {image_id} | 错误: {e}")
                results["failed"].append({
                    "image_id": image_id,
                    "error": str(e)
                })
                results["failed_count"] += 1
        
        logger.info(f"[OK] 批量删除完成 | 成功: {results['success_count']} | 失败: {results['failed_count']}")
        return results

    async def ensure_thumbnail(self, image_id: int) -> Dict[str, Any]:
        """
        确保缩略图存在：检测缺失则自动从 COS 下载原图 → 生成 → 上传 COS → 更新 DB。
        供读取时自动修复使用。
        """
        image = await self.mysql.get_image_by_id(image_id)
        if not image:
            return {"status": "not_found"}

        # 已有COS缩略图，无需修复
        if image.get("cos_thumbnail_url"):
            return {"status": "ok", "thumbnail_cos_url": image["cos_thumbnail_url"]}

        cos_url = image.get("cos_url")
        if not cos_url:
            return {"status": "no_source"}

        try:
            import aiohttp
            import io
            import uuid
            from PIL import Image
            from ..config import settings

            # 从 COS 下载已处理图片
            async with aiohttp.ClientSession() as session:
                async with session.get(cos_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        return {"status": "failed", "reason": f"COS download HTTP {resp.status}"}
                    image_data = await resp.read()

            # 生成 512px 缩略图
            img = Image.open(io.BytesIO(image_data))
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            thumb_buffer = io.BytesIO()
            img.save(thumb_buffer, format="WEBP", quality=70, optimize=True)
            thumb_data = thumb_buffer.getvalue()

            # 保存本地（约定命名 {image_id}.webp）
            from ..config import settings
            local_path = os.path.join(settings.LOCAL_THUMBNAIL_DIR, f"{image_id}.webp")
            os.makedirs(settings.LOCAL_THUMBNAIL_DIR, exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(thumb_data)

            # 上传 COS
            thumb_cos_key = ""
            thumb_cos_url = ""
            if cos_service.is_enabled():
                thumb_filename = f"{image_id}.webp"
                success, thumb_cos_key, thumb_cos_url = await cos_service.upload_thumbnail(
                    thumb_data, thumb_filename, image_type="final"
                )

            # 更新 DB（已有列 cos_thumbnail_key / cos_thumbnail_url）
            await self.mysql.update_image_thumbnail(
                image_id=image_id,
                thumbnail_cos_key=thumb_cos_key or "",
                thumbnail_cos_url=thumb_cos_url or ""
            )

            logger.info(f"[OK] 缩略图自动修复 | ID: {image_id} | COS: {thumb_cos_url} | 本地: {local_path}")
            return {
                "status": "fixed",
                "thumbnail_cos_url": thumb_cos_url,
            }

        except Exception as e:
            logger.warning(f"[WARN] 缩略图自动修复失败 | ID: {image_id} | 错误: {e}")
            return {"status": "failed", "reason": str(e)}

    async def sync_thumbnails(self, check_only: bool = False) -> Dict[str, Any]:
        """批量同步缩略图（手动触发），复用 ensure_thumbnail"""
        missing = await self.mysql.get_images_missing_thumbnails()
        result = {
            "total_checked": len(missing),
            "missing_thumbnail": len(missing),
            "fixed": 0,
            "failed": 0,
            "details": []
        }

        if check_only:
            result["details"] = [
                {"id": img["id"], "filename": img["filename"], "cos_url": img.get("cos_url", "")}
                for img in missing
            ]
            return result

        for img in missing:
            image_id = img["id"]
            r = await self.ensure_thumbnail(image_id)
            if r["status"] == "fixed":
                result["fixed"] += 1
            else:
                result["failed"] += 1
            result["details"].append({"id": image_id, **r})

        return result
