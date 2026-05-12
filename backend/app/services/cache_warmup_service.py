#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存预热服务 - 在应用启动时预加载常用数据到缓存
"""

import logging
from typing import List, Optional
from datetime import datetime, timedelta
from ..repositories.mysql_repo import MySQLRepository
from ..repositories.redis_repo import RedisRepository

logger = logging.getLogger(__name__)


class CacheWarmupService:
    """缓存预热服务"""

    def __init__(self, mysql: MySQLRepository, redis: RedisRepository):
        self.mysql = mysql
        self.redis = redis

    async def warmup_all(self):
        """预热所有常用缓存"""
        logger.info("开始缓存预热...")
        start_time = datetime.now()

        try:
            # 1. 预热表列表缓存
            await self._warmup_table_list()

            # 2. 预热筛选选项缓存
            await self._warmup_filter_options()

            # 3. 预热最近月份的数据概览
            await self._warmup_recent_data_overview()

            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"缓存预热完成，耗时: {elapsed:.2f}秒")

        except Exception as e:
            logger.error(f"缓存预热失败: {e}")

    async def _warmup_table_list(self):
        """预热表列表"""
        try:
            query = "SHOW TABLES LIKE 'product_data_20%'"
            tables = await self.mysql.execute_query(query)
            table_names = []
            for t in tables:
                if isinstance(t, dict):
                    table_names.append(list(t.values())[0])
                else:
                    table_names.append(t[0])

            months = [name.replace('product_data_', '') for name in table_names
                     if name.startswith('product_data_')]
            months.sort(reverse=True)

            # 缓存表列表（1小时）
            if self.redis:
                await self.redis.set('product_data:available_months', months, expire=3600)
                logger.info(f"预热表列表缓存: {len(months)} 个月份")

        except Exception as e:
            logger.warning(f"预热表列表失败: {e}")

    async def _warmup_filter_options(self):
        """预热筛选选项"""
        try:
            # 获取所有表
            query = "SHOW TABLES LIKE 'product_data_20%'"
            tables = await self.mysql.execute_query(query)

            if not tables:
                return

            # 使用最新的表
            latest_table = None
            for t in tables:
                table_name = list(t.values())[0] if isinstance(t, dict) else t[0]
                if table_name.startswith('product_data_'):
                    latest_table = table_name
                    break

            if not latest_table:
                return

            # 查询筛选选项
            stores_q = f"SELECT DISTINCT store FROM {latest_table} WHERE store IS NOT NULL AND store != '' ORDER BY store"
            countries_q = f"SELECT DISTINCT country FROM {latest_table} WHERE country IS NOT NULL AND country != '' ORDER BY country"
            devs_q = f"SELECT DISTINCT developer FROM {latest_table} WHERE developer IS NOT NULL AND developer != '' ORDER BY developer"
            cats_q = f"SELECT DISTINCT SUBSTRING_INDEX(main_category_rank, '|', 1) as category FROM {latest_table} WHERE main_category_rank IS NOT NULL LIMIT 50"

            stores = [r['store'] for r in await self.mysql.execute_query(stores_q)]
            countries = [r['country'] for r in await self.mysql.execute_query(countries_q)]
            developers = [r['developer'] for r in await self.mysql.execute_query(devs_q)]
            categories = [r['category'] for r in await self.mysql.execute_query(cats_q) if r['category']]

            filter_options = {
                'stores': stores,
                'countries': countries,
                'developers': developers,
                'categories': categories
            }

            # 缓存筛选选项（30分钟）
            if self.redis:
                await self.redis.set('product_data:filter_options', filter_options, expire=1800)
                logger.info(f"预热筛选选项缓存: {len(stores)} 店铺, {len(countries)} 国家, {len(developers)} 开发者, {len(categories)} 分类")

        except Exception as e:
            logger.warning(f"预热筛选选项失败: {e}")

    async def _warmup_recent_data_overview(self):
        """预热最近月份的数据概览"""
        try:
            # 获取最新月份
            query = "SHOW TABLES LIKE 'product_data_20%'"
            tables = await self.mysql.execute_query(query)

            if not tables:
                return

            # 获取最新的表
            latest_table = None
            latest_month = None
            for t in tables:
                table_name = list(t.values())[0] if isinstance(t, dict) else t[0]
                if table_name.startswith('product_data_'):
                    month = table_name.replace('product_data_', '')
                    if latest_month is None or month > latest_month:
                        latest_month = month
                        latest_table = table_name

            if not latest_table:
                return

            # 查询数据概览
            overview_q = f"""
                SELECT
                    COUNT(DISTINCT asin) as product_count,
                    SUM(sales_volume) as total_sales_volume,
                    SUM(sales_amount) as total_sales_amount,
                    SUM(order_quantity) as total_order_quantity,
                    SUM(ad_spend) as total_ad_spend,
                    SUM(ad_sales_amount) as total_ad_sales
                FROM {latest_table}
            """

            result = await self.mysql.execute_query_one(overview_q)

            if result:
                overview = {
                    'month': latest_month,
                    'productCount': int(result['product_count'] or 0),
                    'totalSalesVolume': int(result['total_sales_volume'] or 0),
                    'totalSalesAmount': float(result['total_sales_amount'] or 0),
                    'totalOrderQuantity': int(result['total_order_quantity'] or 0),
                    'totalAdSpend': float(result['total_ad_spend'] or 0),
                    'totalAdSales': float(result['total_ad_sales'] or 0)
                }

                # 缓存数据概览（15分钟）
                if self.redis:
                    await self.redis.set(f'product_data:overview:{latest_month}', overview, expire=900)
                    logger.info(f"预热数据概览缓存: {latest_month}")

        except Exception as e:
            logger.warning(f"预热数据概览失败: {e}")

    async def clear_cache(self, pattern: str = "product_data:*"):
        """清除缓存"""
        if not self.redis:
            return

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                await self.redis.delete(*keys)
                logger.info(f"清除缓存: {len(keys)} 个键")

        except Exception as e:
            logger.error(f"清除缓存失败: {e}")
