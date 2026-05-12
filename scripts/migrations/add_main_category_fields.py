#!/usr/bin/env python3
"""
数据库迁移脚本：在选品相关表中添加主类目BSR相关字段
"""

import asyncio
import aiomysql
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def add_main_category_fields():
    """在选品相关表中添加主类目BSR相关字段"""
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
        
        # 需要添加的字段定义
        fields = [
            {
                'name': 'main_category_bsr_growth',
                'type': 'DECIMAL(10, 2)',
                'null': True,
                'comment': '主类目BSR增长率'
            },
            {
                'name': 'main_category_bsr_growth_rate',
                'type': 'DECIMAL(10, 2)',
                'null': True,
                'comment': '主类目BSR增长率百分比'
            },
            {
                'name': 'main_category_rank',
                'type': 'INT',
                'null': True,
                'comment': '主类目排名'
            }
        ]
        
        # 1. 处理selection_products表
        logger.info("\n1. 处理selection_products表")
        for field in fields:
            await cursor.execute(f"SHOW COLUMNS FROM selection_products LIKE '{field['name']}'")
            result = await cursor.fetchone()
            
            if not result:
                alter_query = f"""
                ALTER TABLE selection_products 
                ADD COLUMN {field['name']} {field['type']} {'' if field['null'] else 'NOT NULL'} 
                COMMENT '{field['comment']}'
                AFTER source
                """
                await cursor.execute(alter_query)
                logger.info(f"✅ 在selection_products表中添加{field['name']}字段成功")
            else:
                logger.info(f"✅ selection_products表中已存在{field['name']}字段")
        
        # 2. 处理selection_recycle_bin表
        logger.info("\n2. 处理selection_recycle_bin表")
        for field in fields:
            await cursor.execute(f"SHOW COLUMNS FROM selection_recycle_bin LIKE '{field['name']}'")
            result = await cursor.fetchone()
            
            if not result:
                alter_query = f"""
                ALTER TABLE selection_recycle_bin 
                ADD COLUMN {field['name']} {field['type']} {'' if field['null'] else 'NOT NULL'} 
                COMMENT '{field['comment']}'
                AFTER source
                """
                await cursor.execute(alter_query)
                logger.info(f"✅ 在selection_recycle_bin表中添加{field['name']}字段成功")
            else:
                logger.info(f"✅ selection_recycle_bin表中已存在{field['name']}字段")
        
        # 3. 关闭连接
        await cursor.close()
        conn.close()
        
        logger.info("\n✅ 数据库迁移完成")
        return True
        
    except Exception as e:
        logger.error(f"❌ 数据库迁移失败: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(add_main_category_fields())
