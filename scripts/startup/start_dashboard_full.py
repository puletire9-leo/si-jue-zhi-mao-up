#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
产品数据看板完整启动脚本
同时启动前端Node.js服务器和后端FastAPI服务

这是看板服务的唯一入口，替代以下脚本：
- start_dashboard_server.py (仅前端，已弃用)

使用方法：
    python scripts/startup/start_dashboard_full.py

访问地址：
    - 周销量趋势: http://localhost:8080/product_sales_dashboard_v2.html
    - 双周期对比: http://localhost:8080/product_comparison_dashboard.html
    - 后端API: http://localhost:8002/api/products/health

注意：
    - 不要同时使用其他启动脚本启动看板服务
    - 端口8080和8002被此服务独占
    - 按 Ctrl+C 停止所有服务
"""
import os
import sys
import subprocess
import socket
import argparse
import logging
import time
import signal
from pathlib import Path

# ========== 路径配置 ==========
CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_FILE_DIR, "..", ".."))
NODE_PATH = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'node.exe')
DASHBOARD_DIR = os.path.join(PROJECT_ROOT, '产品数据', '实时看')
BACKEND_DIR = os.path.join(PROJECT_ROOT, 'backend')
VENV_PYTHON = os.path.join(PROJECT_ROOT, '.venv公司', 'Scripts', 'python.exe')

# 端口配置
FRONTEND_PORT = 8080
BACKEND_PORT = 8002

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 全局进程引用
processes = {
    'frontend': None,
    'backend': None
}


def check_port_available(port: int, host: str = '0.0.0.0') -> bool:
    """检查端口是否可用"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result != 0
    except Exception:
        return False


def find_available_port(start_port: int = 8000, max_port: int = 8100) -> int:
    """查找可用端口"""
    for port in range(start_port, max_port + 1):
        if check_port_available(port):
            return port
    raise RuntimeError(f"未找到可用端口 ({start_port}-{max_port})")


def check_nodejs() -> str:
    """检查 Node.js 是否存在"""
    if os.path.exists(NODE_PATH):
        return NODE_PATH
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            return 'node'
    except FileNotFoundError:
        pass
    raise FileNotFoundError(f"未找到 Node.js，请确保存在: {NODE_PATH}")


def check_venv_python() -> str:
    """检查虚拟环境 Python"""
    if os.path.exists(VENV_PYTHON):
        return VENV_PYTHON
    raise FileNotFoundError(f"未找到虚拟环境Python: {VENV_PYTHON}")


def create_frontend_server_script(port: int) -> str:
    """创建前端 Node.js 服务器脚本"""
    script_content = f'''
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = {port};
const HOST = '0.0.0.0';
const ROOT_DIR = '{DASHBOARD_DIR.replace("\\", "/")}';

const MIME_TYPES = {{
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
}};

const server = http.createServer((req, res) => {{
    let url = req.url === '/' ? '/product_sales_dashboard_v2.html' : req.url;
    
    try {{
        url = decodeURIComponent(url);
    }} catch (e) {{}}
    
    const safePath = path.normalize(url).replace(/^(\\.\\.\\/|\\/)/, '');
    let filePath = path.join(ROOT_DIR, safePath);
    
    const normalizedFilePath = filePath.replace(/\\\\/g, '/');
    const normalizedRootDir = ROOT_DIR.replace(/\\\\/g, '/');
    
    if (!normalizedFilePath.startsWith(normalizedRootDir)) {{
        res.writeHead(403, {{ 'Content-Type': 'text/plain' }});
        res.end('Forbidden');
        return;
    }}
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {{
        if (err) {{
            if (err.code === 'ENOENT') {{
                res.writeHead(404, {{ 'Content-Type': 'text/plain' }});
                res.end('File not found');
            }} else {{
                res.writeHead(500, {{ 'Content-Type': 'text/plain' }});
                res.end('Server error');
            }}
            return;
        }}
        
        res.writeHead(200, {{
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache'
        }});
        res.end(data);
    }});
}});

server.listen(PORT, HOST, () => {{
    console.log(`[前端] 服务器运行在 http://${{HOST}}:${{PORT}}/`);
}});

process.on('SIGINT', () => {{
    console.log('[前端] 正在关闭服务器...');
    server.close(() => {{
        process.exit(0);
    }});
}});
'''
    return script_content


def start_backend(port: int) -> subprocess.Popen:
    """启动后端FastAPI服务"""
    logger.info(f"🚀 启动后端服务 (端口 {port})...")
    
    python_path = check_venv_python()
    
    # 设置环境变量
    env = os.environ.copy()
    env['PORT'] = str(port)
    env['PYTHONPATH'] = str(PROJECT_ROOT)
    
    # 启动后端服务
    cmd = [
        python_path, '-m', 'uvicorn',
        'app.main:app',
        '--host', '0.0.0.0',
        '--port', str(port),
        '--reload'
    ]
    
    process = subprocess.Popen(
        cmd,
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    
    return process


def start_frontend(port: int) -> subprocess.Popen:
    """启动前端Node.js服务器"""
    logger.info(f"🚀 启动前端服务器 (端口 {port})...")
    
    node_path = check_nodejs()
    
    # 创建临时服务器脚本
    temp_script_path = os.path.join(DASHBOARD_DIR, '_temp_server.js')
    server_script = create_frontend_server_script(port)
    
    with open(temp_script_path, 'w', encoding='utf-8') as f:
        f.write(server_script)
    
    # 启动Node.js服务器
    process = subprocess.Popen(
        [node_path, temp_script_path],
        cwd=DASHBOARD_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    
    return process


def log_output(process: subprocess.Popen, prefix: str):
    """读取并打印进程输出"""
    try:
        for line in process.stdout:
            print(f"[{prefix}] {line.rstrip()}")
    except Exception:
        pass


def cleanup(signum=None, frame=None):
    """清理所有进程"""
    logger.info("\n🧹 正在停止所有服务...")
    
    # 停止前端
    if processes['frontend']:
        logger.info("停止前端服务器...")
        processes['frontend'].terminate()
        try:
            processes['frontend'].wait(timeout=3)
        except:
            processes['frontend'].kill()
    
    # 停止后端
    if processes['backend']:
        logger.info("停止后端服务器...")
        processes['backend'].terminate()
        try:
            processes['backend'].wait(timeout=3)
        except:
            processes['backend'].kill()
    
    # 清理临时文件
    temp_script = os.path.join(DASHBOARD_DIR, '_temp_server.js')
    if os.path.exists(temp_script):
        os.remove(temp_script)
    
    logger.info("✅ 所有服务已停止")
    sys.exit(0)


def wait_for_service(port: int, timeout: int = 30) -> bool:
    """等待服务启动"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if not check_port_available(port, '127.0.0.1'):
            return True
        time.sleep(0.5)
    return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='启动产品数据看板完整服务')
    parser.add_argument('--frontend-port', type=int, default=FRONTEND_PORT, help=f'前端端口 (默认: {FRONTEND_PORT})')
    parser.add_argument('--backend-port', type=int, default=BACKEND_PORT, help=f'后端端口 (默认: {BACKEND_PORT})')
    parser.add_argument('--auto-port', action='store_true', help='自动查找可用端口')
    args = parser.parse_args()
    
    frontend_port = args.frontend_port
    backend_port = args.backend_port
    
    # 检查/查找端口
    if args.auto_port:
        if not check_port_available(frontend_port):
            frontend_port = find_available_port(frontend_port)
            logger.info(f"🔄 前端使用端口: {frontend_port}")
        if not check_port_available(backend_port):
            backend_port = find_available_port(backend_port)
            logger.info(f"🔄 后端使用端口: {backend_port}")
    else:
        if not check_port_available(frontend_port):
            logger.error(f"❌ 前端端口 {frontend_port} 已被占用")
            sys.exit(1)
        if not check_port_available(backend_port):
            logger.error(f"❌ 后端端口 {backend_port} 已被占用")
            sys.exit(1)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    try:
        # 启动后端
        processes['backend'] = start_backend(backend_port)
        
        # 等待后端启动
        logger.info("⏳ 等待后端服务启动...")
        if not wait_for_service(backend_port, timeout=30):
            logger.error("❌ 后端服务启动超时")
            cleanup()
            return
        logger.info("✅ 后端服务已启动")
        
        # 启动前端
        processes['frontend'] = start_frontend(frontend_port)
        
        # 等待前端启动
        logger.info("⏳ 等待前端服务启动...")
        time.sleep(1)  # 给Node.js一点时间启动
        
        # 打印访问信息
        logger.info("=" * 70)
        logger.info("🎉 产品数据看板启动成功！")
        logger.info("=" * 70)
        logger.info(f"📊 前端页面: http://localhost:{frontend_port}/product_sales_dashboard_v2.html")
        logger.info(f"📊 前端页面: http://localhost:{frontend_port}/product_comparison_dashboard.html")
        logger.info(f"🔌 后端API: http://localhost:{backend_port}/api/products/health")
        logger.info(f"🌐 局域网访问: http://192.168.10.31:{frontend_port}/")
        logger.info("=" * 70)
        logger.info("⚠️  按 Ctrl+C 停止所有服务")
        logger.info("=" * 70)
        
        # 启动输出监控线程
        import threading
        backend_thread = threading.Thread(target=log_output, args=(processes['backend'], '后端'), daemon=True)
        frontend_thread = threading.Thread(target=log_output, args=(processes['frontend'], '前端'), daemon=True)
        backend_thread.start()
        frontend_thread.start()
        
        # 等待进程结束
        while True:
            backend_status = processes['backend'].poll()
            frontend_status = processes['frontend'].poll()
            
            if backend_status is not None:
                logger.error(f"❌ 后端服务异常退出 (code: {backend_status})")
                break
            
            if frontend_status is not None:
                logger.error(f"❌ 前端服务异常退出 (code: {frontend_status})")
                break
            
            time.sleep(1)
        
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logger.error(f"❌ 错误: {e}")
    finally:
        cleanup()


if __name__ == '__main__':
    main()
