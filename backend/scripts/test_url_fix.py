#!/usr/bin/env python3
"""
测试URL格式修复功能

功能：
- 测试单个图片URL的自动修复
- 验证数据库更新是否成功
- 检查修复后的URL格式是否正确
- 测试多种URL格式问题的修复

使用：
python test_url_fix.py
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
from backend.app.services.cos_service import cos_service
from backend.app.services.monitoring_service import monitoring_service

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def test_single_image_url_fix(image_id: int):
    """
    测试单个图片URL的自动修复
    
    Args:
        image_id: 图片ID
    """
    try:
        logger.info(f"开始测试图片ID {image_id} 的URL修复")
        
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
        
        # 获取原始图片信息
        original_image = await mysql_repo.get_image_by_id(image_id)
        if not original_image:
            logger.error(f"图片ID {image_id} 不存在")
            return False
        
        original_filepath = original_image.get('filepath', '')
        original_cos_url = original_image.get('cos_url', '')
        
        logger.info(f"原始filepath: {original_filepath}")
        logger.info(f"原始cos_url: {original_cos_url}")
        
        # 检查URL格式
        has_issues = False
        if original_filepath:
            if any(pattern in original_filepath for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                logger.warning(f"原始filepath存在格式问题")
                has_issues = True
        
        if original_cos_url:
            if any(pattern in original_cos_url for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                logger.warning(f"原始cos_url存在格式问题")
                has_issues = True
        
        if not has_issues:
            logger.info("[OK] 原始URL格式正常，无需修复")
        
        # 测试自动修复
        test_image = original_image.copy()
        url_fixed = await image_service._check_and_fix_urls(test_image, image_id)
        
        logger.info(f"URL修复结果: {'成功' if url_fixed else '未修复'}")
        
        # 获取修复后的图片信息
        fixed_image = await mysql_repo.get_image_by_id(image_id)
        if fixed_image:
            fixed_filepath = fixed_image.get('filepath', '')
            fixed_cos_url = fixed_image.get('cos_url', '')
            
            logger.info(f"修复后filepath: {fixed_filepath}")
            logger.info(f"修复后cos_url: {fixed_cos_url}")
            
            # 检查修复后的URL格式
            fixed_has_issues = False
            if fixed_filepath:
                if any(pattern in fixed_filepath for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                    logger.error(f"修复后filepath仍然存在格式问题")
                    fixed_has_issues = True
                else:
                    logger.info("[OK] 修复后filepath格式正常")
            
            if fixed_cos_url:
                if any(pattern in fixed_cos_url for pattern in ['q-url-param-list=&q-signature=', 'q-url-param-list=&', '&q-url-param-list=', 'q-url-param-list=']):
                    logger.error(f"修复后cos_url仍然存在格式问题")
                    fixed_has_issues = True
                else:
                    logger.info("[OK] 修复后cos_url格式正常")
            
            if not fixed_has_issues:
                logger.info(f"[OK] 图片ID {image_id} URL修复测试通过")
                return True
            else:
                logger.error(f"[FAIL] 图片ID {image_id} URL修复测试失败")
                return False
        else:
            logger.error(f"[FAIL] 无法获取修复后的图片信息")
            return False
        
    except Exception as e:
        logger.error(f"[FAIL] 测试图片URL修复失败: {e}")
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

async def test_multiple_images():
    """
    测试多个图片URL的修复
    """
    try:
        logger.info("开始测试多个图片URL的修复")
        
        # 要测试的图片ID列表
        image_ids = list(range(165, 172))  # 165-171
        
        success_count = 0
        total_count = len(image_ids)
        
        for image_id in image_ids:
            logger.info(f"\n{'='*60}")
            logger.info(f"测试图片ID: {image_id}")
            logger.info(f"{'='*60}")
            
            try:
                success = await test_single_image_url_fix(image_id)
                if success:
                    success_count += 1
                    logger.info(f"[OK] 图片ID {image_id} 测试通过")
                else:
                    logger.error(f"[FAIL] 图片ID {image_id} 测试失败")
            except Exception as e:
                logger.error(f"[FAIL] 图片ID {image_id} 测试异常: {e}")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"测试完成")
        logger.info(f"{'='*60}")
        logger.info(f"测试总数: {total_count}")
        logger.info(f"通过数量: {success_count}")
        logger.info(f"失败数量: {total_count - success_count}")
        
        if success_count == total_count:
            logger.info("[OK] 所有图片URL修复测试通过！")
            return True
        else:
            logger.warning(f"[WARN] 部分图片URL修复测试失败，成功率: {success_count/total_count*100:.1f}%")
            return False
        
    except Exception as e:
        logger.error(f"[FAIL] 测试多个图片URL失败: {e}")
        raise

async def main():
    """
    主函数
    """
    try:
        logger.info(f"开始URL修复测试: {datetime.now()}")
        
        # 测试多个图片
        result = await test_multiple_images()
        
        logger.info(f"URL修复测试完成: {datetime.now()}")
        logger.info(f"测试结果: {'成功' if result else '失败'}")
        
        return result
        
    except Exception as e:
        logger.error(f"[FAIL] 测试失败: {e}")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        if success:
            logger.info("[OK] 所有测试通过！")
            sys.exit(0)
        else:
            logger.error("[FAIL] 测试失败！")
            sys.exit(1)
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)
