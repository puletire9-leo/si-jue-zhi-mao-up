# system_check.py
# 系统检查模块，负责系统启动检查和服务健康状态监控
import os
import sys
import redis
import pymysql
from qdrant_client import QdrantClient
import torch

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# 导入配置
from config.config import (
    DB_CONFIG,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_DB,
    REDIS_PASSWORD,
    REDIS_SOCKET_TIMEOUT,
    REDIS_DECODE_RESPONSES,
    QDRANT_CACHE_DIR,
    THUMBNAIL_DIR,
    UPLOAD_DIR,
    SKIP_AI_INIT  # 添加跳过AI初始化的配置
)

# 导入错误日志系统
from utils.error_logger import log_error, get_user_friendly_message

# ---------------------- 系统启动检查 ----------------------
def check_mysql_connection():
    """
    检查MySQL数据库连接状态
    """
    try:
        conn = pymysql.connect(**DB_CONFIG)
        conn.close()
        return True
    except Exception as e:
        log_error('DatabaseConnectionError', f'MySQL连接失败: {str(e)}')
        return False

def check_redis_connection():
    """
    检查Redis服务连接状态
    """
    try:
        redis_config = {
            'host': REDIS_HOST,
            'port': REDIS_PORT,
            'db': REDIS_DB,
            'password': REDIS_PASSWORD,
            'socket_timeout': REDIS_SOCKET_TIMEOUT,
            'decode_responses': REDIS_DECODE_RESPONSES
        }
        r = redis.Redis(**redis_config)
        r.ping()
        return True
    except Exception as e:
        log_error('RedisConnectionError', f'Redis连接失败: {str(e)}')
        return False

def check_qdrant_connection():
    """
    检查Qdrant向量库连接状态（使用连接监控器）
    """
    try:
        from utils.qdrant_monitor import qdrant_monitor
        if qdrant_monitor and qdrant_monitor.is_available():
            return True
        else:
            log_error('QdrantConnectionError', 'Qdrant连接监控器显示未连接')
            return False
    except Exception as e:
        log_error('QdrantConnectionError', f'Qdrant连接检查失败: {str(e)}')
        return False

def check_ai_model():
    """
    检查AI模型初始化状态
    """
    try:
        # 检查PyTorch是否可用
        if torch and torch.cuda.is_available():
            return True
        else:
            return False
    except Exception as e:
        print(f"[ERROR] AI模型检查失败: {str(e)}")
        return False

def check_directories():
    """
    检查必要目录是否存在
    """
    required_dirs = [
        THUMBNAIL_DIR,
        QDRANT_CACHE_DIR,
        UPLOAD_DIR
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        if not os.path.exists(dir_path):
            print(f"[WARNING] 目录不存在: {dir_path}")
            try:
                os.makedirs(dir_path, exist_ok=True)
                print(f"[INFO] 已自动创建目录: {dir_path}")
            except Exception as e:
                print(f"[ERROR] 创建目录失败: {str(e)}")
                all_exist = False
    
    return all_exist

def check_cuda_availability():
    """
    检查CUDA是否可用
    """
    try:
        if torch.cuda.is_available():
            print(f"[INFO] CUDA可用，设备: {torch.cuda.get_device_name(0)}")
            return True
        else:
            print(f"[INFO] CUDA不可用，将使用CPU")
    except AttributeError:
        print(f"[INFO] CUDA不可用（PyTorch未配置CUDA支持），将使用CPU")
    return False

def startup_check():
    """
    系统启动检查，验证所有依赖服务和环境是否正常
    """
    print("\n=== 系统启动检查开始 ===")
    
    # 1. 检查目录结构
    print("1. 检查目录结构...")
    check_directories()
    
    # 2. 检查CUDA可用性（如果需要）
    print("2. 检查CUDA可用性...")
    check_cuda_availability()
    
    # 3. 检查AI模型状态（不重复初始化，只检查状态）
    print("3. 检查AI模型状态...")
    if SKIP_AI_INIT:
        print("   ✓ AI模型初始化：已跳过（SKIP_AI_INIT=True）")
    else:
        model_status = check_ai_model()
        if model_status:
            print("   ✓ AI模型状态：正常")
        else:
            print("   ✗ AI模型状态：异常")
    
    # 4. 检查服务连接
    print("4. 检查服务连接...")
    
    services = [
        ("MySQL", check_mysql_connection),
        ("Redis", check_redis_connection),
        ("Qdrant", check_qdrant_connection),
        ("AI模型", check_ai_model)
    ]
    
    service_status = {}
    all_services_ok = True
    
    for service_name, check_func in services:
        try:
            status = check_func()
            service_status[service_name] = status
            if status:
                print(f"   ✓ {service_name}: 正常")
            else:
                print(f"   ✗ {service_name}: 异常")
                all_services_ok = False
        except Exception as e:
            service_status[service_name] = False
            print(f"   ✗ {service_name}: 检查失败 - {str(e)}")
            all_services_ok = False
    
    print("\n=== 系统启动检查完成 ===")
    if all_services_ok:
        print("[SUCCESS] 所有服务检查通过，系统可以正常运行")
    else:
        print("[WARNING] 部分服务检查失败，系统可能无法正常运行")
    
    return service_status

# ---------------------- API健康检查 ----------------------
def get_api_health_status():
    """
    获取API健康状态信息（使用错误日志系统）
    """
    status = {
        "status": "healthy",
        "services": {
            "mysql": check_mysql_connection(),
            "redis": check_redis_connection(),
            "qdrant": check_qdrant_connection(),
            "ai_model": check_ai_model()
        },
        "errors": []
    }
    
    # 检查服务状态
    for service_name, service_status in status["services"].items():
        if not service_status:
            status["status"] = "unhealthy"
            error_message = get_user_friendly_message(f'{service_name.capitalize()}Error', f'{service_name}服务不可用')
            status["errors"].append(error_message)
            log_error(f'{service_name.capitalize()}Error', f'{service_name}服务不可用')
    
    return status









