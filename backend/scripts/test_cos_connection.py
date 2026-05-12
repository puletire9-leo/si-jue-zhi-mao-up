"""
测试腾讯云COS链接状态
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.cos_service import cos_service

async def test_cos_connection():
    """测试COS连接状态"""
    print("[SEARCH] 开始测试腾讯云COS链接状态...")
    
    # 检查COS服务是否启用
    if not cos_service.is_enabled():
        print("[FAIL] 腾讯云COS服务未启用")
        return False
    
    print("[OK] COS服务已启用")
    
    try:
        # 测试获取存储空间信息
        storage_info = await cos_service.get_storage_info()
        print(f"[CHART] 存储空间信息: {storage_info}")
        
        if storage_info.get("status") == "available":
            print("[DONE] 腾讯云标准存储容量包链接成功！")
            print(f"   - 存储桶: {storage_info.get('bucket')}")
            print(f"   - 地域: {storage_info.get('region')}")
            print(f"   - 状态: {storage_info.get('status')}")
            return True
        else:
            print("[WARN] 存储桶连接存在问题")
            return False
            
    except Exception as e:
        print(f"[FAIL] COS连接测试失败: {e}")
        return False

async def test_upload_small_file():
    """测试小文件上传"""
    print("\n[OUTBOX] 测试文件上传功能...")
    
    # 创建一个测试文本文件
    test_content = b"This is a test file for COS connection verification"
    
    try:
        success, object_key, url = await cos_service.upload_image(
            test_content, "test_connection.txt"
        )
        
        if success:
            print(f"[OK] 测试文件上传成功")
            print(f"   - 对象键: {object_key}")
            print(f"   - 访问URL: {url}")
            
            # 测试文件删除
            delete_success, error_msg = await cos_service.delete_image(object_key)
            if delete_success:
                print("[OK] 测试文件清理成功")
            else:
                print(f"[WARN] 测试文件清理失败: {error_msg}")
                
            return True
        else:
            print(f"[FAIL] 测试文件上传失败: {url}")
            return False
            
    except Exception as e:
        print(f"[FAIL] 上传测试失败: {e}")
        return False

async def main():
    """主测试函数"""
    print("=" * 50)
    print("腾讯云标准存储容量包链接测试")
    print("=" * 50)
    
    # 测试连接
    connection_ok = await test_cos_connection()
    
    if connection_ok:
        # 测试上传功能
        upload_ok = await test_upload_small_file()
        
        if upload_ok:
            print("\n[DONE] 所有测试通过！标准存储容量包已成功链接！")
            print("\n[LIST] 下一步操作：")
            print("1. 执行数据库迁移脚本")
            print("2. 启动后端服务")
            print("3. 运行批量图片迁移")
        else:
            print("\n[WARN] 上传功能测试失败，请检查配置")
    else:
        print("\n[FAIL] 连接测试失败，请检查以下配置：")
        print("   - SecretId/SecretKey是否正确")
        print("   - 存储桶名称和地域是否正确")
        print("   - 网络连接是否正常")

if __name__ == "__main__":
    asyncio.run(main())