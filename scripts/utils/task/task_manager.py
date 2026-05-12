# task_manager.py
# 任务管理模块，负责Excel导入等任务的进度管理
import os
import sys
import time
import json
import uuid
from datetime import datetime

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.insert(0, project_root)

# 导入配置（使用绝对导入）
from config.config import (
    TASK_EXPIRE_MINUTES
)

# 导入缓存管理模块（使用绝对导入）
from utils.cache.cache_manager import (
    REDIS_AVAILABLE,
    redis_client
)

# 本地任务进度存储
PROGRESS_STORE = {}

# ---------------------- 任务管理工具函数 ----------------------
def init_import_task():
    """
    初始化导入任务（生成唯一ID和默认状态）
    """
    task_id = str(uuid.uuid4())
    PROGRESS_STORE[task_id] = {
        "task_id": task_id,
        "total": 0,
        "processed": 0,
        "failed": 0,
        "status": "processing",
        "start_time": time.time(),
        "completed_time": None,
        "message": "任务初始化成功，开始处理"
    }
    return PROGRESS_STORE[task_id]

def update_import_task(task_id, update_data):
    """
    更新导入任务进度
    """
    if task_id in PROGRESS_STORE:
        PROGRESS_STORE[task_id].update(update_data)
        return PROGRESS_STORE[task_id]
    return None

def get_import_task(task_id):
    """
    获取导入任务进度
    """
    return PROGRESS_STORE.get(task_id)

# ---------------------- 导入任务进度管理工具函数（高级版本） ----------------------
def init_excel_import_task():
    """初始化Excel导入任务，生成任务ID并记录初始进度"""
    task_id = str(uuid.uuid4())[:8]  # 简化任务ID，便于前端展示
    task_info = {
        "task_id": task_id,
        "status": "running",
        "total": 0,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "errors": [],
        "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "end_time": None
    }

    # 保存任务进度（优先Redis，其次本地内存）
    if REDIS_AVAILABLE and redis_client:
        try:
            task_key = f"import_progress:{task_id}"
            serialized_task = json.dumps(
                task_info,
                default=str,
                ensure_ascii=False
            )
            redis_client.setex(
                task_key,
                timedelta(minutes=TASK_EXPIRE_MINUTES),
                serialized_task
            )
        except Exception as e:
            print(f"[WARNING]  Redis保存任务进度失败，使用本地内存存储：{str(e)}")
            PROGRESS_STORE[task_id] = task_info
    else:
        PROGRESS_STORE[task_id] = task_info

    return task_id, task_info

def update_excel_import_task(task_id, update_data):
    """更新Excel导入任务进度"""
    if not task_id or not update_data:
        return

    task_info = None
    task_key = f"import_progress:{task_id}"

    # 1. 获取当前任务信息
    if REDIS_AVAILABLE and redis_client:
        try:
            cached_data = redis_client.get(task_key)
            if cached_data:
                if isinstance(cached_data, bytes):
                    task_info = json.loads(cached_data.decode('utf-8'))
                else:
                    task_info = json.loads(cached_data)
        except Exception as e:
            print(f"[WARNING]  Redis读取任务进度失败：{str(e)}")
    else:
        task_info = PROGRESS_STORE.get(task_id, None)

    if not task_info:
        print(f"[ERROR] 任务不存在（{task_id}），无法更新进度")
        return

    # 2. 更新任务信息
    for key, value in update_data.items():
        if key in task_info:
            task_info[key] = value

    # 3. 任务结束时补充结束时间
    if task_info["status"] in ["finished", "failed"] and not task_info["end_time"]:
        task_info["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 4. 保存更新后的任务信息
    if REDIS_AVAILABLE and redis_client:
        try:
            serialized_task = json.dumps(
                task_info,
                default=str,
                ensure_ascii=False
            )
            redis_client.setex(
                task_key,
                timedelta(minutes=TASK_EXPIRE_MINUTES),
                serialized_task
            )
        except Exception as e:
            print(f"[WARNING]  Redis更新任务进度失败：{str(e)}")
            PROGRESS_STORE[task_id] = task_info
    else:
        PROGRESS_STORE[task_id] = task_info

def get_excel_import_task(task_id):
    """查询Excel导入任务进度/结果"""
    if not task_id:
        return None

    task_key = f"import_progress:{task_id}"

    # 1. 优先从Redis查询
    if REDIS_AVAILABLE and redis_client:
        try:
            cached_data = redis_client.get(task_key)
            if cached_data:
                if isinstance(cached_data, bytes):
                    return json.loads(cached_data.decode('utf-8'))
                else:
                    return json.loads(cached_data)
        except Exception as e:
            print(f"[WARNING]  Redis查询任务进度失败：{str(e)}")

    # 2. 从本地内存查询
    return PROGRESS_STORE.get(task_id, None)


