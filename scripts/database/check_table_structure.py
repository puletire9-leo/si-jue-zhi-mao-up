#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查product_data_2025XX表的结构
"""

import mysql.connector

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

def check_table_structure(cursor, table_name):
    """检查指定表的结构"""
    query = f"""
    DESCRIBE {table_name}
    """
    try:
        cursor.execute(query)
        columns = cursor.fetchall()
        print(f"\n表 {table_name} 的结构:")
        print("-" * 80)
        print(f"{'字段名':<30} {'类型':<20} {'是否为空':<10} {'默认值':<10}")
        print("-" * 80)
        
        has_category_field = False
        for column in columns:
            field_name = column[0]
            field_type = column[1]
            null = column[2]
            default = column[4] if column[4] is not None else ''
            print(f"{field_name:<30} {field_type:<20} {null:<10} {default:<10}")
            
            # 检查是否有分类相关字段
            if 'category' in field_name.lower():
                has_category_field = True
        
        if has_category_field:
            print("\n✓ 表中包含分类相关字段")
        else:
            print("\n✗ 表中不包含分类相关字段")
            
        return has_category_field
        
    except Exception as e:
        print(f"查询表 {table_name} 结构失败: {e}")
        return False

def check_sample_data(cursor, table_name):
    """检查表中的示例数据"""
    query = f"""
    SELECT * FROM {table_name} LIMIT 5
    """
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        if rows:
            print(f"\n表 {table_name} 的示例数据 (前5条):")
            print("-" * 80)
            for row in rows:
                print(row)
            print("-" * 80)
        else:
            print(f"\n表 {table_name} 中没有数据")
    except Exception as e:
        print(f"查询表 {table_name} 示例数据失败: {e}")

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
    
    # 检查每个表的结构
    tables_with_category = []
    for table in tables:
        has_category = check_table_structure(cursor, table)
        if has_category:
            tables_with_category.append(table)
    
    # 检查有分类字段的表的示例数据
    if tables_with_category:
        print("\n" + "=" * 80)
        print("检查有分类字段的表的示例数据")
        print("=" * 80)
        for table in tables_with_category:
            check_sample_data(cursor, table)
    
    # 关闭连接
    cursor.close()
    conn.close()
    
    # 生成报告
    print("\n" + "=" * 80)
    print("表结构检查报告")
    print("=" * 80)
    print(f"总表数: {len(tables)}")
    print(f"包含分类字段的表数: {len(tables_with_category)}")
    if tables_with_category:
        print("\n包含分类字段的表:")
        for table in tables_with_category:
            print(f"- {table}")
    else:
        print("\n没有找到包含分类字段的表")

if __name__ == "__main__":
    main()
