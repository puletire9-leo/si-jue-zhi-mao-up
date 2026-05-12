#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
添加原始图片zip包字段到images表
"""

import os
import sys
import pymysql

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, project_root)

# 直接使用应用程序的配置
from backend.app.config import settings


def get_db():
    """
    获取数据库连接，使用与应用程序相同的配置
    """
    return pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )


def add_original_zip_fields():
    """
    向images表添加原始图片zip包相关字段
    """
    print("开始执行数据库迁移：添加原始图片zip包字段")
    
    # SQL语句
    # 添加字段的SQL（如果字段不存在）
    sql_add_filepath = """
    ALTER TABLE `images` 
    ADD COLUMN `original_zip_filepath` VARCHAR(500) DEFAULT NULL COMMENT '原始图片zip包路径';
    """
    
    sql_add_cos_key = """
    ALTER TABLE `images` 
    ADD COLUMN `original_zip_cos_key` VARCHAR(500) DEFAULT NULL COMMENT '原始图片zip包COS对象键';
    """
    
    # 修改字段长度的SQL
    sql_modify = """
    ALTER TABLE `images` 
    MODIFY COLUMN `original_zip_filepath` VARCHAR(500) DEFAULT NULL COMMENT '原始图片zip包路径',
    MODIFY COLUMN `original_zip_cos_key` VARCHAR(500) DEFAULT NULL COMMENT '原始图片zip包COS对象键';
    """
    
    # 添加索引的SQL
    sql_index_filepath = """
    ALTER TABLE `images` 
    ADD INDEX `idx_original_zip_filepath` (`original_zip_filepath`(255));
    """
    
    sql_index_cos_key = """
    ALTER TABLE `images` 
    ADD INDEX `idx_original_zip_cos_key` (`original_zip_cos_key`(255));
    """
    
    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            # 检查字段是否存在
            cur.execute("SHOW COLUMNS FROM `images` LIKE 'original_zip_filepath'")
            filepath_exists = cur.fetchone() is not None
            
            cur.execute("SHOW COLUMNS FROM `images` LIKE 'original_zip_cos_key'")
            cos_key_exists = cur.fetchone() is not None
            
            # 添加字段（如果不存在）
            if not filepath_exists:
                print("执行添加original_zip_filepath字段操作...")
                cur.execute(sql_add_filepath)
                print("添加original_zip_filepath字段成功")
            else:
                print("original_zip_filepath字段已存在，跳过添加")
            
            if not cos_key_exists:
                print("执行添加original_zip_cos_key字段操作...")
                cur.execute(sql_add_cos_key)
                print("添加original_zip_cos_key字段成功")
            else:
                print("original_zip_cos_key字段已存在，跳过添加")
            
            # 修改字段长度
            print("执行修改字段长度操作...")
            cur.execute(sql_modify)
            print("修改字段长度成功")
            
            # 检查索引是否存在
            cur.execute("SHOW INDEX FROM `images` WHERE Key_name = 'idx_original_zip_filepath'")
            filepath_index_exists = cur.fetchone() is not None
            
            cur.execute("SHOW INDEX FROM `images` WHERE Key_name = 'idx_original_zip_cos_key'")
            cos_key_index_exists = cur.fetchone() is not None
            
            # 添加索引（如果不存在）
            if not filepath_index_exists:
                print("执行添加original_zip_filepath索引操作...")
                cur.execute(sql_index_filepath)
                print("添加original_zip_filepath索引成功")
            else:
                print("idx_original_zip_filepath索引已存在，跳过添加")
            
            if not cos_key_index_exists:
                print("执行添加original_zip_cos_key索引操作...")
                cur.execute(sql_index_cos_key)
                print("添加original_zip_cos_key索引成功")
            else:
                print("idx_original_zip_cos_key索引已存在，跳过添加")
        
        conn.commit()
        print("数据库迁移完成：成功添加原始图片zip包字段")
        return True
    except Exception as e:
        print(f"数据库迁移失败: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    add_original_zip_fields()
