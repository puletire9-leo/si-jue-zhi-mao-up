import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class ScoringEngine:
    """
    评分引擎

    读取评分配置，根据商品数据计算 score（0-100）和 grade（S/A/B/C/D）。
    """

    def __init__(self, mysql):
        self.mysql = mysql
        self._config_cache = None
        self._grade_cache = None

    async def load_config(self):
        """从数据库加载评分配置"""
        # 加载维度配置
        dim_query = "SELECT dimension_key, display_name, weight, thresholds, is_active FROM scoring_config ORDER BY id"
        dimensions = await self.mysql.execute_query(dim_query)

        # 加载等级阈值
        grade_query = "SELECT grade, min_score, max_score, color FROM grade_thresholds ORDER BY min_score DESC"
        grades = await self.mysql.execute_query(grade_query)

        self._config_cache = dimensions
        self._grade_cache = grades

    def invalidate_cache(self):
        """清除配置缓存，下次计算时重新加载"""
        self._config_cache = None
        self._grade_cache = None

    async def score_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """
        计算单个商品的评分

        Args:
            product: 商品数据字典，需包含 delivery_method, listing_date, sales_volume,
                     main_category_rank, price 等字段

        Returns:
            {"score": int, "grade": str}
        """
        if self._config_cache is None:
            await self.load_config()

        # FBM 特殊规则：直接给 S 级 100 分
        delivery_method = (product.get('delivery_method') or '').upper().strip()
        if delivery_method == 'FBM':
            return {"score": 100, "grade": "S"}

        # 计算各维度得分
        weighted_sum = 0.0
        total_weight = 0.0

        for dim in self._config_cache:
            if not dim.get('is_active', True):
                continue

            key = dim['dimension_key']
            weight = float(dim['weight'])
            thresholds = dim['thresholds']

            # 解析 thresholds（可能是字符串或已解析的列表）
            if isinstance(thresholds, str):
                import json
                thresholds = json.loads(thresholds)

            # 获取维度原始值
            raw_value = self._get_dimension_value(key, product)
            if raw_value is None:
                continue

            # 查表得分
            dim_score = self._lookup_score(key, raw_value, thresholds)
            weighted_sum += dim_score * (weight / 100.0)
            total_weight += weight

        # 计算综合得分
        if total_weight > 0:
            score = round(weighted_sum * 100 / total_weight)
        else:
            score = 0

        score = max(0, min(100, score))

        # 确定等级
        grade = self._determine_grade(score)

        return {"score": score, "grade": grade}

    def _get_dimension_value(self, key: str, product: Dict[str, Any]) -> Optional[float]:
        """获取维度原始值"""
        if key == 'listing_age':
            listing_date = product.get('listing_date')
            if listing_date is None:
                return None
            if isinstance(listing_date, str):
                try:
                    listing_date = datetime.strptime(listing_date, '%Y-%m-%d').date()
                except ValueError:
                    return None
            if isinstance(listing_date, datetime):
                listing_date = listing_date.date()
            if isinstance(listing_date, date):
                days = (date.today() - listing_date).days
                return max(0, days)
            return None

        elif key == 'sales_volume':
            val = product.get('sales_volume')
            return float(val) if val is not None else None

        elif key == 'bsr_rank':
            val = product.get('main_category_rank')
            return float(val) if val is not None else None

        elif key == 'price':
            val = product.get('price')
            return float(val) if val is not None else None

        return None

    def _lookup_score(self, key: str, value: float, thresholds: List[Dict]) -> int:
        """根据阈值配置查表得分数"""
        if key == 'listing_age':
            # 越小越好：value <= max
            for t in thresholds:
                if value <= t.get('max', float('inf')):
                    return t['score']
            return thresholds[-1]['score'] if thresholds else 0

        elif key == 'bsr_rank':
            # 越小越好：value <= max
            for t in thresholds:
                if value <= t.get('max', float('inf')):
                    return t['score']
            return thresholds[-1]['score'] if thresholds else 0

        elif key in ('sales_volume', 'price'):
            # 区间匹配：min <= value < max
            for t in thresholds:
                t_min = t.get('min', 0)
                t_max = t.get('max', float('inf'))
                if t_min <= value < t_max:
                    return t['score']
            # 超出范围取最后一个
            return thresholds[-1]['score'] if thresholds else 0

        return 0

    def _determine_grade(self, score: int) -> str:
        """根据分数确定等级"""
        if self._grade_cache:
            for g in self._grade_cache:
                if g['min_score'] <= score <= g['max_score']:
                    return g['grade']

        # 默认阈值
        if score >= 90:
            return 'S'
        elif score >= 80:
            return 'A'
        elif score >= 65:
            return 'B'
        elif score >= 50:
            return 'C'
        else:
            return 'D'

    async def score_products_batch(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        批量计算商品评分

        Args:
            products: 商品数据列表

        Returns:
            [{"id": int, "score": int, "grade": str}, ...]
        """
        if self._config_cache is None:
            await self.load_config()

        results = []
        for product in products:
            result = await self.score_product(product)
            results.append({
                "id": product.get('id'),
                "asin": product.get('asin'),
                "score": result['score'],
                "grade": result['grade']
            })
        return results

    async def get_current_week_tag(self) -> str:
        """获取当前ISO周标记，格式: 2026-W19"""
        now = datetime.now()
        iso_year, iso_week, _ = now.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"

    async def mark_week(self, week_tag: str) -> int:
        """
        标记周：将当前 is_current=1 的数据置为 0（旧周降级）

        Args:
            week_tag: 本周标记

        Returns:
            被降级的记录数
        """
        # 检查是否是新的一周
        check_query = "SELECT DISTINCT week_tag FROM selection_products WHERE is_current = 1 LIMIT 1"
        existing = await self.mysql.execute_query_one(check_query)

        if existing and existing.get('week_tag') == week_tag:
            # 同一周，不需要降级
            return 0

        # 新的一周，降级旧数据
        update_query = "UPDATE selection_products SET is_current = 0 WHERE is_current = 1"
        result = await self.mysql.execute_update(update_query)
        logger.info(f"周切换：将 {result} 条旧数据 is_current 置为 0")
        return result
