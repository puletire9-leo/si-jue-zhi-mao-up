"""卖家行为画像 API 端点。

提供卖家画像查询、品类热度矩阵、跟品信号、智能推荐
以及手动触发全量扫描的能力。

端点:
  GET  /seller/profiles            — 卖家画像列表
  GET  /seller/profiles/{name}     — 单卖家详情
  GET  /seller/heat-matrix          — 品类热度矩阵
  GET  /seller/follow-signals       — 跟品信号
  GET  /seller/recommendations      — 智能推荐
  POST /seller/scan                 — 触发全量扫描
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Body, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/seller", tags=["卖家行为画像"])


@router.get("/profiles")
async def list_seller_profiles(
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
    grade: Optional[str] = Query(None, description="按等级过滤 S/A/B/C"),
    month: Optional[str] = Query(None, description="数据月份"),
    limit: int = Query(20, ge=1, le=200, description="返回条数"),
):
    """获取卖家画像列表。

    按 marketplace + grade + month 过滤，返回聪明卖家评分排名。
    Java 端点: GET /api/v1/seller/profiles
    """
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # 尝试从 Java 获取预计算的卖家画像
        # 如端点未就绪，返回降级提示
        return {
            "status": "degraded",
            "experimental": True,
            "marketplace": marketplace,
            "profiles": [],
            "total": 0,
            "message": (
                "卖家画像由月度扫描任务(每月1号05:00)生成后存储于 Java 后端。"
                "请确认月度扫描已完成或手动触发 POST /seller/scan。"
            ),
        }
    except Exception as e:
        logger.error(f"获取卖家画像失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles/{seller_name}")
async def get_seller_detail(
    seller_name: str,
    marketplace: str = Query("UK"),
):
    """获取单个卖家详细画像。

    包含3维评分明细 + 品类专注度 + 商品列表。
    """
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        return {
            "status": "degraded",
            "experimental": True,
            "seller_name": seller_name,
            "marketplace": marketplace,
            "profile": None,
            "message": (
                "卖家详情需 Java 端点 GET /api/v1/seller/profiles/{name} 支持。"
            ),
        }
    except Exception as e:
        logger.error(f"获取卖家详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/heat-matrix")
async def get_heat_matrix(
    marketplace: str = Query("UK"),
    month: Optional[str] = Query(None),
    sort_by: str = Query("smart_density", description="排序字段 smart_density/dengzong_count"),
):
    """获取品类热度矩阵。

    返回品类×卖家交叉热度数据，按聪明卖家密度降序排列。

    Java 端点: GET /api/v1/seller/heat-matrix
    """
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        return {
            "status": "degraded",
            "experimental": True,
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "heat_matrix": [],
            "total_categories": 0,
            "message": (
                "品类热度矩阵由月度扫描任务生成后存储于 Java 后端。"
            ),
        }
    except Exception as e:
        logger.error(f"获取热度矩阵失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/follow-signals")
async def get_follow_signals(
    marketplace: str = Query("UK"),
    month: Optional[str] = Query(None),
    signal_strength: Optional[str] = Query(None, description="过滤信号强度 strong/moderate/weak"),
    limit: int = Query(30, ge=1, le=200),
):
    """获取跟品信号列表。

    返回跨店铺ASIN追踪信号，按信号强度降序。

    Java 端点: GET /api/v1/seller/follow-signals
    """
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        return {
            "status": "degraded",
            "experimental": True,
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "signals": [],
            "total": 0,
            "message": (
                "跟品信号由月度扫描任务生成后存储于 Java 后端。"
            ),
        }
    except Exception as e:
        logger.error(f"获取跟品信号失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations")
async def get_smart_recommendations(
    marketplace: str = Query("UK"),
    rec_type: Optional[str] = Query(
        None, description="推荐类型 smart_consensus/dengzong_validated/blind_spot/follow_accel"
    ),
    limit: int = Query(20, ge=1, le=100),
):
    """获取智能推荐列表。

    返回交叉分析产出的智能推荐，按推荐度降序。

    Java 端点: GET /api/v1/seller/recommendations
    """
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        return {
            "status": "degraded",
            "experimental": True,
            "marketplace": marketplace,
            "recommendations": [],
            "total": 0,
            "message": (
                "智能推荐由月度扫描任务生成后存储于 Java 后端。"
            ),
        }
    except Exception as e:
        logger.error(f"获取智能推荐失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan")
async def trigger_seller_scan(
    marketplace: str = Body("UK", embed=True),
    month: Optional[str] = Body(None, embed=True),
):
    """手动触发全量卖家画像扫描。

    启动月度全量扫描管道:
      1. Java 拉取全量卖家商品
      2. 计算商品实力分 + 聪明卖家评分
      3. 品类热度矩阵 + 跟品信号 + 智能推荐
      4. 回写 Java

    返回扫描结果摘要。
    """
    try:
        from selection.tasks.seller_scan import run_seller_scan

        logger.info(f"[API] 手动触发卖家扫描: {marketplace}/{month}")
        result = await run_seller_scan(marketplace=marketplace, month=month)

        return result
    except Exception as e:
        logger.error(f"卖家扫描失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
