"""桥接模块: 从旧 config 模块兼容到新 Settings 类

此模块提供向后兼容，所有配置现在从 app.config 导入。
不再需要在此文件中定义重复的配置。
"""
import os

# 从 app.config 导入设置实例和关键配置
from app.config import settings

# 基础目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 从 app.config 导入额外配置常量
from app.config import (
    AI_ANALYSIS_ENGINE,
    CHINESE_CLIP_MODEL_NAME,
    ANALYSIS_TOP_K,
    ANALYSIS_MIN_CONFIDENCE,
    CHINESE_CLIP_CACHE_DIR,
    HUGGINGFACE_MIRRORS,
    CURRENT_MIRROR,
    MODEL_URL,
    SKU_PREFIX,
    BATCH_PROCESS_LIMIT,
    DEFAULT_IMAGE_BACKGROUND,
    SUPPORTED_IMAGE_FORMATS,
    REDIS_TTL,
    TENCENT_CLOUD_CONFIG,
    BAIDU_AI_CONFIG,
)

# 本地开发路径配置
LOCAL_DATABASE_DIR = os.path.join(BASE_DIR, '..', 'development', 'database')
ASSETS_DIR = os.path.join(LOCAL_DATABASE_DIR, 'assets')
ORIGINAL_IMAGE_DIR = os.path.join(ASSETS_DIR, 'original_images')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
DEFAULT_IMG_PATH = os.path.join(STATIC_DIR, 'images', 'default.png')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
QDRANT_CACHE_DIR = os.path.join(LOCAL_DATABASE_DIR, 'qdrant_cache')
QDRANT_DIR = os.path.join(LOCAL_DATABASE_DIR, 'qdrant_db')
UPLOAD_DIR = os.path.join(ASSETS_DIR, 'uploads')
FILE_LINK_MATERIAL_DIR = os.path.join(ASSETS_DIR, '素材库')
FILE_LINK_CARRIER_DIR = os.path.join(ASSETS_DIR, '载体库')
FAILED_SKU_FILE = os.path.join(ASSETS_DIR, 'failed_sku.json')
SELECTION_IMAGE_DIR = os.path.join(ASSETS_DIR, 'selection_images')
SELECTION_NEW_IMAGE_DIR = os.path.join(SELECTION_IMAGE_DIR, 'new_products')
SELECTION_REFERENCE_IMAGE_DIR = os.path.join(SELECTION_IMAGE_DIR, 'reference_products')
SELECTION_THUMBNAIL_DIR = os.path.join(SELECTION_IMAGE_DIR, 'thumbnails')

# 从 settings 导入
MODEL_NAME = settings.MODEL_NAME
MODEL_INPUT_SIZE = settings.MODEL_INPUT_SIZE
MODEL_CACHE_DIR = settings.MODEL_CACHE_DIR
REDIS_HOST = settings.REDIS_HOST
REDIS_PORT = settings.REDIS_PORT
REDIS_DB = settings.REDIS_DB
REDIS_PASSWORD = settings.REDIS_PASSWORD

# 向后兼容标志
REDIS_AVAILABLE = True
SKIP_AI_INIT = False