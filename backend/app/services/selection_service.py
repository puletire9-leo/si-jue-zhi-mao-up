import logging
from typing import Optional, List
from datetime import datetime

from ..models.selection import (
    SelectionProductCreate,
    SelectionProductUpdate,
    SelectionProductResponse,
    SelectionProductQueryParams,
    SelectionStatsResponse,
    StoreInfo
)
from ..repositories.mysql_repo import MySQLRepository

logger = logging.getLogger(__name__)


class SelectionService:
    """
    选品服务类
    
    处理选品相关的业务逻辑
    """
    
    def __init__(self, mysql: MySQLRepository, redis=None):
        """
        初始化选品服务
        
        Args:
            mysql: MySQL仓库实例
            redis: Redis仓库实例（可选）
        """
        self.mysql = mysql
        self.redis = redis
        
    async def create_product(self, product: SelectionProductCreate) -> SelectionProductResponse:
        """
        创建新的选品产品
        
        Args:
            product: 选品产品创建数据
            
        Returns:
            创建的选品产品信息
            
        Raises:
            Exception: 创建失败时抛出异常
        """
        try:
            now = datetime.now()
            
            query = """
                INSERT INTO selection_products 
                (asin, product_title, price, image_url, local_path, thumb_path, 
                 store_name, store_url, category, tags, notes, product_type,
                 product_link, sales_volume, listing_date, delivery_method, 
                 similar_products, source, country, data_filter_mode, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            params = (
                product.asin,
                product.product_title,
                product.price,
                product.image_url,
                product.local_path,
                product.thumb_path,
                product.store_name,
                product.store_url,
                product.category,
                ','.join(product.tags) if product.tags else None,
                product.notes,
                product.product_type,
                product.product_link,
                product.sales_volume,
                product.listing_date,
                product.delivery_method,
                product.similar_products,
                product.source,
                product.country,
                product.data_filter_mode,
                now,
                now
            )
            
            result = await self.mysql.execute_insert(query, params)
            product_id = result['last_id']
            
            return SelectionProductResponse(
                id=product_id,
                asin=product.asin,
                product_title=product.product_title,
                price=product.price,
                image_url=product.image_url,
                local_path=product.local_path,
                thumb_path=product.thumb_path,
                store_name=product.store_name,
                store_url=product.store_url,
                category=product.category,
                tags=product.tags,
                notes=product.notes,
                product_link=product.product_link,
                sales_volume=product.sales_volume,
                delivery_method=product.delivery_method,
                similar_products=product.similar_products,
                source=product.source,
                country=product.country,
                data_filter_mode=product.data_filter_mode,
                product_type=product.product_type,
                created_at=now,
                updated_at=now
            )
            
        except Exception as e:
            logger.error(f"创建选品产品失败: {e}")
            raise Exception(f"创建选品产品失败: {str(e)}")
    
    async def get_products(
        self, 
        page: int = 1, 
        size: int = 60, 
        params: Optional[SelectionProductQueryParams] = None
    ) -> dict:
        """
        获取选品产品列表
        
        Args:
            page: 页码
            size: 每页数量
            params: 查询参数
            
        Returns:
            产品列表和分页信息
        """
        try:
            offset = (page - 1) * size
            
            where_conditions = []
            query_params = []
            
            if params:
                if params.asin:
                    where_conditions.append("asin LIKE %s")
                    query_params.append(f"%{params.asin}%")
                
                if params.product_title:
                    where_conditions.append("product_title LIKE %s")
                    query_params.append(f"%{params.product_title}%")
                
                if params.product_type:
                    where_conditions.append("product_type = %s")
                    query_params.append(params.product_type)
                
                if params.store_name:
                    where_conditions.append("store_name LIKE %s")
                    query_params.append(f"%{params.store_name}%")
                
                if params.category:
                    where_conditions.append("main_category_name = %s")
                    query_params.append(params.category)
                
                # 新增筛选条件：国家
                if params.country and params.country.strip():
                    where_conditions.append("country = %s")
                    query_params.append(params.country.strip())
                    print(f"添加国家筛选条件: country = {params.country}")
                
                # 新增筛选条件：数据筛选模式
                if params.data_filter_mode and params.data_filter_mode.strip():
                    where_conditions.append("data_filter_mode = %s")
                    query_params.append(params.data_filter_mode.strip())
                    print(f"添加数据筛选模式条件: data_filter_mode = {params.data_filter_mode}")
                
                # 新增筛选条件：上架时间范围
                if params.listing_date_start and params.listing_date_start.strip():
                    where_conditions.append("listing_date >= %s")
                    query_params.append(params.listing_date_start.strip())
                    print(f"添加上架时间开始条件: listing_date >= {params.listing_date_start}")
                
                if params.listing_date_end and params.listing_date_end.strip():
                    where_conditions.append("listing_date <= %s")
                    query_params.append(params.listing_date_end.strip())

                # 新增筛选条件：等级（支持多选，逗号分隔）
                if params.grade and params.grade.strip():
                    grades = [g.strip() for g in params.grade.split(',') if g.strip()]
                    if grades:
                        placeholders = ','.join(['%s'] * len(grades))
                        where_conditions.append(f"grade IN ({placeholders})")
                        query_params.extend(grades)

                # 新增筛选条件：周标记
                if params.week_tag and params.week_tag.strip():
                    where_conditions.append("week_tag = %s")
                    query_params.append(params.week_tag.strip())

                # 新增筛选条件：本周/往期
                if params.is_current is not None:
                    where_conditions.append("is_current = %s")
                    query_params.append(params.is_current)

            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # 前端字段名到数据库字段名的映射
            field_mapping = {
                "salesVolume": "sales_volume",
                "price": "price",
                "listingDate": "listing_date",
                "createdAt": "created_at",
                "score": "score"
            }

            # 获取前端传递的排序字段，默认为score
            frontend_sort_by = params.sort_by if params and params.sort_by else "score"

            # 映射到数据库字段名，如果映射不存在则使用原字段名
            sort_by = field_mapping.get(frontend_sort_by, frontend_sort_by)
            sort_order = params.sort_order if params and params.sort_order else "desc"

            # 默认排序：本周数据优先 + 按评分降序
            if sort_by == "score":
                order_clause = f"is_current DESC, score {sort_order}, created_at DESC"
            else:
                order_clause = f"{sort_by} {sort_order}"
            
            count_query = f"SELECT COUNT(*) as total FROM selection_products WHERE {where_clause}"
            count_result = await self.mysql.execute_query_one(count_query, tuple(query_params))
            total = count_result['total'] if count_result else 0
            
            list_query = f"""
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                       product_link, sales_volume, listing_date, delivery_method,
                       similar_products, source, country, data_filter_mode,
                       score, grade, week_tag, is_current,
                       created_at, updated_at
                FROM selection_products
                WHERE {where_clause}
                ORDER BY {order_clause}
                LIMIT %s OFFSET %s
            """
            
            # 调试日志：打印实际执行的SQL
            logger.info(f"执行的SQL查询: {list_query}")
            
            list_params = query_params + [size, offset]
            products = await self.mysql.execute_query(list_query, tuple(list_params))
            
            product_list = []
            for product in products:
                product_list.append(SelectionProductResponse(
                    id=product['id'],
                    asin=product['asin'],
                    product_title=product['product_title'],
                    price=product['price'],
                    image_url=product['image_url'],
                    local_path=product['local_path'],
                    thumb_path=product['thumb_path'],
                    store_name=product['store_name'],
                    store_url=product['store_url'],
                    shop_id=product.get('shop_id'),
                    main_category_name=product.get('main_category_name'),
                    main_category_rank=product.get('main_category_rank'),
                    main_category_bsr_growth=product.get('main_category_bsr_growth'),
                    main_category_bsr_growth_rate=product.get('main_category_bsr_growth_rate'),
                    tags=product['tags'].split(',') if product['tags'] else [],
                    notes=product['notes'],
                    product_link=product.get('product_link'),
                    sales_volume=product.get('sales_volume'),
                    listing_date=product.get('listing_date'),
                    delivery_method=product.get('delivery_method'),
                    similar_products=product.get('similar_products'),
                    source=product.get('source'),
                    country=product.get('country'),
                    data_filter_mode=product.get('data_filter_mode'),
                    product_type=product.get('product_type', 'new'),
                    score=product.get('score'),
                    grade=product.get('grade'),
                    week_tag=product.get('week_tag'),
                    is_current=product.get('is_current', 0),
                    created_at=product['created_at'],
                    updated_at=product['updated_at']
                ))
            
            return {
                "list": product_list,
                "total": total,
                "page": page,
                "size": size
            }

        except Exception as e:
            logger.error(f"获取选品产品列表失败: {e}")
            raise Exception(f"获取选品产品列表失败: {str(e)}")

    async def get_products_by_source(
        self,
        page: int = 1,
        size: int = 60,
        params: Optional[SelectionProductQueryParams] = None
    ) -> dict:
        """
        根据source字段模糊匹配获取选品产品列表

        用于新品榜和竞品店铺的筛选，支持source字段的模糊匹配

        Args:
            page: 页码
            size: 每页数量
            params: 查询参数，包含source关键词用于模糊匹配

        Returns:
            产品列表和分页信息
        """
        try:
            offset = (page - 1) * size

            where_conditions = []
            query_params = []

            if params:
                if params.asin:
                    where_conditions.append("asin LIKE %s")
                    query_params.append(f"%{params.asin}%")

                if params.product_title:
                    where_conditions.append("product_title LIKE %s")
                    query_params.append(f"%{params.product_title}%")

                # source字段模糊匹配
                if params.source:
                    where_conditions.append("source LIKE %s")
                    query_params.append(f"%{params.source}%")

                if params.store_name:
                    where_conditions.append("store_name LIKE %s")
                    query_params.append(f"%{params.store_name}%")

                if params.category:
                    where_conditions.append("main_category_name = %s")
                    query_params.append(params.category)
                
                # 新增筛选条件：国家
                if params.country and params.country.strip():
                    where_conditions.append("country = %s")
                    query_params.append(params.country.strip())
                    print(f"[get_products_by_source] 添加国家筛选条件: country = {params.country}")
                
                # 新增筛选条件：数据筛选模式
                if params.data_filter_mode and params.data_filter_mode.strip():
                    where_conditions.append("data_filter_mode = %s")
                    query_params.append(params.data_filter_mode.strip())
                    print(f"[get_products_by_source] 添加数据筛选模式条件: data_filter_mode = {params.data_filter_mode}")
                
                # 新增筛选条件：上架时间范围
                if params.listing_date_start and params.listing_date_start.strip():
                    where_conditions.append("listing_date >= %s")
                    query_params.append(params.listing_date_start.strip())
                    print(f"[get_products_by_source] 添加上架时间开始条件: listing_date >= {params.listing_date_start}")
                
                if params.listing_date_end and params.listing_date_end.strip():
                    where_conditions.append("listing_date <= %s")
                    query_params.append(params.listing_date_end.strip())

                # 新增筛选条件：等级（支持多选，逗号分隔）
                if params.grade and params.grade.strip():
                    grades = [g.strip() for g in params.grade.split(',') if g.strip()]
                    if grades:
                        placeholders = ','.join(['%s'] * len(grades))
                        where_conditions.append(f"grade IN ({placeholders})")
                        query_params.extend(grades)

                # 新增筛选条件：周标记
                if params.week_tag and params.week_tag.strip():
                    where_conditions.append("week_tag = %s")
                    query_params.append(params.week_tag.strip())

                # 新增筛选条件：本周/往期
                if params.is_current is not None:
                    where_conditions.append("is_current = %s")
                    query_params.append(params.is_current)

            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

            # 前端字段名到数据库字段名的映射
            field_mapping = {
                "salesVolume": "sales_volume",
                "price": "price",
                "listingDate": "listing_date",
                "createdAt": "created_at",
                "score": "score"
            }

            # 获取前端传递的排序字段，默认为score
            frontend_sort_by = params.sort_by if params and params.sort_by else "score"

            # 映射到数据库字段名，如果映射不存在则使用原字段名
            sort_by = field_mapping.get(frontend_sort_by, frontend_sort_by)
            sort_order = params.sort_order if params and params.sort_order else "desc"

            # 默认排序：本周数据优先 + 按评分降序
            if sort_by == "score":
                order_clause = f"is_current DESC, score {sort_order}, created_at DESC"
            else:
                order_clause = f"{sort_by} {sort_order}"

            count_query = f"SELECT COUNT(*) as total FROM selection_products WHERE {where_clause}"
            count_result = await self.mysql.execute_query_one(count_query, tuple(query_params))
            total = count_result['total'] if count_result else 0

            list_query = f"""
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                       product_link, sales_volume, listing_date, delivery_method,
                       similar_products, source, country, data_filter_mode,
                       score, grade, week_tag, is_current,
                       created_at, updated_at
                FROM selection_products
                WHERE {where_clause}
                ORDER BY {order_clause}
                LIMIT %s OFFSET %s
            """

            # 调试日志：打印实际执行的SQL
            logger.info(f"get_products_by_source执行的SQL查询: {list_query}")

            list_params = query_params + [size, offset]
            products = await self.mysql.execute_query(list_query, tuple(list_params))

            product_list = []
            for product in products:
                product_list.append(SelectionProductResponse(
                    id=product['id'],
                    asin=product['asin'],
                    product_title=product['product_title'],
                    price=product['price'],
                    image_url=product['image_url'],
                    local_path=product['local_path'],
                    thumb_path=product['thumb_path'],
                    store_name=product['store_name'],
                    store_url=product['store_url'],
                    shop_id=product.get('shop_id'),
                    main_category_name=product.get('main_category_name'),
                    main_category_rank=product.get('main_category_rank'),
                    main_category_bsr_growth=product.get('main_category_bsr_growth'),
                    main_category_bsr_growth_rate=product.get('main_category_bsr_growth_rate'),
                    tags=product['tags'].split(',') if product['tags'] else [],
                    notes=product['notes'],
                    product_link=product.get('product_link'),
                    sales_volume=product.get('sales_volume'),
                    listing_date=product.get('listing_date'),
                    delivery_method=product.get('delivery_method'),
                    similar_products=product.get('similar_products'),
                    source=product.get('source'),
                    country=product.get('country'),
                    data_filter_mode=product.get('data_filter_mode'),
                    product_type=product.get('product_type', 'new'),
                    score=product.get('score'),
                    grade=product.get('grade'),
                    week_tag=product.get('week_tag'),
                    is_current=product.get('is_current', 0),
                    created_at=product['created_at'],
                    updated_at=product['updated_at']
                ))

            return {
                "list": product_list,
                "total": total,
                "page": page,
                "size": size
            }

        except Exception as e:
            logger.error(f"根据source获取选品产品列表失败: {e}")
            raise Exception(f"根据source获取选品产品列表失败: {str(e)}")

    async def get_product_by_id(self, product_id: int) -> Optional[SelectionProductResponse]:
        """
        根据ID获取选品产品详情
        
        Args:
            product_id: 产品ID
            
        Returns:
            产品详情，如果不存在则返回None
        """
        try:
            query = """
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                       product_link, sales_volume, listing_date, delivery_method,
                       similar_products, source, country, data_filter_mode,
                       score, grade, week_tag, is_current,
                       created_at, updated_at
                FROM selection_products
                WHERE id = %s
            """
            
            product = await self.mysql.execute_query_one(query, (product_id,))
            
            if not product:
                return None
            
            return SelectionProductResponse(
                id=product['id'],
                asin=product['asin'],
                product_title=product['product_title'],
                price=product['price'],
                image_url=product['image_url'],
                local_path=product['local_path'],
                thumb_path=product['thumb_path'],
                store_name=product['store_name'],
                store_url=product['store_url'],
                shop_id=product.get('shop_id'),
                main_category_name=product.get('main_category_name'),
                main_category_rank=product.get('main_category_rank'),
                main_category_bsr_growth=product.get('main_category_bsr_growth'),
                main_category_bsr_growth_rate=product.get('main_category_bsr_growth_rate'),
                tags=product['tags'].split(',') if product['tags'] else [],
                notes=product['notes'],
                product_link=product.get('product_link'),
                sales_volume=product.get('sales_volume'),
                listing_date=product.get('listing_date'),
                delivery_method=product.get('delivery_method'),
                similar_products=product.get('similar_products'),
                source=product.get('source'),
                country=product.get('country'),
                data_filter_mode=product.get('data_filter_mode'),
                product_type=product.get('product_type', 'new'),
                score=product.get('score'),
                grade=product.get('grade'),
                week_tag=product.get('week_tag'),
                is_current=product.get('is_current', 0),
                created_at=product['created_at'],
                updated_at=product['updated_at']
            )
            
        except Exception as e:
            logger.error(f"获取选品产品详情失败: {e}")
            raise Exception(f"获取选品产品详情失败: {str(e)}")
    
    async def update_product(
        self, 
        product_id: int, 
        product: SelectionProductUpdate
    ) -> SelectionProductResponse:
        """
        更新选品产品信息
        
        Args:
            product_id: 产品ID
            product: 更新数据
            
        Returns:
            更新后的产品信息
            
        Raises:
            ValueError: 产品不存在时抛出异常
            Exception: 更新失败时抛出异常
        """
        try:
            existing = await self.get_product_by_id(product_id)
            if not existing:
                raise ValueError("产品不存在")
            
            update_fields = []
            update_params = []
            
            if product.product_title is not None:
                update_fields.append("product_title = %s")
                update_params.append(product.product_title)
            
            if product.price is not None:
                update_fields.append("price = %s")
                update_params.append(product.price)
            
            if product.image_url is not None:
                update_fields.append("image_url = %s")
                update_params.append(product.image_url)
            
            if product.local_path is not None:
                update_fields.append("local_path = %s")
                update_params.append(product.local_path)
            
            if product.thumb_path is not None:
                update_fields.append("thumb_path = %s")
                update_params.append(product.thumb_path)
            
            if product.store_name is not None:
                update_fields.append("store_name = %s")
                update_params.append(product.store_name)
            
            if product.store_url is not None:
                update_fields.append("store_url = %s")
                update_params.append(product.store_url)
            
            if product.shop_id is not None:
                update_fields.append("shop_id = %s")
                update_params.append(product.shop_id)
            
            if product.main_category_name is not None:
                update_fields.append("main_category_name = %s")
                update_params.append(product.main_category_name)
            
            if product.main_category_rank is not None:
                update_fields.append("main_category_rank = %s")
                update_params.append(product.main_category_rank)
            
            if product.main_category_bsr_growth is not None:
                update_fields.append("main_category_bsr_growth = %s")
                update_params.append(product.main_category_bsr_growth)
            
            if product.main_category_bsr_growth_rate is not None:
                update_fields.append("main_category_bsr_growth_rate = %s")
                update_params.append(product.main_category_bsr_growth_rate)
            
            if product.tags is not None:
                update_fields.append("tags = %s")
                update_params.append(','.join(product.tags))
            
            if product.notes is not None:
                update_fields.append("notes = %s")
                update_params.append(product.notes)
            
            if product.product_link is not None:
                update_fields.append("product_link = %s")
                update_params.append(product.product_link)
            
            if product.sales_volume is not None:
                update_fields.append("sales_volume = %s")
                update_params.append(product.sales_volume)
            
            if product.delivery_method is not None:
                update_fields.append("delivery_method = %s")
                update_params.append(product.delivery_method)
            
            if product.similar_products is not None:
                update_fields.append("similar_products = %s")
                update_params.append(product.similar_products)
            
            if product.source is not None:
                update_fields.append("source = %s")
                update_params.append(product.source)
            
            # 新增字段：国家
            if product.country is not None:
                update_fields.append("country = %s")
                update_params.append(product.country)
            
            # 新增字段：数据筛选模式
            if product.data_filter_mode is not None:
                update_fields.append("data_filter_mode = %s")
                update_params.append(product.data_filter_mode)
            
            if update_fields:
                update_fields.append("updated_at = %s")
                update_params.append(datetime.now())
                update_params.append(product_id)
                
                query = f"""
                    UPDATE selection_products
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                """
                
                await self.mysql.execute_update(query, update_params)
            
            return await self.get_product_by_id(product_id)
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"更新选品产品失败: {e}")
            raise Exception(f"更新选品产品失败: {str(e)}")
    
    async def delete_product(self, product_id: int) -> bool:
        """
        软删除选品产品（移动到回收站）
        
        Args:
            product_id: 产品ID
            
        Returns:
            是否删除成功
        """
        try:
            # 1. 获取产品信息（直接查询原始数据，避免模型转换）
            query = """
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                       product_link, sales_volume, listing_date, delivery_method,
                       similar_products, source, country, data_filter_mode
                FROM selection_products
                WHERE id = %s
            """
            
            product = await self.mysql.execute_query_one(query, (product_id,))
            
            if not product:
                logger.warning(f"[WARN] 删除失败：产品ID {product_id} 不存在")
                return False
            
            # 2. 使用事务确保操作的原子性
            async with self.mysql.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 开始事务
                    await conn.begin()
                    
                    try:
                        # 2.1 将产品信息插入回收站表
                        insert_query = """
                            INSERT INTO selection_recycle_bin 
                            (product_id, asin, product_title, price, image_url, local_path, thumb_path,
                             store_name, store_url, shop_id, main_category_name, main_category_rank,
                             main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                             product_link, sales_volume, listing_date, delivery_method,
                             similar_products, source, country, data_filter_mode, deleted_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """
                        
                        insert_params = (
                            product['id'],
                            product['asin'],
                            product['product_title'],
                            product['price'],
                            product['image_url'],
                            product['local_path'],
                            product['thumb_path'],
                            product['store_name'],
                            product['store_url'],
                            product['shop_id'],
                            product['main_category_name'],
                            product['main_category_rank'],
                            product['main_category_bsr_growth'],
                            product['main_category_bsr_growth_rate'],
                            product['tags'],
                            product['notes'],
                            product['product_type'],
                            product['product_link'],
                            product['sales_volume'],
                            product['listing_date'],
                            product['delivery_method'],
                            product['similar_products'],
                            product['source'],
                            product['country'],
                            product['data_filter_mode']
                        )
                        
                        await cursor.execute(insert_query, insert_params)
                        
                        # 2.2 从原表中删除产品
                        delete_query = "DELETE FROM selection_products WHERE id = %s"
                        await cursor.execute(delete_query, (product_id,))
                        
                        # 提交事务
                        await conn.commit()
                        
                        logger.info(f"[OK] 软删除选品产品成功 | 产品ID: {product_id} | ASIN: {product['asin']}")
                        return True
                        
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        logger.error(f"[FAIL] 软删除选品产品失败，事务已回滚 | 产品ID: {product_id} | 错误: {e}")
                        raise Exception(f"软删除选品产品失败: {str(e)}")
            
        except Exception as e:
            logger.error(f"删除选品产品失败: {e}")
            raise Exception(f"删除选品产品失败: {str(e)}")
    
    async def delete_product_by_asin(self, asin: str) -> bool:
        """
        通过ASIN软删除选品产品（移动到回收站）
        
        Args:
            asin: 产品ASIN
            
        Returns:
            是否删除成功
        """
        try:
            # 1. 通过ASIN获取产品信息
            query = """
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                       product_link, sales_volume, listing_date, delivery_method,
                       similar_products, source, country, data_filter_mode
                FROM selection_products
                WHERE asin = %s
            """
            product = await self.mysql.execute_query_one(query, (asin,))
            
            if not product:
                logger.warning(f"[WARN] 删除失败：ASIN {asin} 不存在")
                return False
            
            # 2. 使用事务确保操作的原子性
            async with self.mysql.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 开始事务
                    await conn.begin()
                    
                    try:
                        # 2.1 将产品信息插入回收站表
                        insert_query = """
                            INSERT INTO selection_recycle_bin 
                            (product_id, asin, product_title, price, image_url, local_path, thumb_path,
                             store_name, store_url, shop_id, main_category_name, main_category_rank,
                             main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                             product_link, sales_volume, listing_date, delivery_method,
                             similar_products, source, country, data_filter_mode, deleted_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """
                        
                        insert_params = (
                            product['id'],
                            product['asin'],
                            product['product_title'],
                            product['price'],
                            product['image_url'],
                            product['local_path'],
                            product['thumb_path'],
                            product['store_name'],
                            product['store_url'],
                            product['shop_id'],
                            product['main_category_name'],
                            product['main_category_rank'],
                            product['main_category_bsr_growth'],
                            product['main_category_bsr_growth_rate'],
                            product['tags'],
                            product['notes'],
                            product['product_type'],
                            product['product_link'],
                            product['sales_volume'],
                            product['listing_date'],
                            product['delivery_method'],
                            product['similar_products'],
                            product['source'],
                            product['country'],
                            product['data_filter_mode']
                        )
                        
                        await cursor.execute(insert_query, insert_params)
                        
                        # 2.2 从原表中删除产品
                        delete_query = "DELETE FROM selection_products WHERE asin = %s"
                        await cursor.execute(delete_query, (asin,))
                        
                        # 提交事务
                        await conn.commit()
                        
                        logger.info(f"[OK] 通过ASIN软删除选品产品成功 | ASIN: {asin}")
                        return True
                        
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        logger.error(f"[FAIL] 通过ASIN软删除选品产品失败，事务已回滚 | ASIN: {asin} | 错误: {e}")
                        raise Exception(f"通过ASIN软删除选品产品失败: {str(e)}")
            
        except Exception as e:
            logger.error(f"通过ASIN删除选品产品失败: {e}")
            raise Exception(f"通过ASIN删除选品产品失败: {str(e)}")
    
    async def batch_delete_products(self, product_ids: List[int]) -> int:
        """
        批量软删除选品产品（移动到回收站）
        
        Args:
            product_ids: 产品ID列表
            
        Returns:
            删除的产品数量
        """
        try:
            if not product_ids:
                return 0
            
            # 使用事务确保操作的原子性
            async with self.mysql.get_connection() as conn:
                async with conn.cursor() as cursor:
                    await conn.begin()
                    
                    try:
                        # 1. 获取所有要删除的产品信息
                        placeholders = ','.join(['%s'] * len(product_ids))
                        select_query = f"""
                            SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                                   store_name, store_url, shop_id, main_category_name, main_category_rank,
                                   main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                                   product_link, sales_volume, listing_date, delivery_method,
                                   similar_products, source, country, data_filter_mode
                            FROM selection_products
                            WHERE id IN ({placeholders})
                        """
                        
                        await cursor.execute(select_query, tuple(product_ids))
                        products = await cursor.fetchall()
                        
                        if not products:
                            await conn.commit()
                            return 0
                        
                        # 2. 批量插入回收站表
                        insert_query = """
                            INSERT INTO selection_recycle_bin 
                            (product_id, asin, product_title, price, image_url, local_path, thumb_path,
                             store_name, store_url, shop_id, main_category_name, main_category_rank,
                             main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                             product_link, sales_volume, listing_date, delivery_method,
                             similar_products, source, country, data_filter_mode, deleted_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """
                        
                        insert_params = []
                        for product in products:
                            insert_params.append((
                                product[0],  # id
                                product[1],  # asin
                                product[2],  # product_title
                                product[3],  # price
                                product[4],  # image_url
                                product[5],  # local_path
                                product[6],  # thumb_path
                                product[7],  # store_name
                                product[8],  # store_url
                                product[9],  # shop_id
                                product[10], # main_category_name
                                product[11], # main_category_rank
                                product[12], # main_category_bsr_growth
                                product[13], # main_category_bsr_growth_rate
                                product[14], # tags
                                product[15], # notes
                                product[16], # product_type
                                product[17], # product_link
                                product[18], # sales_volume
                                product[19], # listing_date
                                product[20], # delivery_method
                                product[21], # similar_products
                                product[22], # source
                                product[23], # country
                                product[24]  # data_filter_mode
                            ))
                        
                        await cursor.executemany(insert_query, insert_params)
                        
                        # 3. 从原表中批量删除产品
                        delete_query = f"DELETE FROM selection_products WHERE id IN ({placeholders})"
                        result = await cursor.execute(delete_query, tuple(product_ids))
                        
                        # 提交事务
                        await conn.commit()
                        
                        logger.info(f"[OK] 批量软删除选品产品成功 | 删除数量: {result} | 产品ID数量: {len(product_ids)}")
                        return result
                        
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        raise
                        
        except Exception as e:
            logger.error(f"批量删除选品产品失败: {e}")
            raise Exception(f"批量删除选品产品失败: {str(e)}")

    async def batch_delete_products_by_asin(self, asins: List[str]) -> int:
        """
        通过ASIN批量软删除选品产品（移动到回收站）
        
        Args:
            asins: 产品ASIN列表
            
        Returns:
            删除的产品数量
        """
        try:
            if not asins:
                return 0
            
            # 使用事务确保操作的原子性
            async with self.mysql.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 开始事务
                    await conn.begin()
                    
                    try:
                        # 1. 获取要删除的产品信息
                        placeholders = ','.join(['%s'] * len(asins))
                        select_query = f"""
                            SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                                   store_name, store_url, shop_id, main_category_name, main_category_rank,
                                   main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                                   product_link, sales_volume, listing_date, delivery_method,
                                   similar_products, source, country, data_filter_mode
                            FROM selection_products 
                            WHERE asin IN ({placeholders})
                        """
                        
                        await cursor.execute(select_query, tuple(asins))
                        products = await cursor.fetchall()
                        
                        if not products:
                            logger.warning(f"[WARN] 批量删除失败：未找到任何匹配的产品 | ASIN数量: {len(asins)}")
                            await conn.rollback()
                            return 0
                        
                        # 2. 将产品信息批量插入回收站表
                        insert_query = """
                            INSERT INTO selection_recycle_bin 
                            (product_id, asin, product_title, price, image_url, local_path, thumb_path,
                             store_name, store_url, shop_id, main_category_name, main_category_rank,
                             main_category_bsr_growth, main_category_bsr_growth_rate, tags, notes, product_type,
                             product_link, sales_volume, listing_date, delivery_method,
                             similar_products, source, country, data_filter_mode, deleted_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """
                        
                        insert_params = []
                        for product in products:
                            insert_params.append((
                                product[0],  # id
                                product[1],  # asin
                                product[2],  # product_title
                                product[3],  # price
                                product[4],  # image_url
                                product[5],  # local_path
                                product[6],  # thumb_path
                                product[7],  # store_name
                                product[8],  # store_url
                                product[9],  # shop_id
                                product[10], # main_category_name
                                product[11], # main_category_rank
                                product[12], # main_category_bsr_growth
                                product[13], # main_category_bsr_growth_rate
                                product[14], # tags
                                product[15], # notes
                                product[16], # product_type
                                product[17], # product_link
                                product[18], # sales_volume
                                product[19], # listing_date
                                product[20], # delivery_method
                                product[21], # similar_products
                                product[22], # source
                                product[23], # country
                                product[24]  # data_filter_mode
                            ))
                        
                        await cursor.executemany(insert_query, insert_params)
                        
                        # 3. 从原表中批量删除产品
                        delete_query = f"DELETE FROM selection_products WHERE asin IN ({placeholders})"
                        await cursor.execute(delete_query, tuple(asins))
                        
                        # 提交事务
                        await conn.commit()
                        
                        deleted_count = len(products)
                        logger.info(f"[OK] 批量软删除选品产品成功 | 删除数量: {deleted_count} | ASIN数量: {len(asins)}")
                        return deleted_count
                        
                    except Exception as e:
                        # 回滚事务
                        await conn.rollback()
                        logger.error(f"[FAIL] 批量软删除选品产品失败，事务已回滚 | ASIN数量: {len(asins)} | 错误: {e}")
                        raise Exception(f"批量软删除选品产品失败: {str(e)}")
            
        except Exception as e:
            logger.error(f"通过ASIN批量删除选品产品失败: {e}")
            raise Exception(f"通过ASIN批量删除选品产品失败: {str(e)}")
    
    async def get_stats(self) -> SelectionStatsResponse:
        """
        获取选品统计信息
        
        Returns:
            选品统计数据
        """
        try:
            query = """
                SELECT 
                    COUNT(CASE WHEN product_type = 'new' THEN 1 END) as total_new_products,
                    COUNT(CASE WHEN product_type = 'reference' THEN 1 END) as total_reference_products,
                    COUNT(*) as total_products,
                    COUNT(DISTINCT store_name) as total_stores,
                    COUNT(CASE WHEN local_path IS NOT NULL OR image_url IS NOT NULL THEN 1 END) as total_images
                FROM selection_products
            """
            
            result = await self.mysql.execute_query_one(query)
            
            return SelectionStatsResponse(
                total_new_products=result['total_new_products'] or 0,
                total_reference_products=result['total_reference_products'] or 0,
                total_products=result['total_products'] or 0,
                total_stores=result['total_stores'] or 0,
                total_images=result['total_images'] or 0
            )
            
        except Exception as e:
            logger.error(f"获取选品统计失败: {e}")
            raise Exception(f"获取选品统计失败: {str(e)}")
    
    async def get_stores(self) -> List[StoreInfo]:
        """
        获取店铺统计信息
        
        Returns:
            店铺列表及其产品数量
        """
        try:
            query = """
                SELECT 
                    store_name,
                    MAX(store_url) as store_url,
                    COUNT(*) as count
                FROM selection_products
                WHERE store_name IS NOT NULL AND store_name != ''
                GROUP BY store_name
                ORDER BY count DESC
            """
            
            stores = await self.mysql.execute_query(query)
            
            return [
                StoreInfo(
                    store_name=store['store_name'],
                    store_url=store['store_url'],
                    count=store['count']
                )
                for store in stores
            ]
            
        except Exception as e:
            logger.error(f"获取店铺统计失败: {e}")
            raise Exception(f"获取店铺统计失败: {str(e)}")
    
    async def get_categories(self, source: Optional[str] = None) -> List[dict]:
        """
        获取大类榜单名统计信息

        按照main_category_name字段统计分类，支持按source筛选，排除空值和null值

        Args:
            source: 来源筛选关键词，用于模糊匹配source字段
                   - "新品榜" - 只统计新品榜产品
                   - "竞品" - 只统计竞品店铺产品
                   - None - 统计所有产品

        Returns:
            大类榜单名列表及其产品数量
        """
        try:
            where_conditions = ["main_category_name IS NOT NULL AND main_category_name != ''"]
            query_params = []

            # 如果指定了source，添加source筛选条件
            if source:
                where_conditions.append("source LIKE %s")
                query_params.append(f"%{source}%")

            where_clause = " AND ".join(where_conditions)

            query = f"""
                SELECT
                    main_category_name as category,
                    COUNT(*) as count
                FROM selection_products
                WHERE {where_clause}
                GROUP BY main_category_name
                ORDER BY count DESC
            """

            categories = await self.mysql.execute_query(query, tuple(query_params) if query_params else None)

            return [
                {
                    'category': cat['category'],
                    'count': cat['count']
                }
                for cat in categories
            ]

        except Exception as e:
            logger.error(f"获取大类榜单名统计失败: {e}")
            raise Exception(f"获取大类榜单名统计失败: {str(e)}")
    
    async def clear_all_products(self) -> int:
        """
        清空所有选品数据
        
        Returns:
            删除的产品数量
        """
        try:
            query = "DELETE FROM selection_products"
            result = await self.mysql.execute_delete(query)
            logger.info(f"[OK] 清空所有选品数据成功，共删除 {result} 条记录")
            return result
            
        except Exception as e:
            logger.error(f"清空所有选品数据失败: {e}")
            raise Exception(f"清空所有选品数据失败: {str(e)}")
    
    async def get_all_asins(
        self, 
        product_type: Optional[str] = None
    ) -> List[str]:
        """
        获取所有选品的ASIN列表
        
        Args:
            product_type: 产品类型（可选），new/reference，不传则返回所有类型
            
        Returns:
            ASIN列表
        """
        try:
            where_clause = "1=1"
            params = []
            
            if product_type and product_type.strip():
                where_clause = "product_type = %s"
                params.append(product_type)
            
            query = f"""
                SELECT asin
                FROM selection_products
                WHERE {where_clause}
                ORDER BY created_at DESC
            """
            
            results = await self.mysql.execute_query(query, tuple(params))
            asins = [result['asin'] for result in results]
            logger.info(f"[OK] 获取ASIN列表成功，共 {len(asins)} 条记录")
            return asins
            
        except Exception as e:
            logger.error(f"获取ASIN列表失败: {e}")
            raise Exception(f"获取ASIN列表失败: {str(e)}")
