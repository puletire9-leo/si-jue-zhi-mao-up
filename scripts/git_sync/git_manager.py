"""
Git同步核心模块
执行基于Git的同步操作
"""

import os
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

from .config import load_git_sync_config, get_sync_paths, get_exclude_patterns


class GitSyncManager:
    """
    Git同步管理器
    负责执行基于Git的同步操作
    """
    
    def __init__(self, config: Dict[str, Any], environment: str):
        """
        初始化Git同步管理器
        
        Args:
            config: 全局配置
            environment: 当前环境
        """
        self.config = config
        self.environment = environment
        self.project_root = Path(__file__).parent.parent.parent
        self.logger = logging.getLogger(__name__)
        
        self.git_config = config['git']
        self.env_config = config['environments'][environment]
        self.sync_config = config['sync']
        
    def _run_git_command(self, command: List[str]) -> Tuple[bool, str, str]:
        """
        执行Git命令
        
        Args:
            command: Git命令列表
            
        Returns:
            (成功状态, 标准输出, 错误输出)
        """
        try:
            result = subprocess.run(
                ['git'] + command,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=False
            )
            
            success = result.returncode == 0
            return success, result.stdout, result.stderr
            
        except Exception as e:
            self.logger.error(f"执行Git命令失败: {e}")
            return False, "", str(e)
    
    def initialize_git(self) -> bool:
        """
        初始化Git仓库
        
        Returns:
            是否成功
        """
        self.logger.info("初始化Git仓库...")
        
        success, stdout, stderr = self._run_git_command(['init'])
        
        if success:
            self.logger.info("Git仓库初始化成功")
            return True
        else:
            self.logger.error(f"Git仓库初始化失败: {stderr}")
            return False
    
    def add_files(self, paths: List[str] = None) -> bool:
        """
        添加文件到暂存区
        
        Args:
            paths: 要添加的文件路径列表，None表示添加所有文件
            
        Returns:
            是否成功
        """
        if paths is None:
            paths = get_sync_paths(self.config, self.environment)
        
        self.logger.info(f"添加文件到暂存区: {paths}")
        
        for path in paths:
            success, stdout, stderr = self._run_git_command(['add', path])
            if not success:
                self.logger.error(f"添加文件失败 {path}: {stderr}")
                return False
        
        self.logger.info("文件添加成功")
        return True
    
    def commit_changes(self, message: str = None) -> bool:
        """
        提交更改
        
        Args:
            message: 提交消息
            
        Returns:
            是否成功
        """
        if message is None:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            message = self.git_config['commit_message_template'].format(
                timestamp=timestamp,
                env=self.environment
            )
        
        self.logger.info(f"提交更改: {message}")
        
        success, stdout, stderr = self._run_git_command(['commit', '-m', message])
        
        if success:
            self.logger.info("提交成功")
            return True
        else:
            if "nothing to commit" in stdout or "nothing to commit" in stderr:
                self.logger.info("没有需要提交的更改")
                return True
            self.logger.error(f"提交失败: {stderr}")
            return False
    
    def push_changes(self, remote: str = "origin", branch: str = None) -> bool:
        """
        推送更改到远程仓库
        
        Args:
            remote: 远程仓库名称
            branch: 分支名称
            
        Returns:
            是否成功
        """
        if not self.git_config['auto_push']:
            self.logger.info("自动推送已禁用")
            return True
        
        if not self.config['remote']['enabled']:
            self.logger.info("远程仓库未配置")
            return True
        
        if branch is None:
            branch = self.env_config['branch']
        
        self.logger.info(f"推送更改到远程仓库 {remote}/{branch}")
        
        success, stdout, stderr = self._run_git_command(['push', remote, branch])
        
        if success:
            self.logger.info("推送成功")
            return True
        else:
            self.logger.error(f"推送失败: {stderr}")
            return False
    
    def pull_changes(self, remote: str = "origin", branch: str = None) -> bool:
        """
        从远程仓库拉取更改
        
        Args:
            remote: 远程仓库名称
            branch: 分支名称
            
        Returns:
            是否成功
        """
        if not self.git_config['auto_pull']:
            self.logger.info("自动拉取已禁用")
            return True
        
        if not self.config['remote']['enabled']:
            self.logger.info("远程仓库未配置")
            return True
        
        if branch is None:
            branch = self.env_config['branch']
        
        self.logger.info(f"从远程仓库拉取更改 {remote}/{branch}")
        
        success, stdout, stderr = self._run_git_command(['pull', remote, branch])
        
        if success:
            self.logger.info("拉取成功")
            return True
        else:
            self.logger.error(f"拉取失败: {stderr}")
            return False
    
    def switch_branch(self, branch: str) -> bool:
        """
        切换分支
        
        Args:
            branch: 分支名称
            
        Returns:
            是否成功
        """
        self.logger.info(f"切换到分支: {branch}")
        
        success, stdout, stderr = self._run_git_command(['checkout', branch])
        
        if success:
            self.logger.info("分支切换成功")
            return True
        else:
            self.logger.error(f"分支切换失败: {stderr}")
            return False
    
    def create_branch(self, branch: str, base_branch: str = None) -> bool:
        """
        创建新分支
        
        Args:
            branch: 新分支名称
            base_branch: 基础分支名称
            
        Returns:
            是否成功
        """
        self.logger.info(f"创建新分支: {branch}")
        
        if base_branch:
            success, stdout, stderr = self._run_git_command(['checkout', '-b', branch, base_branch])
        else:
            success, stdout, stderr = self._run_git_command(['checkout', '-b', branch])
        
        if success:
            self.logger.info("分支创建成功")
            return True
        else:
            self.logger.error(f"分支创建失败: {stderr}")
            return False
    
    def merge_branch(self, source_branch: str, strategy: str = None) -> bool:
        """
        合并分支
        
        Args:
            source_branch: 源分支名称
            strategy: 合并策略
            
        Returns:
            是否成功
        """
        if strategy is None:
            strategy = self.sync_config['merge_strategy']
        
        self.logger.info(f"合并分支 {source_branch} (策略: {strategy})")
        
        success, stdout, stderr = self._run_git_command(['merge', source_branch, f'--strategy={strategy}'])
        
        if success:
            self.logger.info("分支合并成功")
            return True
        else:
            self.logger.error(f"分支合并失败: {stderr}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """
        获取Git状态
        
        Returns:
            状态信息字典
        """
        success, stdout, stderr = self._run_git_command(['status', '--porcelain'])
        
        status = {
            "has_changes": False,
            "modified_files": [],
            "added_files": [],
            "deleted_files": [],
            "untracked_files": []
        }
        
        if success:
            lines = stdout.strip().split('\n')
            for line in lines:
                if not line:
                    continue
                
                status_code = line[:2]
                file_path = line[3:]
                
                status['has_changes'] = True
                
                if status_code[0] == 'M' or status_code[1] == 'M':
                    status['modified_files'].append(file_path)
                elif status_code[0] == 'A':
                    status['added_files'].append(file_path)
                elif status_code[0] == 'D':
                    status['deleted_files'].append(file_path)
                elif status_code[0] == '?':
                    status['untracked_files'].append(file_path)
        
        return status
    
    def get_current_branch(self) -> str:
        """
        获取当前分支名称
        
        Returns:
            分支名称
        """
        success, stdout, stderr = self._run_git_command(['branch', '--show-current'])
        
        if success:
            return stdout.strip()
        else:
            self.logger.error(f"获取当前分支失败: {stderr}")
            return None
    
    def has_conflicts(self) -> bool:
        """
        检查是否有冲突
        
        Returns:
            是否有冲突
        """
        success, stdout, stderr = self._run_git_command(['diff', '--name-only', '--diff-filter=U'])
        
        if success:
            return len(stdout.strip()) > 0
        return False
    
    def resolve_conflicts(self, strategy: str = None) -> bool:
        """
        解决冲突
        
        Args:
            strategy: 解决策略
            
        Returns:
            是否成功
        """
        if strategy is None:
            strategy = self.sync_config['conflict_resolution']
        
        self.logger.info(f"解决冲突 (策略: {strategy})")
        
        if strategy == "theirs":
            success, stdout, stderr = self._run_git_command(['checkout', '--theirs', '.'])
        elif strategy == "ours":
            success, stdout, stderr = self._run_git_command(['checkout', '--ours', '.'])
        else:
            self.logger.info("手动解决冲突")
            return True
        
        if success:
            self.logger.info("冲突解决成功")
            return True
        else:
            self.logger.error(f"冲突解决失败: {stderr}")
            return False
    
    def auto_sync(self, target_env: str = None) -> Dict[str, Any]:
        """
        自动同步
        
        Args:
            target_env: 目标环境
            
        Returns:
            同步结果
        """
        result = {
            "success": True,
            "error": None,
            "operations": []
        }
        
        try:
            if not self.sync_config['auto_sync_enabled']:
                self.logger.info("自动同步已禁用")
                return result
            
            self.logger.info("开始自动同步...")
            
            current_branch = self.get_current_branch()
            if current_branch != self.env_config['branch']:
                self.switch_branch(self.env_config['branch'])
            
            status = self.get_status()
            
            if status['has_changes']:
                self.logger.info("检测到本地更改")
                
                if self.git_config['auto_commit']:
                    self.add_files()
                    self.commit_changes()
                    result['operations'].append("commit")
                
                if self.git_config['auto_push']:
                    self.push_changes()
                    result['operations'].append("push")
            
            if target_env:
                target_branch = self.config['environments'][target_env]['branch']
                self.logger.info(f"同步到目标环境: {target_env}")
                
                self.pull_changes()
                
                if self.merge_branch(target_branch):
                    self.push_changes()
                    result['operations'].append(f"merge_{target_env}")
            
            self.logger.info("自动同步完成")
            
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
            self.logger.error(f"自动同步失败: {e}")
        
        return result
