#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置热更新模块
提供配置文件的动态重载功能，支持多种配置格式
"""
import os
import json
import yaml
from typing import Dict, Any, Optional, List, Callable
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime
import importlib

@dataclass
class ConfigChangeEvent:
    """配置变更事件"""
    timestamp: datetime
    config_file: str
    old_config: Dict[str, Any]
    new_config: Dict[str, Any]
    changed_keys: List[str]

class ConfigReloader:
    """配置重载器"""
    
    def __init__(self):
        self.config_files: Dict[str, Dict[str, Any]] = {}
        self.config_timestamps: Dict[str, float] = {}
        self.change_handlers: List[Callable[[ConfigChangeEvent], None]] = []
        self._lock = None
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """加载配置文件"""
        abs_path = os.path.abspath(config_path)
        
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"配置文件不存在: {abs_path}")
        
        ext = os.path.splitext(abs_path)[1].lower()
        
        try:
            if ext == '.json':
                with open(abs_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            elif ext in ('.yml', '.yaml'):
                with open(abs_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f) or {}
            elif ext == '.env':
                from dotenv import load_dotenv
                config = {}
                load_dotenv(abs_path)
                import os
                config.update(dict(os.environ))
            else:
                raise ValueError(f"不支持的配置文件格式: {ext}")
            
            self.config_files[abs_path] = config
            self.config_timestamps[abs_path] = os.path.getmtime(abs_path)
            
            return config
        except Exception as e:
            raise RuntimeError(f"加载配置文件失败: {abs_path} - {str(e)}")
    
    def reload_config(self, config_path: str) -> Optional[ConfigChangeEvent]:
        """重载配置文件"""
        abs_path = os.path.abspath(config_path)
        
        if not os.path.exists(abs_path):
            return None
        
        current_mtime = os.path.getmtime(abs_path)
        
        if abs_path not in self.config_timestamps:
            old_config = {}
        else:
            old_config = self.config_files.get(abs_path, {})
        
        if abs_path in self.config_timestamps and current_mtime <= self.config_timestamps[abs_path]:
            return None
        
        try:
            new_config = self.load_config(abs_path)
            changed_keys = self._find_changed_keys(old_config, new_config)
            
            event = ConfigChangeEvent(
                timestamp=datetime.now(),
                config_file=abs_path,
                old_config=old_config,
                new_config=new_config,
                changed_keys=changed_keys
            )
            
            self._notify_change_handlers(event)
            
            return event
        except Exception as e:
            print(f"[ERROR] 重载配置文件失败: {abs_path} - {str(e)}")
            return None
    
    def _find_changed_keys(self, old_config: Dict[str, Any], new_config: Dict[str, Any]) -> List[str]:
        """查找变更的配置键"""
        changed_keys = []
        
        all_keys = set(old_config.keys()) | set(new_config.keys())
        
        for key in all_keys:
            old_value = old_config.get(key)
            new_value = new_config.get(key)
            
            if old_value != new_value:
                changed_keys.append(key)
        
        return changed_keys
    
    def register_change_handler(self, handler: Callable[[ConfigChangeEvent], None]):
        """注册配置变更处理器"""
        self.change_handlers.append(handler)
    
    def unregister_change_handler(self, handler: Callable[[ConfigChangeEvent], None]):
        """注销配置变更处理器"""
        if handler in self.change_handlers:
            self.change_handlers.remove(handler)
    
    def _notify_change_handlers(self, event: ConfigChangeEvent):
        """通知配置变更处理器"""
        for handler in self.change_handlers:
            try:
                handler(event)
            except Exception as e:
                print(f"[ERROR] 配置变更处理器执行失败: {handler.__name__} - {str(e)}")
    
    def get_config(self, config_path: str) -> Optional[Dict[str, Any]]:
        """获取配置"""
        abs_path = os.path.abspath(config_path)
        return self.config_files.get(abs_path)
    
    def reload_python_config(self, module_name: str) -> bool:
        """重载Python配置模块"""
        try:
            import sys
            if module_name in sys.modules:
                module = sys.modules[module_name]
                importlib.reload(module)
                print(f"[RELOAD] Python配置模块重载成功: {module_name}")
                return True
            else:
                print(f"[WARNING] Python配置模块未加载: {module_name}")
                return False
        except Exception as e:
            print(f"[ERROR] Python配置模块重载失败: {module_name} - {str(e)}")
            return False
    
    def reload_env_config(self, env_file: str = '.env') -> bool:
        """重载环境变量配置"""
        try:
            from dotenv import load_dotenv
            abs_path = os.path.abspath(env_file)
            
            if os.path.exists(abs_path):
                load_dotenv(abs_path, override=True)
                print(f"[RELOAD] 环境变量配置重载成功: {abs_path}")
                return True
            else:
                print(f"[WARNING] 环境变量文件不存在: {abs_path}")
                return False
        except Exception as e:
            print(f"[ERROR] 环境变量配置重载失败: {env_file} - {str(e)}")
            return False
    
    def clear_cache(self):
        """清除配置缓存"""
        self.config_files.clear()
        self.config_timestamps.clear()
    
    def get_status(self) -> Dict[str, Any]:
        """获取配置重载器状态"""
        return {
            'loaded_configs': list(self.config_files.keys()),
            'config_count': len(self.config_files),
            'handler_count': len(self.change_handlers)
        }

def create_config_reloader(app=None) -> ConfigReloader:
    """创建配置重载器"""
    return ConfigReloader()

# 全局配置重载器实例
config_reloader = ConfigReloader()