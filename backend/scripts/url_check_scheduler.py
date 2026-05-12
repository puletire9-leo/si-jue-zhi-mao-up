#!/usr/bin/env python3
"""
URL有效性定期检查机制

功能：
- 定期检查数据库中的图片URL格式
- 自动修复发现的URL格式问题
- 记录检查和修复结果
- 支持配置检查频率

使用：
python url_check_scheduler.py
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.app.repositories.mysql_repo import MySQLRepository
from backend.app.repositories.redis_repo import RedisRepository
from backend.app.services.image_service import ImageService
from backend.app.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

class URLCheckScheduler:
    """
    URL检查调度器
    """
    
    def __init__(self):
        """
        初始化调度器
        """
        self.mysql_repo = None
        self.redis_repo = None
        self.image_service = None
    
    async def initialize(self):
        """
        初始化服务
        """
        try:
            # 从配置获取数据库连接信息
            from backend.app.config import settings
            
            # 初始化数据库连接
            self.mysql_repo = MySQLRepository(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DATABASE
            )
            # 初始化连接池
            await self.mysql_repo.connect()
            
            self.redis_repo = RedisRepository()
            
            # 初始化图片服务
            self.image_service = ImageService(self.mysql_repo, self.redis_repo, None)
            
            logger.info("URL检查调度器初始化成功")
            return True
        except Exception as e:
            logger.error(f"URL检查调度器初始化失败: {e}")
            return False
    
    async def check_and_fix_urls(self):
        """
        检查并修复URL格式
        """
        try:
            logger.info(f"开始执行URL检查: {datetime.now()}")
            
            # 检查所有分类的图片URL
            categories = ["final", "product", "selection"]
            
            total_fixed = 0
            total_processed = 0
            
            for category in categories:
                logger.info(f"检查分类: {category}")
                
                # 批量刷新图片URL
                result = await self.image_service.refresh_image_urls(
                    category=category,
                    limit=1000  # 每次检查最多1000张图片
                )
                
                logger.info(f"分类 {category} 检查结果:")
                logger.info(f"总数: {result['total']}")
                logger.info(f"处理: {result['processed']}")
                logger.info(f"修复: {result['fixed']}")
                logger.info(f"失败: {result['failed']}")
                
                total_fixed += result['fixed']
                total_processed += result['processed']
            
            logger.info(f"URL检查完成: {datetime.now()}")
            logger.info(f"总计处理: {total_processed} 张图片")
            logger.info(f"总计修复: {total_fixed} 个URL")
            
            if total_fixed > 0:
                logger.warning(f"[WARN] 发现并修复了 {total_fixed} 个URL格式问题")
                # 这里可以添加告警通知逻辑
            else:
                logger.info("[OK] 未发现URL格式问题")
            
        except Exception as e:
            logger.error(f"URL检查执行失败: {e}")
            raise
    
    async def run(self):
        """
        运行检查
        """
        try:
            if not await self.initialize():
                return False
            
            await self.check_and_fix_urls()
            return True
        finally:
            # 关闭数据库连接
            await self.cleanup()
    
    async def cleanup(self):
        """
        清理资源
        """
        try:
            if self.mysql_repo:
                await self.mysql_repo.disconnect()
            # Redis连接暂时不关闭，因为RedisRepository可能没有disconnect方法
            logger.info("资源清理完成")
        except Exception as e:
            logger.warning(f"资源清理失败: {e}")

async def main():
    """
    主函数
    """
    scheduler = URLCheckScheduler()
    await scheduler.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
        logger.info("URL检查执行完成")
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)
