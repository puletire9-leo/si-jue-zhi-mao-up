from celery import Celery
import logging

from ..config import settings

logger = logging.getLogger(__name__)

# 创建Celery应用
celery_app = Celery(
    "image_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.image_tasks"]
)

# 配置Celery
celery_app.conf.update(
    # 时区设置
    timezone="Asia/Shanghai",
    enable_utc=True,
    
    # 任务序列化
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # 任务结果设置
    result_expires=3600,  # 结果保存1小时
    task_track_started=True,
    task_acks_late=True,
    
    # 任务重试设置
    task_default_retry_delay=60,  # 默认重试延迟60秒
    task_max_retries=3,  # 最大重试次数
    
    # Worker设置
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
    
    # 任务路由
    task_routes={
        "app.tasks.image_tasks.*": {"queue": "image_tasks"},
    },
    
    # 任务限流
    task_annotations={
        "app.tasks.image_tasks.process_image": {
            "rate_limit": "10/m",
        },
    },
)

logger.info("[OK] Celery应用初始化完成")
