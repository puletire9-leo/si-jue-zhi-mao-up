"""
定时清理服务
用于清理过期文件和无用缓存
"""
import os
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple

from ..config import settings
from ..logging_config import get_logger

logger = get_logger(__name__)


class CleanupService:
    """清理服务"""

    def __init__(self):
        self.thumbnail_dir = settings.THUMBNAIL_DIR
        self.download_dir = "/app/downloads"
        self.logs_dir = "/app/logs"
        self.backup_dir = settings.BACKUP_DIR
        self.model_cache_dir = settings.MODEL_CACHE_DIR

    async def cleanup_expired_thumbnails(self, days: int = 30) -> int:
        """
        清理过期的本地缩略图

        Args:
            days: 超过多少天的文件将被删除，默认30天

        Returns:
            删除的文件数量
        """
        if not os.path.exists(self.thumbnail_dir):
            logger.warning(f"缩略图目录不存在，跳过清理: {self.thumbnail_dir}")
            return 0

        deleted_count = 0
        cutoff_time = datetime.now() - timedelta(days=days)

        try:
            for filename in os.listdir(self.thumbnail_dir):
                filepath = os.path.join(self.thumbnail_dir, filename)
                if os.path.isfile(filepath):
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if file_mtime < cutoff_time:
                        os.remove(filepath)
                        deleted_count += 1
                        logger.info(f"删除过期缩略图: {filepath}, 修改时间: {file_mtime}")

            logger.info(f"清理过期缩略图完成，删除 {deleted_count} 个文件")
        except Exception as e:
            logger.error(f"清理缩略图失败: {str(e)}")

        return deleted_count

    async def cleanup_old_logs(self, days: int = 7) -> int:
        """
        清理过期的日志文件

        Args:
            days: 超过多少天的日志文件将被删除，默认7天

        Returns:
            删除的文件数量
        """
        if not os.path.exists(self.logs_dir):
            logger.warning(f"日志目录不存在，跳过清理: {self.logs_dir}")
            return 0

        deleted_count = 0
        cutoff_time = datetime.now() - timedelta(days=days)

        try:
            for filename in os.listdir(self.logs_dir):
                filepath = os.path.join(self.logs_dir, filename)
                if os.path.isfile(filepath) and (filename.endswith('.log') or filename.endswith('.txt')):
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if file_mtime < cutoff_time:
                        os.remove(filepath)
                        deleted_count += 1
                        logger.info(f"删除过期日志: {filepath}, 修改时间: {file_mtime}")

            logger.info(f"清理过期日志完成，删除 {deleted_count} 个文件")
        except Exception as e:
            logger.error(f"清理日志失败: {str(e)}")

        return deleted_count

    async def cleanup_old_backups(self, days: int = 30, keep_count: int = 10) -> int:
        """
        清理过期的备份文件，保留最新的N个

        Args:
            days: 超过多少天的备份将被删除，默认30天
            keep_count: 保留最新的多少个备份，默认10个

        Returns:
            删除的文件数量
        """
        if not os.path.exists(self.backup_dir):
            logger.warning(f"备份目录不存在，跳过清理: {self.backup_dir}")
            return 0

        deleted_count = 0

        try:
            # 获取所有备份文件，按修改时间排序
            backup_files: List[Tuple[str, datetime]] = []
            for filename in os.listdir(self.backup_dir):
                filepath = os.path.join(self.backup_dir, filename)
                if os.path.isfile(filepath):
                    mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    backup_files.append((filepath, mtime))

            # 按时间排序（最新的在前）
            backup_files.sort(key=lambda x: x[1], reverse=True)

            # 删除过期的文件（保留最新的N个）
            cutoff_time = datetime.now() - timedelta(days=days)
            for filepath, mtime in backup_files[keep_count:]:
                if mtime < cutoff_time:
                    os.remove(filepath)
                    deleted_count += 1
                    logger.info(f"删除过期备份: {filepath}, 修改时间: {mtime}")

            logger.info(f"清理过期备份完成，删除 {deleted_count} 个文件")
        except Exception as e:
            logger.error(f"清理备份失败: {str(e)}")

        return deleted_count

    async def cleanup_download_cache(self, days: int = 7) -> int:
        """
        清理下载缓存目录

        Args:
            days: 超过多少天的下载缓存将被删除，默认7天

        Returns:
            删除的文件数量
        """
        if not os.path.exists(self.download_dir):
            logger.warning(f"下载目录不存在，跳过清理: {self.download_dir}")
            return 0

        deleted_count = 0
        cutoff_time = datetime.now() - timedelta(days=days)

        try:
            for task_dir in os.listdir(self.download_dir):
                task_path = os.path.join(self.download_dir, task_dir)
                if os.path.isdir(task_path):
                    # 检查目录是否过期
                    dir_mtime = datetime.fromtimestamp(os.path.getmtime(task_path))
                    if dir_mtime < cutoff_time:
                        # 删除整个目录
                        import shutil
                        shutil.rmtree(task_path)
                        deleted_count += 1
                        logger.info(f"删除过期下载缓存: {task_path}, 修改时间: {dir_mtime}")
                    else:
                        # 检查目录内的文件
                        for filename in os.listdir(task_path):
                            filepath = os.path.join(task_path, filename)
                            if os.path.isfile(filepath):
                                file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                                if file_mtime < cutoff_time:
                                    os.remove(filepath)
                                    deleted_count += 1
                                    logger.info(f"删除过期下载文件: {filepath}, 修改时间: {file_mtime}")

            logger.info(f"清理下载缓存完成，删除 {deleted_count} 个文件")
        except Exception as e:
            logger.error(f"清理下载缓存失败: {str(e)}")

        return deleted_count

    async def cleanup_model_cache(self, max_size_gb: float = 5.0) -> int:
        """
        清理模型缓存，限制总大小

        Args:
            max_size_gb: 最大缓存大小（GB），默认5GB

        Returns:
            删除的文件数量
        """
        if not os.path.exists(self.model_cache_dir):
            logger.warning(f"模型缓存目录不存在，跳过清理: {self.model_cache_dir}")
            return 0

        deleted_count = 0

        try:
            # 计算当前缓存大小
            total_size = 0
            cache_files: List[Tuple[str, float, datetime]] = []

            for root, dirs, files in os.walk(self.model_cache_dir):
                for filename in files:
                    filepath = os.path.join(root, filename)
                    size = os.path.getsize(filepath)
                    mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    total_size += size
                    cache_files.append((filepath, size, mtime))

            # 转换为GB
            total_size_gb = total_size / (1024 ** 3)
            logger.info(f"当前模型缓存大小: {total_size_gb:.2f} GB")

            # 如果超过限制，删除最旧的文件
            if total_size_gb > max_size_gb:
                # 按修改时间排序（最旧的在前）
                cache_files.sort(key=lambda x: x[2])

                target_size = max_size_gb * 0.8  # 清理到80%

                for filepath, size, mtime in cache_files:
                    if total_size_gb <= target_size:
                        break
                    os.remove(filepath)
                    total_size_gb -= size / (1024 ** 3)
                    deleted_count += 1
                    logger.info(f"删除模型缓存: {filepath}, 大小: {size / 1024 / 1024:.2f} MB")

            logger.info(f"清理模型缓存完成，删除 {deleted_count} 个文件")
        except Exception as e:
            logger.error(f"清理模型缓存失败: {str(e)}")

        return deleted_count

    async def run_all_cleanup(self) -> dict:
        """
        运行所有清理任务

        Returns:
            各清理任务的结果统计
        """
        results = {}

        logger.info("=== 开始执行定时清理任务 ===")

        results['thumbnails'] = await self.cleanup_expired_thumbnails(days=30)
        results['logs'] = await self.cleanup_old_logs(days=7)
        results['backups'] = await self.cleanup_old_backups(days=30, keep_count=10)
        results['downloads'] = await self.cleanup_download_cache(days=7)
        results['model_cache'] = await self.cleanup_model_cache(max_size_gb=5.0)

        logger.info(f"=== 定时清理任务完成 === 结果: {results}")

        return results


# 全局实例
cleanup_service = CleanupService()


async def scheduled_cleanup():
    """定时清理任务入口（供 Celery 或调度器调用）"""
    await cleanup_service.run_all_cleanup()
