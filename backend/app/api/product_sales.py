"""
产品销量数据 API 路由
"""
from typing import List, Optional
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.responses import JSONResponse

from ..models.product_sales import (
    SearchResponse,
    WeeklySalesResponse,
    ShopInfo,
    DateRangeResponse,
    PeriodComparisonRequest,
    PeriodComparisonResponse,
    PeriodData,
    DailyTrendResponse,
    PeriodTrendComparisonResponse,
    DeclineAnalysisResponse
)
from ..services.product_sales_service import get_product_sales_service, ProductSalesService

router = APIRouter(prefix="/api/products", tags=["product-sales"])


@router.get("/search", response_model=SearchResponse)
async def search_products(
    q: Optional[str] = Query(None, description="搜索关键词（ASIN/标题/SKU/MSKU）"),
    shops: Optional[str] = Query(None, description="店铺筛选，逗号分隔"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="分页偏移"),
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    搜索产品
    
    支持模糊搜索 ASIN、标题、SKU、MSKU
    返回最多50个产品，按销量排序
    """
    try:
        # 解析店铺参数
        shop_list = None
        if shops:
            shop_list = [s.strip() for s in shops.split(',') if s.strip()]
        
        result = service.search_products(
            keyword=q,
            shops=shop_list,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"数据文件不存在: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.get("/weekly", response_model=WeeklySalesResponse)
async def get_weekly_sales(
    asins: str = Query(..., description="ASIN列表，逗号分隔"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    shops: Optional[str] = Query(None, description="店铺筛选，逗号分隔"),
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    获取产品的周销量数据
    
    支持多产品对比（最多10个ASIN）
    返回每周的销量和销售额
    """
    try:
        # 解析ASIN列表
        asin_list = [a.strip() for a in asins.split(',') if a.strip()]
        
        if not asin_list:
            raise HTTPException(status_code=400, detail="ASIN参数不能为空")
        
        if len(asin_list) > 100:
            raise HTTPException(status_code=400, detail="最多同时查询100个产品")
        
        # 解析店铺参数
        shop_list = None
        if shops:
            shop_list = [s.strip() for s in shops.split(',') if s.strip()]
        
        result = service.get_weekly_sales(
            asins=asin_list,
            start_date=start_date,
            end_date=end_date,
            shops=shop_list
        )
        
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"数据文件不存在: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取周销量失败: {str(e)}")


@router.get("/shops", response_model=List[ShopInfo])
async def get_shops(
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    获取所有店铺列表
    """
    try:
        shops = service.get_shops()
        return [ShopInfo(name=shop, product_count=0) for shop in shops]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取店铺列表失败: {str(e)}")


@router.get("/date-range", response_model=DateRangeResponse)
async def get_date_range(
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    获取数据的日期范围
    """
    try:
        min_date, max_date = service.get_date_range()
        
        # 计算周数
        total_weeks = 0
        if min_date and max_date:
            try:
                from datetime import datetime
                start = datetime.strptime(min_date, '%Y-%m-%d')
                end = datetime.strptime(max_date, '%Y-%m-%d')
                total_weeks = (end - start).days // 7 + 1
            except:
                pass
        
        return DateRangeResponse(
            min_date=min_date or "",
            max_date=max_date or "",
            total_weeks=total_weeks
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日期范围失败: {str(e)}")


@router.post("/period-comparison", response_model=PeriodComparisonResponse)
async def get_period_comparison(
    request: PeriodComparisonRequest,
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    双周期数据对比
    
    支持自由选择两个时间周期进行对比，返回销售、利润、广告、退款等完整数据
    """
    try:
        # 验证ASIN列表
        if not request.asins:
            raise HTTPException(status_code=400, detail="ASIN列表不能为空")
        
        if len(request.asins) > 100:
            raise HTTPException(status_code=400, detail="最多同时查询100个ASIN")
        
        # 验证日期参数
        if not request.period_a.get('start_date') or not request.period_a.get('end_date'):
            raise HTTPException(status_code=400, detail="周期A日期参数不完整")
        if not request.period_b.get('start_date') or not request.period_b.get('end_date'):
            raise HTTPException(status_code=400, detail="周期B日期参数不完整")
        
        # 获取周期A数据
        period_a_data = service.get_period_data(
            asins=request.asins,
            start_date=request.period_a['start_date'],
            end_date=request.period_a['end_date'],
            shops=request.shops,
            label="周期A"
        )
        
        # 获取周期B数据
        period_b_data = service.get_period_data(
            asins=request.asins,
            start_date=request.period_b['start_date'],
            end_date=request.period_b['end_date'],
            shops=request.shops,
            label="周期B"
        )
        
        # 计算变化百分比
        changes = {}
        metrics = ['orders', 'sales', 'revenue', 'gross_profit', 'settlement_profit', 
                   'ad_spend', 'ad_orders', 'refund_amount', 'refund_count']
        
        for metric in metrics:
            val_a = period_a_data.get(metric, 0)
            val_b = period_b_data.get(metric, 0)
            if val_a > 0:
                changes[metric] = round((val_b - val_a) / val_a * 100, 2)
            elif val_b > 0:
                changes[metric] = 100.0  # 从无到有，增长100%
            else:
                changes[metric] = 0.0
        
        # 比率变化（直接相减）
        rate_metrics = ['gross_profit_rate', 'settlement_profit_rate', 'ad_acos', 'refund_rate']
        for metric in rate_metrics:
            val_a = period_a_data.get(metric, 0)
            val_b = period_b_data.get(metric, 0)
            changes[metric] = round(val_b - val_a, 2)
        
        # 判断是否下滑（周期B销量 > 周期A销量表示下滑）
        is_declining = period_b_data['sales'] > period_a_data['sales']
        
        # 计算下滑百分比
        if period_a_data['sales'] > 0:
            decline_percent = round((period_b_data['sales'] - period_a_data['sales']) / period_a_data['sales'] * 100, 2)
        elif period_b_data['sales'] > 0:
            decline_percent = 100.0
        else:
            decline_percent = 0.0
        
        return PeriodComparisonResponse(
            period_a=PeriodData(**period_a_data),
            period_b=PeriodData(**period_b_data),
            changes=changes,
            is_declining=is_declining,
            decline_percent=decline_percent if is_declining else 0.0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"双周期对比查询失败: {str(e)}")


@router.post("/period-trend", response_model=PeriodTrendComparisonResponse)
async def get_period_trend(
    request: PeriodComparisonRequest,
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    获取双周期的每日销量趋势数据（用于折线图）
    """
    try:
        # 验证ASIN列表
        if not request.asins:
            raise HTTPException(status_code=400, detail="ASIN列表不能为空")
        
        if len(request.asins) > 100:
            raise HTTPException(status_code=400, detail="最多同时查询100个ASIN")
        
        # 验证日期参数
        if not request.period_a.get('start_date') or not request.period_a.get('end_date'):
            raise HTTPException(status_code=400, detail="周期A日期参数不完整")
        if not request.period_b.get('start_date') or not request.period_b.get('end_date'):
            raise HTTPException(status_code=400, detail="周期B日期参数不完整")
        
        # 获取周期A趋势
        trend_a = service.get_daily_trend(
            asins=request.asins,
            start_date=request.period_a['start_date'],
            end_date=request.period_a['end_date'],
            shops=request.shops
        )
        
        # 获取周期B趋势
        trend_b = service.get_daily_trend(
            asins=request.asins,
            start_date=request.period_b['start_date'],
            end_date=request.period_b['end_date'],
            shops=request.shops
        )
        
        return PeriodTrendComparisonResponse(
            period_a=DailyTrendResponse(**trend_a),
            period_b=DailyTrendResponse(**trend_b)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取趋势数据失败: {str(e)}")


@router.get("/decline-analysis", response_model=DeclineAnalysisResponse)
async def get_decline_analysis(
    period_type: str = Query(..., description="周期类型: week 或 month"),
    prev_period: str = Query(..., description="前期标识，week格式: YYYY-WNN, month格式: YYYY-MM"),
    curr_period: str = Query(..., description="当期标识，同上"),
    shops: Optional[str] = Query(None, description="店铺筛选，逗号分隔"),
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    产品销量下滑分析

    对比两个周期的销量，计算下滑幅度，按下滑率排序返回
    """
    try:
        shop_list = None
        if shops:
            shop_list = [s.strip() for s in shops.split(',') if s.strip()]

        result = service.get_decline_analysis(
            period_type=period_type,
            prev_period=prev_period,
            curr_period=curr_period,
            shops=shop_list
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下滑分析失败: {str(e)}")


@router.get("/health")
async def health_check(
    service: ProductSalesService = Depends(get_product_sales_service)
):
    """
    健康检查
    """
    try:
        total_rows = service.get_total_rows()
        columns = service.get_columns()
        
        return {
            "status": "ok",
            "total_rows": total_rows,
            "columns_count": len(columns),
            "data_file": service.PARQUET_PATH
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"健康检查失败: {str(e)}")
