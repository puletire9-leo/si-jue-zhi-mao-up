from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from ..models.product import ProductResponse
from ..repositories.mysql_repo import MySQLRepository
from ..repositories.redis_repo import RedisRepository

logger = logging.getLogger(__name__)


class ProductRecycleService:
    """
    产品回收站服务类
    
    提供产品回收站管理的业务逻辑，包括：
    - 获取回收站产品列表
    - 恢复删除的产品
    - 永久删除产品
    - 清理过期产品
    """
    
    def __init__(
        self,
        mysql: MySQLRepository,
        redis: Optional[RedisRepository] = None
    ):
        self.mysql = mysql
        self.redis = redis
    
    async def get_recycled_products(
        self,
        page: int = 1,
        size: int = 20,
        sku: Optional[str] = None,
        name: Optional[str] = None,
        type: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取回收站产品列表
        
        Args:
            page: 页码
            size: 每页数量
            sku: 产品SKU筛选
            name: 产品名称筛选
            type: 产品类型筛选
            category: 产品分类筛选
            
        Returns:
            包含产品列表和分页信息的字典
        """
        try:
            # 构建查询条件
            where_conditions = ["status = 'deleted'"]
            values = []
            
            if sku:
                where_conditions.append("sku LIKE %s")
                values.append(f"%{sku}%")
            
            if name:
                where_conditions.append("name LIKE %s")
                values.append(f"%{name}%")
            
            if type:
                where_conditions.append("type = %s")
                values.append(type)
            
            if category:
                where_conditions.append("category LIKE %s")
                values.append(f"%{category}%")
            
            where_clause = " AND ".join(where_conditions)
            
            # 计算分页
            offset = (page - 1) * size
            
            # 查询总数
            count_query = f'SELECT COUNT(*) as total FROM products WHERE {where_clause}'
            count_result = await self.mysql.execute_query_one(count_query, values)
            total = count_result['total'] if count_result else 0
            
            # 查询列表
            list_query = f'''
                SELECT * FROM products 
                WHERE {where_clause} 
                ORDER BY delete_time DESC
                LIMIT %s OFFSET %s
            '''
            values.extend([size, offset])
            
            results = await self.mysql.execute_query(list_query, values)
            
            # 转换为响应格式
            products = [self._db_to_product_response(row) for row in results]
            
            return {
                "list": products,
                "total": total,
                "page": page,
                "size": size
            }
            
        except Exception as e:
            logger.error(f"获取回收站产品列表失败: {e}")
            raise
    
    async def restore_product(self, sku: str) -> bool:
        """
        恢复删除的产品
        
        Args:
            sku: 产品SKU
            
        Returns:
            bool: 恢复是否成功
        """
        try:
            # 检查产品是否存在且状态为已删除
            check_query = "SELECT sku FROM products WHERE sku = %s AND status = 'deleted'"
            result = await self.mysql.execute_query_one(check_query, (sku,))
            
            if not result:
                logger.warning(f"[WARN] 恢复失败：产品SKU {sku} 不存在或不在回收站中")
                return False
            
            # 恢复产品（更新状态和清除删除时间）
            update_query = '''
                UPDATE products 
                SET status = 'normal', delete_time = NULL, updated_at = NOW()
                WHERE sku = %s
            '''
            await self.mysql.execute_update(update_query, (sku,))
            
            # 清除缓存
            self._clear_product_cache(sku)
            
            logger.info(f"[OK] 恢复产品成功 | SKU: {sku}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 恢复产品失败 | SKU: {sku} | 错误: {e}")
            raise
    
    async def batch_restore_products(self, skus: List[str]) -> int:
        """
        批量恢复产品
        
        Args:
            skus: 产品SKU列表
            
        Returns:
            int: 恢复的产品数量
        """
        try:
            if not skus:
                return 0
            
            # 检查存在的SKU
            placeholders = ','.join(['%s'] * len(skus))
            check_query = f'SELECT sku FROM products WHERE sku IN ({placeholders}) AND status = \'deleted\''
            existing_skus = await self.mysql.execute_query(check_query, tuple(skus))
            
            if not existing_skus:
                logger.warning(f"[WARN] 批量恢复失败：没有找到有效的回收站产品SKU")
                return 0
            
            valid_skus = [sku['sku'] for sku in existing_skus]
            
            # 批量恢复产品
            update_placeholders = ','.join(['%s'] * len(valid_skus))
            update_query = f'''
                UPDATE products 
                SET status = 'normal', delete_time = NULL, updated_at = NOW()
                WHERE sku IN ({update_placeholders})
            '''
            await self.mysql.execute_update(update_query, tuple(valid_skus))
            
            # 清除缓存
            for sku in valid_skus:
                self._clear_product_cache(sku)
            
            logger.info(f"[OK] 批量恢复产品成功 | 数量: {len(valid_skus)}")
            return len(valid_skus)
            
        except Exception as e:
            logger.error(f"[FAIL] 批量恢复产品失败 | 错误: {e}")
            raise
    
    async def permanently_delete_product(self, sku: str) -> bool:
        """
        永久删除产品（从回收站彻底删除）
        
        Args:
            sku: 产品SKU
            
        Returns:
            bool: 删除是否成功
        """
        try:
            # 检查产品是否存在且状态为已删除
            check_query = "SELECT sku FROM products WHERE sku = %s AND status = 'deleted'"
            result = await self.mysql.execute_query_one(check_query, (sku,))
            
            if not result:
                logger.warning(f"[WARN] 永久删除失败：产品SKU {sku} 不存在或不在回收站中")
                return False
            
            # 先删除 product_bundles 表中引用该SKU的记录
            delete_bundles_query = 'DELETE FROM product_bundles WHERE parent_sku = %s'
            await self.mysql.execute_delete(delete_bundles_query, (sku,))
            
            # 永久删除产品
            delete_query = 'DELETE FROM products WHERE sku = %s'
            await self.mysql.execute_delete(delete_query, (sku,))
            
            # 清除缓存
            self._clear_product_cache(sku)
            
            logger.info(f"[OK] 永久删除产品成功 | SKU: {sku}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 永久删除产品失败 | SKU: {sku} | 错误: {e}")
            raise
    
    async def batch_permanently_delete_products(self, skus: List[str]) -> int:
        """
        批量永久删除产品（从回收站彻底删除）
        
        Args:
            skus: 产品SKU列表
            
        Returns:
            int: 删除的产品数量
        """
        try:
            if not skus:
                return 0
            
            # 检查存在的SKU
            placeholders = ','.join(['%s'] * len(skus))
            check_query = f'SELECT sku FROM products WHERE sku IN ({placeholders}) AND status = \'deleted\''
            existing_skus = await self.mysql.execute_query(check_query, tuple(skus))
            
            if not existing_skus:
                logger.warning(f"[WARN] 批量永久删除失败：没有找到有效的回收站产品SKU")
                return 0
            
            valid_skus = [sku['sku'] for sku in existing_skus]
            
            # 先删除 product_bundles 表中引用这些SKU的记录
            delete_bundles_query = f'DELETE FROM product_bundles WHERE parent_sku IN ({placeholders})'
            await self.mysql.execute_delete(delete_bundles_query, tuple(valid_skus))
            
            # 批量永久删除产品
            delete_query = f'DELETE FROM products WHERE sku IN ({placeholders})'
            await self.mysql.execute_delete(delete_query, tuple(valid_skus))
            
            # 清除缓存
            for sku in valid_skus:
                self._clear_product_cache(sku)
            
            logger.info(f"[OK] 批量永久删除产品成功 | 数量: {len(valid_skus)}")
            return len(valid_skus)
            
        except Exception as e:
            logger.error(f"[FAIL] 批量永久删除产品失败 | 错误: {e}")
            raise
    
    async def clear_expired_products(self, days: int = 30) -> int:
        """
        清理回收站中过期的产品
        
        Args:
            days: 保留天数（默认30天）
            
        Returns:
            int: 清理的产品数量
        """
        try:
            # 计算过期时间点
            expire_time = datetime.now() - timedelta(days=days)
            
            # 查询过期的产品
            query = "SELECT sku FROM products WHERE status = 'deleted' AND delete_time < %s"
            expired_products = await self.mysql.execute_query(query, (expire_time,))
            
            if not expired_products:
                logger.info(f"[OK] 没有过期的产品需要清理 | 保留天数: {days}")
                return 0
            
            expired_skus = [product['sku'] for product in expired_products]
            
            # 批量永久删除过期产品
            deleted_count = await self.batch_permanently_delete_products(expired_skus)
            
            logger.info(f"[OK] 清理过期产品成功 | 数量: {deleted_count} | 保留天数: {days}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"[FAIL] 清理过期产品失败 | 错误: {e}")
            raise
    
    async def get_recycle_stats(self) -> Dict[str, Any]:
        """
        获取回收站统计信息
        
        Returns:
            包含回收站统计信息的字典
        """
        try:
            # 回收站产品总数
            total_query = "SELECT COUNT(*) as total FROM products WHERE status = 'deleted'"
            total_result = await self.mysql.execute_query_one(total_query)
            total_recycled = total_result['total'] if total_result else 0
            
            # 按类型统计
            type_query = """
                SELECT type, COUNT(*) as count 
                FROM products 
                WHERE status = 'deleted'
                GROUP BY type
            """
            type_results = await self.mysql.execute_query(type_query)
            
            # 最近删除时间
            recent_query = "SELECT MAX(delete_time) as recent FROM products WHERE status = 'deleted'"
            recent_result = await self.mysql.execute_query_one(recent_query)
            recent_delete = recent_result['recent'] if recent_result else None
            
            return {
                "total_recycled": total_recycled,
                "type_stats": {row['type']: row['count'] for row in type_results},
                "recent_delete": recent_delete
            }
            
        except Exception as e:
            logger.error(f"获取回收站统计信息失败: {e}")
            raise
    
    def _db_to_product_response(self, db_row: Dict[str, Any]) -> ProductResponse:
        """
        将数据库行转换为产品响应对象
        
        Args:
            db_row: 数据库行数据
            
        Returns:
            ProductResponse: 产品响应对象
        """
        import json
        
        return ProductResponse(
            sku=db_row.get('sku'),
            name=db_row.get('name'),
            type=db_row.get('type'),
            image=db_row.get('image'),
            local_path=db_row.get('local_path'),
            thumb_path=db_row.get('thumb_path'),
            description=db_row.get('description'),
            price=float(db_row.get('price')) if db_row.get('price') else None,
            stock=int(db_row.get('stock')) if db_row.get('stock') else 0,
            category=db_row.get('category'),
            tags=json.loads(db_row.get('tags')) if db_row.get('tags') else [],
            developer=db_row.get('developer'),
            included_items=db_row.get('included_items'),
            created_at=db_row.get('created_at'),
            updated_at=db_row.get('updated_at'),
            delete_time=db_row.get('delete_time')
        )
    
    def _clear_product_cache(self, sku: str):
        """
        清除产品缓存
        
        Args:
            sku: 产品SKU
        """
        if self.redis:
            cache_key = f"product:{sku}"
            # 异步清除缓存，不等待完成
            import asyncio
            asyncio.create_task(self.redis.cache_delete(cache_key))