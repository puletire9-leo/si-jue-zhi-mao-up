from celery import shared_task
from typing import Optional, List
import logging
import os

from .celery_app import celery_app
from ..repositories import MySQLRepository, RedisRepository, QdrantRepository
from ..config import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="app.tasks.image_tasks.process_image")
def process_image(self, image_id: int):
    """
    处理图片任务
    
    功能：
    - 生成缩略图
    - 提取图片特征向量
    - 存储到向量数据库
    - 更新缓存
    
    Args:
        image_id: 图片ID
        
    Returns:
        处理结果
    """
    try:
        logger.info(f"[SYNC] 开始处理图片 | ID: {image_id}")
        
        # 初始化数据库连接
        mysql = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        
        redis = RedisRepository(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB
        )
        
        qdrant = QdrantRepository(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            collection_name=settings.QDRANT_COLLECTION_NAME,
            vector_size=settings.QDRANT_VECTOR_SIZE
        )
        
        # 获取图片信息
        import asyncio
        
        async def _process():
            await mysql.connect()
            await redis.connect()
            await qdrant.connect()
            
            try:
                image = await mysql.get_image_by_id(image_id)
                
                if not image:
                    logger.error(f"[FAIL] 图片不存在 | ID: {image_id}")
                    return {"success": False, "message": "图片不存在"}
                
                # 生成缩略图
                thumbnail_path = os.path.join(settings.THUMBNAIL_DIR, f"{image_id}.jpg")
                if not os.path.exists(thumbnail_path):
                    from PIL import Image
                    with Image.open(image['filepath']) as img:
                        img.thumbnail(settings.THUMBNAIL_SIZE)
                        img.save(thumbnail_path, "JPEG", quality=settings.THUMBNAIL_QUALITY)
                    logger.info(f"[OK] 缩略图生成成功 | ID: {image_id}")
                
                # 提取向量（这里使用随机向量作为示例）
                import numpy as np
                vector = np.random.rand(settings.QDRANT_VECTOR_SIZE).tolist()
                
                # 存储向量
                await qdrant.insert_point(
                    point_id=image_id,
                    vector=vector,
                    payload={
                        "category": image['category'],
                        "tags": image['tags'].split(',') if image['tags'] else [],
                        "image_id": image_id
                    }
                )
                logger.info(f"[OK] 向量存储成功 | ID: {image_id}")
                
                # 清除缓存
                cache_key = f"image:{image_id}"
                await redis.cache_delete(cache_key)
                await redis.cache_clear("search:*")
                
                return {
                    "success": True,
                    "message": "图片处理成功",
                    "image_id": image_id
                }
                
            finally:
                await mysql.disconnect()
                await redis.disconnect()
                await qdrant.disconnect()
        
        result = asyncio.run(_process())
        
        logger.info(f"[OK] 图片处理完成 | ID: {image_id}")
        return result
        
    except Exception as e:
        logger.error(f"[FAIL] 图片处理失败 | ID: {image_id} | 错误: {e}")
        
        # 重试
        if self.request.retries < self.max_retries:
            logger.info(f"[SYNC] 重试任务 | ID: {image_id} | 重试次数: {self.request.retries + 1}")
            raise self.retry(exc=e, countdown=60)
        
        return {
            "success": False,
            "message": f"图片处理失败: {str(e)}",
            "image_id": image_id
        }


@shared_task(bind=True, name="app.tasks.image_tasks.batch_process_images")
def batch_process_images(self, image_ids: List[int]):
    """
    批量处理图片任务
    
    Args:
        image_ids: 图片ID列表
        
    Returns:
        处理结果
    """
    try:
        logger.info(f"[SYNC] 开始批量处理图片 | 数量: {len(image_ids)}")
        
        results = []
        
        for image_id in image_ids:
            try:
                result = process_image.delay(image_id)
                results.append({
                    "image_id": image_id,
                    "task_id": result.id,
                    "status": "submitted"
                })
            except Exception as e:
                logger.error(f"[FAIL] 提交任务失败 | ID: {image_id} | 错误: {e}")
                results.append({
                    "image_id": image_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        logger.info(f"[OK] 批量处理任务提交完成 | 成功: {len(results)}")
        
        return {
            "success": True,
            "message": "批量处理任务已提交",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"[FAIL] 批量处理失败 | 错误: {e}")
        return {
            "success": False,
            "message": f"批量处理失败: {str(e)}"
        }


@shared_task(name="app.tasks.image_tasks.cleanup_old_thumbnails")
def cleanup_old_thumbnails(days: int = 30):
    """
    清理旧缩略图任务
    
    Args:
        days: 清理多少天前的缩略图
        
    Returns:
        清理结果
    """
    try:
        logger.info(f"[SYNC] 开始清理旧缩略图 | 天数: {days}")
        
        import time
        from datetime import datetime, timedelta
        
        cutoff_time = time.time() - (days * 24 * 60 * 60)
        deleted_count = 0
        
        for filename in os.listdir(settings.THUMBNAIL_DIR):
            filepath = os.path.join(settings.THUMBNAIL_DIR, filename)
            
            if os.path.isfile(filepath):
                file_mtime = os.path.getmtime(filepath)
                
                if file_mtime < cutoff_time:
                    try:
                        os.remove(filepath)
                        deleted_count += 1
                        logger.debug(f"[OK] 删除缩略图 | 文件: {filename}")
                    except Exception as e:
                        logger.warning(f"[WARN] 删除缩略图失败 | 文件: {filename} | 错误: {e}")
        
        logger.info(f"[OK] 清理旧缩略图完成 | 删除数量: {deleted_count}")
        
        return {
            "success": True,
            "message": f"清理完成，删除了{deleted_count}个缩略图",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        logger.error(f"[FAIL] 清理旧缩略图失败 | 错误: {e}")
        return {
            "success": False,
            "message": f"清理失败: {str(e)}"
        }


@shared_task(name="app.tasks.image_tasks.rebuild_vectors")
def rebuild_vectors():
    """
    重建向量索引任务
    
    功能：
    - 重新提取所有图片的向量
    - 重建向量索引
    - 用于向量模型更新后重建索引
    
    Returns:
        重建结果
    """
    try:
        logger.info("[SYNC] 开始重建向量索引")
        
        import asyncio
        
        async def _rebuild():
            mysql = MySQLRepository(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DATABASE
            )
            
            qdrant = QdrantRepository(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vector_size=settings.QDRANT_VECTOR_SIZE
            )
            
            await mysql.connect()
            await qdrant.connect()
            
            try:
                # 获取所有图片
                images = await mysql.execute_query("SELECT * FROM images")
                
                # 删除旧集合
                await qdrant.delete_collection()
                
                # 创建新集合
                await qdrant.ensure_collection()
                
                # 批量插入向量
                import numpy as np
                
                points = []
                for image in images:
                    vector = np.random.rand(settings.QDRANT_VECTOR_SIZE).tolist()
                    points.append({
                        'id': image['id'],
                        'vector': vector,
                        'payload': {
                            'category': image['category'],
                            'tags': image['tags'].split(',') if image['tags'] else [],
                            'image_id': image['id']
                        }
                    })
                
                await qdrant.insert_points(points)
                
                return {
                    "success": True,
                    "message": f"向量索引重建完成，处理了{len(images)}张图片",
                    "count": len(images)
                }
                
            finally:
                await mysql.disconnect()
                await qdrant.disconnect()
        
        result = asyncio.run(_rebuild())
        
        logger.info("[OK] 向量索引重建完成")
        return result
        
    except Exception as e:
        logger.error(f"[FAIL] 重建向量索引失败 | 错误: {e}")
        return {
            "success": False,
            "message": f"重建失败: {str(e)}"
        }


@shared_task(name="app.tasks.image_tasks.clear_cache")
def clear_cache(pattern: str = "*"):
    """
    清除缓存任务
    
    Args:
        pattern: 缓存键模式
        
    Returns:
        清理结果
    """
    try:
        logger.info(f"[SYNC] 开始清除缓存 | 模式: {pattern}")
        
        import asyncio
        
        async def _clear():
            redis = RedisRepository(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB
            )
            
            await redis.connect()
            
            try:
                count = await redis.cache_clear(pattern)
                return {
                    "success": True,
                    "message": f"缓存清除完成，删除了{count}个键",
                    "count": count
                }
            finally:
                await redis.disconnect()
        
        result = asyncio.run(_clear())
        
        logger.info("[OK] 缓存清除完成")
        return result
        
    except Exception as e:
        logger.error(f"[FAIL] 清除缓存失败 | 错误: {e}")
        return {
            "success": False,
            "message": f"清除失败: {str(e)}"
        }
