"""
[参考] 产品数据API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ProductDataController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, Query, Request, Response
from typing import Optional, List
import asyncio
from ...schemas.product_data import (
    CategoryStatsResponse, ProductListResponse, TrendResponse, 
    TopProductsResponse, FilterOptionsResponse, AdPerformanceResponse
)
from ...services.product_data_service import ProductDataService
import urllib.parse

router = APIRouter(prefix="/product-data", tags=["产品数据看板"])

def get_product_service(request: Request) -> ProductDataService:
    return ProductDataService(
        mysql=request.app.state.mysql,
        redis=getattr(request.app.state, 'redis', None)
    )

@router.get("/available-months", response_model=List[str])
async def get_available_months(
    service: ProductDataService = Depends(get_product_service)
):
    """获取所有可用的数据月份"""
    return await service.get_available_months()

@router.get("/category-stats", response_model=CategoryStatsResponse)
async def get_category_stats(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    month: Optional[str] = Query(None, description="月份 (YYYY-MM) - 兼容旧版"),
    store: Optional[str] = None,
    country: Optional[str] = None,
    developer: Optional[str] = None,
    service: ProductDataService = Depends(get_product_service)
):
    """获取分类统计卡片数据"""
    return await service.get_category_stats(start_date, end_date, month, store, country, developer)

@router.get("/products", response_model=ProductListResponse)
async def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store: Optional[str] = None,
    country: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None,
    developer: Optional[str] = None,
    search_keyword: Optional[str] = None,
    sort_field: Optional[str] = Query('sales_amount', description="排序字段"),
    sort_order: Optional[str] = Query('desc', description="排序顺序 (asc/desc)"),
    service: ProductDataService = Depends(get_product_service)
):
    """获取分页产品明细"""
    return await service.get_products(
        page, page_size, start_date, end_date, store, country, category, month, developer, search_keyword,
        sort_field, sort_order
    )

@router.get("/export")
async def export_products(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store: Optional[str] = None,
    country: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None,
    developer: Optional[str] = None,
    search_keyword: Optional[str] = None,
    fields: Optional[List[str]] = Query(None),
    service: ProductDataService = Depends(get_product_service)
):
    """导出产品数据为 CSV"""
    content = await service.export_products(
        start_date, end_date, store, country, category, month, developer, search_keyword, fields
    )
    
    filename = f"product_data_{start_date or month or 'all'}.csv"
    encoded_filename = urllib.parse.quote(filename)
    
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )

@router.get("/sales-trend", response_model=TrendResponse)
async def get_sales_trend(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    time_dimension: Optional[str] = Query('day', description="时间维度 (day/week/month)"),
    months: int = Query(6, ge=1, le=12),
    category: Optional[str] = None,
    store: Optional[str] = None,
    country: Optional[str] = None,
    developer: Optional[str] = None,
    service: ProductDataService = Depends(get_product_service)
):
    """获取销售趋势图数据"""
    return await service.get_sales_trend(start_date, end_date, time_dimension, months, category, store, country, developer)

@router.get("/top-products", response_model=TopProductsResponse)
async def get_top_products(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    store: Optional[str] = None,
    country: Optional[str] = None,
    developer: Optional[str] = None,
    service: ProductDataService = Depends(get_product_service)
):
    """获取TOP产品数据"""
    return await service.get_top_products(start_date, end_date, limit, category, store, country, developer)

@router.get("/filter-options", response_model=FilterOptionsResponse)
async def get_filter_options(
    service: ProductDataService = Depends(get_product_service)
):
    """动态获取筛选列表选项"""
    return await service.get_filter_options()

@router.get("/ad-performance", response_model=AdPerformanceResponse)
async def get_ad_performance(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = None,
    store: Optional[str] = None,
    country: Optional[str] = None,
    developer: Optional[str] = None,
    service: ProductDataService = Depends(get_product_service)
):
    """获取广告表现数据"""
    return await service.get_ad_performance(start_date, end_date, category, store, country, developer)


@router.post("/clear-cache")
async def clear_cache(
    service: ProductDataService = Depends(get_product_service)
):
    """清除产品数据相关的Redis缓存"""
    if service.redis:
        # 清除所有 product_data: 开头的缓存
        count = await service.redis.cache_clear("product_data:*")
        return {"message": f"已清除 {count} 个缓存"}
    return {"message": "Redis 未启用，无需清除缓存"}


# 所有分类列表（与前端CATEGORY_CONFIG保持一致）
ALL_CATEGORIES = [
    'Garden', 'Home & Kitchen', 'DIY & Tools', 'Toys & Games',
    'Sports & Outdoors', 'Automotive', 'Fashion', 'Beauty',
    'Pet Supplies', 'Stationery & Office Supplies', 'Health & Personal Care',
    'Business, Industry & Science', 'Baby Products', 'Grocery',
    'Lighting', 'Electronics & Photo', 'Computers & Accessories',
    'Musical Instruments & DJ', 'PC & Video Games', 'Books', '无排名'
]


@router.get("/compare-data")
async def get_compare_data(
    current_start_date: Optional[str] = Query(None, description="本期开始日期 (YYYY-MM-DD)"),
    current_end_date: Optional[str] = Query(None, description="本期结束日期 (YYYY-MM-DD)"),
    compare_start_date: Optional[str] = Query(None, description="对比期开始日期 (YYYY-MM-DD)"),
    compare_end_date: Optional[str] = Query(None, description="对比期结束日期 (YYYY-MM-DD)"),
    category: Optional[str] = None,
    store: Optional[str] = None,
    country: Optional[str] = None,
    developer: Optional[str] = None,
    service: ProductDataService = Depends(get_product_service)
):
    """获取对比数据 - 同时查询本期和对比期的数据"""
    # 并行查询本期和对比期数据
    current_stats, compare_stats = await asyncio.gather(
        service.get_category_stats(current_start_date, current_end_date, None, store, country, developer),
        service.get_category_stats(compare_start_date, compare_end_date, None, store, country, developer)
    )

    # 计算增长率
    def calculate_growth(current: float, compare: float) -> float:
        if compare == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - compare) / compare * 100, 2)

    # 提取 stats 列表（CategoryStatsResponse 对象有 .stats 属性）
    current_stats_list = current_stats.stats if hasattr(current_stats, 'stats') else current_stats
    compare_stats_list = compare_stats.stats if hasattr(compare_stats, 'stats') else compare_stats

    # 创建分类数据字典，方便查找
    current_stats_dict = {getattr(s, 'category', ''): s for s in current_stats_list}
    compare_stats_dict = {getattr(s, 'category', ''): s for s in compare_stats_list}

    # 补全所有分类数据
    def fill_category_stats(stats_dict):
        """补全缺失的分类数据，确保返回所有分类"""
        filled_stats = []
        for cat in ALL_CATEGORIES:
            if cat in stats_dict:
                stat = stats_dict[cat]
                filled_stats.append({
                    'category': cat,
                    'productCount': getattr(stat, 'productCount', 0),
                    'totalSalesVolume': getattr(stat, 'totalSalesVolume', 0),
                    'totalSalesAmount': getattr(stat, 'totalSalesAmount', 0),
                    'totalOrderQuantity': getattr(stat, 'totalOrderQuantity', 0),
                    'totalAdSpend': getattr(stat, 'totalAdSpend', 0),
                    'totalAdSales': getattr(stat, 'totalAdSales', 0),
                    'avgAcoas': getattr(stat, 'avgAcoas', 0),
                    'avgRoas': getattr(stat, 'avgRoas', 0),
                    'avgCvr': getattr(stat, 'avgCvr', 0),
                    'orderRate': getattr(stat, 'orderRate', 0),
                })
            else:
                # 分类无数据，填充默认值
                filled_stats.append({
                    'category': cat,
                    'productCount': 0,
                    'totalSalesVolume': 0,
                    'totalSalesAmount': 0,
                    'totalOrderQuantity': 0,
                    'totalAdSpend': 0,
                    'totalAdSales': 0,
                    'avgAcoas': 0,
                    'avgRoas': 0,
                    'avgCvr': 0,
                    'orderRate': 0,
                })
        return filled_stats

    # 补全本期和对比期的分类数据
    filled_current_stats = fill_category_stats(current_stats_dict)
    filled_compare_stats = fill_category_stats(compare_stats_dict)

    # 计算总体增长率
    current_total = {
        "product_count": sum(s['productCount'] for s in filled_current_stats),
        "sales_volume": sum(s['totalSalesVolume'] for s in filled_current_stats),
        "sales_amount": sum(s['totalSalesAmount'] for s in filled_current_stats),
        "order_quantity": sum(s['totalOrderQuantity'] for s in filled_current_stats),
        "ad_spend": sum(s['totalAdSpend'] for s in filled_current_stats),
        "ad_sales": sum(s['totalAdSales'] for s in filled_current_stats),
    }

    compare_total = {
        "product_count": sum(s['productCount'] for s in filled_compare_stats),
        "sales_volume": sum(s['totalSalesVolume'] for s in filled_compare_stats),
        "sales_amount": sum(s['totalSalesAmount'] for s in filled_compare_stats),
        "order_quantity": sum(s['totalOrderQuantity'] for s in filled_compare_stats),
        "ad_spend": sum(s['totalAdSpend'] for s in filled_compare_stats),
        "ad_sales": sum(s['totalAdSales'] for s in filled_compare_stats),
    }

    # 计算平均ACoAS
    current_acoas = (current_total["ad_spend"] / current_total["sales_amount"] * 100) if current_total["sales_amount"] > 0 else 0
    compare_acoas = (compare_total["ad_spend"] / compare_total["sales_amount"] * 100) if compare_total["sales_amount"] > 0 else 0

    # 计算平均ROAS
    current_roas = (current_total["ad_sales"] / current_total["ad_spend"]) if current_total["ad_spend"] > 0 else 0
    compare_roas = (compare_total["ad_sales"] / compare_total["ad_spend"]) if compare_total["ad_spend"] > 0 else 0

    growth_rates = {
        "product_count": calculate_growth(current_total["product_count"], compare_total["product_count"]),
        "sales_volume": calculate_growth(current_total["sales_volume"], compare_total["sales_volume"]),
        "sales_amount": calculate_growth(current_total["sales_amount"], compare_total["sales_amount"]),
        "order_quantity": calculate_growth(current_total["order_quantity"], compare_total["order_quantity"]),
        "ad_spend": calculate_growth(current_total["ad_spend"], compare_total["ad_spend"]),
        "acoas": round(current_acoas - compare_acoas, 2),
        "roas": round(current_roas - compare_roas, 2),
    }

    return {
        "current": {
            "stats": filled_current_stats,
            "total": current_total,
            "avg_acoas": round(current_acoas, 2),
            "avg_roas": round(current_roas, 2),
        },
        "compare": {
            "stats": filled_compare_stats,
            "total": compare_total,
            "avg_acoas": round(compare_acoas, 2),
            "avg_roas": round(compare_roas, 2),
        },
        "growth_rates": growth_rates,
    }
