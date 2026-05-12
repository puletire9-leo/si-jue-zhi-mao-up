"""
产品销量数据处理服务
支持流式读取大Parquet文件，避免内存爆炸
"""
import os
import re
from typing import List, Dict, Optional, Set, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict
import pandas as pd
import pyarrow.parquet as pq
from ..models.product_sales import ProductSummary, SearchResponse, WeeklySalesResponse
from ..config import settings


class ProductSalesService:
    """产品销量数据服务"""
    
    # 列名映射（Parquet中的列名 -> 标准名称）
    COLUMN_MAPPING = {
        'ASIN': 'asin',
        '标题': 'title',
        'SKU': 'sku',
        'MSKU': 'msku',
        '店铺': 'shop',
        '销量': 'sales',
        '销售额': 'revenue',
        '订单量': 'orders',
        '日期': 'date',
    }
    
    def __init__(self):
        self._parquet_file: Optional[pq.ParquetFile] = None
        self._metadata: Optional[Any] = None
        self._columns: Optional[List[str]] = None
        self._date_range: Optional[Tuple[str, str]] = None
        self._shops: Optional[Set[str]] = None
        self._index_built = False
        self._asin_index: Dict[str, List[int]] = {}  # ASIN -> 行号列表
    
    @property
    def PARQUET_PATH(self) -> str:
        """获取 Parquet 文件路径，从配置读取"""
        return os.path.join(
            settings.PARQUET_DATA_DIR,
            settings.PARQUET_FILE_NAME
        )
    
    def _get_parquet_file(self) -> pq.ParquetFile:
        """获取Parquet文件对象（懒加载）"""
        if self._parquet_file is None:
            if not os.path.exists(self.PARQUET_PATH):
                raise FileNotFoundError(f"Parquet文件不存在: {self.PARQUET_PATH}")
            self._parquet_file = pq.ParquetFile(self.PARQUET_PATH)
            self._metadata = self._parquet_file.metadata
            self._columns = [col for col in self._parquet_file.schema_arrow.names]
        return self._parquet_file
    
    def get_columns(self) -> List[str]:
        """获取所有列名"""
        if self._columns is None:
            self._get_parquet_file()
        return self._columns or []
    
    def get_total_rows(self) -> int:
        """获取总行数"""
        if self._metadata is None:
            self._get_parquet_file()
        return self._metadata.num_rows if self._metadata else 0
    
    def get_date_range(self) -> Tuple[str, str]:
        """获取数据日期范围"""
        if self._date_range is None:
            self._build_index()
        return self._date_range or ("", "")
    
    def get_shops(self) -> List[str]:
        """获取所有店铺列表"""
        if self._shops is None:
            self._build_index()
        return sorted(list(self._shops)) if self._shops else []
    
    def _build_index(self):
        """
        构建索引：扫描Parquet文件，建立ASIN索引和统计信息
        使用流式读取，避免内存爆炸
        """
        if self._index_built:
            return
        
        print("[ProductSalesService] 正在构建索引...")
        parquet_file = self._get_parquet_file()
        
        # 检查必要的列是否存在
        cols = self.get_columns()
        has_asin = 'ASIN' in cols
        has_date = '日期' in cols
        has_shop = '店铺' in cols
        
        if not has_asin:
            raise ValueError("Parquet文件缺少ASIN列")
        
        # 流式扫描
        shops_set = set()
        dates = []
        row_idx = 0
        
        for batch in parquet_file.iter_batches(batch_size=10000, columns=['ASIN', '店铺', '日期'] if has_shop and has_date else ['ASIN']):
            batch_df = batch.to_pandas()
            
            # 索引ASIN
            if has_asin:
                for asin in batch_df['ASIN'].dropna().unique():
                    asin_str = str(asin).strip().upper()
                    if asin_str not in self._asin_index:
                        self._asin_index[asin_str] = []
                    # 只记录行号范围，不记录所有行号以节省内存
                    if len(self._asin_index[asin_str]) < 100:  # 限制每个ASIN的记录数
                        self._asin_index[asin_str].append(row_idx)
            
            # 收集店铺
            if has_shop and '店铺' in batch_df.columns:
                shops_set.update(batch_df['店铺'].dropna().astype(str).unique())
            
            # 收集日期
            if has_date and '日期' in batch_df.columns:
                dates.extend(batch_df['日期'].dropna().astype(str).tolist())
            
            row_idx += len(batch_df)
        
        # 计算日期范围
        if dates:
            try:
                date_objs = [datetime.strptime(d, '%Y-%m-%d') for d in dates if '-' in str(d)]
                if date_objs:
                    self._date_range = (
                        min(date_objs).strftime('%Y-%m-%d'),
                        max(date_objs).strftime('%Y-%m-%d')
                    )
            except:
                pass
        
        self._shops = shops_set
        self._index_built = True
        print(f"[ProductSalesService] 索引构建完成: {len(self._asin_index)} 个ASIN, {len(shops_set)} 个店铺")
    
    def _stream_filter(
        self,
        keyword: Optional[str] = None,
        shops: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50
    ) -> List[ProductSummary]:
        """
        流式过滤Parquet数据
        使用迭代器模式，一次只处理一个批次，避免内存爆炸
        """
        parquet_file = self._get_parquet_file()
        columns = self.get_columns()
        
        # 确定需要的列
        need_cols = ['ASIN', '标题', 'SKU', 'MSKU', '店铺', '销量', '销售额']
        available_cols = [c for c in need_cols if c in columns]
        
        # 转换关键词为小写
        keyword_lower = keyword.lower().strip() if keyword else None
        
        # 转换店铺为集合（快速查找）
        shop_set = set(shops) if shops else None
        
        # 日期过滤
        date_filter = start_date or end_date
        
        # 结果收集
        results = []
        seen_asins = set()  # 去重
        
        # 流式读取
        for batch in parquet_file.iter_batches(batch_size=10000, columns=available_cols):
            if len(results) >= limit:
                break
            
            batch_df = batch.to_pandas()
            
            # 应用过滤条件
            mask = pd.Series([True] * len(batch_df), index=batch_df.index)
            
            # 关键词过滤
            if keyword_lower:
                keyword_mask = pd.Series([False] * len(batch_df), index=batch_df.index)
                for col in ['ASIN', '标题', 'SKU', 'MSKU']:
                    if col in batch_df.columns:
                        col_mask = batch_df[col].astype(str).str.lower().str.contains(keyword_lower, na=False)
                        keyword_mask = keyword_mask | col_mask
                mask = mask & keyword_mask
            
            # 店铺过滤
            if shop_set and '店铺' in batch_df.columns:
                mask = mask & batch_df['店铺'].isin(shop_set)
            
            # 应用过滤
            filtered = batch_df[mask]
            
            # 转换为ProductSummary
            for _, row in filtered.iterrows():
                asin = str(row.get('ASIN', '')).strip().upper()
                if not asin or asin in seen_asins:
                    continue
                
                seen_asins.add(asin)
                
                # 解析数值
                try:
                    sales = int(float(row.get('销量', 0)))
                except:
                    sales = 0
                
                try:
                    revenue = float(row.get('销售额', 0))
                except:
                    revenue = 0.0
                
                product = ProductSummary(
                    asin=asin,
                    title=str(row.get('标题', ''))[:100],
                    sku=str(row.get('SKU', '')) if pd.notna(row.get('SKU')) else None,
                    msku=str(row.get('MSKU', '')) if pd.notna(row.get('MSKU')) else None,
                    shop=str(row.get('店铺', '未知')),
                    total_sales=sales,
                    total_revenue=revenue
                )
                results.append(product)
                
                if len(results) >= limit:
                    break
        
        # 按销量排序
        results.sort(key=lambda x: x.total_sales, reverse=True)
        
        return results[:limit]
    
    def search_products(
        self,
        keyword: Optional[str] = None,
        shops: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> SearchResponse:
        """
        搜索产品
        流式读取Parquet，避免内存爆炸
        """
        # 构建索引（首次）
        if not self._index_built:
            self._build_index()
        
        # 流式过滤
        products = self._stream_filter(
            keyword=keyword,
            shops=shops,
            start_date=start_date,
            end_date=end_date,
            limit=limit + offset
        )
        
        # 分页
        total = len(products)
        products = products[offset:offset + limit]
        
        return SearchResponse(
            total=total,
            products=products,
            has_more=total > offset + limit
        )
    
    def _get_week_start(self, date_str: str) -> str:
        """获取日期所在周的开始日期（周一）"""
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            # 计算周一（weekday() 周一=0, 周日=6）
            monday = date_obj - timedelta(days=date_obj.weekday())
            return monday.strftime('%Y-%m-%d')
        except:
            return date_str
    
    def get_weekly_sales(
        self,
        asins: List[str],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        shops: Optional[List[str]] = None
    ) -> WeeklySalesResponse:
        """
        获取产品的周销量数据
        流式读取，按周聚合
        修复：按日期和店铺去重，避免重复数据导致销量翻倍
        """
        if not asins:
            return WeeklySalesResponse(weeks=[], week_labels=[], data={}, revenue_data={})
        
        parquet_file = self._get_parquet_file()
        columns = self.get_columns()
        
        # 需要的列
        need_cols = ['ASIN', '日期', '销量', '销售额', '店铺']
        available_cols = [c for c in need_cols if c in columns]
        
        # 转换ASIN为大写
        asin_set = set(a.strip().upper() for a in asins)
        shop_set = set(shops) if shops else None
        
        # 日期范围
        start_dt = datetime.strptime(start_date, '%Y-%m-%d') if start_date else None
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') if end_date else None
        
        # 原始数据收集: {(asin, date, shop): {'sales': x, 'revenue': y}}
        # 使用字典去重，同一ASIN同一天同一店铺只保留一条记录
        daily_data: Dict[tuple, Dict[str, float]] = {}
        all_weeks = set()
        
        # 流式读取
        for batch in parquet_file.iter_batches(batch_size=10000, columns=available_cols):
            batch_df = batch.to_pandas()
            
            # ASIN过滤
            if 'ASIN' in batch_df.columns:
                batch_df = batch_df[batch_df['ASIN'].astype(str).str.upper().isin(asin_set)]
            
            if batch_df.empty:
                continue
            
            # 店铺过滤
            if shop_set and '店铺' in batch_df.columns:
                batch_df = batch_df[batch_df['店铺'].isin(shop_set)]
            
            if batch_df.empty:
                continue
            
            # 处理每一行
            for _, row in batch_df.iterrows():
                asin = str(row.get('ASIN', '')).strip().upper()
                date_str = str(row.get('日期', ''))
                shop = str(row.get('店铺', '未知'))
                
                # 日期过滤
                if start_dt or end_dt:
                    try:
                        row_date = datetime.strptime(date_str, '%Y-%m-%d')
                        if start_dt and row_date < start_dt:
                            continue
                        if end_dt and row_date > end_dt:
                            continue
                    except:
                        continue
                
                # 解析数值
                try:
                    sales = int(float(row.get('销量', 0)))
                except:
                    sales = 0
                
                try:
                    revenue = float(row.get('销售额', 0))
                except:
                    revenue = 0.0
                
                # 使用 (asin, date, shop) 作为键去重
                key = (asin, date_str, shop)
                if key not in daily_data:
                    daily_data[key] = {'sales': sales, 'revenue': revenue}
                    all_weeks.add(self._get_week_start(date_str))
        
        # 聚合到周: {asin: {week_start: {sales, revenue}}}
        weekly_data: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {'sales': 0, 'revenue': 0}))
        
        for (asin, date_str, shop), values in daily_data.items():
            week_start = self._get_week_start(date_str)
            weekly_data[asin][week_start]['sales'] += values['sales']
            weekly_data[asin][week_start]['revenue'] += values['revenue']
        
        # 生成周列表（排序）
        sorted_weeks = sorted(all_weeks)
        
        # 生成周标签
        week_labels = []
        for week in sorted_weeks:
            try:
                week_dt = datetime.strptime(week, '%Y-%m-%d')
                end_dt_label = week_dt + timedelta(days=6)
                label = f"{week_dt.month:02d}/{week_dt.day:02d}~{end_dt_label.month:02d}/{end_dt_label.day:02d}"
                week_labels.append(label)
            except:
                week_labels.append(week)
        
        # 构建响应数据（填充缺失周为0）
        result_data = {}
        result_revenue = {}
        
        for asin in asins:
            asin_upper = asin.strip().upper()
            sales_list = []
            revenue_list = []
            
            for week in sorted_weeks:
                data = weekly_data[asin_upper].get(week, {'sales': 0, 'revenue': 0})
                sales_list.append(int(data['sales']))
                revenue_list.append(round(data['revenue'], 2))
            
            result_data[asin_upper] = sales_list
            result_revenue[asin_upper] = revenue_list
        
        return WeeklySalesResponse(
            weeks=sorted_weeks,
            week_labels=week_labels,
            data=result_data,
            revenue_data=result_revenue
        )
    
    def get_period_data(
        self,
        asins: List[str],
        start_date: str,
        end_date: str,
        shops: Optional[List[str]] = None,
        label: str = "周期"
    ) -> Dict[str, Any]:
        """
        获取指定时间周期的汇总数据
        包含销售、利润、广告、退款等完整数据
        
        Args:
            asins: ASIN列表
            start_date: 开始日期
            end_date: 结束日期
            shops: 店铺筛选
            label: 周期标签（"周期A" / "周期B"）
        """
        if not asins:
            return self._empty_period_data(label, start_date, end_date)
        
        parquet_file = self._get_parquet_file()
        columns = self.get_columns()
        
        # 需要的列
        need_cols = [
            'ASIN', '日期', '店铺',
            '订单量', '销量', '销售额',
            '结算毛利润', '结算毛利率', '订单毛利润', '订单毛利率',
            '广告花费', '广告订单量', 'ACOS',
            '退款金额', '退款量', '退款率'
        ]
        available_cols = [c for c in need_cols if c in columns]
        
        # 转换ASIN为大写
        asin_set = set(a.strip().upper() for a in asins)
        shop_set = set(shops) if shops else None
        
        # 日期范围
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        
        # 初始化汇总数据
        totals = {
            'orders': 0,
            'sales': 0,
            'revenue': 0.0,
            'gross_profit': 0.0,
            'settlement_profit': 0.0,
            'ad_spend': 0.0,
            'ad_orders': 0,
            'refund_amount': 0.0,
            'refund_count': 0,
        }
        
        # 用于计算平均值的计数器
        ad_days = 0  # 有广告数据的天数
        refund_days = 0  # 有退款数据的天数
        
        # 流式读取
        for batch in parquet_file.iter_batches(batch_size=10000, columns=available_cols):
            batch_df = batch.to_pandas()
            
            # ASIN过滤
            if 'ASIN' in batch_df.columns:
                batch_df = batch_df[batch_df['ASIN'].astype(str).str.upper().isin(asin_set)]
            
            if batch_df.empty:
                continue
            
            # 店铺过滤
            if shop_set and '店铺' in batch_df.columns:
                batch_df = batch_df[batch_df['店铺'].isin(shop_set)]
            
            if batch_df.empty:
                continue
            
            # 日期过滤
            if '日期' in batch_df.columns:
                batch_df = batch_df[
                    (batch_df['日期'] >= start_date) & 
                    (batch_df['日期'] <= end_date)
                ]
            
            if batch_df.empty:
                continue
            
            # 汇总数据
            for _, row in batch_df.iterrows():
                # 销售数据
                totals['orders'] += self._safe_int(row.get('订单量'))
                totals['sales'] += self._safe_int(row.get('销量'))
                totals['revenue'] += self._safe_float(row.get('销售额'))
                
                # 利润数据（使用结算利润）
                totals['gross_profit'] += self._safe_float(row.get('订单毛利润'))
                totals['settlement_profit'] += self._safe_float(row.get('结算毛利润'))
                
                # 广告数据
                ad_spend = self._safe_float(row.get('广告花费'))
                if ad_spend > 0:
                    totals['ad_spend'] += ad_spend
                    totals['ad_orders'] += self._safe_int(row.get('广告订单量'))
                    ad_days += 1
                
                # 退款数据
                refund_amount = self._safe_float(row.get('退款金额'))
                if refund_amount > 0:
                    totals['refund_amount'] += refund_amount
                    totals['refund_count'] += self._safe_int(row.get('退款量'))
                    refund_days += 1
        
        # 计算比率
        gross_profit_rate = (totals['gross_profit'] / totals['revenue'] * 100) if totals['revenue'] > 0 else 0.0
        settlement_profit_rate = (totals['settlement_profit'] / totals['revenue'] * 100) if totals['revenue'] > 0 else 0.0
        ad_acos = (totals['ad_spend'] / totals['revenue'] * 100) if totals['revenue'] > 0 else 0.0
        refund_rate = (totals['refund_count'] / totals['sales'] * 100) if totals['sales'] > 0 else 0.0
        
        return {
            'label': label,
            'start_date': start_date,
            'end_date': end_date,
            'date_range': f"{start_date} ~ {end_date}",
            'orders': totals['orders'],
            'sales': totals['sales'],
            'revenue': round(totals['revenue'], 2),
            'gross_profit': round(totals['gross_profit'], 2),
            'gross_profit_rate': round(gross_profit_rate, 2),
            'settlement_profit': round(totals['settlement_profit'], 2),
            'settlement_profit_rate': round(settlement_profit_rate, 2),
            'ad_spend': round(totals['ad_spend'], 2),
            'ad_orders': totals['ad_orders'],
            'ad_acos': round(ad_acos, 2),
            'refund_amount': round(totals['refund_amount'], 2),
            'refund_count': totals['refund_count'],
            'refund_rate': round(refund_rate, 2),
        }
    
    def _empty_period_data(self, label: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """返回空的周期数据"""
        return {
            'label': label,
            'start_date': start_date,
            'end_date': end_date,
            'date_range': f"{start_date} ~ {end_date}",
            'orders': 0,
            'sales': 0,
            'revenue': 0.0,
            'gross_profit': 0.0,
            'gross_profit_rate': 0.0,
            'settlement_profit': 0.0,
            'settlement_profit_rate': 0.0,
            'ad_spend': 0.0,
            'ad_orders': 0,
            'ad_acos': 0.0,
            'refund_amount': 0.0,
            'refund_count': 0,
            'refund_rate': 0.0,
        }
    
    def _safe_int(self, value: Any) -> int:
        """安全转换为整数"""
        try:
            return int(float(value)) if value is not None else 0
        except:
            return 0
    
    def _safe_float(self, value: Any) -> float:
        """安全转换为浮点数"""
        try:
            return float(value) if value is not None else 0.0
        except:
            return 0.0
    
    def get_daily_trend(
        self,
        asins: List[str],
        start_date: str,
        end_date: str,
        shops: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        获取指定时间范围内的每日销量趋势数据
        用于折线图展示
        
        Args:
            asins: ASIN列表
            start_date: 开始日期
            end_date: 结束日期
            shops: 店铺筛选
            
        Returns:
            {
                'dates': ['2025-05-27', '2025-05-28', ...],
                'sales': [10, 15, ...],
                'revenue': [100.0, 150.0, ...]
            }
        """
        if not asins:
            return {'dates': [], 'sales': [], 'revenue': []}
        
        parquet_file = self._get_parquet_file()
        columns = self.get_columns()
        
        # 需要的列
        need_cols = ['ASIN', '日期', '店铺', '销量', '销售额']
        available_cols = [c for c in need_cols if c in columns]
        
        # 转换ASIN为大写
        asin_set = set(a.strip().upper() for a in asins)
        shop_set = set(shops) if shops else None
        
        # 生成日期列表
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        
        date_list = []
        current_dt = start_dt
        while current_dt <= end_dt:
            date_list.append(current_dt.strftime('%Y-%m-%d'))
            current_dt += timedelta(days=1)
        
        # 初始化每日数据
        daily_data = {d: {'sales': 0, 'revenue': 0.0} for d in date_list}
        
        # 流式读取
        for batch in parquet_file.iter_batches(batch_size=10000, columns=available_cols):
            batch_df = batch.to_pandas()
            
            # ASIN过滤
            if 'ASIN' in batch_df.columns:
                batch_df = batch_df[batch_df['ASIN'].astype(str).str.upper().isin(asin_set)]
            
            if batch_df.empty:
                continue
            
            # 店铺过滤
            if shop_set and '店铺' in batch_df.columns:
                batch_df = batch_df[batch_df['店铺'].isin(shop_set)]
            
            if batch_df.empty:
                continue
            
            # 日期过滤
            if '日期' in batch_df.columns:
                batch_df = batch_df[
                    (batch_df['日期'] >= start_date) & 
                    (batch_df['日期'] <= end_date)
                ]
            
            if batch_df.empty:
                continue
            
            # 汇总每日数据
            for _, row in batch_df.iterrows():
                date_str = str(row.get('日期', ''))
                if date_str in daily_data:
                    daily_data[date_str]['sales'] += self._safe_int(row.get('销量'))
                    daily_data[date_str]['revenue'] += self._safe_float(row.get('销售额'))
        
        return {
            'dates': date_list,
            'sales': [daily_data[d]['sales'] for d in date_list],
            'revenue': [round(daily_data[d]['revenue'], 2) for d in date_list]
        }


# 全局服务实例
_product_sales_service: Optional[ProductSalesService] = None


def get_product_sales_service() -> ProductSalesService:
    """获取产品销量服务实例（单例）"""
    global _product_sales_service
    if _product_sales_service is None:
        _product_sales_service = ProductSalesService()
    return _product_sales_service
