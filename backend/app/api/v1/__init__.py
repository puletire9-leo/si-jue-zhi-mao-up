"""
[参考] API路由聚合模块 - 待废弃
===================================

[WARN] 此模块已迁移到 Java 后端，仅作为参考。

迁移状态：
- [OK] 全部API已迁移到 java-backend/src/main/java/com/sjzm/controller/

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter
from .images import router as images_router
from .products import router as products_router
from .statistics import router as statistics_router
from .users import router as users_router
from .categories import router as categories_router
from .tags import router as tags_router
from .logs import router as logs_router
from .recycle_bin import router as recycle_bin_router
from .selection import router as selection_router
from .selection_recycle import router as selection_recycle_router
from .auth import router as auth_router
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
from .scoring import router as scoring_router
from .announcement import router as announcement_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(images_router)
api_router.include_router(products_router)
api_router.include_router(statistics_router)
api_router.include_router(users_router)
api_router.include_router(categories_router)
api_router.include_router(tags_router)
api_router.include_router(logs_router, prefix="/logs")
api_router.include_router(recycle_bin_router)
api_router.include_router(selection_router)
api_router.include_router(selection_recycle_router)
api_router.include_router(auth_router)
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
api_router.include_router(scoring_router)
api_router.include_router(announcement_router)

__all__ = ["api_router"]
