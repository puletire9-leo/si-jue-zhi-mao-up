"""
测试单张图片迁移到腾讯云COS
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from cos_migration import COSMigrationTool
from app.config import settings

async def test_single_migration():
    """测试单张图片迁移"""
    print("[SEARCH] 开始测试单张图片迁移功能...")
    
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
        
        # 创建迁移工具
        migration_tool = COSMigrationTool(mysql_repo)
        
        # 检查COS服务状态
        if not migration_tool.cos_service.is_enabled():
            print("[FAIL] 腾讯云COS服务未启用")
            return False
        
        print("[OK] COS服务已启用")
        
        # 获取需要迁移的图片列表
        candidates = await migration_tool.get_migration_candidates()
        
        if not candidates:
            print("[WARN] 没有找到需要迁移的图片")
            return False
        
        print(f"[CHART] 找到 {len(candidates)} 张需要迁移的图片")
        
        # 选择第一张图片进行测试
        test_image = candidates[0]
        image_id = test_image['id']
        
        print(f"[TEST] 测试迁移图片 ID: {image_id}")
        print(f"   - 文件名: {test_image.get('filename', 'N/A')}")
        print(f"   - 文件路径: {test_image.get('filepath', 'N/A')}")
        
        # 执行单张图片迁移
        result = await migration_tool.migrate_single_image(image_id)
        
        if result.get('success'):
            print("[OK] 单张图片迁移测试成功！")
            print(f"   - COS对象键: {result.get('cos_object_key')}")
            print(f"   - COS访问URL: {result.get('cos_url')}")
            
            # 验证迁移结果
            updated_image = await mysql_repo.get_image_by_id(image_id)
            if updated_image and updated_image.get('storage_type') == 'cos':
                print("[OK] 数据库记录已成功更新")
                return True
            else:
                print("[WARN] 数据库记录更新验证失败")
                return False
        else:
            print(f"[FAIL] 单张图片迁移测试失败: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"[FAIL] 迁移测试过程中出现异常: {e}")
        return False
    finally:
        # 关闭数据库连接
        if 'mysql_repo' in locals():
            await mysql_repo.disconnect()

async def main():
    """主函数"""
    print("=" * 50)
    print("单张图片迁移功能测试")
    print("=" * 50)
    
    success = await test_single_migration()
    
    if success:
        print("\n[DONE] 单张图片迁移功能测试通过！")
        print("\n[LIST] 下一步：可以开始批量迁移所有本地图片到云端")
    else:
        print("\n[WARN] 单张图片迁移功能测试失败")
        print("请检查数据库连接和图片文件路径")

if __name__ == "__main__":
    asyncio.run(main())