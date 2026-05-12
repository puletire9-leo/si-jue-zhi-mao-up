import logging
import pandas as pd
from io import BytesIO
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from ..schemas.product_data import (
    CategoryStat, ProductData, TrendData, TopProduct,
    CategoryStatsResponse, ProductListResponse, TrendResponse, 
    TopProductsResponse, FilterOptionsResponse, AdPerformance, AdPerformanceResponse
)
from ..repositories.mysql_repo import MySQLRepository
from ..repositories.redis_repo import RedisRepository
from .polars_data_service import PolarsDataService
import os

logger = logging.getLogger(__name__)

class ProductDataService:
    def __init__(self, mysql: MySQLRepository, redis: RedisRepository = None):
        self.mysql = mysql
        self.redis = redis
        # 初始化 Polars 数据服务（如果 Parquet 文件存在）
        # 尝试多个可能的路径
        possible_paths = [
            os.path.join(os.getcwd(), "temp_parquet_output"),  # 当前目录
            os.path.join(os.getcwd(), "..", "temp_parquet_output"),  # 上级目录
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "temp_parquet_output")),  # 项目根目录
        ]
        
        parquet_dir = None
        for path in possible_paths:
            if os.path.exists(path):
                parquet_dir = path
                logger.info(f"找到 Parquet 目录: {path}")
                break
        
        self.polars_service = PolarsDataService(parquet_dir) if parquet_dir else None
        if not self.polars_service:
            logger.warning("未找到 Parquet 目录，将使用 MySQL 查询")

    async def export_products(self, 
                             start_date: str = None,
                             end_date: str = None,
                             store: str = None, 
                             country: str = None, 
                             category: str = None,
                             month: str = None,
                             developer: str = None,
                             search_keyword: str = None,
                             fields: List[str] = None) -> bytes:
        """导出产品数据为 CSV"""
        table_names = await self._get_tables_for_range(start_date, end_date, month)
        if not table_names:
            return b""
            
        # 目前导出只支持单表或最新表，暂不支持跨表 UNION 导出，因为可能数据量过大
        table_name = table_names[0]
        
        where_clauses = ["1=1"]
        params = []
        
        if start_date:
            where_clauses.append("date >= %s")
            params.append(start_date)
        if end_date:
            where_clauses.append("date <= %s")
            params.append(end_date)
        if store:
            where_clauses.append("store = %s")
            params.append(store)
        if country:
            where_clauses.append("country = %s")
            params.append(country)
        if category:
            where_clauses.append("main_category_rank LIKE %s")
            params.append(f"{category}%%")
        if developer:
            where_clauses.append("developer = %s")
            params.append(developer)
        if search_keyword:
            where_clauses.append("(asin LIKE %s OR msku LIKE %s OR sku LIKE %s OR product_name LIKE %s)")
            search_param = f"%%{search_keyword}%%"
            params.extend([search_param, search_param, search_param, search_param])
            
        where_stmt = " AND ".join(where_clauses)

        # 导出时只选择必要字段，避免 SELECT *
        export_fields = fields if fields else [
            'id', 'date', 'asin', 'parent_asin', 'msku', 'sku', 'store', 'country',
            'category_level1', 'category_level2', 'category_level3', 'main_category_rank',
            'product_name', 'brand', 'developer', 'responsible_person',
            'sales_volume', 'sales_amount', 'order_quantity', 'sessions_total', 'pv_total',
            'cvr', 'ad_spend', 'ad_sales_amount', 'acoas', 'roas', 'impressions', 'clicks', 'ctr'
        ]
        fields_str = ', '.join(export_fields)

        union_queries = []
        for table in table_names:
            union_queries.append(f"SELECT {fields_str} FROM {table} WHERE {where_stmt}")
        full_query = " UNION ALL ".join(union_queries)

        query = f"SELECT {fields_str} FROM ({full_query}) t"
        items = await self.mysql.execute_query(query, tuple(params * len(table_names)))
        
        if not items:
            return b""
            
        df = pd.DataFrame(items)
        
        # 如果指定了字段，只保留指定字段
        if fields:
            # 过滤掉不存在的字段
            valid_fields = [f for f in fields if f in df.columns]
            if valid_fields:
                df = df[valid_fields]
        
        # 转换为 CSV
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        return output.getvalue()

    def _clean_numeric(self, value: Any) -> float:
        """清理并转换数值，处理百分比字符串等"""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # 去除百分号和空格
            cleaned = value.replace('%', '').replace(',', '').strip()
            try:
                val = float(cleaned)
                # 如果原字符串包含百分号，通常需要除以 100，但取决于业务习惯
                # 这里假设前端展示需要的是原始数值（如 25.5 表示 25.5%）
                return val
            except ValueError:
                return 0.0
        return 0.0

    async def get_available_months(self) -> List[str]:
        """获取所有可用的数据月份 (YYYY-MM 格式)"""
        if self.polars_service:
            return self.polars_service.get_available_months()
        return []

    async def get_category_stats(self, 
                               start_date: str = None,
                               end_date: str = None,
                               month: str = None,
                               store: str = None, 
                               country: str = None, 
                               developer: str = None) -> CategoryStatsResponse:
        """获取分类统计卡片数据"""
        # 兼容旧的 month 参数
        if month and not start_date and not end_date:
            month_key = month.replace('-', '')
            start_date = f"{month}-01"
            # 简单处理月底，如果是为了获取单月数据，这种兼容足够了
            end_date = f"{month}-31"

        cache_key = f"product_data:category_stats:{start_date or 'all'}:{end_date or 'all'}:{store or 'all'}:{country or 'all'}:{developer or 'all'}"
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return CategoryStatsResponse(**cached)
        
        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            return CategoryStatsResponse(month=month or "", stats=[])
        
        try:
            logger.info("使用 Polars 读取 Parquet 文件...")
            stats = self.polars_service.get_category_stats(
                start_date=start_date,
                end_date=end_date,
                store=store,
                country=country,
                developer=developer
            )
            
            response = CategoryStatsResponse(
                month=month or "",
                stats=[CategoryStat(**stat) for stat in stats]
            )
            
            # 缓存结果
            if self.redis:
                await self.redis.set(cache_key, response.dict(), expire=3600)
            
            return response
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            return CategoryStatsResponse(month=month or "", stats=[])

    async def get_products(self, 
                          page: int = 1, 
                          page_size: int = 20, 
                          start_date: str = None,
                          end_date: str = None,
                          store: str = None, 
                          country: str = None, 
                          category: str = None,
                          month: str = None,
                          developer: str = None,
                          search_keyword: str = None,
                          sort_field: str = 'sales_amount',
                          sort_order: str = 'desc') -> ProductListResponse:
        """获取产品列表（分页）"""
        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            return ProductListResponse(total=0, list=[], page=page, page_size=page_size)
        
        try:
            logger.info("使用 Polars 读取产品列表...")
            result = self.polars_service.get_products(
                page=page,
                page_size=page_size,
                start_date=start_date,
                end_date=end_date,
                store=store,
                country=country,
                category=category,
                developer=developer,
                search_keyword=search_keyword,
                sort_field=sort_field,
                sort_order=sort_order
            )
            
            # 转换为 ProductData 列表
            products = []
            for item in result['list']:
                products.append(ProductData(
                    asin=item.get('ASIN', ''),
                    date=item.get('日期', ''),
                    msku=item.get('MSKU', ''),
                    sku=item.get('SKU', ''),
                    product_name=item.get('标题', ''),
                    brand=item.get('品牌', ''),
                    store=item.get('店铺', ''),
                    country=item.get('国家', ''),
                    developer=item.get('开发人', ''),
                    responsible_person=item.get('负责人', ''),
                    sales_volume=item.get('销量', 0),
                    sales_amount=item.get('销售额', 0),
                    order_quantity=item.get('订单量', 0),
                    acos=item.get('ACOS', 0),
                    roas=item.get('ROAS', 0),
                    cvr=item.get('CVR', '0%'),
                    ctr=item.get('CTR', '0%'),
                    impressions=item.get('展示', 0),
                    clicks=item.get('点击', 0),
                    main_category_rank=item.get('大类排名', ''),
                    category_level1=item.get('一级分类', ''),
                ))
            
            return ProductListResponse(
                total=result['total'],
                list=products,
                page=result['page'],
                page_size=result['pageSize']
            )
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            return ProductListResponse(total=0, list=[], page=page, page_size=page_size)

    async def get_sales_trend(self,
                             start_date: str = None,
                             end_date: str = None,
                             time_dimension: str = 'month',
                             months_count: int = 6,
                             category: str = None,
                             store: str = None,
                             country: str = None,
                             developer: str = None) -> TrendResponse:
        """获取跨月销售趋势"""
        cache_key = f"product_data:sales_trend:{start_date or 'none'}:{end_date or 'none'}:{time_dimension}:{months_count}:{category or 'all'}:{store or 'all'}:{country or 'all'}:{developer or 'all'}"
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return TrendResponse(**cached)

        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            response = TrendResponse(category=category, data=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
        
        try:
            logger.info("使用 Polars 读取销售趋势数据...")
            trend_list = self.polars_service.get_trend(
                time_dimension=time_dimension,
                start_date=start_date,
                end_date=end_date,
                category=category,
                store=store,
                country=country,
                developer=developer
            )

            # 转换为 TrendData 列表
            trend_data = []
            for item in trend_list:
                # 从返回的数据中获取分类信息，如果没有则使用传入的category参数
                item_category = item.get('category', item.get('一级分类', category or 'All'))
                trend_data.append(TrendData(
                    date=item.get('time_key', ''),
                    category=item_category,
                    salesVolume=int(item.get('sales_volume', 0)),
                    salesAmount=float(item.get('sales_amount', 0)),
                    orderQuantity=int(item.get('order_quantity', 0)),
                    adSpend=float(item.get('ad_spend', 0)),
                    adSales=float(item.get('ad_sales_amount', 0)),
                    impressions=int(item.get('impressions', 0)),
                    clicks=int(item.get('clicks', 0)),
                    ctr=float(item.get('ctr', 0))
                ))

            # 对于响应的category字段，如果传入了category则使用，否则使用'All'
            response = TrendResponse(category=category or 'All', data=trend_data)

            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            response = TrendResponse(category=category, data=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response

    async def get_top_products(self,
                              start_date: str = None,
                              end_date: str = None,
                              limit: int = 10,
                              category: str = None,
                              store: str = None,
                              country: str = None,
                              developer: str = None) -> TopProductsResponse:
        """获取爆款排行"""
        cache_key = f"product_data:top_products:{start_date or 'none'}:{end_date or 'none'}:{limit}:{category or 'all'}:{store or 'all'}:{country or 'all'}:{developer or 'all'}"
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return TopProductsResponse(**cached)

        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            response = TopProductsResponse(category=category, items=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response

        try:
            logger.info("使用 Polars 读取爆款排行...")
            top_list = self.polars_service.get_top_products(
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                category=category,
                store=store,
                country=country,
                developer=developer
            )

            items = []
            for idx, item in enumerate(top_list):
                # 创建 ProductData 对象
                p = ProductData(
                    asin=item.get('ASIN', ''),
                    date=item.get('日期', ''),
                    msku=item.get('MSKU', ''),
                    sku=item.get('SKU', ''),
                    store=item.get('店铺', ''),
                    country=item.get('国家', ''),
                    main_category_rank=item.get('大类排名', ''),
                    product_name=item.get('标题', ''),
                    brand=item.get('品牌', ''),
                    developer=item.get('开发人', ''),
                    responsible_person=item.get('负责人', ''),
                    sales_volume=int(item.get('销量', 0)),
                    sales_amount=float(item.get('销售额', 0)),
                    order_quantity=int(item.get('订单量', 0)),
                    ad_spend=float(item.get('广告花费', 0)),
                    ad_sales_amount=float(item.get('广告销售额', 0)),
                    roas=float(item.get('ROAS', 0)),
                )
                items.append(TopProduct(
                    rank=idx + 1,
                    product=p,
                    salesVolume=p.sales_volume,
                    salesAmount=p.sales_amount
                ))

            response = TopProductsResponse(category=category, items=items)
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            response = TopProductsResponse(category=category, items=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response

    async def get_filter_options(self) -> FilterOptionsResponse:
        """获取筛选列表选项"""
        cache_key = "product_data:filter_options"
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return FilterOptionsResponse(**cached)
        
        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            response = FilterOptionsResponse(
                stores=[],
                countries=[],
                developers=[],
                categories=[]
            )
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=86400)
            return response
        
        try:
            logger.info("使用 Polars 读取筛选选项...")
            options = self.polars_service.get_filter_options()
            
            response = FilterOptionsResponse(
                stores=options.get('stores', []),
                countries=options.get('countries', []),
                developers=options.get('developers', []),
                categories=options.get('categories', [])
            )
            
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=86400)
            return response
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            response = FilterOptionsResponse(
                stores=[],
                countries=[],
                developers=[],
                categories=[]
            )
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=86400)
            return response

    async def get_ad_performance(self, 
                                 start_date: str = None,
                                 end_date: str = None,
                                 category: str = None,
                                 store: str = None,
                                 country: str = None,
                                 developer: str = None) -> AdPerformanceResponse:
        """获取广告表现数据"""
        cache_key = f"product_data:ad_performance:{start_date or 'none'}:{end_date or 'none'}:{category or 'all'}:{store or 'all'}:{country or 'all'}:{developer or 'all'}"
        if self.redis:
            cached = await self.redis.get(cache_key)
            if cached:
                return AdPerformanceResponse(**cached)
        
        # 使用 Polars 读取 Parquet 文件
        if not self.polars_service:
            logger.error("Polars 服务未初始化")
            response = AdPerformanceResponse(category=category, data=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
        
        try:
            logger.info("使用 Polars 读取广告表现数据...")
            perf_data = self.polars_service.get_ad_performance(
                start_date=start_date,
                end_date=end_date,
                category=category,
                store=store,
                country=country,
                developer=developer
            )
            
            # 构建 AdPerformance 对象
            ad_perf = AdPerformance(
                category=category or 'All',
                adSpend=perf_data.get('totalAdSpend', 0),
                adSales=perf_data.get('totalAdSales', 0),
                acoas=perf_data.get('totalAcos', 0),
                roas=perf_data.get('totalRoas', 0),
                impressions=perf_data.get('totalImpressions', 0),
                clicks=perf_data.get('totalClicks', 0),
                ctr=perf_data.get('totalCtr', 0)
            )
            
            response = AdPerformanceResponse(category=category, data=[ad_perf])
            
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
        except Exception as e:
            logger.error(f"Polars 查询失败: {e}")
            response = AdPerformanceResponse(category=category, data=[])
            if self.redis:
                await self.redis.set(cache_key, response.model_dump(), expire=3600)
            return response
