"""
Git同步配置模块
管理基于Git的同步配置和规则
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, List

DEFAULT_GIT_SYNC_CONFIG = {
    "git": {
        "enabled": True,
        "auto_commit": True,
        "auto_push": True,
        "auto_pull": True,
        "commit_message_template": "Auto-sync: {timestamp} - {env} changes",
        "branch": "main"
    },
    "environments": {
        "development": {
            "branch": "development",
            "paths": [
                "development/backend",
                "development/database",
                "development/frontend",
                "scripts/sync"
            ],
            "exclude_patterns": [
                "*.log",
                "*.pyc",
                "__pycache__",
                ".env",
                "node_modules",
                ".venv*"
            ]
        },
        "production": {
            "branch": "production",
            "paths": [
                "production/backend",
                "production/database",
                "production/frontend",
                "scripts/sync"
            ],
            "exclude_patterns": [
                "*.log",
                "*.pyc",
                "__pycache__",
                ".env",
                "node_modules",
                ".venv*"
            ]
        }
    },
    "sync": {
        "auto_sync_enabled": True,
        "sync_interval": 300,
        "conflict_resolution": "manual",
        "merge_strategy": "theirs",
        "auto_merge": False
    },
    "hooks": {
        "pre_commit_enabled": True,
        "post_commit_enabled": True,
        "pre_push_enabled": True,
        "post_merge_enabled": True
    },
    "remote": {
        "enabled": False,
        "url": "",
        "username": "",
        "token": "",
        "ssh_key_path": ""
    },
    "logging": {
        "enabled": True,
        "log_file": "logs/git_sync.log",
        "log_level": "INFO"
    }
}


def load_git_sync_config(config_path: str = None) -> Dict[str, Any]:
    """
    加载Git同步配置
    
    Args:
        config_path: 自定义配置文件路径
        
    Returns:
        配置字典
    """
    config = DEFAULT_GIT_SYNC_CONFIG.copy()
    
    if config_path:
        config_file = Path(config_path)
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                custom_config = json.load(f)
            config.update(custom_config)
    
    return config


def get_environment_config(config: Dict[str, Any], environment: str) -> Dict[str, Any]:
    """
    获取指定环境的配置
    
    Args:
        config: 全局配置
        environment: 环境名称
        
    Returns:
        环境配置字典
    """
    return config['environments'][environment]


def get_sync_paths(config: Dict[str, Any], environment: str) -> List[str]:
    """
    获取指定环境的同步路径
    
    Args:
        config: 全局配置
        environment: 环境名称
        
    Returns:
        同步路径列表
    """
    env_config = get_environment_config(config, environment)
    return env_config['paths']


def get_exclude_patterns(config: Dict[str, Any], environment: str) -> List[str]:
    """
    获取指定环境的排除模式
    
    Args:
        config: 全局配置
        environment: 环境名称
        
    Returns:
        排除模式列表
    """
    env_config = get_environment_config(config, environment)
    return env_config['exclude_patterns']


def save_git_sync_config(config: Dict[str, Any], config_path: str):
    """
    保存Git同步配置
    
    Args:
        config: 配置字典
        config_path: 配置文件路径
    """
    config_file = Path(config_path)
    config_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
