"""
[参考] 评分引擎API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ScoringController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
import logging
import json
import aiomysql
from datetime import datetime, timedelta

from ...models.scoring import (
    ScoringConfigItem,
    GradeThresholdItem,
    ScoringConfigResponse,
    ScoringConfigUpdateRequest,
    RecalculateRequest,
    RecalculateResponse,
    GradeStatsItem,
)
from ...services.scoring_engine import ScoringEngine
from ...services.selection_service import SelectionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scoring", tags=["评分管理"])


def get_mysql():
    from fastapi import Request
    def _get_mysql(request: Request):
        return request.app.state.mysql
    return Depends(_get_mysql)


@router.get("/config", summary="获取评分配置")
async def get_scoring_config(mysql=get_mysql()):
    """获取评分维度配置和等级阈值"""
    try:
        # 获取维度配置
        dim_query = "SELECT id, dimension_key, display_name, weight, thresholds, is_active, updated_at FROM scoring_config ORDER BY id"
        dimensions = await mysql.execute_query(dim_query)

        # 获取等级阈值
        grade_query = "SELECT id, grade, min_score, max_score, color, updated_at FROM grade_thresholds ORDER BY min_score DESC"
        grades = await mysql.execute_query(grade_query)

        dim_list = []
        for d in dimensions:
            thresholds = d['thresholds']
            if isinstance(thresholds, str):
                thresholds = json.loads(thresholds)
            dim_list.append(ScoringConfigItem(
                id=d['id'],
                dimensionKey=d['dimension_key'],
                displayName=d['display_name'],
                weight=float(d['weight']),
                thresholds=thresholds,
                isActive=bool(d['is_active']),
                updatedAt=d.get('updated_at')
            ))

        grade_list = []
        for g in grades:
            grade_list.append(GradeThresholdItem(
                id=g['id'],
                grade=g['grade'],
                minScore=g['min_score'],
                maxScore=g['max_score'],
                color=g.get('color'),
                updatedAt=g.get('updated_at')
            ))

        config_data = ScoringConfigResponse(dimensions=dim_list, grade_thresholds=grade_list)
        return {"code": 200, "message": "获取成功", "data": config_data.model_dump(by_alias=True)}

    except Exception as e:
        logger.error(f"获取评分配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取评分配置失败: {str(e)}")


@router.put("/config", summary="更新评分配置")
async def update_scoring_config(request: ScoringConfigUpdateRequest, mysql=get_mysql()):
    """更新评分维度配置和/或等级阈值"""
    try:
        async with mysql.get_connection() as conn:
            async with conn.cursor() as cursor:
                await conn.begin()
                try:
                    # 更新维度配置
                    if request.dimensions:
                        for dim in request.dimensions:
                            thresholds_json = json.dumps(
                                [t.model_dump() if hasattr(t, 'model_dump') else t.dict() for t in dim.thresholds],
                                ensure_ascii=False
                            )
                            await cursor.execute(
                                """INSERT INTO scoring_config (dimension_key, display_name, weight, thresholds, is_active)
                                   VALUES (%s, %s, %s, %s, %s)
                                   ON DUPLICATE KEY UPDATE
                                   display_name=VALUES(display_name), weight=VALUES(weight),
                                   thresholds=VALUES(thresholds), is_active=VALUES(is_active)""",
                                (dim.dimension_key, dim.display_name, dim.weight, thresholds_json, int(dim.is_active))
                            )

                    # 更新等级阈值
                    if request.grade_thresholds:
                        for g in request.grade_thresholds:
                            await cursor.execute(
                                """INSERT INTO grade_thresholds (grade, min_score, max_score, color)
                                   VALUES (%s, %s, %s, %s)
                                   ON DUPLICATE KEY UPDATE
                                   min_score=VALUES(min_score), max_score=VALUES(max_score), color=VALUES(color)""",
                                (g.grade, g.min_score, g.max_score, g.color)
                            )

                    await conn.commit()

                    # 清除评分引擎缓存
                    engine = ScoringEngine(mysql)
                    engine.invalidate_cache()

                    return {"code": 200, "message": "评分配置更新成功"}

                except Exception as e:
                    await conn.rollback()
                    raise

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新评分配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新评分配置失败: {str(e)}")


@router.post("/recalculate", summary="重新评分")
async def recalculate_scores(request: RecalculateRequest, mysql=get_mysql()):
    """重新评分所有数据或仅本周数据"""
    try:
        engine = ScoringEngine(mysql)
        await engine.load_config()

        # 先根据 created_at 更新 week_tag 和 is_current
        await _update_week_tags(mysql, engine)

        # 查询需要评分的数据
        if request.scope == "current_week":
            query = """SELECT id, asin, delivery_method, listing_date, sales_volume,
                       main_category_rank, price FROM selection_products WHERE is_current = 1"""
        else:
            query = """SELECT id, asin, delivery_method, listing_date, sales_volume,
                       main_category_rank, price FROM selection_products"""

        products = await mysql.execute_query(query)

        if not products:
            return {"code": 200, "message": "无需评分", "data": {"totalScored": 0, "gradeStats": []}}

        # 批量计算评分
        results = await engine.score_products_batch(products)

        # 批量更新
        async with mysql.get_connection() as conn:
            async with conn.cursor() as cursor:
                await conn.begin()
                try:
                    for r in results:
                        await cursor.execute(
                            "UPDATE selection_products SET score = %s, grade = %s WHERE id = %s",
                            (r['score'], r['grade'], r['id'])
                        )
                    await conn.commit()
                except Exception as e:
                    await conn.rollback()
                    raise

        # 统计各等级数量
        stats = await _get_grade_stats(mysql, request.scope)

        stats_data = [{"grade": s.grade, "count": s.count, "color": s.color} for s in stats]
        return {"code": 200, "message": "重新评分成功", "data": {"totalScored": len(results), "gradeStats": stats_data}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重新评分失败: {e}")
        raise HTTPException(status_code=500, detail=f"重新评分失败: {str(e)}")


@router.post("/score-current-week", summary="评分本周数据")
async def score_current_week(mysql=get_mysql()):
    """对本周未评分的数据进行评分"""
    try:
        engine = ScoringEngine(mysql)
        await engine.load_config()

        # 先根据 created_at 更新 week_tag 和 is_current
        await _update_week_tags(mysql, engine)

        # 查询本周未评分的数据
        query = """SELECT id, asin, delivery_method, listing_date, sales_volume,
                   main_category_rank, price FROM selection_products
                   WHERE is_current = 1 AND (score IS NULL OR grade IS NULL)"""
        products = await mysql.execute_query(query)

        if not products:
            stats = await _get_grade_stats(mysql, "current_week")
            stats_data = [{"grade": s.grade, "count": s.count, "color": s.color} for s in stats]
            return {"code": 200, "message": "本周无需评分的数据", "data": {"totalScored": 0, "gradeStats": stats_data}}

        # 批量计算评分
        results = await engine.score_products_batch(products)

        # 批量更新
        async with mysql.get_connection() as conn:
            async with conn.cursor() as cursor:
                await conn.begin()
                try:
                    for r in results:
                        await cursor.execute(
                            "UPDATE selection_products SET score = %s, grade = %s WHERE id = %s",
                            (r['score'], r['grade'], r['id'])
                        )
                    await conn.commit()
                except Exception as e:
                    await conn.rollback()
                    raise

        stats = await _get_grade_stats(mysql, "current_week")
        stats_data = [{"grade": s.grade, "count": s.count, "color": s.color} for s in stats]
        return {"code": 200, "message": "评分完成", "data": {"totalScored": len(results), "gradeStats": stats_data}}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"评分本周数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"评分本周数据失败: {str(e)}")


@router.get("/grade-stats", summary="等级统计")
async def get_grade_stats(scope: str = "all", mysql=get_mysql()):
    """获取各等级数量统计"""
    try:
        stats = await _get_grade_stats(mysql, scope)
        stats_data = [{"grade": s.grade, "count": s.count, "color": s.color} for s in stats]
        return {"code": 200, "message": "获取成功", "data": {"gradeStats": stats_data}}
    except Exception as e:
        logger.error(f"获取等级统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取等级统计失败: {str(e)}")


async def _update_week_tags(mysql, engine):
    """根据 created_at 更新所有产品的 week_tag 和 is_current"""
    # 计算本周的 ISO 周标记
    week_tag = await engine.get_current_week_tag()

    # 计算本周一的日期（ISO 周一开始）
    now = datetime.now()
    iso_year, iso_week, iso_weekday = now.isocalendar()
    monday = now - timedelta(days=iso_weekday - 1)
    monday_str = monday.strftime('%Y-%m-%d')

    # 将所有 created_at >= 本周一 的产品标记为本周
    async with mysql.get_connection() as conn:
        async with conn.cursor() as cursor:
            await conn.begin()
            try:
                # 先将所有 is_current 重置为 0
                await cursor.execute("UPDATE selection_products SET is_current = 0")

                # 根据 created_at 标记本周产品
                await cursor.execute(
                    """UPDATE selection_products
                       SET week_tag = %s, is_current = 1
                       WHERE created_at >= %s""",
                    (week_tag, monday_str)
                )
                updated = cursor.rowcount
                await conn.commit()
                logger.info(f"周标记更新完成：{updated} 条产品标记为本周 ({week_tag})")
            except Exception as e:
                await conn.rollback()
                logger.error(f"更新周标记失败: {e}")
                raise


async def _get_grade_stats(mysql, scope: str = "all") -> List[GradeStatsItem]:
    """内部方法：获取等级统计"""
    # 先获取颜色映射
    color_query = "SELECT grade, color FROM grade_thresholds"
    color_rows = await mysql.execute_query(color_query)
    color_map = {r['grade']: r['color'] for r in color_rows}

    # 统计各等级数量
    where = "WHERE grade IS NOT NULL"
    if scope == "current_week":
        where += " AND is_current = 1"

    query = f"""
        SELECT grade, COUNT(*) as count
        FROM selection_products
        {where}
        GROUP BY grade
        ORDER BY FIELD(grade, 'S', 'A', 'B', 'C', 'D')
    """
    rows = await mysql.execute_query(query)

    return [
        GradeStatsItem(
            grade=r['grade'],
            count=r['count'],
            color=color_map.get(r['grade'])
        )
        for r in rows
    ]
