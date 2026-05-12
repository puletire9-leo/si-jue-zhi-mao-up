#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Qdrant连接监控和自动重连模块
提供Qdrant连接状态监控、自动重连和详细日志记录功能
"""
import os
import time
import traceback
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

# 导入配置
from config.config import (
    COLLECTION_NAME,
    VECTOR_DIMENSION,
    QDRANT_CACHE_DIR
)

# 导入错误日志
from utils.error_logger import log_error, get_user_friendly_message

class QdrantConnectionMonitor:
    """Qdrant连接监控器"""
    
    def __init__(self):
        self.client = None
        self.is_connected = False
        self.last_error = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 3
        self.reconnect_delay = 5  # 重连延迟（秒）
    
    def connect(self):
        """
        连接到Qdrant向量库
        
        :return: 连接是否成功
        """
        try:
            print(f"[INFO] 正在连接到Qdrant向量库...")
            print(f"[INFO] 路径: {QDRANT_CACHE_DIR}")
            print(f"[INFO] 集合: {COLLECTION_NAME}")
            print(f"[INFO] 向量维度: {VECTOR_DIMENSION}")
            
            # 尝试清理可能存在的锁文件
            self._cleanup_lock_files()
            
            # 初始化Qdrant客户端
            self.client = QdrantClient(
                path=QDRANT_CACHE_DIR,
                timeout=30.0
            )
            
            # 检查/创建向量集合
            collection_exists = False
            try:
                self.client.get_collection(COLLECTION_NAME)
                collection_exists = True
                print(f"[OK] 加载已有Qdrant集合：{COLLECTION_NAME}")
            except Exception:
                print(f"[INFO] 集合 {COLLECTION_NAME} 不存在，将创建新集合")
            
            if not collection_exists:
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(
                        size=VECTOR_DIMENSION,
                        distance=Distance.COSINE
                    ),
                    hnsw_config={
                        "m": 12,
                        "ef_construct": 64
                    },
                    optimizers_config={
                        "memmap_threshold": 10000
                    }
                )
                print(f"[OK] 创建Qdrant集合：{COLLECTION_NAME}（维度：{VECTOR_DIMENSION}）")
            
            self.is_connected = True
            self.reconnect_attempts = 0
            self.last_error = None
            
            print(f"[SUCCESS] Qdrant向量库连接成功")
            return True
            
        except Exception as e:
            self.is_connected = False
            self.last_error = str(e)
            error_msg = f"Qdrant连接失败: {str(e)}"
            
            # 记录错误日志
            log_error(
                error_type='QdrantError',
                error_message=error_msg,
                context={
                    'path': QDRANT_CACHE_DIR,
                    'collection': COLLECTION_NAME,
                    'vector_dimension': VECTOR_DIMENSION
                }
            )
            
            print(f"[ERROR] {error_msg}")
            print(f"[ERROR] 堆栈跟踪:\n{traceback.format_exc()}")
            return False
    
    def _cleanup_lock_files(self):
        """
        清理Qdrant锁文件
        """
        try:
            import glob
            import shutil
            
            # 查找所有锁文件
            lock_pattern = os.path.join(QDRANT_CACHE_DIR, "*.lock")
            lock_files = glob.glob(lock_pattern)
            
            for lock_file in lock_files:
                try:
                    os.remove(lock_file)
                    print(f"[INFO] 清理锁文件: {lock_file}")
                except Exception as e:
                    print(f"[WARNING] 无法清理锁文件 {lock_file}: {str(e)}")
        except Exception as e:
            print(f"[WARNING] 清理锁文件时出错: {str(e)}")
    
    def disconnect(self):
        """
        断开Qdrant连接
        """
        try:
            if self.client:
                self.client.close()
                self.is_connected = False
                print("[INFO] Qdrant连接已关闭")
        except Exception as e:
            log_error(
                error_type='QdrantError',
                error_message=f"断开连接失败: {str(e)}"
            )
    
    def reconnect(self):
        """
        自动重连Qdrant
        
        :return: 重连是否成功
        """
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            print(f"[ERROR] 已达到最大重连次数（{self.max_reconnect_attempts}），停止重连")
            return False
        
        self.reconnect_attempts += 1
        print(f"[INFO] 尝试重连Qdrant（第{self.reconnect_attempts}次）...")
        
        # 等待一段时间再重连
        time.sleep(self.reconnect_delay)
        
        # 先断开现有连接
        self.disconnect()
        
        # 尝试重新连接
        return self.connect()
    
    def check_connection(self):
        """
        检查Qdrant连接状态
        
        :return: 连接是否正常
        """
        if not self.client or not self.is_connected:
            print("[WARNING] Qdrant客户端未初始化或未连接")
            return False
        
        try:
            # 尝试获取集合信息来验证连接
            self.client.get_collection(COLLECTION_NAME)
            print("[OK] Qdrant连接状态检查通过")
            return True
        except Exception as e:
            print(f"[WARNING] Qdrant连接检查失败: {str(e)}")
            return False
    
    def get_client(self):
        """
        获取Qdrant客户端实例
        
        :return: Qdrant客户端
        """
        return self.client
    
    def is_available(self):
        """
        检查Qdrant是否可用
        
        :return: 是否可用
        """
        return self.is_connected and self.client is not None
    
    def get_status(self):
        """
        获取连接状态信息
        
        :return: 状态字典
        """
        return {
            'connected': self.is_connected,
            'client_initialized': self.client is not None,
            'reconnect_attempts': self.reconnect_attempts,
            'last_error': self.last_error,
            'collection': COLLECTION_NAME,
            'vector_dimension': VECTOR_DIMENSION,
            'path': QDRANT_CACHE_DIR
        }

# 全局Qdrant连接监控器实例
qdrant_monitor = QdrantConnectionMonitor()

def init_qdrant_with_monitor():
    """
    初始化Qdrant并启用连接监控
    
    :return: 初始化是否成功
    """
    print("\n=== 开始初始化Qdrant向量库（带监控）===")
    
    # 尝试连接
    success = qdrant_monitor.connect()
    
    if not success:
        # 尝试自动重连
        print("[INFO] 首次连接失败，尝试自动重连...")
        for attempt in range(qdrant_monitor.max_reconnect_attempts):
            print(f"[INFO] 重连尝试 {attempt + 1}/{qdrant_monitor.max_reconnect_attempts}")
            if qdrant_monitor.reconnect():
                print("[SUCCESS] Qdrant重连成功")
                break
        else:
            print("[ERROR] 所有重连尝试均失败")
            return False
    
    # 验证连接状态
    if qdrant_monitor.check_connection():
        print("=== Qdrant向量库初始化成功 ===")
        return True
    else:
        print("[ERROR] Qdrant连接验证失败")
        return False

if __name__ == '__main__':
    print("Qdrant连接监控测试")
    
    # 测试连接
    if qdrant_monitor.connect():
        print("\n✓ 连接成功")
        status = qdrant_monitor.get_status()
        print(f"状态: {status}")
        
        # 测试重连
        print("\n测试断开连接...")
        qdrant_monitor.disconnect()
        
        print("\n测试自动重连...")
        if qdrant_monitor.reconnect():
            print("✓ 重连成功")
    else:
        print("✗ 重连失败")