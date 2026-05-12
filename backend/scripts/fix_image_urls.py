#!/usr/bin/env python3
"""
批量修复图片URL格式问题

功能：
- 批量修复指定图片ID的URL格式
- 支持全量扫描所有图片
- 支持修复多种URL格式问题
- 输出详细的修复结果
- 清除相关缓存

使用：
python fix_image_urls.py              # 修复默认图片ID 165-171
python fix_image_urls.py --full-scan   # 全量扫描和修复所有图片
python fix_image_urls.py --category final  # 修复指定分类的图片
"""

import asyncio
import logging
import sys
import os
import argparse
from concurrent.futures import ThreadPoolExecutor

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

async def fix_image_urls(full_scan=False, category=None, image_ids=None):
    """
    批量修复图片URL格式
    
    Args:
        full_scan: 是否全量扫描所有图片
        category: 修复指定分类的图片
        image_ids: 要修复的图片ID列表
    """
    try:
        logger.info("开始批量修复图片URL格式")
        
        # 从配置获取数据库连接信息
        from backend.app.config import settings
        
        # 初始化数据库连接
        mysql_repo = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        # 初始化连接池
        await mysql_repo.connect()
        
        redis_repo = RedisRepository()
        
        # 初始化图片服务
        image_service = ImageService(mysql_repo, redis_repo, None)
        
        if full_scan:
            logger.info("执行全量扫描和修复")
            # 获取所有图片ID
            try:
                # 查询所有图片ID
                query = "SELECT id FROM images"
                if category:
                    query += f" WHERE category = '{category}'"
                
                images = await mysql_repo.execute_query(query)
                image_ids = [img['id'] for img in images]
                logger.info(f"找到 {len(image_ids)} 个图片需要修复")
            except Exception as e:
                logger.error(f"获取图片ID列表失败: {e}")
                raise
        elif not image_ids:
            # 默认修复图片ID 165-171
            image_ids = list(range(165, 172))  # 165-171
        
        logger.info(f"准备修复图片ID: {image_ids}")
        
        # 批量刷新图片URL
        result = await image_service.refresh_image_urls(
            image_ids=image_ids,
            category=category or "final",  # 默认为final分类
            limit=1000  # 增加限制，支持更多图片
        )
        
        # 输出修复结果
        logger.info("批量修复图片URL结果:")
        logger.info(f"总数: {result['total']}")
        logger.info(f"处理: {result['processed']}")
        logger.info(f"修复: {result['fixed']}")
        logger.info(f"失败: {result['failed']}")
        
        # 输出详细信息
        if result['details']:
            logger.info("详细信息:")
            for detail in result['details']:
                if 'image_id' in detail:
                    logger.info(f"图片ID {detail['image_id']}: {detail['status']} - {detail['message']}")
                else:
                    logger.info(f"全局: {detail['status']} - {detail['message']}")
        
        # 检查是否所有图片都已修复
        if result['fixed'] == len(image_ids):
            logger.info("[OK] 所有图片URL格式修复成功！")
        else:
            logger.warning(f"[WARN] 部分图片URL格式修复失败，成功: {result['fixed']}, 失败: {result['failed']}")
        
    except Exception as e:
        logger.error(f"[FAIL] 批量修复图片URL失败: {e}")
        raise
    finally:
        # 关闭数据库连接
        try:
            if 'mysql_repo' in locals():
                await mysql_repo.disconnect()
            # Redis连接暂时不关闭，因为RedisRepository可能没有disconnect方法
            logger.info("数据库连接已关闭")
        except Exception as e:
            logger.warning(f"关闭数据库连接失败: {e}")

if __name__ == "__main__":
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='批量修复图片URL格式问题')
    parser.add_argument('--full-scan', action='store_true', help='全量扫描和修复所有图片')
    parser.add_argument('--category', type=str, help='修复指定分类的图片')
    parser.add_argument('--ids', type=str, help='修复指定ID的图片，多个ID用逗号分隔')
    
    args = parser.parse_args()
    
    # 处理图片ID参数
    image_ids = None
    if args.ids:
        try:
            image_ids = [int(id.strip()) for id in args.ids.split(',')]
        except ValueError:
            logger.error('无效的图片ID格式')
            sys.exit(1)
    
    try:
        asyncio.run(fix_image_urls(
            full_scan=args.full_scan,
            category=args.category,
            image_ids=image_ids
        ))
        logger.info("批量修复图片URL脚本执行完成")
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)
