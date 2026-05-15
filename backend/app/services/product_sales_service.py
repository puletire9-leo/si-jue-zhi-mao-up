"""
产品销量数据服务 — 基于 DuckDB 直接查询 Parquet
所有查询统一按 (ASIN, 日期, 店铺) 去重，取 MAX 值
"""
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from collections import defaultdict
import re
import duckdb
import os

from ..config import settings
from ..models.product_sales import (
    ProductSummary, SearchResponse, WeeklySalesResponse,
    DeclineProduct, DeclineAnalysisResponse
)


def _quote(name: str) -> str:
    return f'"{name}"'

# 列名简写
C = lambda name: _quote(name)


class ProductSalesService:
    """产品销量数据服务（DuckDB 引擎 + 去重）"""

    def __init__(self):
        self._conn: Optional[duckdb.DuckDBPyConnection] = None

    @property
    def PARQUET_PATH(self) -> str:
        return os.path.join(settings.PARQUET_DATA_DIR, settings.PARQUET_FILE_NAME)

    @property
    def conn(self) -> duckdb.DuckDBPyConnection:
        if self._conn is None:
            self._conn = duckdb.connect()
        return self._conn

    def _ensure_file(self):
        if not os.path.exists(self.PARQUET_PATH):
            raise FileNotFoundError(f"Parquet文件不存在: {self.PARQUET_PATH}")

    # ================================================================
    # 去重数据源 — 每个 (ASIN, 日期, 店铺) 取 MAX，消除重复行
    # ================================================================

    # 文本列和数值列分开处理
    _NUMERIC_COLS = {'销量', '销售额', '订单量', '订单毛利润', '结算毛利润',
                     '广告花费', '广告订单量', '退款金额', '退款量'}

    def _dedup_source(self, extra_cols: List[str] = None) -> str:
        """返回去重后的子查询 SQL"""
        text_cols = ['ASIN', '标题', 'SKU', 'MSKU', '店铺', '日期']
        num_cols = list(self._NUMERIC_COLS)
        if extra_cols:
            for c in extra_cols:
                if c not in text_cols and c not in num_cols:
                    num_cols.append(c)

        group_cols = ['ASIN', '日期', '店铺']
        agg = []
        for c in text_cols + num_cols:
            q = C(c)
            if c in group_cols:
                agg.append(f"{q} AS {q}")
            elif c in self._NUMERIC_COLS:
                agg.append(f"MAX(CAST({q} AS DOUBLE)) AS {q}")
            else:
                # 文本列：MAX 在相同值间安全（重复行值一样）
                agg.append(f"MAX({q}) AS {q}")

        return f"""(
            SELECT {', '.join(agg)}
            FROM '{{path}}'
            GROUP BY {C('ASIN')}, {C('日期')}, {C('店铺')}
        )"""

    def _dedup(self, extra_cols: List[str] = None) -> str:
        return self._dedup_source(extra_cols).format(path=self.PARQUET_PATH)

    # ================================================================
    # 基础查询
    # ================================================================

    def get_shops(self) -> List[str]:
        self._ensure_file()
        sql = f"""
            SELECT DISTINCT {C('店铺')} AS shop
            FROM {self._dedup()}
            WHERE {C('店铺')} IS NOT NULL
            ORDER BY shop
        """
        return [row[0] for row in self.conn.execute(sql).fetchall()]

    def get_date_range(self) -> Tuple[str, str]:
        self._ensure_file()
        col = C('日期')
        r1 = self.conn.execute(
            f"SELECT {col} FROM {self._dedup()} WHERE {col} IS NOT NULL "
            f"ORDER BY {col} LIMIT 1"
        ).fetchone()
        r2 = self.conn.execute(
            f"SELECT {col} FROM {self._dedup()} WHERE {col} IS NOT NULL "
            f"ORDER BY {col} DESC LIMIT 1"
        ).fetchone()
        return (str(r1[0]) if r1 and r1[0] else "", str(r2[0]) if r2 and r2[0] else "")

    def get_total_rows(self) -> int:
        self._ensure_file()
        return self.conn.execute(f"SELECT COUNT(*) FROM {self._dedup()}").fetchone()[0]

    def get_columns(self) -> List[str]:
        self._ensure_file()
        rows = self.conn.execute(f"DESCRIBE SELECT * FROM '{self.PARQUET_PATH}'").fetchall()
        return [r[0] for r in rows]

    # ================================================================
    # 产品搜索
    # ================================================================

    def search_products(
        self,
        keyword: Optional[str] = None,
        shops: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> SearchResponse:
        self._ensure_file()
        src = self._dedup()

        where = ["1=1"]
        if keyword:
            kw = keyword.replace("'", "''")
            like = f"'%{kw}%'"
            clauses = [f"{C(col)} ILIKE {like}" for col in ['ASIN', '标题', 'SKU', 'MSKU']]
            where.append(f"({' OR '.join(clauses)})")
        if shops:
            vals = ", ".join(f"'{s}'" for s in shops)
            where.append(f"{C('店铺')} IN ({vals})")
        if start_date:
            where.append(f"{C('日期')} >= '{start_date}'")
        if end_date:
            where.append(f"{C('日期')} <= '{end_date}'")

        where_clause = ' AND '.join(where)

        count_sql = f"SELECT COUNT(DISTINCT {C('ASIN')}) FROM {src} WHERE {where_clause}"
        total = self.conn.execute(count_sql).fetchone()[0]

        sql = f"""
            SELECT
                {C('ASIN')} AS asin,
                {C('标题')} AS title,
                {C('SKU')} AS sku,
                {C('MSKU')} AS msku,
                {C('店铺')} AS shop,
                SUM(CAST({C('销量')} AS DOUBLE)) AS total_sales,
                SUM(CAST({C('销售额')} AS DOUBLE)) AS total_revenue
            FROM {src}
            WHERE {where_clause}
            GROUP BY asin, title, sku, msku, shop
            ORDER BY total_sales DESC
            LIMIT {limit} OFFSET {offset}
        """
        rows = self.conn.execute(sql).fetchall()

        products = []
        for r in rows:
            products.append(ProductSummary(
                asin=r[0] or "",
                title=(r[1] or "")[:100],
                sku=r[2] if r[2] else None,
                msku=r[3] if r[3] else None,
                shop=r[4] or "未知",
                total_sales=int(float(r[5] or 0)),
                total_revenue=float(r[6] or 0)
            ))

        return SearchResponse(
            total=total,
            products=products,
            has_more=total > offset + limit
        )

    # ================================================================
    # 周销量
    # ================================================================

    def get_weekly_sales(
        self,
        asins: List[str],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        shops: Optional[List[str]] = None
    ) -> WeeklySalesResponse:
        if not asins:
            return WeeklySalesResponse(weeks=[], week_labels=[], data={}, revenue_data={})

        self._ensure_file()
        src = self._dedup()
        asin_list = ", ".join(f"'{a.strip().upper()}'" for a in asins)

        where = [f"{C('ASIN')} IN ({asin_list})"]
        if shops:
            vals = ", ".join(f"'{s}'" for s in shops)
            where.append(f"{C('店铺')} IN ({vals})")
        if start_date:
            where.append(f"{C('日期')} >= '{start_date}'")
        if end_date:
            where.append(f"{C('日期')} <= '{end_date}'")

        sql = f"""
            SELECT
                {C('ASIN')} AS asin,
                date_trunc('week', CAST({C('日期')} AS DATE)) AS week_start,
                SUM(CAST({C('销量')} AS DOUBLE)) AS sales,
                SUM(CAST({C('销售额')} AS DOUBLE)) AS revenue
            FROM {src}
            WHERE {' AND '.join(where)}
            GROUP BY asin, week_start
            ORDER BY week_start
        """
        rows = self.conn.execute(sql).fetchall()

        weeks_set = set()
        asin_weekly: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(
            lambda: defaultdict(lambda: {'sales': 0, 'revenue': 0})
        )
        for r in rows:
            asin = (r[0] or "").strip().upper()
            week_start = str(r[1])[:10]
            weeks_set.add(week_start)
            asin_weekly[asin][week_start]['sales'] += float(r[2] or 0)
            asin_weekly[asin][week_start]['revenue'] += float(r[3] or 0)

        sorted_weeks = sorted(weeks_set)

        week_labels = []
        for w in sorted_weeks:
            try:
                wd = datetime.strptime(w, '%Y-%m-%d')
                ed = wd + timedelta(days=6)
                week_labels.append(f"{wd.month:02d}/{wd.day:02d}~{ed.month:02d}/{ed.day:02d}")
            except Exception:
                week_labels.append(w)

        result_data = {}
        result_revenue = {}
        for asin in asins:
            au = asin.strip().upper()
            sd = asin_weekly[au]
            result_data[au] = [int(sd.get(w, {}).get('sales', 0)) for w in sorted_weeks]
            result_revenue[au] = [round(sd.get(w, {}).get('revenue', 0), 2) for w in sorted_weeks]

        return WeeklySalesResponse(
            weeks=sorted_weeks,
            week_labels=week_labels,
            data=result_data,
            revenue_data=result_revenue
        )

    # ================================================================
    # 周期汇总数据
    # ================================================================

    def get_period_data(
        self,
        asins: List[str],
        start_date: str,
        end_date: str,
        shops: Optional[List[str]] = None,
        label: str = "周期"
    ) -> Dict[str, Any]:
        if not asins:
            return self._empty_period_data(label, start_date, end_date)

        self._ensure_file()
        src = self._dedup()
        asin_list = ", ".join(f"'{a.strip().upper()}'" for a in asins)

        where = [
            f"{C('ASIN')} IN ({asin_list})",
            f"{C('日期')} >= '{start_date}'",
            f"{C('日期')} <= '{end_date}'"
        ]
        if shops:
            vals = ", ".join(f"'{s}'" for s in shops)
            where.append(f"{C('店铺')} IN ({vals})")

        sql = f"""
            SELECT
                SUM(CAST({C('订单量')} AS DOUBLE)) AS orders,
                SUM(CAST({C('销量')} AS DOUBLE)) AS sales,
                SUM(CAST({C('销售额')} AS DOUBLE)) AS revenue,
                SUM(CAST({C('订单毛利润')} AS DOUBLE)) AS gross_profit,
                SUM(CAST({C('结算毛利润')} AS DOUBLE)) AS settlement_profit,
                SUM(CAST({C('广告花费')} AS DOUBLE)) AS ad_spend,
                SUM(CAST({C('广告订单量')} AS DOUBLE)) AS ad_orders,
                SUM(CAST({C('退款金额')} AS DOUBLE)) AS refund_amount,
                SUM(CAST({C('退款量')} AS DOUBLE)) AS refund_count
            FROM {src}
            WHERE {' AND '.join(where)}
        """
        r = self.conn.execute(sql).fetchone()

        totals = {
            'orders':       int(float(r[0] or 0)),
            'sales':        int(float(r[1] or 0)),
            'revenue':      float(r[2] or 0),
            'gross_profit':      float(r[3] or 0),
            'settlement_profit': float(r[4] or 0),
            'ad_spend':          float(r[5] or 0),
            'ad_orders':         int(float(r[6] or 0)),
            'refund_amount':     float(r[7] or 0),
            'refund_count':      int(float(r[8] or 0)),
        }

        rev = totals['revenue']
        sales = totals['sales']

        return {
            'label': label,
            'start_date': start_date,
            'end_date': end_date,
            'date_range': f"{start_date} ~ {end_date}",
            'orders': totals['orders'],
            'sales': totals['sales'],
            'revenue': round(rev, 2),
            'gross_profit': round(totals['gross_profit'], 2),
            'gross_profit_rate': round(totals['gross_profit'] / rev * 100, 2) if rev > 0 else 0.0,
            'settlement_profit': round(totals['settlement_profit'], 2),
            'settlement_profit_rate': round(totals['settlement_profit'] / rev * 100, 2) if rev > 0 else 0.0,
            'ad_spend': round(totals['ad_spend'], 2),
            'ad_orders': totals['ad_orders'],
            'ad_acos': round(totals['ad_spend'] / rev * 100, 2) if rev > 0 else 0.0,
            'refund_amount': round(totals['refund_amount'], 2),
            'refund_count': totals['refund_count'],
            'refund_rate': round(totals['refund_count'] / sales * 100, 2) if sales > 0 else 0.0,
        }

    def _empty_period_data(self, label: str, start_date: str, end_date: str) -> Dict[str, Any]:
        return {
            'label': label, 'start_date': start_date, 'end_date': end_date,
            'date_range': f"{start_date} ~ {end_date}",
            'orders': 0, 'sales': 0, 'revenue': 0.0,
            'gross_profit': 0.0, 'gross_profit_rate': 0.0,
            'settlement_profit': 0.0, 'settlement_profit_rate': 0.0,
            'ad_spend': 0.0, 'ad_orders': 0, 'ad_acos': 0.0,
            'refund_amount': 0.0, 'refund_count': 0, 'refund_rate': 0.0,
        }

    # ================================================================
    # 每日趋势
    # ================================================================

    def get_daily_trend(
        self,
        asins: List[str],
        start_date: str,
        end_date: str,
        shops: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        if not asins:
            return {'dates': [], 'sales': [], 'revenue': []}

        self._ensure_file()
        src = self._dedup()
        asin_list = ", ".join(f"'{a.strip().upper()}'" for a in asins)

        where = [
            f"{C('ASIN')} IN ({asin_list})",
            f"{C('日期')} >= '{start_date}'",
            f"{C('日期')} <= '{end_date}'"
        ]
        if shops:
            vals = ", ".join(f"'{s}'" for s in shops)
            where.append(f"{C('店铺')} IN ({vals})")

        sql = f"""
            SELECT
                {C('日期')} AS date,
                SUM(CAST({C('销量')} AS DOUBLE)) AS sales,
                SUM(CAST({C('销售额')} AS DOUBLE)) AS revenue
            FROM {src}
            WHERE {' AND '.join(where)}
            GROUP BY date
            ORDER BY date
        """
        rows = self.conn.execute(sql).fetchall()

        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        date_map: Dict[str, Dict[str, Any]] = {}
        current = start_dt
        while current <= end_dt:
            ds = current.strftime('%Y-%m-%d')
            date_map[ds] = {'sales': 0, 'revenue': 0.0}
            current += timedelta(days=1)

        for r in rows:
            ds = str(r[0])[:10]
            if ds in date_map:
                date_map[ds]['sales'] += float(r[1] or 0)
                date_map[ds]['revenue'] += float(r[2] or 0)

        dates = sorted(date_map.keys())
        return {
            'dates': dates,
            'sales': [int(date_map[d]['sales']) for d in dates],
            'revenue': [round(date_map[d]['revenue'], 2) for d in dates]
        }

    # ================================================================
    # 下滑分析
    # ================================================================

    def _period_to_dates(self, period_type: str, period: str) -> Tuple[str, str]:
        if period_type == 'week':
            m = re.match(r'(\d{4})-W(\d+)', period)
            if not m:
                raise ValueError(f"无效的周格式: {period}")
            week_num = int(m.group(2))
            min_date, _ = self.get_date_range()
            start = datetime.strptime(min_date, '%Y-%m-%d')
            first_monday = start - timedelta(days=start.weekday())
            week_start = first_monday + timedelta(weeks=week_num - 1)
            week_end = week_start + timedelta(days=6)
            return (week_start.strftime('%Y-%m-%d'), week_end.strftime('%Y-%m-%d'))

        elif period_type == 'month':
            m = re.match(r'(\d{4})-(\d{2})', period)
            if not m:
                raise ValueError(f"无效的月格式: {period}")
            year, month = int(m.group(1)), int(m.group(2))
            month_start = datetime(year, month, 1)
            if month == 12:
                month_end = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = datetime(year, month + 1, 1) - timedelta(days=1)
            return (month_start.strftime('%Y-%m-%d'), month_end.strftime('%Y-%m-%d'))

        raise ValueError(f"未知的周期类型: {period_type}")

    def get_decline_analysis(
        self,
        period_type: str,
        prev_period: str,
        curr_period: str,
        shops: Optional[List[str]] = None
    ) -> DeclineAnalysisResponse:
        prev_start, prev_end = self._period_to_dates(period_type, prev_period)
        curr_start, curr_end = self._period_to_dates(period_type, curr_period)

        self._ensure_file()
        src = self._dedup()

        shop_filter = ""
        if shops:
            vals = ", ".join(f"'{s}'" for s in shops)
            shop_filter = f"AND {C('店铺')} IN ({vals})"

        sql = f"""
            WITH prev AS (
                SELECT
                    {C('ASIN')} AS asin,
                    {C('店铺')} AS shop,
                    {C('标题')} AS title,
                    SUM(CAST({C('销量')} AS DOUBLE)) AS sales
                FROM {src}
                WHERE {C('日期')} >= '{prev_start}'
                  AND {C('日期')} <= '{prev_end}'
                  {shop_filter}
                GROUP BY asin, shop, title
            ),
            curr AS (
                SELECT
                    {C('ASIN')} AS asin,
                    {C('店铺')} AS shop,
                    SUM(CAST({C('销量')} AS DOUBLE)) AS sales
                FROM {src}
                WHERE {C('日期')} >= '{curr_start}'
                  AND {C('日期')} <= '{curr_end}'
                  {shop_filter}
                GROUP BY asin, shop
            )
            SELECT
                COALESCE(p.asin, c.asin) AS asin,
                p.title AS title,
                COALESCE(p.shop, c.shop) AS shop,
                CAST(COALESCE(p.sales, 0) AS INTEGER) AS prev_sales,
                CAST(COALESCE(c.sales, 0) AS INTEGER) AS curr_sales,
                CAST(COALESCE(p.sales, 0) - COALESCE(c.sales, 0) AS INTEGER) AS decline,
                CASE
                    WHEN COALESCE(p.sales, 0) > 0
                    THEN ROUND((COALESCE(c.sales, 0) - COALESCE(p.sales, 0)) * 100.0 / p.sales, 1)
                    WHEN COALESCE(c.sales, 0) > 0 THEN 100.0
                    ELSE 0.0
                END AS decline_pct
            FROM prev p
            FULL OUTER JOIN curr c ON p.asin = c.asin AND p.shop = c.shop
            WHERE COALESCE(p.sales, 0) > 0 OR COALESCE(c.sales, 0) > 0
            ORDER BY decline_pct ASC
        """
        rows = self.conn.execute(sql).fetchall()

        products = []
        for r in rows:
            products.append(DeclineProduct(
                asin=r[0] or "",
                title=(r[1] or "")[:100],
                shop=r[2] or "未知",
                prev_sales=int(r[3] or 0),
                curr_sales=int(r[4] or 0),
                decline=int(r[5] or 0),
                decline_pct=float(r[6] or 0)
            ))

        return DeclineAnalysisResponse(products=products)


# 全局服务实例
_product_sales_service: Optional[ProductSalesService] = None


def get_product_sales_service() -> ProductSalesService:
    global _product_sales_service
    if _product_sales_service is None:
        _product_sales_service = ProductSalesService()
    return _product_sales_service
