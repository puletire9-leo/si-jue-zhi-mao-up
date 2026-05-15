#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
思觉智贸启动脚本 - 生产模式专用
修复虚拟环境检测和切换逻辑
仅用于生产环境部署，不支持开发模式
"""
import os
import sys
import json
import argparse
import subprocess
import time
import socket
import logging
import logging.handlers
import traceback
import threading
import concurrent.futures
from typing import List, Optional, Callable, Any
from functools import wraps
from datetime import datetime, timedelta

# ========== 修复点1：统一路径计算逻辑 ==========
# 获取当前脚本目录
CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
# 计算项目根目录（当前脚本目录向上两级）
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_FILE_DIR, "..", ".."))
# 添加项目根目录到Python路径
sys.path.insert(0, PROJECT_ROOT)

# ========== 环境根目录管理 ==========
# 环境根目录映射（适配简化架构）
env_roots = {
    'development': os.path.join(PROJECT_ROOT, 'development'),
    'production': os.path.join(PROJECT_ROOT, 'production')
}

# 后端代码统一目录（根目录）
BACKEND_ROOT = os.path.join(PROJECT_ROOT, 'backend')
FRONTEND_ROOT = os.path.join(PROJECT_ROOT, 'frontend')
CONFIG_ROOT = os.path.join(PROJECT_ROOT, 'config')
STATIC_DIST = os.path.join(PROJECT_ROOT, 'static', 'vue-dist').replace('\\', '/')
JAVA_BACKEND_DIR = os.path.join(PROJECT_ROOT, 'java-backend')
JAVA_HOME = 'E:/软件/PyCharm 2025.2.1.1/jbr'
MAVEN_HOME = 'E:/tool/apache-maven-3.9.9'
JAVA_PORT = 7090
PYTHON_AI_PORT = 7100


# 默认环境
default_env = 'production'

# ========== 多线程配置 ==========
# 线程池配置
DEFAULT_THREAD_POOL_SIZE = 8
MAX_THREAD_POOL_SIZE = 16

# 全局线程池
thread_pool = None
thread_pool_size = DEFAULT_THREAD_POOL_SIZE

# 定义虚拟环境路径选项
VENV_OPTIONS = [
    os.path.join(PROJECT_ROOT, "backend", "venv"),
    os.path.join(PROJECT_ROOT, ".venv公司")  # 兼容旧项目
]  

# ========== 按照优先级选择虚拟环境 ==========
# 不依赖当前激活的虚拟环境，始终按优先级选择
VENV_DIR = None

# 按照 VENV_OPTIONS 顺序查找第一个存在的虚拟环境
for venv_path in VENV_OPTIONS:
    if os.path.exists(venv_path):
        VENV_DIR = venv_path
        break

# 如果没有找到任何虚拟环境，使用默认值
if VENV_DIR is None:
    VENV_DIR = os.path.join(PROJECT_ROOT, ".venv公司")

# 跨平台兼容的虚拟环境Python路径
if sys.platform == "win32":
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")

# 检查虚拟环境路径是否存在
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

# ========== 原有日志配置等代码保持不变 ==========
def setup_logging_system(env='production'):
    """配置系统化日志系统（适配简化架构）"""
    # 使用环境特定的日志目录（简化架构）
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
    
    # 归档旧日志文件
    archive_old_logs(logs_dir)
    
    return PROJECT_ROOT

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

# 全局进程列表
managed_processes: List[subprocess.Popen] = []

# 全局日志记录器
logger = None

# 全局退出标志
should_exit = False

# 全局变量
frontend_monitor_thread = None
frontend_monitor_running = False
system_shutting_down = False

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
                
                # 只清理进程对象和启动时间，保留命令、工作目录和环境变量以便重启
                if name in self.processes:
                    del self.processes[name]
                if name in self.start_times:
                    del self.start_times[name]
                return True
            except Exception as e:
                logger.error(f"终止进程 {name} 失败: {str(e)}")
                # 即使失败也只清理进程对象和启动时间
                if name in self.processes:
                    del self.processes[name]
                if name in self.start_times:
                    del self.start_times[name]
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
            try:
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
                except FileNotFoundError as e:
                    logger.error(f"重启进程 {name} 失败: 找不到可执行文件 - {str(e)}")
                    logger.error("请检查命令路径是否正确，依赖是否安装完整")
                    return None
                except PermissionError as e:
                    logger.error(f"重启进程 {name} 失败: 权限错误 - {str(e)}")
                    logger.error("请检查文件权限是否正确")
                    return None
                except Exception as e:
                    logger.error(f"重启进程 {name} 失败: {str(e)}")
                    logger.error(f"错误详情: {traceback.format_exc()}")
                    return None
            except Exception as e:
                logger.error(f"重启进程 {name} 过程中发生异常: {str(e)}")
                return None
        else:
            logger.error(f"无法重启进程 {name}: 进程命令未找到")
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

# ========== 线程池管理函数 ==========
@handle_exception
def initialize_thread_pool(size: int = DEFAULT_THREAD_POOL_SIZE):
    """初始化线程池"""
    global thread_pool, thread_pool_size
    
    if thread_pool is not None:
        logger.warning("线程池已存在，先关闭现有线程池")
        shutdown_thread_pool()
    
    # 限制线程池大小
    actual_size = min(max(1, size), MAX_THREAD_POOL_SIZE)
    thread_pool_size = actual_size
    
    thread_pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=actual_size,
        thread_name_prefix="prod_multiprocess"
    )
    
    logger.info(f"✅ 线程池初始化完成，线程数: {actual_size}")
    return True

@handle_exception
def shutdown_thread_pool():
    """关闭线程池"""
    global thread_pool
    
    if thread_pool is None:
        logger.info("线程池未初始化，无需关闭")
        return True
    
    logger.info("正在关闭线程池...")
    
    try:
        # 等待所有任务完成
        thread_pool.shutdown(wait=True)
        thread_pool = None
        logger.info("✅ 线程池已成功关闭")
        return True
    except Exception as e:
        logger.error(f"关闭线程池失败: {e}")
        logger.error(f"错误详情:\n{traceback.format_exc()}")
        # 强制设置线程池为None，避免后续使用
        thread_pool = None
        return False

@handle_exception
def submit_task_to_thread_pool(func: Callable, *args, **kwargs) -> concurrent.futures.Future:
    """提交任务到线程池"""
    global thread_pool
    
    if thread_pool is None:
        logger.warning("线程池未初始化，自动初始化默认线程池")
        initialize_thread_pool()
    
    future = thread_pool.submit(func, *args, **kwargs)
    logger.debug(f"✅ 任务已提交到线程池: {func.__name__}")
    return future

@handle_exception
def wait_for_thread_pool_completion(timeout: Optional[float] = None) -> bool:
    """等待线程池中所有任务完成"""
    global thread_pool
    
    if thread_pool is None:
        logger.warning("线程池未初始化，无需等待")
        return True
    
    try:
        # 获取所有未完成的任务
        pending_futures = [f for f in concurrent.futures.as_completed([], timeout=0.1)]
        
        if pending_futures:
            logger.info(f"等待 {len(pending_futures)} 个任务完成...")
            
            # 等待所有任务完成
            done, not_done = concurrent.futures.wait(
                pending_futures,
                timeout=timeout,
                return_when=concurrent.futures.ALL_COMPLETED
            )
            
            if not_done:
                logger.warning(f"⚠️ 超时，仍有 {len(not_done)} 个任务未完成")
                return False
            else:
                logger.info("✅ 所有任务已完成")
                return True
        else:
            logger.debug("✅ 没有待完成的任务")
            return True
            
    except Exception as e:
        logger.warning(f"等待线程池完成时出错: {e}")
        return False

# ========== 修复点2：重写虚拟环境检查函数 ==========
@handle_exception
def check_virtual_environment():
    """检查并自动切换到项目虚拟环境（修复版）"""
    # 检查当前Python解释器路径
    current_python = sys.executable.lower()
    expected_python = VENV_PYTHON.lower()
    
    # 如果已经在正确的虚拟环境中，直接返回
    if current_python == expected_python:
        logger.info(f"✅ 虚拟环境检查通过: {sys.prefix}")
        return True
    
    # 检查虚拟环境是否存在
    if not os.path.exists(VENV_PYTHON):
        error_msg = f"虚拟环境Python解释器未找到: {VENV_PYTHON}"
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
    
    # ========== 修复点3：改进的虚拟环境切换逻辑 ==========
    logger.warning(f"当前Python路径: {sys.executable}")
    logger.warning(f"期望虚拟环境Python: {VENV_PYTHON}")
    logger.info("正在自动切换到项目虚拟环境...")
    
    try:
        # 构建新的命令（使用subprocess启动虚拟环境中的Python）
        new_command = [VENV_PYTHON] + sys.argv
        
        logger.info(f"执行命令: {' '.join(new_command)}")
        
        # 使用subprocess启动虚拟环境中的Python脚本
        subprocess.run(new_command, check=True)
        return True
        
    except Exception as e:
        error_msg = f"自动切换虚拟环境失败: {str(e)}"
        show_user_friendly_error(
            RuntimeError(error_msg),
            "虚拟环境切换失败",
            [
                "请先手动激活项目虚拟环境：",
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

def is_port_available(port: int) -> bool:
    """检查端口是否可用"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('localhost', port))
            return result != 0
    except Exception as e:
        logger.warning(f"检查端口状态失败: {e}")
        return True

def get_port_process_info(port: int) -> Optional[dict]:
    """获取占用指定端口的进程信息"""
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ['netstat', '-ano', '|', 'findstr', f':{port}'],
                capture_output=True,
                text=True,
                timeout=5,
                shell=True
            )
        else:
            result = subprocess.run(
                ['lsof', '-i', f':{port}'],
                capture_output=True,
                text=True,
                timeout=5
            )
        
        if result.stdout and f':{port}' in result.stdout:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'LISTENING' in line or 'LISTEN' in line:
                    if sys.platform == "win32":
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            process_result = subprocess.run(
                                ['tasklist', '/FI', f'PID eq {pid}', '/NH', '/FO', 'CSV'],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            if process_result.stdout:
                                process_name = process_result.stdout.split(',')[0].strip('"')
                                return {
                                    'pid': pid,
                                    'name': process_name,
                                    'port': port
                                }
                    else:
                        parts = line.split()
                        if len(parts) >= 2:
                            pid = parts[1]
                            process_name = parts[0]
                            return {
                                'pid': pid,
                                'name': process_name,
                                'port': port
                            }
        return None
    except Exception as e:
        logger.warning(f"获取端口进程信息失败: {e}")
        return None

def _get_port_pids(port: int) -> list:
    """获取占用指定端口的所有 PID"""
    pids = []
    try:
        r = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, timeout=5)
        for line in r.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                pid = parts[-1]
                if pid.isdigit():
                    pids.append(int(pid))
    except Exception:
        pass
    return pids


def _get_root_pid(pid: int) -> int:
    """向上追溯进程树，找到根进程 PID（杀它才能断根）"""
    seen = set()
    for _ in range(10):  # 最多 10 层
        if pid in seen:
            break
        seen.add(pid)
        try:
            r = subprocess.run(
                ['wmic', 'process', 'where', f'ProcessId={pid}',
                 'get', 'ParentProcessId', '/format:csv'],
                capture_output=True, text=True, timeout=5
            )
            for line in r.stdout.strip().split('\n')[2:]:  # skip header
                parts = [p.strip() for p in line.split(',') if p.strip()]
                if parts and parts[-1].isdigit():
                    ppid = int(parts[-1])
                    if ppid == 0 or ppid == pid:
                        return pid
                    pid = ppid
                    break
        except Exception:
            return pid
    return pid


PID_FILE = os.path.join(PROJECT_ROOT, 'production', '.runtime.pid')


def _clean_previous_instance():
    """读取 PID 文件，杀掉上次启动留下的旧进程"""
    if not os.path.exists(PID_FILE):
        return
    try:
        with open(PID_FILE, 'r') as f:
            data = json.loads(f.read())
        for name, pid in data.items():
            try:
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)],
                               capture_output=True, timeout=5)
                logger.info(f"  已清理旧进程: {name} (PID={pid})")
            except Exception:
                pass
    except Exception:
        pass
    os.remove(PID_FILE)


def _save_pid(name: str, pid: int):
    """记录进程 PID（下次启动时清理）"""
    data = {}
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, 'r') as f:
                data = json.loads(f.read())
        except Exception:
            pass
    data[name] = pid
    os.makedirs(os.path.dirname(PID_FILE), exist_ok=True)
    with open(PID_FILE, 'w') as f:
        f.write(json.dumps(data))

def force_kill_ports():
    """强制清理所有项目相关端口（通过 netstat + taskkill 彻底杀进程树）"""
    ports = [7080, 7090, 7100, 7178]  # 生产模式：Python后端、Java后端、Python AI、前端
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
                        logger.info(f"  已强制清理端口 {port} (PID={pid})")
    except Exception as e:
        logger.warning(f"端口清理异常: {e}")


def cleanup_temp_files():
    """清理临时文件"""
    logger.info("正在清理临时文件...")
    try:
        # 清理临时目录
        temp_dir = os.path.join(PROJECT_ROOT, 'temp')
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
            logger.info(f"已清理临时目录: {temp_dir}")
        
        # 清理日志临时文件
        log_temp_dir = os.path.join(env_roots.get('production', PROJECT_ROOT), 'logs', 'temp')
        if os.path.exists(log_temp_dir):
            import shutil
            shutil.rmtree(log_temp_dir)
            logger.info(f"已清理日志临时目录: {log_temp_dir}")
            
    except Exception as e:
        logger.error(f"清理临时文件失败: {e}")
        logger.error(f"错误详情:\n{traceback.format_exc()}")


def cleanup_resources():
    """清理所有资源"""
    global system_shutting_down
    
    # 设置系统关闭标志
    system_shutting_down = True
    logger.info("正在清理所有资源...")
    
    try:
        # 停止前端监控线程
        stop_frontend_monitor()

        # 清理进程
        cleanup_processes()

        # 强制清理所有项目端口
        force_kill_ports()

        # 清理 PID 文件
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)

        # 关闭线程池
        shutdown_thread_pool()

        # 清理临时文件
        cleanup_temp_files()
        
        logger.info("所有资源清理完成")
        return True
    except Exception as e:
        logger.error(f"资源清理失败: {e}")
        logger.error(f"错误详情:\n{traceback.format_exc()}")
        return False


def cleanup_processes():
    """清理所有管理的进程"""
    global managed_processes
    logger.info("正在清理管理的进程...")
    
    # 清理旧的进程列表中的进程
    processes_to_clean = list(managed_processes)
    for process in processes_to_clean:
        try:
            returncode = process.poll()
            if returncode is not None:
                logger.info(f"进程 {process.pid} 已退出，退出码: {returncode}")
                continue
            
            logger.info(f"终止进程 PID: {process.pid}")
            process.terminate()
            
            try:
                returncode = process.wait(timeout=5)
                logger.info(f"进程 {process.pid} 已正常终止，退出码: {returncode}")
            except subprocess.TimeoutExpired:
                logger.warning(f"进程 {process.pid} 未在5秒内终止，强制结束")
                process.kill()
                try:
                    returncode = process.wait(timeout=2)
                    logger.info(f"进程 {process.pid} 已被强制终止，退出码: {returncode}")
                except subprocess.TimeoutExpired:
                    logger.error(f"进程 {process.pid} 无法被强制终止")
        except Exception as e:
            logger.error(f"清理进程 {process.pid} 失败: {e}")
    
    # 清空旧的进程列表
    managed_processes.clear()
    
    # 使用新的进程管理器清理所有进程
    process_manager.terminate_all()
    
    logger.info("进程清理完成")


def handle_signal(signum, frame):
    """信号处理函数，用于优雅退出"""
    global should_exit
    logger.info(f"接收到信号 {signum}，准备优雅退出...")
    should_exit = True
    
    # 设置退出超时
    exit_timeout = 10
    start_time = time.time()
    
    try:
        # 清理所有资源
        cleanup_resources()
        
        # 检查清理耗时
        cleanup_time = time.time() - start_time
        if cleanup_time > exit_timeout:
            logger.warning(f"清理耗时 {cleanup_time:.2f} 秒，超过超时时间 {exit_timeout} 秒")
        
        logger.info("资源清理完成，退出程序")
        sys.exit(0)
    except Exception as e:
        logger.error(f"优雅退出失败: {e}")
        logger.error(f"错误详情:\n{traceback.format_exc()}")
        sys.exit(1)

def register_process(process: subprocess.Popen):
    """注册进程到管理列表"""
    global managed_processes
    managed_processes.append(process)
    logger.info(f"注册进程 PID: {process.pid}")

@handle_exception
def check_python_version():
    """检查Python版本是否符合要求"""
    required_version = (3, 12)
    current_version = sys.version_info
    
    if current_version < required_version:
        error_msg = f"Python版本需要 {required_version[0]}.{required_version[1]} 或更高，当前版本是 {current_version[0]}.{current_version[1]}.{current_version[2]}"
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

@handle_exception
def check_nodejs():
    """检查Node.js是否存在"""
    node_path = os.path.join('E:/tool/node-v24.15.0', 'node.exe')
    npm_cmd_path = os.path.join('E:/tool/node-v24.15.0', 'npm.cmd')

    if not os.path.exists(node_path):
        error_msg = f"Node.js未找到: {node_path}"
        show_user_friendly_error(
            FileNotFoundError(error_msg),
            "Node.js未安装",
            [
                "访问 https://nodejs.org/ 下载并安装Node.js",
                f"推荐安装到: {os.path.dirname(node_path)}",
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
        return True
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
        return False

@handle_exception
def monitor_frontend_process():
    """监控前端进程状态"""
    global frontend_monitor_running
    frontend_monitor_running = True
    logger.info("✅ 前端进程监控线程已启动")
    
    while frontend_monitor_running and not should_exit:
        try:
            # 检查前端进程状态
            try:
                if process_manager.is_alive("frontend"):
                    # 前端进程正常运行，记录运行时间
                    runtime = process_manager.get_runtime("frontend")
                    if runtime > 0 and int(runtime) % 60 == 0:  # 每分钟记录一次
                        logger.info(f"前端进程运行正常，已运行 {int(runtime)} 秒")
                else:
                    # 检查系统是否正在关闭
                    if system_shutting_down:
                        logger.info("系统正在关闭，跳过前端进程重启")
                        break
                    
                    # 前端进程已退出，获取详细信息
                    try:
                        process_info = process_manager.get_process_info("frontend")
                        if process_info:
                            exit_code = process_info.get('exit_code', 'unknown')
                            runtime = process_info.get('runtime', 0)
                            
                            # 详细的停止提醒
                            logger.warning(f"⚠️ 前端进程已停止")
                            logger.warning(f"   - 退出码: {exit_code}")
                            logger.warning(f"   - 运行时间: {int(runtime)} 秒")
                            logger.warning(f"   - 命令: {' '.join(process_info.get('command', [])) if process_info.get('command') else 'unknown'}")
                            logger.warning(f"   - 工作目录: {process_info.get('cwd', 'unknown')}")
                            logger.warning("   - 准备重启前端进程...")
                        else:
                            logger.warning("⚠️ 前端进程已退出，准备重启...")
                    except Exception as e:
                        logger.error(f"获取前端进程信息失败: {str(e)}")
                        logger.warning("⚠️ 前端进程已退出，准备重启...")
                    
                    # 重启前端进程
                    try:
                        restart_result = process_manager.restart("frontend")
                        if restart_result:
                            logger.info("✅ 前端进程已成功重启")
                            logger.info(f"   - 新进程PID: {restart_result.pid}")
                        else:
                            logger.error("❌ 前端进程重启失败")
                            logger.error("   - 请检查前端代码和依赖是否正确")
                            logger.error("   - 监控线程将继续运行，等待下一次检查")
                    except Exception as e:
                        logger.error(f"重启前端进程失败: {str(e)}")
                        logger.error("   - 监控线程将继续运行，等待下一次检查")
            except Exception as e:
                logger.error(f"检查前端进程状态失败: {str(e)}")
            
            # 每5秒检查一次
            time.sleep(5)
            
        except Exception as e:
            logger.error(f"前端进程监控线程异常: {str(e)}")
            logger.error(f"错误详情: {traceback.format_exc()}")
            # 避免监控线程崩溃
            time.sleep(5)
    
    logger.info("前端进程监控线程已停止")
    frontend_monitor_running = False

@handle_exception
def start_frontend_monitor():
    """启动前端进程监控线程"""
    global frontend_monitor_thread
    
    if frontend_monitor_thread is None or not frontend_monitor_thread.is_alive():
        frontend_monitor_thread = threading.Thread(
            target=monitor_frontend_process,
            daemon=True
        )
        frontend_monitor_thread.start()
        logger.info("✅ 前端进程监控线程已启动")
        return True
    else:
        logger.warning("前端进程监控线程已在运行")
        return False

@handle_exception
def stop_frontend_monitor():
    """停止前端进程监控线程"""
    global frontend_monitor_running, frontend_monitor_thread
    
    frontend_monitor_running = False
    
    if frontend_monitor_thread and frontend_monitor_thread.is_alive():
        frontend_monitor_thread.join(timeout=5)
        logger.info("✅ 前端进程监控线程已停止")
    
    return True





def start_frontend_dev_server(args):
    """启动前端服务器（适配简化架构）"""
    # 使用统一的前端目录（简化架构）
    frontend_dir = FRONTEND_ROOT
    node_path = os.path.join('E:/tool/node-v24.15.0', 'node.exe')
    npm_cmd_path = os.path.join('E:/tool/node-v24.15.0', 'npm.cmd')
    
    if not os.path.exists(frontend_dir):
        logger.warning(f"前端目录不存在: {frontend_dir}")
        return False, None
    
    if not os.path.exists(node_path):
        logger.warning(f"Node.js未找到: {node_path}")
        return False, None
    
    # 固定端口 7178（启动前 _clean_previous_instance 已清掉旧实例）
    frontend_port = 7178
    
    try:
        logger.info(f"正在启动前端开发服务器 (模式: {args.env})...")
        
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        # 增加Node.js内存限制，解决内存不足导致的崩溃问题
        env['NODE_OPTIONS'] = '--max-old-space-size=4096'
        
        # 生产模式先执行构建
        if args.env == 'production':
            logger.info("正在构建前端项目...")
            
            # 构建命令
            build_command = f"{npm_cmd_path} run build"
            logger.info(f"执行构建命令: {build_command}")
            logger.info(f"构建工作目录: {frontend_dir}")
            
            # 执行构建
            try:
                logger.info("开始执行前端构建...")
                # 使用 PowerShell 执行构建命令
                result = subprocess.run(
                    ["powershell.exe", "-Command", build_command],
                    cwd=frontend_dir,
                    timeout=300  # 5分钟超时
                )
                
                # 检查构建结果
                logger.info(f"构建返回码: {result.returncode}")
                if result.returncode != 0:
                    logger.error("❌ 前端构建失败")
                    return False, None
                else:
                    logger.info("✅ 前端构建成功")
            except subprocess.TimeoutExpired:
                logger.error("❌ 前端构建超时")
                return False, None
            except Exception as e:
                logger.error(f"❌ 前端构建过程中出现错误: {str(e)}")
                traceback.print_exc()
                return False, None
            
            # 构建完成后检查构建产物
            # 从构建输出可以看到，产物输出到 ../static/vue-dist
            static_dir = os.path.join(PROJECT_ROOT, 'static', 'vue-dist')
            index_html = os.path.join(static_dir, 'index.html')
            
            if not os.path.exists(index_html):
                logger.error("❌ 前端构建产物不存在")
                logger.error(f"构建产物路径: {index_html}")
                return False, None
            else:
                logger.info("✅ 前端构建产物已生成，准备启动服务")
                logger.info(f"构建产物路径: {static_dir}")
        
        # 构建启动命令：生产模式使用Nginx（替代Vite preview，更稳定）
        # 检查Nginx是否可用 (Nginx不支持中文路径，必须使用纯英文路径)
        nginx_path = None
        nginx_paths = [
            'E:/tool/nginx-1.26.3/nginx.exe',  # 纯英文路径，优先
            'E:/nginx/nginx.exe',
            'C:/nginx/nginx.exe',
            'nginx'
        ]
        for path in nginx_paths:
            try:
                subprocess.run([path, '-v'], capture_output=True, check=True)
                nginx_path = path
                break
            except:
                continue
        
        if nginx_path:
            # 动态生成 Nginx 配置（端口可能自动回退）
            nginx_prefix = "E:/tool/nginx-1.26.3"
            nginx_conf = os.path.join(nginx_prefix, 'conf', 'sjzm_runtime.conf')
            nginx_conf_content = f"""events {{ worker_connections 1024; }}
http {{
    include       {nginx_prefix}/conf/mime.types;
    default_type  application/octet-stream;
    sendfile on; keepalive_timeout 65;
    gzip on; gzip_types text/plain text/css application/json application/javascript text/xml;
    server {{
        listen {frontend_port};
        server_name localhost;
        root {STATIC_DIST};
        index index.html;
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|ttf|svg)$ {{
            expires 1y; add_header Cache-Control \"public, immutable\";
        }}
        # 业务 API → Java 后端
        location /api/ {{
            proxy_pass http://127.0.0.1:{JAVA_PORT};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }}
        location /dashboards/ {{
            alias {os.path.join(PROJECT_ROOT, '产品数据', '实时看').replace(chr(92), '/')}/;
        }}
        location / {{
            try_files $uri $uri/ /index.html;
        }}
    }}
}}
"""
            with open(nginx_conf, 'w', encoding='utf-8') as f:
                f.write(nginx_conf_content)
            command_args = [nginx_path, '-c', nginx_conf, '-p', nginx_prefix]
            logger.info(f"使用Nginx服务器，端口: {frontend_port}")
            cwd = nginx_prefix
        else:
            # 回退到Vite preview
            logger.warning("Nginx未找到，使用Vite preview作为回退")
            command_args = [
                node_path,
                'node_modules/vite/bin/vite.js',
                'preview',
                '--mode', 'production',
                '--host', '0.0.0.0',
                '--port', str(frontend_port),
                '--strictPort'
            ]
            cwd = frontend_dir
        
        process = subprocess.Popen(
            command_args,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # 使用进程管理器注册前端进程，记录命令、工作目录和环境变量
        process_manager.register(
            "frontend", 
            process, 
            command=command_args, 
            cwd=frontend_dir, 
            env=env
        )
        
        # 同时注册到旧的进程列表，确保兼容性
        register_process(process)
        
        # 等待3秒，同时捕获输出
        time.sleep(3)
        
        if process.poll() is None:
            _save_pid('nginx', process.pid)
            logger.info(f"✅ 前端 Nginx 已启动 (PID: {process.pid})")
            logger.info(f"前端访问地址: http://localhost:{frontend_port}/")
            return True, frontend_port
        else:
            # 获取并显示错误输出
            stdout, stderr = process.communicate()
            logger.error(f"❌ 前端开发服务器启动失败，进程已退出")
            if stdout:
                logger.error(f"前端输出: {stdout}")
            if stderr:
                logger.error(f"前端错误: {stderr}")
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
            if 'qdrant' in result.stdout and not 'grep' in result.stdout:
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



def start_application_normal_multithreaded(args):
    """启动应用程序（多线程模式）"""
    logger.info(f"\n=== 图片数据库管理系统启动（{args.env}环境/多线程模式）===")
    logger.info("=" * 50)
    logger.info(f"线程池大小: {thread_pool_size}")
    
    # 执行前置检查
    if not check_python_version():
        return False
    
    if not check_virtual_environment():
        return False
    
    # 使用线程池执行多个任务
    tasks = []
    
    # 任务1: 检查依赖
    tasks.append(submit_task_to_thread_pool(check_dependencies))
    
    # 任务2: 检查Redis
    tasks.append(submit_task_to_thread_pool(check_redis))
    
    # 任务3: 检查Qdrant
    tasks.append(submit_task_to_thread_pool(check_qdrant))
    
    # 任务4: 启动前端服务
    tasks.append(submit_task_to_thread_pool(start_frontend_dev_server, args))
    
    # 等待所有前置任务完成
    logger.info("等待前置任务完成...")
    
    results = []
    for future in concurrent.futures.as_completed(tasks):
        try:
            result = future.result()
            results.append(result)
        except Exception as e:
            logger.error(f"任务执行失败: {e}")
            results.append(False)
    
    # 检查所有任务是否成功
    if not all(results):
        logger.error("❌ 前置任务执行失败")
        return False
    
    logger.info("✅ 所有前置任务已完成")
    
    # 启动前端进程监控线程
    start_frontend_monitor()
    
    # 更新前端环境变量，确保前端能够正确连接到后端服务
    try:
        frontend_dir = FRONTEND_ROOT
        env_file_path = os.path.join(frontend_dir, '.env.production')
        
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r', encoding='utf-8') as f:
                env_content = f.read()
            
            # 更新API基础URL
            local_ip = get_local_ip()
            if local_ip:
                new_api_base_url = f'http://{local_ip}:{args.port}'
            else:
                new_api_base_url = f'http://localhost:{args.port}'
            
            # 检查是否需要更新
            if 'VITE_API_BASE_URL=' in env_content:
                import re
                env_content = re.sub(
                    r'VITE_API_BASE_URL=.*',
                    f'VITE_API_BASE_URL={new_api_base_url}',
                    env_content
                )
            else:
                env_content += f'\nVITE_API_BASE_URL={new_api_base_url}'
            
            # 写入更新后的环境变量
            with open(env_file_path, 'w', encoding='utf-8') as f:
                f.write(env_content)
            logger.info(f"已更新前端环境变量，API基础URL: {new_api_base_url}")
        else:
            logger.warning(f"前端环境变量文件不存在: {env_file_path}")
    except Exception as e:
        logger.warning(f"更新前端配置时出现错误: {e}")
        logger.info("继续启动服务...")
    
    # 启动后端服务（主线程执行）
    return start_backend_server(args)

@handle_exception
def start_backend_server(args):
    """启动后端服务器"""
    # 检查后端端口
    if is_port_available(PYTHON_AI_PORT):
        backend_port = PYTHON_AI_PORT
    else:
        logger.warning(f"Python AI 端口 {PYTHON_AI_PORT} 已被占用，跳过")
        return False

    # 启动FastAPI
    try:
        # 使用统一的后端目录（简化架构）
        backend_dir = BACKEND_ROOT
        
        # 获取本机IP
        local_ip = get_local_ip()
        
        # 显示访问地址
        logger.info("=" * 60)
        logger.info("系统访问地址")
        logger.info("=" * 60)
        logger.info("前端页面:")
        logger.info(f"  - 本地访问: http://localhost:5175/")
        if local_ip:
            logger.info(f"  - 局域网访问: http://{local_ip}:5175/")
        logger.info("后端API:")
        logger.info(f"  - 本地访问: http://localhost:{backend_port}/")
        if local_ip:
            logger.info(f"  - 局域网访问: http://{local_ip}:{backend_port}/")
        logger.info(f"  - API文档: http://localhost:{backend_port}/docs")
        logger.info(f"  - 健康检查: http://localhost:{backend_port}/health")
        logger.info("=" * 60)
        
        # 简化架构：使用统一的后端目录
        logger.info(f"后端代码目录: {backend_dir}")
        logger.info(f"环境配置: {args.env}")
        
        # 构建uvicorn命令
        uvicorn_args = [
            VENV_PYTHON, '-m', 'uvicorn',
            'app.main:app',
            '--host', '0.0.0.0',
            '--port', str(backend_port),
            '--log-level', 'info'
        ]
        
        # 生产模式添加workers参数
        uvicorn_args.extend(['--workers', str(args.workers)])
        
        logger.info(f"使用虚拟环境Python: {VENV_PYTHON}")
        logger.info(f"启动命令: {' '.join(uvicorn_args)}")
        
        # 构建环境变量（确保传递正确的环境变量）
        env_vars = os.environ.copy()
        env_vars['ENVIRONMENT'] = args.env
        env_vars['PROJECT_ROOT'] = PROJECT_ROOT
        # 添加backend目录到PYTHONPATH，确保uvicorn能找到app模块
        if 'PYTHONPATH' in env_vars:
            env_vars['PYTHONPATH'] = f"{backend_dir}{os.pathsep}{env_vars['PYTHONPATH']}"
        else:
            env_vars['PYTHONPATH'] = backend_dir
        
        uvicorn_process = subprocess.Popen(
            uvicorn_args,
            cwd=backend_dir,  # 使用后端目录，确保app模块能被正确导入
            env=env_vars
        )
        
        register_process(uvicorn_process)
        _save_pid('backend', uvicorn_process.pid)

        # 等待进程结束
        try:
            uvicorn_process.wait()
        except KeyboardInterrupt:
            logger.info("服务已被用户中断")
            uvicorn_process.terminate()

        return True

    except Exception as e:
        logger.error(f"Python AI 后端启动失败: {str(e)}")
        cleanup_resources()
        traceback.print_exc()
        return False


def start_java_backend():
    """启动 Java 主业务后端"""
    logger.info("正在启动 Java 业务后端...")

    if not os.path.exists(JAVA_HOME):
        logger.error(f"JDK 未找到: {JAVA_HOME}")
        return False, None

    if not os.path.exists(JAVA_BACKEND_DIR):
        logger.error(f"Java 后端目录不存在: {JAVA_BACKEND_DIR}")
        return False, None

    java_exe = os.path.join(JAVA_HOME, 'bin', 'java.exe')
    mvn_exe = os.path.join(MAVEN_HOME, 'bin', 'mvn.cmd')

    if not os.path.exists(mvn_exe):
        logger.error(f"Maven 未找到: {mvn_exe}")
        return False, None

    # 检查并清理端口
    if not is_port_available(JAVA_PORT):
        logger.warning(f"Java 端口 {JAVA_PORT} 已被占用，正在清理...")
        for pid in _get_port_pids(JAVA_PORT):
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], capture_output=True, timeout=5)
        time.sleep(2)

    env = os.environ.copy()
    env['JAVA_HOME'] = JAVA_HOME
    env['PATH'] = os.path.dirname(java_exe) + os.pathsep + os.path.dirname(mvn_exe) + os.pathsep + env.get('PATH', '')

    process = subprocess.Popen(
        [mvn_exe, 'spring-boot:run', '-Dspring-boot.run.arguments=--server.port=' + str(JAVA_PORT)],
        cwd=JAVA_BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True, encoding='utf-8', errors='replace'
    )
    process_manager.register("java-backend", process)
    register_process(process)
    _save_pid('java-backend', process.pid)

    # 等待启动
    logger.info("等待 Java 后端启动...")
    for i in range(30):
        time.sleep(2)
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            logger.error(f"Java 后端启动失败(exit={process.returncode})")
            if stderr:
                logger.error(f"stderr: {stderr[-500:]}")
            return False, None
        try:
            import urllib.request
            r = urllib.request.urlopen(f'http://127.0.0.1:{JAVA_PORT}/actuator/health', timeout=2)
            if r.status == 200:
                logger.info(f"✅ Java 业务后端就绪 (PID={process.pid}, port={JAVA_PORT})")
                return True, process
        except Exception:
            if i % 5 == 4:
                logger.info(f"  等待中... ({i+1}/30)")

    logger.error("Java 后端启动超时")
    return False, None

def start_application_normal(args):
    """启动应用程序（普通模式）"""
    logger.info(f"\n=== 图片数据库管理系统启动（{args.env}环境/普通模式）===")
    logger.info("=" * 50)
    
    # 执行前置检查
    if not check_python_version():
        return False
    
    if not check_virtual_environment():
        return False
    
    if not check_dependencies():
        return False
    
    if not check_redis():
        return False
    
    # 跳过Qdrant检查，减少日志输出
    # check_qdrant()
    
    if not check_nodejs():
        return False
    
    logger.info(f"当前环境: {args.env}")
    logger.info("跳过前端dist构建，直接启动服务...")
    
    frontend_success, _ = start_frontend_dev_server(args)
    if not frontend_success:
        return False
    
    # 启动前端进程监控线程
    start_frontend_monitor()
    
    # 更新前端环境变量，确保前端能够正确连接到后端服务
    try:
        frontend_dir = FRONTEND_ROOT
        env_file_path = os.path.join(frontend_dir, '.env.production')
        
        if os.path.exists(env_file_path):
            with open(env_file_path, 'r', encoding='utf-8') as f:
                env_content = f.read()
            
            # 更新API基础URL
            local_ip = get_local_ip()
            if local_ip:
                new_api_base_url = f'http://{local_ip}:{args.port}'
            else:
                new_api_base_url = f'http://localhost:{args.port}'
            
            # 检查是否需要更新
            if 'VITE_API_BASE_URL=' in env_content:
                import re
                env_content = re.sub(
                    r'VITE_API_BASE_URL=.*',
                    f'VITE_API_BASE_URL={new_api_base_url}',
                    env_content
                )
            else:
                env_content += f'\nVITE_API_BASE_URL={new_api_base_url}'
            
            # 写入更新后的环境变量
            with open(env_file_path, 'w', encoding='utf-8') as f:
                f.write(env_content)
            logger.info(f"已更新前端环境变量，API基础URL: {new_api_base_url}")
        else:
            logger.warning(f"前端环境变量文件不存在: {env_file_path}")
    except Exception as e:
        logger.warning(f"更新前端配置时出现错误: {e}")
        logger.info("继续启动服务...")
    
    # 启动 Java 业务后端（主力）
    java_ok, java_proc = start_java_backend()
    if not java_ok:
        logger.error("Java 业务后端启动失败")

    # 启动 Python AI 后端（辅助）
    try:
        backend_dir = BACKEND_ROOT
        logger.info(f"Python AI 后端代码目录: {backend_dir}")
        logger.info(f"环境配置: {args.env}")
        
        # 构建uvicorn命令
        uvicorn_args = [
            VENV_PYTHON, '-m', 'uvicorn',
            'app.main:app',
            '--host', args.host,
            '--port', str(PYTHON_AI_PORT),
            '--log-level', args.log_level.lower()
        ]
        
        # 生产模式添加workers参数
        uvicorn_args.extend(['--workers', str(args.workers)])
        
        logger.info(f"使用虚拟环境Python: {VENV_PYTHON}")
        logger.info(f"启动命令: {' '.join(uvicorn_args)}")
        
        # 获取本机IP
        local_ip = get_local_ip()
        
        # 显示访问地址
        logger.info("=" * 60)
        logger.info("系统访问地址")
        logger.info("=" * 60)
        logger.info("前端页面:")
        frontend_port = 7178  # 生产 Nginx 端口
        logger.info(f"  前端: http://localhost:{frontend_port}/")
        if local_ip:
            logger.info(f"        http://{local_ip}:{frontend_port}/")
        logger.info(f"  Java: http://localhost:{JAVA_PORT} (业务主力)")
        if local_ip:
            logger.info(f"        http://{local_ip}:{JAVA_PORT}")
        logger.info(f"  Python: http://localhost:{PYTHON_AI_PORT} (AI服务)")
        logger.info(f"  Swagger: http://localhost:{JAVA_PORT}/swagger-ui.html")
        logger.info(f"  健康检查: http://localhost:{JAVA_PORT}/actuator/health")
        logger.info("=" * 60)
        
        # 启动uvicorn，使用项目根目录作为工作目录，确保配置加载正确
        # 重要：使用PROJECT_ROOT而不是backend_dir，确保config.py能正确计算项目根目录
        
        # 构建环境变量（确保传递正确的环境变量）
        env_vars = os.environ.copy()
        env_vars['ENVIRONMENT'] = args.env
        env_vars['PROJECT_ROOT'] = PROJECT_ROOT
        # 添加backend目录到PYTHONPATH，确保uvicorn能找到app模块
        if 'PYTHONPATH' in env_vars:
            env_vars['PYTHONPATH'] = f"{backend_dir}{os.pathsep}{env_vars['PYTHONPATH']}"
        else:
            env_vars['PYTHONPATH'] = backend_dir
        
        uvicorn_process = subprocess.Popen(
            uvicorn_args,
            cwd=PROJECT_ROOT,  # 使用项目根目录，确保配置加载正确
            env=env_vars
        )
        
        register_process(uvicorn_process)
        _save_pid('backend', uvicorn_process.pid)

        # 自动打开浏览器 - 已禁用
        # if not args.no_browser:
        #     try:
        #         webbrowser.open(f'http://localhost:{args.port}/')
        #         logger.info(f"✅ 应用页面已在浏览器中打开 (端口: {args.port})")
        #     except Exception as e:
        #         logger.warning(f"无法自动打开浏览器: {str(e)}")
        
        # 等待进程结束
        try:
            uvicorn_process.wait()
        except KeyboardInterrupt:
            logger.info("服务已被用户中断")
            uvicorn_process.terminate()
        
        return True
        
    except Exception as e:
        logger.error(f"应用启动失败: {str(e)}")
        cleanup_resources()
        traceback.print_exc()
        return False

def check_environment_status():
    """检查各环境状态（适配简化架构）"""
    logger.info("\n=== 环境状态监控（简化架构）===")
    
    # 检查统一的后端和前端目录
    logger.info(f"\n检查统一代码目录:")
    logger.info(f"✅ 后端代码目录: {BACKEND_ROOT}" if os.path.exists(BACKEND_ROOT) else f"❌ 后端代码目录不存在: {BACKEND_ROOT}")
    logger.info(f"✅ 前端代码目录: {FRONTEND_ROOT}" if os.path.exists(FRONTEND_ROOT) else f"❌ 前端代码目录不存在: {FRONTEND_ROOT}")
    logger.info(f"✅ 配置目录: {CONFIG_ROOT}" if os.path.exists(CONFIG_ROOT) else f"❌ 配置目录不存在: {CONFIG_ROOT}")
    
    for env in ['development', 'production']:
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


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='图片数据库管理系统启动脚本')
    parser.add_argument('--mode', choices=['prod'], default='prod',
                       help='启动模式: prod (生产模式专用)')
    parser.add_argument('--port', type=int, default=None,
                       help='服务器端口 (默认: 生产环境7100)')
    parser.add_argument('--host', default='0.0.0.0',
                       help='服务器主机 (默认: 0.0.0.0)')
    parser.add_argument('--workers', type=int, default=None,
                       help='工作进程数 (默认: 生产环境4)')
    parser.add_argument('--threads', type=int, default=DEFAULT_THREAD_POOL_SIZE,
                       help=f'线程池线程数 (默认: {DEFAULT_THREAD_POOL_SIZE}, 最大: {MAX_THREAD_POOL_SIZE})')
    parser.add_argument('--multithread', action='store_true',
                       help='启用多线程模式（使用线程池执行任务）')
    parser.add_argument('--no-browser', action='store_true',
                       help='不自动打开浏览器')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='日志级别')
    parser.add_argument('--env', choices=['production'], default=default_env,
                       help='运行环境: production (生产模式专用)')
    parser.add_argument('--sync', action='store_true',
                       help='启动前执行环境同步')
    parser.add_argument('--sync-from', choices=['development', 'production'],
                       help='同步源环境')
    parser.add_argument('--sync-to', choices=['development', 'production'],
                       help='同步目标环境')
    parser.add_argument('--sync-mode', choices=['full', 'incremental', 'config-only', 'data-only', 'schema-only'],
                       default='incremental', help='同步模式')
    parser.add_argument('--status', action='store_true',
                       help='显示环境状态监控信息')
    
    args = parser.parse_args()
    
    # 生产模式专用脚本，固定使用production环境
    args.env = 'production'
    
    # 在初始化日志系统之前检查虚拟环境路径
    if not check_venv_path():
        print("❌ 虚拟环境路径检查失败，请按照上述建议解决问题")
        sys.exit(1)
    
    # 初始化日志系统
    global logger
    setup_logging_system(args.env)
    logger = logging.getLogger(__name__)

    # 清理上次启动残留的旧进程（PID 文件追踪）
    _clean_previous_instance()
    
    # 加载生产环境变量（.env.production 覆盖 .env 中的开发配置）
    prod_env_file = os.path.join(PROJECT_ROOT, 'backend', '.env.production')
    if os.path.exists(prod_env_file):
        with open(prod_env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()
        logger.info(f"✅ 已加载生产环境变量: {prod_env_file}")

    # 设置环境变量（与生产环境保持一致）
    os.environ['ENVIRONMENT'] = args.env
    os.environ['PROJECT_ROOT'] = PROJECT_ROOT
    
    # 生产环境固定配置
    if args.port is None:
        args.port = 7100  # 生产环境固定端口
    if args.workers is None:
        args.workers = 4  # 生产环境固定进程数 (降低worker数量避免端口耗尽)
    
    # 显示生产环境根目录信息
    logger.info(f"当前环境: {args.env}")
    logger.info(f"生产环境根目录: {env_roots['production']}")
    logger.info(f"项目根目录: {PROJECT_ROOT}")
    
    # 记录找到的虚拟环境
    if os.path.exists(VENV_DIR):
        logger.info(f"找到虚拟环境: {VENV_DIR}")
    else:
        logger.warning(f"虚拟环境不存在: {VENV_DIR}")
    
    # 检查并切换到项目虚拟环境（必须在配置文件导入之前）
    if not check_virtual_environment():
        return False
    
    # 导入配置文件
    global HAS_CONFIG, settings
    try:
        # 使用根目录的后端代码，但加载生产环境的配置文件
        backend_dir = os.path.join(PROJECT_ROOT, 'backend')
        sys.path.insert(0, backend_dir)
        
        # 设置环境变量，让配置系统加载生产环境的配置文件
        env_config_dir = os.path.join(env_roots[args.env], 'config')
        os.environ['ENV_CONFIG_PATH'] = env_config_dir
        
        from app.config import settings
        HAS_CONFIG = True
        logger.info(f"配置文件加载成功 - 使用后端代码: {backend_dir}")
        logger.info(f"配置文件路径: {env_config_dir}")
        
        # 设置生产环境数据库路径
        if args.env == 'production':
            production_db_dir = os.path.join(env_roots['production'], 'database')
            if os.path.exists(production_db_dir):
                # 设置数据库相关环境变量
                os.environ['PRODUCTION_DB_PATH'] = production_db_dir
                logger.info(f"设置生产环境数据库路径: {production_db_dir}")
            else:
                logger.warning(f"生产环境数据库目录不存在: {production_db_dir}")
    except ImportError as e:
        logger.warning(f"无法导入配置文件: {e}，将使用默认值")
        HAS_CONFIG = False
    
    # 显示环境状态监控
    if args.status:
        check_environment_status()
        return True
    
    # 执行同步功能
    if args.sync:
        logger.info("\n=== 执行环境同步 ===")
        sync_from = args.sync_from or 'development'
        sync_to = args.sync_to or args.env
        
        try:
            # 调用同步脚本
            sync_script = os.path.join(PROJECT_ROOT, 'scripts', 'sync_main.py')
            if os.path.exists(sync_script):
                sync_cmd = [
                    VENV_PYTHON, sync_script,
                    '--from-env', sync_from,
                    '--to-env', sync_to,
                    '--mode', args.sync_mode,
                    '--verbose'
                ]
                logger.info(f"执行同步命令: {' '.join(sync_cmd)}")
                result = subprocess.run(sync_cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
                logger.info(f"同步输出: {result.stdout}")
                if result.stderr:
                    logger.warning(f"同步警告: {result.stderr}")
                if result.returncode == 0:
                    logger.info("✅ 环境同步完成")
                else:
                    logger.error(f"❌ 环境同步失败，退出码: {result.returncode}")
                    return False
            else:
                logger.warning(f"同步脚本未找到: {sync_script}")
        except Exception as e:
            logger.error(f"❌ 执行同步失败: {str(e)}")
    
    # 初始化线程池
    logger.info(f"\n=== 初始化线程池 ===")
    logger.info(f"线程数: {args.threads}")
    
    if not initialize_thread_pool(args.threads):
        logger.error("❌ 线程池初始化失败")
        return False
    
    # 注册信号处理函数
    import signal
    signal.signal(signal.SIGINT, handle_signal)   # Ctrl+C
    signal.signal(signal.SIGTERM, handle_signal)  # 终止信号
    signal.signal(signal.SIGBREAK, handle_signal) # Windows中断信号
    
    # 生产模式启动（单环境）
    if args.multithread:
        success = start_application_normal_multithreaded(args)
    else:
        success = start_application_normal(args)
    
    if not success:
        logger.error("\n❌ 启动失败，请检查以上错误信息")
        sys.exit(1)
    sys.exit(0)

if __name__ == '__main__':
    main()