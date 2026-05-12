from pydantic import BaseModel, Field, validator, root_validator, computed_field
from typing import Optional, List
from datetime import datetime


class CarrierLibraryBase(BaseModel):
    """
    载体库基础模型
    
    包含载体的基本信息
    """
    images: List[str] = Field(default_factory=list, description="图片列表")
    batch: Optional[str] = Field(default="", description="批次", max_length=100)
    developer: Optional[str] = Field(default="", description="开发人", max_length=100)
    product_size: Optional[str] = Field(default="", description="产品尺寸", max_length=100)
    carrier_name: Optional[str] = Field(default="", description="载体名称", max_length=100)
    material: Optional[str] = Field(default="", description="材质", max_length=100)
    process: Optional[str] = Field(default="", description="工艺", max_length=100)
    weight: Optional[int] = Field(default=None, description="克重")
    packaging_method: Optional[str] = Field(default="", description="打包方式", max_length=100)
    packaging_size: Optional[str] = Field(default="", description="包装尺寸", max_length=100)
    price: Optional[float] = Field(default=None, description="价格")
    min_order_quantity: Optional[int] = Field(default=None, description="起订量")
    supplier: Optional[str] = Field(default="", description="供应商", max_length=255)
    supplier_link: Optional[str] = Field(default="", description="供应商下单链接", max_length=500)
    sku: Optional[str] = Field(default=None, description="SKU（兼容字段，实际使用carrier_name）")
    
    @validator('images', pre=True)
    def validate_images(cls, v):
        if isinstance(v, str):
            # 如果是字符串，尝试解析为JSON列表
            import json
            return json.loads(v)
        return v
    
    class Config:
        populate_by_name = True
        from_attributes = True


class CarrierLibraryCreate(CarrierLibraryBase):
    """
    载体库创建模型
    
    用于创建新载体
    """
    pass


class CarrierLibraryUpdate(CarrierLibraryBase):
    """
    载体库更新模型
    
    用于更新载体信息
    所有字段都是可选的
    """
    # 重定义父类中的字段为可选字段
    images: Optional[List[str]] = Field(None, description="图片列表")
    product_size: Optional[str] = Field(None, description="产品尺寸", max_length=100)
    carrier_name: Optional[str] = Field(None, description="载体名称", max_length=100)
    material: Optional[str] = Field(None, description="材质", max_length=100)
    process: Optional[str] = Field(None, description="工艺", max_length=100)
    weight: Optional[int] = Field(None, description="克重")
    packaging_method: Optional[str] = Field(None, description="打包方式", max_length=100)
    packaging_size: Optional[str] = Field(None, description="包装尺寸", max_length=100)
    price: Optional[float] = Field(None, description="价格")
    min_order_quantity: Optional[int] = Field(None, description="起订量")
    supplier: Optional[str] = Field(None, description="供应商", max_length=255)
    supplier_link: Optional[str] = Field(None, description="供应商下单链接", max_length=500)


class CarrierLibraryResponse(CarrierLibraryBase):
    """
    载体库响应模型
    
    用于返回载体信息，包含时间戳
    """
    id: int = Field(..., description="载体ID")
    create_time: datetime = Field(..., description="创建时间", alias="createTime")
    update_time: datetime = Field(..., description="更新时间", alias="updateTime")
    local_thumbnail_path: Optional[str] = Field(None, description="本地缩略图路径", alias="localThumbnailPath")
    local_thumbnail_status: Optional[str] = Field(None, description="本地缩略图状态", alias="localThumbnailStatus")
    local_thumbnail_updated_at: Optional[datetime] = Field(None, description="本地缩略图更新时间", alias="localThumbnailUpdatedAt")
    local_thumbnail_size: Optional[int] = Field(None, description="本地缩略图大小", alias="localThumbnailSize")
    local_thumbnail_md5: Optional[str] = Field(None, description="本地缩略图MD5", alias="localThumbnailMd5")
    
    class Config:
        populate_by_name = True
        from_attributes = True


class CarrierLibraryListResponse(BaseModel):
    """
    载体库列表响应模型
    
    用于返回载体列表，包含分页信息
    """
    list: List[CarrierLibraryResponse] = Field(..., description="载体列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


class CarrierLibraryQueryParams(BaseModel):
    """
    载体库查询参数模型
    
    用于载体列表查询和筛选
    """
    search_type: Optional[str] = Field("carrier_name", description="搜索类型", pattern="^(batch|developer|carrier|status|element|carrier_name)$")
    search_content: Optional[str] = Field(None, description="搜索内容")
    developer: Optional[List[str]] = Field(None, description="开发人筛选")
    status: Optional[List[str]] = Field(None, description="状态筛选")
    carrier: Optional[List[str]] = Field(None, description="载体筛选")
    sort_by: Optional[str] = Field("create_time", description="排序字段")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="排序方向")
    page: int = Field(1, ge=1, description="当前页码")
    size: int = Field(20, ge=1, le=100, description="每页数量")
