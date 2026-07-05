"""
[实际] 文件链接API - 仍在 Python 运行（唯一实现）
=========================

[注意] Java 后端并无 FileLinkController，此前"已迁移"标注为误标（2026-07-03 核实）。
       文件链接 CRUD 目前只有本 Python 实现，前端直接依赖，删除前必须先真正迁移。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, UploadFile, File, Form
from typing import Any, List, Optional
from pathlib import Path as FilePath

from ...models.file_link import FileLink, FileLinkCreate, FileLinkUpdate, FileLinkList, FileLinkType, FileLinkStatus, FileUploadResponse
from ...services.file_link_service import FileLinkService
from ...services.file_upload_service import FileUploadService, get_file_upload_service
from ...repositories.mysql_repo import get_mysql_repo
from ...middleware.auth_middleware import require_auth

router = APIRouter(prefix="/file-links", tags=["文件链接管理"])


async def get_file_link_service() -> FileLinkService:
    """获取文件链接服务实例"""
    mysql_repo = await get_mysql_repo()
    return FileLinkService(mysql_repo)


@router.post("", summary="创建文件链接")
async def create_file_link(
    file_link: FileLinkCreate,
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    创建新的文件链接
    
    - **title**: 链接标题
    - **url**: 链接地址
    - **link_type**: 链接类型 (feishu_xlsx 或 standard_url)
    - **description**: 链接描述（可选）
    - **tags**: 标签列表（可选）
    - **category**: 分类（可选）
    - **library_type**: 所属库类型 (prompt-library 或 resource-library)
    """
    try:
        result = await service.create_file_link(file_link)
        return {
            "code": 200,
            "message": "创建成功",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {e}")


@router.get("", summary="获取文件链接列表")
async def get_file_links(
    library_type: Optional[str] = Query(None, description="所属库类型"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(12, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类筛选"),
    link_type: Optional[FileLinkType] = Query(None, description="链接类型筛选"),
    status: Optional[FileLinkStatus] = Query(None, description="状态筛选"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    获取文件链接列表
    
    - **library_type**: 所属库类型 (prompt-library 或 resource-library)
    - **page**: 页码（默认1）
    - **size**: 每页数量（1-100，默认12）
    - **keyword**: 搜索关键词（可选）
    - **category**: 分类筛选（可选）
    - **link_type**: 链接类型筛选（可选）
    - **status**: 状态筛选（可选）
    """
    try:
        result = await service.get_file_links(
            library_type=library_type,
            page=page,
            size=size,
            keyword=keyword,
            category=category,
            link_type=link_type,
            status=status
        )
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {e}")


@router.get("/{link_id}", summary="获取单个文件链接")
async def get_file_link(
    link_id: int = Path(..., ge=1, description="链接ID"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    根据ID获取单个文件链接
    
    - **link_id**: 文件链接ID
    """
    try:
        result = await service.get_file_link(link_id)
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {e}")


@router.put("/{link_id}", summary="更新文件链接")
async def update_file_link(
    link_id: int = Path(..., ge=1, description="链接ID"),
    update_data: FileLinkUpdate = Body(...),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    更新文件链接信息
    
    - **link_id**: 文件链接ID
    - **update_data**: 更新数据
    """
    try:
        result = await service.update_file_link(link_id, update_data)
        return {
            "code": 200,
            "message": "更新成功",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {e}")


@router.delete("/{link_id}", summary="删除文件链接")
async def delete_file_link(
    link_id: int = Path(..., ge=1, description="链接ID"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    删除文件链接
    
    - **link_id**: 文件链接ID
    """
    try:
        success = await service.delete_file_link(link_id)
        if success:
            return {
                "code": 200,
                "message": "删除成功",
                "data": None
            }
        else:
            raise HTTPException(status_code=500, detail="删除失败")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")


@router.post("/batch-delete", summary="批量删除文件链接")
async def batch_delete_file_links(
    payload: Any = Body(..., description="链接ID列表或 { ids: [...] }"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    批量删除文件链接
    
    - **link_ids**: 链接ID列表
    """
    try:
        if isinstance(payload, dict):
            link_ids = payload.get("ids") or payload.get("link_ids") or []
        else:
            link_ids = payload

        if not link_ids:
            raise HTTPException(status_code=400, detail="链接ID列表不能为空")

        if not isinstance(link_ids, list) or any(not isinstance(item, int) for item in link_ids):
            raise HTTPException(status_code=400, detail="链接ID列表格式无效")
        
        deleted_count = await service.batch_delete_file_links(link_ids)
        return {
            "code": 200,
            "message": f"成功删除 {deleted_count} 个链接",
            "data": {"deleted_count": deleted_count}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量删除失败: {e}")


@router.post("/{link_id}/check", summary="检查链接状态")
async def check_link_status(
    link_id: int = Path(..., ge=1, description="链接ID"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    检查链接状态
    
    - **link_id**: 链接ID
    """
    try:
        result = await service.check_link_status(link_id)
        return {
            "code": 200,
            "message": "检查完成",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检查失败: {e}")


@router.get("/{link_id}/preview", summary="预览文件链接")
async def preview_file_link(
    link_id: int = Path(..., ge=1, description="链接ID"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """返回预览所需的链接信息"""
    try:
        result = await service.get_preview_info(link_id)
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "previewUrl": result["preview_url"],
                "isValid": result["is_valid"],
                "lastChecked": result["last_checked"]
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预览失败: {e}")


@router.post("/validate", summary="校验链接有效性")
async def validate_link(
    body: dict = Body(..., description="包含 url 的请求体"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """校验任意链接是否可访问"""
    url = body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url 不能为空")

    try:
        result = await service.validate_url(url)
        return {
            "code": 200,
            "message": "校验完成",
            "data": {
                "isValid": result["is_valid"],
                "statusCode": result["status_code"],
                "contentType": result["content_type"],
                "checkedAt": result["checked_at"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"校验失败: {e}")


@router.get("/{library_type}/categories", summary="获取分类列表")
async def get_categories(
    library_type: str = Path(..., description="所属库类型"),
    current_user: dict = Depends(require_auth),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    获取指定库的分类列表
    
    - **library_type**: 所属库类型
    """
    try:
        categories = await service.get_categories(library_type)
        return {
            "code": 200,
            "message": "获取成功",
            "data": categories
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {e}")


@router.post("/upload", summary="上传文件")
async def upload_file(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    title: Optional[str] = Form(None, description="文件标题"),
    library_type: str = Form(..., description="所属库类型"),
    description: Optional[str] = Form(None, description="文件描述"),
    tags: Optional[List[str]] = Form(None, description="标签列表"),
    category: Optional[str] = Form(None, description="分类"),
    current_user: dict = Depends(require_auth),
    upload_service: FileUploadService = Depends(get_file_upload_service)
):
    """
    上传文件
    
    - **file / files**: 上传的文件
    - **title**: 文件标题（单文件可省略，默认取文件名）
    - **library_type**: 所属库类型
    - **description**: 文件描述（可选）
    - **tags**: 标签列表（可选）
    - **category**: 分类（可选）
    """
    try:
        upload_files: List[UploadFile] = []
        if file is not None:
            upload_files.append(file)
        if files:
            upload_files.extend(files)

        if not upload_files:
            raise HTTPException(status_code=400, detail="至少上传一个文件")

        if len(upload_files) > 1:
            result = await upload_service.upload_multiple_files(
                files=upload_files,
                library_type=library_type,
                category=category
            )
        else:
            current_file = upload_files[0]
            resolved_title = title or FilePath(current_file.filename or "uploaded-file").stem
            result = await upload_service.upload_file(
                file=current_file,
                title=resolved_title,
                library_type=library_type,
                description=description,
                tags=tags,
                category=category
            )
        return {
            "code": 200,
            "message": "上传成功",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {e}")


@router.post("/batch-upload", summary="批量上传文件")
async def batch_upload_files(
    files: List[UploadFile] = File(...),
    library_type: str = Body(..., description="所属库类型"),
    category: Optional[str] = Body(None, description="分类"),
    current_user: dict = Depends(require_auth),
    upload_service: FileUploadService = Depends(get_file_upload_service)
):
    """
    批量上传文件
    
    - **files**: 上传的文件列表
    - **library_type**: 所属库类型
    - **category**: 分类（可选）
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="文件列表不能为空")
        
        results = await upload_service.upload_multiple_files(
            files=files,
            library_type=library_type,
            category=category
        )
        return {
            "code": 200,
            "message": f"成功上传 {len(results)} 个文件",
            "data": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量上传失败: {e}")


@router.get("/upload/stats", summary="获取上传统计")
async def get_upload_stats(
    current_user: dict = Depends(require_auth),
    upload_service: FileUploadService = Depends(get_file_upload_service)
):
    """
    获取文件上传统计信息
    """
    try:
        stats = upload_service.get_upload_stats()
        return {
            "code": 200,
            "message": "获取成功",
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计失败: {e}")
