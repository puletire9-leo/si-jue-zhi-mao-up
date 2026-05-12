"""
开发环境到生产环境的同步脚本
提供安全、可控的代码同步机制
"""

import os
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

class DeploymentManager:
    """部署管理器"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.backup_dir = self.project_root / 'backups'
        self.log_file = self.project_root / 'logs' / 'deployment.log'
        
        # 确保目录存在
        self.backup_dir.mkdir(exist_ok=True)
        self.log_file.parent.mkdir(exist_ok=True)
    
    def log(self, message):
        """记录日志"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_message = f"[{timestamp}] {message}\n"
        
        print(log_message.strip())
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message)
    
    def create_backup(self):
        """创建生产环境备份"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = self.backup_dir / f'backup_production_{timestamp}'
        
        # 需要备份的目录
        backup_dirs = [
            'backend',
            'frontend',
            'config',
            'scripts'
        ]
        
        self.log("📦 开始创建生产环境备份...")
        
        try:
            backup_path.mkdir(exist_ok=True)
            
            for dir_name in backup_dirs:
                source_dir = self.project_root / dir_name
                if source_dir.exists():
                    dest_dir = backup_path / dir_name
                    shutil.copytree(source_dir, dest_dir)
                    self.log(f"✅ 已备份: {dir_name}")
            
            self.log(f"🎉 备份完成: {backup_path}")
            return backup_path
            
        except Exception as e:
            self.log(f"❌ 备份失败: {e}")
            return None
    
    def validate_changes(self):
        """验证开发环境的修改"""
        self.log("🔍 开始验证开发环境修改...")
        
        # 运行测试
        test_result = subprocess.run(
            [sys.executable, '-m', 'pytest', 'tests/', '-v'],
            cwd=self.project_root,
            capture_output=True,
            text=True
        )
        
        if test_result.returncode == 0:
            self.log("✅ 所有测试通过")
            return True
        else:
            self.log("❌ 测试失败，请修复后再部署")
            self.log(test_result.stdout)
            return False
    
    def sync_code_changes(self):
        """同步代码变更"""
        self.log("🔄 开始同步代码变更...")
        
        # 需要同步的目录和文件
        sync_items = [
            'backend/app',           # 后端应用代码
            'frontend/src',          # 前端源代码
            'frontend/package.json', # 前端依赖
            'frontend/package-lock.json',
            'config/.env.production', # 生产环境配置
            'scripts',               # 脚本文件
        ]
        
        for item in sync_items:
            source = self.project_root / item
            
            if source.exists():
                if source.is_dir():
                    # 同步目录
                    dest = self.project_root / item
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(source, dest)
                else:
                    # 同步文件
                    dest = self.project_root / item
                    shutil.copy2(source, dest)
                
                self.log(f"✅ 已同步: {item}")
    
    def update_dependencies(self):
        """更新依赖"""
        self.log("📦 开始更新依赖...")
        
        # 更新Python依赖
        try:
            subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r', 
                'requirements.txt'
            ], cwd=self.project_root, check=True)
            self.log("✅ Python依赖更新完成")
        except subprocess.CalledProcessError as e:
            self.log(f"❌ Python依赖更新失败: {e}")
            return False
        
        # 更新Node.js依赖
        try:
            subprocess.run(['npm', 'install'], 
                         cwd=self.project_root / 'frontend', check=True)
            self.log("✅ Node.js依赖更新完成")
        except subprocess.CalledProcessError as e:
            self.log(f"❌ Node.js依赖更新失败: {e}")
            return False
        
        return True
    
    def restart_services(self):
        """重启服务"""
        self.log("🔄 开始重启服务...")
        
        # 这里可以添加服务重启逻辑
        # 例如：重启FastAPI服务、重启前端开发服务器等
        
        self.log("✅ 服务重启完成（请手动重启生产环境服务）")
    
    def deploy(self, skip_tests=False):
        """执行部署"""
        self.log("🚀 开始部署流程...")
        print("=" * 60)
        
        # 1. 创建备份
        backup_path = self.create_backup()
        if not backup_path:
            self.log("❌ 部署中止：备份创建失败")
            return False
        
        # 2. 验证修改（可选）
        if not skip_tests:
            if not self.validate_changes():
                self.log("❌ 部署中止：验证失败")
                return False
        
        # 3. 同步代码
        self.sync_code_changes()
        
        # 4. 更新依赖
        if not self.update_dependencies():
            self.log("❌ 部署中止：依赖更新失败")
            return False
        
        # 5. 重启服务
        self.restart_services()
        
        self.log("🎉 部署完成！")
        print("=" * 60)
        return True

def main():
    """主函数"""
    manager = DeploymentManager()
    
    print("🚀 开发环境到生产环境同步工具")
    print("=" * 60)
    print("1. 完整部署（包含测试验证）")
    print("2. 快速部署（跳过测试）")
    print("3. 仅创建备份")
    print("4. 仅验证修改")
    print("=" * 60)
    
    choice = input("请选择操作 (1-4): ").strip()
    
    if choice == '1':
        manager.deploy(skip_tests=False)
    elif choice == '2':
        manager.deploy(skip_tests=True)
    elif choice == '3':
        manager.create_backup()
    elif choice == '4':
        manager.validate_changes()
    else:
        print("❌ 无效选择")

if __name__ == "__main__":
    main()