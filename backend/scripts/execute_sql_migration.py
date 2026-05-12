#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
执行 SQL 迁移脚本

使用项目中现有的 MySQLRepository 来执行 SQL 脚本，确保使用正确的数据库连接配置。
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

async def execute_sql_script(script_path: str):
    """
    执行 SQL 脚本
    
    Args:
        script_path: SQL 脚本文件路径
    
    Returns:
        bool: 是否执行成功
    """
    print(f"[SEARCH] 开始执行 SQL 脚本: {script_path}")
    
    try:
        # 初始化数据库连接
        mysql_repo = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            pool_size=settings.MYSQL_POOL_SIZE,
            pool_recycle=settings.MYSQL_POOL_RECYCLE,
            echo=settings.MYSQL_ECHO
        )
        await mysql_repo.connect()
        
        # 读取 SQL 脚本文件
        with open(script_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # 分割 SQL 语句
        sql_statements = []
        current_statement = ""
        
        for line in sql_content.splitlines():
            line = line.strip()
            # 跳过注释和空行
            if not line or line.startswith('--'):
                continue
            current_statement += line + " "
            # 如果遇到分号，说明是完整的 SQL 语句
            if line.endswith(';'):
                sql_statements.append(current_statement)
                current_statement = ""
        
        # 如果还有未处理的语句，添加到列表中
        if current_statement.strip():
            sql_statements.append(current_statement)
        
        print(f"[LIST] 找到 {len(sql_statements)} 条 SQL 语句")
        
        # 执行每条 SQL 语句
        for i, sql in enumerate(sql_statements, 1):
            print(f"[PIN] 执行第 {i} 条语句: {sql[:50]}...")
            try:
                if "SELECT" in sql.upper():
                    # 查询语句
                    result = await mysql_repo.execute_query(sql)
                    print(f"[OK] 查询结果: {len(result)} 行")
                else:
                    # 更新/插入/删除语句
                    result = await mysql_repo.execute_update(sql)
                    print(f"[OK] 执行成功，影响行数: {result}")
            except Exception as e:
                print(f"[FAIL] 执行第 {i} 条语句失败: {e}")
                print(f"   SQL: {sql}")
                return False
        
        print("[DONE] 所有 SQL 语句执行成功！")
        return True
        
    except Exception as e:
        print(f"[FAIL] 执行 SQL 脚本失败: {e}")
        return False
    finally:
        # 关闭数据库连接
        if 'mysql_repo' in locals():
            await mysql_repo.disconnect()

async def main():
    """主函数"""
    print("=" * 50)
    print("SQL 迁移脚本执行工具")
    print("=" * 50)
    
    # 检查命令行参数
    if len(sys.argv) != 2:
        print("Usage: python execute_sql_migration.py <script_path>")
        print("Example: python execute_sql_migration.py ../migrations/add_image_storage_fields.sql")
        return False
    
    script_path = sys.argv[1]
    
    # 检查脚本文件是否存在
    if not os.path.exists(script_path):
        print(f"[FAIL] SQL 脚本文件不存在: {script_path}")
        return False
    
    # 执行脚本
    success = await execute_sql_script(script_path)
    
    if success:
        print("\n[DONE] 迁移脚本执行完成！")
    else:
        print("\n[WARN] 迁移脚本执行失败")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())
