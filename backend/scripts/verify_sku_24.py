#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
验证SKU为24的定稿是否存在，并检查修改要求字段
"""

import pymysql
from pymysql.cursors import DictCursor
import sys
import os

# 添加项目根目录到Python路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app.config import settings

def verify_sku_24():
    """验证SKU为24的定稿是否存在"""
    print("=== 验证SKU为24的定稿 ===")
    print(f"当前环境: {settings.ENVIRONMENT}")
    print(f"数据库配置: {settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}")
    
    try:
        # 连接数据库
        conn = pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            charset='utf8mb4',
            cursorclass=DictCursor
        )
        
        try:
            with conn.cursor() as cursor:
                # 1. 检查final_drafts表是否存在
                cursor.execute("SHOW TABLES LIKE 'final_drafts'")
                tables = cursor.fetchall()
                if not tables:
                    print("[FAIL] final_drafts表不存在")
                    return False
                
                print("[OK] final_drafts表存在")
                
                # 2. 检查final_drafts表的结构，特别是modification_requirement字段
                cursor.execute("DESCRIBE final_drafts")
                columns = cursor.fetchall()
                
                print("\n[LIST] 表结构:")
                has_mod_req = False
                for col in columns:
                    # 兼容不同MySQL版本的返回字段
                    field = col.get('Field')
                    field_type = col.get('Type', '')
                    null_status = col.get('Null', '')
                    default_val = col.get('Default', '')
                    comment = col.get('Comment', '')
                    
                    print(f"   {field}: {field_type} {'NULL' if null_status == 'YES' else 'NOT NULL'} {default_val} {comment}")
                    if field == 'modification_requirement':
                        has_mod_req = True
                
                if not has_mod_req:
                    print("[FAIL] modification_requirement字段不存在")
                    return False
                
                print("[OK] modification_requirement字段存在")
                
                # 3. 检查SKU为24的定稿是否存在（字符串类型）
                print("\n[SEARCH] 检查SKU为'24'的定稿（字符串类型）:")
                cursor.execute("SELECT * FROM final_drafts WHERE sku = %s", ('24',))
                result_str = cursor.fetchall()
                print(f"   结果数量: {len(result_str)}")
                if result_str:
                    print(f"   [OK] 找到定稿: {result_str[0]['id']} - {result_str[0]['sku']}")
                    print(f"      批次: {result_str[0]['batch']}")
                    print(f"      载体: {result_str[0]['carrier']}")
                    print(f"      修改要求: {result_str[0]['modification_requirement']}")
                else:
                    print("   [FAIL] 未找到SKU为'24'的定稿（字符串类型）")
                
                # 4. 检查SKU为24的定稿是否存在（数字类型）
                print("\n[SEARCH] 检查SKU为24的定稿（数字类型）:")
                cursor.execute("SELECT * FROM final_drafts WHERE sku = %s", (24,))
                result_num = cursor.fetchall()
                print(f"   结果数量: {len(result_num)}")
                if result_num:
                    print(f"   [OK] 找到定稿: {result_num[0]['id']} - {result_num[0]['sku']}")
                    print(f"      批次: {result_num[0]['batch']}")
                    print(f"      载体: {result_num[0]['carrier']}")
                    print(f"      修改要求: {result_num[0]['modification_requirement']}")
                else:
                    print("   [FAIL] 未找到SKU为24的定稿（数字类型）")
                
                # 5. 检查所有定稿的SKU，看看实际格式
                print("\n[CHART] 查看所有定稿的SKU格式:")
                cursor.execute("SELECT id, sku, batch, carrier FROM final_drafts LIMIT 10")
                all_drafts = cursor.fetchall()
                print(f"   前10条定稿:")
                for draft in all_drafts:
                    print(f"   {draft['id']}: SKU='{draft['sku']}' (类型: {type(draft['sku']).__name__}), 批次: {draft['batch']}, 载体: {draft['carrier']}")
                
                # 6. 如果没有SKU为24的定稿，尝试创建一个用于测试
                if not result_str and not result_num:
                    print("\n[NOTE] 创建测试定稿（SKU='24'）")
                    insert_sql = """
                    INSERT INTO final_drafts (sku, batch, developer, carrier, element, modification_requirement, images, reference_images, status, create_time, update_time)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    """
                    test_data = (
                        '24',
                        '20260121',
                        'test_dev',
                        'test_carrier',
                        'test_element',
                        '初始测试修改要求',
                        '[]',
                        '[]',
                        'concept'
                    )
                    
                    try:
                        cursor.execute(insert_sql, test_data)
                        conn.commit()
                        print("[OK] 测试定稿创建成功")
                        
                        # 验证创建结果
                        cursor.execute("SELECT * FROM final_drafts WHERE sku = %s", ('24',))
                        new_draft = cursor.fetchone()
                        if new_draft:
                            print(f"   创建的定稿: {new_draft['id']} - {new_draft['sku']}")
                            print(f"   修改要求: {new_draft['modification_requirement']}")
                    except Exception as e:
                        print(f"[FAIL] 创建测试定稿失败: {e}")
                        conn.rollback()
                
                return True
        finally:
            conn.close()
    
    except Exception as e:
        print(f"[FAIL] 数据库操作失败: {e}")
        return False

if __name__ == "__main__":
    verify_sku_24()
