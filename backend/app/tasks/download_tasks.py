"""
Celery 下载任务模块

功能：
- 在后台 Celery worker 中执行批量下载和 ZIP 打包
- 支持失败重试（最多 3 次，间隔 60s）
- 任务去重：同一用户同源任务只允许一个 pending/processing
"""

import asyncio
import logging
from typing import List, Dict, Any

from celery import shared_task

from .celery_app import celery_app
from ..config import settings
from ..repositories.mysql_repo import MySQLRepository
from ..services.download_task_service import DownloadTaskService

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="app.tasks.download_tasks.execute_download")
def execute_download(self, task_id: str, files: List[Dict[str, Any]]):
    """
    执行下载任务

    Args:
        task_id: 下载任务ID
        files: 文件列表 [{"url": "...", "filename": "..."}, ...]

    Returns:
        dict: 执行结果
    """
    return asyncio.run(_execute_async(self, task_id, files))


async def _execute_async(self, task_id: str, files: List[Dict[str, Any]]):
    """
    异步执行下载任务的内部实现

    Args:
        self: Celery task binding（用于 retry）
        task_id: 下载任务ID
        files: 文件列表
    """
    mysql = MySQLRepository(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE,
        min_size=settings.MYSQL_WORKER_POOL_MIN_SIZE,
        pool_size=settings.MYSQL_WORKER_POOL_SIZE,
        max_overflow=settings.MYSQL_WORKER_MAX_OVERFLOW,
        pool_timeout=settings.MYSQL_POOL_TIMEOUT,
    )

    await mysql.connect()

    try:
        svc = DownloadTaskService()
        svc.set_mysql_repo(mysql)
        await svc.execute_task(task_id, files)

        logger.info(f"[OK] 下载任务执行完成: {task_id}")
        return {"success": True, "task_id": task_id}

    except Exception as e:
        logger.error(f"[FAIL] 下载任务执行失败: {task_id}, 错误: {e}")

        if self.request.retries < self.max_retries:
            logger.info(f"重试下载任务: {task_id}, 第 {self.request.retries + 1} 次")
            raise self.retry(exc=e, countdown=60)

        raise

    finally:
        await mysql.disconnect()
