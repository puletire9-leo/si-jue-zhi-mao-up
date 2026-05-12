"""
创建开发环境数据库脚本
为开发环境创建独立的数据库，实现完全的环境隔离
"""

import os
import sys
import subprocess
import mysql.connector
from mysql.connector import Error

def create_dev_database():
    """创建开发环境数据库"""
    
    # 数据库配置
    db_config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': 'root'
    }
    
    dev_database = 'sijuelishi_dev'
    
    try:
        # 连接到MySQL服务器
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        # 创建开发环境数据库
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {dev_database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"✅ 开发环境数据库 '{dev_database}' 创建成功")
        
        # 从生产数据库复制表结构
        cursor.execute(f"USE {dev_database}")
        
        # 获取生产数据库的表结构
        cursor.execute("SHOW TABLES FROM sijuelishi")
        tables = [table[0] for table in cursor.fetchall()]
        
        # 先创建所有表（不包含外键约束）
        for table in tables:
            try:
                # 获取表结构
                cursor.execute(f"SHOW CREATE TABLE sijuelishi.{table}")
                create_table_sql = cursor.fetchone()[1]
                
                # 移除外键约束，避免依赖问题
                create_table_sql = create_table_sql.replace('CONSTRAINT', '-- CONSTRAINT')
                create_table_sql = create_table_sql.replace('FOREIGN KEY', '-- FOREIGN KEY')
                
                # 在开发数据库中创建表
                cursor.execute(create_table_sql)
                print(f"✅ 表 '{table}' 结构复制完成")
            except Error as e:
                if "already exists" in str(e):
                    print(f"⚠️ 表 '{table}' 已存在，跳过创建")
                else:
                    raise e
        
        # 然后添加外键约束（如果需要）
        # 这里可以后续添加外键约束的创建逻辑
        
        print("🎉 开发环境数据库创建完成，已实现完全的环境隔离")
        
    except Error as e:
        print(f"❌ 数据库创建失败: {e}")
        return False
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()
    
    return True

def update_dev_config():
    """更新开发环境配置使用独立数据库"""
    
    config_file = os.path.join(os.path.dirname(__file__), '..', '..', 'config', '.env.development')
    
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新数据库配置
    content = content.replace('MYSQL_DATABASE=sijuelishi', 'MYSQL_DATABASE=sijuelishi_dev')
    
    with open(config_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 开发环境配置文件已更新")

if __name__ == "__main__":
    print("🚀 开始创建开发环境独立数据库...")
    print("=" * 60)
    
    if create_dev_database():
        update_dev_config()
        print("=" * 60)
        print("🎉 环境隔离配置完成！")
        print("✅ 开发环境使用独立数据库: sijuelishi_dev")
        print("✅ 生产环境保持原有数据库: sijuelishi")
        print("✅ 完全的环境隔离已实现")
    else:
        print("❌ 环境隔离配置失败")