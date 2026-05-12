from pydantic import BaseModel, Field, validator, root_validator, computed_field
from typing import Optional, List
from datetime import datetime


class MaterialLibraryBase(BaseModel):
    """
    素材库基础模型
    
    包含素材的基本信息
    """
    sku: str = Field(..., description="素材SKU", min_length=1, max_length=100)  # 只有SKU是必填字段
    batch: str = Field("", description="批次", max_length=100)  # 批次可选，默认为空字符串
    developer: str = Field("", description="开发人", max_length=100)  # 开发人可选，默认为空字符串
    carrier: str = Field("", description="载体", max_length=100)  # 载体可选，默认为空字符串
    element: str = Field(default="", description="元素", max_length=100)
    modification_requirement: Optional[str] = Field(default=None, description="修改要求", max_length=1000, alias="modificationRequirement")
    images: List[str] = Field(default_factory=list, description="图片列表")
    reference_images: List[str] = Field(default_factory=list, description="参考图列表")
    final_draft_images: List[str] = Field(default_factory=list, description="设计稿图片列表")
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
    
    @validator('final_draft_images', pre=True)
    def validate_final_draft_images(cls, v):
        if isinstance(v, str):
            # 如果是字符串，尝试解析为JSON列表
            import json
            return json.loads(v)
        return v
    
    class Config:
        populate_by_name = True
        from_attributes = True


class MaterialLibraryCreate(MaterialLibraryBase):
    """
    素材库创建模型

    用于创建新素材
    """
    # 重定义 sku 为可选字段，为空时将自动生成
    sku: Optional[str] = Field(None, description="素材SKU", min_length=1, max_length=100)


class MaterialLibraryUpdate(MaterialLibraryBase):
    """
    素材库更新模型
    
    用于更新素材信息
    所有字段都是可选的
    """
    # 重定义父类中的必填字段为可选字段
    sku: Optional[str] = Field(None, description="素材SKU", min_length=1, max_length=100)
    batch: Optional[str] = Field(None, description="批次", max_length=100)
    developer: Optional[str] = Field(None, description="开发人", max_length=100)
    carrier: Optional[str] = Field(None, description="载体", max_length=100)
    element: Optional[str] = Field(None, description="元素", max_length=100)
    modification_requirement: Optional[str] = Field(None, description="修改要求", max_length=1000, alias="modificationRequirement")
    images: Optional[List[str]] = Field(None, description="图片列表")
    reference_images: Optional[List[str]] = Field(None, description="参考图列表")
    final_draft_images: Optional[List[str]] = Field(None, description="设计稿图片列表")
    status: Optional[str] = Field(None, description="状态", pattern="^(finalized|optimizing|concept)$")


class MaterialLibraryResponse(MaterialLibraryBase):
    """
    素材库响应模型
    
    用于返回素材信息，包含时间戳
    """
    id: int = Field(..., description="素材ID")
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


class MaterialLibraryListResponse(BaseModel):
    """
    素材库列表响应模型
    
    用于返回素材列表，包含分页信息
    """
    list: List[MaterialLibraryResponse] = Field(..., description="素材列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


class MaterialLibraryQueryParams(BaseModel):
    """
    素材库查询参数模型
    
    用于素材列表查询和筛选
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
