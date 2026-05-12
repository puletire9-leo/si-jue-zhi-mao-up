"""
产品销量数据模型
"""
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from datetime import date


class ProductSummary(BaseModel):
    """产品摘要信息（用于列表展示）"""
    asin: str
    title: str
    sku: Optional[str] = None
    msku: Optional[str] = None
    shop: str
    total_sales: int = 0
    total_revenue: float = 0.0
    
    class Config:
        from_attributes = True


class ProductWeeklyData(BaseModel):
    """产品周销量数据"""
    asin: str
    title: str
    weekly_data: Dict[str, Dict[str, Any]]  # {week_start: {sales, revenue, orders}}


class SearchRequest(BaseModel):
    """搜索请求参数"""
    q: Optional[str] = None  # 搜索关键词
    shops: Optional[List[str]] = None  # 店铺筛选
    start_date: Optional[str] = None  # 开始日期
    end_date: Optional[str] = None  # 结束日期
    limit: int = 50  # 返回数量限制
    offset: int = 0  # 分页偏移


class SearchResponse(BaseModel):
    """搜索响应"""
    total: int  # 总匹配数
    products: List[ProductSummary]  # 产品列表
    has_more: bool  # 是否还有更多


class WeeklySalesRequest(BaseModel):
    """周销量查询请求"""
    asins: List[str]  # ASIN列表
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    shops: Optional[List[str]] = None


class WeeklySalesResponse(BaseModel):
    """周销量响应"""
    weeks: List[str]  # 周开始日期列表
    week_labels: List[str]  # 周标签（用于显示）
    data: Dict[str, List[int]]  # {asin: [sales_week1, sales_week2, ...]}
    revenue_data: Dict[str, List[float]]  # {asin: [revenue_week1, ...]}


class ShopInfo(BaseModel):
    """店铺信息"""
    name: str
    product_count: int


class DateRangeResponse(BaseModel):
    """日期范围响应"""
    min_date: str
    max_date: str
    total_weeks: int


class PeriodData(BaseModel):
    """单个周期的完整数据"""
    label: str  # "周期A" / "周期B"
    start_date: str
    end_date: str
    date_range: str  # 显示用的日期范围，如 "2025-05-27 ~ 2025-06-02"
    
    # 销售数据
    orders: int = 0  # 订单量
    sales: int = 0   # 销量
    revenue: float = 0.0  # 销售额
    
    # 利润数据
    gross_profit: float = 0.0  # 毛利润
    gross_profit_rate: float = 0.0  # 毛利率
    settlement_profit: float = 0.0  # 结算利润
    settlement_profit_rate: float = 0.0  # 结算利润率
    
    # 广告数据
    ad_spend: float = 0.0  # 广告花费
    ad_orders: int = 0  # 广告出单
    ad_acos: float = 0.0  # 广告ACOS
    
    # 退款数据
    refund_amount: float = 0.0  # 退款金额
    refund_count: int = 0  # 退款数量
    refund_rate: float = 0.0  # 退款率


class PeriodComparisonRequest(BaseModel):
    """双周期对比请求"""
    asins: List[str]  # ASIN列表
    period_a: Dict[str, str]  # 周期A {"start_date": "", "end_date": ""}
    period_b: Dict[str, str]  # 周期B {"start_date": "", "end_date": ""}
    shops: Optional[List[str]] = None  # 店铺筛选


class PeriodComparisonResponse(BaseModel):
    """双周期对比响应"""
    period_a: PeriodData  # 周期A数据
    period_b: PeriodData  # 周期B数据
    changes: Dict[str, float]  # 各项指标的环比变化百分比
    is_declining: bool  # 是否下滑（周期B销量 > 周期A销量表示下滑）
    decline_percent: float  # 下滑百分比（正值表示下滑）


class DailyTrendResponse(BaseModel):
    """每日趋势响应"""
    dates: List[str]  # 日期列表
    sales: List[int]  # 每日销量
    revenue: List[float]  # 每日销售额


class PeriodTrendComparisonResponse(BaseModel):
    """双周期趋势对比响应"""
    period_a: DailyTrendResponse  # 周期A每日趋势
    period_b: DailyTrendResponse  # 周期B每日趋势
