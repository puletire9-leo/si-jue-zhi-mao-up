"""
[参考] 导出功能API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ExportController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from typing import Optional
import logging
import os
import pandas as pd
from io import BytesIO

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["导出功能"])


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


@router.get("/products", summary="导出产品")
async def export_products(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(100, ge=1, le=1000, description="每页数量"),
    format: str = Query("xlsx", description="导出格式：xlsx/csv"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    导出产品数据
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认100，最大1000）
    - **format**: 导出格式（默认xlsx，可选csv）
    
    返回Excel或CSV文件
    """
    try:
        offset = (page - 1) * size
        
        # 查询产品数据
        products = await repo.execute_query(
            f"""
            SELECT 
                sku, name, type, description, category, 
                tags, price, stock, image, created_at, updated_at
            FROM products
            ORDER BY created_at DESC
            LIMIT {size} OFFSET {offset}
            """
        )
        
        # 转换为DataFrame
        df = pd.DataFrame(products)
        
        # 生成文件
        if format == "csv":
            output = BytesIO()
            df.to_csv(output, index=False, encoding='utf-8-sig')
            output.seek(0)
            
            from fastapi.responses import Response
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=products.csv"}
            )
        else:
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='产品列表')
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=products.xlsx"}
            )
        
    except Exception as e:
        logger.error(f"导出产品失败: {e}")
        raise HTTPException(status_code=500, detail="导出产品失败")


@router.get("/images", summary="导出图片")
async def export_images(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(100, ge=1, le=1000, description="每页数量"),
    format: str = Query("xlsx", description="导出格式：xlsx/csv"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    导出图片数据
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认100，最大1000）
    - **format**: 导出格式（默认xlsx，可选csv）
    
    返回Excel或CSV文件
    """
    try:
        offset = (page - 1) * size
        
        # 查询图片数据
        images = await repo.execute_query(
            f"""
            SELECT 
                id, filename, filepath, category, tags, 
                description, width, height, format, file_size, created_at
            FROM images
            ORDER BY created_at DESC
            LIMIT {size} OFFSET {offset}
            """
        )
        
        # 转换为DataFrame
        df = pd.DataFrame(images)
        
        # 生成文件
        if format == "csv":
            output = BytesIO()
            df.to_csv(output, index=False, encoding='utf-8-sig')
            output.seek(0)
            
            from fastapi.responses import Response
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=images.csv"}
            )
        else:
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='图片列表')
            output.seek(0)
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=images.xlsx"}
            )
        
    except Exception as e:
        logger.error(f"导出图片失败: {e}")
        raise HTTPException(status_code=500, detail="导出图片失败")


@router.get("/statistics", summary="导出统计")
async def export_statistics(
    repo: MySQLRepository = get_mysql_repo()
):
    """
    导出统计数据
    
    返回包含产品、图片、用户统计的Excel文件
    """
    try:
        # 获取产品统计
        product_stats = await repo.execute_query(
            """
            SELECT 
                type as '产品类型',
                COUNT(*) as '数量'
            FROM products
            GROUP BY type
            """
        )
        
        # 获取图片统计
        image_stats = await repo.execute_query(
            """
            SELECT 
                category as '图片分类',
                COUNT(*) as '数量',
                SUM(file_size) as '总大小(字节)'
            FROM images
            GROUP BY category
            """
        )
        
        # 获取用户统计
        user_stats = await repo.execute_query(
            """
            SELECT 
                role as '用户角色',
                COUNT(*) as '数量'
            FROM users
            GROUP BY role
            """
        )
        
        # 创建Excel文件
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            pd.DataFrame(product_stats).to_excel(writer, index=False, sheet_name='产品统计')
            pd.DataFrame(image_stats).to_excel(writer, index=False, sheet_name='图片统计')
            pd.DataFrame(user_stats).to_excel(writer, index=False, sheet_name='用户统计')
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=statistics.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"导出统计失败: {e}")
        raise HTTPException(status_code=500, detail="导出统计失败")
