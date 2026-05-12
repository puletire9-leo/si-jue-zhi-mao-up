"""
[参考] 文件链接API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: FileLinkController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, UploadFile, File
from typing import List, Optional

from ...models.file_link import FileLink, FileLinkCreate, FileLinkUpdate, FileLinkList, FileLinkType, FileLinkStatus, FileUploadResponse
from ...services.file_link_service import FileLinkService
from ...services.file_upload_service import FileUploadService, get_file_upload_service
from ...repositories.mysql_repo import get_mysql_repo

router = APIRouter(prefix="/file-links", tags=["文件链接管理"])


async def get_file_link_service() -> FileLinkService:
    """获取文件链接服务实例"""
    mysql_repo = await get_mysql_repo()
    return FileLinkService(mysql_repo)


@router.post("", summary="创建文件链接")
async def create_file_link(
    file_link: FileLinkCreate,
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
    link_ids: List[int] = Body(..., description="链接ID列表"),
    service: FileLinkService = Depends(get_file_link_service)
):
    """
    批量删除文件链接
    
    - **link_ids**: 链接ID列表
    """
    try:
        if not link_ids:
            raise HTTPException(status_code=400, detail="链接ID列表不能为空")
        
        deleted_count = await service.batch_delete_file_links(link_ids)
        return {
            "code": 200,
            "message": f"成功删除 {deleted_count} 个链接",
            "data": {"deleted_count": deleted_count}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量删除失败: {e}")


@router.post("/{link_id}/check", summary="检查链接状态")
async def check_link_status(
    link_id: int = Path(..., ge=1, description="链接ID"),
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


@router.get("/{library_type}/categories", summary="获取分类列表")
async def get_categories(
    library_type: str = Path(..., description="所属库类型"),
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
    file: UploadFile = File(...),
    title: str = Body(..., description="文件标题"),
    library_type: str = Body(..., description="所属库类型"),
    description: Optional[str] = Body(None, description="文件描述"),
    tags: Optional[List[str]] = Body(None, description="标签列表"),
    category: Optional[str] = Body(None, description="分类"),
    upload_service: FileUploadService = Depends(get_file_upload_service)
):
    """
    上传文件
    
    - **file**: 上传的文件
    - **title**: 文件标题
    - **library_type**: 所属库类型
    - **description**: 文件描述（可选）
    - **tags**: 标签列表（可选）
    - **category**: 分类（可选）
    """
    try:
        result = await upload_service.upload_file(
            file=file,
            title=title,
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