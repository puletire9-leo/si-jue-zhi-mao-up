#!/usr/bin/env python
# -*- coding: utf-8 -*-
# cSpell:ignore qdrant PYTHONUNBUFFERED PYTHONHASHSEED creationflags signum
"""
思觉智贸启动脚本 - 开发模式专用
修复虚拟环境检测和切换逻辑
仅用于开发环境部署，支持热重载功能
"""
import os
import sys
import argparse
import subprocess
import time
import socket
import logging
import logging.handlers
import traceback
from typing import List, Optional, Callable, Any
from functools import wraps
from datetime import datetime, timedelta
import random
import requests
import re
import threading
import atexit
import signal

# ========== 修复点1：统一路径计算逻辑 ==========
# 获取当前脚本目录
CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
# 计算项目根目录（当前脚本目录向上两级）
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_FILE_DIR, "..", ".."))
# 添加项目根目录到Python路径
sys.path.insert(0, PROJECT_ROOT)

# ========== 环境根目录管理 ==========
# 环境根目录映射（开发模式专用）
env_roots = {
    'development': os.path.join(PROJECT_ROOT, 'development')
}

# 后端代码统一目录（根目录）
BACKEND_ROOT = os.path.join(PROJECT_ROOT, 'backend')
FRONTEND_ROOT = os.path.join(PROJECT_ROOT, 'frontend')
CONFIG_ROOT = os.path.join(PROJECT_ROOT, 'config')

# 默认环境
default_env = 'development'

# 定义虚拟环境路径选项（支持多个虚拟环境）
VENV_OPTIONS = [
    os.path.join(PROJECT_ROOT, "backend", "venv"),  # 新项目虚拟环境，优先
    os.path.join(PROJECT_ROOT, ".venv"),
    os.path.join(PROJECT_ROOT, ".venv公司"),
    os.path.join(PROJECT_ROOT, ".venv家")
]  

# ========== 修复点：优先使用当前激活的虚拟环境 ==========
# 检查当前是否已经激活了虚拟环境
VENV_DIR = None

# 1. 首先检查当前Python解释器是否来自虚拟环境
current_python = sys.executable
if "venv" in current_python.lower() or ".venv" in current_python:
    # 当前已经在虚拟环境中运行
    current_venv = os.path.dirname(os.path.dirname(current_python))
    if os.path.exists(current_venv):
        VENV_DIR = current_venv

# 2. 如果没有激活的虚拟环境，才按照预定顺序查找
if VENV_DIR is None:
    for venv_path in VENV_OPTIONS:
        if os.path.exists(venv_path):
            VENV_DIR = venv_path
            break
    
    # 如果两个虚拟环境都不存在，使用.venv家作为默认（不创建.venv）
    if VENV_DIR is None:
        VENV_DIR = os.path.join(PROJECT_ROOT, ".venv家")

# 跨平台兼容的虚拟环境Python路径
if sys.platform == "win32":
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")

# ========== 添加虚拟环境路径检查函数 ==========
def check_venv_path():
    """检查虚拟环境路径是否存在，如果不存在则提供友好的错误信息"""
    if not os.path.exists(VENV_DIR):
        error_msg = f"虚拟环境目录不存在: {VENV_DIR}"
        print(f"\n{'='*60}")
        print(f"❌ 错误: 虚拟环境路径不存在")
        print(f"{'='*60}")
        print(f"当前配置的虚拟环境路径: {VENV_DIR}")
        print(f"\n💡 可用的虚拟环境:")
        
        # 列出可用的虚拟环境
        available_venvs = []
        for venv_path in VENV_OPTIONS:
            if os.path.exists(venv_path):
                available_venvs.append(venv_path)
        
        if available_venvs:
            for i, venv_path in enumerate(available_venvs, 1):
                print(f"  {i}. {venv_path}")
            print(f"\n💡 建议的解决方案:")
            print(f"  1. 使用项目根目录下的启动脚本，不要手动指定虚拟环境路径")
            print(f"  2. 或者手动激活可用的虚拟环境:")
            for venv_path in available_venvs:
                if sys.platform == "win32":
                    print(f"     - {os.path.join(venv_path, 'Scripts', 'activate.bat')}")
                else:
                    print(f"     - source {os.path.join(venv_path, 'bin', 'activate')}")
        else:
            print(f"  ❌ 未找到任何可用的虚拟环境")
            print(f"\n💡 请先创建虚拟环境:")
            print(f"  1. 在项目根目录运行: python -m venv .venv家")
            print(f"  2. 安装依赖: .venv家\\Scripts\\python.exe -m pip install -r requirements.txt")
        
        print(f"{'='*60}\n")
        return False
    
    if not os.path.exists(VENV_PYTHON):
        error_msg = f"虚拟环境Python解释器未找到: {VENV_PYTHON}"
        print(f"\n{'='*60}")
        print(f"❌ 错误: 虚拟环境Python解释器不存在")
        print(f"{'='*60}")
        print(f"期望的Python路径: {VENV_PYTHON}")
        print(f"\n💡 可能的原因:")
        print(f"  1. 虚拟环境未正确创建")
        print(f"  2. 虚拟环境损坏")
        print(f"\n💡 解决方案:")
        print(f"  1. 重新创建虚拟环境: python -m venv {VENV_DIR}")
        print(f"  2. 重新安装依赖: {VENV_PYTHON} -m pip install -r requirements.txt")
        print(f"{'='*60}\n")
        return False
    
    return True

# ========== 端口管理功能 ==========
def get_available_port_with_fallback(start_port: int = 8090, max_attempts: int = 10) -> int:
    """获取可用的端口号，支持自动备用端口选择
    
    Args:
        start_port: 起始端口号
        max_attempts: 最大尝试次数
        
    Returns:
        可用的端口号
    """
    for port in range(start_port, start_port + max_attempts):
        if is_port_available(port):
            logger.info(f"✅ 端口 {port} 可用")
            return port
    
    # 如果所有端口都不可用，使用随机端口
    random_port = random.randint(10000, 65535)
    logger.warning(f"所有常规端口均被占用，使用随机端口: {random_port}")
    return random_port


# ========== 原有日志配置等代码保持不变 ==========
def setup_logging_system(env='development'):
    """配置系统化日志系统（开发模式专用）"""
    # 使用环境特定的日志目录（开发模式专用）
    logs_dir = os.path.join(env_roots[env], 'logs')
    
    # 确保日志目录存在
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    # 定义日志格式
    log_format = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'
    
    # 配置不同级别的日志处理器
    handlers = []
    
    # 1. 控制台处理器 - 显示INFO及以上级别的日志
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(log_format, date_format)
    console_handler.setFormatter(console_formatter)
    handlers.append(console_handler)
    
    # 2. 主日志文件 - 使用RotatingFileHandler实现日志轮转
    main_log_file = os.path.join(logs_dir, 'startup.log')
    main_handler = logging.handlers.RotatingFileHandler(
        main_log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    main_handler.setLevel(logging.DEBUG)
    main_formatter = logging.Formatter(log_format, date_format)
    main_handler.setFormatter(main_formatter)
    handlers.append(main_handler)
    
    # 3. 错误日志文件 - 使用TimedRotatingFileHandler按天轮转
    error_log_file = os.path.join(logs_dir, 'error.log')
    error_handler = logging.handlers.TimedRotatingFileHandler(
        error_log_file,
        when='midnight',  # 每天午夜轮转
        interval=1,
        backupCount=30,  # 保留30天的日志
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(log_format, date_format)
    error_handler.setFormatter(error_formatter)
    handlers.append(error_handler)
    
    # 配置根日志记录器
    logging.basicConfig(
        level=logging.DEBUG,
        format=log_format,
        datefmt=date_format,
        handlers=handlers
    )
    
    # 初始化全局日志记录器
    global logger
    logger = logging.getLogger(__name__)
    
    logger.info("✅ 日志系统初始化完成")
    
    # 归档旧日志文件
    archive_old_logs(logs_dir)
    
    return PROJECT_ROOT

def shorten_path(path, max_length=60):
    """简化路径显示，当路径过长时只显示关键部分"""
    if len(path) <= max_length:
        return path
    
    # 使用相对路径或显示路径的关键部分
    parts = path.split(os.sep)
    if len(parts) > 3:
        # 显示开头部分和结尾部分
        return f"{os.sep.join(parts[:2])}{os.sep}...{os.sep}{os.sep.join(parts[-2:])}"
    else:
        # 显示路径的最后部分
        return os.path.basename(path)


def archive_old_logs(logs_dir: str) -> None:
    """归档旧的日志文件"""
    try:
        archive_dir = os.path.join(logs_dir, 'archive')
        if not os.path.exists(archive_dir):
            os.makedirs(archive_dir)
        
        # 归档7天前的日志文件
        cutoff_date = datetime.now() - timedelta(days=7)
        
        for filename in os.listdir(logs_dir):
            if filename.endswith('.log') and filename not in ['startup.log', 'error.log']:
                filepath = os.path.join(logs_dir, filename)
                file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                
                if file_mtime < cutoff_date:
                    archive_path = os.path.join(archive_dir, filename)
                    try:
                        os.rename(filepath, archive_path)
                        logger.info(f"已归档日志文件: {filename}")
                    except Exception as e:
                        logger.warning(f"归档日志文件失败 {filename}: {e}")
        
        # 清理30天前的归档文件
        archive_cutoff = datetime.now() - timedelta(days=30)
        for filename in os.listdir(archive_dir):
            filepath = os.path.join(archive_dir, filename)
            file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            
            if file_mtime < archive_cutoff:
                try:
                    os.remove(filepath)
                    logger.info(f"已删除过期归档文件: {filename}")
                except Exception as e:
                    logger.warning(f"删除归档文件失败 {filename}: {e}")
    
    except Exception as e:
        logger.warning(f"日志归档过程出错: {e}")

# 初始化日志系统 - 延迟到main函数中根据环境初始化
# project_root = setup_logging_system()
# logger = logging.getLogger(__name__)

# 记录找到的虚拟环境 - 延迟到main函数中执行
# if os.path.exists(VENV_DIR):
#     logger.info(f"找到虚拟环境: {VENV_DIR}")
# else:
#     logger.warning(f"虚拟环境不存在: {VENV_DIR}")

# 增强进程管理器
class ProcessManager:
    """进程管理器"""
    
    def __init__(self):
        self.processes = {}
        self.start_times = {}
        self.process_commands = {}  # 记录进程启动命令
        self.process_cwd = {}  # 记录进程工作目录
        self.process_env = {}  # 记录进程环境变量
    
    def register(self, name, process, command=None, cwd=None, env=None):
        """注册进程"""
        self.processes[name] = process
        self.start_times[name] = time.time()
        self.process_commands[name] = command
        self.process_cwd[name] = cwd
        self.process_env[name] = env
        logger.info(f"✅ 已注册进程: {name} (PID: {process.pid})")
    
    def terminate(self, name, timeout=10):
        """终止进程"""
        if name in self.processes:
            process = self.processes[name]
            try:
                if process.poll() is None:
                    logger.info(f"正在终止进程: {name} (PID: {process.pid})")
                    process.terminate()
                    # 使用更可靠的终止方式
                    try:
                        process.wait(timeout=timeout)
                        logger.info(f"✅ 已正常终止进程: {name}")
                    except subprocess.TimeoutExpired:
                        logger.warning(f"进程 {name} 终止超时，尝试强制终止...")
                        process.kill()
                        process.wait(timeout=timeout)
                        logger.info(f"✅ 已强制终止进程: {name}")
                else:
                    logger.info(f"进程 {name} 已终止")
                
                # 清理资源
                self.cleanup_process(name)
                return True
            except Exception as e:
                logger.error(f"终止进程 {name} 失败: {str(e)}")
                # 即使失败也尝试清理资源
                self.cleanup_process(name)
                return False
        return True
    
    def cleanup_process(self, name):
        """清理进程资源"""
        if name in self.processes:
            del self.processes[name]
        if name in self.start_times:
            del self.start_times[name]
        if name in self.process_commands:
            del self.process_commands[name]
        if name in self.process_cwd:
            del self.process_cwd[name]
        if name in self.process_env:
            del self.process_env[name]
    
    def terminate_all(self):
        """终止所有进程"""
        global logger
        if logger:
            logger.info("正在清理所有进程...")
        names = list(self.processes.keys())
        for name in names:
            self.terminate(name)
    
    def is_alive(self, name):
        """检查进程是否存活"""
        if name in self.processes:
            process = self.processes[name]
            return process.poll() is None
        return False
    
    def get_runtime(self, name):
        """获取进程运行时间"""
        if name in self.start_times:
            return time.time() - self.start_times[name]
        return 0
    
    def restart(self, name, timeout=10):
        """重启进程"""
        if name in self.process_commands:
            # 先终止旧进程
            self.terminate(name, timeout=timeout)
            
            # 使用相同的命令重启进程
            command = self.process_commands[name]
            cwd = self.process_cwd[name]
            env = self.process_env[name]
            
            logger.info(f"正在重启进程: {name} 命令: {' '.join(command) if isinstance(command, list) else command}")
            
            try:
                new_process = subprocess.Popen(
                    command,
                    cwd=cwd,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding='utf-8',
                    bufsize=1
                )
                
                # 重新注册进程
                self.register(name, new_process, command, cwd, env)
                logger.info(f"✅ 已重启进程: {name} (新PID: {new_process.pid})")
                return new_process
            except Exception as e:
                logger.error(f"重启进程 {name} 失败: {str(e)}")
                return None
        return None
    
    def monitor_processes(self, callback=None):
        """监控所有进程状态"""
        for name in list(self.processes.keys()):
            if not self.is_alive(name):
                exit_code = self.processes[name].poll()
                logger.warning(f"进程 {name} 已退出，退出码: {exit_code}")
                if callback:
                    callback(name, exit_code)
    
    def get_process_info(self, name):
        """获取进程信息"""
        if name in self.processes:
            process = self.processes[name]
            return {
                'name': name,
                'pid': process.pid,
                'alive': self.is_alive(name),
                'exit_code': process.poll(),
                'runtime': self.get_runtime(name),
                'command': self.process_commands.get(name),
                'cwd': self.process_cwd.get(name)
            }
        return None

# 全局进程管理器实例
process_manager = ProcessManager()

# 全局日志记录器
logger = None

# ========== 异常处理装饰器定义（移到前面） ==========
def handle_exception(func: Callable) -> Callable:
    """异常处理装饰器"""
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        try:
            return func(*args, **kwargs)
        except KeyboardInterrupt:
            logger.info(f"用户中断操作: {func.__name__}")
            raise
        except Exception as e:
            logger.error(f"函数 {func.__name__} 执行失败: {str(e)}")
            logger.error(f"错误详情:\n{traceback.format_exc()}")
            return None
    return wrapper

# ========== 修复点2：重写虚拟环境检查函数 ==========
@handle_exception
def check_virtual_environment():
    """检查是否在正确的虚拟环境中运行，如未激活则自动激活并重启"""
    # 检查当前Python解释器路径
    current_python = sys.executable.lower()
    expected_python = VENV_PYTHON.lower()

    logger.debug(f"当前Python路径: {sys.executable}")
    logger.debug(f"期望虚拟环境Python: {VENV_PYTHON}")

    # 如果已经在正确的虚拟环境中，直接返回
    if current_python == expected_python:
        logger.info(f"✅ 虚拟环境检查通过: {sys.prefix}")
        return True

    # 检查虚拟环境是否存在
    if not os.path.exists(VENV_PYTHON):
        error_msg = f"虚拟环境Python解释器未找到: {VENV_PYTHON}"
        logger.error(f"❌ {error_msg}")
        show_user_friendly_error(
            FileNotFoundError(error_msg),
            "虚拟环境不存在",
            [
                f"创建虚拟环境: python -m venv {VENV_DIR}",
                f"安装依赖: {VENV_PYTHON} -m pip install -r {PROJECT_ROOT}\\requirements.txt",
                "或运行: setup_env.bat" if sys.platform == "win32" else "或运行: setup_env.sh"
            ]
        )
        return False

    # 未在虚拟环境中运行，自动激活并重启
    logger.info(f"🔄 未在虚拟环境中运行，正在自动激活虚拟环境...")
    logger.info(f"当前Python: {sys.executable}")
    logger.info(f"目标虚拟环境: {VENV_DIR}")

    # 构建激活命令
    if sys.platform == "win32":
        # Windows平台 - 直接使用虚拟环境的Python启动，无需激活
        # 这样可以避免中文路径和激活脚本的编码问题
        logger.info(f"🔄 使用虚拟环境Python直接重启...")

        # 构建命令参数
        script_path = os.path.abspath(__file__)
        args_list = sys.argv[1:]

        # 使用subprocess启动新进程，继承当前环境变量
        import subprocess
        try:
            # 设置环境变量标记已激活虚拟环境
            new_env = os.environ.copy()
            new_env['VIRTUAL_ENV'] = VENV_DIR
            new_env['PATH'] = os.path.join(VENV_DIR, 'Scripts') + os.pathsep + new_env.get('PATH', '')

            logger.info(f"执行: {VENV_PYTHON} {script_path} {' '.join(args_list)}")

            # 启动新进程 - 在当前终端中运行，不创建新窗口
            subprocess.Popen(
                [VENV_PYTHON, script_path] + args_list,
                env=new_env,
                cwd=PROJECT_ROOT
            )
            logger.info("✅ 已启动虚拟环境进程，当前进程退出...")
            sys.exit(0)
        except Exception as e:
            logger.error(f"❌ 启动虚拟环境进程失败: {e}")
    else:
        # Linux/Mac
        activate_script = os.path.join(VENV_DIR, "bin", "activate")
        if os.path.exists(activate_script):
            # 使用bash激活并重启
            import subprocess
            cmd = f'source "{activate_script}" && "{VENV_PYTHON}" "{os.path.abspath(__file__)}" {" ".join(sys.argv[1:])}'
            logger.info(f"🔄 使用Bash激活虚拟环境并重启...")
            logger.info(f"执行命令: {cmd}")
            subprocess.run(cmd, shell=True, executable='/bin/bash')
            sys.exit(0)

    # 如果自动激活失败，显示错误信息
    logger.error(f"❌ 自动激活虚拟环境失败！")
    show_user_friendly_error(
        RuntimeError("无法自动激活虚拟环境"),
        "虚拟环境错误",
        [
            "自动激活虚拟环境失败，请手动激活：",
            f"Windows (CMD): {os.path.join(VENV_DIR, 'Scripts', 'activate.bat')}",
            f"Windows (PowerShell): {os.path.join(VENV_DIR, 'Scripts', 'Activate.ps1')}",
            f"Linux/Mac: source {os.path.join(VENV_DIR, 'bin', 'activate')}",
            "",
            "然后重新运行启动脚本：",
            f"python {os.path.basename(__file__)}"
        ]
    )
    return False

# ========== 保留原有其他函数（仅替换其中的路径计算） ==========
def get_local_ip():
    """获取本机的局域网IP地址"""
    try:
        if sys.platform == "win32":
            # Windows: 通过ipconfig获取
            result = subprocess.run(['ipconfig'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                output = result.stdout
                ethernet_section = None
                lines = output.split('\n')
                
                for i, line in enumerate(lines):
                    if '以太网' in line or 'Ethernet' in line:
                        for j in range(i+1, min(i+10, len(lines))):
                            if 'IPv4 地址' in lines[j] or 'IPv4 Address' in lines[j]:
                                ip = lines[j].split(':')[-1].strip()
                                if ip and not ip.startswith('127.') and not ip.startswith('169.254.'):
                                    return ip
                            if lines[j].strip() and ':' not in lines[j]:
                                break
        
        # 通用方法
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
        
    except Exception as e:
        logger.warning(f"无法获取本机IP地址: {str(e)}")
        return None

def log_error_with_context(error: Exception, context: str, critical: bool = False) -> None:
    """记录带有上下文信息的错误"""
    log_func = logger.critical if critical else logger.error
    log_func(f"{context}: {str(error)}")
    log_func(f"错误类型: {type(error).__name__}")
    log_func(f"错误详情:\n{traceback.format_exc()}")

def show_user_friendly_error(error: Exception, context: str, solutions: Optional[List[str]] = None) -> None:
    """向用户显示友好的错误信息和解决方案"""
    print(f"\n{'='*60}")
    print(f"❌ 错误: {context}")
    print(f"{'='*60}")
    print(f"错误信息: {str(error)}")
    print(f"错误类型: {type(error).__name__}")
    
    if solutions:
        print(f"\n💡 建议的解决方案:")
        for i, solution in enumerate(solutions, 1):
            print(f"  {i}. {solution}")
    
    print(f"\n📋 详细错误信息已记录到日志文件")
    print(f"{'='*60}\n")

def cleanup_processes_on_error() -> None:
    """发生错误时清理所有管理的进程"""
    logger.info("检测到错误,正在清理资源...")
    cleanup_processes()

# 配置文件状态
HAS_CONFIG = False
settings = None

def is_process_running(process_name: str, exclude_pid: Optional[int] = None) -> bool:
    """检查进程是否正在运行"""
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ['tasklist', '/FI', f'IMAGENAME eq {process_name}', '/NH', '/FO', 'CSV'],
                capture_output=True,
                text=True,
                timeout=5
            )
        else:
            # Linux/Mac兼容
            result = subprocess.run(
                ['ps', 'aux'],
                capture_output=True,
                text=True,
                timeout=5
            )
        
        if process_name.lower() not in result.stdout.lower():
            return False
        
        if exclude_pid:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if process_name.lower() in line.lower():
                    try:
                        if sys.platform == "win32":
                            parts = line.split(',')
                            if len(parts) >= 2:
                                pid_str = parts[1].strip('"')
                                pid = int(pid_str)
                        else:
                            parts = line.split()
                            pid = int(parts[1])
                        
                        if pid != exclude_pid:
                            return True
                    except (ValueError, IndexError):
                        continue
            return False
        
        return True
    except Exception as e:
        logger.warning(f"检查进程状态失败: {e}")
        return False

def is_port_available(port: int, max_retries: int = 3, retry_delay: float = 0.5) -> bool:
    """检查端口是否可用（增强版）
    
    Args:
        port: 端口号
        max_retries: 最大重试次数
        retry_delay: 重试延迟（秒）
    
    Returns:
        端口是否可用
    """
    for attempt in range(max_retries):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex(('localhost', port))
                if result != 0:
                    # 端口可用，但为了确保可靠性，再验证一次系统层面
                    if sys.platform == "win32":
                        # Windows系统：使用netstat双重验证
                        try:
                            result_netstat = subprocess.run(
                                ['netstat', '-ano'], 
                                capture_output=True, 
                                text=True, 
                                timeout=5
                            )
                            if result_netstat.returncode == 0:
                                if f":{port}" not in result_netstat.stdout:
                                    logger.debug(f"✅ 端口 {port} 双重验证通过")
                                    return True
                        except Exception:
                            pass
                    return True
                else:
                    if attempt < max_retries - 1:
                        logger.debug(f"端口 {port} 仍被占用，重试 {attempt + 1}/{max_retries}")
                        time.sleep(retry_delay)
        except Exception as e:
            logger.warning(f"检查端口状态失败: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
    
    return False

def get_port_process_info(port: int) -> Optional[dict]:
    """获取占用指定端口的进程信息（增强版）"""
    try:
        if sys.platform == "win32":
            # Windows系统：使用更可靠的方法
            result = subprocess.run(
                ['netstat', '-ano'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            # 获取进程名
                            try:
                                task_result = subprocess.run(
                                    ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV'], 
                                    capture_output=True, 
                                    text=True, 
                                    timeout=5
                                )
                                if task_result.returncode == 0:
                                    task_lines = task_result.stdout.split('\n')
                                    if len(task_lines) > 1:
                                        import csv
                                        reader = csv.reader(task_lines[1:])
                                        for row in reader:
                                            if len(row) >= 1:
                                                return {
                                                    'pid': pid,
                                                    'name': row[0].strip('"'),
                                                    'port': port
                                                }
                            except Exception:
                                pass
                            
                            return {'pid': pid, 'name': 'Unknown', 'port': port}
        else:
            # Linux/Mac系统
            result = subprocess.run(
                ['lsof', '-i', f':{port}'], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines[1:]:  # 跳过标题行
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 2:
                            return {
                                'pid': parts[1],
                                'name': parts[0],
                                'port': port
                            }
        
        return None
    except Exception as e:
        logger.warning(f"获取端口 {port} 进程信息失败: {str(e)}")
        return None

# 端口清理功能已禁用，直接跳过端口检查

def cleanup_processes():
    """清理所有管理的进程"""
    global logger
    if logger:
        logger.info("正在清理所有管理的进程...")
    
    process_manager.terminate_all()
    
    if logger:
        logger.info("✅ 所有进程已清理完成")

def register_process(process: subprocess.Popen, name="unknown", command=None, cwd=None, env=None):
    """注册进程到进程管理器"""
    if name == "unknown":
        name = f"process_{process.pid}"
    process_manager.register(name, process, command, cwd, env)

@handle_exception
def check_python_version():
    """检查Python版本是否符合要求"""
    required_version = (3, 12)
    current_version = sys.version_info
    
    if current_version < required_version:
        error_msg = (f"Python版本需要 {required_version[0]}.{required_version[1]} 或更高，" 
                     f"当前版本是 {current_version[0]}.{current_version[1]}.{current_version[2]}")
        show_user_friendly_error(
            ValueError(error_msg),
            "Python版本不符合要求",
            [
                f"升级Python到 {required_version[0]}.{required_version[1]} 或更高版本",
                "访问 https://www.python.org/downloads/ 下载最新版本",
                "确保使用虚拟环境中的Python解释器"
            ]
        )
        return False
    
    logger.info(f"✅ Python版本检查通过: {current_version[0]}.{current_version[1]}.{current_version[2]}")
    return True

@handle_exception
def check_dependencies():
    """检查核心依赖是否安装"""
    logger.info("✅ 跳过详细依赖检查，直接尝试启动应用...")
    return True

def find_nodejs():
    """查找Node.js可执行文件，优先使用项目工具目录中的Node.js"""
    import shutil

    # 1. 项目 Node.js 目录
    tool_node = os.path.join('E:/tool/node-v24.15.0', 'node.exe')
    if os.path.exists(tool_node):
        logger.info(f"✅ 找到项目工具Node.js: {tool_node}")
        return tool_node
    if os.path.exists(tool_node):
        logger.info(f"✅ 找到项目工具Node.js: {tool_node}")
        return tool_node
    
    # 2. 检查系统环境变量中的Node.js
    system_node = shutil.which('node')
    if system_node and os.path.exists(system_node):
        logger.info(f"✅ 找到系统Node.js: {system_node}")
        return system_node
    
    # 3. 检查npm命令路径
    system_npm = shutil.which('npm')
    if system_npm:
        # 从npm路径推导node路径
        node_path = os.path.join(os.path.dirname(system_npm), 'node.exe' if sys.platform == 'win32' else 'node')
        if os.path.exists(node_path):
            logger.info(f"✅ 从npm路径推导Node.js: {node_path}")
            return node_path
    
    logger.warning("❌ 未找到Node.js")
    return None

@handle_exception
def check_nodejs():
    """检查Node.js是否存在"""
    node_path = find_nodejs()
    
    if not node_path:
        logger.error(f"❌ Node.js未找到")
        show_user_friendly_error(
            FileNotFoundError("Node.js executable not found"),
            "Node.js未安装",
            [
                "访问 https://nodejs.org/ 下载并安装Node.js",
                "确保Node.js已添加到系统环境变量",
                "或安装到: scripts/tools/tool/node/ 目录",
                "推荐下载LTS版本（长期支持版本）"
            ]
        )
        return False

    try:
        result = subprocess.run(
            [node_path, '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        version = result.stdout.strip()
        logger.info(f"✅ Node.js检查通过: {version}")
        return True, node_path
    except Exception as e:
        show_user_friendly_error(
            e,
            "Node.js执行失败",
            [
                "检查Node.js安装是否完整",
                "重新安装Node.js",
                "确保Node.js路径正确"
            ]
        )
        return False, None

def build_frontend_dev_dist(args):
    """构建开发环境前端dist目录"""
    frontend_dir = FRONTEND_ROOT
    node_path = find_nodejs()
    # 定义前端端口，与start_frontend_dev_server函数保持一致
    frontend_port = 8178
    
    if not os.path.exists(frontend_dir):
        logger.warning(f"前端目录不存在: {frontend_dir}")
        return False
    
    if not node_path:
        logger.warning(f"Node.js未找到")
        return False
    
    try:
        logger.info("正在构建开发环境前端dist目录...")
        
        # 构建环境变量
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        
        # 确保NODE_ENV设置正确
        env['NODE_ENV'] = args.env
        
        # 加载前端项目根目录的.env文件
        frontend_env_path = os.path.join(frontend_dir, f'.env.{args.env}')
        if os.path.exists(frontend_env_path):
            logger.info(f"加载前端环境变量文件: {frontend_env_path}")
            with open(frontend_env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        # 移除引号
                        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        env[key] = value
                        logger.debug(f"设置环境变量: {key}={value}")
        else:
            logger.warning(f"未找到前端环境变量文件: {frontend_env_path}")
        
        # 确保Vite相关环境变量正确设置
        env['VITE_APP_BASE_URL'] = env.get('VITE_APP_BASE_URL', f'http://localhost:{frontend_port}')
        # 不设置VITE_API_BASE_URL，让前端使用默认的Vite代理模式
        # 这样可以解决跨域问题，并支持通过 IP 访问时的端口转发
        env['VITE_BACKEND_PORT'] = env.get('VITE_BACKEND_PORT', '8080')
        
        logger.info(f"前端环境: {args.env}")
        logger.info(f"前端端口: {frontend_port}")
        logger.info(f"后端端口: {env['VITE_BACKEND_PORT']}")
        logger.info("API基础URL: 未设置，使用默认的Vite代理模式")
        
        # 构建开发版本
        result = subprocess.run(
            [node_path, 'node_modules/vite/bin/vite.js', 'build', '--mode', 'development'],
            cwd=frontend_dir,
            env=env,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=300  # 5分钟超时
        )
        
        if result.returncode == 0:
            logger.info("✅ 开发环境前端dist构建成功")
            
            # 将构建产物复制到static目录
            dev_dist_dir = os.path.join(PROJECT_ROOT, 'static', 'vue-dist-dev')
            build_output_dir = os.path.join(PROJECT_ROOT, 'static', 'vue-dist-dev')
            
            logger.info(f"构建产物源目录: {build_output_dir}")
            logger.info(f"目标复制目录: {dev_dist_dir}")
            
            if os.path.exists(build_output_dir):
                # 确保目标目录存在
                os.makedirs(dev_dist_dir, exist_ok=True)
                
                # 清空目标目录
                if os.path.exists(dev_dist_dir):
                    for item in os.listdir(dev_dist_dir):
                        item_path = os.path.join(dev_dist_dir, item)
                        if os.path.isfile(item_path):
                            os.remove(item_path)
                        elif os.path.isdir(item_path):
                            import shutil
                            shutil.rmtree(item_path)
                
                # 复制构建产物
                import shutil
                for item in os.listdir(build_output_dir):
                    src_path = os.path.join(build_output_dir, item)
                    dst_path = os.path.join(dev_dist_dir, item)
                    
                    if os.path.isfile(src_path):
                        shutil.copy2(src_path, dst_path)
                    elif os.path.isdir(src_path):
                        shutil.copytree(src_path, dst_path)
                
                # 验证复制结果
                copied_files = []
                for root, dirs, files in os.walk(dev_dist_dir):
                    for file in files:
                        copied_files.append(os.path.join(root, file))
                
                logger.info(f"✅ 开发环境前端dist已复制到: {dev_dist_dir}")
                logger.info(f"复制文件数量: {len(copied_files)}")
                return True
            else:
                logger.warning("⚠️ 构建产物目录不存在，跳过复制")
                return True
        else:
            logger.error(f"❌ 开发环境前端dist构建失败")
            if result.stdout:
                logger.error(f"构建输出: {result.stdout}")
            if result.stderr:
                logger.error(f"构建错误: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ 开发环境前端dist构建超时")
        return False
    except Exception as e:
        logger.error(f"❌ 开发环境前端dist构建异常: {e}")
        return False


def install_frontend_dependencies(frontend_dir, node_path):
    """安装前端依赖"""
    node_modules_path = os.path.join(frontend_dir, 'node_modules')
    
    if not os.path.exists(node_modules_path):
        logger.info("正在安装前端依赖...")
        
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        
        try:
            # 直接使用node执行npm安装
            result = subprocess.run(
                [node_path, '-e', 'require(\'child_process\').execSync(\'npm install\', {stdio: \'inherit\'})'],
                cwd=frontend_dir,
                env=env,
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=600  # 10分钟超时
            )
            
            if result.returncode == 0:
                logger.info("✅ 前端依赖安装成功")
                return True
            else:
                logger.error(f"❌ 前端依赖安装失败: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            logger.error("❌ 前端依赖安装超时")
            return False
        except Exception as e:
            logger.error(f"❌ 前端依赖安装异常: {e}")
            return False
    return True

def start_frontend_dev_server(args):
    """启动前端开发服务器"""
    # 使用统一的前端目录
    frontend_dir = FRONTEND_ROOT
    node_path = find_nodejs()
    
    # 目录和文件检查
    if not os.path.exists(frontend_dir):
        logger.error(f"❌ 前端目录不存在: {frontend_dir}")
        logger.info("💡 请确保前端代码已正确放置在项目根目录下")
        return False, None
    
    if not node_path:
        logger.error(f"❌ Node.js未找到")
        return False, None
    
    # 检查前端依赖
    package_json_path = os.path.join(frontend_dir, 'package.json')
    
    if not os.path.exists(package_json_path):
        logger.error(f"❌ package.json未找到: {package_json_path}")
        return False, None
    
    # 自动安装前端依赖
    if not install_frontend_dependencies(frontend_dir, node_path):
        logger.error("❌ 前端依赖安装失败，无法启动开发服务器")
        return False, None
    
    # 端口处理 - 开发模式固定使用5174端口，确保前端端口唯一
    frontend_port = 8178
    
    # 如果启用了跳过端口检查，直接使用指定端口
    if args.skip_port_check:
        logger.info(f"跳过端口检查，使用前端端口 {frontend_port}")
    else:
        if not is_port_available(frontend_port):
            logger.error(f"前端端口 {frontend_port} 已被占用，请释放该端口后重试")
            return False, None
        else:
            logger.info(f"前端端口 {frontend_port} 可用")
    
    try:
        logger.info(f"正在启动前端开发服务器 (模式: {args.env})...")
        
        # 构建环境变量
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        
        # 确保NODE_ENV设置正确
        env['NODE_ENV'] = args.env
        
        # 加载前端项目根目录的.env文件
        frontend_env_path = os.path.join(frontend_dir, f'.env.{args.env}')
        if os.path.exists(frontend_env_path):
            logger.info(f"加载前端环境变量文件: {frontend_env_path}")
            with open(frontend_env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        # 移除引号
                        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        env[key] = value
                        logger.debug(f"设置环境变量: {key}={value}")
        else:
            logger.warning(f"未找到前端环境变量文件: {frontend_env_path}")
        
        # 确保Vite相关环境变量正确设置
        env['VITE_APP_BASE_URL'] = env.get('VITE_APP_BASE_URL', f'http://localhost:{frontend_port}')
        # 不设置VITE_API_BASE_URL，让前端使用默认的Vite代理模式
        # 这样可以确保局域网用户也能正确访问后端API
        env['VITE_BACKEND_PORT'] = env.get('VITE_BACKEND_PORT', '8080')
        
        logger.info(f"前端环境: {args.env}")
        logger.info(f"前端端口: {frontend_port}")
        logger.info(f"后端端口: {env['VITE_BACKEND_PORT']}")
        logger.info(f"API基础URL: {env.get('VITE_API_BASE_URL', '未设置，使用默认的Vite代理模式')}")
        
        # 构建启动命令（增加内存限制防止崩溃）
        command_args = [
            node_path, 
            '--max-old-space-size=4096',  # 增加Node.js内存限制到4GB
            'node_modules/vite/bin/vite.js',
            '--mode', args.env,
            '--host', '0.0.0.0',
            '--port', str(frontend_port),
            '--strictPort',
            # '--force',  # 禁用强制重新构建，避免启动时崩溃
            '--logLevel', 'info'  # 减少日志输出，降低IO压力
        ]
        
        # 创建前端日志目录
        frontend_log_dir = os.path.join(frontend_dir, 'logs')
        os.makedirs(frontend_log_dir, exist_ok=True)
        logger.info(f"✅ 前端日志目录创建成功: {frontend_log_dir}")
        
        # 创建日志文件
        stdout_log = os.path.join(frontend_log_dir, f'vite_stdout_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        stderr_log = os.path.join(frontend_log_dir, f'vite_stderr_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        logger.info(f"✅ 前端日志文件准备就绪: {os.path.basename(stdout_log)}")
        
        logger.info(f"前端启动命令: {' '.join(command_args)}")
        
        # 创建输出读取线程
        def read_output(pipe, log_level, name, process):
            """读取进程输出 - 简化版，显示所有输出信息，包括前端错误提示"""
            logger.info(f"启动输出读取线程: {name}")
            try:
                while True:
                    try:
                        # 检查进程状态
                        if process.poll() is not None:
                            exit_code = process.returncode
                            logger.info(f"进程 {name} 已退出，退出码: {exit_code}")
                            break
                        
                        # 读取所有可用数据
                        data = pipe.readline()
                        if not data:
                            # 管道关闭，退出
                            logger.info(f"输出读取线程 {name} 检测到管道关闭，退出")
                            break
                        
                        # 处理行数据
                        line = data.strip()
                        if not line:
                            continue
                        
                        # 直接记录所有输出，不再过滤
                        logger.log(log_level, f"[{name.upper()}] {line}")
                        
                        # 特别标记关键信息
                        line_lower = line.lower()
                        if any(keyword in line_lower for keyword in ['error', 'warning', 'failed to']):
                            logger.log(logging.ERROR if 'error' in line_lower else logging.WARNING, f"[FRONTEND] {line}")
                    except UnicodeDecodeError as e:
                        logger.warning(f"输出读取线程 {name} 解码错误: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"输出读取线程 {name} 异常: {e}")
                        logger.error(f"异常详情: {traceback.format_exc()}")
                        time.sleep(0.5)
                        continue
            except Exception as e:
                logger.error(f"输出读取线程 {name} 严重异常: {e}")
                logger.error(f"严重异常详情: {traceback.format_exc()}")
            finally:
                logger.info(f"输出读取线程 {name} 退出")
        
        process = subprocess.Popen(
            command_args,
            cwd=frontend_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            bufsize=1
        )
        
        register_process(process, "frontend_dev_server", command_args, frontend_dir, env)
        
        # 添加日志文件保存功能
        def save_output(pipe, log_file, name):
            """保存进程输出到文件"""
            logger.info(f"启动日志保存线程: {name}")
            try:
                with open(log_file, 'a', encoding='utf-8') as f:
                    while True:
                        try:
                            if process.poll() is not None:
                                break
                            data = pipe.readline()
                            if not data:
                                break
                            f.write(data)
                            f.flush()  # 立即写入，避免缓冲
                        except Exception as e:
                            logger.warning(f"日志保存线程 {name} 异常: {e}")
                            time.sleep(0.5)
                            continue
            except Exception as e:
                logger.error(f"日志保存线程 {name} 严重异常: {e}")
            finally:
                logger.info(f"日志保存线程 {name} 退出")
        
        # 启动日志保存线程
        stdout_save_thread = threading.Thread(target=save_output, args=(process.stdout, stdout_log, "vite_stdout_save"))
        stderr_save_thread = threading.Thread(target=save_output, args=(process.stderr, stderr_log, "vite_stderr_save"))
        stdout_save_thread.daemon = True
        stderr_save_thread.daemon = True
        stdout_save_thread.name = "frontend_stdout_saver"
        stderr_save_thread.name = "frontend_stderr_saver"
        
        # 启动输出读取线程
        stdout_thread = threading.Thread(target=read_output, args=(process.stdout, logging.INFO, "vite", process))
        stderr_thread = threading.Thread(target=read_output, args=(process.stderr, logging.ERROR, "vite_error", process))
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.name = "frontend_stdout_reader"
        stderr_thread.name = "frontend_stderr_reader"
        
        # 启动所有线程
        stdout_save_thread.start()
        stderr_save_thread.start()
        stdout_thread.start()
        stderr_thread.start()
        
        # 添加前端进程监控线程
        def monitor_frontend_process(process, name):
            """监控前端进程状态"""
            logger.info(f"启动前端进程监控线程: {name}")
            restart_count = 0
            max_restarts = 3
                                
            while True:
                time.sleep(5)  # 每5秒检查一次
                
                if process.poll() is not None:
                    exit_code = process.returncode
                    logger.warning(f"⚠️ 前端进程 {name} 已退出，退出码: {exit_code}")
                    logger.warning(f"前端服务已停止，正在尝试重启... (重启次数: {restart_count}/{max_restarts})")
                    
                    # 尝试重启前端服务
                    if restart_count < max_restarts:
                        try:
                            restart_count += 1
                            logger.info(f"正在重启前端开发服务器 (第{restart_count}次)...")
                            
                            # 重新启动前端服务器
                            from argparse import Namespace
                            restart_args = Namespace(
                                env=args.env,
                                skip_port_check=args.skip_port_check
                            )
                            restart_success, restart_port = start_frontend_dev_server(restart_args)
                            if restart_success:
                                logger.info(f"✅ 前端开发服务器已成功重启，端口: {restart_port}")
                                logger.info(f"前端访问地址: http://localhost:{restart_port}/")
                                break
                            else:
                                logger.error(f"❌ 前端开发服务器重启失败")
                                time.sleep(10)  # 等待10秒后再次尝试
                        except Exception as e:
                            logger.error(f"重启前端服务时发生异常: {e}")
                            time.sleep(10)
                    else:
                        logger.error(f"❌ 前端开发服务器重启失败次数达到上限 ({max_restarts}次)，停止尝试")
                        break
            
            logger.info(f"前端进程监控线程 {name} 退出")
        
        # 启动进程监控线程
        monitor_thread = threading.Thread(target=monitor_frontend_process, args=(process, "frontend_dev_server"))
        monitor_thread.daemon = True
        monitor_thread.name = "frontend_monitor"
        monitor_thread.start()
        
        logger.info(f"前端开发服务器启动线程已启动 (PID: {process.pid})")
        
        # 启动检测
        max_wait_time = 15
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                if stdout:
                    logger.error(f"前端输出: {stdout}")
                if stderr:
                    logger.error(f"前端错误: {stderr}")
                logger.error(f"❌ 前端开发服务器启动失败，进程已退出 (退出码: {process.returncode})")
                return False, None
            
            if not is_port_available(frontend_port):
                logger.info(f"✅ 前端开发服务器已启动 (PID: {process.pid})")
                logger.info(f"前端访问地址: http://localhost:{frontend_port}/")
                
                # 验证服务器可用性
                try:
                    response = requests.get(f"http://localhost:{frontend_port}/", timeout=5)
                    if response.status_code == 200:
                        logger.info("✅ 前端服务器验证通过")
                        return True, frontend_port
                except Exception as e:
                    logger.warning(f"⚠️ 前端服务器验证失败: {str(e)}")
            
            time.sleep(1)
        
        logger.error(f"❌ 前端开发服务器启动超时 ({max_wait_time}秒)")
        process.terminate()
        try:
            stdout, stderr = process.communicate(timeout=5)
            if stdout:
                logger.error(f"前端输出: {stdout}")
            if stderr:
                logger.error(f"前端错误: {stderr}")
        except subprocess.TimeoutExpired:
            logger.error("❌ 无法获取前端服务输出，进程已超时终止")
        return False, None
        
    except Exception as e:
        logger.error(f"❌ 前端开发服务器启动失败: {str(e)}")
        traceback.print_exc()
        return False, None

def check_qdrant():
    """检查Qdrant是否正在运行"""
    qdrant_path = os.path.join(PROJECT_ROOT, 'tool', 'qdrant-x86_64-pc-windows-msvc', 'qdrant.exe')
    
    if not os.path.exists(qdrant_path):
        logger.warning(f"Qdrant未找到: {qdrant_path}")
        logger.info("Qdrant是向量数据库，用于图片相似性搜索功能")
        logger.info("下载地址: https://github.com/qdrant/qdrant/releases")
        logger.info(f"请将Qdrant安装到: {os.path.dirname(qdrant_path)}")
        return False
    
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ['tasklist', '/FI', 'IMAGENAME eq qdrant.exe'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if 'qdrant.exe' in result.stdout:
                logger.info("✅ Qdrant服务器已经在运行")
                return True
        else:
            result = subprocess.run(
                ['ps', 'aux', '|', 'grep', 'qdrant'],
                capture_output=True,
                text=True,
                timeout=5,
                shell=True
            )
            if 'qdrant' in result.stdout and 'grep' not in result.stdout:
                logger.info("✅ Qdrant服务器已经在运行")
                return True
        
        logger.warning("Qdrant服务器未运行")
        logger.info("请运行: scripts/start_qdrant.bat 或使用Docker启动")
        return False
    except Exception as e:
        logger.warning(f"无法检查Qdrant状态: {str(e)}")
        return False

def check_redis():
    """检查Redis是否正在运行，没有则启动（优化版）"""
    redis_path = os.path.join(PROJECT_ROOT, 'tool', 'Redis-x64-3.0.504', 'redis-server.exe')
    
    if not os.path.exists(redis_path):
        logger.warning(f"Redis未找到: {redis_path}")
        return False
    
    def is_redis_running():
        """简化Redis检查，避免超时问题"""
        try:
            # 使用快速的方法检查Redis端口是否可连接
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)  # 2秒超时
            result = sock.connect_ex(('localhost', 6379))
            sock.close()
            return result == 0  # 如果连接成功，返回True
        except Exception as e:
            logger.debug(f"Redis端口检查失败: {str(e)}")
            return False
    
    # 检查Redis是否已经在运行
    if is_redis_running():
        logger.info("✅ Redis服务器已经在运行")
        return True
    
    # 启动Redis
    try:
        logger.info("正在启动Redis服务器...")
        
        CREATE_NO_WINDOW = 0x08000000
        DETACHED_PROCESS = 0x00000008
        
        # 使用Redis配置文件启动
        redis_config = os.path.join(os.path.dirname(redis_path), 'redis.windows.conf')
        if os.path.exists(redis_config):
            process = subprocess.Popen(
                [redis_path, redis_config],
                creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            process = subprocess.Popen(
                [redis_path, '--port', '6379', '--loglevel', 'notice'],
                creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        
        # 等待更长时间让Redis启动完成
        time.sleep(5)
        
        # 使用更可靠的方法检查Redis是否启动成功
        max_retries = 3
        for attempt in range(max_retries):
            if is_redis_running():
                logger.info("✅ Redis服务器已启动")
                logger.info("Redis地址: localhost:6379")
                return True
            
            if attempt < max_retries - 1:
                logger.info(f"等待Redis启动... (尝试 {attempt + 1}/{max_retries})")
                time.sleep(2)
        
        logger.error("❌ Redis服务器启动失败")
        return False
        
    except Exception as e:
        logger.error(f"❌ Redis服务器启动失败: {str(e)}")
        return False

def start_java_backend_dev():
    """开发模式启动 Java 业务后端"""
    JAVA_HOME = 'E:/软件/PyCharm 2025.2.1.1/jbr'
    MAVEN_HOME = 'E:/tool/apache-maven-3.9.9'
    JAVA_BACKEND_DIR = os.path.join(PROJECT_ROOT, 'java-backend')
    JAVA_PORT = 8090
    mvn_exe = os.path.join(MAVEN_HOME, 'bin', 'mvn.cmd')

    if not os.path.exists(mvn_exe):
        logger.warning(f"Maven 未找到，跳过 Java 后端启动")
        return False

    # 如果已在运行，先停掉（可能用的旧配置）
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    try:
        s.connect(('127.0.0.1', JAVA_PORT))
        s.close()
        logger.info("检测到 Java 已在运行，停止旧实例...")
        procs = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, timeout=5)
        for line in procs.stdout.split('\n'):
            if f':{JAVA_PORT}' in line and 'LISTENING' in line:
                pid = line.split()[-1]
                subprocess.run(['taskkill', '/F', '/T', '/PID', pid], capture_output=True, timeout=5)
        time.sleep(2)
    except Exception:
        pass

    logger.info("启动 Java 业务后端...")
    env = os.environ.copy()
    env['JAVA_HOME'] = JAVA_HOME
    env['PATH'] = os.path.join(JAVA_HOME, 'bin') + os.pathsep + os.path.dirname(mvn_exe) + os.pathsep + env.get('PATH', '')
    env['MYSQL_DATABASE'] = 'sijuelishi_dev'  # 开发模式用开发库
    # COS 配置从 .env 读取传给 Java
    backend_env = os.path.join(BACKEND_ROOT, '.env')
    if os.path.exists(backend_env):
        with open(backend_env, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('COS_SECRET_ID='):
                    env['TENCENT_COS_SECRET_ID'] = line.split('=', 1)[1].strip()
                elif line.startswith('COS_SECRET_KEY='):
                    env['TENCENT_COS_SECRET_KEY'] = line.split('=', 1)[1].strip()
                elif line.startswith('COS_BUCKET='):
                    env['TENCENT_COS_BUCKET'] = line.split('=', 1)[1].strip()
                elif line.startswith('COS_ENABLED='):
                    env['TENCENT_COS_ENABLED'] = line.split('=', 1)[1].strip()

    process = subprocess.Popen(
        [mvn_exe, 'spring-boot:run', '-Dspring-boot.run.arguments=--server.port=' + str(JAVA_PORT)],
        cwd=JAVA_BACKEND_DIR, env=env
    )

    for i in range(30):
        time.sleep(2)
        if process.poll() is not None:
            logger.error(f"Java 后端启动失败 (exit={process.returncode})")
            return False
        try:
            s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s2.settimeout(2)
            s2.connect(('127.0.0.1', JAVA_PORT))
            s2.close()
            logger.info(f"✅ Java 业务后端就绪 (PID={process.pid}, port={JAVA_PORT})")
            return True
        except Exception:
            if i % 5 == 4:
                logger.info(f"  等待 Java 启动... ({i+1}/30)")
    logger.error("Java 后端启动超时")
    return False


def start_application_with_hot_reload(args):
    """启动应用程序（开发模式/热更新模式）"""
    logger.info(f"\n=== 图片数据库管理系统启动（{args.env}环境/热更新）===")
    logger.info("=" * 50)

    # 跳过端口检查，直接启动服务
    logger.info("跳过端口检查，直接启动服务")

    # 执行前置检查
    if not check_python_version():
        return False

    if not check_virtual_environment():
        return False

    # 启动 Java 业务后端（已废弃，使用 Python 统一后端）
    # start_java_backend_dev()
    
    if not check_dependencies():
        return False
    
    if not check_redis():
        return False
    # check_qdrant() -- Qdrant 非必须
    
    # 检查Node.js
    node_ok, node_path = check_nodejs()
    if not node_ok:
        logger.warning("Node.js检查失败，将跳过前端开发服务器启动")
    
    logger.info(f"当前环境: {args.env}")
    
    # Python 开发后端端口（AI 服务）
    backend_port = 8080
    if args.port != 8080:
        backend_port = args.port
        logger.info(f"使用自定义后端端口: {backend_port}")
    
    # 检查后端端口是否可用，如果不可用则自动更换端口
    if not args.skip_port_check:
        if not is_port_available(backend_port):
            logger.warning(f"后端端口 {backend_port} 已被占用，正在尝试自动更换端口...")
            # 使用get_available_port_with_fallback函数获取可用端口
            original_port = backend_port
            backend_port = get_available_port_with_fallback(start_port=backend_port)
            logger.info(f"已切换到可用后端端口: {backend_port}")
        else:
            logger.info(f"后端端口 {backend_port} 可用")
    else:
        logger.info(f"跳过端口检查，使用后端端口 {backend_port}")
    
    # 构建前端dist目录（开发模式）
    # build_frontend_dev_dist(args)
    
    # 动态更新前端配置，确保前后端通信正常
    logger.info("\n=== 动态更新前端配置 ===")
    try:
        # 使用统一的后端目录
        backend_dir = BACKEND_ROOT
        frontend_dir = FRONTEND_ROOT
        
        # 更新前端环境变量文件，Vite配置通过环境变量获取后端端口，无需直接修改配置文件
        env_file_path = os.path.join(frontend_dir, '.env.development')
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r', encoding='utf-8') as f:
                env_content = f.read()
            
            # 更新后端端口配置
            if 'VITE_BACKEND_PORT=' in env_content:
                env_content = re.sub(
                    r'VITE_BACKEND_PORT=.*',
                    f'VITE_BACKEND_PORT={backend_port}',
                    env_content
                )
            else:
                env_content += f'\nVITE_BACKEND_PORT={backend_port}'
            
            # 关键：确保 VITE_API_BASE_URL 被注释掉，或者如果不被注释，也不要包含 /api/v1
            if 'VITE_API_BASE_URL=' in env_content:
                # 无论是否已经注释，都确保它不包含 /api/v1 以防万一
                env_content = re.sub(
                    r'(VITE_API_BASE_URL=.*?)/api/v1/?',
                    r'\1',
                    env_content
                )
                
                # 如果没被注释，则注释掉它以启用动态识别
                if not re.search(r'^#\s*VITE_API_BASE_URL=', env_content, re.M):
                    env_content = re.sub(
                        r'^(VITE_API_BASE_URL=.*)',
                        r'# \1',
                        env_content,
                        flags=re.M
                    )
            
            # 写入更新后的环境变量
            with open(env_file_path, 'w', encoding='utf-8') as f:
                f.write(env_content)
            logger.info(f"已更新前端环境变量，后端端口: {backend_port}")
            logger.info("已注释 VITE_API_BASE_URL 以启用动态 IP 识别逻辑")
        else:
            logger.warning(f"前端环境变量文件不存在: {env_file_path}")
    except Exception as e:
        logger.warning(f"更新前端配置时出现错误: {e}")
        logger.info("继续启动服务...")
    
    # 启动前端开发服务器
    frontend_port = 8178
    if node_ok:
        logger.info("正在启动前端开发服务器...")
        frontend_ok, _ = start_frontend_dev_server(args)
        if frontend_ok:
            logger.info(f"✅ 前端开发服务器启动成功 (端口: {frontend_port})")
        else:
            logger.warning("⚠️ 前端开发服务器启动失败，将继续启动后端服务")
    
    # 启动FastAPI
    try:
        # 使用统一的后端目录
        backend_dir = BACKEND_ROOT
        frontend_dir = FRONTEND_ROOT
        
        # 获取本机IP
        local_ip = get_local_ip()
        
        # 显示访问地址
        logger.info("=" * 60)
        logger.info("系统访问地址")
        logger.info("=" * 60)
        logger.info("前端页面:")
        logger.info(f"  前端(Vite): http://localhost:{frontend_port}/")
        if local_ip:
            logger.info(f"              http://{local_ip}:{frontend_port}/")
        logger.info("")
        logger.info("后端API:")
        logger.info(f"  - 本地访问: http://localhost:{backend_port}/")
        if local_ip:
            logger.info(f"  - 局域网访问: http://{local_ip}:{backend_port}/")
        logger.info(f"  - API文档: http://localhost:{backend_port}/docs")
        logger.info(f"  - 健康检查: http://localhost:{backend_port}/health")
        logger.info("=" * 60)
        
        logger.info(f"后端代码目录: {backend_dir}")
        logger.info(f"前端代码目录: {frontend_dir}")
        logger.info(f"环境配置: {args.env}")
        
        # 构建uvicorn命令
        uvicorn_args = [
            VENV_PYTHON, '-m', 'uvicorn',
            'app.main:app',
            '--host', '0.0.0.0',
            '--port', str(backend_port),
            '--log-level', 'info',
            '--reload',
            '--reload-dir', 'backend/app'  # 仅监听应用代码目录，减少不必要的重启
        ]
        
        logger.info(f"使用虚拟环境Python: {VENV_PYTHON}")
        logger.info(f"启动命令: {' '.join(uvicorn_args)}")
        # 获取监听地址
        host = uvicorn_args[uvicorn_args.index('--host') + 1]
        port = uvicorn_args[uvicorn_args.index('--port') + 1]
        logger.info(f"监听地址: {host}:{port}")
        
        # 启动uvicorn，使用后端目录作为工作目录，确保app模块能被正确导入
        
        # 构建环境变量（确保传递正确的环境变量）
        env_vars = os.environ.copy()
        env_vars['ENVIRONMENT'] = args.env
        env_vars['PROJECT_ROOT'] = PROJECT_ROOT
        env_vars['BACKEND_PORT'] = str(backend_port)
        # 添加项目根目录到PYTHONPATH，确保uvicorn子进程能正确导入模块
        env_vars['PYTHONPATH'] = f"{PROJECT_ROOT};{backend_dir}"  # Windows使用分号分隔
        # 为热重载添加更多环境配置
        env_vars['ENV_CONFIG_PATH'] = os.path.join(env_roots[args.env], 'config')
        
        # 直接运行uvicorn，让其独立处理热重载
        # 使用subprocess.run代替subprocess.Popen，让脚本直接等待uvicorn进程结束
        try:
            subprocess.run(
                uvicorn_args,
                cwd=PROJECT_ROOT,  # 使用项目根目录，确保app.main:app能被正确导入
                env=env_vars,
                check=True
            )
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"uvicorn进程异常退出，退出码: {e.returncode}")
            return False
        except KeyboardInterrupt:
            logger.info("服务已被用户中断")
            return True
        
    except Exception as e:
        logger.error(f"应用启动失败: {str(e)}")
        cleanup_processes()
        traceback.print_exc()
        return False



def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='图片数据库管理系统启动脚本 - 开发模式专用')
    parser.add_argument('--mode', choices=['dev'], default='dev',
                       help='启动模式: dev (开发模式)')
    parser.add_argument('--port', type=int, default=8080,
                       help='服务器端口 (默认: 8080)')
    parser.add_argument('--host', default='0.0.0.0',
                       help='服务器主机 (默认: 0.0.0.0)')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='日志级别')
    parser.add_argument('--env', choices=['development'], default=default_env,
                       help='运行环境: development (开发模式专用)')
    parser.add_argument('--status', action='store_true',
                       help='显示环境状态监控信息')
    parser.add_argument('--skip-port-check', action='store_true',
                       help='跳过端口占用检查，直接启动服务')
    
    args = parser.parse_args()
    
    # 初始化日志系统
    global logger
    setup_logging_system(args.env)
    logger = logging.getLogger(__name__)
    
    # 设置环境变量
    os.environ['ENVIRONMENT'] = args.env
    os.environ['PROJECT_ROOT'] = PROJECT_ROOT
    
    # 显示环境信息
    logger.info(f"当前环境: {args.env}")
    logger.info(f"开发环境根目录: {shorten_path(env_roots['development'])}")
    logger.info(f"项目根目录: {shorten_path(PROJECT_ROOT)}")
    
    # 记录找到的虚拟环境
    if os.path.exists(VENV_DIR):
        logger.info(f"找到虚拟环境: {shorten_path(VENV_DIR)}")
    else:
        logger.warning(f"虚拟环境不存在: {shorten_path(VENV_DIR)}")
    
    # 导入配置文件 - 简化导入逻辑，避免复杂初始化冲突
    global HAS_CONFIG, settings
    HAS_CONFIG = False
    settings = None
    
    # 仅设置环境变量，不直接导入配置模块
    # 配置模块将由app.main在运行时导入，避免冲突
    env_config_path = os.path.join(env_roots[args.env], 'config')
    os.environ['ENV_CONFIG_PATH'] = env_config_path
    logger.info(f"已设置环境配置路径: {shorten_path(env_config_path)}")
    
    # 显示环境状态监控
    if args.status:
        check_environment_status()
        return True
    
    # 单环境启动（只支持开发环境）
    success = start_application_with_hot_reload(args)
    
    if not success:
        logger.error("\n❌ 启动失败，请检查以上错误信息")
        return False
    return True

# ========== 改进程序退出机制和优雅关闭 ==========
def setup_graceful_shutdown():
    """设置优雅退出处理"""
    def signal_handler(signum: int, _: Any) -> None:
        """信号处理函数"""
        if logger:
            logger.info(f"接收到信号 {signum}，开始优雅退出...")
        cleanup_all_resources()
        sys.exit(0)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # 终止信号
    
    # 注册退出处理
    atexit.register(cleanup_all_resources)


def cleanup_all_resources():
    """清理所有资源（Ctrl+C 时自动调用）"""
    try:
        global logger

        # 强制清理所有已知端口
        force_kill_ports()

        # 1. 杀 Java 后端
        try:
            JAVA_PORT = 8090
            procs = subprocess.run(
                ['netstat', '-ano'], capture_output=True, text=True, timeout=5
            )
            for line in procs.stdout.split('\n'):
                if f':{JAVA_PORT}' in line and 'LISTENING' in line:
                    pid = line.split()[-1]
                    subprocess.run(['taskkill', '/F', '/T', '/PID', pid],
                                   capture_output=True, timeout=5)
                    if logger:
                        logger.info(f"已停止 Java 后端 (PID={pid})")
        except Exception:
            pass

        # 2. 停 Vite 前端
        try:
            VITE_PORT = 8178
            procs = subprocess.run(
                ['netstat', '-ano'], capture_output=True, text=True, timeout=5
            )
            for line in procs.stdout.split('\n'):
                if f':{VITE_PORT}' in line and 'LISTENING' in line:
                    pid = line.split()[-1]
                    subprocess.run(['taskkill', '/F', '/T', '/PID', pid],
                                   capture_output=True, timeout=5)
                    if logger:
                        logger.info(f"已停止 Vite 前端 (PID={pid})")
        except Exception:
            pass

        # 3. 清理临时文件
        cleanup_temp_files()

        # 4. 关闭数据库连接
        close_database_connections()

        if logger:
            logger.info("所有服务已停止")
    except Exception as e:
        if logger:
            logger.error(f"清理异常: {e}")
        else:
            print(f"清理异常: {e}")


def force_kill_ports():
    """强制清理所有项目相关端口（通过 netstat + taskkill 彻底杀进程树）"""
    ports = [8080, 8090, 8100, 8178]  # 开发模式：Python后端、Java后端、Python AI、前端
    killed = []
    try:
        procs = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, timeout=5)
        for line in procs.stdout.split('\n'):
            for port in ports:
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    pid = parts[-1]
                    if pid.isdigit() and pid not in killed:
                        subprocess.run(['taskkill', '/F', '/T', '/PID', pid],
                                       capture_output=True, timeout=5)
                        killed.append(pid)
                        if logger:
                            logger.info(f"  已强制清理端口 {port} (PID={pid})")
    except Exception as e:
        if logger:
            logger.warning(f"端口清理异常: {e}")


def cleanup_temp_files():
    """清理临时文件"""
    global logger
    try:
        temp_dirs = [
            os.path.join(PROJECT_ROOT, 'temp'),
            os.path.join(PROJECT_ROOT, 'logs', 'temp'),
        ]
        
        for temp_dir in temp_dirs:
            if os.path.exists(temp_dir):
                for file in os.listdir(temp_dir):
                    if file.endswith('.tmp') or file.endswith('.temp'):
                        os.remove(os.path.join(temp_dir, file))
                        if logger:
                            logger.debug(f"已删除临时文件: {file}")
    except Exception as e:
        if logger:
            logger.warning(f"清理临时文件失败: {e}")


def close_database_connections():
    """关闭数据库连接（增强版）
    
    实现更健壮的数据库连接关闭机制，处理可能的连接超时和异常。
    添加连接关闭状态验证，确保资源清理的完整性和可靠性。
    """
    global logger
    try:
        # 尝试导入数据库模块并关闭连接
        try:
            from backend.app.database import close_db_connections
            
            # 调用应用的数据库连接关闭函数
            result = close_db_connections()
            
            # 验证连接关闭状态
            if result or result is None:  # 允许函数返回None（如果没有实现返回值）
                if logger:
                    logger.info("数据库连接已关闭")
            else:
                if logger:
                    logger.warning("数据库连接关闭状态验证失败")
                    
        except ImportError as ie:
            if logger:
                logger.debug(f"数据库模块导入失败，可能是因为服务尚未完全启动: {ie}")
        except ConnectionError as ce:
            # 处理连接相关错误
            if logger:
                logger.warning(f"数据库连接错误: {ce}")
        except TimeoutError as te:
            # 处理连接超时
            if logger:
                logger.warning(f"数据库连接关闭超时: {te}")
        except Exception as e:
            # 处理其他异常
            if logger:
                logger.warning(f"关闭数据库连接时发生未知错误: {e}")
                logger.debug(f"错误详情: {traceback.format_exc()}")
    except Exception as e:
        # 捕获外层异常，确保函数不会崩溃
        if logger:
            logger.error(f"执行数据库连接关闭函数时发生错误: {e}")
            logger.debug(f"错误详情: {traceback.format_exc()}")


# ========== 定期维护机制 ==========
def schedule_weekly_maintenance():
    """安排每周维护任务"""
    def maintenance_task():
        while True:
            # 每周执行一次维护
            time.sleep(7 * 24 * 60 * 60)  # 7天
            
            global logger
            if logger:
                logger.info("执行每周系统维护...")
            
            # 优化数据库
            optimize_database()
    
    # 在后台线程中运行维护任务
    maintenance_thread = threading.Thread(target=maintenance_task, daemon=True)
    maintenance_thread.start()


def optimize_database():
    """优化数据库"""
    global logger
    try:
        # 尝试优化数据库
        try:
            from backend.app.database import optimize_database
            optimize_database()
            if logger:
                logger.info("数据库优化完成")
        except ImportError:
            pass
    except Exception as e:
        if logger:
            logger.warning(f"数据库优化失败: {e}")


def check_environment_status():
    """检查开发环境状态（适配简化架构）"""
    logger.info("\n=== 环境状态监控（开发模式专用）===")
    
    # 检查统一的后端和前端目录
    logger.info(f"\n检查统一代码目录:")
    logger.info(f"✅ 后端代码目录: {BACKEND_ROOT}" if os.path.exists(BACKEND_ROOT) else f"❌ 后端代码目录不存在: {BACKEND_ROOT}")
    logger.info(f"✅ 前端代码目录: {FRONTEND_ROOT}" if os.path.exists(FRONTEND_ROOT) else f"❌ 前端代码目录不存在: {FRONTEND_ROOT}")
    logger.info(f"✅ 配置目录: {CONFIG_ROOT}" if os.path.exists(CONFIG_ROOT) else f"❌ 配置目录不存在: {CONFIG_ROOT}")
    
    # 只检查开发环境
    env = 'development'
    env_root = env_roots[env]
    logger.info(f"\n检查 {env} 环境:")
    
    # 检查目录结构
    if os.path.exists(env_root):
        logger.info(f"✅ 环境根目录存在: {env_root}")
        
        # 检查关键目录（简化架构：只有数据库和日志）
        key_dirs = ['database', 'logs']
        for dir_name in key_dirs:
            dir_path = os.path.join(env_root, dir_name)
            if os.path.exists(dir_path):
                logger.info(f"  ✅ {dir_name} 目录存在")
            else:
                logger.warning(f"  ❌ {dir_name} 目录不存在")
    else:
        logger.warning(f"❌ 环境根目录不存在: {env_root}")
    
    logger.info("\n=== 环境状态监控完成 ===")
    return True

# ========== 主函数增强 ==========
def main_enhanced() -> None:
    """增强的主函数，包含优雅关闭和定期维护"""
    # 设置优雅退出处理
    setup_graceful_shutdown()
    
    # 启动定期维护任务
    schedule_weekly_maintenance()
    
    # 调用原有的主函数
    success = main()
    
    # 根据主函数的返回值决定退出码
    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main_enhanced()