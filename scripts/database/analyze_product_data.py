#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析sijuelishi_dev数据库中的product_data_2025XX表
"""

import mysql.connector
import pandas as pd

# 数据库连接信息
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root',
    'database': 'sijuelishi_dev'
}

def connect_to_database():
    """连接到数据库"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        print("数据库连接成功")
        return conn
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return None

def get_product_data_tables(cursor):
    """获取所有product_data_2025XX表"""
    query = """
    SHOW TABLES LIKE 'product_data_2025%'
    """
    cursor.execute(query)
    tables = cursor.fetchall()
    return [table[0] for table in tables]

def analyze_table_structure(cursor, table_name):
    """分析表结构"""
    query = f"""
    DESCRIBE {table_name}
    """
    try:
        cursor.execute(query)
        columns = cursor.fetchall()
        print(f"\n表 {table_name} 的结构:")
        print("-" * 100)
        print(f"{'字段名':<30} {'类型':<20} {'是否为空':<10} {'默认值':<10} {'键':<10}")
        print("-" * 100)
        
        field_info = []
        for column in columns:
            field_name = column[0]
            field_type = column[1]
            null = column[2]
            key = column[3]
            default = column[4] if column[4] is not None else ''
            print(f"{field_name:<30} {field_type:<20} {null:<10} {default:<10} {key:<10}")
            field_info.append({
                'field_name': field_name,
                'field_type': field_type,
                'null': null,
                'key': key,
                'default': default
            })
        return field_info
    except Exception as e:
        print(f"分析表 {table_name} 结构失败: {e}")
        return []

def get_table_sample(cursor, table_name, limit=5):
    """获取表数据样本"""
    query = f"""
    SELECT * FROM {table_name} LIMIT {limit}
    """
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        print(f"\n表 {table_name} 的数据样本 (前{limit}条):")
        print("-" * 100)
        
        # 只显示前10个字段，避免输出过长
        display_columns = columns[:10]
        print(f"{'序号':<5} {' | '.join(display_columns)}")
        print("-" * 100)
        
        for i, row in enumerate(rows, 1):
            display_values = [str(row[j])[:20] for j in range(min(10, len(row)))]
            print(f"{i:<5} {' | '.join(display_values)}")
        
        print("-" * 100)
        print(f"总计: {len(rows)} 条记录")
        
        return rows, columns
    except Exception as e:
        print(f"获取表 {table_name} 数据样本失败: {e}")
        return [], []

def analyze_table_data(cursor, table_name):
    """分析表数据统计信息"""
    # 获取记录数
    count_query = f"SELECT COUNT(*) FROM {table_name}"
    cursor.execute(count_query)
    count = cursor.fetchone()[0]
    print(f"\n表 {table_name} 的数据统计:")
    print(f"记录数: {count}")
    
    # 获取main_category_rank字段的不同值
    category_query = f"""
    SELECT DISTINCT main_category_rank 
    FROM {table_name} 
    WHERE main_category_rank IS NOT NULL AND main_category_rank != ''
    LIMIT 10
    """
    cursor.execute(category_query)
    categories = cursor.fetchall()
    print(f"\n分类样本 (前10个):")
    for i, category in enumerate(categories, 1):
        print(f"{i}. {category[0]}")

def main():
    """主函数"""
    conn = connect_to_database()
    if not conn:
        return
    
    cursor = conn.cursor()
    
    # 获取所有product_data_2025XX表
    tables = get_product_data_tables(cursor)
    print(f"找到 {len(tables)} 个product_data表:")
    for table in tables:
        print(f"- {table}")
    
    # 分析每个表
    for table in tables:
        print("\n" + "="*120)
        print(f"分析表: {table}")
        print("="*120)
        
        # 分析表结构
        analyze_table_structure(cursor, table)
        
        # 获取数据样本
        get_table_sample(cursor, table)
        
        # 分析数据统计
        analyze_table_data(cursor, table)
    
    # 关闭连接
    cursor.close()
    conn.close()
    
    print("\n" + "="*120)
    print("数据库分析完成")
    print("="*120)

if __name__ == "__main__":
    main()
