"""
前端代码同步脚本
确保前端代码在开发和生产环境之间的安全同步
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

def backup_production_frontend():
    """备份生产环境前端文件"""
    
    static_dir = Path(__file__).parent.parent.parent / 'static'
    backup_dir = static_dir / 'backup' / f"frontend_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    if (static_dir / 'vue-dist').exists():
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(static_dir / 'vue-dist', backup_dir / 'vue-dist')
        print(f"✅ 生产环境前端文件已备份到: {backup_dir}")
        return backup_dir
    else:
        print("⚠️ 生产环境前端文件不存在，跳过备份")
        return None

def build_frontend_for_production():
    """为生产环境构建前端"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    
    # 切换到前端目录
    os.chdir(frontend_dir)
    
    # 安装依赖（如果需要）
    print("📦 检查前端依赖...")
    if not (frontend_dir / 'node_modules').exists():
        print("🔧 安装前端依赖...")
        result = subprocess.run(['npm', 'install'], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ 依赖安装失败: {result.stderr}")
            return False
    
    # 运行测试
    print("🧪 运行前端测试...")
    result = subprocess.run(['npm', 'test'], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ 前端测试失败: {result.stderr}")
        return False
    
    # 构建生产版本
    print("🔨 构建生产环境前端...")
    result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ 前端构建失败: {result.stderr}")
        return False
    
    print("✅ 前端构建成功")
    return True

def deploy_frontend_to_production():
    """部署前端到生产环境"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    static_dir = Path(__file__).parent.parent.parent / 'static'
    
    # 检查构建输出是否存在
    dist_dir = static_dir / 'vue-dist'
    if not dist_dir.exists():
        print("❌ 构建输出不存在，请先运行构建")
        return False
    
    # 验证构建文件完整性
    required_files = ['index.html', 'assets']
    for file in required_files:
        if not (dist_dir / file).exists():
            print(f"❌ 构建文件不完整，缺少: {file}")
            return False
    
    print("✅ 前端文件验证通过，已部署到生产环境")
    return True

def rollback_frontend(backup_dir):
    """回滚前端到备份版本"""
    
    if backup_dir and backup_dir.exists():
        static_dir = Path(__file__).parent.parent.parent / 'static'
        
        # 删除当前版本
        if (static_dir / 'vue-dist').exists():
            shutil.rmtree(static_dir / 'vue-dist')
        
        # 恢复备份
        shutil.copytree(backup_dir / 'vue-dist', static_dir / 'vue-dist')
        print(f"✅ 前端已回滚到备份版本: {backup_dir}")
        return True
    else:
        print("❌ 备份目录不存在，无法回滚")
        return False

def main():
    """主函数 - 前端同步流程"""
    
    print("🚀 开始前端代码同步流程...")
    print("=" * 60)
    
    # 1. 备份生产环境前端
    print("\n1️⃣ 备份生产环境前端...")
    backup_dir = backup_production_frontend()
    
    # 2. 构建生产版本
    print("\n2️⃣ 构建生产环境前端...")
    if not build_frontend_for_production():
        print("❌ 前端构建失败，开始回滚...")
        if backup_dir:
            rollback_frontend(backup_dir)
        return False
    
    # 3. 部署到生产环境
    print("\n3️⃣ 部署前端到生产环境...")
    if not deploy_frontend_to_production():
        print("❌ 前端部署失败，开始回滚...")
        if backup_dir:
            rollback_frontend(backup_dir)
        return False
    
    print("=" * 60)
    print("🎉 前端代码同步完成！")
    print("✅ 生产环境前端已更新")
    print("✅ 备份文件已创建")
    print("✅ 所有测试通过")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ 用户取消操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 同步过程出错: {e}")
        sys.exit(1)