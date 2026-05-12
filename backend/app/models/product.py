from pydantic import BaseModel, Field, validator, computed_field
from typing import Optional, List
from datetime import datetime


class ProductBase(BaseModel):
    """
    产品基础模型
    
    包含产品的基本信息
    """
    sku: str = Field(..., description="产品SKU", min_length=1, max_length=100)
    name: str = Field(..., description="产品名称", min_length=1, max_length=255)
    description: Optional[str] = Field(None, description="产品描述")
    category: Optional[str] = Field(None, description="产品分类", max_length=100)
    tags: Optional[List[str]] = Field(default_factory=list, description="产品标签列表")
    price: Optional[float] = Field(None, description="产品价格", ge=0)
    stock: Optional[int] = Field(None, description="库存数量", ge=0)
    image: Optional[str] = Field(None, description="产品图片URL")


class ProductCreate(ProductBase):
    """
    产品创建模型
    
    用于创建新产品
    """
    type: str = Field("普通产品", description="产品类型", pattern="^(普通产品|组合产品|定制产品)$")


class ProductUpdate(BaseModel):
    """
    产品更新模型
    
    用于更新产品信息
    所有字段都是可选的
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="产品名称")
    description: Optional[str] = Field(None, description="产品描述")
    category: Optional[str] = Field(None, max_length=100, description="产品分类")
    tags: Optional[List[str]] = Field(None, description="产品标签列表")
    price: Optional[float] = Field(None, ge=0, description="产品价格")
    stock: Optional[int] = Field(None, ge=0, description="库存数量")
    type: Optional[str] = Field(None, pattern="^(普通产品|组合产品|定制产品)$", description="产品类型")
    image: Optional[str] = Field(None, description="产品图片URL")


class ProductResponse(ProductBase):
    """
    产品响应模型
    
    用于返回产品信息，包含时间戳
    """
    type: str = Field(..., description="产品类型")
    developer: Optional[str] = Field(None, description="开发负责人")
    local_path: Optional[str] = Field(None, description="本地图片路径", alias="localPath")
    thumb_path: Optional[str] = Field(None, description="缩略图路径", alias="thumbPath")
    included_items: Optional[str] = Field(None, description="包含单品", alias="includedItems")
    created_at: datetime = Field(..., description="创建时间", alias="createdAt")
    updated_at: datetime = Field(..., description="更新时间", alias="updatedAt")
    delete_time: Optional[datetime] = Field(None, description="删除时间", alias="delete_time")
    
    @computed_field
    @property
    def imageUrl(self) -> Optional[str]:
        return self.image
    
    class Config:
        populate_by_name = True


class ProductListResponse(BaseModel):
    """
    产品列表响应模型
    
    用于返回产品列表，包含分页信息
    """
    list: List[ProductResponse] = Field(..., description="产品列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


class ProductQueryParams(BaseModel):
    """
    产品查询参数模型
    
    用于产品列表查询和筛选
    """
    sku: Optional[str] = Field(None, description="产品SKU")
    name: Optional[str] = Field(None, description="产品名称")
    type: Optional[str] = Field(None, description="产品类型")
    category: Optional[str] = Field(None, description="产品分类")
    min_price: Optional[float] = Field(None, ge=0, description="最低价格")
    max_price: Optional[float] = Field(None, ge=0, description="最高价格")
    sort_by: Optional[str] = Field("created_at", description="排序字段")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="排序方向")


class ProductStatsResponse(BaseModel):
    """
    产品统计响应模型
    
    用于返回产品统计数据
    """
    totalProducts: int = Field(..., description="总产品数")
    activeProducts: int = Field(..., description="活跃产品数")
    inactiveProducts: int = Field(..., description="非活跃产品数")
    draftProducts: int = Field(..., description="草稿产品数")
    totalCategories: int = Field(..., description="总分类数")
    totalImages: int = Field(..., description="总图片数")


class CategoryInfo(BaseModel):
    """
    分类信息模型
    
    用于返回分类统计信息
    """
    category: str = Field(..., description="分类名称")
    count: int = Field(..., description="产品数量")


class BatchImportRequest(BaseModel):
    """
    批量导入请求模型
    
    用于批量导入产品
    """
    products: List[ProductCreate] = Field(..., description="产品列表")
    overwrite: bool = Field(False, description="是否覆盖已存在的产品")


class BatchImportResponse(BaseModel):
    """
    批量导入响应模型
    
    用于返回批量导入结果
    """
    success: int = Field(..., description="成功导入数量")
    failed: int = Field(..., description="失败数量")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")
