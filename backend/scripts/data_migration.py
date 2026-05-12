#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据迁移脚本
将旧字段数据迁移到新字段，统一使用新字段命名
"""

import mysql.connector
import sys
import os
import logging
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config.config import DB_CONFIG

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_migration.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

def get_db_connection():
    """获取数据库连接"""
    config = DB_CONFIG.copy()
    config.pop('cursorclass', None)  # mysql.connector不支持此参数
    return mysql.connector.connect(**config)

def analyze_current_state():
    """分析当前数据状态"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 统计各字段数据量
        queries = {
            'total_records': 'SELECT COUNT(*) FROM selection_products',
            'sales_count': 'SELECT COUNT(*) FROM selection_products WHERE sales_count IS NOT NULL',
            'sales_volume': 'SELECT COUNT(*) FROM selection_products WHERE sales_volume IS NOT NULL',
            'shop_name': 'SELECT COUNT(*) FROM selection_products WHERE shop_name IS NOT NULL',
            'store_name': 'SELECT COUNT(*) FROM selection_products WHERE store_name IS NOT NULL',
            'both_sales': 'SELECT COUNT(*) FROM selection_products WHERE sales_count IS NOT NULL AND sales_volume IS NOT NULL',
            'both_store': 'SELECT COUNT(*) FROM selection_products WHERE shop_name IS NOT NULL AND store_name IS NOT NULL',
            'sales_count_only': 'SELECT COUNT(*) FROM selection_products WHERE sales_count IS NOT NULL AND sales_volume IS NULL',
            'sales_volume_only': 'SELECT COUNT(*) FROM selection_products WHERE sales_volume IS NOT NULL AND sales_count IS NULL',
        }
        
        stats = {}
        for key, query in queries.items():
            cursor.execute(query)
            stats[key] = cursor.fetchone()[0]
        
        return stats
        
    finally:
        cursor.close()
        conn.close()

def migrate_sales_data():
    """迁移销售数据：将sales_count数据迁移到sales_volume"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 迁移数据：仅当sales_volume为空且sales_count有值时
        migration_query = """
        UPDATE selection_products 
        SET sales_volume = sales_count 
        WHERE sales_volume IS NULL AND sales_count IS NOT NULL
        """
        
        cursor.execute(migration_query)
        affected_rows = cursor.rowcount
        conn.commit()
        
        logging.info(f"销售数据迁移完成，影响记录数: {affected_rows}")
        return affected_rows
        
    except Exception as e:
        conn.rollback()
        logging.error(f"销售数据迁移失败: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def migrate_store_data():
    """迁移店铺数据：将shop_name数据迁移到store_name"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 迁移数据：仅当store_name为空且shop_name有值时
        migration_query = """
        UPDATE selection_products 
        SET store_name = shop_name 
        WHERE store_name IS NULL AND shop_name IS NOT NULL
        """
        
        cursor.execute(migration_query)
        affected_rows = cursor.rowcount
        conn.commit()
        
        logging.info(f"店铺数据迁移完成，影响记录数: {affected_rows}")
        return affected_rows
        
    except Exception as e:
        conn.rollback()
        logging.error(f"店铺数据迁移失败: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def drop_old_columns():
    """删除旧字段"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 删除旧字段
        drop_queries = [
            "ALTER TABLE selection_products DROP COLUMN sales_count",
            "ALTER TABLE selection_products DROP COLUMN shop_name",
        ]
        
        for query in drop_queries:
            cursor.execute(query)
            logging.info(f"执行SQL: {query}")
        
        conn.commit()
        logging.info("旧字段删除完成")
        
    except Exception as e:
        conn.rollback()
        logging.error(f"删除旧字段失败: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def verify_migration():
    """验证迁移结果"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 验证迁移后的数据状态
        verification_queries = {
            'total_records': 'SELECT COUNT(*) FROM selection_products',
            'sales_volume_not_null': 'SELECT COUNT(*) FROM selection_products WHERE sales_volume IS NOT NULL',
            'store_name_not_null': 'SELECT COUNT(*) FROM selection_products WHERE store_name IS NOT NULL',
            'sales_volume_range': 'SELECT MIN(sales_volume), MAX(sales_volume) FROM selection_products WHERE sales_volume IS NOT NULL',
        }
        
        results = {}
        for key, query in verification_queries.items():
            cursor.execute(query)
            results[key] = cursor.fetchone()
        
        return results
        
    finally:
        cursor.close()
        conn.close()

def main():
    """主函数"""
    logging.info("=== 开始数据迁移 ===")
    
    try:
        # 1. 分析当前状态
        logging.info("1. 分析当前数据状态...")
        initial_stats = analyze_current_state()
        logging.info(f"初始状态: {initial_stats}")
        
        # 2. 迁移销售数据
        logging.info("2. 迁移销售数据...")
        sales_migrated = migrate_sales_data()
        
        # 3. 迁移店铺数据
        logging.info("3. 迁移店铺数据...")
        store_migrated = migrate_store_data()
        
        # 4. 验证迁移结果
        logging.info("4. 验证迁移结果...")
        final_stats = verify_migration()
        logging.info(f"迁移后状态: {final_stats}")
        
        # 5. 删除旧字段（可选，需要谨慎操作）
        user_input = input("是否删除旧字段？(y/n): ")
        if user_input.lower() == 'y':
            logging.info("5. 删除旧字段...")
            drop_old_columns()
        else:
            logging.info("5. 跳过删除旧字段")
        
        logging.info("=== 数据迁移完成 ===")
        
        # 输出迁移报告
        print("\n=== 迁移报告 ===")
        print(f"销售数据迁移记录数: {sales_migrated}")
        print(f"店铺数据迁移记录数: {store_migrated}")
        print(f"迁移后销售数据总量: {final_stats['sales_volume_not_null'][0]}")
        print(f"迁移后店铺数据总量: {final_stats['store_name_not_null'][0]}")
        
    except Exception as e:
        logging.error(f"数据迁移过程出错: {e}")
        raise

if __name__ == "__main__":
    main()