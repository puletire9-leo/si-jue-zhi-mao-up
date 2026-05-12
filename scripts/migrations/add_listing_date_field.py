#!/usr/bin/env python3
"""
数据库迁移脚本：在选品相关表中添加listing_date字段
"""

import asyncio
import aiomysql
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def add_listing_date_field():
    """在选品相关表中添加listing_date字段，并处理相关数据迁移"""
    try:
        # 数据库连接配置
        config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': 'root',  # 更新为实际密码
            'db': 'sijuelishi_dev',
            'charset': 'utf8mb4',
            'autocommit': True
        }
        
        # 连接数据库
        conn = await aiomysql.connect(**config)
        cursor = await conn.cursor()
        
        logger.info("✅ 连接到数据库成功")
        
        # 1. 检查并添加listing_date字段到selection_products表
        logger.info("\n1. 检查selection_products表")
        await cursor.execute("SHOW COLUMNS FROM selection_products LIKE 'listing_date'")
        result = await cursor.fetchone()
        
        if not result:
            alter_products_query = """
            ALTER TABLE selection_products 
            ADD COLUMN listing_date DATE NULL 
            COMMENT '上架时间'
            AFTER sales_volume
            """
            await cursor.execute(alter_products_query)
            logger.info("✅ 在selection_products表中添加listing_date字段成功")
        else:
            logger.info("✅ selection_products表中已存在listing_date字段")
        
        # 2. 检查并添加listing_date字段到selection_recycle_bin表
        logger.info("\n2. 检查selection_recycle_bin表")
        await cursor.execute("SHOW COLUMNS FROM selection_recycle_bin LIKE 'listing_date'")
        result = await cursor.fetchone()
        
        if not result:
            alter_recycle_bin_query = """
            ALTER TABLE selection_recycle_bin 
            ADD COLUMN listing_date DATE NULL 
            COMMENT '上架时间'
            AFTER sales_volume
            """
            await cursor.execute(alter_recycle_bin_query)
            logger.info("✅ 在selection_recycle_bin表中添加listing_date字段成功")
        else:
            logger.info("✅ selection_recycle_bin表中已存在listing_date字段")
        
        # 3. 关闭连接
        await cursor.close()
        conn.close()
        
        logger.info("\n✅ 数据库迁移完成")
        return True
        
    except Exception as e:
        logger.error(f"❌ 数据库迁移失败: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(add_listing_date_field())