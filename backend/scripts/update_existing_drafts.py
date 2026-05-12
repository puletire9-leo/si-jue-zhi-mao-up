#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量更新现有定稿的本地缩略图路径

该脚本用于：
1. 遍历所有现有定稿记录
2. 为每张图片从腾讯云下载已生成的缩略图到本地
3. 更新数据库中的本地缩略图路径字段
4. 记录处理结果和错误信息
"""

import os
import sys
import asyncio
import logging
import json
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.repositories.mysql_repo import MySQLRepository
from app.api.v1.final_drafts import _download_local_thumbnail

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('update_existing_drafts.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def update_existing_drafts():
    """
    批量更新现有定稿的本地缩略图路径
    """
    mysql_repo = None
    
    try:
        logger.info("开始批量更新现有定稿的本地缩略图路径")
        
        # 初始化MySQL连接
        logger.info("初始化MySQL连接")
        mysql_repo = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE
        )
        
        await mysql_repo.connect()
        logger.info("MySQL连接成功")
        
        # 获取所有定稿记录
        logger.info("获取所有定稿记录")
        drafts = await mysql_repo.execute_query(
            "SELECT id, sku, images, reference_images, local_thumbnail_path, local_thumbnail_status FROM final_drafts",
            ()
        )
        
        total_drafts = len(drafts)
        logger.info(f"获取到 {total_drafts} 条定稿记录")
        
        # 统计信息
        success_count = 0
        failed_count = 0
        skipped_count = 0
        error_messages = []
        
        # 遍历处理每条定稿记录
        for index, draft in enumerate(drafts, 1):
            draft_id = draft.get('id')
            draft_sku = draft.get('sku')
            images = draft.get('images', '[]')
            reference_images = draft.get('reference_images', '[]')
            local_thumbnail_path = draft.get('local_thumbnail_path')
            local_thumbnail_status = draft.get('local_thumbnail_status')
            
            logger.info(f"处理第 {index}/{total_drafts} 条记录 - ID: {draft_id}, SKU: {draft_sku}")
            
            # 跳过已经有本地缩略图路径的记录
            if local_thumbnail_path:
                logger.info(f"跳过已处理的记录 - ID: {draft_id}, SKU: {draft_sku}, 本地路径: {local_thumbnail_path}")
                skipped_count += 1
                continue
            
            try:
                # 处理图片字段
                all_images = []
                
                # 处理images字段
                if isinstance(images, str):
                    try:
                        images_list = json.loads(images)
                        if isinstance(images_list, list):
                            all_images.extend(images_list)
                    except json.JSONDecodeError:
                        if images.strip():
                            all_images.append(images.strip())
                elif isinstance(images, list):
                    all_images.extend(images)
                
                # 处理reference_images字段
                if isinstance(reference_images, str):
                    try:
                        reference_images_list = json.loads(reference_images)
                        if isinstance(reference_images_list, list):
                            all_images.extend(reference_images_list)
                    except json.JSONDecodeError:
                        if reference_images.strip():
                            all_images.append(reference_images.strip())
                elif isinstance(reference_images, list):
                    all_images.extend(reference_images)
                
                # 过滤无效图片
                valid_images = [img for img in all_images if isinstance(img, str) and img.strip()]
                
                if not valid_images:
                    logger.warning(f"跳过无图片的记录 - ID: {draft_id}, SKU: {draft_sku}")
                    skipped_count += 1
                    continue
                
                # 优先使用第一张图片
                first_image = valid_images[0]
                logger.info(f"开始下载第一张图片的本地缩略图: {first_image}")
                
                # 下载本地缩略图
                local_path = await _download_local_thumbnail(first_image)
                
                if local_path:
                    logger.info(f"成功下载本地缩略图: {local_path}")
                    
                    # 更新数据库中的本地缩略图路径
                    update_query = """
                    UPDATE final_drafts 
                    SET local_thumbnail_path = %s, 
                        local_thumbnail_status = %s, 
                        local_thumbnail_updated_at = %s 
                    WHERE id = %s
                    """
                    update_params = [
                        local_path,
                        'completed',
                        datetime.now(),
                        draft_id
                    ]
                    await mysql_repo.execute_update(update_query, update_params)
                    
                    logger.info(f"成功更新本地缩略图路径 - ID: {draft_id}, SKU: {draft_sku}")
                    success_count += 1
                else:
                    logger.warning(f"下载本地缩略图失败: {first_image}")
                    # 更新数据库中的本地缩略图状态为失败
                    update_query = """
                    UPDATE final_drafts 
                    SET local_thumbnail_status = %s 
                    WHERE id = %s
                    """
                    await mysql_repo.execute_update(update_query, ['failed', draft_id])
                    failed_count += 1
                    error_messages.append(f"ID: {draft_id}, SKU: {draft_sku}, 错误: 下载缩略图失败")
                    
            except Exception as e:
                logger.error(f"处理定稿记录失败 - ID: {draft_id}, SKU: {draft_sku}, 错误: {str(e)}", exc_info=True)
                failed_count += 1
                error_messages.append(f"ID: {draft_id}, SKU: {draft_sku}, 错误: {str(e)}")
        
        # 输出统计信息
        logger.info("\n=== 处理完成 ===")
        logger.info(f"总记录数: {total_drafts}")
        logger.info(f"成功: {success_count}")
        logger.info(f"失败: {failed_count}")
        logger.info(f"跳过: {skipped_count}")
        
        if error_messages:
            logger.info("\n=== 错误信息 ===")
            for error_msg in error_messages:
                logger.info(error_msg)
        
        # 生成处理报告
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_drafts": total_drafts,
            "success_count": success_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "error_messages": error_messages
        }
        
        # 保存报告到文件
        report_file = f"update_existing_drafts_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"处理报告已保存到: {report_file}")
        
    except Exception as e:
        logger.error(f"批量处理失败 - 错误: {str(e)}", exc_info=True)
    finally:
        # 关闭数据库连接
        if mysql_repo:
            await mysql_repo.disconnect()
            logger.info("MySQL连接已关闭")
        
        logger.info("批量更新任务完成")

if __name__ == "__main__":
    # 运行批量更新任务
    asyncio.run(update_existing_drafts())
