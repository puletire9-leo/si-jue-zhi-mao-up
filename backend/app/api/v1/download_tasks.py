"""
[实际] 下载任务API - 仍在 Python 运行（唯一实现）
=========================

[注意] Java 后端并无 DownloadTaskController，此前"已迁移"标注为误标（2026-07-03 核实）。
       下载任务目前只有本 Python 实现，前端直接依赖，删除前必须先真正迁移。
"""

"""
下载任务管理API

提供下载任务的创建、查询、下载、删除等接口
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request, Response
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime
import os
import logging

from ...services.download_task_service import download_task_service
from ...config import settings
from ...utils.download_ticket import (
    DOWNLOAD_TICKET_COOKIE,
    DOWNLOAD_TICKET_TTL_SECONDS,
    DownloadTicketError,
    create_download_ticket,
    verify_download_ticket,
)

logger = logging.getLogger(__name__)
from ...models.download_task import (
    DownloadTaskSource, DownloadTaskCreate, 
    DownloadTaskResponse, DownloadTaskListResponse, DownloadTaskQuery
)
from ...middleware.auth_middleware import require_auth

router = APIRouter(prefix="/download-tasks", tags=["下载任务"])


def _get_download_ticket_secret() -> str:
    secret = os.getenv("JWT_SECRET") or settings.SECRET_KEY or os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        raise HTTPException(status_code=500, detail="下载凭证密钥未配置")
    return secret


def _ensure_task_access(task, user_info: dict) -> None:
    current_user_id = get_current_user_id(user_info)
    if task.created_by and str(task.created_by) != str(current_user_id) and not is_admin(user_info):
        raise HTTPException(status_code=403, detail="无权下载此任务")


def _ensure_task_downloadable(task) -> None:
    if task.status.value != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成")
    if not task.local_path or not os.path.exists(task.local_path):
        raise HTTPException(status_code=404, detail="文件不存在")


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
    user_info: dict = Depends(require_auth)
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
    user_info: dict = Depends(require_auth)
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
    task_id: str,
    user_info: dict = Depends(require_auth)
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


@router.post("/{task_id}/download-session")
async def create_download_session(
    request: Request,
    response: Response,
    task_id: str,
    user_info: dict = Depends(require_auth),
):
    """Issue a short-lived HttpOnly cookie for a browser-native download."""
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)

    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    _ensure_task_access(task, user_info)
    _ensure_task_downloadable(task)

    ticket = create_download_ticket(
        task_id=task_id,
        user_id=get_current_user_id(user_info),
        secret=_get_download_ticket_secret(),
    )
    forwarded_proto = request.headers.get("X-Forwarded-Proto", request.url.scheme)
    secure_cookie = forwarded_proto.split(",", 1)[0].strip().lower() == "https"
    response.set_cookie(
        key=DOWNLOAD_TICKET_COOKIE,
        value=ticket,
        max_age=DOWNLOAD_TICKET_TTL_SECONDS,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        path=f"/api/v1/download-tasks/{task_id}/download",
    )
    return {"success": True, "expires_in": DOWNLOAD_TICKET_TTL_SECONDS}


@router.get("/{task_id}/download")
async def download_task_file(
    request: Request,
    task_id: str,
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
    
    _ensure_task_downloadable(task)

    ticket = request.cookies.get(DOWNLOAD_TICKET_COOKIE, "")
    ticket_is_valid = False
    if ticket:
        try:
            verify_download_ticket(ticket, task_id, _get_download_ticket_secret())
            ticket_is_valid = True
        except DownloadTicketError:
            ticket_is_valid = False

    if not ticket_is_valid:
        user_info = await require_auth(request)
        _ensure_task_access(task, user_info)

    return FileResponse(
        path=task.local_path,
        media_type="application/zip",
        filename=f"{task.name}.zip",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/{task_id}")
async def delete_download_task(
    request: Request,
    task_id: str,
    user_info: dict = Depends(require_auth)
):
    """
    删除下载任务

    Args:
        request: FastAPI请求对象
        task_id: 任务ID
        user_info: 当前登录用户信息

    Returns:
        dict: 操作结果
    """
    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)

    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 检查权限：只能删除自己的任务
    current_user_id = get_current_user_id(user_info)
    if task.created_by and task.created_by != current_user_id and not is_admin(user_info):
        raise HTTPException(status_code=403, detail="无权删除此任务")

    success = await download_task_service.delete_task(task_id)
    if success:
        return {"code": 200, "message": "任务已删除"}
    else:
        raise HTTPException(status_code=500, detail="删除任务失败")


@router.post("/{task_id}/retry")
async def retry_download_task(
    request: Request,
    task_id: str,
    user_info: dict = Depends(require_auth)
):
    """
    重试下载任务

    Args:
        request: FastAPI请求对象
        task_id: 任务ID
        user_info: 当前登录用户信息

    Returns:
        dict: 操作结果
    """
    import json as _json

    mysql_repo = get_mysql_from_request(request)
    download_task_service.set_mysql_repo(mysql_repo)

    task = await download_task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 检查权限
    current_user_id = get_current_user_id(user_info)
    if task.created_by and task.created_by != current_user_id and not is_admin(user_info):
        raise HTTPException(status_code=403, detail="无权重试此任务")

    # 重置任务状态
    success = await download_task_service.retry_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="任务状态不允许重试")

    # 从 request_data 解析文件列表并分发到 Celery
    files = []
    if task.request_data:
        try:
            files = _json.loads(task.request_data)
        except Exception:
            logger.warning(f"解析 request_data 失败: {task_id}")

    if files:
        from ...tasks.download_tasks import execute_download
        execute_download.delay(task_id, files)
        logger.info(f"重试任务已分发到Celery: {task_id}, 文件数: {len(files)}")
    else:
        logger.warning(f"重试任务无文件数据，仅重置状态: {task_id}")

    return {"code": 200, "message": "任务已重置，开始重新下载"}


@router.post("/cleanup")
async def cleanup_expired_tasks(
    request: Request,
    days: int = Query(7, ge=1, le=30, description="过期天数"),
    user_info: dict = Depends(require_auth)
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
