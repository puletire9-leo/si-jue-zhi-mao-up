#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取开发数据库中product_data_2025XX表的分类信息
"""

import mysql.connector
import re
from collections import defaultdict

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

def extract_category(rank_string):
    """从main_category_rank字段中提取分类名称"""
    if not rank_string:
        return None
    # 匹配类似 "Garden|157423" 的格式（使用竖线分隔符）
    match = re.match(r'^([^|]+)\|\s*\d+', rank_string)
    if match:
        return match.group(1).strip()
    return None

def extract_categories_from_table(cursor, table_name):
    """从指定表中提取分类信息"""
    query = f"""
    SELECT main_category_rank FROM {table_name}
    WHERE main_category_rank IS NOT NULL AND main_category_rank != ''
    """
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        categories = []
        for row in rows:
            category = extract_category(row[0])
            if category:
                categories.append(category)
        return categories
    except Exception as e:
        print(f"查询表 {table_name} 失败: {e}")
        return []

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
    
    # 提取所有分类
    category_counts = defaultdict(int)
    total_records = 0
    
    for table in tables:
        categories = extract_categories_from_table(cursor, table)
        for category in categories:
            category_counts[category] += 1
        total_records += len(categories)
        print(f"表 {table}: 提取了 {len(categories)} 条分类记录")
    
    # 关闭连接
    cursor.close()
    conn.close()
    
    # 生成报告
    print("\n" + "="*80)
    print("开发数据库分类信息报告")
    print("="*80)
    print(f"总记录数: {total_records}")
    print(f"分类数量: {len(category_counts)}")
    print("\n分类列表 (按出现次数排序):")
    print("-"*80)
    
    # 按出现次数排序
    sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    
    for category, count in sorted_categories:
        print(f"{category}: {count} 条记录")
    
    print("\n" + "="*80)
    print("完整分类列表 (按字母顺序):")
    print("-"*80)
    
    # 按字母顺序排序
    alphabetical_categories = sorted(category_counts.keys())
    for category in alphabetical_categories:
        print(f"- {category}")

if __name__ == "__main__":
    main()
