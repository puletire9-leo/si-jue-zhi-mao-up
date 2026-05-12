from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FileLinkType(str, Enum):
    """文件链接类型枚举"""
    FEISHU_XLSX = "feishu_xlsx"  # 飞书xlsx文件链接
    STANDARD_URL = "standard_url"  # 标准网络链接


class FileLinkStatus(str, Enum):
    """链接状态枚举"""
    ACTIVE = "active"  # 活跃
    INACTIVE = "inactive"  # 不活跃
    ERROR = "error"  # 错误


class FileLinkBase(BaseModel):
    """文件链接基础模型"""
    title: str
    url: str
    link_type: FileLinkType
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    library_type: str  # 所属库类型：prompt-library 或 resource-library


class FileLinkCreate(FileLinkBase):
    """创建文件链接模型"""
    pass


class FileLinkUpdate(BaseModel):
    """更新文件链接模型"""
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    status: Optional[FileLinkStatus] = None


class FileLink(FileLinkBase):
    """文件链接完整模型"""
    id: int
    status: FileLinkStatus
    last_checked: Optional[datetime] = None
    check_result: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileLinkList(BaseModel):
    """文件链接列表响应模型"""
    items: List[FileLink]
    total: int
    page: int
    size: int


class FileLinkCheckResult(BaseModel):
    """链接检查结果模型"""
    url: str
    status: FileLinkStatus
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    response_time: Optional[float] = None
    last_checked: datetime


class FileUploadResponse(BaseModel):
    """文件上传响应模型"""
    id: int
    filename: str
    file_url: str
    file_size: int
    upload_time: datetime