"""
[参考] 产品管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ProductController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from typing import Optional, List
import logging
import pandas as pd
import aiomysql
import anyio
from io import BytesIO

from ...models.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductQueryParams,
    ProductStatsResponse,
    CategoryInfo
)
from ...services.product_service import ProductService
from ...config import settings
from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["产品管理"])


def get_product_service():
    """
    依赖注入：获取产品服务实例
    
    Returns:
        ProductService实例
    """
    from fastapi import Request
    
    def _get_service(request: Request):
        mysql = request.app.state.mysql
        redis = getattr(request.app.state, 'redis', None)
        return ProductService(mysql, redis)
    
    return Depends(_get_service)


@router.post("", summary="创建产品")
async def create_product(
    product: ProductCreate,
    user_info: dict = Depends(auth_middleware.require_permission("product:write")),
    service: ProductService = get_product_service()
):
    """
    创建新产品
    
    - **sku**: 产品SKU（必需）
    - **name**: 产品名称（必需）
    - **type**: 产品类型（必需，默认：普通产品）
    - **description**: 产品描述（可选）
    - **category**: 产品分类（可选）
    - **tags**: 产品标签列表（可选）
    - **price**: 产品价格（可选）
    - **stock**: 库存数量（可选）
    - **image**: 产品图片URL（可选）
    
    返回创建的产品信息
    """
    try:
        result = await service.create_product(product)
        
        return {
            "code": 200,
            "message": "创建成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"创建产品失败: {e}")
        raise HTTPException(status_code=500, detail="创建产品失败")


@router.get("/list", summary="获取产品列表")
async def get_products_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(12, ge=1, description="每页数量（最大50）"),
    sku: Optional[str] = Query(None, description="产品SKU"),
    name: Optional[str] = Query(None, description="产品名称"),
    type: Optional[str] = Query(None, description="产品类型"),
    category: Optional[str] = Query(None, description="产品分类"),
    user_info: dict = Depends(auth_middleware.require_permission("product:view")),
    service: ProductService = get_product_service()
):
    """
    获取产品列表
    
    - **page**: 页码（默认1）
    - **size**: 每页数量（默认12，最大50）
    - **sku**: 产品SKU（可选）
    - **name**: 产品名称（可选）
    - **type**: 产品类型（可选）
    - **category**: 产品分类（可选）
    
    返回产品列表和分页信息
    """
    try:
        # 参数验证
        if size > 50:
            size = 50
            logger.warning(f"页码大小超出限制，已调整为50")
        
        params = ProductQueryParams(
            sku=sku,
            name=name,
            type=type,
            category=category
        )
        
        result = await service.get_products(page, size, params)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": result
        }
        
    except anyio.EndOfStream:
        logger.warning(f"客户端连接已关闭: 获取产品列表 | 页码: {page} | 每页数量: {size}")
        raise HTTPException(status_code=499, detail="客户端连接已关闭")
    except Exception as e:
        logger.error(f"获取产品列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取产品列表失败")


@router.get("", summary="搜索产品")
async def search_products(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    sku: Optional[str] = Query(None, description="产品SKU"),
    name: Optional[str] = Query(None, description="产品名称"),
    type: Optional[str] = Query(None, description="产品类型"),
    category: Optional[str] = Query(None, description="产品分类"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, description="每页数量（最大50）"),
    user_info: dict = Depends(auth_middleware.require_permission("product:view")),
    service: ProductService = get_product_service()
):
    """
    搜索产品
    
    - **keyword**: 搜索关键词（可选，优先使用）
    - **sku**: 产品SKU（可选）
    - **name**: 产品名称（可选）
    - **type**: 产品类型（可选）
    - **category**: 产品分类（可选）
    - **page**: 页码（默认1）
    - **page_size**: 每页数量（默认20，最大50）
    
    返回搜索结果和分页信息
    """
    try:
        # 参数验证
        if page_size > 50:
            page_size = 50
            logger.warning(f"页码大小超出限制，已调整为50")
        
        # 如果提供了keyword，优先使用keyword作为名称搜索
        search_name = keyword if keyword else name
        
        params = ProductQueryParams(
            sku=sku,
            name=search_name,
            type=type,
            category=category
        )
        
        result = await service.get_products(page, page_size, params)
        
        return {
            "code": 200,
            "message": "搜索成功",
            "data": result
        }
        
    except anyio.EndOfStream:
        logger.warning(f"客户端连接已关闭: 搜索产品 | 页码: {page} | 每页数量: {page_size}")
        raise HTTPException(status_code=499, detail="客户端连接已关闭")
    except Exception as e:
        logger.error(f"搜索产品失败: {e}")
        raise HTTPException(status_code=500, detail="搜索产品失败")


@router.get("/skus", summary="获取所有产品SKU列表")
async def get_all_product_skus(
    product_type: Optional[str] = Query(None, description="产品类型，不传则返回所有类型"),
    user_info: dict = Depends(auth_middleware.require_permission("product:view")),
    service: ProductService = get_product_service()
):
    """
    获取所有产品的SKU列表
    
    - **product_type**: 产品类型（可选），不传则返回所有类型
    
    返回SKU列表
    """
    try:
        skus = await service.get_all_skus(product_type)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "skus": skus,
                "total": len(skus)
            }
        }
        
    except Exception as e:
        logger.error(f"获取SKU列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取SKU列表失败")


@router.get("/{sku}", summary="获取产品详情")
async def get_product_by_sku(
    sku: str,
    user_info: dict = Depends(auth_middleware.require_permission("product:view")),
    service: ProductService = get_product_service()
):
    """
    获取产品详细信息
    
    - **sku**: 产品SKU
    
    返回产品的详细信息
    """
    try:
        product = await service.get_product_by_sku(sku)
        
        if not product:
            raise HTTPException(status_code=404, detail="产品不存在")
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": product
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取产品失败: {e}")
        raise HTTPException(status_code=500, detail="获取产品失败")


@router.put("/{sku}", summary="更新产品")
async def update_product(
    sku: str,
    product: ProductUpdate,
    user_info: dict = Depends(auth_middleware.require_permission("product:write")),
    service: ProductService = get_product_service()
):
    """
    更新产品信息
    
    - **sku**: 产品SKU
    - **name**: 产品名称（可选）
    - **type**: 产品类型（可选）
    - **description**: 产品描述（可选）
    - **category**: 产品分类（可选）
    - **tags**: 产品标签列表（可选）
    - **price**: 产品价格（可选）
    - **stock**: 库存数量（可选）
    - **image**: 产品图片URL（可选）
    
    返回更新结果
    """
    try:
        result = await service.update_product(sku, product)
        
        return {
            "code": 200,
            "message": "更新成功",
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新产品失败: {e}")
        raise HTTPException(status_code=500, detail="更新产品失败")


@router.delete("/{sku}", summary="删除产品")
async def delete_product(
    sku: str,
    user_info: dict = Depends(auth_middleware.require_permission("product:delete")),
    service: ProductService = get_product_service()
):
    """
    删除产品
    
    - **sku**: 产品SKU
    
    删除产品
    """
    # 参数验证
    if not sku or not sku.strip():
        raise HTTPException(status_code=400, detail="SKU不能为空")
    
    if len(sku) > 50:
        raise HTTPException(status_code=400, detail="SKU长度不能超过50个字符")
    
    # SKU格式验证（只允许字母、数字、下划线、短横线）
    import re
    if not re.match(r'^[a-zA-Z0-9_-]+$', sku):
        raise HTTPException(status_code=400, detail="SKU格式无效，只允许字母、数字、下划线和短横线")
    
    try:
        # 检查产品是否存在
        product = await service.get_product_by_sku(sku)
        if not product:
            raise HTTPException(status_code=404, detail=f"产品SKU {sku} 不存在")
        
        # 执行删除操作
        success = await service.delete_product(sku)
        
        if not success:
            raise HTTPException(status_code=500, detail="删除操作失败")
        
        return {
            "code": 200,
            "message": "删除成功",
            "data": None
        }
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="删除产品失败")


@router.post("/batch-delete", summary="批量删除产品")
async def batch_delete_products(
    request_data: dict,
    user_info: dict = Depends(auth_middleware.require_permission("product:delete")),
    service: ProductService = get_product_service()
):
    """
    批量删除产品
    
    - **skus**: 产品SKU列表
    
    批量删除产品
    """
    try:
        skus = request_data.get('skus', [])
        
        # 参数验证
        if not skus:
            raise HTTPException(status_code=400, detail="SKU列表不能为空")
        
        if not isinstance(skus, list):
            raise HTTPException(status_code=400, detail="SKU列表必须是数组格式")
        
        if len(skus) > 100:
            raise HTTPException(status_code=400, detail="批量删除数量不能超过100个")
        
        # SKU格式验证
        import re
        for sku in skus:
            if not sku or not sku.strip():
                raise HTTPException(status_code=400, detail="SKU不能为空")
            
            if len(sku) > 50:
                raise HTTPException(status_code=400, detail=f"SKU {sku} 长度不能超过50个字符")
            
            if not re.match(r'^[a-zA-Z0-9_-]+$', sku):
                raise HTTPException(status_code=400, detail=f"SKU {sku} 格式无效，只允许字母、数字、下划线和短横线")
        
        # 检查至少有一个产品存在
        valid_skus = []
        for sku in skus:
            product = await service.get_product_by_sku(sku)
            if product:
                valid_skus.append(sku)
        
        if not valid_skus:
            raise HTTPException(status_code=404, detail="没有找到有效的产品SKU")
        
        count = await service.batch_delete_products(valid_skus)
        
        if count == 0:
            raise HTTPException(status_code=500, detail="批量删除操作失败")
        
        return {
            "code": 200,
            "message": f"成功删除{count}个产品",
            "data": {"count": count}
        }
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"批量删除产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量删除产品失败")


@router.get("/skus", summary="获取所有产品SKU列表")
async def get_all_product_skus(
    product_type: Optional[str] = Query(None, description="产品类型，不传则返回所有类型"),
    service: ProductService = get_product_service()
):
    """
    获取所有产品的SKU列表
    
    - **product_type**: 产品类型（可选），不传则返回所有类型
    
    返回SKU列表
    """
    try:
        skus = await service.get_all_skus(product_type)
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "skus": skus,
                "total": len(skus)
            }
        }
        
    except Exception as e:
        logger.error(f"获取SKU列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取SKU列表失败")


@router.get("/stats/summary", summary="获取产品统计")
async def get_product_stats(
    service: ProductService = get_product_service()
):
    """
    获取产品统计信息
    
    返回产品的统计数据，包括：
    - 总产品数
    - 普通产品数
    - 组合产品数
    - 定制产品数
    - 总分类数
    - 总图片数
    """
    try:
        stats = await service.get_product_stats()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"获取产品统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取产品统计失败")


@router.get("/categories", summary="获取分类统计")
async def get_categories(
    service: ProductService = get_product_service()
):
    """
    获取分类统计
    
    返回所有分类及其产品数量，按产品数量降序排列
    """
    try:
        categories = await service.get_categories()
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": categories
        }
        
    except Exception as e:
        logger.error(f"获取分类统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取分类统计失败")


@router.put("/batch", summary="批量更新产品")
async def batch_update_products(
    request_data: dict,
    user_info: dict = Depends(auth_middleware.require_permission("product:write")),
    service: ProductService = get_product_service()
):
    """
    批量更新产品
    
    - **updates**: 更新列表，每个元素包含sku和要更新的字段
    
    批量更新产品信息
    """
    try:
        updates = request_data.get('updates', [])
        
        if not updates:
            raise HTTPException(status_code=400, detail="更新列表不能为空")
        
        success_count = 0
        failed_count = 0
        errors = []
        
        for update_item in updates:
            try:
                sku = update_item.get('sku')
                
                if not sku:
                    failed_count += 1
                    errors.append({"sku": sku, "error": "SKU不能为空"})
                    continue
                
                # 构建更新数据
                update_data = {}
                if 'name' in update_item:
                    update_data['name'] = update_item['name']
                if 'type' in update_item:
                    update_data['type'] = update_item['type']
                if 'description' in update_item:
                    update_data['description'] = update_item['description']
                if 'category' in update_item:
                    update_data['category'] = update_item['category']
                if 'tags' in update_item:
                    update_data['tags'] = update_item['tags']
                if 'price' in update_item:
                    update_data['price'] = update_item['price']
                if 'stock' in update_item:
                    update_data['stock'] = update_item['stock']
                if 'image' in update_item:
                    update_data['image'] = update_item['image']
                
                if not update_data:
                    failed_count += 1
                    errors.append({"sku": sku, "error": "没有提供要更新的字段"})
                    continue
                
                # 执行更新
                await service.update_product(sku, update_data)
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append({"sku": update_item.get('sku'), "error": str(e)})
        
        return {
            "code": 200,
            "message": f"批量更新完成：成功{success_count}条，失败{failed_count}条",
            "data": {
                "success": success_count,
                "failed": failed_count,
                "errors": errors[:10]  # 只返回前10个错误
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量更新产品失败: {e}")
        raise HTTPException(status_code=500, detail="批量更新产品失败")


@router.get("/export", summary="导出产品")
async def export_products(
    format: str = Query("excel", description="导出格式（excel/csv）"),
    service: ProductService = get_product_service()
):
    """
    导出产品数据
    
    - **format**: 导出格式（excel/csv，默认excel）
    
    返回产品数据文件
    """
    try:
        from fastapi.responses import StreamingResponse
        import io
        import pandas as pd
        
        # 获取所有产品
        products = await service.get_all_products()
        
        if not products:
            raise HTTPException(status_code=404, detail="没有产品数据")
        
        # 转换为DataFrame
        df = pd.DataFrame(products)
        
        # 根据格式导出
        if format.lower() == 'csv':
            output = io.StringIO()
            df.to_csv(output, index=False, encoding='utf-8-sig')
            output.seek(0)
            
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode('utf-8-sig')),
                media_type='text/csv',
                headers={"Content-Disposition": "attachment; filename=products.csv"}
            )
        else:
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='产品数据')
            output.seek(0)
            
            return StreamingResponse(
                output,
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={"Content-Disposition": "attachment; filename=products.xlsx"}
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出产品失败: {e}")
        raise HTTPException(status_code=500, detail="导出产品失败")


@router.post("/import", summary="导入产品")
async def import_products(
    file: UploadFile = File(..., description="Excel文件"),
    service: ProductService = get_product_service()
):
    """
    导入产品数据（Excel文件）
    
    - **file**: Excel文件（.xlsx或.xls），文件名不限
    
    返回导入结果
    
    模板字段说明：
    - SKU（必填）：产品SKU，必须唯一
    - 产品名称（必填）：产品名称
    - 创建时间（可选）：产品创建时间，格式：YYYY-MM-DD HH:MM:SS
    - 产品类型（可选）：普通产品/组合产品/定制产品，默认：普通产品
    - 包含单品（可选）：组合产品的包含单品，格式：SKU*数量;SKU*数量，例如：2570009*1;2570010*1
    - 开发者（可选）：开发者名称
    - 图片链接（可选）：产品图片URL
    """
    try:
        # 验证文件类型（只检查扩展名，不限制文件名）
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="只支持.xlsx或.xls格式的Excel文件"
            )
        
        # 读取Excel文件
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        # 验证必需列（支持"品名"或"产品名称"作为产品名称列，支持"*SKU"或"SKU"作为SKU列）
        sku_column = None
        name_column = None
        developer_column = None
        for col in df.columns:
            col_str = str(col).strip()
            if col_str == 'SKU' or col_str == '*SKU':
                sku_column = col
            if col_str == '品名' or col_str == '产品名称':
                name_column = col
            if col_str == '开发者' or col_str == '开发人':
                developer_column = col
        
        if sku_column is None:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件缺少必需的列: SKU或*SKU"
            )
        
        if name_column is None:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件缺少必需的列: 品名或产品名称"
            )
        
        # 导入数据
        success_count = 0
        failed_count = 0
        errors = []
        
        # 准备批量插入的数据
        valid_products = []
        duplicate_skus = set()
        
        for index, row in df.iterrows():
            try:
                sku = str(row.get(sku_column, '')).strip()
                name = str(row.get(name_column, '')).strip()
                
                if not sku or not name:
                    failed_count += 1
                    errors.append(f"第{index + 2}行: SKU或产品名称不能为空")
                    continue
                
                # 解析创建时间
                create_time = None
                create_time_str = row.get('创建时间')
                if pd.notna(create_time_str):
                    try:
                        if isinstance(create_time_str, str):
                            create_time = pd.to_datetime(create_time_str)
                        else:
                            create_time = create_time_str
                    except Exception as e:
                        logger.warning(f"第{index + 2}行: 创建时间格式错误: {e}")
                
                # 检查重复SKU
                if sku in duplicate_skus:
                    failed_count += 1
                    errors.append(f"第{index + 2}行: SKU {sku} 在文件中重复")
                    continue
                duplicate_skus.add(sku)
                
                valid_products.append({
                    'sku': sku,
                    'name': name,
                    'type': str(row.get('产品类型', '普通产品')),
                    'developer': str(row.get(developer_column, '')) if developer_column and pd.notna(row.get(developer_column)) else None,
                    'included_items': str(row.get('包含单品', '')) if pd.notna(row.get('包含单品')) else None,
                    'image': str(row.get('图片链接', '')) if pd.notna(row.get('图片链接')) else None,
                    'create_time': create_time if create_time else pd.Timestamp.now(),
                    'update_time': pd.Timestamp.now()
                })
                
            except Exception as e:
                failed_count += 1
                errors.append(f"第{index + 2}行: {str(e)}")
        
        # 开始事务
        conn = await service.mysql.begin_transaction()
        
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # 检查数据库中已存在的SKU
                if valid_products:
                    skus_to_check = [p['sku'] for p in valid_products]
                    placeholders = ','.join(['%s'] * len(skus_to_check))
                    await cursor.execute(
                        f"SELECT sku FROM products WHERE sku IN ({placeholders})",
                        skus_to_check
                    )
                    existing_skus = {row['sku'] for row in await cursor.fetchall()}
                    
                    # 过滤掉已存在的SKU
                    products_to_insert = [
                        p for p in valid_products if p['sku'] not in existing_skus
                    ]
                    
                    # 批量插入
                    if products_to_insert:
                        insert_query = """
                            INSERT INTO products (sku, name, type, developer, included_items, image, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        
                        insert_params = []
                        for p in products_to_insert:
                            insert_params.append((
                                p['sku'],
                                p['name'],
                                p['type'],
                                p['developer'],
                                p['included_items'],
                                p['image'],
                                p['create_time'],
                                p['update_time']
                            ))
                        
                        await cursor.executemany(insert_query, insert_params)
                        success_count = len(products_to_insert)
                        
                        # 记录重复的SKU
                        duplicate_in_db = len(valid_products) - success_count
                        for p in valid_products:
                            if p['sku'] in existing_skus:
                                errors.append(f"SKU {p['sku']} 已存在于数据库中")
                                failed_count += 1
            
            # 提交事务
            await service.mysql.commit_transaction(conn)
            
        except Exception as e:
            # 回滚事务
            await service.mysql.rollback_transaction(conn)
            logger.error(f"导入产品失败，已回滚事务: {e}")
            raise HTTPException(status_code=500, detail=f"导入产品失败: {str(e)}")
        
        return {
            "code": 200,
            "message": f"导入完成，成功{success_count}条，失败{failed_count}条",
            "data": {
                "success": success_count,
                "failed": failed_count,
                "errors": errors[:10]  # 只返回前10个错误
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入产品失败: {e}")
        raise HTTPException(status_code=500, detail="导入产品失败")
