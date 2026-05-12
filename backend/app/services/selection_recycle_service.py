import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..models.selection import SelectionProductResponse
from ..repositories.mysql_repo import MySQLRepository

logger = logging.getLogger(__name__)


def to_camel_case(s: str) -> str:
    """
    将下划线命名转换为驼峰命名
    
    Args:
        s: 下划线命名的字符串
        
    Returns:
        驼峰命名的字符串
    """
    parts = s.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


def dict_to_camel_case(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    将字典中的所有下划线命名键转换为驼峰命名
    
    Args:
        data: 包含下划线命名键的字典
        
    Returns:
        包含驼峰命名键的字典
    """
    camel_data = {}
    for key, value in data.items():
        camel_key = to_camel_case(key)
        camel_data[camel_key] = value
    return camel_data


class SelectionRecycleService:
    """
    选品回收站服务类
    
    处理选品回收站相关的业务逻辑
    """
    
    def __init__(self, mysql: MySQLRepository):
        """
        初始化选品回收站服务
        
        Args:
            mysql: MySQL仓库实例
        """
        self.mysql = mysql
    
    async def get_recycled_products(
        self, 
        page: int = 1, 
        size: int = 20,
        asin: Optional[str] = None,
        product_title: Optional[str] = None,
        product_type: Optional[str] = None,
        store_name: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取回收站中的选品产品列表
        
        Args:
            page: 页码
            size: 每页数量
            asin: 产品ASIN
            product_title: 商品标题
            product_type: 产品类型
            store_name: 店铺名称
            category: 产品分类
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            产品列表和分页信息
        """
        try:
            offset = (page - 1) * size
            
            where_conditions = []
            query_params = []
            
            if asin:
                where_conditions.append("asin LIKE %s")
                query_params.append(f"%{asin}%")
            
            if product_title:
                where_conditions.append("product_title LIKE %s")
                query_params.append(f"%{product_title}%")
            
            if product_type:
                where_conditions.append("product_type = %s")
                query_params.append(product_type)
            
            if store_name:
                where_conditions.append("store_name LIKE %s")
                query_params.append(f"%{store_name}%")
            
            if category:
                where_conditions.append("category = %s")
                query_params.append(category)
            
            if start_date:
                where_conditions.append("deleted_at >= %s")
                query_params.append(f"{start_date} 00:00:00")
            
            if end_date:
                where_conditions.append("deleted_at <= %s")
                query_params.append(f"{end_date} 23:59:59")
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            count_query = f"SELECT COUNT(*) as total FROM selection_recycle_bin WHERE {where_clause}"
            count_result = await self.mysql.execute_query_one(count_query, tuple(query_params))
            total = count_result['total'] if count_result else 0
            
            list_query = f"""
                SELECT id, product_id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, category, tags, notes, product_type,
                       product_link, sales_volume, listing_date, listing_days, delivery_method,
                       similar_products, source, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate,
                       deleted_at, deleted_by, restore_count
                FROM selection_recycle_bin
                WHERE {where_clause}
                ORDER BY deleted_at DESC
                LIMIT %s OFFSET %s
            """
            
            list_params = query_params + [size, offset]
            products = await self.mysql.execute_query(list_query, tuple(list_params))
            
            product_list = []
            for product in products:
                # 先转换所有下划线命名的字段为驼峰命名
                camel_product = dict_to_camel_case(product)
                # 特殊处理tags字段，将字符串转换为列表
                camel_product['tags'] = camel_product['tags'].split(',') if camel_product['tags'] else []
                product_list.append(camel_product)
            
            return {
                "list": product_list,
                "total": total,
                "page": page,
                "size": size
            }
            
        except Exception as e:
            logger.error(f"获取回收站产品列表失败: {e}")
            raise Exception(f"获取回收站产品列表失败: {str(e)}")
    
    async def restore_product(self, recycle_id: int) -> bool:
        """
        恢复选品产品
        
        Args:
            recycle_id: 回收站记录ID
            
        Returns:
            是否恢复成功
        """
        try:
            # 1. 获取回收站中的产品信息
            select_query = """
                SELECT product_id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, category, tags, notes, product_type,
                       product_link, sales_volume, listing_date, listing_days, delivery_method,
                       similar_products, source, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate
                FROM selection_recycle_bin
                WHERE id = %s
            """
            
            product = await self.mysql.execute_query_one(select_query, (recycle_id,))
            if not product:
                return False
            
            # 2. 将产品插入回原表
            insert_query = """
                INSERT INTO selection_products 
                (asin, product_title, price, image_url, local_path, thumb_path, 
                 store_name, store_url, shop_id, category, tags, notes, product_type,
                 product_link, sales_volume, listing_date, listing_days, delivery_method, 
                 similar_products, source, main_category_name, main_category_rank,
                 main_category_bsr_growth, main_category_bsr_growth_rate,
                 created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            
            insert_params = (
                product['asin'],
                product['product_title'],
                product['price'],
                product['image_url'],
                product['local_path'],
                product['thumb_path'],
                product['store_name'],
                product['store_url'],
                product['shop_id'],
                product['category'],
                product['tags'],
                product['notes'],
                product['product_type'],
                product['product_link'],
                product['sales_volume'],
                product['listing_date'],
                product['listing_days'],
                product['delivery_method'],
                product['similar_products'],
                product['source'],
                product['main_category_name'],
                product['main_category_rank'],
                product['main_category_bsr_growth'],
                product['main_category_bsr_growth_rate']
            )
            
            await self.mysql.execute_insert(insert_query, insert_params)
            
            # 3. 从回收站中删除记录
            delete_query = "DELETE FROM selection_recycle_bin WHERE id = %s"
            result = await self.mysql.execute(delete_query, (recycle_id,))
            
            logger.info(f"[OK] 恢复选品产品成功 | 回收站ID: {recycle_id} | ASIN: {product['asin']}")
            return result > 0
            
        except Exception as e:
            logger.error(f"恢复选品产品失败: {e}")
            raise Exception(f"恢复选品产品失败: {str(e)}")
    
    async def batch_restore_products(self, recycle_ids: List[int]) -> int:
        """
        批量恢复选品产品
        
        Args:
            recycle_ids: 回收站记录ID列表
            
        Returns:
            恢复的产品数量
        """
        try:
            if not recycle_ids:
                return 0
            
            # 1. 获取所有要恢复的产品信息
            placeholders = ','.join(['%s'] * len(recycle_ids))
            select_query = f"""
                SELECT id, asin, product_title, price, image_url, local_path, thumb_path,
                       store_name, store_url, shop_id, category, tags, notes, product_type,
                       product_link, sales_volume, listing_date, listing_days, delivery_method,
                       similar_products, source, main_category_name, main_category_rank,
                       main_category_bsr_growth, main_category_bsr_growth_rate
                FROM selection_recycle_bin
                WHERE id IN ({placeholders})
            """
            
            products = await self.mysql.execute_query(select_query, tuple(recycle_ids))
            
            if not products:
                return 0
            
            # 2. 批量插入回原表
            insert_query = """
                INSERT INTO selection_products 
                (asin, product_title, price, image_url, local_path, thumb_path, 
                 store_name, store_url, shop_id, category, tags, notes, product_type,
                 product_link, sales_volume, listing_date, listing_days, delivery_method, 
                 similar_products, source, main_category_name, main_category_rank,
                 main_category_bsr_growth, main_category_bsr_growth_rate,
                 created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            
            insert_params = []
            for product in products:
                insert_params.append((
                    product['asin'],
                    product['product_title'],
                    product['price'],
                    product['image_url'],
                    product['local_path'],
                    product['thumb_path'],
                    product['store_name'],
                    product['store_url'],
                    product['shop_id'],
                    product['category'],
                    product['tags'],
                    product['notes'],
                    product['product_type'],
                    product['product_link'],
                    product['sales_volume'],
                    product['listing_date'],
                    product['listing_days'],
                    product['delivery_method'],
                    product['similar_products'],
                    product['source'],
                    product['main_category_name'],
                    product['main_category_rank'],
                    product['main_category_bsr_growth'],
                    product['main_category_bsr_growth_rate']
                ))
            
            await self.mysql.execute_batch(insert_query, insert_params)
            
            # 3. 批量从回收站中删除记录
            delete_query = f"DELETE FROM selection_recycle_bin WHERE id IN ({placeholders})"
            result = await self.mysql.execute_delete(delete_query, tuple(recycle_ids))
            
            logger.info(f"[OK] 批量恢复选品产品成功 | 恢复数量: {result} | 回收站ID数量: {len(recycle_ids)}")
            return result
            
        except Exception as e:
            logger.error(f"批量恢复选品产品失败: {e}")
            raise Exception(f"批量恢复选品产品失败: {str(e)}")
    
    async def permanently_delete_product(self, recycle_id: int) -> bool:
        """
        永久删除选品产品
        
        Args:
            recycle_id: 回收站记录ID
            
        Returns:
            是否删除成功
        """
        try:
            query = "DELETE FROM selection_recycle_bin WHERE id = %s"
            result = await self.mysql.execute(query, (recycle_id,))
            
            logger.info(f"[OK] 永久删除选品产品成功 | 回收站ID: {recycle_id}")
            return result > 0
            
        except Exception as e:
            logger.error(f"永久删除选品产品失败: {e}")
            raise Exception(f"永久删除选品产品失败: {str(e)}")
    
    async def batch_permanently_delete_products(self, recycle_ids: List[int]) -> int:
        """
        批量永久删除选品产品
        
        Args:
            recycle_ids: 回收站记录ID列表
            
        Returns:
            删除的产品数量
        """
        try:
            if not recycle_ids:
                return 0
            
            placeholders = ','.join(['%s'] * len(recycle_ids))
            query = f"DELETE FROM selection_recycle_bin WHERE id IN ({placeholders})"
            result = await self.mysql.execute_delete(query, tuple(recycle_ids))
            
            logger.info(f"[OK] 批量永久删除选品产品成功 | 删除数量: {result} | 回收站ID数量: {len(recycle_ids)}")
            return result
            
        except Exception as e:
            logger.error(f"批量永久删除选品产品失败: {e}")
            raise Exception(f"批量永久删除选品产品失败: {str(e)}")
    
    async def clear_recycle_bin(self) -> int:
        """
        清空选品回收站
        
        Returns:
            删除的产品数量
        """
        try:
            query = "DELETE FROM selection_recycle_bin"
            result = await self.mysql.execute_delete(query)
            
            logger.info(f"[OK] 清空选品回收站成功 | 删除数量: {result}")
            return result
            
        except Exception as e:
            logger.error(f"清空选品回收站失败: {e}")
            raise Exception(f"清空选品回收站失败: {str(e)}")
    
    async def get_recycle_stats(self) -> Dict[str, Any]:
        """
        获取回收站统计信息
        
        Returns:
            回收站统计数据
        """
        try:
            # 检查回收站表是否存在
            check_query = "SHOW TABLES LIKE 'selection_recycle_bin'"
            check_result = await self.mysql.execute_query(check_query)
            
            if not check_result:
                return {
                    "total_products": 0,
                    "today_deleted": 0,
                    "week_deleted": 0
                }
            
            # 获取总产品数
            total_result = await self.mysql.execute_query_one(
                "SELECT COUNT(*) as count FROM selection_recycle_bin"
            )
            total_count = total_result['count'] if total_result else 0
            
            # 获取今天删除的产品数
            today_result = await self.mysql.execute_query_one(
                "SELECT COUNT(*) as count FROM selection_recycle_bin WHERE DATE(deleted_at) = CURDATE()"
            )
            today_count = today_result['count'] if today_result else 0
            
            # 获取本周删除的产品数
            week_result = await self.mysql.execute_query_one(
                "SELECT COUNT(*) as count FROM selection_recycle_bin WHERE YEARWEEK(deleted_at) = YEARWEEK(CURDATE())"
            )
            week_count = week_result['count'] if week_result else 0
            
            return {
                "total_products": total_count,
                "today_deleted": today_count,
                "week_deleted": week_count
            }
            
        except Exception as e:
            logger.error(f"获取回收站统计失败: {e}")
            raise Exception(f"获取回收站统计失败: {str(e)}")