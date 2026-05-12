#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为 product_data_20XXXX 表添加性能优化索引
"""

import mysql.connector
import sys
import os

# 添加 backend 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

try:
    from backend.app.core.config import settings
    DB_CONFIG = {
        'host': settings.MYSQL_HOST,
        'user': settings.MYSQL_USER,
        'password': settings.MYSQL_PASSWORD,
        'database': settings.MYSQL_DATABASE,
        'port': settings.MYSQL_PORT
    }
except:
    # 默认配置
    DB_CONFIG = {
        'host': 'localhost',
        'user': 'root',
        'password': 'root',
        'database': 'sijuelishi_dev',
        'port': 3306
    }

# 需要添加的索引
INDEXES = [
    # 核心查询字段索引
    {'name': 'idx_date', 'column': 'date'},
    {'name': 'idx_asin', 'column': 'asin'},
    {'name': 'idx_main_category_rank', 'column': 'main_category_rank(100)'},  # 前缀索引
    {'name': 'idx_store', 'column': 'store'},
    {'name': 'idx_country', 'column': 'country'},
    {'name': 'idx_developer', 'column': 'developer'},
    
    # 复合索引 - 常用查询组合
    {'name': 'idx_date_category', 'columns': 'date, main_category_rank(100)'},
    {'name': 'idx_date_store', 'columns': 'date, store'},
    {'name': 'idx_date_country', 'columns': 'date, country'},
    {'name': 'idx_date_developer', 'columns': 'date, developer'},
    
    # 复合索引 - 分类统计查询
    {'name': 'idx_asin_category', 'columns': 'asin, main_category_rank(100)'},
    {'name': 'idx_date_asin', 'columns': 'date, asin'},
]

def get_tables(cursor):
    """获取所有 product_data_20XXXX 表"""
    cursor.execute("SHOW TABLES LIKE 'product_data_20%'")
    tables = cursor.fetchall()
    return [t[0] for t in tables]

def check_index_exists(cursor, table_name, index_name):
    """检查索引是否已存在"""
    cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = %s", (index_name,))
    result = cursor.fetchone()
    # 消耗完所有结果，避免 "Unread result found" 错误
    cursor.fetchall()
    return result is not None

def add_indexes():
    """为所有表添加索引"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        tables = get_tables(cursor)
        print(f"找到 {len(tables)} 个数据表")
        
        total_indexes = 0
        skipped_indexes = 0
        
        for table_name in tables:
            print(f"\n处理表: {table_name}")
            
            for index in INDEXES:
                index_name = index['name']
                
                # 检查索引是否已存在
                if check_index_exists(cursor, table_name, index_name):
                    print(f"  - 索引 {index_name} 已存在，跳过")
                    skipped_indexes += 1
                    continue
                
                # 构建创建索引的 SQL
                if 'columns' in index:
                    # 复合索引
                    sql = f"CREATE INDEX {index_name} ON {table_name} ({index['columns']})"
                else:
                    # 单列索引
                    sql = f"CREATE INDEX {index_name} ON {table_name} ({index['column']})"
                
                try:
                    cursor.execute(sql)
                    conn.commit()
                    print(f"  + 创建索引 {index_name} 成功")
                    total_indexes += 1
                except Exception as e:
                    print(f"  ! 创建索引 {index_name} 失败: {e}")
        
        cursor.close()
        conn.close()
        
        print(f"\n{'='*60}")
        print(f"索引创建完成!")
        print(f"  - 新建索引: {total_indexes} 个")
        print(f"  - 跳过已有: {skipped_indexes} 个")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    return True

def analyze_tables():
    """分析表以更新统计信息"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        tables = get_tables(cursor)
        print(f"\n分析表统计信息...")
        
        for table_name in tables:
            try:
                cursor.execute(f"ANALYZE TABLE {table_name}")
                conn.commit()
                print(f"  ✓ {table_name}")
            except Exception as e:
                print(f"  ✗ {table_name}: {e}")
        
        cursor.close()
        conn.close()
        print("表分析完成!")
        
    except Exception as e:
        print(f"分析表失败: {e}")

if __name__ == "__main__":
    print("="*60)
    print("数据库性能优化 - 添加索引")
    print("="*60)
    
    if add_indexes():
        analyze_tables()
        print("\n✅ 所有优化完成!")
    else:
        print("\n❌ 优化失败!")
        sys.exit(1)
