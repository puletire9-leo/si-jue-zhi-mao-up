"""
Polars 数据服务 - 使用 Polars 读取 Parquet 文件进行高性能数据分析
替代 MySQL 查询，避免磁盘空间不足问题

字段映射（Parquet中使用的是中文字段名）：
- 日期 -> date
- ASIN -> asin
- 店铺 -> store
- 国家 -> country
- 开发人 -> developer
- 销量 -> sales_volume
- 销售额 -> sales_amount
- 订单量 -> order_quantity
- 大类排名 -> main_category_rank
- 广告CVR -> cvr
- ROAS -> roas
- 广告花费 -> ad_spend
- 广告销售额 -> ad_sales_amount
"""
import polars as pl
import os
import time
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class PolarsDataService:
    """
    使用 Polars 读取 Parquet 文件进行数据分析
    优势：
    - 比 MySQL 快 5-15 倍
    - 内存占用仅为 1/10
    - 无需临时文件，直接在内存中处理
    - 列式存储，只读取需要的列
    """
    
    # 字段映射：代码中的英文字段名 -> Parquet中的中文字段名
    FIELD_MAPPING = {
        'date': '日期',
        'asin': 'ASIN',
        'store': '店铺',
        'country': '国家',
        'developer': '开发人',
        'sales_volume': '销量',
        'sales_amount': '销售额',
        'order_quantity': '订单量',
        'main_category_rank': '大类排名',
        'cvr': '广告CVR',
        'roas': 'ROAS',
        'ad_spend': '广告花费',
        'ad_sales_amount': '广告销售额',
        'product_name': '标题',
        'impressions': '展示',
        'clicks': '点击',
    }
    
    def __init__(self, parquet_dir: str = "temp_parquet_output"):
        """
        初始化 Polars 数据服务
        
        Args:
            parquet_dir: Parquet 文件目录路径
        """
        self.parquet_dir = parquet_dir
        self._df: Optional[pl.DataFrame] = None
        self._available_months: List[str] = []
    
    def _get_parquet_file(self) -> Optional[str]:
        """
        获取总 Parquet 文件路径
        优先使用合并后的总文件 product_data_merged.parquet
        """
        if not os.path.exists(self.parquet_dir):
            return None
        
        # 优先使用合并后的总文件
        merged_file = os.path.join(self.parquet_dir, "product_data_merged.parquet")
        if os.path.exists(merged_file):
            return merged_file
        
        # 如果没有总文件，返回第一个找到的 parquet 文件
        for f in os.listdir(self.parquet_dir):
            if f.endswith('.parquet'):
                return os.path.join(self.parquet_dir, f)
        
        return None
    
    def _get_chinese_field(self, english_field: str) -> str:
        """获取中文字段名"""
        return self.FIELD_MAPPING.get(english_field, english_field)
    
    def _load_data(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pl.DataFrame:
        """
        加载 Parquet 数据（从总文件读取，避免多文件合并的内存问题）n        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            
        Returns:
            Polars DataFrame
        """
        file = self._get_parquet_file()
        
        if not file:
            logger.warning("未找到 Parquet 文件")
            return pl.DataFrame()
        
        # 定义需要的列（中文字段名）
        needed_columns = [
            '日期', 'ASIN', '店铺', '国家', '开发人',
            '销量', '销售额', '订单量', '大类排名',
            '广告CVR', 'ROAS', '广告花费', '广告销售额', '标题',
            '展示', '点击', 'CTR'
        ]
        
        try:
            # 使用pyarrow读取schema（更轻量）
            import pyarrow.parquet as pq
            pf = pq.ParquetFile(file)
            file_columns = pf.schema_arrow.names
            available_columns = [c for c in needed_columns if c in file_columns]
            
            if not available_columns:
                logger.warning(f"文件中没有需要的列: {file}")
                return pl.DataFrame()
            
            # 只读取需要的列，使用pyarrow模式节省内存
            logger.info(f"从 {file} 读取列: {available_columns}")
            df = pl.read_parquet(
                file, 
                columns=available_columns,
                use_pyarrow=True
            )
            
            # 日期过滤
            if start_date or end_date:
                date_field = self._get_chinese_field('date')
                if date_field in df.columns:
                    if start_date:
                        df = df.filter(pl.col(date_field) >= start_date)
                    if end_date:
                        df = df.filter(pl.col(date_field) <= end_date)
            
            logger.info(f"成功加载数据: {df.height} 行, {len(df.columns)} 列")
            return df
            
        except Exception as e:
            logger.error(f"读取文件失败 {file}: {e}")
            return pl.DataFrame()
    
    def _extract_category(self, category_rank: Optional[str]) -> str:
        """
        从 大类排名 中提取分类名称
        去除冒号和后面的数字
        """
        if not category_rank:
            return '淘汰sku'
        
        # 使用正则表达式去除冒号和数字
        category = re.sub(r'[：:|]\d+$', '', category_rank).strip()
        
        if not category:
            return '淘汰sku'
        
        return category
    
    def _log_performance(self, method_name: str, start_time: float, row_count: int = 0):
        """记录性能日志"""
        elapsed = time.time() - start_time
        logger.info(f"[Polars性能] {method_name}: {elapsed:.3f}s, 数据行数: {row_count}")
    
    def get_category_stats(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        store: Optional[str] = None,
        country: Optional[str] = None,
        developer: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取分类统计数据
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            store: 店铺筛选
            country: 国家筛选
            developer: 开发者筛选
            
        Returns:
            分类统计列表
        """
        start_time = time.time()
        
        # 加载数据
        df = self._load_data(start_date, end_date)
        
        if df.is_empty():
            self._log_performance("get_category_stats", start_time, 0)
            return []
        
        # 应用筛选条件（使用中文字段名）
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        
        if store and store_field in df.columns:
            df = df.filter(pl.col(store_field) == store)
        if country and country_field in df.columns:
            df = df.filter(pl.col(country_field) == country)
        if developer and developer_field in df.columns:
            df = df.filter(pl.col(developer_field) == developer)
        
        # 提取分类
        main_category_field = self._get_chinese_field('main_category_rank')
        if main_category_field in df.columns:
            df = df.with_columns([
                pl.col(main_category_field)
                .map_elements(self._extract_category, return_dtype=pl.Utf8)
                .alias('category')
            ])
        else:
            df = df.with_columns([pl.lit('淘汰sku').alias('category')])
        
        # 处理 CVR 字段（移除 % 符号）
        cvr_field = self._get_chinese_field('cvr')
        if cvr_field in df.columns:
            df = df.with_columns([
                pl.col(cvr_field)
                .cast(pl.Utf8)
                .str.replace('%', '')
                .cast(pl.Float64, strict=False)
                .fill_null(0)
                .alias('cvr_numeric')
            ])
        else:
            df = df.with_columns([pl.lit(0.0).alias('cvr_numeric')])
        
        # 获取中文字段名
        asin_field = self._get_chinese_field('asin')
        sales_volume_field = self._get_chinese_field('sales_volume')
        sales_amount_field = self._get_chinese_field('sales_amount')
        order_quantity_field = self._get_chinese_field('order_quantity')
        roas_field = self._get_chinese_field('roas')
        ad_spend_field = self._get_chinese_field('ad_spend')
        ad_sales_field = self._get_chinese_field('ad_sales_amount')
        
        # 分组聚合
        result = (
            df
            .group_by('category')
            .agg([  # 使用 agg 替代已弃用的 API
                # 产品数量（唯一 ASIN）
                pl.col(asin_field).n_unique().alias('productCount'),
                # 总销量
                pl.col(sales_volume_field).sum().alias('totalSalesVolume'),
                # 总销售额
                pl.col(sales_amount_field).sum().alias('totalSalesAmount'),
                # 总订单量
                pl.col(order_quantity_field).sum().alias('totalOrderQuantity'),
                # 平均 ROAS
                pl.col(roas_field).mean().alias('avgRoas'),
                # 平均 CVR
                pl.col('cvr_numeric').mean().alias('avgCvr'),
                # 总广告花费
                pl.col(ad_spend_field).sum().alias('totalAdSpend'),
                # 总广告销售额
                pl.col(ad_sales_field).sum().alias('totalAdSales'),
            ])
            .sort('totalSalesAmount', descending=True)
        )
        
        # 转换为字典列表
        stats = []
        for row in result.to_dicts():
            # 计算 ACoAS
            total_ad_spend = row.get('totalAdSpend', 0) or 0
            total_sales_amount = row.get('totalSalesAmount', 0) or 0
            avg_acoas = (total_ad_spend / total_sales_amount * 100) if total_sales_amount > 0 else 0

            # 处理 category 字段，确保不为 None
            category = row.get('category')
            if category is None or category == '':
                category = '淘汰sku'

            stats.append({
                'category': category,
                'productCount': row['productCount'],
                'totalSalesVolume': row['totalSalesVolume'] or 0,
                'totalSalesAmount': row['totalSalesAmount'] or 0,
                'totalOrderQuantity': row['totalOrderQuantity'] or 0,
                'avgAcoas': round(avg_acoas, 2),
                'avgRoas': round(row['avgRoas'] or 0, 2),
                'avgCvr': round(row['avgCvr'] or 0, 2),
                'totalAdSpend': total_ad_spend,
                'totalAdSales': row['totalAdSales'] or 0,
                'orderRate': round((row['totalSalesVolume'] or 0) / row['productCount'], 2) if row['productCount'] > 0 else 0,
            })
        
        self._log_performance("get_category_stats", start_time, len(df))
        return stats
    
    def get_available_months(self) -> List[str]:
        """获取可用的数据月份（从数据内容中提取）"""
        try:
            df = self._load_data()
            if df.is_empty():
                return []
            
            date_field = self._get_chinese_field('date')
            if date_field not in df.columns:
                return []
            
            # 从日期列提取月份
            months = df.select(
                pl.col(date_field).str.slice(0, 7).alias('month')
            ).unique().sort('month', descending=True)
            
            return months['month'].to_list()
        except Exception as e:
            logger.error(f"获取可用月份失败: {e}")
            return []
    
    def get_products(
        self,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        store: Optional[str] = None,
        country: Optional[str] = None,
        category: Optional[str] = None,
        developer: Optional[str] = None,
        search_keyword: Optional[str] = None,
        sort_field: str = 'sales_amount',
        sort_order: str = 'desc'
    ) -> Dict[str, Any]:
        """
        获取产品列表（分页）

        Returns:
            {
                'list': [...],
                'total': int,
                'page': int,
                'pageSize': int
            }
        """
        start_time = time.time()

        df = self._load_data(start_date, end_date)

        if df.is_empty():
            self._log_performance("get_products", start_time, 0)
            return {'list': [], 'total': 0, 'page': page, 'pageSize': page_size}
        
        # 获取中文字段名
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        category_field = self._get_chinese_field('main_category_rank')
        product_name_field = self._get_chinese_field('product_name')
        asin_field = self._get_chinese_field('asin')
        
        # 应用筛选条件
        if store and store_field in df.columns:
            df = df.filter(pl.col(store_field) == store)
        if country and country_field in df.columns:
            df = df.filter(pl.col(country_field) == country)
        if developer and developer_field in df.columns:
            df = df.filter(pl.col(developer_field) == developer)
        if category and category_field in df.columns:
            df = df.filter(pl.col(category_field).str.contains(category))
        if search_keyword:
            # 搜索产品名称或 ASIN
            if product_name_field in df.columns:
                df = df.filter(
                    pl.col(product_name_field).str.contains(search_keyword, strict=False) |
                    pl.col(asin_field).str.contains(search_keyword, strict=False)
                )
        
        # 获取总数
        total = df.height
        
        # 排序（将英文字段名映射为中文字段名）
        sort_field_chinese = self._get_chinese_field(sort_field)
        if sort_field_chinese in df.columns:
            df = df.sort(sort_field_chinese, descending=(sort_order == 'desc'))
        
        # 分页
        offset = (page - 1) * page_size
        df = df.slice(offset, page_size)
        
        result = {
            'list': df.to_dicts(),
            'total': total,
            'page': page,
            'pageSize': page_size
        }

        self._log_performance("get_products", start_time, total)
        return result

    def get_trend(
        self,
        time_dimension: str = 'day',
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        store: Optional[str] = None,
        country: Optional[str] = None,
        developer: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取销售趋势数据

        Args:
            time_dimension: 时间维度 ('day', 'week', 'month')
            start_date: 开始日期
            end_date: 结束日期
            category: 分类筛选
            store: 店铺筛选
            country: 国家筛选
            developer: 开发者筛选

        Returns:
            趋势数据列表
        """
        start_time = time.time()

        df = self._load_data(start_date, end_date)

        if df.is_empty():
            self._log_performance("get_trend", start_time, 0)
            return []
        
        # 应用筛选条件
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        category_field = self._get_chinese_field('main_category_rank')
        
        if store and store_field in df.columns:
            df = df.filter(pl.col(store_field) == store)
        if country and country_field in df.columns:
            df = df.filter(pl.col(country_field) == country)
        if developer and developer_field in df.columns:
            df = df.filter(pl.col(developer_field) == developer)
        if category and category_field in df.columns:
            df = df.filter(pl.col(category_field).str.contains(category))
        
        # 提取分类
        if category_field in df.columns:
            df = df.with_columns([
                pl.col(category_field)
                .map_elements(self._extract_category, return_dtype=pl.Utf8)
                .alias('category')
            ])
        else:
            df = df.with_columns([pl.lit('淘汰sku').alias('category')])
        
        # 获取中文字段名
        date_field = self._get_chinese_field('date')
        sales_volume_field = self._get_chinese_field('sales_volume')
        sales_amount_field = self._get_chinese_field('sales_amount')
        order_quantity_field = self._get_chinese_field('order_quantity')
        ad_spend_field = self._get_chinese_field('ad_spend')
        ad_sales_field = self._get_chinese_field('ad_sales_amount')
        impressions_field = self._get_chinese_field('impressions')
        clicks_field = self._get_chinese_field('clicks')
        
        # 根据时间维度处理日期
        if time_dimension == 'day':
            df = df.with_columns([pl.col(date_field).alias('time_key')])
        elif time_dimension == 'week':
            # 使用ISO周格式 YYYY-WNN
            df = df.with_columns([
                (pl.col(date_field).str.slice(0, 4) + '-W' + 
                 pl.col(date_field).dt.week().cast(pl.Utf8).str.zfill(2)).alias('time_key')
            ])
        elif time_dimension == 'month':
            df = df.with_columns([
                pl.col(date_field).str.slice(0, 7).alias('time_key')
            ])
        else:
            df = df.with_columns([pl.col(date_field).alias('time_key')])
        
        # 分组聚合
        agg_exprs = [
            pl.col(sales_volume_field).sum().alias('sales_volume'),
            pl.col(sales_amount_field).sum().alias('sales_amount'),
            pl.col(order_quantity_field).sum().alias('order_quantity'),
            pl.col(ad_spend_field).sum().alias('ad_spend'),
            pl.col(ad_sales_field).sum().alias('ad_sales_amount'),
        ]
        
        # 添加曝光和点击聚合（如果字段存在）
        if impressions_field in df.columns:
            agg_exprs.append(pl.col(impressions_field).sum().alias('impressions'))
        else:
            agg_exprs.append(pl.lit(0).alias('impressions'))
            
        if clicks_field in df.columns:
            agg_exprs.append(pl.col(clicks_field).sum().alias('clicks'))
        else:
            agg_exprs.append(pl.lit(0).alias('clicks'))
        
        # 按时间维度和分类分组
        result = (
            df
            .group_by(['time_key', 'category'])
            .agg(agg_exprs)
            .sort('time_key')
        )
        
        # 计算CTR
        result = result.with_columns([
            pl.when(pl.col('impressions') > 0)
            .then((pl.col('clicks') / pl.col('impressions') * 100))
            .otherwise(0.0)
            .alias('ctr')
        ])

        trend_list = result.to_dicts()
        self._log_performance("get_trend", start_time, len(df))
        return trend_list
    
    def get_ad_performance(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        store: Optional[str] = None,
        country: Optional[str] = None,
        developer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取广告表现数据

        Returns:
            {
                'totalImpressions': int,
                'totalClicks': int,
                'totalCtr': float,
                'totalAdSpend': float,
                'totalAdSales': float,
                'totalAcos': float,
                'totalRoas': float,
            }
        """
        start_time = time.time()

        df = self._load_data(start_date, end_date)

        if df.is_empty():
            self._log_performance("get_ad_performance", start_time, 0)
            return {
                'totalImpressions': 0,
                'totalClicks': 0,
                'totalCtr': 0.0,
                'totalAdSpend': 0.0,
                'totalAdSales': 0.0,
                'totalAcos': 0.0,
                'totalRoas': 0.0,
            }
        
        # 应用筛选条件
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        category_field = self._get_chinese_field('main_category_rank')
        
        if store and store_field in df.columns:
            df = df.filter(pl.col(store_field) == store)
        if country and country_field in df.columns:
            df = df.filter(pl.col(country_field) == country)
        if developer and developer_field in df.columns:
            df = df.filter(pl.col(developer_field) == developer)
        if category and category_field in df.columns:
            df = df.filter(pl.col(category_field).str.contains(category))
        
        # 计算汇总数据
        # 注意：Parquet中可能没有展示和点击数据，这里使用广告花费和销售额计算
        ad_spend_field = self._get_chinese_field('ad_spend')
        ad_sales_field = self._get_chinese_field('ad_sales_amount')
        
        total_ad_spend = df[ad_spend_field].sum() if ad_spend_field in df.columns else 0
        total_ad_sales = df[ad_sales_field].sum() if ad_sales_field in df.columns else 0
        
        # 计算 ACOS 和 ROAS
        total_acos = (total_ad_spend / total_ad_sales * 100) if total_ad_sales > 0 else 0
        total_roas = (total_ad_sales / total_ad_spend) if total_ad_spend > 0 else 0

        result = {
            'totalImpressions': 0,  # Parquet中可能没有此字段
            'totalClicks': 0,       # Parquet中可能没有此字段
            'totalCtr': 0.0,        # Parquet中可能没有此字段
            'totalAdSpend': total_ad_spend or 0,
            'totalAdSales': total_ad_sales or 0,
            'totalAcos': round(total_acos, 2),
            'totalRoas': round(total_roas, 2),
        }

        self._log_performance("get_ad_performance", start_time, len(df))
        return result
    
    def get_filter_options(self) -> Dict[str, Any]:
        """
        获取筛选选项（店铺、国家、开发者列表）

        Returns:
            {
                'stores': [],
                'countries': [],
                'developers': [],
                'categories': []
            }
        """
        start_time = time.time()

        df = self._load_data()

        if df.is_empty():
            self._log_performance("get_filter_options", start_time, 0)
            return {
                'stores': [],
                'countries': [],
                'developers': [],
                'categories': []
            }
        
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        category_field = self._get_chinese_field('main_category_rank')
        
        result = {
            'stores': df[store_field].unique().drop_nulls().to_list() if store_field in df.columns else [],
            'countries': df[country_field].unique().drop_nulls().to_list() if country_field in df.columns else [],
            'developers': df[developer_field].unique().drop_nulls().to_list() if developer_field in df.columns else [],
            'categories': [],
        }
        
        # 提取分类选项
        if category_field in df.columns:
            categories = df[category_field].unique().drop_nulls().to_list()
            # 提取分类名称（去除排名数字）
            result['categories'] = [self._extract_category(c) for c in categories if c]
            result['categories'] = list(set(result['categories']))  # 去重
            result['categories'].sort()

        self._log_performance("get_filter_options", start_time, len(df))
        return result

    def get_top_products(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10,
        category: Optional[str] = None,
        store: Optional[str] = None,
        country: Optional[str] = None,
        developer: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取爆款排行（按销售额排序）

        Args:
            start_date: 开始日期
            end_date: 结束日期
            limit: 返回数量限制
            category: 分类筛选
            store: 店铺筛选
            country: 国家筛选
            developer: 开发者筛选

        Returns:
            产品列表（按销售额降序）
        """
        start_time = time.time()

        df = self._load_data(start_date, end_date)

        if df.is_empty():
            self._log_performance("get_top_products", start_time, 0)
            return []

        # 获取中文字段名
        store_field = self._get_chinese_field('store')
        country_field = self._get_chinese_field('country')
        developer_field = self._get_chinese_field('developer')
        category_field = self._get_chinese_field('main_category_rank')
        asin_field = self._get_chinese_field('asin')
        sales_amount_field = self._get_chinese_field('sales_amount')

        # 应用筛选条件
        if store and store_field in df.columns:
            df = df.filter(pl.col(store_field) == store)
        if country and country_field in df.columns:
            df = df.filter(pl.col(country_field) == country)
        if developer and developer_field in df.columns:
            df = df.filter(pl.col(developer_field) == developer)
        if category and category_field in df.columns:
            df = df.filter(pl.col(category_field).str.contains(category))

        # 按 ASIN 分组聚合
        result = (
            df
            .group_by(asin_field)
            .agg([
                pl.col(self._get_chinese_field('date')).max().alias('date'),
                pl.col(self._get_chinese_field('msku')).first().alias('msku'),
                pl.col(self._get_chinese_field('sku')).first().alias('sku'),
                pl.col(self._get_chinese_field('product_name')).first().alias('product_name'),
                pl.col(self._get_chinese_field('brand')).first().alias('brand'),
                pl.col(store_field).first().alias('store'),
                pl.col(country_field).first().alias('country'),
                pl.col(developer_field).first().alias('developer'),
                pl.col(self._get_chinese_field('responsible_person')).first().alias('responsible_person'),
                pl.col(self._get_chinese_field('sales_volume')).sum().alias('sales_volume'),
                pl.col(sales_amount_field).sum().alias('sales_amount'),
                pl.col(self._get_chinese_field('order_quantity')).sum().alias('order_quantity'),
                pl.col(self._get_chinese_field('ad_spend')).sum().alias('ad_spend'),
                pl.col(self._get_chinese_field('ad_sales_amount')).sum().alias('ad_sales_amount'),
                pl.col(self._get_chinese_field('roas')).mean().alias('roas'),
                pl.col(category_field).first().alias('main_category_rank'),
            ])
            .sort('sales_amount', descending=True)
            .limit(limit)
        )

        top_products = result.to_dicts()
        self._log_performance("get_top_products", start_time, len(df))
        return top_products
