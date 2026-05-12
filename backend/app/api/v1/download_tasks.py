"""
[参考] 下载任务API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: DownloadTaskController.java

最终删除日期：项目稳定运行后
"""

"""
下载任务管理API

提供下载任务的创建、查询、下载、删除等接口
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List
from datetime import datetime
import os
import urllib.parse

from ...services.download_task_service import download_task_service
from ...models.download_task import (
    DownloadTaskSource, DownloadTaskCreate, 
    DownloadTaskResponse, DownloadTaskListResponse, DownloadTaskQuery
)
from ...middleware.auth_middleware import auth_middleware

router = APIRouter(prefix="/download-tasks", tags=["下载任务"])


def get_current_user_id(user_info: dict) -> Optional[int]:
    """
    从用户信息中获取当前用户ID
    
    Args:
        user_info: 用户信息字典
        
    Returns:
        Optional[int]: 用户ID，如果未登录返回None
    """
    if user_info and 'id' in user_info:
        return user_info['id']
    return None


def is_admin(user_info: dict) -> bool:
    """
    检查是否为管理员
    
    Args:
        user_info: 用户信息字典
        
    Returns:
        bool: 是否为管理员
    """
    if user_info:
        role = user_info.get('role', '')
        return role in ['admin', '管理员']
    return False


def get_mysql_from_request(request: Request):
    """从请求中获取MySQL仓库实例"""
    return request.app.state.mysql


def get_app_state(request: Request):
    """获取应用状态"""
    return request.app.state


@router.post("/final-draft", response_model=dict)
async def create_final_draft_download_task(
    request: Request,
    request_data: dict,
    background_tasks: BackgroundTasks,
    user_info: dict = Depends(auth_middleware.require_auth)
):
    """
    创建定稿下载任务
    
    Args:
        request_data: 包含sku列表的请求体
        
    Returns:
        dict: 包含task_id和message
    """
    skus = request_data.get("skus", [])
    if not skus:
        raise HTTPException(status_code=400, detail="SKU列表不能为空")
    
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    
    # 设置数据库连接
    download_task_service.set_mysql_repo(mysql_repo)
    
    # 获取当前用户ID
    user_id = get_current_user_id(user_info)
    
    # 创建任务
    task_name = f"定稿批量下载-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    task_id = await download_task_service.create_task(
        name=task_name,
        source=DownloadTaskSource.FINAL_DRAFT,
        skus=skus,
        user_id=user_id
    )
    
    # 注意：暂时不执行后台下载，只创建任务记录
    # 后台任务需要更复杂的连接池管理，后续完善
    # background_tasks.add_task(execute_download_task_with_mysql, mysql_repo, task_id)
    
    return {
        "task_id": task_id,
        "message": "下载任务已创建，请到下载管理中心查看进度"
    }


@router.get("", response_model=DownloadTaskListResponse)
async def get_download_tasks(
    request: Request,
    status: Optional[str] = Query(None, description="状态筛选"),
    source: Optional[str] = Query(None, description="来源筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_info: dict = Depends(auth_middleware.require_auth)
):
    """
    获取下载任务列表
    
    Returns:
        DownloadTaskListResponse: 任务列表和总数
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    
    # 获取当前用户ID和管理员状态
    user_id = get_current_user_id(user_info)
    admin = is_admin(user_info)
    
    # 如果是管理员，不限制用户ID，可以看到所有任务
    # 如果是普通用户，只能看到自己的任务
    tasks, total = await download_task_service.get_tasks(
        user_id=None if admin else user_id,
        status=status,
        source=source,
        keyword=keyword,
        page=page,
        page_size=page_size
    )
    
    # 转换为响应模型
    items = []
    for task in tasks:
        items.append(DownloadTaskResponse(
            id=task.id,
            name=task.name,
            source=task.source.value,
            status=task.status.value,
            progress=task.progress,
            total_files=task.total_files,
            completed_files=task.completed_files,
            failed_files=task.failed_files,
            total_size=task.total_size,
            created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
            completed_at=task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else None,
            error_message=task.error_message
        ))
    
    return DownloadTaskListResponse(total=total, items=items)


@router.get("/{task_id}", response_model=DownloadTaskResponse)
async def get_download_task(
    request: Request,
    task_id: str
):
    """
    获取下载任务详情
    
    Args:
        task_id: 任务ID
        
    Returns:
        DownloadTaskResponse: 任务详情
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    
    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return DownloadTaskResponse(
        id=task.id,
        name=task.name,
        source=task.source.value,
        status=task.status.value,
        progress=task.progress,
        total_files=task.total_files,
        completed_files=task.completed_files,
        failed_files=task.failed_files,
        total_size=task.total_size,
        created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
        completed_at=task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else None,
        error_message=task.error_message
    )


@router.get("/{task_id}/download")
async def download_task_file(
    request: Request,
    task_id: str,
    user_info: dict = Depends(auth_middleware.require_auth)
):
    """
    下载任务文件
    
    Args:
        task_id: 任务ID
        
    Returns:
        FileResponse: ZIP文件
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    
    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 检查任务状态
    if task.status.value != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成")
    
    # 检查文件是否存在
    if not task.local_path or not os.path.exists(task.local_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 返回文件（使用StreamingResponse处理大文件）
    
    def iterfile():
        with open(task.local_path, "rb") as f:
            while True:
                chunk = f.read(8192)  # 8KB chunks
                if not chunk:
                    break
                yield chunk
    
    file_size = os.path.getsize(task.local_path)
    
    # 对文件名进行URL编码，处理中文文件名
    encoded_filename = urllib.parse.quote(f"{task.name}.zip")
    
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Type": "application/zip",
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes"
        }
    )


@router.delete("/{task_id}")
async def delete_download_task(
    request: Request,
    task_id: str
):
    """
    删除下载任务
    
    Args:
        task_id: 任务ID
        
    Returns:
        dict: 操作结果
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    
    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    success = await download_task_service.delete_task(task_id)
    if success:
        return {"message": "任务已删除"}
    else:
        raise HTTPException(status_code=500, detail="删除任务失败")


@router.post("/{task_id}/retry")
async def retry_download_task(
    request: Request,
    task_id: str,
    background_tasks: BackgroundTasks
):
    """
    重试下载任务
    
    Args:
        task_id: 任务ID
        
    Returns:
        dict: 操作结果
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    
    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 重置任务状态
    success = await download_task_service.retry_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="任务状态不允许重试")
    
    # 注意：暂时不执行后台下载，只重置任务状态
    # 后台任务需要更复杂的连接池管理，后续完善
    # background_tasks.add_task(download_task_service.execute_task, task_id)
    
    return {"message": "任务已重置，开始重新下载"}


@router.post("/cleanup")
async def cleanup_expired_tasks(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="过期天数"),
    user_info: dict = Depends(auth_middleware.require_admin)
):
    """
    清理过期下载任务（管理员接口）
    
    Args:
        days: 过期天数
        
    Returns:
        dict: 清理结果
    """
    # 获取MySQL仓库实例
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)
    await download_task_service.cleanup_expired_tasks(days)
    
    return {"message": f"已清理{days}天前的过期任务"}
