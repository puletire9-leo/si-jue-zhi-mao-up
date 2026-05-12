from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime


class SelectionProductBase(BaseModel):
    """
    选品产品基础模型
    
    包含选品产品的基本信息
    """
    asin: str = Field(..., description="产品ASIN", min_length=1, max_length=50)
    product_title: str = Field(..., description="商品标题", min_length=1, max_length=500, alias="productTitle")
    price: Optional[float] = Field(None, description="商品价格", ge=0)
    image_url: Optional[str] = Field(None, description="商品图片URL", alias="imageUrl")
    local_path: Optional[str] = Field(None, description="本地图片路径", alias="localPath")
    thumb_path: Optional[str] = Field(None, description="缩略图路径", alias="thumbPath")
    store_name: Optional[str] = Field(None, description="店铺名称", max_length=200, alias="storeName")
    store_url: Optional[str] = Field(None, description="店铺URL", alias="storeUrl")
    shop_id: Optional[str] = Field(None, description="店铺ID", alias="shopId")
    main_category_name: Optional[str] = Field(None, description="大类榜单名", alias="mainCategoryName")
    main_category_rank: Optional[int] = Field(None, description="榜单排名", alias="mainCategoryRank")
    main_category_bsr_growth: Optional[float] = Field(None, description="大类BSR增长数", alias="mainCategoryBsrGrowth")
    main_category_bsr_growth_rate: Optional[float] = Field(None, description="大类BSR增长率", alias="mainCategoryBsrGrowthRate")
    tags: Optional[List[str]] = Field(default_factory=list, description="产品标签列表")
    notes: Optional[str] = Field(None, description="备注信息")
    product_link: Optional[str] = Field(None, description="商品链接", alias="productLink")
    sales_volume: Optional[int] = Field(None, ge=0, description="销量", alias="salesVolume")
    listing_date: Optional[datetime] = Field(None, description="上架时间", alias="listingDate")
    delivery_method: Optional[str] = Field(None, max_length=50, description="配送方式", alias="deliveryMethod")
    similar_products: Optional[str] = Field(None, description="相似商品", alias="similarProducts")
    source: Optional[str] = Field(None, max_length=50, description="来源")
    country: Optional[str] = Field(None, max_length=50, description="国家（英国/德国）")
    data_filter_mode: Optional[str] = Field(None, max_length=50, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode")

    
    class Config:
        populate_by_name = True


class SelectionProductCreate(SelectionProductBase):
    """
    选品产品创建模型
    
    用于创建新的选品产品
    """
    product_type: str = Field("new", description="产品类型：new(新品榜)/reference(竞品店铺)", pattern="^(new|reference)$", alias="productType")


class SelectionProductUpdate(BaseModel):
    """
    选品产品更新模型
    
    用于更新选品产品信息
    所有字段都是可选的
    """
    product_title: Optional[str] = Field(None, min_length=1, max_length=500, description="商品标题", alias="productTitle")
    price: Optional[float] = Field(None, ge=0, description="商品价格")
    image_url: Optional[str] = Field(None, description="商品图片URL", alias="imageUrl")
    local_path: Optional[str] = Field(None, description="本地图片路径", alias="localPath")
    thumb_path: Optional[str] = Field(None, description="缩略图路径", alias="thumbPath")
    store_name: Optional[str] = Field(None, max_length=200, description="店铺名称", alias="storeName")
    store_url: Optional[str] = Field(None, description="店铺URL", alias="storeUrl")
    shop_id: Optional[str] = Field(None, description="店铺ID", alias="shopId")
    main_category_name: Optional[str] = Field(None, description="大类榜单名", alias="mainCategoryName")
    main_category_rank: Optional[int] = Field(None, ge=0, description="榜单排名", alias="mainCategoryRank")
    main_category_bsr_growth: Optional[float] = Field(None, description="大类BSR增长数", alias="mainCategoryBsrGrowth")
    main_category_bsr_growth_rate: Optional[float] = Field(None, description="大类BSR增长率", alias="mainCategoryBsrGrowthRate")
    tags: Optional[List[str]] = Field(None, description="产品标签列表")
    notes: Optional[str] = Field(None, description="备注信息")
    product_link: Optional[str] = Field(None, description="商品链接", alias="productLink")
    sales_volume: Optional[int] = Field(None, ge=0, description="销量", alias="salesVolume")
    delivery_method: Optional[str] = Field(None, max_length=50, description="配送方式", alias="deliveryMethod")
    similar_products: Optional[str] = Field(None, description="相似商品", alias="similarProducts")
    source: Optional[str] = Field(None, max_length=50, description="来源")
    country: Optional[str] = Field(None, max_length=50, description="国家（英国/德国）")
    data_filter_mode: Optional[str] = Field(None, max_length=50, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode")
    
    class Config:
        populate_by_name = True


class SelectionProductResponse(SelectionProductBase):
    """
    选品产品响应模型

    用于返回选品产品信息，包含时间戳和评分信息
    """
    id: int = Field(..., description="产品ID")
    product_type: str = Field(..., description="产品类型：new(新品榜)/reference(竞品店铺)", alias="productType")
    score: Optional[int] = Field(None, description="评分（0-100）")
    grade: Optional[str] = Field(None, description="等级（S/A/B/C/D）")
    week_tag: Optional[str] = Field(None, description="周标记（如2026-W19）", alias="weekTag")
    is_current: Optional[int] = Field(0, description="是否本周数据（1=本周, 0=往期）", alias="isCurrent")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")

    class Config:
        populate_by_name = True


class SelectionProductListResponse(BaseModel):
    """
    选品产品列表响应模型
    
    用于返回选品产品列表，包含分页信息
    """
    list: List[SelectionProductResponse] = Field(..., description="产品列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


class SelectionProductQueryParams(BaseModel):
    """
    选品产品查询参数模型

    用于选品产品列表查询和筛选
    """
    asin: Optional[str] = Field(None, description="产品ASIN")
    product_title: Optional[str] = Field(None, description="商品标题", alias="productTitle")
    product_type: Optional[str] = Field(None, description="产品类型：new(新品榜)/reference(竞品店铺)，为空则查询所有类型", alias="productType")
    source: Optional[str] = Field(None, description="来源筛选关键词，用于模糊匹配source字段")
    store_name: Optional[str] = Field(None, description="店铺名称", alias="storeName")
    category: Optional[str] = Field(None, description="产品分类")
    country: Optional[str] = Field(None, description="国家（英国/德国）")
    data_filter_mode: Optional[str] = Field(None, description="数据筛选模式（模式一/模式二）", alias="dataFilterMode")
    listing_date_start: Optional[str] = Field(None, description="上架时间开始日期（格式：YYYY-MM-DD）", alias="listingDateStart")
    listing_date_end: Optional[str] = Field(None, description="上架时间结束日期（格式：YYYY-MM-DD）", alias="listingDateEnd")
    grade: Optional[str] = Field(None, description="等级筛选（S/A/B/C/D，多个用逗号分隔）")
    week_tag: Optional[str] = Field(None, description="周标记筛选（如2026-W19）", alias="weekTag")
    is_current: Optional[int] = Field(None, description="本周/往期筛选（1=本周, 0=往期）", alias="isCurrent")
    sort_by: Optional[str] = Field("createdAt", description="排序字段")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="排序方向")

    class Config:
        populate_by_name = True


class SelectionStatsResponse(BaseModel):
    """
    选品统计响应模型
    
    用于返回选品统计数据
    """
    total_new_products: int = Field(..., description="新品榜总数")
    total_reference_products: int = Field(..., description="竞品店铺总数")
    total_products: int = Field(..., description="总产品数")
    total_stores: int = Field(..., description="总店铺数")
    total_images: int = Field(..., description="总图片数")


class StoreInfo(BaseModel):
    """
    店铺信息模型
    
    用于返回店铺统计信息
    """
    store_name: str = Field(..., description="店铺名称")
    store_url: Optional[str] = Field(None, description="店铺URL")
    count: int = Field(..., description="产品数量")


class BatchImportSelectionRequest(BaseModel):
    """
    批量导入选品请求模型
    
    用于批量导入选品产品
    """
    products: List[SelectionProductCreate] = Field(..., description="产品列表")
    overwrite: bool = Field(False, description="是否覆盖已存在的产品")


class BatchImportSelectionResponse(BaseModel):
    """
    批量导入选品响应模型
    
    用于返回批量导入结果
    """
    success: int = Field(..., description="成功导入数量")
    failed: int = Field(..., description="失败数量")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")
