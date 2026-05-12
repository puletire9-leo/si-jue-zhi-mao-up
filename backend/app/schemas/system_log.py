from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
from ..models.system_log import UpdateRecordType, RequirementPriority, RequirementStatus

# 系统文档相关模型
class SystemDocBase(BaseModel):
    """系统文档基础模型"""
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档内容")
    category: str = Field(..., description="文档分类")

class SystemDocCreate(SystemDocBase):
    """创建系统文档模型"""
    pass

class SystemDocUpdate(BaseModel):
    """更新系统文档模型"""
    title: Optional[str] = Field(None, description="文档标题")
    content: Optional[str] = Field(None, description="文档内容")
    category: Optional[str] = Field(None, description="文档分类")

class SystemDoc(SystemDocBase):
    """系统文档响应模型"""
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

# 更新记录相关模型
class UpdateRecordBase(BaseModel):
    """更新记录基础模型"""
    date: str = Field(..., description="更新日期")
    title: str = Field(..., description="更新标题")
    content: str = Field(..., description="更新内容")
    implementation: str = Field(..., description="技术实现方案")
    updateType: str = Field(..., description="更新类型")
    icon: Optional[str] = Field(None, description="图标")

class UpdateRecordCreate(UpdateRecordBase):
    """创建更新记录模型"""
    pass

class UpdateRecordUpdate(BaseModel):
    """更新更新记录模型"""
    date: Optional[str] = Field(None, description="更新日期")
    title: Optional[str] = Field(None, description="更新标题")
    content: Optional[str] = Field(None, description="更新内容")
    implementation: Optional[str] = Field(None, description="技术实现方案")
    updateType: Optional[str] = Field(None, description="更新类型")
    icon: Optional[str] = Field(None, description="图标")

class UpdateRecord(UpdateRecordBase):
    """更新记录响应模型"""
    id: str
    createdAt: datetime

    class Config:
        from_attributes = True

# 需求清单相关模型
class RequirementBase(BaseModel):
    """需求基础模型"""
    name: str = Field(..., description="需求名称")
    description: str = Field(..., description="需求描述")
    priority: RequirementPriority = Field(..., description="优先级")
    status: RequirementStatus = Field(..., description="状态")

class RequirementCreate(RequirementBase):
    """创建需求模型"""
    pass

class RequirementUpdate(BaseModel):
    """更新需求模型"""
    name: Optional[str] = Field(None, description="需求名称")
    description: Optional[str] = Field(None, description="需求描述")
    priority: Optional[RequirementPriority] = Field(None, description="优先级")
    status: Optional[RequirementStatus] = Field(None, description="状态")

class Requirement(RequirementBase):
    """需求响应模型"""
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

# 列表响应模型
class SystemDocListResponse(BaseModel):
    """系统文档列表响应模型"""
    list: list[SystemDoc]
    total: int

class UpdateRecordListResponse(BaseModel):
    """更新记录列表响应模型"""
    list: list[UpdateRecord]
    total: int

class RequirementListResponse(BaseModel):
    """需求清单列表响应模型"""
    list: list[Requirement]
    total: int
