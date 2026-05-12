from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import date

class CategoryStat(BaseModel):
    category: str
    productCount: int
    totalSalesVolume: int
    totalSalesAmount: float
    totalOrderQuantity: int
    avgAcoas: float
    avgRoas: float
    avgCvr: float
    totalAdSpend: float
    totalAdSales: float
    orderRate: Optional[float] = 0.0
    growthRate: Optional[float] = 0.0

class CategoryStatsResponse(BaseModel):
    month: str
    stats: List[CategoryStat]

class ProductData(BaseModel):
    id: Optional[int] = None
    date: date  # 使用 date 类型，接受 datetime.date 对象
    asin: str
    parent_asin: Optional[str] = None
    msku: str
    sku: Optional[str] = None
    store: str
    country: str
    category_level1: Optional[str] = None
    category_level2: Optional[str] = None
    category_level3: Optional[str] = None
    main_category_rank: Optional[str] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    developer: Optional[str] = None
    responsible_person: Optional[str] = None
    sales_volume: int
    sales_amount: float
    order_quantity: int
    sessions_total: int
    pv_total: int
    cvr: float
    ad_spend: float
    ad_sales_amount: float
    acoas: float
    roas: float
    impressions: int
    clicks: int
    ctr: float

class ProductListResponse(BaseModel):
    total: int
    list: List[ProductData]
    page: int
    page_size: int

class TrendData(BaseModel):
    date: str
    category: str
    salesVolume: int
    salesAmount: float
    orderQuantity: int
    adSpend: float = 0.0
    adSales: float = 0.0
    impressions: int = 0
    clicks: int = 0

class TrendResponse(BaseModel):
    category: Optional[str] = None
    data: List[TrendData]

class TopProduct(BaseModel):
    rank: int
    product: ProductData
    salesVolume: int
    salesAmount: float

class TopProductsResponse(BaseModel):
    category: Optional[str] = None
    items: List[TopProduct]

class FilterOptionsResponse(BaseModel):
    stores: List[str]
    countries: List[str]
    developers: List[str]
    categories: List[str]

class AdPerformance(BaseModel):
    category: str
    adSpend: float
    adSales: float
    acoas: float
    roas: float
    impressions: int
    clicks: int
    ctr: float

class AdPerformanceResponse(BaseModel):
    category: Optional[str] = None
    data: List[AdPerformance]
