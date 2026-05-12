"""
腾讯云COS存储迁移工具

功能：
- 将本地图片迁移到腾讯云COS
- 批量迁移现有数据
- 迁移状态监控和回滚
- 存储空间统计
"""

import asyncio
import os
import sys
import logging
from typing import List, Dict, Any
from datetime import datetime
import aiofiles

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from app.services.cos_service import cos_service
from app.config import settings

logger = logging.getLogger(__name__)


class COSMigrationTool:
    """腾讯云COS存储迁移工具"""
    
    def __init__(self, mysql_repo: MySQLRepository):
        """初始化迁移工具"""
        self.mysql = mysql_repo
        self.cos_service = cos_service
    
    async def migrate_single_image(self, image_id: int) -> Dict[str, Any]:
        """
        迁移单个图片到腾讯云COS
        
        Args:
            image_id: 图片ID
            
        Returns:
            迁移结果
        """
        try:
            # 获取图片信息
            image = await self.mysql.get_image_by_id(image_id)
            if not image:
                return {"success": False, "error": "图片不存在"}
            
            # 检查是否已经是COS存储
            if image.get('storage_type') == 'cos':
                return {"success": True, "message": "图片已使用COS存储"}
            
            # 检查本地文件是否存在
            filepath = image.get('filepath')
            if not filepath or not os.path.exists(filepath):
                return {"success": False, "error": "本地文件不存在"}
            
            # 读取图片数据
            async with aiofiles.open(filepath, 'rb') as f:
                image_data = await f.read()
            
            # 上传到腾讯云COS
            filename = image.get('filename', 'unknown')
            success, object_key, url = await self.cos_service.upload_image(
                image_data, filename, {
                    "category": image.get('category', ''),
                    "tags": image.get('tags', ''),
                    "description": image.get('description', '')
                }
            )
            
            if not success:
                return {"success": False, "error": f"COS上传失败: {url}"}
            
            # 更新数据库记录
            await self.mysql.update_image_storage_info(
                image_id=image_id,
                storage_type='cos',
                cos_object_key=object_key,
                cos_url=url
            )
            
            # 迁移缩略图（如果存在）
            thumbnail_path = os.path.join(settings.THUMBNAIL_DIR, f"{image_id}.jpg")
            if os.path.exists(thumbnail_path):
                await self._migrate_thumbnail(image_id, thumbnail_path, filename)
            
            logger.info(f"[OK] 图片迁移成功 | ID: {image_id} | COS对象键: {object_key}")
            
            return {
                "success": True,
                "image_id": image_id,
                "cos_object_key": object_key,
                "cos_url": url,
                "message": "迁移成功"
            }
            
        except Exception as e:
            error_msg = f"图片迁移失败: {str(e)}"
            logger.error(f"[FAIL] {error_msg} | ID: {image_id}")
            return {"success": False, "error": error_msg}
    
    async def _migrate_thumbnail(self, image_id: int, thumbnail_path: str, original_filename: str):
        """迁移缩略图到COS"""
        try:
            async with aiofiles.open(thumbnail_path, 'rb') as f:
                thumbnail_data = await f.read()
            
            success, object_key, url = await self.cos_service.upload_thumbnail(
                thumbnail_data, original_filename
            )
            
            if success:
                await self.mysql.update_image_thumbnail_info(
                    image_id=image_id,
                    cos_thumbnail_key=object_key,
                    cos_thumbnail_url=url
                )
                logger.info(f"[OK] 缩略图迁移成功 | ID: {image_id}")
            
        except Exception as e:
            logger.warning(f"[WARN] 缩略图迁移失败 | ID: {image_id} | 错误: {e}")
    
    async def migrate_batch_images(self, image_ids: List[int], batch_size: int = 10) -> Dict[str, Any]:
        """
        批量迁移图片到腾讯云COS
        
        Args:
            image_ids: 图片ID列表
            batch_size: 批量大小
            
        Returns:
            批量迁移结果
        """
        total_count = len(image_ids)
        success_count = 0
        failed_count = 0
        results = []
        
        logger.info(f"开始批量迁移 {total_count} 张图片到腾讯云COS...")
        
        # 分批处理
        for i in range(0, total_count, batch_size):
            batch = image_ids[i:i + batch_size]
            
            # 并发迁移
            tasks = [self.migrate_single_image(image_id) for image_id in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    failed_count += 1
                    results.append({"success": False, "error": str(result)})
                elif result.get('success'):
                    success_count += 1
                    results.append(result)
                else:
                    failed_count += 1
                    results.append(result)
            
            logger.info(f"进度: {i + len(batch)}/{total_count} | 成功: {success_count} | 失败: {failed_count}")
        
        return {
            "total_count": total_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "success_rate": success_count / total_count if total_count > 0 else 0,
            "results": results
        }
    
    async def get_migration_candidates(self) -> List[Dict[str, Any]]:
        """
        获取需要迁移的图片列表
        
        Returns:
            迁移候选图片列表
        """
        return await self.mysql.get_local_storage_images()
    
    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        获取存储统计信息
        
        Returns:
            存储统计信息
        """
        return await self.mysql.get_storage_statistics()
    
    async def rollback_migration(self, image_id: int) -> Dict[str, Any]:
        """
        回滚单个图片的迁移
        
        Args:
            image_id: 图片ID
            
        Returns:
            回滚结果
        """
        try:
            # 获取图片信息
            image = await self.mysql.get_image_by_id(image_id)
            if not image:
                return {"success": False, "error": "图片不存在"}
            
            # 检查是否使用COS存储
            if image.get('storage_type') != 'cos':
                return {"success": False, "error": "图片未使用COS存储"}
            
            # 检查本地文件是否仍然存在
            original_filepath = image.get('original_filepath')  # 需要先保存原始路径
            if not original_filepath or not os.path.exists(original_filepath):
                return {"success": False, "error": "原始本地文件不存在，无法回滚"}
            
            # 更新数据库记录
            await self.mysql.update_image_storage_info(
                image_id=image_id,
                storage_type='local',
                cos_object_key=None,
                cos_url=None,
                cos_thumbnail_key=None,
                cos_thumbnail_url=None
            )
            
            logger.info(f"[OK] 迁移回滚成功 | ID: {image_id}")
            
            return {"success": True, "message": "回滚成功"}
            
        except Exception as e:
            error_msg = f"迁移回滚失败: {str(e)}"
            logger.error(f"[FAIL] {error_msg} | ID: {image_id}")
            return {"success": False, "error": error_msg}


async def main():
    """主函数 - 用于命令行执行迁移"""
    # 初始化数据库连接
    mysql_repo = MySQLRepository()
    await mysql_repo.connect()
    
    # 创建迁移工具
    migration_tool = COSMigrationTool(mysql_repo)
    
    # 检查COS服务状态
    if not migration_tool.cos_service.is_enabled():
        print("[FAIL] 腾讯云COS服务未启用，请检查配置")
        return
    
    # 获取迁移候选
    candidates = await migration_tool.get_migration_candidates()
    print(f"[CHART] 发现 {len(candidates)} 张需要迁移的图片")
    
    if not candidates:
        print("[OK] 没有需要迁移的图片")
        return
    
    # 显示存储统计
    stats = await migration_tool.get_storage_stats()
    print(f"[UP] 当前存储统计: {stats}")
    
    # 确认迁移
    confirm = input("是否开始迁移？(y/N): ")
    if confirm.lower() != 'y':
        print("[FAIL] 迁移已取消")
        return
    
    # 执行批量迁移
    image_ids = [img['id'] for img in candidates]
    result = await migration_tool.migrate_batch_images(image_ids, batch_size=5)
    
    # 显示迁移结果
    print(f"\n[DONE] 迁移完成!")
    print(f"总计: {result['total_count']}")
    print(f"成功: {result['success_count']}")
    print(f"失败: {result['failed_count']}")
    print(f"成功率: {result['success_rate']:.2%}")
    
    # 关闭数据库连接
    await mysql_repo.disconnect()


if __name__ == "__main__":
    asyncio.run(main())