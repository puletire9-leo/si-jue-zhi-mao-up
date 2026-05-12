#!/usr/bin/env python3
"""
检查数据库中图片URL的更新状态

功能：
- 检查指定图片ID的URL是否已更新
- 验证URL格式是否正确（无无效参数）
- 输出详细的检查结果
- 验证前端读取图片的URL处理逻辑

使用：
python check_db_urls.py
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.app.repositories.mysql_repo import MySQLRepository
from backend.app.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def check_db_urls():
    """
    检查数据库中图片URL的更新状态
    """
    try:
        logger.info("开始检查数据库中图片URL的更新状态")
        
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
        
        # 要检查的图片ID列表
        image_ids = list(range(165, 172))  # 165-171
        
        logger.info(f"准备检查图片ID: {image_ids}")
        
        # 检查每个图片的URL状态
        total_checks = 0
        valid_urls = 0
        invalid_urls = 0
        
        for image_id in image_ids:
            logger.info(f"\n{'='*60}")
            logger.info(f"检查图片ID: {image_id}")
            logger.info(f"{'='*60}")
            
            try:
                # 获取图片信息
                image = await mysql_repo.get_image_by_id(image_id)
                if not image:
                    logger.error(f"图片ID {image_id} 不存在")
                    continue
                
                total_checks += 1
                
                # 检查filepath字段
                filepath = image.get('filepath', '')
                cos_url = image.get('cos_url', '')
                
                logger.info(f"filepath: {filepath}")
                logger.info(f"cos_url: {cos_url}")
                
                # 检查URL格式
                has_issues = False
                
                if filepath:
                    if any(pattern in filepath for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                        logger.error(f"filepath存在格式问题")
                        has_issues = True
                    else:
                        logger.info("[OK] filepath格式正常")
                
                if cos_url:
                    if any(pattern in cos_url for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                        logger.error(f"cos_url存在格式问题")
                        has_issues = True
                    else:
                        logger.info("[OK] cos_url格式正常")
                
                if has_issues:
                    invalid_urls += 1
                else:
                    valid_urls += 1
                
            except Exception as e:
                logger.error(f"检查图片ID {image_id} 失败: {e}")
        
        # 检查完成，输出总结
        logger.info(f"\n{'='*60}")
        logger.info(f"检查完成")
        logger.info(f"{'='*60}")
        logger.info(f"总计检查: {total_checks} 个图片")
        logger.info(f"格式正常: {valid_urls} 个URL")
        logger.info(f"格式异常: {invalid_urls} 个URL")
        
        if invalid_urls == 0:
            logger.info("[OK] 所有图片URL格式都已正确更新！")
        else:
            logger.warning(f"[WARN] 还有 {invalid_urls} 个图片URL格式异常，需要修复")
        
    except Exception as e:
        logger.error(f"检查数据库URL失败: {e}")
        raise
    finally:
        # 关闭数据库连接
        try:
            if 'mysql_repo' in locals():
                await mysql_repo.disconnect()
            logger.info("数据库连接已关闭")
        except Exception as e:
            logger.warning(f"关闭数据库连接失败: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(check_db_urls())
        logger.info("检查数据库URL脚本执行完成")
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)
