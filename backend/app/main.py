from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from .middleware.error_handler import global_exception_handler
import logging
import sys
import os
import asyncio
from .utils.performance_monitor import PerformanceMonitor

from .config import settings
from .middleware import (
    LoggingMiddleware,
    TimeoutMiddleware,
    SlowRequestMiddleware,
    RequestSizeMiddleware
)
from .repositories import MySQLRepository, RedisRepository, QdrantRepository

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(settings.LOG_FILE, encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    功能：
    - 启动时初始化数据库连接
    - 启动时检查URL格式
    - 关闭时清理资源
    
    Args:
        app: FastAPI应用实例
    """
    # 初始化性能监控器
    monitor = PerformanceMonitor()
    monitor.start("应用启动总耗时")
    
    logger.info("[START] FastAPI应用启动中...")

    # 并行初始化数据库连接
    async def init_mysql():
        """初始化MySQL连接"""
        try:
            app.state.mysql = MySQLRepository(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DATABASE,
                pool_size=settings.MYSQL_POOL_SIZE,
                pool_recycle=settings.MYSQL_POOL_RECYCLE,
                echo=settings.MYSQL_ECHO
            )
            await app.state.mysql.connect()
            return app.state.mysql
        except Exception as e:
            logger.error(f"[FAIL] MySQL连接失败: {e}（数据库功能不可用）")
            app.state.mysql = None
            return None
    
    async def init_redis():
        """初始化Redis连接"""
        try:
            app.state.redis = RedisRepository(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD,
                pool_size=settings.REDIS_POOL_SIZE
            )
            await app.state.redis.connect()
            return app.state.redis
        except Exception as e:
            logger.warning(f"[WARN] Redis连接失败: {e}（将不使用缓存功能）")
            app.state.redis = None
            return None
    
    async def init_qdrant():
        """初始化Qdrant连接"""
        try:
            app.state.qdrant = QdrantRepository(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vector_size=settings.QDRANT_VECTOR_SIZE,
                distance=settings.QDRANT_DISTANCE
            )
            await app.state.qdrant.connect()
            return app.state.qdrant
        except Exception as e:
            logger.warning(f"[WARN] Qdrant连接失败: {e}（将不使用向量搜索功能）")
            app.state.qdrant = None
            return None
    
    async def check_url_formats():
        """
        轻量级URL格式检查
        
        功能：
        - 检查数据库中URL格式问题
        - 只检查不修复，不影响启动速度
        - 根据当前环境检查对应数据库
        """
        try:
            monitor.start("URL格式检查")
            logger.info(f"[SEARCH] 开始URL格式检查 - 环境: {settings.ENVIRONMENT}, 数据库: {settings.MYSQL_DATABASE}")
            
            # 检查是否有MySQL连接
            if not hasattr(app.state, 'mysql') or not app.state.mysql:
                logger.warning("[WARN] MySQL未连接，跳过URL格式检查")
                return
            
            # 轻量级检查：只检查有问题的URL格式
            # 查询包含无效参数的URL
            # 直接执行查询，避免参数绑定错误
            query = "SELECT id, filename, filepath, cos_url FROM images WHERE (filepath LIKE '%q-url-param-list=&q-signature=%' OR cos_url LIKE '%q-url-param-list=&q-signature=%' OR filepath LIKE '%q-url-param-list=&%' OR cos_url LIKE '%q-url-param-list=&%' OR filepath LIKE '%&q-url-param-list=&%' OR cos_url LIKE '%&q-url-param-list=&%' OR filepath LIKE '%q-url-param-list=%' OR cos_url LIKE '%q-url-param-list=%') LIMIT 100"
            
            # 执行查询
            problematic_images = await app.state.mysql.execute_query(query)
            
            if problematic_images:
                logger.warning(f"[WARN] 发现 {len(problematic_images)} 个URL格式问题")
                logger.warning("建议执行以下命令修复:")
                logger.warning(f"python backend/scripts/fix_image_urls.py --full-scan")
                
                # 输出前5个问题作为示例
                for i, img in enumerate(problematic_images[:5]):
                    logger.warning(f"示例 {i+1}: 图片ID {img['id']} - {img['filename']}")
            else:
                logger.info("[OK] URL格式检查完成，未发现问题")
                
        except Exception as e:
            logger.error(f"[FAIL] URL格式检查失败: {e}")
        finally:
            monitor.end("URL格式检查")
    
    try:
        # 使用并行初始化，提高启动速度
        monitor.start("数据库连接初始化")
        
        # 并行执行初始化任务
        mysql_task = asyncio.create_task(init_mysql())
        redis_task = asyncio.create_task(init_redis())
        qdrant_task = asyncio.create_task(init_qdrant())
        
        # 等待任务完成
        mysql_result = await mysql_task
        redis_result = await redis_task
        qdrant_result = await qdrant_task
        
        monitor.end("数据库连接初始化")
        
        # 记录连接结果
        if mysql_result:
            logger.info("[OK] MySQL连接成功")
        if redis_result:
            logger.info("[OK] Redis连接成功")
        if qdrant_result:
            logger.info("[OK] Qdrant连接成功")
        
        # 执行URL格式检查
        await check_url_formats()
        
        # 启动下载任务服务清理任务
        monitor.start("下载任务服务初始化")
        try:
            from .services.download_task_service import download_task_service
            download_task_service.set_mysql_repo(app.state.mysql)
            await download_task_service.start_cleanup_task()
            logger.info("[OK] 下载任务服务初始化成功")
        except Exception as e:
            logger.error(f"[FAIL] 下载任务服务初始化失败: {e}")
        monitor.end("下载任务服务初始化")
        
        # 启动临时文件清理任务
        monitor.start("临时文件清理任务初始化")
        try:
            from .api.v1.final_drafts import start_temp_files_cleanup
            await start_temp_files_cleanup()
            logger.info("[OK] 临时文件清理任务初始化成功")
        except Exception as e:
            logger.error(f"[FAIL] 临时文件清理任务初始化失败: {e}")
        monitor.end("临时文件清理任务初始化")
            
    except Exception as e:
        logger.error(f"[FAIL] 数据库连接初始化失败: {e}")
        monitor.end("数据库连接初始化")
        raise
    
    # 创建必要的目录
    monitor.start("目录创建")
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(settings.THUMBNAIL_DIR, exist_ok=True)
        os.makedirs(settings.MODEL_CACHE_DIR, exist_ok=True)
        logger.info("[OK] 目录创建成功")
    except Exception as e:
        logger.error(f"[FAIL] 目录创建失败: {e}")
    monitor.end("目录创建")
    
    monitor.end("应用启动总耗时")
    monitor.log_summary()
    
    logger.info("[DONE] FastAPI应用启动完成")
    
    yield
    
    # 清理资源
    shutdown_monitor = PerformanceMonitor()
    shutdown_monitor.start("应用关闭总耗时")
    
    logger.info("[STOP] FastAPI应用关闭中...")
    
    # 并行清理资源
    async def cleanup_mysql():
        """清理MySQL连接"""
        if hasattr(app.state, 'mysql') and app.state.mysql:
            await app.state.mysql.disconnect()
    
    async def cleanup_redis():
        """清理Redis连接"""
        if hasattr(app.state, 'redis') and app.state.redis:
            await app.state.redis.disconnect()
    
    async def cleanup_qdrant():
        """清理Qdrant连接"""
        if hasattr(app.state, 'qdrant') and app.state.qdrant:
            await app.state.qdrant.disconnect()
    
    async def cleanup_download_service():
        """清理下载任务服务"""
        try:
            from .services.download_task_service import download_task_service
            await download_task_service.stop_cleanup_task()
            logger.info("[OK] 下载任务服务已清理")
        except Exception as e:
            logger.error(f"[FAIL] 下载任务服务清理失败: {e}")
    
    # 并行执行清理任务
    await asyncio.gather(
        cleanup_mysql(),
        cleanup_redis(),
        cleanup_qdrant(),
        cleanup_download_service(),
        return_exceptions=True
    )
    
    shutdown_monitor.end("应用关闭总耗时")
    shutdown_monitor.log_summary()
    
    logger.info("[OK] FastAPI应用已关闭")


# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="高性能思觉智贸系统后端API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    expose_headers=["*"],  # 暴露所有响应头
)


# 配置自定义中间件
app.add_middleware(
    LoggingMiddleware,
    skip_paths=["/health", "/metrics"]
)

app.add_middleware(
    TimeoutMiddleware,
    default_timeout=settings.REQUEST_TIMEOUT,
    path_timeouts={
        "/api/v1/images/search": 60.0,  # 搜索请求超时时间更长
        "/api/v1/images/upload": 120.0,  # 上传请求超时时间更长
        "/api/v1/products": 60.0,  # 产品列表请求超时时间更长
        "/api/v1/users": 60.0,  # 用户列表请求超时时间更长
        "/api/v1/final-drafts/download-zip": 1800.0,  # 定稿下载请求超时30分钟（大文件下载需要更长时间）
        "/api/v1/download-tasks": 300.0,  # 下载任务请求超时5分钟
    },
    skip_paths=["/health", "/metrics"]
)

app.add_middleware(
    SlowRequestMiddleware,
    slow_threshold=settings.SLOW_REQUEST_THRESHOLD,
    log_level="warning"
)

app.add_middleware(
    RequestSizeMiddleware,
    max_size=settings.MAX_UPLOAD_SIZE,
    path_sizes={
        "/api/v1/images/upload": settings.MAX_UPLOAD_SIZE * 100,  # 单张上传接口允许1000MB
        "/api/v1/images/batch-upload": settings.MAX_UPLOAD_SIZE * 100  # 批量上传接口允许1000MB
    },
    skip_paths=["/health", "/metrics"]
)


# 全局异常处理器 - 使用统一的错误处理中间件
app.add_exception_handler(StarletteHTTPException, global_exception_handler)
app.add_exception_handler(RequestValidationError, global_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)


# 基础路由
# 只在非生产环境下定义根路径API
if settings.ENVIRONMENT != "production":
    @app.get("/")
    async def root():
        """
        根路径
        
        Returns:
            欢迎信息
        """
        return {
            "message": "欢迎使用思觉智贸系统API",
            "version": settings.APP_VERSION,
            "docs": "/docs"
        }


@app.get("/health")
async def health_check():
    """
    健康检查端点
    
    Returns:
        健康状态信息
    """
    return {
        "status": "healthy",
        "version": settings.APP_VERSION
    }


@app.get("/metrics")
async def metrics():
    """
    指标端点（预留）
    
    Returns:
        指标信息
    """
    return {
        "status": "ok",
        "metrics": {}
    }


# 配置静态文件服务
# 本地静态文件服务（用于开发环境）
if os.path.exists(settings.STATIC_DIR):
    app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")
    logger.info(f"[OK] 本地静态文件服务已配置: {settings.STATIC_DIR}")

# 生产环境前端静态文件服务
if settings.ENVIRONMENT == "production" and settings.FRONTEND_STATIC_DIR and os.path.exists(settings.FRONTEND_STATIC_DIR):
    app.mount("/", StaticFiles(directory=settings.FRONTEND_STATIC_DIR, html=True), name="frontend")
    logger.info(f"[OK] 生产环境前端静态文件服务已配置: {settings.FRONTEND_STATIC_DIR}")
    logger.info(f"前端应用将通过根路径提供服务")

# 图片目录静态文件服务（用于本地图片访问）
if os.path.exists(settings.IMAGE_ROOT_DIR):
    app.mount("/images", StaticFiles(directory=settings.IMAGE_ROOT_DIR), name="images")
    logger.info(f"[OK] 图片目录静态文件服务已配置: {settings.IMAGE_ROOT_DIR}")

if os.path.exists(settings.THUMBNAIL_DIR):
    app.mount("/thumbnails", StaticFiles(directory=settings.THUMBNAIL_DIR), name="thumbnails")
    logger.info(f"[OK] 缩略图目录静态文件服务已配置: {settings.THUMBNAIL_DIR}")

# 注册API路由
from .api.v1 import api_router
app.include_router(api_router, prefix="/api/v1")

# 注册产品销量数据API路由（独立模块）
try:
    from .api import product_sales
    app.include_router(product_sales.router)
    logger.info("[OK] 产品销量API路由注册成功")
except Exception as e:
    logger.error(f"[FAIL] 产品销量API路由注册失败: {e}")
    import traceback
    logger.error(traceback.format_exc())


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS if not settings.DEBUG else 1,
        log_level="info"
    )
