#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI模型下载脚本
用于预下载AI模型到本地缓存目录，支持离线部署
"""

import os
import sys
import time
import traceback
from transformers import ViTImageProcessor, ViTModel

# 导入配置
from config import MODEL_NAME, BASE_DIR

# 模型缓存目录配置
MODEL_CACHE_DIR = os.path.join(BASE_DIR, 'models', 'cache')

def download_model():
    """
    下载AI模型到本地缓存目录
    """
    print("=== AI模型下载工具 ===")
    print(f"模型名称: {MODEL_NAME}")
    print(f"缓存目录: {MODEL_CACHE_DIR}")
    print("开始下载模型...")
    
    # 创建缓存目录
    os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
    
    start_time = time.time()
    
    try:
        # 下载并保存图像处理器
        print("\n1. 下载图像处理器 (ViTImageProcessor)...")
        processor = ViTImageProcessor.from_pretrained(
            MODEL_NAME,
            cache_dir=MODEL_CACHE_DIR
        )
        print("   [YES] 图像处理器下载成功")
        
        # 下载并保存模型
        print("\n2. 下载AI模型 (ViTModel)...")
        model = ViTModel.from_pretrained(
            MODEL_NAME,
            cache_dir=MODEL_CACHE_DIR
        )
        print("   [YES] AI模型下载成功")
        
        end_time = time.time()
        duration = round(end_time - start_time, 2)
        
        print(f"\n=== 模型下载完成 ===")
        print(f"总耗时: {duration} 秒")
        print(f"模型已保存到: {MODEL_CACHE_DIR}")
        print("\n使用说明:")
        print("1. 确保环境变量 TRANSFORMERS_CACHE 指向此目录")
        print("2. 运行应用时将自动使用本地缓存的模型")
        print("3. 无需联网即可加载模型")
        
        return True
        
    except Exception as e:
        print(f"\n[ERROR] 模型下载失败: {e}")
        traceback.print_exc()
        return False

def verify_model():
    """
    验证本地缓存的模型是否可用
    """
    print("\n=== 验证本地模型可用性 ===")
    
    try:
        # 尝试使用本地缓存加载模型
        processor = ViTImageProcessor.from_pretrained(
            MODEL_NAME,
            cache_dir=MODEL_CACHE_DIR,
            local_files_only=True
        )
        
        model = ViTModel.from_pretrained(
            MODEL_NAME,
            cache_dir=MODEL_CACHE_DIR,
            local_files_only=True
        )
        
        print("[YES] 本地模型验证成功")
        print(f"   - 处理器类型: {type(processor).__name__}")
        print(f"   - 模型类型: {type(model).__name__}")
        print(f"   - 模型架构: {model.config.architecture}")
        print(f"   - 输入尺寸: {processor.size['height']}x{processor.size['width']}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] 本地模型验证失败: {e}")
        return False

def main():
    """
    主函数
    """
    # 显示当前Python环境
    print(f"Python版本: {sys.version}")
    print(f"当前目录: {os.getcwd()}")
    
    # 下载模型
    if download_model():
        # 验证模型
        verify_model()
    else:
        print("\n请检查网络连接或模型名称是否正确")

if __name__ == "__main__":
    main()