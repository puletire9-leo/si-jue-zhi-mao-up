"""
API v1 路由聚合 (Python FastAPI)

业务分工:
- Java 后端 (java-user / java-product): 认证、用户、竞品/选品/评分/M04/筛选预设等
- Python 后端 (本目录): 产品/选品/定稿/素材/运营商 CRUD, AI 图像, 导入导出, 报表, 领星

迁移历史:
- 2026-06-26 删除已迁移到 Java 的 Python 残留: auth.py / users.py / scoring.py
"""

from fastapi import APIRouter
from .images import router as images_router
from .products import router as products_router
from .statistics import router as statistics_router
from .categories import router as categories_router
from .tags import router as tags_router
from .logs import router as logs_router
from .recycle_bin import router as recycle_bin_router
from .selection import router as selection_router
from .selection_recycle import router as selection_recycle_router
from .export import router as export_router
from .import_ import router as import_router
from .product_recycle import router as product_recycle_router
from .file_links import router as file_links_router
from .final_drafts import router as final_drafts_router
from .system_config import router as system_config_router
from .product_data import router as product_data_router
from .image_proxy import router as image_proxy_router
from .health import router as health_router
try:
    from .material_library import router as material_library_router
except Exception:
    import logging
    logging.getLogger(__name__).warning("material_library module not loaded (torch/transformers may not be available)")
    material_library_router = APIRouter()
try:
    from .carrier_library import router as carrier_library_router
except Exception:
    import logging
    logging.getLogger(__name__).warning("carrier_library module not loaded")
    carrier_library_router = APIRouter()
from .reports import router as reports_router
from .download_tasks import router as download_tasks_router
from .lingxing import router as lingxing_router
from .members import router as members_router
from .announcement import router as announcement_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(images_router)
api_router.include_router(products_router)
api_router.include_router(statistics_router)
api_router.include_router(categories_router)
api_router.include_router(tags_router)
api_router.include_router(logs_router, prefix="/logs")
api_router.include_router(recycle_bin_router)
api_router.include_router(selection_router)
api_router.include_router(selection_recycle_router)
api_router.include_router(export_router)
api_router.include_router(import_router)
api_router.include_router(product_recycle_router)
api_router.include_router(file_links_router)
api_router.include_router(final_drafts_router)
api_router.include_router(material_library_router)
api_router.include_router(carrier_library_router)
api_router.include_router(system_config_router)
api_router.include_router(product_data_router)
api_router.include_router(image_proxy_router)
api_router.include_router(reports_router, prefix="/reports")
api_router.include_router(download_tasks_router)
api_router.include_router(lingxing_router)
api_router.include_router(members_router)
api_router.include_router(announcement_router)

__all__ = ["api_router"]
