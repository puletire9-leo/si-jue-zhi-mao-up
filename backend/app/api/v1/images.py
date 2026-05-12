"""
[参考] 图片管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ImageController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body
from fastapi.responses import FileResponse, Response
from typing import Optional, List, Dict, Any
import os
import shutil
import logging
import uuid
import io
from PIL import Image

from ...services import ImageService
from ...config import settings
from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["图片管理"])


def get_image_service():
    """
    依赖注入：获取图片服务实例
    
    Returns:
        ImageService实例
    """
    from fastapi import Request
    
    def _get_service(request: Request):
        mysql = request.app.state.mysql
        redis = getattr(request.app.state, 'redis', None)
        qdrant = getattr(request.app.state, 'qdrant', None)
        return ImageService(mysql, redis, qdrant)
    
    return Depends(_get_service)


@router.post("/upload", summary="上传图片")
async def upload_image(
    file: UploadFile = File(..., description="图片文件"),
    category: str = Form(..., description="图片分类"),
    tags: Optional[str] = Form(None, description="图片标签（逗号分隔）"),
    description: Optional[str] = Form(None, description="图片描述"),
    sku: Optional[str] = Form(None, description="产品SKU"),
    user_info: dict = Depends(auth_middleware.require_permission("image:upload")),
    service: ImageService = get_image_service()
):
    """
    上传图片
    
    - **file**: 图片文件
    - **category**: 图片分类（必需）
    - **tags**: 图片标签，多个标签用逗号分隔（可选）
    - **description**: 图片描述（可选）
    
    返回上传的图片ID和基本信息
    """
    try:
        # 验证文件类型
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file_ext}"
            )
        
        # 生成唯一文件名
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        # 保存文件
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 处理标签
        tag_list = tags.split(',') if tags else None
        if tag_list:
            tag_list = [tag.strip() for tag in tag_list if tag.strip()]
        
        # 调用服务上传图片
        result = await service.upload_image(
            filename=unique_filename,
            filepath=filepath,
            category=category,
            tags=tag_list,
            description=description,
            sku=sku
        )
        
        return {
            "code": 200,
            "message": "图片上传成功",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传图片失败: {e}")
        raise HTTPException(status_code=500, detail="图片上传失败")


@router.post("/batch-upload", summary="批量上传图片")
async def batch_upload_images(
    files: List[UploadFile] = File(..., description="图片文件列表"),
    category: str = Form(..., description="图片分类"),
    tags: Optional[str] = Form(None, description="图片标签（逗号分隔）"),
    description: Optional[str] = Form(None, description="图片描述"),
    sku: Optional[str] = Form(None, description="产品SKU"),
    user_info: dict = Depends(auth_middleware.require_permission("image:upload")),
    service: ImageService = get_image_service()
):
    """
    批量上传图片
    
    - **files**: 图片文件列表
    - **category**: 图片分类（必需）
    - **tags**: 图片标签，多个标签用逗号分隔（可选）
    - **description**: 图片描述（可选）
    
    返回上传结果，包含成功和失败的图片信息
    """
    try:
        # 验证文件数量
        if len(files) == 0:
            raise HTTPException(status_code=400, detail="请至少上传一个文件")
        
        if len(files) > settings.BATCH_UPLOAD_MAX:
            raise HTTPException(
                status_code=400,
                detail=f"批量上传最多支持{settings.BATCH_UPLOAD_MAX}个文件"
            )
        
        # 验证文件类型并保存文件
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        file_list = []
        
        for file in files:
            file_ext = os.path.splitext(file.filename)[1].lower()
            
            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的文件类型: {file.filename} ({file_ext})"
                )
            
            # 生成唯一文件名
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            filepath = os.path.join(settings.UPLOAD_DIR, unique_filename)
            
            # 保存文件
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            file_list.append((unique_filename, filepath))
        
        # 处理标签
        tag_list = tags.split(',') if tags else None
        if tag_list:
            tag_list = [tag.strip() for tag in tag_list if tag.strip()]
        
        # 调用服务批量上传图片，指定图片类型
        # 根据category映射到对应的image_type
        image_type_map = {
            "final": "final",
            "material": "material",
            "carrier": "carrier"
        }
        image_type = image_type_map.get(category, "product")
        result = await service.batch_upload_images(
            files=file_list,
            category=category,
            tags=tag_list,
            description=description,
            image_type=image_type,
            sku=sku
        )
        
        return {
            "code": 200,
            "message": f"批量上传完成 | 成功: {result['success_count']} | 失败: {result['failed_count']}",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量上传图片失败: {e}")
        raise HTTPException(status_code=500, detail="批量上传图片失败")


@router.get("/{image_id}", summary="获取图片信息")
async def get_image(
    image_id: int,
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    获取图片详细信息
    
    - **image_id**: 图片ID
    
    返回图片的详细信息，包括元数据、缩略图路径等
    """
    try:
        image = await service.get_image(image_id)
        
        if not image:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": image
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片失败")


@router.get("/{image_id}/file", summary="获取图片文件")
async def get_image_file(
    image_id: int,
    original: bool = Query(False, description="是否获取原图"),
    extract: bool = Query(True, description="是否提取原始图片（当original=true时有效）"),
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    获取图片文件
    
    - **image_id**: 图片ID
    - **original**: 是否获取原图，默认为false
    - **extract**: 是否提取原始图片（当original=true时有效），默认为true
    
    返回图片文件或重定向到COS URL
    """
    try:
        from backend.app.config import settings
        
        image = await service.get_image(image_id)
        
        if not image:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        filepath = image['filepath']
        filename = image['filename']
        media_type = f"image/{image['format']}"
        
        # 如果需要原图
        if original:
            original_zip_filepath = image.get('original_zip_filepath')
            original_filename = image.get('original_filename', filename)
            original_format = image.get('original_format', 'jpg')
            
            if original_zip_filepath:
                # 检查是否是本地文件
                if not original_zip_filepath.startswith('http://') and not original_zip_filepath.startswith('https://'):
                    if os.path.exists(original_zip_filepath) and original_zip_filepath.endswith('.zip') and extract:
                        # 解压原始图片zip包，然后重新打包
                        import zipfile
                        import tempfile
                        import io
                        from fastapi.responses import Response
                        
                        try:
                            # 解压原始zip包
                            with zipfile.ZipFile(original_zip_filepath, 'r') as zip_ref:
                                # 获取zip包中的文件
                                zip_files = zip_ref.namelist()
                                if zip_files:
                                    # 创建内存中的zip文件
                                    new_zip_buffer = io.BytesIO()
                                    
                                    with zipfile.ZipFile(new_zip_buffer, 'w', zipfile.ZIP_STORED) as new_zip:
                                        # 将原始图片文件添加到新zip包
                                        for file_name in zip_files:
                                            with zip_ref.open(file_name) as file:
                                                file_content = file.read()
                                                # 确保文件名正确
                                                if file_name != original_filename:
                                                    # 使用原始文件名
                                                    new_zip.writestr(original_filename, file_content)
                                                else:
                                                    new_zip.writestr(file_name, file_content)
                                    
                                    # 重置buffer位置
                                    new_zip_buffer.seek(0)
                                    
                                    # 构建响应
                                    media_type = "application/zip"
                                    zip_filename = f"{os.path.splitext(original_filename)[0]}.zip"
                                    
                                    response = Response(
                                        content=new_zip_buffer.getvalue(),
                                        media_type=media_type,
                                        headers={
                                            "Content-Disposition": f"attachment; filename={zip_filename}",
                                            "Cache-Control": "public, max-age=31536000, immutable"
                                        }
                                    )
                                    return response
                        except Exception as e:
                            logger.warning(f"处理原始图片zip包失败，返回原始zip包: {e}")
                    else:
                        # 返回原始zip包
                        filepath = original_zip_filepath
                        if filepath.endswith('.zip'):
                            zip_filename = f"{os.path.splitext(original_filename)[0]}.zip"
                            filename = zip_filename
                            media_type = "application/zip"
        
        # 检查图片读取模式
        if settings.IMAGE_READ_MODE == 'cloud':
            # 云端模式：如果是URL，直接重定向
            if filepath.startswith('http://') or filepath.startswith('https://'):
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=filepath)
        
        # 本地模式或云端模式但不是URL：返回本地文件
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="图片文件不存在")
        
        # 读取图片并转换为PNG格式
        try:
            with Image.open(filepath) as img:
                # 转换为RGB模式（处理RGBA或其他模式）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 透明背景转为白色背景
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    if img.mode in ('RGBA', 'LA'):
                        background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = background
                else:
                    img = img.convert('RGB')
                
                # 保存为PNG格式
                png_buffer = io.BytesIO()
                img.save(png_buffer, format='PNG', optimize=True)
                png_buffer.seek(0)
                png_data = png_buffer.getvalue()
                
                # 修改文件名为.png后缀
                png_filename = f"{os.path.splitext(filename)[0]}.png"
                
                # 返回PNG格式的图片
                response = Response(
                    content=png_data,
                    media_type="image/png",
                    headers={
                        "Content-Disposition": f"attachment; filename={png_filename}",
                        "Cache-Control": "public, max-age=31536000, immutable"
                    }
                )
                return response
        except Exception as e:
            logger.warning(f"转换为PNG失败，返回原始文件: {e}")
            # 如果转换失败，返回原始文件
            response = FileResponse(
                filepath,
                media_type=media_type,
                filename=filename
            )
            # 设置缓存控制头，缓存1年
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片文件失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片文件失败")


@router.get("/{image_id}/thumbnail", summary="获取图片缩略图")
async def get_image_thumbnail(
    image_id: int,
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    获取图片缩略图
    
    - **image_id**: 图片ID
    
    返回256x256的缩略图或重定向到COS缩略图URL
    """
    try:
        from backend.app.config import settings
        
        image = await service.get_image(image_id)
        
        if not image:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        thumbnail_path = image.get('thumbnail_path')
        
        # 检查图片读取模式
        if settings.IMAGE_READ_MODE == 'cloud':
            # 云端模式：如果是URL，直接重定向
            if thumbnail_path and (thumbnail_path.startswith('http://') or thumbnail_path.startswith('https://')):
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=thumbnail_path)
        
        # 本地模式或云端模式但不是URL：使用本地缩略图
        local_thumbnail_path = os.path.join(settings.THUMBNAIL_DIR, f"{image_id}.jpg")
        
        if not os.path.exists(local_thumbnail_path):
            raise HTTPException(status_code=404, detail="缩略图不存在")
        
        # 返回本地缩略图文件，添加Cache-Control响应头
        response = FileResponse(
            local_thumbnail_path,
            media_type="image/jpeg",
            filename=f"{image_id}_thumbnail.jpg"
        )
        # 设置缓存控制头，缓存1年
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取缩略图失败: {e}")
        raise HTTPException(status_code=500, detail="获取缩略图失败")


@router.get("", summary="获取图片列表")
async def get_images(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(12, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    category: Optional[str] = Query(None, description="图片分类"),
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    获取图片列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（1-100，默认12）
    - **keyword**: 搜索关键词（可选）
    - **category**: 图片分类（可选）
    
    返回图片列表，支持分页和搜索
    """
    
    try:
        # 计算偏移量
        offset = (page - 1) * size
        
        # 如果有搜索关键词或分类，使用搜索功能
        if keyword or category:
            images = await service.search_images(
                keyword=keyword,
                category=category,
                limit=size,
                offset=offset
            )
        else:
            # 否则获取所有产品图片
            images = await service.get_all_product_images(
                limit=size,
                offset=offset
            )
        
        # 获取总数量（简化处理，实际应该查询数据库获取准确数量）
        total = len(images) if page == 1 else 1000  # 简化处理
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "list": images,
                "total": total,
                "page": page,
                "size": size
            }
        }
        
    except Exception as e:
        logger.error(f"获取图片列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片列表失败")


@router.get("/{image_id}/similar", summary="搜索相似图片")
async def search_similar_images(
    image_id: int,
    limit: int = Query(settings.SIMILAR_LIMIT_DEFAULT, ge=1, le=settings.SIMILAR_LIMIT_MAX, description="返回数量限制"),
    user_info: dict = Depends(auth_middleware.require_permission("image:search")),
    service: ImageService = get_image_service()
):
    """
    搜索相似图片（基于向量）
    
    - **image_id**: 参考图片ID
    - **limit**: 返回数量限制（1-{max_limit}，默认{default_limit}）
    
    返回与指定图片相似的图片列表
    """.format(
        max_limit=settings.SIMILAR_LIMIT_MAX,
        default_limit=settings.SIMILAR_LIMIT_DEFAULT
    )
    try:
        similar_images = await service.search_similar_images(image_id, limit)
        
        return {
            "code": 200,
            "message": "搜索成功",
            "data": similar_images,
            "count": len(similar_images)
        }
        
    except Exception as e:
        logger.error(f"搜索相似图片失败: {e}")
        raise HTTPException(status_code=500, detail="搜索相似图片失败")


@router.post("/search-by-image", summary="以图搜图")
async def search_by_image(
    file: UploadFile = File(..., description="参考图片文件"),
    category: Optional[str] = Form(None, description="图片分类过滤（可选）"),
    limit: int = Form(settings.SIMILAR_LIMIT_DEFAULT, ge=1, le=settings.SIMILAR_LIMIT_MAX, description="返回数量限制"),
    user_info: dict = Depends(auth_middleware.require_permission("image:search")),
    service: ImageService = get_image_service()
):
    """
    以图搜图（基于上传的图片文件搜索相似图片）
    
    - **file**: 参考图片文件
    - **category**: 图片分类过滤（可选）
    - **limit**: 返回数量限制（1-{max_limit}，默认{default_limit}）
    
    返回与上传图片相似的图片列表
    """.format(
        max_limit=settings.SIMILAR_LIMIT_MAX,
        default_limit=settings.SIMILAR_LIMIT_DEFAULT
    )
    try:
        # 验证文件类型
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file_ext}"
            )
        
        # 保存临时文件
        temp_filename = f"temp_search_{uuid.uuid4()}{file_ext}"
        temp_filepath = os.path.join(settings.UPLOAD_DIR, temp_filename)
        
        try:
            # 保存上传的文件
            with open(temp_filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # 执行以图搜图
            similar_images = await service.search_similar_by_file(
                filepath=temp_filepath,
                limit=limit,
                category=category
            )
            
            return {
                "code": 200,
                "message": "搜索成功",
                "data": similar_images,
                "count": len(similar_images)
            }
            
        finally:
            # 删除临时文件
            try:
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)
            except Exception as e:
                logger.warning(f"[WARN] 临时文件删除失败: {e}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"以图搜图失败: {e}")
        raise HTTPException(status_code=500, detail="以图搜图失败")


@router.put("/{image_id}", summary="更新图片信息")
async def update_image(
    image_id: int,
    category: Optional[str] = Form(None, description="图片分类"),
    tags: Optional[str] = Form(None, description="图片标签（逗号分隔）"),
    description: Optional[str] = Form(None, description="图片描述"),
    user_info: dict = Depends(auth_middleware.require_permission("image:edit")),
    service: ImageService = get_image_service()
):
    """
    更新图片信息
    
    - **image_id**: 图片ID
    - **category**: 图片分类（可选）
    - **tags**: 图片标签，多个标签用逗号分隔（可选）
    - **description**: 图片描述（可选）
    
    返回更新结果
    """
    try:
        # 构建更新数据
        update_data = {}
        
        if category is not None:
            update_data['category'] = category
        
        if tags is not None:
            tag_list = tags.split(',') if tags else None
            if tag_list:
                tag_list = [tag.strip() for tag in tag_list if tag.strip()]
            update_data['tags'] = ','.join(tag_list) if tag_list else None
        
        if description is not None:
            update_data['description'] = description
        
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        # 调用服务更新图片
        success = await service.update_image(image_id, **update_data)
        
        if not success:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        return {
            "code": 200,
            "message": "图片更新成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新图片失败: {e}")
        raise HTTPException(status_code=500, detail="更新图片失败")


@router.delete("/{image_id}", summary="删除图片")
async def delete_image(
    image_id: int,
    user_info: dict = Depends(auth_middleware.require_permission("image:delete")),
    service: ImageService = get_image_service()
):
    """
    删除图片
    
    - **image_id**: 图片ID
    
    删除图片及其相关数据（包括文件、元数据、向量等）
    """
    try:
        success = await service.delete_image(image_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        return {
            "code": 200,
            "message": "图片删除成功",
            "data": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除图片失败: {e}")
        raise HTTPException(status_code=500, detail="删除图片失败")


@router.delete("/batch", summary="批量删除图片")
async def batch_delete_images(
    request_data: Dict[str, Any] = Body(..., description="批量删除请求"),
    user_info: dict = Depends(auth_middleware.require_permission("image:delete")),
    service: ImageService = get_image_service()
):
    """
    批量删除图片
    
    - **ids**: 图片ID列表
    
    批量删除图片及其相关数据（包括文件、元数据、向量等）
    """
    try:
        # 获取图片ID列表
        image_ids = request_data.get("ids", [])
        
        if not image_ids:
            raise HTTPException(status_code=400, detail="请提供要删除的图片ID列表")
        
        # 验证ID数量
        if len(image_ids) > settings.BATCH_DELETE_MAX:
            raise HTTPException(
                status_code=400,
                detail=f"批量删除最多支持{settings.BATCH_DELETE_MAX}个图片"
            )
        
        # 验证ID格式并转换为整数
        try:
            image_ids = [int(img_id) for img_id in image_ids]
        except (ValueError, TypeError):
            # 如果转换失败，尝试直接使用（可能是测试用的字符串ID）
            pass
        
        # 调用服务批量删除图片
        result = await service.batch_delete_images(image_ids)
        
        return {
            "code": 200,
            "message": f"批量删除完成 | 成功: {result['success_count']} | 失败: {result['failed_count']}",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除图片失败: {e}")
        raise HTTPException(status_code=500, detail="批量删除图片失败")


@router.get("/stats/count", summary="获取图片统计")
async def get_image_stats(
    category: Optional[str] = Query(None, description="图片分类"),
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    获取图片统计信息
    
    - **category**: 图片分类（可选）
    
    返回图片数量统计
    """
    try:
        count = await service.get_image_count(category)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "category": category,
                "count": count
            }
        }
        
    except Exception as e:
        logger.error(f"获取图片统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片统计失败")


@router.post("/batch-get", summary="批量获取图片信息")
async def batch_get_images(
    image_ids: List[int] = Body(..., embed=True, description="图片ID列表"),
    user_info: dict = Depends(auth_middleware.require_permission("image:view")),
    service: ImageService = get_image_service()
):
    """
    批量获取图片信息
    
    - **image_ids**: 图片ID列表
    
    返回图片信息列表
    """
    try:
        logger.info(f"开始批量获取图片信息 - ID列表: {image_ids}")
        
        # 去重ID列表
        unique_ids = list(set(image_ids))
        
        # 批量获取图片信息
        images = []
        for image_id in unique_ids:
            image = await service.get_image(image_id)
            if image:
                images.append(image)
        
        # 构建响应数据，以ID为键
        result = {}
        for image in images:
            result[str(image['id'])] = image
        
        logger.info(f"批量获取图片信息成功 - 数量: {len(images)}")
        
        return {
            "code": 200,
            "message": "批量获取成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"批量获取图片信息失败: {e}")
        raise HTTPException(status_code=500, detail="批量获取图片信息失败")


@router.post("/refresh-urls", summary="批量刷新图片URL")
async def refresh_image_urls(
    image_ids: Optional[List[int]] = Body(None, embed=True, description="图片ID列表（可选）"),
    category: Optional[str] = Body(None, embed=True, description="图片分类（可选）"),
    limit: int = Body(1000, embed=True, description="限制数量"),
    offset: int = Body(0, embed=True, description="偏移量"),
    user_info: dict = Depends(auth_middleware.require_permission("image:edit")),
    service: ImageService = get_image_service()
):
    """
    批量刷新图片URL
    
    - **image_ids**: 图片ID列表（可选）
    - **category**: 图片分类（可选）
    - **limit**: 限制数量
    - **offset**: 偏移量
    
    返回刷新结果统计
    """
    try:
        logger.info(f"开始批量刷新图片URL - ID列表: {image_ids}, 分类: {category}, 限制: {limit}, 偏移: {offset}")
        
        # 调用服务批量刷新URL
        result = await service.refresh_image_urls(
            image_ids=image_ids,
            category=category,
            limit=limit,
            offset=offset
        )
        
        logger.info(f"批量刷新图片URL成功 - 总数: {result['total']}, 处理: {result['processed']}, 修复: {result['fixed']}, 失败: {result['failed']}")
        
        return {
            "code": 200,
            "message": "批量刷新成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"批量刷新图片URL失败: {e}")
        raise HTTPException(status_code=500, detail="批量刷新图片URL失败")
