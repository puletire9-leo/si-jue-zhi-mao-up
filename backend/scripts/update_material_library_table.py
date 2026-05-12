#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新素材库表结构，添加 final_draft_images 字段

此脚本用于向现有的 material_library 和 material_library_recycle_bin 表中添加 final_draft_images 字段，
确保设计稿图片能够正确存储和读取。
"""

import os
import sys
import logging
import json
from typing import Dict, Any

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.app.repositories.mysql_repo import MySQLRepository

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_database_config() -> Dict[str, Any]:
    """加载数据库配置"""
    try:
        from backend.app.config import settings
        return {
            'host': settings.MYSQL_HOST,
            'port': settings.MYSQL_PORT,
            'user': settings.MYSQL_USER,
            'password': settings.MYSQL_PASSWORD,
            'database': settings.MYSQL_DATABASE,
            'charset': settings.MYSQL_CONNECT_ARGS.get('charset', 'utf8mb4')
        }
    except Exception as e:
        logger.error(f"加载数据库配置失败: {e}")
        # 使用默认配置
        return {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': '',
            'database': 'sijuelishi_dev',
            'charset': 'utf8mb4'
        }

async def update_database_table():
    """更新数据库表结构"""
    try:
        logger.info("开始更新数据库表结构")
        
        # 加载数据库配置
        db_config = load_database_config()
        logger.info(f"数据库配置: {db_config['host']}:{db_config['port']}/{db_config['database']}")
        
        # 创建数据库连接
        mysql_repo = MySQLRepository(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )
        
        # 连接到数据库
        await mysql_repo.connect()
        
        # 执行 SQL 语句
        async with mysql_repo.get_connection() as conn:
            async with conn.cursor() as cursor:
                # 更新 material_library 表
                logger.info("更新 material_library 表，添加 final_draft_images 字段")
                add_final_draft_images_material = """
                ALTER TABLE material_library
                ADD COLUMN IF NOT EXISTS final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式'
                """
                await cursor.execute(add_final_draft_images_material)
                await conn.commit()
                logger.info("material_library 表更新成功")
                
                # 更新 material_library_recycle_bin 表
                logger.info("更新 material_library_recycle_bin 表，添加 final_draft_images 字段")
                add_final_draft_images_recycle = """
                ALTER TABLE material_library_recycle_bin
                ADD COLUMN IF NOT EXISTS final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式'
                """
                await cursor.execute(add_final_draft_images_recycle)
                await conn.commit()
                logger.info("material_library_recycle_bin 表更新成功")
        
        # 关闭数据库连接
        await mysql_repo.disconnect()
        
        logger.info("数据库表结构更新完成")
        print("[OK] 数据库表结构更新成功！")
        print("[OK] material_library 表已添加 final_draft_images 字段")
        print("[OK] material_library_recycle_bin 表已添加 final_draft_images 字段")
        
    except Exception as e:
        logger.error(f"更新数据库表结构失败: {e}", exc_info=True)
        print(f"[FAIL] 更新数据库表结构失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(update_database_table())
