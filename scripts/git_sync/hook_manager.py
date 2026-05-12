"""
Git钩子管理模块
管理Git钩子的自动触发机制
"""

import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List

from .config import load_git_sync_config


class GitHookManager:
    """
    Git钩子管理器
    负责安装和管理Git钩子
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化Git钩子管理器
        
        Args:
            config: 全局配置
        """
        self.config = config
        self.project_root = Path(__file__).parent.parent.parent
        self.hooks_dir = self.project_root / '.git' / 'hooks'
        self.logger = logging.getLogger(__name__)
        
        self.hooks_config = config['hooks']
        self.hooks_templates = {
            'pre-commit': self._get_pre_commit_template(),
            'post-commit': self._get_post_commit_template(),
            'pre-push': self._get_pre_push_template(),
            'post-merge': self._get_post_merge_template()
        }
    
    def install_hooks(self) -> bool:
        """
        安装所有Git钩子
        
        Returns:
            是否成功
        """
        self.logger.info("开始安装Git钩子...")
        
        if not self.hooks_dir.exists():
            self.logger.error("Git钩子目录不存在，请先初始化Git仓库")
            return False
        
        success = True
        
        for hook_name, hook_content in self.hooks_templates.items():
            if self._is_hook_enabled(hook_name):
                if self._install_hook(hook_name, hook_content):
                    self.logger.info(f"钩子 {hook_name} 安装成功")
                else:
                    self.logger.error(f"钩子 {hook_name} 安装失败")
                    success = False
            else:
                self.logger.info(f"钩子 {hook_name} 已禁用，跳过安装")
        
        if success:
            self.logger.info("所有Git钩子安装完成")
        else:
            self.logger.error("部分Git钩子安装失败")
        
        return success
    
    def _is_hook_enabled(self, hook_name: str) -> bool:
        """
        检查钩子是否启用
        
        Args:
            hook_name: 钩子名称
            
        Returns:
            是否启用
        """
        config_key = f"{hook_name}_enabled"
        return self.hooks_config.get(config_key, False)
    
    def _install_hook(self, hook_name: str, hook_content: str) -> bool:
        """
        安装单个Git钩子
        
        Args:
            hook_name: 钩子名称
            hook_content: 钩子内容
            
        Returns:
            是否成功
        """
        hook_file = self.hooks_dir / hook_name
        
        try:
            with open(hook_file, 'w', encoding='utf-8') as f:
                f.write(hook_content)
            
            os.chmod(hook_file, 0o755)
            
            return True
            
        except Exception as e:
            self.logger.error(f"安装钩子 {hook_name} 失败: {e}")
            return False
    
    def uninstall_hooks(self) -> bool:
        """
        卸载所有Git钩子
        
        Returns:
            是否成功
        """
        self.logger.info("开始卸载Git钩子...")
        
        success = True
        
        for hook_name in self.hooks_templates.keys():
            hook_file = self.hooks_dir / hook_name
            
            if hook_file.exists():
                try:
                    hook_file.unlink()
                    self.logger.info(f"钩子 {hook_name} 卸载成功")
                except Exception as e:
                    self.logger.error(f"卸载钩子 {hook_name} 失败: {e}")
                    success = False
        
        if success:
            self.logger.info("所有Git钩子卸载完成")
        else:
            self.logger.error("部分Git钩子卸载失败")
        
        return success
    
    def _get_pre_commit_template(self) -> str:
        """
        获取pre-commit钩子模板
        
        Returns:
            钩子内容
        """
        return '''#!/bin/bash
# Git Pre-commit Hook - 自动同步和命名规范检查
# 在提交代码前自动执行同步检查和命名规范检查

echo "🔍 正在执行pre-commit钩子..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# 运行命名规范检查
echo "📝 检查命名规范..."
python check/check_naming_convention_advanced.py --incremental
CHECK_RESULT=$?

if [ $CHECK_RESULT -ne 0 ]; then
    echo ""
    echo "❌ 发现命名规范问题，请修复后再提交"
    echo ""
    echo "🚫 提交已被阻止"
    exit 1
fi

echo "✅ 命名规范检查通过"

# 运行Git同步检查（如果配置了自动同步）
if [ -f "scripts/git_sync/auto_sync.py" ]; then
    echo "🔄 检查Git同步状态..."
    python scripts/git_sync/auto_sync.py --check-only
    SYNC_RESULT=$?
    
    if [ $SYNC_RESULT -ne 0 ]; then
        echo ""
        echo "⚠️ Git同步检查发现问题，请确认后再提交"
        echo ""
        echo "💡 提示：使用 --no-verify 参数可以跳过此检查"
        echo "🚫 提交已被阻止"
        exit 1
    fi
    
    echo "✅ Git同步检查通过"
fi

echo "✅ Pre-commit钩子检查完成"
echo "✅ 可以提交代码"
exit 0
'''
    
    def _get_post_commit_template(self) -> str:
        """
        获取post-commit钩子模板
        
        Returns:
            钩子内容
        """
        return '''#!/bin/bash
# Git Post-commit Hook - 自动推送
# 提交成功后自动推送到远程仓库

echo "📤 正在执行post-commit钩子..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# 检查是否配置了自动推送
if [ -f "scripts/git_sync/auto_sync.py" ]; then
    echo "🔄 执行自动推送..."
    python scripts/git_sync/auto_sync.py --push-only
fi

echo "✅ Post-commit钩子执行完成"
exit 0
'''
    
    def _get_pre_push_template(self) -> str:
        """
        获取pre-push钩子模板
        
        Returns:
            钩子内容
        """
        return '''#!/bin/bash
# Git Pre-push Hook - 同步验证
# 推送前验证同步状态

echo "🔍 正在执行pre-push钩子..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️ 检测到未提交的更改"
    echo ""
    echo "💡 提示："
    echo "   1. 先提交本地更改"
    echo "   2. 或使用 --no-verify 参数跳过此检查"
    echo ""
    echo "🚫 推送已被阻止"
    exit 1
fi

# 检查是否有冲突
if git diff --name-only --diff-filter=U | grep -q .; then
    echo "❌ 检测到未解决的冲突"
    echo ""
    echo "💡 提示："
    echo "   1. 先解决冲突"
    echo "   2. 提交解决后的更改"
    echo "   3. 或使用 --no-verify 参数跳过此检查"
    echo ""
    echo "🚫 推送已被阻止"
    exit 1
fi

echo "✅ Pre-push钩子检查完成"
echo "✅ 可以推送代码"
exit 0
'''
    
    def _get_post_merge_template(self) -> str:
        """
        获取post-merge钩子模板
        
        Returns:
            钩子内容
        """
        return '''#!/bin/bash
# Git Post-merge Hook - 合并后处理
# 合并完成后执行后续处理

echo "🔧 正在执行post-merge钩子..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# 检查是否有冲突
if git diff --name-only --diff-filter=U | grep -q .; then
    echo "⚠️ 合并后检测到冲突"
    echo ""
    echo "💡 提示：请手动解决冲突后提交"
else
    echo "✅ 合并成功，无冲突"
    
    # 运行依赖更新（如果需要）
    if [ -f "requirements.txt" ]; then
        echo "📦 检查Python依赖..."
        # 可以在这里添加依赖更新逻辑
    fi
    
    if [ -f "package.json" ]; then
        echo "📦 检查Node.js依赖..."
        # 可以在这里添加依赖更新逻辑
    fi
fi

echo "✅ Post-merge钩子执行完成"
exit 0
'''
    
    def list_hooks(self) -> List[str]:
        """
        列出已安装的钩子
        
        Returns:
            钩子名称列表
        """
        installed_hooks = []
        
        for hook_name in self.hooks_templates.keys():
            hook_file = self.hooks_dir / hook_name
            if hook_file.exists():
                installed_hooks.append(hook_name)
        
        return installed_hooks
    
    def get_hook_status(self) -> Dict[str, Any]:
        """
        获取钩子状态
        
        Returns:
            钩子状态字典
        """
        status = {
            "hooks_dir_exists": self.hooks_dir.exists(),
            "installed_hooks": [],
            "enabled_hooks": [],
            "disabled_hooks": []
        }
        
        for hook_name in self.hooks_templates.keys():
            hook_file = self.hooks_dir / hook_name
            is_installed = hook_file.exists()
            is_enabled = self._is_hook_enabled(hook_name)
            
            if is_installed:
                status['installed_hooks'].append(hook_name)
            
            if is_enabled:
                status['enabled_hooks'].append(hook_name)
            else:
                status['disabled_hooks'].append(hook_name)
        
        return status
