"""
下载任务服务模块

功能：
- 管理定稿批量下载任务
- 异步执行文件下载和ZIP打包
- 任务状态持久化到数据库
- 下载文件保存到本地缓存目录
- 过期任务自动清理

使用场景：
- 定稿批量下载
- 大文件异步处理
- 系统统一下载管理
"""

import asyncio
import logging
import os
import zipfile
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import aiohttp
from io import BytesIO

from ..config import settings
from ..models.download_task import (
    DownloadTask, DownloadTaskStatus, DownloadTaskSource,
    DownloadTaskFile, DownloadFileStatus
)
from ..utils.download_utils import (
    DownloadStatus,
    DownloadResult,
    download_files_batch,
    build_zip_from_images,
)

logger = logging.getLogger(__name__)

# 下载缓存目录 - 使用当前文件所在位置计算
# 当前文件路径: backend/app/services/download_task_service.py
CURRENT_FILE = Path(__file__).resolve()
DOWNLOAD_CACHE_DIR = CURRENT_FILE.parent.parent.parent / "下载缓存"


class DownloadTaskService:
    """
    下载任务服务类
    
    功能：
    - 管理下载任务的生命周期
    - 异步执行文件下载
    - 任务状态持久化到数据库
    - 下载文件保存到本地缓存
    - 过期任务清理
    """
    
    def __init__(self):
        """初始化下载任务服务"""
        self._mysql_repo = None
        self._lock = asyncio.Lock()
        
        # 确保缓存目录存在
        DOWNLOAD_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        logger.info(f"[OK] 下载缓存目录: {DOWNLOAD_CACHE_DIR}")
        
    def set_mysql_repo(self, mysql_repo):
        """
        设置数据库连接池
        
        Args:
            mysql_repo: MySQLRepository实例
        """
        self._mysql_repo = mysql_repo
        
    async def create_task(
        self,
        name: str,
        source: DownloadTaskSource,
        skus: Optional[List[str]] = None,
        file_urls: Optional[List[str]] = None,
        user_id: Optional[int] = None,
        request_data: Optional[List[dict]] = None,
    ) -> str:
        """
        创建下载任务

        Args:
            name: 任务名称
            source: 任务来源
            skus: SKU列表（定稿下载用）
            file_urls: 文件URL列表
            user_id: 创建用户ID
            request_data: 原始请求文件数据，JSON序列化后存储（用于重试）

        Returns:
            str: 任务ID
        """
        import json as _json

        task_id = str(uuid.uuid4())

        # 计算总文件数
        total_files = len(skus) if skus else (len(file_urls) if file_urls else 0)

        # 序列化请求数据
        request_json = _json.dumps(request_data, ensure_ascii=False) if request_data else None

        # 插入数据库
        sql = """
            INSERT INTO download_tasks
            (id, name, source, status, total_files, created_by, request_data, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """
        await self._mysql_repo.execute_insert(
            sql,
            (task_id, name, source.value, DownloadTaskStatus.PENDING.value, total_files, user_id, request_json)
        )

        logger.info(f"[OK] 创建下载任务: {task_id}, 名称: {name}, 来源: {source.value}, 文件数: {total_files}")
        return task_id
    
    async def get_task(self, task_id: str) -> Optional[DownloadTask]:
        """
        获取任务信息
        
        Args:
            task_id: 任务ID
            
        Returns:
            DownloadTask: 任务对象，不存在返回None
        """
        # 查询任务基本信息
        sql = """
            SELECT id, name, source, status, progress, total_files,
                   completed_files, failed_files, total_size, local_path,
                   created_at, completed_at, error_message, request_data, created_by
            FROM download_tasks WHERE id = %s
        """
        result = await self._mysql_repo.execute_query(sql, (task_id,), fetch_one=True)
        
        if not result:
            return None
        
        # 查询文件列表
        files_sql = """
            SELECT id, task_id, file_name, file_size, status, error_message
            FROM download_task_files WHERE task_id = %s
        """
        files_result = await self._mysql_repo.execute_query(files_sql, (task_id,), fetch_one=False)
        
        files = []
        if files_result:
            for file_row in files_result:
                files.append(DownloadTaskFile(
                    id=file_row['id'],
                    task_id=file_row['task_id'],
                    file_name=file_row['file_name'],
                    file_size=file_row['file_size'],
                    status=DownloadFileStatus(file_row['status']),
                    error_message=file_row['error_message'],
                    created_at=datetime.now()
                ))
        
        return DownloadTask(
            id=result['id'],
            name=result['name'],
            source=DownloadTaskSource(result['source']),
            status=DownloadTaskStatus(result['status']),
            progress=result['progress'],
            total_files=result['total_files'],
            completed_files=result['completed_files'],
            failed_files=result['failed_files'],
            total_size=result['total_size'],
            local_path=result['local_path'],
            created_at=result['created_at'],
            completed_at=result['completed_at'],
            error_message=result['error_message'],
            request_data=result.get('request_data'),
            created_by=result['created_by'],
            files=files
        )
    
    async def get_tasks(
        self,
        user_id: Optional[int] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[DownloadTask], int]:
        """
        获取任务列表
        
        Args:
            user_id: 用户ID筛选
            status: 状态筛选
            source: 来源筛选
            keyword: 关键词搜索
            page: 页码
            page_size: 每页数量
            
        Returns:
            Tuple[List[DownloadTask], int]: 任务列表和总数
        """
        # 构建查询条件
        conditions = []
        params = []
        
        if user_id:
            conditions.append("created_by = %s")
            params.append(user_id)
        
        if status:
            conditions.append("status = %s")
            params.append(status)
        
        if source:
            conditions.append("source = %s")
            params.append(source)
        
        if keyword:
            conditions.append("(name LIKE %s OR id LIKE %s)")
            params.extend([f"%{keyword}%", f"%{keyword}%"])
        
        # 默认只显示近30天的任务，避免历史数据干扰
        conditions.append("created_at >= NOW() - INTERVAL 30 DAY")

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM download_tasks {where_clause}"
        count_result = await self._mysql_repo.execute_query(count_sql, tuple(params), fetch_one=True)
        total = count_result['total'] if count_result else 0
        
        # 查询任务列表
        sql = f"""
            SELECT id, name, source, status, progress, total_files,
                   completed_files, failed_files, total_size, local_path,
                   created_at, completed_at, error_message, request_data, created_by
            FROM download_tasks
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([page_size, (page - 1) * page_size])
        results = await self._mysql_repo.execute_query(sql, tuple(params), fetch_one=False)
        
        tasks = []
        if results:
            for row in results:
                tasks.append(DownloadTask(
                    id=row['id'],
                    name=row['name'],
                    source=DownloadTaskSource(row['source']),
                    status=DownloadTaskStatus(row['status']),
                    progress=row['progress'],
                    total_files=row['total_files'],
                    completed_files=row['completed_files'],
                    failed_files=row['failed_files'],
                    total_size=row['total_size'],
                    local_path=row['local_path'],
                    created_at=row['created_at'],
                    completed_at=row['completed_at'],
                    error_message=row['error_message'],
                    created_by=row['created_by']
                ))
        
        return tasks, total
    
    async def execute_task(self, task_id: str, files: Optional[List[dict]] = None):
        """
        执行任务（后台异步执行）

        Args:
            task_id: 任务ID
            files: 文件列表 [{"url": "...", "filename": "..."}, ...]
        """
        task = await self.get_task(task_id)
        if not task:
            logger.error(f"[FAIL] 任务不存在: {task_id}")
            return

        if task.status != DownloadTaskStatus.PENDING:
            logger.warning(f"[WARN] 任务状态不是pending，跳过执行: {task_id}, 状态: {task.status}")
            return

        # 更新任务状态为处理中
        await self._update_task_status(task_id, DownloadTaskStatus.PROCESSING)
        logger.info(f"[START] 开始执行下载任务: {task_id}, 文件数: {task.total_files}")

        try:
            # 根据来源执行不同的下载逻辑
            if task.source == DownloadTaskSource.FINAL_DRAFT:
                await self._execute_final_draft_task(task, files or [])
            else:
                # 其他来源的下载逻辑待实现
                raise Exception(f"暂不支持的下载来源: {task.source}")

        except Exception as e:
            logger.error(f"[FAIL] 下载任务失败: {task_id}, 错误: {e}")
            await self._update_task_status(
                task_id,
                DownloadTaskStatus.FAILED,
                error_message=str(e)
            )
    
    async def _execute_final_draft_task(self, task: DownloadTask, files: List[dict]):
        """
        执行定稿下载任务

        Args:
            task: 下载任务
            files: 文件列表 [{"url": "...", "filename": "..."}, ...]
        """
        task_id = task.id
        total = len(files)

        zip_filename = f"{task.name}.zip"
        if not zip_filename.endswith('.zip'):
            zip_filename += '.zip'

        task_dir = DOWNLOAD_CACHE_DIR / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        zip_path = task_dir / zip_filename

        completed = 0
        failed = 0
        total_size = 0

        try:
            # 批量下载所有文件
            download_results = await download_files_batch(
                files, mysql_repo=self._mysql_repo, max_concurrent=5
            )

            # 收集成功下载的图片，逐文件更新进度
            image_files = []
            for result in download_results:
                if result.status == DownloadStatus.SUCCESS and result.content:
                    ext = os.path.splitext(result.filename)[1].lower()
                    if ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
                        image_files.append((result.filename, result.content))
                        total_size += result.size
                    completed += 1
                else:
                    failed += 1

                # 每个文件更新一次进度（独立短事务）
                progress = int((completed + failed) / total * 100) if total > 0 else 0
                await self._update_task_status(
                    task_id, DownloadTaskStatus.PROCESSING,
                    progress=progress,
                    completed_files=completed,
                    failed_files=failed,
                )

            # 构建 ZIP
            if image_files:
                packed = build_zip_from_images(image_files, str(zip_path))
                zip_size = zip_path.stat().st_size if zip_path.exists() else 0

                await self._update_task_status(
                    task_id, DownloadTaskStatus.COMPLETED,
                    progress=100,
                    completed_files=completed,
                    failed_files=failed,
                    total_size=zip_size,
                    local_path=str(zip_path),
                )
                logger.info(f"[OK] 定稿下载任务完成: {task_id}, ZIP: {zip_path}, "
                           f"成功: {completed}, 失败: {failed}, 大小: {zip_size / 1024 / 1024:.2f} MB")
            else:
                await self._update_task_status(
                    task_id, DownloadTaskStatus.FAILED,
                    progress=100,
                    completed_files=0,
                    failed_files=failed,
                    error_message="没有成功下载的图片文件",
                )
                logger.warning(f"[FAIL] 定稿下载任务失败: {task_id}, 没有成功下载的图片文件")

        except Exception as e:
            logger.error(f"[FAIL] 定稿下载执行异常: {task_id}, 错误: {e}")
            await self._update_task_status(
                task_id, DownloadTaskStatus.FAILED,
                error_message=str(e),
            )
            raise

        finally:
            # 清理临时文件（保留最终 ZIP）
            try:
                if task_dir.exists():
                    for item in task_dir.iterdir():
                        if item != zip_path and item.is_file():
                            try:
                                item.unlink()
                            except Exception:
                                pass
            except Exception:
                pass
    
    async def _update_task_status(
        self,
        task_id: str,
        status: DownloadTaskStatus,
        progress: Optional[int] = None,
        completed_files: Optional[int] = None,
        failed_files: Optional[int] = None,
        total_size: Optional[int] = None,
        local_path: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """
        更新任务状态
        
        Args:
            task_id: 任务ID
            status: 新状态
            progress: 进度
            completed_files: 已完成文件数
            failed_files: 失败文件数
            total_size: 总大小
            local_path: 本地路径
            error_message: 错误信息
        """
        fields = ["status = %s"]
        params = [status.value]
        
        if progress is not None:
            fields.append("progress = %s")
            params.append(progress)
        
        if completed_files is not None:
            fields.append("completed_files = %s")
            params.append(completed_files)
        
        if failed_files is not None:
            fields.append("failed_files = %s")
            params.append(failed_files)
        
        if total_size is not None:
            fields.append("total_size = %s")
            params.append(total_size)
        
        if local_path is not None:
            fields.append("local_path = %s")
            params.append(local_path)
        
        if error_message is not None:
            fields.append("error_message = %s")
            params.append(error_message)
        
        if status == DownloadTaskStatus.COMPLETED:
            fields.append("completed_at = NOW()")
        
        params.append(task_id)
        
        sql = f"UPDATE download_tasks SET {', '.join(fields)} WHERE id = %s"
        await self._mysql_repo.execute_update(sql, tuple(params))
    
    async def delete_task(self, task_id: str) -> bool:
        """
        删除任务

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功删除
        """
        # 获取任务信息
        task = await self.get_task(task_id)
        if not task:
            return False

        # 先标记为已取消，防止 Celery worker 继续更新（竞态保护）
        async with self._lock:
            try:
                await self._update_task_status(
                    task_id,
                    DownloadTaskStatus.FAILED,
                    error_message="任务已被用户删除"
                )
            except Exception:
                pass  # 可能已被删除，忽略

        # 删除本地文件和任务目录
        try:
            # 删除ZIP文件
            if task.local_path:
                zip_path = Path(task.local_path)
                if zip_path.exists():
                    zip_path.unlink()
                    logger.info(f"[TRASH] 删除ZIP文件: {zip_path}")

            # 删除任务目录（无论local_path是否存在）
            task_dir = DOWNLOAD_CACHE_DIR / task_id
            if task_dir.exists():
                import shutil
                shutil.rmtree(task_dir)
                logger.info(f"[TRASH] 删除任务目录: {task_dir}")
        except Exception as e:
            logger.error(f"[FAIL] 删除本地文件失败: {e}")

        # 删除关联的文件记录
        try:
            await self._mysql_repo.execute_delete(
                "DELETE FROM download_task_files WHERE task_id = %s",
                (task_id,)
            )
        except Exception as e:
            logger.error(f"[FAIL] 删除任务文件记录失败: {e}")

        # 删除数据库记录
        sql = "DELETE FROM download_tasks WHERE id = %s"
        await self._mysql_repo.execute_delete(sql, (task_id,))

        logger.info(f"[TRASH] 删除下载任务: {task_id}")
        return True
    
    async def cancel_task(self, task_id: str) -> bool:
        """
        取消任务

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功取消
        """
        task = await self.get_task(task_id)
        if not task:
            return False

        if task.status not in (DownloadTaskStatus.PENDING, DownloadTaskStatus.PROCESSING):
            return False

        await self._update_task_status(
            task_id,
            DownloadTaskStatus.FAILED,
            error_message="任务已被取消"
        )

        logger.info(f"[CANCEL] 取消下载任务: {task_id}")
        return True

    async def retry_task(self, task_id: str) -> bool:
        """
        重试失败的任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            bool: 是否成功重试
        """
        task = await self.get_task(task_id)
        if not task or task.status != DownloadTaskStatus.FAILED:
            return False
        
        # 重置任务状态
        await self._update_task_status(
            task_id,
            DownloadTaskStatus.PENDING,
            progress=0,
            completed_files=0,
            failed_files=0,
            error_message=None
        )
        
        # 删除旧的本地文件
        if task.local_path:
            try:
                zip_path = Path(task.local_path)
                if zip_path.exists():
                    zip_path.unlink()
            except Exception as e:
                logger.error(f"[FAIL] 删除旧ZIP文件失败: {e}")
        
        logger.info(f"[SYNC] 重置下载任务: {task_id}")
        return True
    
    async def cleanup_expired_tasks(self, days: int = 7):
        """
        清理过期任务
        
        Args:
            days: 过期天数，默认7天
        """
        # 查询过期任务
        sql = """
            SELECT id, local_path FROM download_tasks
            WHERE status = 'completed'
            AND completed_at < DATE_SUB(NOW(), INTERVAL %s DAY)
        """
        results = await self._mysql_repo.execute_query(sql, (days,), fetch_one=False)
        
        if not results:
            logger.info("[OK] 没有需要清理的过期任务")
            return
        
        deleted_count = 0
        for row in results:
            task_id = row['id']
            local_path = row['local_path']
            
            # 删除本地文件
            if local_path:
                try:
                    zip_path = Path(local_path)
                    if zip_path.exists():
                        zip_path.unlink()
                    
                    task_dir = DOWNLOAD_CACHE_DIR / task_id
                    if task_dir.exists():
                        import shutil
                        shutil.rmtree(task_dir)
                except Exception as e:
                    logger.error(f"[FAIL] 删除过期任务文件失败: {task_id}, {e}")
            
            # 删除数据库记录
            await self._mysql_repo.execute_query(
                "DELETE FROM download_tasks WHERE id = %s",
                (task_id,),
                fetch_one=False
            )
            deleted_count += 1
        
        logger.info(f"[BROOM] 清理 {deleted_count} 个过期下载任务")

    async def start_cleanup_task(self):
        """
        启动定时清理任务
        
        每天凌晨2点清理过期的下载任务
        """
        import asyncio
        
        async def cleanup_loop():
            while True:
                try:
                    # 计算到下一个凌晨2点的时间
                    now = datetime.now()
                    next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
                    if next_run <= now:
                        next_run += timedelta(days=1)
                    
                    wait_seconds = (next_run - now).total_seconds()
                    logger.info(f"⏰ 下载任务清理任务将在 {wait_seconds/3600:.1f} 小时后运行")
                    
                    await asyncio.sleep(wait_seconds)
                    
                    # 执行清理
                    await self.cleanup_expired_tasks(days=7)
                    
                except Exception as e:
                    logger.error(f"[FAIL] 定时清理任务执行失败: {e}")
                    # 出错后等待1小时再试
                    await asyncio.sleep(3600)
        
        # 启动后台任务
        self._cleanup_task = asyncio.create_task(cleanup_loop())
        logger.info("[OK] 下载任务定时清理任务已启动")
    
    async def stop_cleanup_task(self):
        """
        停止定时清理任务
        """
        if hasattr(self, '_cleanup_task') and self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            logger.info("[OK] 下载任务定时清理任务已停止")


# 全局下载任务服务实例
download_task_service = DownloadTaskService()
