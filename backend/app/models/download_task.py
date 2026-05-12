"""
下载任务模型

定义下载任务相关的数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DownloadTaskStatus(str, Enum):
    """下载任务状态枚举"""
    PENDING = "pending"      # 等待中
    PROCESSING = "processing" # 进行中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class DownloadTaskSource(str, Enum):
    """下载任务来源枚举"""
    FINAL_DRAFT = "final-draft"  # 定稿管理
    PRODUCT = "product"          # 产品管理
    SELECTION = "selection"      # 选品管理
    MATERIAL = "material"        # 素材库
    CARRIER = "carrier"          # 载体库
    SYSTEM = "system"            # 系统导出


class DownloadFileStatus(str, Enum):
    """下载文件状态枚举"""
    PENDING = "pending"   # 等待中
    SUCCESS = "success"   # 成功
    FAILED = "failed"     # 失败


class DownloadTaskFile(BaseModel):
    """
    下载任务文件模型
    
    记录下载任务中的每个文件信息
    """
    id: Optional[int] = Field(None, description="文件ID")
    task_id: str = Field(..., description="所属任务ID")
    file_name: str = Field(..., description="文件名")
    file_size: int = Field(0, description="文件大小(字节)")
    status: DownloadFileStatus = Field(DownloadFileStatus.PENDING, description="文件状态")
    error_message: Optional[str] = Field(None, description="错误信息")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    
    class Config:
        from_attributes = True


class DownloadTask(BaseModel):
    """
    下载任务模型
    
    记录下载任务的完整信息
    """
    id: str = Field(..., description="任务ID(UUID)")
    name: str = Field(..., description="任务名称")
    source: DownloadTaskSource = Field(..., description="任务来源")
    status: DownloadTaskStatus = Field(DownloadTaskStatus.PENDING, description="任务状态")
    progress: int = Field(0, ge=0, le=100, description="进度百分比 0-100")
    total_files: int = Field(0, description="总文件数")
    completed_files: int = Field(0, description="已完成文件数")
    failed_files: int = Field(0, description="失败文件数")
    total_size: int = Field(0, description="总大小(字节)")
    local_path: Optional[str] = Field(None, description="本地缓存文件路径")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    created_by: Optional[int] = Field(None, description="创建用户ID")
    files: Optional[List[DownloadTaskFile]] = Field(None, description="文件列表")
    
    class Config:
        from_attributes = True


class DownloadTaskCreate(BaseModel):
    """
    创建下载任务请求模型
    
    用于创建新的下载任务
    """
    name: str = Field(..., description="任务名称", min_length=1, max_length=255)
    source: DownloadTaskSource = Field(..., description="任务来源")
    skus: Optional[List[str]] = Field(None, description="SKU列表(定稿下载用)")
    file_urls: Optional[List[str]] = Field(None, description="文件URL列表")
    total_files: int = Field(0, description="总文件数")
    
    class Config:
        from_attributes = True


class DownloadTaskResponse(BaseModel):
    """
    下载任务响应模型
    
    用于返回下载任务信息给前端
    """
    id: str = Field(..., description="任务ID")
    name: str = Field(..., description="任务名称")
    source: str = Field(..., description="任务来源")
    status: str = Field(..., description="任务状态")
    progress: int = Field(0, description="进度百分比")
    total_files: int = Field(0, description="总文件数")
    completed_files: int = Field(0, description="已完成文件数")
    failed_files: int = Field(0, description="失败文件数")
    total_size: int = Field(0, description="总大小")
    created_at: str = Field(..., description="创建时间")
    completed_at: Optional[str] = Field(None, description="完成时间")
    error_message: Optional[str] = Field(None, description="错误信息")
    
    class Config:
        from_attributes = True


class DownloadTaskListResponse(BaseModel):
    """
    下载任务列表响应模型
    
    用于返回下载任务列表
    """
    total: int = Field(0, description="总数")
    items: List[DownloadTaskResponse] = Field(default_factory=list, description="任务列表")
    
    class Config:
        from_attributes = True


class DownloadTaskQuery(BaseModel):
    """
    下载任务查询参数模型
    
    用于查询下载任务列表
    """
    status: Optional[str] = Field(None, description="状态筛选")
    source: Optional[str] = Field(None, description="来源筛选")
    keyword: Optional[str] = Field(None, description="关键词搜索")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    
    class Config:
        from_attributes = True
