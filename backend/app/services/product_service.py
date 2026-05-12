from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import logging

from ..models.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductQueryParams,
    ProductStatsResponse,
    CategoryInfo
)
from ..repositories.mysql_repo import MySQLRepository
from ..repositories.redis_repo import RedisRepository

logger = logging.getLogger(__name__)


class ProductService:
    """
    产品服务类

    提供产品管理的业务逻辑，包括CRUD操作、查询、统计等
    使用SKU作为产品的主键
    """
    
    def __init__(
        self,
        mysql: MySQLRepository,
        redis: Optional[RedisRepository] = None
    ):
        self.mysql = mysql
        self.redis = redis
    
    async def create_product(self, product_data: ProductCreate) -> ProductResponse:
        """
        创建产品
        
        Args:
            product_data: 产品创建数据
            
        Returns:
            ProductResponse: 创建的产品信息
            
        Raises:
            Exception: 创建失败时抛出异常
        """
        try:
            now = datetime.now()
            
            # 构建产品数据
            product_dict = {
                'sku': product_data.sku,
                'name': product_data.name,
                'description': product_data.description,
                'category': product_data.category,
                'tags': json.dumps(product_data.tags or [], ensure_ascii=False),
                'price': product_data.price,
                'stock': product_data.stock,
                'image': product_data.image,
                'type': product_data.type,
                'created_at': now,
                'updated_at': now
            }
            
            # 插入数据库
            await self.mysql.execute_insert(
                'INSERT INTO products (sku, name, description, category, tags, price, stock, image, type, created_at, updated_at) '
                'VALUES (%(sku)s, %(name)s, %(description)s, %(category)s, %(tags)s, %(price)s, %(stock)s, %(image)s, %(type)s, %(created_at)s, %(updated_at)s)',
                product_dict
            )
            
            # 获取完整的产品信息
            product = await self.get_product_by_sku(product_data.sku)
            
            logger.info(f"[OK] 创建产品成功 | SKU: {product_data.sku}")
            return product
            
        except Exception as e:
            logger.error(f"[FAIL] 创建产品失败 | SKU: {product_data.sku} | 错误: {e}")
            raise
    
    async def get_product_by_sku(self, sku: str) -> Optional[ProductResponse]:
        """
        根据SKU获取产品
        
        Args:
            sku: 产品SKU
            
        Returns:
            ProductResponse: 产品信息，不存在则返回None
        """
        try:
            # 检查缓存
            cache_key = f"product:{sku}"
            if self.redis:
                cached = await self.redis.cache_get(cache_key)
                if cached:
                    logger.debug(f"[OK] 从缓存获取产品 | SKU: {sku}")
                    # 将缓存的字典转换为ProductResponse对象
                    return ProductResponse(**cached)
            
            # 从数据库获取
            query = 'SELECT * FROM products WHERE sku = %s AND status = \'normal\''
            result = await self.mysql.execute_query_one(query, (sku,))
            
            if result:
                product = self._db_to_product_response(result)
                
                # 存入缓存
                if self.redis:
                    await self.redis.cache_set(cache_key, product.dict(), expire=3600)
                
                logger.debug(f"[OK] 获取产品成功 | SKU: {sku}")
                return product
            
            return None
            
        except Exception as e:
            logger.error(f"[FAIL] 获取产品失败 | SKU: {sku} | 错误: {e}")
            raise
    
    async def get_products(
        self,
        page: int = 1,
        size: int = 12,
        params: Optional[ProductQueryParams] = None
    ) -> ProductListResponse:
        """
        获取产品列表
        
        Args:
            page: 页码
            size: 每页数量
            params: 查询参数
            
        Returns:
            ProductListResponse: 产品列表和分页信息
        """
        try:
            # 参数验证
            if size > 50:
                size = 50
                logger.warning(f"页码大小超出限制，已调整为50")
            
            # 构建缓存键
            cache_key = f"products:list:{page}:{size}:{params.dict() if params else 'default'}"
            
            # 尝试从缓存获取
            if self.redis:
                cached_result = await self.redis.cache_get(cache_key)
                if cached_result:
                    logger.debug(f"[OK] 从缓存获取产品列表 | 页码: {page} | 数量: {size}")
                    # 重建ProductListResponse对象
                    return ProductListResponse(**cached_result)
            
            # 构建查询条件
            conditions = []
            values = []
            
            if params:
                if params.sku:
                    conditions.append('sku LIKE %s')
                    values.append(f'%{params.sku}%')
                
                if params.name:
                    conditions.append('name LIKE %s')
                    values.append(f'%{params.name}%')
                
                if params.type:
                    conditions.append('type = %s')
                    values.append(params.type)
                
                if params.category:
                    conditions.append('category = %s')
                    values.append(params.category)
                
                if params.min_price is not None:
                    conditions.append('price >= %s')
                    values.append(params.min_price)
                
                if params.max_price is not None:
                    conditions.append('price <= %s')
                    values.append(params.max_price)
            
            where_clause = ' AND '.join(conditions) if conditions else '1=1'
            
            # 添加状态过滤，只显示正常状态的产品
            if where_clause != '1=1':
                where_clause += " AND status = 'normal'"
            else:
                where_clause = "status = 'normal'"
            
            # 排序
            sort_by = params.sort_by if params else 'created_at'
            sort_order = params.sort_order if params else 'desc'
            order_clause = f'ORDER BY {sort_by} {sort_order}'
            
            # 计算偏移量
            offset = (page - 1) * size
            
            # 查询总数
            count_query = f'SELECT COUNT(*) as total FROM products WHERE {where_clause}'
            count_result = await self.mysql.execute_query_one(count_query, values)
            total = count_result['total'] if count_result else 0
            
            # 查询列表
            list_query = f'''
                SELECT * FROM products 
                WHERE {where_clause} 
                {order_clause} 
                LIMIT %s OFFSET %s
            '''
            values.extend([size, offset])
            
            results = await self.mysql.execute_query(list_query, values)
            
            # 转换为响应格式
            products = self._batch_db_to_product_response(results)
            
            # 构建响应对象
            response = ProductListResponse(
                list=products,
                total=total,
                page=page,
                size=size
            )
            
            # 存入缓存
            if self.redis:
                await self.redis.cache_set(cache_key, response.dict(), expire=300)  # 缓存5分钟
            
            logger.debug(f"[OK] 获取产品列表成功 | 页码: {page} | 数量: {len(products)}")
            
            return response
            
        except Exception as e:
            logger.error(f"[FAIL] 获取产品列表失败 | 错误: {e}")
            raise
    
    async def update_product(self, sku: str, product_data: ProductUpdate) -> ProductResponse:
        """
        更新产品
        
        Args:
            sku: 产品SKU
            product_data: 产品更新数据
            
        Returns:
            ProductResponse: 更新后的产品信息
            
        Raises:
            Exception: 更新失败时抛出异常
        """
        try:
            # 构建更新数据
            update_fields = []
            values = []
            
            if product_data.name is not None:
                update_fields.append('name = %s')
                values.append(product_data.name)
            
            if product_data.description is not None:
                update_fields.append('description = %s')
                values.append(product_data.description)
            
            if product_data.category is not None:
                update_fields.append('category = %s')
                values.append(product_data.category)
            
            if product_data.tags is not None:
                update_fields.append('tags = %s')
                values.append(json.dumps(product_data.tags, ensure_ascii=False))
            
            if product_data.price is not None:
                update_fields.append('price = %s')
                values.append(product_data.price)
            
            if product_data.stock is not None:
                update_fields.append('stock = %s')
                values.append(product_data.stock)
            
            if product_data.type is not None:
                update_fields.append('type = %s')
                values.append(product_data.type)
            
            if product_data.image is not None:
                update_fields.append('image = %s')
                values.append(product_data.image)
            
            if not update_fields:
                raise ValueError("没有提供需要更新的字段")
            
            # 添加更新时间
            update_fields.append('updated_at = %s')
            values.append(datetime.now())
            
            # 添加SKU条件
            values.append(sku)
            
            # 执行更新
            update_query = f'''
                UPDATE products 
                SET {', '.join(update_fields)} 
                WHERE sku = %s
            '''
            await self.mysql.execute_update(update_query, tuple(values))
            
            # 清除缓存（不等待完成）
            self._clear_product_cache(sku)
            
            # 获取更新后的产品
            product = await self.get_product_by_sku(sku)
            
            logger.info(f"[OK] 更新产品成功 | SKU: {sku}")
            return product
            
        except Exception as e:
            logger.error(f"[FAIL] 更新产品失败 | SKU: {sku} | 错误: {e}")
            raise
    
    async def delete_product(self, sku: str) -> bool:
        """
        软删除产品（移动到回收站状态）
        
        Args:
            sku: 产品SKU
            
        Returns:
            bool: 删除是否成功
            
        Raises:
            Exception: 删除失败时抛出异常
        """
        try:
            # 检查产品是否存在
            product = await self.get_product_by_sku(sku)
            if not product:
                logger.warning(f"[WARN] 删除失败：产品SKU {sku} 不存在")
                return False
            
            # 开始事务
            conn = await self.mysql.begin_transaction()
            cursor = None
            
            try:
                # 创建游标
                cursor = await conn.cursor()
                
                # 将产品数据保存到回收站
                import json
                original_data = {
                    'sku': product.sku,
                    'name': product.name,
                    'product_type': product.type,
                    'description': product.description,
                    'developer': product.developer if hasattr(product, 'developer') else None,
                    'image_url': product.image_url if hasattr(product, 'image_url') else None,
                    'local_path': product.local_path if hasattr(product, 'local_path') else None,
                    'thumb_path': product.thumb_path if hasattr(product, 'thumb_path') else None,
                    'create_time': product.created_at.isoformat() if product.created_at else None,
                    'update_time': product.updated_at.isoformat() if product.updated_at else None
                }
                
                # 插入回收站表
                insert_recycle_query = """
                INSERT INTO recycle_bin (product_sku, original_data, deleted_at, expires_at, deleted_by)
                VALUES (%s, %s, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1)
                """
                await cursor.execute(insert_recycle_query, (sku, json.dumps(original_data, ensure_ascii=False)))
                
                # 软删除产品（更新状态和删除时间）
                # 根据数据库实际状态值，将状态设置为'deleted'
                update_query = '''
                    UPDATE products 
                    SET status = 'deleted', delete_time = NOW(), updated_at = NOW()
                    WHERE sku = %s
                '''
                await cursor.execute(update_query, (sku,))
                
                # 删除对应SKU的图片记录
                delete_images_query = '''
                    DELETE FROM images 
                    WHERE sku = %s
                '''
                await cursor.execute(delete_images_query, (sku,))
                image_delete_result = cursor.rowcount
                
                # 提交事务
                await self.mysql.commit_transaction(conn)
                
                # 清除缓存（不等待完成）
                self._clear_product_cache(sku)
                
                logger.info(f"[OK] 软删除产品成功 | SKU: {sku} | 删除图片记录数: {image_delete_result}")
                return True
                
            except Exception as e:
                # 回滚事务
                await self.mysql.rollback_transaction(conn)
                raise
            finally:
                # 关闭游标
                if cursor:
                    await cursor.close()
            
        except Exception as e:
            logger.error(f"[FAIL] 软删除产品失败 | SKU: {sku} | 错误: {e}")
            raise
    
    async def batch_delete_products(self, skus: List[str]) -> int:
        """
        批量软删除产品（移动到回收站状态）
        
        Args:
            skus: 产品SKU列表
            
        Returns:
            int: 删除的产品数量
            
        Raises:
            Exception: 删除失败时抛出异常
        """
        try:
            if not skus:
                return 0
            
            # 检查存在的SKU
            placeholders = ','.join(['%s'] * len(skus))
            check_query = f'SELECT sku FROM products WHERE sku IN ({placeholders}) AND status = \'normal\''
            existing_skus = await self.mysql.execute_query(check_query, tuple(skus))
            
            if not existing_skus:
                logger.warning(f"[WARN] 批量删除失败：没有找到有效的产品SKU")
                return 0
            
            valid_skus = [sku['sku'] for sku in existing_skus]
            
            # 开始事务
            conn = await self.mysql.begin_transaction()
            cursor = None
            
            try:
                # 创建游标
                cursor = await conn.cursor()
                
                # 获取产品完整信息，用于写入回收站
                import json
                products_query = f'''
                    SELECT sku, name, type, description, developer, image_url, local_path, thumb_path, created_at, updated_at
                    FROM products 
                    WHERE sku IN ({placeholders})
                '''
                await cursor.execute(products_query, tuple(valid_skus))
                products_data = await cursor.fetchall()
                
                # 将产品数据批量保存到回收站
                if products_data:
                    insert_recycle_query = """
                        INSERT INTO recycle_bin (product_sku, original_data, deleted_at, expires_at, deleted_by)
                        VALUES (%s, %s, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1)
                    """
                    recycle_data = []
                    for product in products_data:
                        original_data = {
                            'sku': product['sku'],
                            'name': product['name'],
                            'product_type': product['type'],
                            'description': product['description'],
                            'developer': product['developer'],
                            'image_url': product['image_url'],
                            'local_path': product['local_path'],
                            'thumb_path': product['thumb_path'],
                            'create_time': product['created_at'].isoformat() if product['created_at'] else None,
                            'update_time': product['updated_at'].isoformat() if product['updated_at'] else None
                        }
                        recycle_data.append((product['sku'], json.dumps(original_data, ensure_ascii=False)))
                    
                    await cursor.executemany(insert_recycle_query, recycle_data)
                
                # 批量软删除产品（更新状态和删除时间）
                update_placeholders = ','.join(['%s'] * len(valid_skus))
                update_query = f'''
                    UPDATE products 
                    SET status = 'deleted', delete_time = NOW(), updated_at = NOW()
                    WHERE sku IN ({update_placeholders})
                '''
                await cursor.execute(update_query, tuple(valid_skus))
                
                # 批量删除对应SKU的图片记录
                delete_images_query = f'''
                    DELETE FROM images 
                    WHERE sku IN ({update_placeholders})
                '''
                await cursor.execute(delete_images_query, tuple(valid_skus))
                image_delete_result = cursor.rowcount
                
                # 提交事务
                await self.mysql.commit_transaction(conn)
                
                # 清除缓存（不等待完成）
                for sku in valid_skus:
                    self._clear_product_cache(sku)
                
                logger.info(f"[OK] 批量软删除产品成功 | 数量: {len(valid_skus)} | 删除图片记录数: {image_delete_result}")
                return len(valid_skus)
                
            except Exception as e:
                # 回滚事务
                await self.mysql.rollback_transaction(conn)
                raise
            finally:
                # 关闭游标
                if cursor:
                    await cursor.close()
            
        except Exception as e:
            logger.error(f"[FAIL] 批量软删除产品失败 | 错误: {e}")
            raise
    
    async def get_product_stats(self) -> ProductStatsResponse:
        """
        获取产品统计信息
        
        Returns:
            ProductStatsResponse: 产品统计数据
        """
        try:
            # 总产品数（只统计正常状态的产品）
            total_query = 'SELECT COUNT(*) as total FROM products WHERE status = \'normal\''
            total_result = await self.mysql.execute_query_one(total_query)
            total_products = total_result['total'] if total_result else 0
            
            # 按类型统计（只统计正常状态的产品）
            type_query = '''
                SELECT type, COUNT(*) as count 
                FROM products 
                WHERE status = 'normal'
                GROUP BY type
            '''
            type_results = await self.mysql.execute_query(type_query)
            
            type_counts = {row['type']: row['count'] for row in type_results}
            
            # 分类数
            category_query = 'SELECT COUNT(DISTINCT category) as count FROM products WHERE category IS NOT NULL'
            category_result = await self.mysql.execute_query_one(category_query)
            total_categories = category_result['count'] if category_result else 0
            
            # 总图片数
            image_query = 'SELECT COUNT(*) as count FROM images'
            image_result = await self.mysql.execute_query_one(image_query)
            total_images = image_result['count'] if image_result else 0
            
            logger.debug(f"[OK] 获取产品统计成功")
            
            return ProductStatsResponse(
                totalProducts=total_products,
                activeProducts=type_counts.get('普通产品', 0),
                inactiveProducts=type_counts.get('组合产品', 0),
                draftProducts=type_counts.get('定制产品', 0),
                totalCategories=total_categories,
                totalImages=total_images
            )
            
        except Exception as e:
            logger.error(f"[FAIL] 获取产品统计失败 | 错误: {e}")
            raise
    
    async def get_categories(self) -> List[CategoryInfo]:
        """
        获取分类统计
        
        Returns:
            List[CategoryInfo]: 分类列表及其产品数量
        """
        try:
            query = '''
                SELECT category, COUNT(*) as count 
                FROM products 
                WHERE category IS NOT NULL 
                GROUP BY category 
                ORDER BY count DESC
            '''
            results = await self.mysql.execute_query(query)
            
            categories = [
                CategoryInfo(
                    category=row['category'],
                    count=row['count']
                )
                for row in results
            ]
            
            logger.debug(f"[OK] 获取分类统计成功 | 数量: {len(categories)}")
            return categories
            
        except Exception as e:
            logger.error(f"[FAIL] 获取分类统计失败 | 错误: {e}")
            raise
    
    async def get_all_skus(
        self, 
        product_type: Optional[str] = None
    ) -> List[str]:
        """
        获取所有产品的SKU列表
        
        Args:
            product_type: 产品类型（可选），不传则返回所有类型
            
        Returns:
            SKU列表
        """
        try:
            where_clause = "status = 'normal'"
            params = []
            
            if product_type and product_type.strip() and product_type.strip() != "":
                where_clause = "type = %s AND status = 'normal'"
                params.append(product_type.strip())
            
            query = f"""
                SELECT sku
                FROM products
                WHERE {where_clause}
                ORDER BY created_at DESC
            """
            
            results = await self.mysql.execute_query(query, tuple(params))
            skus = [result['sku'] for result in results]
            
            logger.info(f"[OK] 获取SKU列表成功 | 数量: {len(skus)}")
            return skus
            
        except Exception as e:
            logger.error(f"[FAIL] 获取SKU列表失败 | 错误: {e}")
            raise
    
    async def get_all_products(self) -> List[Dict[str, Any]]:
        """
        获取所有产品
        
        Returns:
            List[Dict]: 所有产品列表
        """
        try:
            query = '''
                SELECT sku, name, description, category, tags, price, stock, image, type, created_at, updated_at
                FROM products
                WHERE status = 'normal'
                ORDER BY created_at DESC
            '''
            results = await self.mysql.execute_query(query)
            
            products = []
            for row in results:
                product = {
                    'sku': row['sku'],
                    'name': row['name'],
                    'description': row.get('description'),
                    'category': row.get('category'),
                    'tags': row.get('tags'),
                    'price': row.get('price'),
                    'stock': row.get('stock'),
                    'image': row.get('image'),
                    'type': row.get('type'),
                    'createdAt': row['created_at'],
                    'updatedAt': row['updated_at']
                }
                products.append(product)
            
            logger.info(f"[OK] 获取所有产品成功 | 数量: {len(products)}")
            return products
            
        except Exception as e:
            logger.error(f"[FAIL] 获取所有产品失败 | 错误: {e}")
            raise
    
    def _clear_product_cache(self, sku: str):
        """
        清除产品缓存
        
        Args:
            sku: 产品SKU
        """
        if self.redis:
            cache_key = f"product:{sku}"
            # 异步删除缓存
            import asyncio
            asyncio.create_task(self.redis.cache_delete(cache_key))
    
    def _db_to_product_response(self, row: Dict[str, Any]) -> ProductResponse:
        """
        将数据库行转换为ProductResponse
        
        Args:
            row: 数据库行数据
            
        Returns:
            ProductResponse: 产品响应对象
        """
        # 解析tags JSON
        tags = []
        if row.get('tags'):
            try:
                tags = json.loads(row['tags'])
            except json.JSONDecodeError:
                tags = []
        
        return ProductResponse(
            sku=row['sku'],
            name=row['name'],
            description=row.get('description'),
            category=row.get('category'),
            tags=tags,
            price=row.get('price'),
            stock=row.get('stock'),
            image=row.get('image'),
            type=row['type'],
            developer=row.get('developer'),
            local_path=row.get('local_path'),
            thumb_path=row.get('thumb_path'),
            included_items=row.get('included_items'),
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
    
    def _batch_db_to_product_response(self, rows: List[Dict[str, Any]]) -> List[ProductResponse]:
        """
        批量将数据库行转换为ProductResponse
        
        Args:
            rows: 数据库行数据列表
            
        Returns:
            List[ProductResponse]: 产品响应对象列表
        """
        products = []
        for row in rows:
            products.append(self._db_to_product_response(row))
        return products