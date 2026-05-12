"""
检查数据库中的本地图片数据
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

async def check_local_images():
    """检查本地图片数据"""
    print("[SEARCH] 检查数据库中的本地图片数据...")
    
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
        
        # 检查selection_products表中的本地图片
        query = """
            SELECT 
                id, asin, product_title, local_path, thumb_path, image_url
            FROM selection_products 
            WHERE local_path IS NOT NULL AND local_path != ''
            LIMIT 10
        """
        
        local_images = await mysql_repo.execute_query(query)
        
        print(f"[CHART] 找到 {len(local_images)} 张本地图片：")
        for image in local_images:
            print(f"   - ID: {image['id']}")
            print(f"     ASIN: {image['asin']}")
            print(f"     标题: {image['product_title']}")
            print(f"     本地路径: {image['local_path']}")
            print(f"     缩略图路径: {image['thumb_path']}")
            print(f"     图片URL: {image['image_url']}")
            print()
        
        # 检查其他可能包含图片的表
        tables_to_check = [
            'products',
            'selection_new_products', 
            'selection_reference_products'
        ]
        
        for table in tables_to_check:
            print(f"\n[SEARCH] 检查表 {table} 中的图片数据...")
            
            # 根据表结构确定图片字段
            if table == 'products':
                image_fields = ['image']
            elif table == 'selection_new_products':
                image_fields = ['image_path', 'thumbnail_path']
            elif table == 'selection_reference_products':
                image_fields = ['image_path', 'thumbnail_path']
            
            for field in image_fields:
                query = f"""
                    SELECT COUNT(*) as count 
                    FROM {table} 
                    WHERE {field} IS NOT NULL AND {field} != ''
                """
                result = await mysql_repo.execute_query(query, fetch_one=True)
                count = result['count'] if result else 0
                
                if count > 0:
                    print(f"   - {field}: {count} 条记录")
                    
                    # 查看前几条记录
                    sample_query = f"""
                        SELECT {field} 
                        FROM {table} 
                        WHERE {field} IS NOT NULL AND {field} != ''
                        LIMIT 3
                    """
                    samples = await mysql_repo.execute_query(sample_query)
                    for sample in samples:
                        print(f"     示例: {sample[field]}")
                else:
                    print(f"   - {field}: 无数据")
        
        return True
            
    except Exception as e:
        print(f"[FAIL] 检查本地图片数据失败: {e}")
        return False
    finally:
        # 关闭数据库连接
        if 'mysql_repo' in locals():
            await mysql_repo.disconnect()

async def main():
    """主函数"""
    print("=" * 50)
    print("本地图片数据检查")
    print("=" * 50)
    
    success = await check_local_images()
    
    if success:
        print("\n[OK] 本地图片数据检查完成")
    else:
        print("\n[WARN] 本地图片数据检查失败")

if __name__ == "__main__":
    asyncio.run(main())