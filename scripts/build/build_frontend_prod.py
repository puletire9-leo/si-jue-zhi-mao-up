#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生产环境前端构建脚本
将前端构建产物部署到生产环境目录
"""
import os
import sys
import subprocess
import shutil
import logging
from datetime import datetime

# 获取当前脚本目录
CURRENT_FILE_DIR = os.path.dirname(os.path.abspath(__file__))
# 计算项目根目录（当前脚本目录向上两级）
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_FILE_DIR, "..", ".."))

# 定义路径
FRONTEND_ROOT = os.path.join(PROJECT_ROOT, 'frontend')
PRODUCTION_ROOT = os.path.join(PROJECT_ROOT, 'production')
PRODUCTION_FRONTEND_DIR = os.path.join(PRODUCTION_ROOT, 'frontend')

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(PROJECT_ROOT, 'build_frontend.log'), encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

def check_nodejs():
    """检查Node.js是否可用"""
    try:
        node_path = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'node.exe')
        
        if not os.path.exists(node_path):
            logger.error(f"Node.js未找到: {node_path}")
            return False
        
        # 检查Node.js版本
        result = subprocess.run(
            [node_path, '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            version = result.stdout.strip()
            logger.info(f"✅ Node.js版本: {version}")
            return True
        else:
            logger.error(f"Node.js检查失败: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Node.js检查异常: {e}")
        return False

def install_dependencies():
    """安装前端依赖"""
    try:
        logger.info("正在安装前端依赖...")
        
        node_path = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'node.exe')
        npm_path = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'npm.cmd')
        
        # 设置环境变量
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        
        # 安装基础依赖（处理编码问题）
        result = subprocess.run(
            [npm_path, 'install'],
            cwd=FRONTEND_ROOT,
            env=env,
            capture_output=True,
            timeout=300,  # 5分钟超时
            encoding='utf-8',
            errors='ignore'
        )
        
        if result.returncode != 0:
            logger.error(f"❌ 基础依赖安装失败: {result.stderr}")
            return False
        
        # 安装缺失的依赖（echarts和terser）
        logger.info("正在安装缺失的依赖...")
        
        # 安装echarts
        echarts_result = subprocess.run(
            [npm_path, 'install', 'echarts'],
            cwd=FRONTEND_ROOT,
            env=env,
            capture_output=True,
            timeout=300,  # 5分钟超时
            encoding='utf-8',
            errors='ignore'
        )
        
        if echarts_result.returncode != 0:
            logger.error(f"❌ echarts依赖安装失败: {echarts_result.stderr}")
            return False
        
        # 安装terser
        terser_result = subprocess.run(
            [npm_path, 'install', '--save-dev', 'terser'],
            cwd=FRONTEND_ROOT,
            env=env,
            capture_output=True,
            timeout=300,  # 5分钟超时
            encoding='utf-8',
            errors='ignore'
        )
        
        if terser_result.returncode == 0:
            logger.info("✅ 前端依赖安装成功（包括echarts和terser）")
            return True
        else:
            logger.error(f"❌ terser依赖安装失败: {terser_result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ 前端依赖安装异常: {e}")
        return False

def build_frontend():
    """构建前端生产版本"""
    try:
        logger.info("正在构建前端生产版本...")
        
        node_path = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'node.exe')
        npm_path = os.path.join(PROJECT_ROOT, 'scripts', 'tools', 'tool', 'node', 'npm.cmd')
        
        # 设置环境变量
        env = os.environ.copy()
        env['PATH'] = os.path.dirname(node_path) + os.pathsep + env.get('PATH', '')
        
        # 构建生产版本（处理编码问题）
        result = subprocess.run(
            [npm_path, 'run', 'build:production'],
            cwd=FRONTEND_ROOT,
            env=env,
            capture_output=True,
            timeout=600,  # 10分钟超时
            encoding='utf-8',
            errors='ignore'
        )
        
        if result.returncode == 0:
            logger.info("✅ 前端生产版本构建成功")
            if result.stdout:
                logger.info(f"构建输出: {result.stdout}")
            return True
        else:
            logger.error(f"❌ 前端生产版本构建失败: {result.stderr}")
            if result.stdout:
                logger.error(f"构建输出: {result.stdout}")
            return False
            
    except Exception as e:
        logger.error(f"❌ 前端构建异常: {e}")
        return False

def deploy_to_production():
    """将构建产物部署到生产环境"""
    try:
        logger.info("正在部署前端构建产物到生产环境...")
        
        # 构建产物源目录（根据vite.config.js配置）
        build_output_dir = os.path.join(PROJECT_ROOT, 'static', 'vue-dist')
        
        if not os.path.exists(build_output_dir):
            logger.error(f"❌ 构建产物目录不存在: {build_output_dir}")
            return False
        
        # 确保生产环境前端目录存在
        os.makedirs(PRODUCTION_FRONTEND_DIR, exist_ok=True)
        
        # 清空目标目录
        if os.path.exists(PRODUCTION_FRONTEND_DIR):
            for item in os.listdir(PRODUCTION_FRONTEND_DIR):
                item_path = os.path.join(PRODUCTION_FRONTEND_DIR, item)
                if os.path.isfile(item_path):
                    os.remove(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
        
        # 复制构建产物到生产环境
        for item in os.listdir(build_output_dir):
            src_path = os.path.join(build_output_dir, item)
            dst_path = os.path.join(PRODUCTION_FRONTEND_DIR, item)
            
            if os.path.isfile(src_path):
                shutil.copy2(src_path, dst_path)
            elif os.path.isdir(src_path):
                shutil.copytree(src_path, dst_path)
        
        logger.info("✅ 前端构建产物部署成功")
        
        # 显示部署信息
        logger.info(f"构建产物源目录: {build_output_dir}")
        logger.info(f"部署目标目录: {PRODUCTION_FRONTEND_DIR}")
        
        # 统计文件数量
        file_count = 0
        for root, dirs, files in os.walk(PRODUCTION_FRONTEND_DIR):
            file_count += len(files)
        
        logger.info(f"部署文件数量: {file_count}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 部署失败: {e}")
        return False

def main():
    """主函数"""
    logger.info("=== 生产环境前端构建开始 ===")
    logger.info(f"项目根目录: {PROJECT_ROOT}")
    logger.info(f"前端目录: {FRONTEND_ROOT}")
    logger.info(f"生产环境目录: {PRODUCTION_ROOT}")
    logger.info(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 50)
    
    # 检查前置条件
    if not check_nodejs():
        logger.error("❌ Node.js检查失败，构建终止")
        return False
    
    # 安装依赖
    if not install_dependencies():
        logger.error("❌ 依赖安装失败，构建终止")
        return False
    
    # 构建前端
    if not build_frontend():
        logger.error("❌ 前端构建失败，构建终止")
        return False
    
    # 部署到生产环境
    if not deploy_to_production():
        logger.error("❌ 部署失败")
        return False
    
    logger.info("=" * 50)
    logger.info("✅ 生产环境前端构建完成！")
    logger.info(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"前端访问地址: http://localhost:8000/")
    logger.info("=" * 50)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)