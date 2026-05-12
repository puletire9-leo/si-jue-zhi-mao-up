"""
[参考] 导入功能API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ImportController.java

最终删除日期：项目稳定运行后
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import Optional
import logging
import pandas as pd
import aiomysql
from io import BytesIO

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["导入功能"])


def get_mysql_repo():
    """
    依赖注入：获取MySQL仓库实例
    
    Returns:
        MySQLRepository实例
    """
    from fastapi import Request
    
    def _get_repo(request: Request):
        return request.app.state.mysql
    
    return Depends(_get_repo)


@router.post("/products", summary="导入产品")
async def import_products(
    file: UploadFile = File(..., description="Excel文件"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    导入产品数据（Excel文件）
    
    - **file**: Excel文件（.xlsx或.xls）
    
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
        
        # 验证必需列
        required_columns = ['SKU', '产品名称']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件缺少必需的列: {', '.join(missing_columns)}"
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
                sku = str(row.get('SKU', '')).strip()
                name = str(row.get('产品名称', '')).strip()
                
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
                    'developer': str(row.get('开发者', '')) if pd.notna(row.get('开发者')) else None,
                    'included_items': str(row.get('包含单品', '')) if pd.notna(row.get('包含单品')) else None,
                    'image': str(row.get('图片链接', '')) if pd.notna(row.get('图片链接')) else None,
                    'create_time': create_time if create_time else pd.Timestamp.now(),
                    'update_time': pd.Timestamp.now()
                })
                
            except Exception as e:
                failed_count += 1
                errors.append(f"第{index + 2}行: {str(e)}")
        
        # 开始事务
        conn = await repo.begin_transaction()
        
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
            await repo.commit_transaction(conn)
            
        except Exception as e:
            # 回滚事务
            await repo.rollback_transaction(conn)
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


@router.post("/images", summary="导入图片")
async def import_images(
    file: UploadFile = File(..., description="Excel文件"),
    repo: MySQLRepository = get_mysql_repo()
):
    """
    导入图片数据（Excel文件）
    
    - **file**: Excel文件（.xlsx或.xls）
    
    返回导入结果
    """
    try:
        # 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="只支持.xlsx或.xls格式的Excel文件"
            )
        
        # 读取Excel文件
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        # 验证必需列
        required_columns = ['文件名', '分类']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Excel文件缺少必需的列: {', '.join(missing_columns)}"
            )
        
        # 导入数据
        success_count = 0
        failed_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                filename = str(row.get('文件名', '')).strip()
                category = str(row.get('分类', '')).strip()
                
                if not filename or not category:
                    failed_count += 1
                    errors.append(f"第{index + 2}行: 文件名或分类不能为空")
                    continue
                
                # 插入图片记录
                await repo.execute_query(
                    """
                    INSERT INTO images (filename, filepath, category, tags, 
                                     description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """,
                    (
                        filename,
                        str(row.get('文件路径', '')),
                        category,
                        str(row.get('标签', '')),
                        str(row.get('描述', ''))
                    )
                )
                
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append(f"第{index + 2}行: {str(e)}")
        
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
        logger.error(f"导入图片失败: {e}")
        raise HTTPException(status_code=500, detail="导入图片失败")


@router.get("/template/products", summary="下载产品导入模板")
async def download_product_template():
    """
    下载产品导入模板
    
    返回Excel模板文件，包含以下字段：
    - SKU（必填）
    - 产品名称（必填）
    - 创建时间
    - 产品类型
    - 包含单品
    - 开发者
    - 图片链接
    """
    try:
        # 创建模板数据
        template_data = {
            'SKU': ['SKU001', 'SKU002', 'SKU003'],
            '产品名称': ['示例产品1', '示例产品2', '示例产品3'],
            '创建时间': ['2024-01-01 10:00:00', '2024-01-02 11:00:00', '2024-01-03 12:00:00'],
            '产品类型': ['普通产品', '组合产品', '定制产品'],
            '包含单品': ['', '2570009*1;2570010*1', ''],
            '开发者': ['开发者A', '开发者B', '开发者C'],
            '图片链接': ['http://example.com/image1.jpg', 'http://example.com/image2.jpg', 'http://example.com/image3.jpg']
        }
        
        df = pd.DataFrame(template_data)
        
        # 生成Excel文件
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='产品导入模板')
            
            # 获取工作表对象以设置列宽
            worksheet = writer.sheets['产品导入模板']
            
            # 设置列宽
            column_widths = {
                'A': 15,  # SKU
                'B': 30,  # 产品名称
                'C': 25,  # 创建时间
                'D': 15,  # 产品类型
                'E': 30,  # 包含项目
                'F': 15,  # 开发者
                'G': 40   # 图片链接
            }
            
            for col, width in column_widths.items():
                worksheet.column_dimensions[col].width = width
                
        output.seek(0)
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=product_import_template.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"下载产品模板失败: {e}")
        raise HTTPException(status_code=500, detail="下载产品模板失败")


@router.get("/template/images", summary="下载图片导入模板")
async def download_image_template():
    """
    下载图片导入模板
    
    返回Excel模板文件
    """
    try:
        # 创建模板数据
        template_data = {
            '文件名': ['image001.jpg', 'image002.jpg'],
            '文件路径': ['/path/to/image001.jpg', '/path/to/image002.jpg'],
            '分类': ['电子产品', '家居用品'],
            '标签': ['标签1,标签2', '标签3'],
            '描述': ['图片描述1', '图片描述2']
        }
        
        df = pd.DataFrame(template_data)
        
        # 生成Excel文件
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='图片导入模板')
        output.seek(0)
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=image_import_template.xlsx"}
        )
        
    except Exception as e:
        logger.error(f"下载图片模板失败: {e}")
        raise HTTPException(status_code=500, detail="下载图片模板失败")
