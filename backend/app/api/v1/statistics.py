"""
[参考] 统计分析API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: StatisticsController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import logging

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/statistics", tags=["统计分析"])


def get_mysql_repo():
    """
    依赖注入：获取MySQL仓库实例
    
    Returns:
        MySQLRepository实例
    """
    from fastapi import Request
    
    def _get_repo(request: Request):
        return request.app.state.mysql
    
    return Depends(_get_repo)


@router.get("/dashboard", summary="获取仪表板统计数据")
async def get_dashboard_statistics(repo: MySQLRepository = get_mysql_repo()):
    """
    获取仪表板统计数据
    
    返回：
    - 产品总数
    - 图片总数
    - 用户总数
    - 存储使用量
    - 今日新增产品数
    - 今日新增图片数
    - 产品类型分布
    - 最近活跃用户
    """
    try:
        # 获取产品总数
        total_products = await repo.execute_query(
            "SELECT COUNT(*) as count FROM products"
        )
        total_products = total_products[0]['count'] if total_products else 0
        
        # 获取图片总数
        total_images = await repo.execute_query(
            "SELECT COUNT(*) as count FROM images"
        )
        total_images = total_images[0]['count'] if total_images else 0
        
        # 获取用户总数
        total_users = await repo.execute_query(
            "SELECT COUNT(*) as count FROM users"
        )
        total_users = total_users[0]['count'] if total_users else 0
        
        # 获取今日新增产品
        today_products = await repo.execute_query(
            "SELECT COUNT(*) as count FROM products WHERE DATE(created_at) = CURDATE()"
        )
        today_products = today_products[0]['count'] if today_products else 0
        
        # 获取今日新增图片
        today_images = await repo.execute_query(
            "SELECT COUNT(*) as count FROM images WHERE DATE(created_at) = CURDATE()"
        )
        today_images = today_images[0]['count'] if today_images else 0
        
        # 获取产品类型分布
        type_distribution = await repo.execute_query(
            "SELECT type, COUNT(*) as count FROM products GROUP BY type"
        )
        product_type_distribution = [
            {"type": row['type'], "count": row['count']}
            for row in type_distribution
        ]
        
        # 获取最近活跃用户
        recent_users = await repo.execute_query(
            "SELECT username, last_login_time FROM users ORDER BY last_login_time DESC LIMIT 5"
        )
        
        # 计算存储使用量（简化计算）
        total_storage_used_mb = total_images * 2.0  # 假设每张图片平均2MB
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "totalProducts": total_products,
                "totalImages": total_images,
                "totalUsers": total_users,
                "totalStorageUsedMb": round(total_storage_used_mb, 2),
                "todayProducts": today_products,
                "todayImages": today_images,
                "productTypeDistribution": product_type_distribution,
                "recentUsers": recent_users
            }
        }
        
    except Exception as e:
        logger.error(f"获取仪表板统计数据失败: {e}")
        raise HTTPException(status_code=500, detail="获取统计数据失败")





@router.get("/image-trend", summary="获取图片趋势")
async def get_image_trend(
    days: int = 30,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取图片趋势数据
    
    - **days**: 统计天数（默认30天）
    
    返回每日图片新增趋势
    """
    try:
        trend_data = await repo.execute_query(
            """
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM images 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
            """,
            (days,)
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": trend_data
        }
        
    except Exception as e:
        logger.error(f"获取图片趋势失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片趋势失败")


@router.get("/storage", summary="获取存储统计")
async def get_storage_statistics(repo: MySQLRepository = get_mysql_repo()):
    """
    获取存储统计信息
    
    返回存储空间使用情况
    """
    try:
        # 获取图片总数和总大小
        storage_stats = await repo.execute_query(
            """
            SELECT 
                COUNT(*) as count,
                SUM(file_size) as total_size
            FROM images
            """
        )
        
        count = storage_stats[0]['count'] if storage_stats else 0
        total_size = storage_stats[0]['total_size'] if storage_stats else 0
        
        # 计算总存储使用量（MB）
        total_storage_used_mb = round(total_size / 1024 / 1024, 2) if total_size else 0
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "totalImages": count,
                "totalStorageUsedMb": total_storage_used_mb,
                "totalStorageUsedBytes": total_size,
                "by_type": []
            }
        }
        
    except Exception as e:
        logger.error(f"获取存储统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取存储统计失败")





@router.get("/user-activity", summary="获取用户活动")
async def get_user_activity(
    days: int = 30,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    获取用户活动数据
    
    - **days**: 统计天数（默认30天）
    
    返回用户每日活动数据
    """
    try:
        activity_data = await repo.execute_query(
            """
            SELECT 
                DATE(last_login_time) as date,
                COUNT(*) as count
            FROM users 
            WHERE last_login_time >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY DATE(last_login_time)
            ORDER BY date ASC
            """,
            (days,)
        )
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "daily_activity": activity_data
            }
        }
        
    except Exception as e:
        logger.error(f"获取用户活动失败: {e}")
        raise HTTPException(status_code=500, detail="获取用户活动失败")


@router.get("/image-quality", summary="获取图片质量统计")
async def get_image_quality_statistics(repo: MySQLRepository = get_mysql_repo()):
    """
    获取图片质量统计信息
    
    返回图片分辨率分布和质量统计
    """
    try:
        # 获取分辨率分布
        resolution_stats = await repo.execute_query(
            """
            SELECT 
                CASE 
                    WHEN width < 500 THEN '< 500px'
                    WHEN width < 1000 THEN '500-1000px'
                    WHEN width < 2000 THEN '1000-2000px'
                    ELSE '> 2000px'
                END as resolution_range,
                COUNT(*) as count
            FROM images
            GROUP BY resolution_range
            """
        )
        
        resolution_distribution = [
            {"range": row['resolution_range'], "count": row['count']}
            for row in resolution_stats
        ]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "resolution_distribution": resolution_distribution
            }
        }
        
    except Exception as e:
        logger.error(f"获取图片质量统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片质量统计失败")
