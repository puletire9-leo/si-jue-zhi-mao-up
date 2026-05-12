import logging
import sys
from celery.bin import worker

from app.tasks import celery_app
from app.config import settings

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('celery.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)


def main():
    """
    启动Celery Worker
    
    启动Celery worker处理异步任务
    """
    logger.info("[START] 启动Celery Worker...")
    logger.info(f"[LIST] 配置信息:")
    logger.info(f"   - Broker: {settings.CELERY_BROKER_URL}")
    logger.info(f"   - Backend: {settings.CELERY_RESULT_BACKEND}")
    logger.info(f"   - 并发数: {settings.CELERY_WORKER_CONCURRENCY}")
    
    try:
        # 创建worker
        worker_instance = worker.worker(
            app=celery_app,
            loglevel="info",
            concurrency=settings.CELERY_WORKER_CONCURRENCY,
            pool="prefork",
            hostname="worker@%h"
        )
        
        # 启动worker
        worker_instance.start()
        
    except KeyboardInterrupt:
        logger.info("[STOP] Celery Worker已停止")
    except Exception as e:
        logger.error(f"[FAIL] 启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
