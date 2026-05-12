#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
热更新核心模块
提供代码和配置的热重载功能，支持开发环境的快速迭代
"""
import os
import sys
import time
import threading
import importlib
import traceback
from typing import Dict, List, Callable, Optional, Set
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

@dataclass
class ReloadEvent:
    """热更新事件"""
    timestamp: datetime
    file_path: str
    event_type: str  # 'modified', 'created', 'deleted'
    reload_type: str  # 'code', 'config', 'template'
    success: bool
    error_message: Optional[str] = None

class HotReloadManager:
    """热更新管理器"""
    
    def __init__(self, app=None):
        self.app = app
        self.enabled = False
        self.watched_dirs: Set[str] = set()
        self.watched_files: Dict[str, float] = {}
        self.reload_callbacks: Dict[str, List[Callable]] = {
            'code': [],
            'config': [],
            'template': [],
            'static': []
        }
        self.reload_history: List[ReloadEvent] = []
        self.max_history = 100
        self._watcher_thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._last_reload_time = 0
        self._reload_cooldown = 1.0  # 重载冷却时间（秒）
        
    def enable(self, enabled: bool = True):
        """启用或禁用热更新"""
        self.enabled = enabled
        if enabled and not self._watcher_thread:
            self._start_watcher()
        elif not enabled and self._watcher_thread:
            self._stop_watcher()
    
    def _start_watcher(self):
        """启动文件监控线程"""
        self._stop_event.clear()
        self._watcher_thread = threading.Thread(
            target=self._watch_loop,
            daemon=True,
            name='HotReloadWatcher'
        )
        self._watcher_thread.start()
        print("[INFO] 热更新监控已启动")
    
    def _stop_watcher(self):
        """停止文件监控线程"""
        if self._watcher_thread:
            self._stop_event.set()
            self._watcher_thread.join(timeout=5)
            self._watcher_thread = None
            print("[INFO] 热更新监控已停止")
    
    def add_watch_directory(self, directory: str):
        """添加监控目录"""
        abs_path = os.path.abspath(directory)
        if os.path.isdir(abs_path):
            self.watched_dirs.add(abs_path)
            print(f"[INFO] 添加监控目录: {abs_path}")
    
    def remove_watch_directory(self, directory: str):
        """移除监控目录"""
        abs_path = os.path.abspath(directory)
        if abs_path in self.watched_dirs:
            self.watched_dirs.remove(abs_path)
            print(f"[INFO] 移除监控目录: {abs_path}")
    
    def register_callback(self, reload_type: str, callback: Callable):
        """注册重载回调函数"""
        if reload_type in self.reload_callbacks:
            self.reload_callbacks[reload_type].append(callback)
            print(f"[INFO] 注册重载回调: {reload_type} -> {callback.__name__}")
    
    def _watch_loop(self):
        """文件监控主循环"""
        print("[INFO] 文件监控线程已启动")
        
        while not self._stop_event.is_set():
            try:
                self._check_files()
                time.sleep(0.5)  # 每0.5秒检查一次
            except Exception as e:
                print(f"[ERROR] 文件监控异常: {str(e)}")
                traceback.print_exc()
                time.sleep(1)
    
    def _check_files(self):
        """检查文件变化"""
        current_time = time.time()
        
        if current_time - self._last_reload_time < self._reload_cooldown:
            return
        
        for watch_dir in self.watched_dirs:
            if not os.path.exists(watch_dir):
                continue
            
            for root, dirs, files in os.walk(watch_dir):
                for filename in files:
                    file_path = os.path.join(root, filename)
                    
                    if not self._should_watch_file(file_path):
                        continue
                    
                    try:
                        mtime = os.path.getmtime(file_path)
                        
                        if file_path not in self.watched_files:
                            self.watched_files[file_path] = mtime
                            continue
                        
                        if mtime > self.watched_files[file_path]:
                            self.watched_files[file_path] = mtime
                            self._handle_file_change(file_path, 'modified')
                            self._last_reload_time = current_time
                            return
                    except (OSError, IOError):
                        continue
    
    def _should_watch_file(self, file_path: str) -> bool:
        """判断是否应该监控该文件"""
        ext = os.path.splitext(file_path)[1].lower()
        
        watched_extensions = {
            '.py',      # Python代码文件
            '.yml',     # YAML配置文件
            '.yaml',    # YAML配置文件
            '.json',    # JSON配置文件
            '.env',     # 环境变量文件
            '.html',    # HTML模板文件
            '.htm',     # HTML模板文件
            '.css',     # CSS样式文件
            '.js',      # JavaScript文件
        }
        
        if ext not in watched_extensions:
            return False
        
        if '__pycache__' in file_path:
            return False
        
        if '.pyc' in file_path:
            return False
        
        if '.min.css' in file_path or '.min.js' in file_path:
            return False
        
        return True
    
    def _handle_file_change(self, file_path: str, event_type: str):
        """处理文件变化事件"""
        reload_type = self._determine_reload_type(file_path)
        
        print(f"\n[RELOAD] 检测到文件变化: {file_path}")
        print(f"[RELOAD] 事件类型: {event_type}, 重载类型: {reload_type}")
        
        success = False
        error_message = None
        
        try:
            if reload_type == 'code':
                success = self._reload_code(file_path)
            elif reload_type == 'config':
                success = self._reload_config(file_path)
            elif reload_type == 'template':
                success = self._reload_template(file_path)
            elif reload_type == 'static':
                success = self._reload_static(file_path)
            
            if success:
                print(f"[RELOAD] 重载成功: {file_path}")
            else:
                print(f"[RELOAD] 重载失败: {file_path}")
        except Exception as e:
            error_message = str(e)
            print(f"[ERROR] 重载异常: {error_message}")
            traceback.print_exc()
        
        event = ReloadEvent(
            timestamp=datetime.now(),
            file_path=file_path,
            event_type=event_type,
            reload_type=reload_type,
            success=success,
            error_message=error_message
        )
        
        self._record_event(event)
        self._trigger_callbacks(reload_type, event)
    
    def _determine_reload_type(self, file_path: str) -> str:
        """确定重载类型"""
        if file_path.endswith('.py'):
            return 'code'
        elif file_path.endswith(('.yml', '.yaml', '.json', '.env')):
            return 'config'
        elif file_path.endswith(('.html', '.htm')):
            return 'template'
        elif file_path.endswith(('.css', '.js')):
            return 'static'
        return 'code'
    
    def _reload_code(self, file_path: str) -> bool:
        """重载Python代码模块"""
        try:
            module_name = self._get_module_name(file_path)
            if not module_name:
                return False
            
            if module_name in sys.modules:
                importlib.reload(sys.modules[module_name])
                print(f"[RELOAD] 模块重载成功: {module_name}")
            else:
                print(f"[RELOAD] 模块未加载，跳过重载: {module_name}")
            
            return True
        except Exception as e:
            print(f"[ERROR] 代码重载失败: {str(e)}")
            return False
    
    def _reload_config(self, file_path: str) -> bool:
        """重载配置文件"""
        try:
            if 'config' in file_path.lower():
                from config import config
                importlib.reload(config)
                print(f"[RELOAD] 配置文件重载成功")
            return True
        except Exception as e:
            print(f"[ERROR] 配置重载失败: {str(e)}")
            return False
    
    def _reload_template(self, file_path: str) -> bool:
        """重载模板文件"""
        try:
            if self.app and hasattr(self.app, 'jinja_env'):
                self.app.jinja_env.cache.clear()
                print(f"[RELOAD] 模板缓存已清除")
            return True
        except Exception as e:
            print(f"[ERROR] 模板重载失败: {str(e)}")
            return False
    
    def _reload_static(self, file_path: str) -> bool:
        """重载静态文件（CSS/JS）"""
        try:
            if self.app:
                # 清除静态文件缓存
                if hasattr(self.app, 'static_folder'):
                    print(f"[RELOAD] 静态文件已更新: {file_path}")
            return True
        except Exception as e:
            print(f"[ERROR] 静态文件重载失败: {str(e)}")
            return False
    
    def _get_module_name(self, file_path: str) -> Optional[str]:
        """从文件路径获取模块名"""
        try:
            abs_path = os.path.abspath(file_path)
            
            for module_name, module in sys.modules.items():
                if hasattr(module, '__file__') and module.__file__:
                    module_file = os.path.abspath(module.__file__)
                    if module_file == abs_path:
                        return module_name
            
            return None
        except Exception:
            return None
    
    def _record_event(self, event: ReloadEvent):
        """记录重载事件"""
        with self._lock:
            self.reload_history.append(event)
            if len(self.reload_history) > self.max_history:
                self.reload_history.pop(0)
    
    def _trigger_callbacks(self, reload_type: str, event: ReloadEvent):
        """触发回调函数"""
        callbacks = self.reload_callbacks.get(reload_type, [])
        for callback in callbacks:
            try:
                callback(event)
            except Exception as e:
                print(f"[ERROR] 回调执行失败: {callback.__name__} - {str(e)}")
    
    def get_reload_history(self, limit: int = 10) -> List[ReloadEvent]:
        """获取重载历史记录"""
        with self._lock:
            return self.reload_history[-limit:]
    
    def get_status(self) -> Dict:
        """获取热更新状态"""
        return {
            'enabled': self.enabled,
            'watched_dirs': list(self.watched_dirs),
            'watched_files_count': len(self.watched_files),
            'reload_history_count': len(self.reload_history),
            'last_reload_time': self._last_reload_time
        }
    
    def shutdown(self):
        """关闭热更新管理器"""
        self.enable(False)
        print("[INFO] 热更新管理器已关闭")

# 全局热更新管理器实例
hot_reload_manager = HotReloadManager()

def setup_hot_reload(app, watch_dirs: Optional[List[str]] = None):
    """设置热更新功能"""
    if watch_dirs is None:
        watch_dirs = []
    
    hot_reload_manager.app = app
    
    for watch_dir in watch_dirs:
        hot_reload_manager.add_watch_directory(watch_dir)
    
    return hot_reload_manager