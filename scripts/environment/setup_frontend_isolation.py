"""
前端环境隔离设置脚本
为前端代码创建环境隔离机制
"""

import os
import shutil
from pathlib import Path

def create_environment_specific_configs():
    """创建环境特定的前端配置文件"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    
    # 检查环境配置文件
    dev_env_file = frontend_dir / '.env.development'
    prod_env_file = frontend_dir / '.env.production'
    
    # 开发环境配置
    dev_config = """# 开发环境配置
VITE_API_BASE_URL=http://localhost:8001
VITE_ENVIRONMENT=development
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
"""
    
    # 生产环境配置
    prod_config = """# 生产环境配置
VITE_API_BASE_URL=http://localhost:8000
VITE_ENVIRONMENT=production
VITE_DEBUG=false
VITE_LOG_LEVEL=warn
"""
    
    # 写入配置文件
    with open(dev_env_file, 'w', encoding='utf-8') as f:
        f.write(dev_config)
    
    with open(prod_env_file, 'w', encoding='utf-8') as f:
        f.write(prod_config)
    
    print("✅ 前端环境配置文件已创建")

def update_package_json():
    """更新package.json添加环境特定的脚本"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    package_file = frontend_dir / 'package.json'
    
    if package_file.exists():
        import json
        
        with open(package_file, 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        # 添加环境特定的脚本
        if 'scripts' not in package_data:
            package_data['scripts'] = {}
        
        package_data['scripts'].update({
            "dev:development": "vite --mode development",
            "dev:production": "vite --mode production",
            "build:development": "vite build --mode development",
            "build:production": "vite build --mode production",
            "preview:development": "vite preview --mode development",
            "preview:production": "vite preview --mode production"
        })
        
        with open(package_file, 'w', encoding='utf-8') as f:
            json.dump(package_data, f, indent=2, ensure_ascii=False)
        
        print("✅ package.json已更新")

def create_build_directories():
    """创建环境特定的构建输出目录"""
    
    static_dir = Path(__file__).parent.parent.parent / 'static'
    
    # 创建开发环境构建目录
    dev_dist_dir = static_dir / 'vue-dist-dev'
    dev_dist_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建生产环境构建目录
    prod_dist_dir = static_dir / 'vue-dist'
    prod_dist_dir.mkdir(parents=True, exist_ok=True)
    
    print("✅ 环境特定的构建目录已创建")

def update_vite_config():
    """更新Vite配置支持环境隔离"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    vite_config_file = frontend_dir / 'vite.config.js'
    
    if vite_config_file.exists():
        with open(vite_config_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 更新构建输出目录逻辑
        new_build_config = """    build: {
      outDir: mode === 'development' ? '../static/vue-dist-dev' : '../static/vue-dist',
      emptyOutDir: true,
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      },"""
        
        # 替换构建配置
        import re
        content = re.sub(r'build:\s*\{[^}]+\}', new_build_config, content, flags=re.DOTALL)
        
        with open(vite_config_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✅ Vite配置已更新")

def create_environment_validation():
    """创建环境验证工具"""
    
    frontend_dir = Path(__file__).parent.parent.parent / 'frontend'
    src_dir = frontend_dir / 'src'
    
    # 创建环境工具文件
    env_utils_file = src_dir / 'utils' / 'environment.js'
    env_utils_file.parent.mkdir(parents=True, exist_ok=True)
    
    env_utils_content = """// 环境工具函数

/**
 * 获取当前环境
 */
export function getEnvironment() {
  return import.meta.env.VITE_ENVIRONMENT || 'development'
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment() {
  return getEnvironment() === 'development'
}

/**
 * 检查是否为生产环境
 */
export function isProduction() {
  return getEnvironment() === 'production'
}

/**
 * 获取API基础URL
 */
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

/**
 * 环境特定的日志函数
 */
export function log(message, level = 'info') {
  if (isDevelopment() || level === 'error') {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${getEnvironment().toUpperCase()}] ${message}`)
  }
}

/**
 * 开发环境专用函数（生产环境不会执行）
 */
export function devOnly(callback) {
  if (isDevelopment()) {
    callback()
  }
}
"""
    
    with open(env_utils_file, 'w', encoding='utf-8') as f:
        f.write(env_utils_content)
    
    print("✅ 环境工具函数已创建")

def main():
    """主函数"""
    
    print("🚀 开始设置前端环境隔离...")
    print("=" * 60)
    
    # 1. 创建环境配置文件
    create_environment_specific_configs()
    
    # 2. 更新package.json
    update_package_json()
    
    # 3. 创建构建目录
    create_build_directories()
    
    # 4. 更新Vite配置
    update_vite_config()
    
    # 5. 创建环境验证工具
    create_environment_validation()
    
    print("=" * 60)
    print("🎉 前端环境隔离设置完成！")
    print("\n📋 使用说明:")
    print("   开发环境启动: npm run dev:development")
    print("   生产环境启动: npm run dev:production")
    print("   开发环境构建: npm run build:development")
    print("   生产环境构建: npm run build:production")
    print("\n🔧 环境隔离特性:")
    print("   ✅ 不同的API地址（开发:8001，生产:8000）")
    print("   ✅ 独立的构建输出目录")
    print("   ✅ 环境特定的调试和日志级别")
    print("   ✅ 开发环境专用函数")

if __name__ == "__main__":
    main()