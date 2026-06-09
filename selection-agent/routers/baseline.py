"""竞品模型基线管理路由 — 仅提供手动触发入口，实际计算由 Java 执行。

职责边界：
  - 接收请求 → 转发 Java → 返回结果
  - 不包含任何 SQL、百分位计算、ETL 逻辑
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from selection.java_client import get_java_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/baseline", tags=["基线管理"])


@router.post("/compute")
async def compute_baseline(
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
    month: str = Query(..., description="数据月份 如 2026-06"),
):
    """手动触发品类基线计算。

    调用链: agent → Java CategoryBaselineController.compute()
        → CategoryBaselineService.computeBaseline()
        → 从 competitor_products 计算百分位 → 写入 category_baselines

    返回计算摘要:
    {
        "success": true,
        "marketplace": "UK",
        "month": "2026-06",
        "totalProducts": 6991,
        "totalCategories": 40,
        "computed": 35,
        "skipped": 5,
        "elapsedMs": 1234
    }
    """
    client = get_java_client()
    try:
        result = await client.compute_baseline(marketplace, month)
    except Exception as e:
        logger.error(f"基线计算失败: {e}")
        raise HTTPException(status_code=502, detail=f"Java服务调用失败: {e}")
    return result
