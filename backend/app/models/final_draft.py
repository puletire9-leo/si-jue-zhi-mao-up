from pydantic import BaseModel, Field, validator, root_validator, computed_field
from typing import Optional, List
from datetime import datetime


class FinalDraftBase(BaseModel):
    """
    定稿基础模型
    
    包含定稿的基本信息
    """
    sku: str = Field(..., description="产品SKU", min_length=1, max_length=100)  # 只有SKU是必填字段
    batch: str = Field("", description="批次", max_length=100)  # 批次可选，默认为空字符串
    developer: str = Field("", description="开发人", max_length=100)  # 开发人可选，默认为空字符串
    carrier: str = Field("", description="载体", max_length=100)  # 载体可选，默认为空字符串
    element: str = Field(default="", description="元素", max_length=100)
    modification_requirement: Optional[str] = Field(default=None, description="修改要求", max_length=1000, alias="modificationRequirement")
    infringement_label: Optional[str] = Field(default=None, description="侵权标注", max_length=500, alias="infringementLabel")
    images: List[str] = Field(default_factory=list, description="图片列表")
    reference_images: List[str] = Field(default_factory=list, description="参考图列表")
    status: str = Field("concept", description="状态", pattern="^(finalized|optimizing|concept)$")
    
    @validator('images', pre=True)
    def validate_images(cls, v):
        if isinstance(v, str):
            # 如果是字符串，尝试解析为JSON列表
            import json
            return json.loads(v)
        return v
    
    @validator('reference_images', pre=True)
    def validate_reference_images(cls, v):
        if isinstance(v, str):
            # 如果是字符串，尝试解析为JSON列表
            import json
            return json.loads(v)
        return v
    
    class Config:
        populate_by_name = True
        from_attributes = True


class FinalDraftCreate(FinalDraftBase):
    """
    定稿创建模型
    
    用于创建新定稿
    """
    pass


class FinalDraftUpdate(FinalDraftBase):
    """
    定稿更新模型
    
    用于更新定稿信息
    所有字段都是可选的
    """
    # 重定义父类中的必填字段为可选字段
    sku: Optional[str] = Field(None, description="产品SKU", min_length=1, max_length=100)
    batch: Optional[str] = Field(None, description="批次", max_length=100)
    developer: Optional[str] = Field(None, description="开发人", max_length=100)
    carrier: Optional[str] = Field(None, description="载体", max_length=100)
    element: Optional[str] = Field(None, description="元素", max_length=100)
    modification_requirement: Optional[str] = Field(None, description="修改要求", max_length=1000, alias="modificationRequirement")
    infringement_label: Optional[str] = Field(None, description="侵权标注", max_length=500, alias="infringementLabel")
    images: Optional[List[str]] = Field(None, description="图片列表")
    reference_images: Optional[List[str]] = Field(None, description="参考图列表")
    status: Optional[str] = Field(None, description="状态", pattern="^(finalized|optimizing|concept)$")


class FinalDraftResponse(FinalDraftBase):
    """
    定稿响应模型
    
    用于返回定稿信息，包含时间戳
    """
    id: int = Field(..., description="定稿ID")
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


class FinalDraftListResponse(BaseModel):
    """
    定稿列表响应模型
    
    用于返回定稿列表，包含分页信息
    """
    list: List[FinalDraftResponse] = Field(..., description="定稿列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


class FinalDraftQueryParams(BaseModel):
    """
    定稿查询参数模型
    
    用于定稿列表查询和筛选
    """
    search_type: Optional[str] = Field("sku", description="搜索类型", pattern="^(sku|batch|developer|carrier|status|element)$")
    search_content: Optional[str] = Field(None, description="搜索内容")
    developer: Optional[List[str]] = Field(None, description="开发人筛选")
    status: Optional[List[str]] = Field(None, description="状态筛选")
    carrier: Optional[List[str]] = Field(None, description="载体筛选")
    sort_by: Optional[str] = Field("create_time", description="排序字段")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$", description="排序方向")
    page: int = Field(1, ge=1, description="当前页码")
    size: int = Field(20, ge=1, le=100, description="每页数量")


class BatchOperationRequest(BaseModel):
    """
    批量操作请求模型
    
    用于批量删除或导出定稿
    """
    ids: Optional[List[int]] = Field(None, description="定稿ID列表", min_items=1)
    skus: Optional[List[str]] = Field(None, description="定稿SKU列表", min_items=1)
    
    @validator('ids', 'skus')
    def validate_list(cls, v):
        # 如果提供了值，确保它不是空列表
        if v is not None and len(v) == 0:
            raise ValueError('列表不能为空')
        return v
    
    @root_validator(skip_on_failure=True)
    def check_at_least_one(cls, values):
        # 确保至少提供了ids或skus之一
        if not values.get('ids') and not values.get('skus'):
            raise ValueError('必须提供ids或skus之一')
        return values


class BatchOperationResponse(BaseModel):
    """
    批量操作响应模型
    
    用于返回批量操作结果
    """
    success: int = Field(..., description="成功数量")
    failed: int = Field(..., description="失败数量")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")
