"""
选品管理数据库迁移脚本 - 添加缺失字段

此脚本用于在现有的 selection_products 和 selection_recycle_bin 表中添加缺失的字段
"""

MIGRATION_ADD_MISSING_FIELDS = """
ALTER TABLE selection_products 
ADD COLUMN IF NOT EXISTS product_link TEXT DEFAULT NULL COMMENT '商品链接' AFTER product_type,
ADD COLUMN IF NOT EXISTS sales_volume INT DEFAULT NULL COMMENT '销量' AFTER product_link,
ADD COLUMN IF NOT EXISTS listing_days INT DEFAULT NULL COMMENT '上架时间(天)' AFTER sales_volume,
ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50) DEFAULT NULL COMMENT '配送方式' AFTER listing_days,
ADD COLUMN IF NOT EXISTS similar_products TEXT DEFAULT NULL COMMENT '相似商品' AFTER delivery_method,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT NULL COMMENT '来源' AFTER similar_products,
ADD INDEX IF NOT EXISTS idx_source (source);
"""

MIGRATION_ADD_MISSING_FIELDS_RECYCLE_BIN = """
ALTER TABLE selection_recycle_bin 
ADD COLUMN IF NOT EXISTS product_link TEXT DEFAULT NULL COMMENT '商品链接' AFTER product_type,
ADD COLUMN IF NOT EXISTS sales_volume INT DEFAULT NULL COMMENT '销量' AFTER product_link,
ADD COLUMN IF NOT EXISTS listing_days INT DEFAULT NULL COMMENT '上架时间(天)' AFTER sales_volume,
ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50) DEFAULT NULL COMMENT '配送方式' AFTER listing_days,
ADD COLUMN IF NOT EXISTS similar_products TEXT DEFAULT NULL COMMENT '相似商品' AFTER delivery_method,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT NULL COMMENT '来源' AFTER similar_products;
"""

async def migrate_add_missing_fields(mysql_repo):
    """
    执行数据库迁移，添加缺失的字段
    
    Args:
        mysql_repo: MySQL仓库实例
    """
    try:
        await mysql_repo.execute_update(MIGRATION_ADD_MISSING_FIELDS)
        print("[OK] selection_products 表字段添加成功")
        
        await mysql_repo.execute_update(MIGRATION_ADD_MISSING_FIELDS_RECYCLE_BIN)
        print("[OK] selection_recycle_bin 表字段添加成功")
        
    except Exception as e:
        print(f"[FAIL] 数据库迁移失败: {e}")
        raise

if __name__ == "__main__":
    import sys
    import os
    
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
    
    import asyncio
    from app.repositories.mysql_repo import MySQLRepository
    from app.config import settings
    
    async def main():
        mysql = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            pool_size=settings.MYSQL_POOL_SIZE,
            pool_recycle=settings.MYSQL_POOL_RECYCLE,
            echo=settings.MYSQL_ECHO
        )
        
        await mysql.connect()
        await migrate_add_missing_fields(mysql)
        await mysql.disconnect()
    
    asyncio.run(main())
