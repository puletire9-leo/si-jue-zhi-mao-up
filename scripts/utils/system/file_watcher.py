#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文件监控模块
提供高级文件监控功能，支持多种监控策略和过滤规则
"""
import os
import time
import fnmatch
from typing import List, Set, Dict, Callable, Optional, Pattern
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import re

class FileEventType(Enum):
    """文件事件类型"""
    MODIFIED = 'modified'
    CREATED = 'created'
    DELETED = 'deleted'
    MOVED = 'moved'

@dataclass
class FileEvent:
    """文件事件"""
    event_type: FileEventType
    file_path: str
    timestamp: float
    old_path: Optional[str] = None  # 用于移动事件

class FileFilter:
    """文件过滤器"""
    
    def __init__(self):
        self.include_patterns: List[str] = []
        self.exclude_patterns: List[str] = []
        self.include_dirs: List[str] = []
        self.exclude_dirs: List[str] = []
        self.include_extensions: Set[str] = set()
        self.exclude_extensions: Set[str] = set()
        self.max_file_size: Optional[int] = None
        self.min_file_size: Optional[int] = None
    
    def add_include_pattern(self, pattern: str):
        """添加包含模式（支持通配符）"""
        self.include_patterns.append(pattern)
    
    def add_exclude_pattern(self, pattern: str):
        """添加排除模式（支持通配符）"""
        self.exclude_patterns.append(pattern)
    
    def add_include_dir(self, directory: str):
        """添加包含目录"""
        self.include_dirs.append(os.path.abspath(directory))
    
    def add_exclude_dir(self, directory: str):
        """添加排除目录"""
        self.exclude_dirs.append(os.path.abspath(directory))
    
    def add_include_extension(self, extension: str):
        """添加包含文件扩展名"""
        if not extension.startswith('.'):
            extension = '.' + extension
        self.include_extensions.add(extension.lower())
    
    def add_exclude_extension(self, extension: str):
        """添加排除文件扩展名"""
        if not extension.startswith('.'):
            extension = '.' + extension
        self.exclude_extensions.add(extension.lower())
    
    def set_file_size_range(self, min_size: Optional[int] = None, max_size: Optional[int] = None):
        """设置文件大小范围（字节）"""
        self.min_file_size = min_size
        self.max_file_size = max_size
    
    def match(self, file_path: str) -> bool:
        """判断文件是否匹配过滤器"""
        if not os.path.isfile(file_path):
            return False
        
        abs_path = os.path.abspath(file_path)
        
        if self.exclude_dirs:
            for exclude_dir in self.exclude_dirs:
                if abs_path.startswith(exclude_dir):
                    return False
        
        if self.include_dirs:
            matched = False
            for include_dir in self.include_dirs:
                if abs_path.startswith(include_dir):
                    matched = True
                    break
            if not matched:
                return False
        
        filename = os.path.basename(file_path)
        dirname = os.path.dirname(file_path)
        
        if self.exclude_patterns:
            for pattern in self.exclude_patterns:
                if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(abs_path, pattern):
                    return False
        
        if self.include_patterns:
            matched = False
            for pattern in self.include_patterns:
                if fnmatch.fnmatch(filename, pattern) or fnmatch.fnmatch(abs_path, pattern):
                    matched = True
                    break
            if not matched:
                return False
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if self.exclude_extensions and ext in self.exclude_extensions:
            return False
        
        if self.include_extensions and ext not in self.include_extensions:
            return False
        
        if self.min_file_size or self.max_file_size:
            try:
                file_size = os.path.getsize(file_path)
                if self.min_file_size and file_size < self.min_file_size:
                    return False
                if self.max_file_size and file_size > self.max_file_size:
                    return False
            except OSError:
                return False
        
        return True

class FileWatcher:
    """文件监控器"""
    
    def __init__(self, filter: Optional[FileFilter] = None):
        self.filter = filter or FileFilter()
        self.watched_files: Dict[str, float] = {}
        self.event_handlers: Dict[FileEventType, List[Callable]] = {
            FileEventType.MODIFIED: [],
            FileEventType.CREATED: [],
            FileEventType.DELETED: [],
            FileEventType.MOVED: []
        }
        self._lock = None
        self._scan_interval = 0.5
    
    def set_scan_interval(self, interval: float):
        """设置扫描间隔（秒）"""
        self._scan_interval = interval
    
    def add_event_handler(self, event_type: FileEventType, handler: Callable[[FileEvent], None]):
        """添加事件处理器"""
        self.event_handlers[event_type].append(handler)
    
    def remove_event_handler(self, event_type: FileEventType, handler: Callable[[FileEvent], None]):
        """移除事件处理器"""
        if handler in self.event_handlers[event_type]:
            self.event_handlers[event_type].remove(handler)
    
    def scan_directory(self, directory: str) -> List[FileEvent]:
        """扫描目录并返回文件事件列表"""
        events = []
        current_files = set()
        
        if not os.path.isdir(directory):
            return events
        
        for root, dirs, files in os.walk(directory):
            for filename in files:
                file_path = os.path.join(root, filename)
                
                if not self.filter.match(file_path):
                    continue
                
                current_files.add(file_path)
                
                try:
                    mtime = os.path.getmtime(file_path)
                    
                    if file_path not in self.watched_files:
                        events.append(FileEvent(
                            event_type=FileEventType.CREATED,
                            file_path=file_path,
                            timestamp=mtime
                        ))
                        self.watched_files[file_path] = mtime
                    elif mtime > self.watched_files[file_path]:
                        events.append(FileEvent(
                            event_type=FileEventType.MODIFIED,
                            file_path=file_path,
                            timestamp=mtime
                        ))
                        self.watched_files[file_path] = mtime
                except OSError:
                    continue
        
        for file_path in list(self.watched_files.keys()):
            if file_path not in current_files:
                events.append(FileEvent(
                    event_type=FileEventType.DELETED,
                    file_path=file_path,
                    timestamp=time.time()
                ))
                del self.watched_files[file_path]
        
        return events
    
    def scan_directories(self, directories: List[str]) -> List[FileEvent]:
        """扫描多个目录并返回文件事件列表"""
        all_events = []
        for directory in directories:
            events = self.scan_directory(directory)
            all_events.extend(events)
        return all_events
    
    def process_events(self, events: List[FileEvent]):
        """处理文件事件"""
        for event in events:
            handlers = self.event_handlers.get(event.event_type, [])
            for handler in handlers:
                try:
                    handler(event)
                except Exception as e:
                    print(f"[ERROR] 事件处理器执行失败: {handler.__name__} - {str(e)}")
    
    def clear_cache(self):
        """清除文件缓存"""
        self.watched_files.clear()
    
    def get_watched_files_count(self) -> int:
        """获取监控文件数量"""
        return len(self.watched_files)
    
    def get_watched_files(self) -> List[str]:
        """获取监控文件列表"""
        return list(self.watched_files.keys())

def create_default_filter() -> FileFilter:
    """创建默认文件过滤器"""
    filter = FileFilter()
    
    filter.add_exclude_dir('__pycache__')
    filter.add_exclude_dir('.git')
    filter.add_exclude_dir('node_modules')
    filter.add_exclude_dir('.venv')
    filter.add_exclude_dir('venv')
    
    filter.add_exclude_extension('.pyc')
    filter.add_exclude_extension('.pyo')
    filter.add_exclude_extension('.pyd')
    
    filter.add_include_extension('.py')
    filter.add_include_extension('.yml')
    filter.add_include_extension('.yaml')
    filter.add_include_extension('.json')
    filter.add_include_extension('.env')
    filter.add_include_extension('.html')
    filter.add_include_extension('.htm')
    filter.add_include_extension('.css')
    filter.add_include_extension('.js')
    
    return filter

def create_code_filter() -> FileFilter:
    """创建代码文件过滤器"""
    filter = FileFilter()
    
    filter.add_exclude_dir('__pycache__')
    filter.add_exclude_dir('.git')
    filter.add_exclude_dir('node_modules')
    filter.add_exclude_dir('.venv')
    filter.add_exclude_dir('venv')
    
    filter.add_exclude_extension('.pyc')
    filter.add_exclude_extension('.pyo')
    filter.add_exclude_extension('.pyd')
    
    filter.add_include_extension('.py')
    
    return filter

def create_config_filter() -> FileFilter:
    """创建配置文件过滤器"""
    filter = FileFilter()
    
    filter.add_include_extension('.yml')
    filter.add_include_extension('.yaml')
    filter.add_include_extension('.json')
    filter.add_include_extension('.env')
    filter.add_include_extension('.ini')
    filter.add_include_extension('.cfg')
    filter.add_include_extension('.conf')
    
    return filter

def create_template_filter() -> FileFilter:
    """创建模板文件过滤器"""
    filter = FileFilter()
    
    filter.add_include_extension('.html')
    filter.add_include_extension('.htm')
    filter.add_include_extension('.xml')
    
    return filter