"""
Git冲突检测和解决模块
检测和解决Git同步冲突
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, List
import difflib

from .config import load_git_sync_config


class GitConflictManager:
    """
    Git冲突管理器
    负责检测和解决Git同步冲突
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化Git冲突管理器
        
        Args:
            config: 全局配置
        """
        self.config = config
        self.project_root = Path(__file__).parent.parent.parent
        self.logger = logging.getLogger(__name__)
        
        self.sync_config = config['sync']
        self.conflict_resolution = self.sync_config['conflict_resolution']
        self.merge_strategy = self.sync_config['merge_strategy']
        self.auto_merge = self.sync_config['auto_merge']
    
    def detect_conflicts(self) -> List[Dict[str, Any]]:
        """
        检测Git冲突
        
        Returns:
            冲突列表
        """
        conflicts = []
        
        try:
            import subprocess
            result = subprocess.run(
                ['git', 'diff', '--name-only', '--diff-filter=U'],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                conflict_files = result.stdout.strip().split('\n')
                conflict_files = [f for f in conflict_files if f]
                
                for file_path in conflict_files:
                    conflict_info = self._analyze_conflict(file_path)
                    if conflict_info:
                        conflicts.append(conflict_info)
            
        except Exception as e:
            self.logger.error(f"检测冲突失败: {e}")
        
        return conflicts
    
    def _analyze_conflict(self, file_path: str) -> Dict[str, Any]:
        """
        分析单个文件的冲突
        
        Args:
            file_path: 文件路径
            
        Returns:
            冲突信息字典
        """
        full_path = self.project_root / file_path
        
        if not full_path.exists():
            return None
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            conflict_markers = content.count('<<<<<<<')
            
            conflict_info = {
                "file_path": file_path,
                "full_path": str(full_path),
                "conflict_count": conflict_markers,
                "conflict_type": self._determine_conflict_type(content),
                "size": full_path.stat().st_size if full_path.exists() else 0
            }
            
            return conflict_info
            
        except Exception as e:
            self.logger.error(f"分析冲突文件 {file_path} 失败: {e}")
            return None
    
    def _determine_conflict_type(self, content: str) -> str:
        """
        确定冲突类型
        
        Args:
            content: 文件内容
            
        Returns:
            冲突类型
        """
        if '<<<<<<< HEAD' in content:
            return "merge_conflict"
        elif '<<<<<<<' in content:
            return "general_conflict"
        else:
            return "unknown"
    
    def resolve_conflict(self, file_path: str, strategy: str = None) -> bool:
        """
        解决单个文件的冲突
        
        Args:
            file_path: 文件路径
            strategy: 解决策略
            
        Returns:
            是否成功
        """
        if strategy is None:
            strategy = self.conflict_resolution
        
        self.logger.info(f"解决冲突 {file_path} (策略: {strategy})")
        
        try:
            import subprocess
            
            if strategy == "ours":
                result = subprocess.run(
                    ['git', 'checkout', '--ours', file_path],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    check=False
                )
                
                if result.returncode == 0:
                    subprocess.run(
                        ['git', 'add', file_path],
                        cwd=self.project_root,
                        capture_output=True,
                        text=True,
                        check=False
                    )
                    self.logger.info(f"使用ours策略解决冲突 {file_path} 成功")
                    return True
                
            elif strategy == "theirs":
                result = subprocess.run(
                    ['git', 'checkout', '--theirs', file_path],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    check=False
                )
                
                if result.returncode == 0:
                    subprocess.run(
                        ['git', 'add', file_path],
                        cwd=self.project_root,
                        capture_output=True,
                        text=True,
                        check=False
                    )
                    self.logger.info(f"使用theirs策略解决冲突 {file_path} 成功")
                    return True
                
            elif strategy == "manual":
                self.logger.info(f"冲突 {file_path} 需要手动解决")
                return True
            
            else:
                self.logger.error(f"未知的冲突解决策略: {strategy}")
                return False
            
            self.logger.error(f"解决冲突 {file_path} 失败")
            return False
            
        except Exception as e:
            self.logger.error(f"解决冲突 {file_path} 失败: {e}")
            return False
    
    def resolve_all_conflicts(self, strategy: str = None) -> Dict[str, Any]:
        """
        解决所有冲突
        
        Args:
            strategy: 解决策略
            
        Returns:
            解决结果
        """
        result = {
            "success": True,
            "error": None,
            "total_conflicts": 0,
            "resolved_conflicts": 0,
            "failed_conflicts": 0,
            "conflict_details": []
        }
        
        conflicts = self.detect_conflicts()
        result['total_conflicts'] = len(conflicts)
        
        if not conflicts:
            self.logger.info("没有检测到冲突")
            return result
        
        self.logger.info(f"检测到 {len(conflicts)} 个冲突")
        
        for conflict in conflicts:
            file_path = conflict['file_path']
            
            if self.resolve_conflict(file_path, strategy):
                result['resolved_conflicts'] += 1
                result['conflict_details'].append({
                    "file_path": file_path,
                    "status": "resolved",
                    "strategy": strategy or self.conflict_resolution
                })
            else:
                result['failed_conflicts'] += 1
                result['conflict_details'].append({
                    "file_path": file_path,
                    "status": "failed",
                    "strategy": strategy or self.conflict_resolution
                })
        
        if result['failed_conflicts'] > 0:
            result['success'] = False
            result['error'] = f"{result['failed_conflicts']} 个冲突解决失败"
        
        return result
    
    def get_conflict_resolution_options(self) -> List[Dict[str, Any]]:
        """
        获取冲突解决选项
        
        Returns:
            解决选项列表
        """
        options = [
            {
                "id": "ours",
                "name": "保留本地版本",
                "description": "使用当前分支的版本，丢弃远程版本",
                "recommended": False
            },
            {
                "id": "theirs",
                "name": "保留远程版本",
                "description": "使用远程分支的版本，丢弃本地版本",
                "recommended": False
            },
            {
                "id": "manual",
                "name": "手动解决",
                "description": "手动编辑文件解决冲突",
                "recommended": True
            }
        ]
        
        return options
    
    def create_conflict_report(self) -> Dict[str, Any]:
        """
        创建冲突报告
        
        Returns:
            冲突报告
        """
        conflicts = self.detect_conflicts()
        
        report = {
            "timestamp": None,
            "total_conflicts": len(conflicts),
            "conflicts": conflicts,
            "resolution_options": self.get_conflict_resolution_options(),
            "recommendations": []
        }
        
        if conflicts:
            report['recommendations'].append("建议先备份当前工作")
            report['recommendations'].append("使用git status查看详细冲突信息")
            
            if self.auto_merge:
                report['recommendations'].append(f"系统将自动使用 {self.merge_strategy} 策略解决冲突")
            else:
                report['recommendations'].append("请手动解决冲突后再继续")
        
        return report
    
    def compare_file_versions(self, file_path: str) -> Dict[str, Any]:
        """
        比较文件的不同版本
        
        Args:
            file_path: 文件路径
            
        Returns:
            比较结果
        """
        try:
            import subprocess
            
            ours_result = subprocess.run(
                ['git', 'show', ':2:' + file_path],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=False
            )
            
            theirs_result = subprocess.run(
                ['git', 'show', ':3:' + file_path],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=False
            )
            
            ours_content = ours_result.stdout if ours_result.returncode == 0 else ""
            theirs_content = theirs_result.stdout if theirs_result.returncode == 0 else ""
            
            diff = list(difflib.unified_diff(
                ours_content.splitlines(keepends=True),
                theirs_content.splitlines(keepends=True),
                fromfile='ours',
                tofile='theirs',
                lineterm=''
            ))
            
            return {
                "file_path": file_path,
                "ours_content": ours_content,
                "theirs_content": theirs_content,
                "diff": ''.join(diff),
                "similarity": difflib.SequenceMatcher(None, ours_content, theirs_content).ratio()
            }
            
        except Exception as e:
            self.logger.error(f"比较文件版本 {file_path} 失败: {e}")
            return None
