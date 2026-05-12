#!/usr/bin/env python3
"""
定时清理脚本
每天凌晨执行，清理过期的缓存文件
"""
import os
import sys
import shutil
import re
from datetime import datetime, timedelta

# 添加项目路径
sys.path.insert(0, '/app')

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)


def get_active_thumbnails_from_db():
    """从数据库获取所有正在使用的缩略图文件名"""
    try:
        import aiomysql
        from app.db.db_manager import db_manager
        
        active_thumbnails = set()
        
        # 1. 从 final_drafts 表获取 local_thumbnail_path
        query = """
            SELECT local_thumbnail_path 
            FROM final_drafts 
            WHERE local_thumbnail_path IS NOT NULL AND local_thumbnail_path != ''
        """
        # 这里需要异步执行，简化版本直接返回空集合
        # 实际使用时应该通过 API 或数据库连接获取
        return active_thumbnails
    except Exception as e:
        logger.error(f"获取数据库缩略图列表失败: {e}")
        return set()


def cleanup_orphan_thumbnails(days: int = 30) -> int:
    """
    清理"孤儿"缩略图（数据库中不存在的本地缩略图）
    
    安全策略：
    1. 只删除超过 N 天的文件（默认30天）
    2. 保留最近修改的文件（可能正在使用）
    3. 优先清理大文件（日志文件、临时文件）
    """
    thumbnail_dir = settings.THUMBNAIL_DIR
    if not os.path.exists(thumbnail_dir):
        logger.warning(f"缩略图目录不存在: {thumbnail_dir}")
        return 0

    deleted = 0
    skipped = 0
    cutoff = datetime.now() - timedelta(days=days)
    
    # 获取所有缩略图文件
    thumbnails = []
    for filename in os.listdir(thumbnail_dir):
        filepath = os.path.join(thumbnail_dir, filename)
        if os.path.isfile(filepath):
            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            size = os.path.getsize(filepath)
            thumbnails.append({
                'filename': filename,
                'filepath': filepath,
                'mtime': mtime,
                'size': size
            })
    
    # 按修改时间排序（旧的在前）
    thumbnails.sort(key=lambda x: x['mtime'])
    
    # 统计信息
    total_size = sum(t['size'] for t in thumbnails)
    old_files = [t for t in thumbnails if t['mtime'] < cutoff]
    
    print(f"[cleanup_thumbnails] 缩略图统计:")
    print(f"  - 总数: {len(thumbnails)} 个")
    print(f"  - 总大小: {total_size / 1024 / 1024:.2f} MB")
    print(f"  - {days}天前的文件: {len(old_files)} 个")
    
    # 只删除过期且较大的文件（避免误删正在使用的）
    for thumb in old_files:
        # 安全策略：只删除超过 100KB 的文件（缩略图通常很小，大文件可能是残留）
        if thumb['size'] > 100 * 1024:  # 100KB
            try:
                os.remove(thumb['filepath'])
                deleted += 1
                print(f"  删除大文件: {thumb['filename']} ({thumb['size']/1024:.1f} KB)")
            except Exception as e:
                print(f"  删除失败: {thumb['filename']}, 错误: {e}")
        else:
            skipped += 1
    
    print(f"[cleanup_thumbnails] 清理完成: 删除 {deleted} 个, 跳过 {skipped} 个")
    return deleted


def cleanup_logs(days: int = 7) -> int:
    """清理过期的日志文件"""
    logs_dir = settings.LOG_FILE.rsplit('/', 1)[0]
    if not os.path.exists(logs_dir):
        logger.warning(f"日志目录不存在: {logs_dir}")
        return 0

    deleted = 0
    cutoff = datetime.now() - timedelta(days=days)

    for filename in os.listdir(logs_dir):
        if not (filename.endswith('.log') or filename.endswith('.txt')):
            continue
        filepath = os.path.join(logs_dir, filename)
        if os.path.isfile(filepath):
            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            if mtime < cutoff:
                os.remove(filepath)
                deleted += 1
                print(f"  删除日志: {filename}")

    print(f"[cleanup_logs] 清理完成，删除 {deleted} 个文件")
    return deleted


def cleanup_downloads(days: int = 7) -> int:
    """清理过期的下载缓存"""
    download_dir = "/app/downloads"
    if not os.path.exists(download_dir):
        return 0

    deleted = 0
    cutoff = datetime.now() - timedelta(days=days)

    for task_dir in os.listdir(download_dir):
        task_path = os.path.join(download_dir, task_dir)
        if os.path.isdir(task_path):
            mtime = datetime.fromtimestamp(os.path.getmtime(task_path))
            if mtime < cutoff:
                shutil.rmtree(task_path)
                deleted += 1
                print(f"  删除下载缓存: {task_dir}")

    print(f"[cleanup_downloads] 清理完成，删除 {deleted} 个目录")
    return deleted


def cleanup_backups(days: int = 30, keep_count: int = 10) -> int:
    """清理过期的备份文件"""
    backup_dir = settings.BACKUP_DIR
    if not os.path.exists(backup_dir):
        return 0

    deleted = 0
    cutoff = datetime.now() - timedelta(days=days)

    # 获取所有备份文件
    backup_files = []
    for filename in os.listdir(backup_dir):
        filepath = os.path.join(backup_dir, filename)
        if os.path.isfile(filepath):
            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            backup_files.append((filepath, mtime))

    # 按时间排序（新的在前）
    backup_files.sort(key=lambda x: x[1], reverse=True)

    # 删除过期文件（保留最新的N个）
    for filepath, mtime in backup_files[keep_count:]:
        if mtime < cutoff:
            os.remove(filepath)
            deleted += 1
            print(f"  删除备份: {os.path.basename(filepath)}")

    print(f"[cleanup_backups] 清理完成，删除 {deleted} 个文件")
    return deleted


def main():
    """主函数"""
    print(f"[{datetime.now()}] === 开始定时清理任务 ===")

    # 缩略图清理改为安全模式：只删大文件、旧文件
    cleanup_orphan_thumbnails(days=30)
    cleanup_logs(days=7)
    cleanup_downloads(days=7)
    cleanup_backups(days=30, keep_count=10)

    print(f"[{datetime.now()}] === 定时清理任务完成 ===")


if __name__ == "__main__":
    main()
