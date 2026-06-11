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
    """获取卖家画像列表。从 Java seller_profiles 表实时查询。"""
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # /api/v1/seller/profiles-by-category?marketplace=UK
        raw = await client._request_with_retry(
            "GET",
            f"{client.base_url}/api/v1/seller/profiles-by-category",
            params={"marketplace": marketplace},
        )
        data = raw.json()
        # Java Result<T> 解包
        if isinstance(data, dict) and "data" in data and "code" in data:
            data = data["data"] or []

        profiles = data if isinstance(data, list) else []

        # 客户端过滤
        if grade:
            profiles = [p for p in profiles if p.get("grade") == grade]
        if month:
            profiles = [p for p in profiles if p.get("month") == month]

        # 限制数量
        profiles = profiles[:limit]

        return {
            "status": "ok",
            "marketplace": marketplace,
            "profiles": profiles,
            "total": len(profiles),
        }
    except Exception as e:
        logger.error(f"获取卖家画像失败: {e}")
        # 降级：直接查 seller_profiles 表
        return {
            "status": "error",
            "marketplace": marketplace,
            "profiles": [],
            "total": 0,
            "error": str(e),
        }


@router.get("/profiles/{seller_name}")
async def get_seller_detail(
    seller_name: str,
    marketplace: str = Query("UK"),
):
    """获取单个卖家详细画像。"""
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        raw = await client._request_with_retry(
            "GET",
            f"{client.base_url}/api/v1/seller/profiles-by-category",
            params={"marketplace": marketplace},
        )
        data = raw.json()
        if isinstance(data, dict) and "data" in data and "code" in data:
            data = data["data"] or []

        profiles = data if isinstance(data, list) else []
        match = next((p for p in profiles if p.get("sellerName") == seller_name), None)

        return {
            "status": "ok" if match else "not_found",
            "seller_name": seller_name,
            "marketplace": marketplace,
            "profile": match,
        }
    except Exception as e:
        logger.error(f"获取卖家详情失败: {e}")
        return {
            "status": "error",
            "seller_name": seller_name,
            "marketplace": marketplace,
            "profile": None,
            "error": str(e),
        }


@router.get("/heat-matrix")
async def get_heat_matrix(
    marketplace: str = Query("UK"),
    month: Optional[str] = Query(None),
    sort_by: str = Query("smart_density", description="排序字段 smart_density/dengzong_count"),
):
    """获取品类热度矩阵。从 Java category_heat_matrix 表查询。"""
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # 直接用 httpx 查 Java（避免新增 java_client 方法）
        import httpx
        async with httpx.AsyncClient(timeout=10) as hc:
            resp = await hc.get(
                f"{client.base_url}/api/v1/seller/heat-matrix",
                params={"marketplace": marketplace},
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []

        rows = data if isinstance(data, list) else []

        # 排序
        if sort_by == "dengzong_count":
            rows.sort(key=lambda r: r.get("dengzongCount", 0) or 0, reverse=True)
        else:
            rows.sort(key=lambda r: float(r.get("smartDensity", 0) or 0), reverse=True)

        return {
            "status": "ok",
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "heat_matrix": rows,
            "total_categories": len(rows),
        }
    except Exception as e:
        logger.warning(f"获取热度矩阵失败（可能无缓存数据）: {e}")
        return {
            "status": "degraded",
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "heat_matrix": [],
            "total_categories": 0,
            "message": f"品类热度矩阵需先执行 POST /seller/scan。错误: {e}",
        }


@router.get("/follow-signals")
async def get_follow_signals(
    marketplace: str = Query("UK"),
    month: Optional[str] = Query(None),
    signal_strength: Optional[str] = Query(None, description="过滤信号强度 strong/moderate/weak"),
    limit: int = Query(30, ge=1, le=200),
):
    """获取跟品信号列表。从 Java follow_signals 表查询。"""
    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        import httpx
        async with httpx.AsyncClient(timeout=10) as hc:
            resp = await hc.get(
                f"{client.base_url}/api/v1/seller/follow-signals",
                params={"marketplace": marketplace},
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []

        signals = data if isinstance(data, list) else []

        if signal_strength:
            signals = [s for s in signals if s.get("signalStrength") == signal_strength]

        signals = signals[:limit]

        return {
            "status": "ok",
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "signals": signals,
            "total": len(signals),
        }
    except Exception as e:
        logger.warning(f"获取跟品信号失败: {e}")
        return {
            "status": "degraded",
            "marketplace": marketplace,
            "month": month or datetime.now().strftime("%Y-%m"),
            "signals": [],
            "total": 0,
            "message": f"跟品信号需先执行 POST /seller/scan。错误: {e}",
        }


@router.get("/recommendations")
async def get_smart_recommendations(
    marketplace: str = Query("UK"),
    rec_type: Optional[str] = Query(
        None, description="推荐类型 smart_consensus/dengzong_validated/blind_spot/follow_accel"
    ),
    limit: int = Query(20, ge=1, le=100),
):
    """获取智能推荐列表。基于热度矩阵 + 跟品信号 + 蓝海数据实时生成。"""
    try:
        from selection.java_client import get_java_client
        client = get_java_client()
        import httpx

        recommendations = []

        async with httpx.AsyncClient(timeout=15) as hc:
            # 1. 获取热度矩阵
            try:
                resp = await hc.get(
                    f"{client.base_url}/api/v1/seller/heat-matrix",
                    params={"marketplace": marketplace},
                )
                heat_data = resp.json()
                if isinstance(heat_data, dict) and "data" in heat_data:
                    heat_data = heat_data["data"] or []
                heat_rows = heat_data if isinstance(heat_data, list) else []
            except Exception:
                heat_rows = []

            # 2. 获取跟品信号
            try:
                resp = await hc.get(
                    f"{client.base_url}/api/v1/seller/follow-signals",
                    params={"marketplace": marketplace},
                )
                sig_data = resp.json()
                if isinstance(sig_data, dict) and "data" in sig_data:
                    sig_data = sig_data["data"] or []
                signals = sig_data if isinstance(sig_data, list) else []
            except Exception:
                signals = []

        # 基于数据生成推荐
        # smart_consensus: 热度高的品类
        for row in heat_rows[:10]:
            density = float(row.get("smartDensity", 0) or 0)
            if density > 0.3:
                recommendations.append({
                    "rec_type": "smart_consensus",
                    "category": row.get("category"),
                    "sellers": [],
                    "reason": f"聪明卖家密度高 ({density:.2f})",
                    "score": density,
                })

        # dengzong_validated: 郑总店铺数量多的品类
        for row in heat_rows:
            dz_count = row.get("dengzongCount", 0) or 0
            if dz_count >= 3:
                recommendations.append({
                    "rec_type": "dengzong_validated",
                    "category": row.get("category"),
                    "sellers": [],
                    "reason": f"郑总店铺 {dz_count} 家验证",
                    "score": min(dz_count / 10.0, 1.0),
                })

        # follow_accel: 跟品信号加速
        for sig in signals[:10]:
            strength = sig.get("signalStrength", "")
            if strength in ("strong", "moderate"):
                recommendations.append({
                    "rec_type": "follow_accel",
                    "category": sig.get("category"),
                    "sellers": [sig.get("firstSeller", "")],
                    "reason": f"跟品信号: {sig.get('followerCount', 0)} 跟随者",
                    "score": 0.7 if strength == "strong" else 0.5,
                })

        # 按分数排序并去重
        seen = set()
        unique_recs = []
        for r in sorted(recommendations, key=lambda x: x["score"], reverse=True):
            key = f"{r['rec_type']}:{r['category']}"
            if key not in seen:
                seen.add(key)
                unique_recs.append(r)

        # 类型过滤
        if rec_type:
            unique_recs = [r for r in unique_recs if r["rec_type"] == rec_type]

        return {
            "status": "ok",
            "marketplace": marketplace,
            "recommendations": unique_recs[:limit],
            "total": len(unique_recs[:limit]),
        }

    except Exception as e:
        logger.error(f"生成推荐失败: {e}")
        return {
            "status": "error",
            "marketplace": marketplace,
            "recommendations": [],
            "total": 0,
            "error": str(e),
        }


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
