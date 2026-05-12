"""
检查数据库表结构
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

async def check_database_tables():
    """检查数据库表结构"""
    print("[SEARCH] 检查数据库表结构...")
    
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
        
        # 查询所有表
        query = "SHOW TABLES"
        tables = await mysql_repo.execute_query(query)
        
        print(f"[CHART] 数据库 '{settings.MYSQL_DATABASE}' 中的表：")
        for table in tables:
            table_name = list(table.values())[0]
            print(f"   - {table_name}")
            
            # 查询表结构
            desc_query = f"DESCRIBE {table_name}"
            columns = await mysql_repo.execute_query(desc_query)
            print(f"     字段：")
            for column in columns:
                print(f"       {column['Field']} ({column['Type']})")
            print()
        
        return True
            
    except Exception as e:
        print(f"[FAIL] 检查数据库表结构失败: {e}")
        return False
    finally:
        # 关闭数据库连接
        if 'mysql_repo' in locals():
            await mysql_repo.disconnect()

async def main():
    """主函数"""
    print("=" * 50)
    print("数据库表结构检查")
    print("=" * 50)
    
    success = await check_database_tables()
    
    if success:
        print("\n[OK] 数据库表结构检查完成")
    else:
        print("\n[WARN] 数据库表结构检查失败")

if __name__ == "__main__":
    asyncio.run(main())