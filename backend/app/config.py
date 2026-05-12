"""
思觉智贸 - 应用配置
====================
所有配置均来自环境变量，Docker 部署时由 docker-compose 注入。
不再依赖 development/ 和 production/ 目录。
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Tuple, List
from functools import lru_cache
import os

# 加载 .env 文件（本地开发用）
from dotenv import load_dotenv
_env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(_env_file):
    load_dotenv(_env_file)
    print(f"[OK] Loaded env file: {_env_file}")

# 基础目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    """应用配置 - 全部来自环境变量"""
    model_config = SettingsConfigDict(case_sensitive=True, extra='ignore', env_file=_env_file if os.path.exists(_env_file) else None)

    # ========================================
    # 环境
    # ========================================
    ENVIRONMENT: str = "production"  # production / development

    # ========================================
    # 应用信息
    # ========================================
    APP_NAME: str = "思觉智贸"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # ========================================
    # 服务器
    # ========================================
    HOST: str = "0.0.0.0"
    PORT: int = 8003
    WORKERS: int = 4
    TIMEOUT: int = 300

    # ========================================
    # MySQL
    # ========================================
    MYSQL_HOST: str = "mysql"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "sijue"
    MYSQL_PASSWORD: str = "sijue123456"
    MYSQL_DATABASE: str = "sijuelishi"
    MYSQL_POOL_SIZE: int = 30
    MYSQL_MAX_OVERFLOW: int = 20
    MYSQL_POOL_RECYCLE: int = 14400
    MYSQL_POOL_TIMEOUT: int = 30
    MYSQL_POOL_PRE_PING: bool = True
    MYSQL_ECHO: bool = False

    # ========================================
    # Redis
    # ========================================
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    REDIS_POOL_SIZE: int = 50
    REDIS_SOCKET_TIMEOUT: int = 5
    REDIS_SOCKET_CONNECT_TIMEOUT: int = 5

    # ========================================
    # Celery
    # ========================================
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "Asia/Shanghai"
    CELERY_ENABLE_UTC: bool = True
    CELERY_WORKER_CONCURRENCY: int = 4

    # ========================================
    # Qdrant 向量数据库
    # ========================================
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION_NAME: str = "designs"
    QDRANT_VECTOR_SIZE: int = 768
    QDRANT_DISTANCE: str = "Cosine"

    # ========================================
    # 文件存储 (容器内绝对路径)
    # ========================================
    BASE_DIR: str = "/app"
    UPLOAD_DIR: str = "/app/uploads"
    IMAGE_ROOT_DIR: str = "/app/images/original"
    THUMBNAIL_DIR: str = "/app/images/thumbnails"
    LOCAL_THUMBNAIL_DIR: str = "/app/images/thumbnails"
    STATIC_DIR: str = "/app/static"
    MODEL_CACHE_DIR: str = "/app/model_cache"
    BACKUP_DIR: str = "/app/backup"
    LOG_FILE: str = "/app/logs/app.log"
    FRONTEND_STATIC_DIR: Optional[str] = None  # 仅生产环境使用

    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    THUMBNAIL_SIZE: Tuple[int, int] = (256, 256)
    THUMBNAIL_QUALITY: int = 85

    # ========================================
    # 腾讯云 COS
    # ========================================
    COS_ENABLED: bool = False
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    COS_BUCKET: str = ""
    COS_REGION: str = "ap-guangzhou"
    COS_SCHEME: str = "https"
    COS_TIMEOUT: int = 60
    COS_MAX_RETRIES: int = 3
    COS_PREFIX: str = "images/"
    COS_THUMBNAIL_PREFIX: str = "thumbnails/"
    COS_FINAL_DRAFT_PREFIX: str = "final_drafts/"
    COS_MATERIAL_PREFIX: str = "materials/"
    COS_CARRIER_PREFIX: str = "carriers/"
    COS_BACKUP_PREFIX: str = "backups/"
    IMAGE_READ_MODE: str = "cloud"

    # ========================================
    # 领星 COS
    # ========================================
    LINGXING_COS_BUCKET: str = "lingxing-1328246743"
    LINGXING_COS_REGION: str = "ap-guangzhou"
    LINGXING_COS_PREFIX: str = "uploads/"

    # ========================================
    # 产品数据
    # ========================================
    PARQUET_DATA_DIR: str = "/app/data"
    PARQUET_FILE_NAME: str = "product_data_final.parquet"

    # ========================================
    # AI 模型
    # ========================================
    MODEL_NAME: str = "google/vit-base-patch16-224-in21k"
    MODEL_INPUT_SIZE: int = 224

    # ========================================
    # 缓存
    # ========================================
    CACHE_ENABLED: bool = True
    CACHE_TTL: int = 3600
    SEARCH_CACHE_TTL: int = 300
    PRODUCT_IMAGES_CACHE_TTL: int = 600
    CACHE_LOCAL_MAXSIZE: int = 1000
    CACHE_LOCAL_TTL: int = 300
    CACHE_KEY_PREFIX: str = "imgdb"
    CACHE_DEFAULT_TIMEOUT: int = 600

    # ========================================
    # 日志
    # ========================================
    LOG_LEVEL: str = "INFO"
    LOG_ROTATION: str = "500 MB"
    LOG_RETENTION: str = "7 days"

    # ========================================
    # CORS
    # ========================================
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = False
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # ========================================
    # 安全
    # ========================================
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ========================================
    # 性能
    # ========================================
    REQUEST_TIMEOUT: int = 60
    SLOW_REQUEST_THRESHOLD: int = 5
    MAX_CONCURRENT_REQUESTS: int = 200
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_PER_HOUR: int = 2000
    RATE_LIMIT_PER_DAY: int = 20000
    ASYNC_TASK_TIMEOUT: int = 600
    MAX_ASYNC_WORKERS: int = 15

    # ========================================
    # 业务限制
    # ========================================
    SEARCH_LIMIT_DEFAULT: int = 20
    SEARCH_LIMIT_MAX: int = 100
    SIMILAR_LIMIT_DEFAULT: int = 10
    SIMILAR_LIMIT_MAX: int = 50
    BATCH_UPLOAD_MAX: int = 100
    BATCH_DELETE_MAX: int = 200

    # ========================================
    # 热重载 (仅开发环境)
    # ========================================
    HOT_RELOAD_ENABLED: bool = False
    HOT_RELOAD_WATCH_DIRS: List[str] = ["backend/app"]
    HOT_RELOAD_COOLDOWN: float = 3.0
    HOT_RELOAD_IGNORE_PATTERNS: List[str] = [
        "*.pyc", "__pycache__", "*.pyo", "*.log",
        ".git", "node_modules", ".pytest_cache", "*.db", "*.sqlite"
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # 根据环境自动调整行为
        if self.ENVIRONMENT == "development":
            self.DEBUG = True
            self.HOT_RELOAD_ENABLED = True
            self.LOG_LEVEL = "DEBUG"
            self.RATE_LIMIT_ENABLED = False
            self.CORS_ORIGINS = ["*"]
        else:
            self.DEBUG = False
            self.HOT_RELOAD_ENABLED = False
            self.LOG_LEVEL = "INFO"
            self.RATE_LIMIT_ENABLED = True

        # 确保关键目录存在
        for d in [
            self.UPLOAD_DIR,
            self.IMAGE_ROOT_DIR,
            self.THUMBNAIL_DIR,
            self.MODEL_CACHE_DIR,
            self.BACKUP_DIR,
            os.path.dirname(self.LOG_FILE),
        ]:
            os.makedirs(d, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

# ========================================
# 额外的配置常量（从旧config模块迁移）
# 这些值不在环境变量中，直接定义
# ========================================

# AI 配置
AI_ANALYSIS_ENGINE = "clip"
CHINESE_CLIP_MODEL_NAME = "OFA-Sys/chinese-clip-vit-base-patch16"
ANALYSIS_TOP_K = 5
ANALYSIS_MIN_CONFIDENCE = 1.0
CHINESE_CLIP_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '模型', 'chinese_clip_cache')
HUGGINGFACE_MIRRORS = {}
CURRENT_MIRROR = 'tuna'
MODEL_URL = ''
SKU_PREFIX = 'sku'
BATCH_PROCESS_LIMIT = 50
DEFAULT_IMAGE_BACKGROUND = (255, 255, 255)
SUPPORTED_IMAGE_FORMATS = ('.jpg', '.jpeg', '.png', '.bmp')

# Redis TTL
REDIS_TTL = 900

# 腾讯云配置
TENCENT_CLOUD_CONFIG = {
    'secret_id': '',
    'secret_key': '',
    'region': 'ap-guangzhou',
    'enabled': False,
}

# 百度AI配置
BAIDU_AI_CONFIG = {
    'app_id': '',
    'api_key': '',
    'secret_key': '',
    'enabled': False,
}
