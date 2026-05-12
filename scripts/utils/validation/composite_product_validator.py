"""
组合产品数据验证模块
"""
import pymysql
from typing import List, Dict, Optional, Tuple

def check_circular_reference(conn: pymysql.Connection, parent_sku: str, child_sku: str) -> Tuple[bool, str]:
    """
    检查是否存在循环引用
    
    Args:
        conn: 数据库连接
        parent_sku: 父产品SKU
        child_sku: 子产品SKU
    
    Returns:
        (是否通过验证, 错误消息)
    """
    if parent_sku == child_sku:
        return False, "产品不能是自己的子产品"
    
    try:
        with conn.cursor() as cur:
            # 检查child_sku是否已经是parent_sku的祖先（防止循环引用）
            sql = """
                WITH RECURSIVE product_hierarchy AS (
                    SELECT parent_sku, sku
                    FROM products
                    WHERE sku = %s AND parent_sku IS NOT NULL
                    
                    UNION ALL
                    
                    SELECT p.parent_sku, p.sku
                    FROM products p
                    INNER JOIN product_hierarchy ph ON p.sku = ph.parent_sku
                    WHERE p.parent_sku IS NOT NULL
                )
                SELECT * FROM product_hierarchy WHERE parent_sku = %s
            """
            
            # 如果数据库不支持WITH RECURSIVE，使用迭代方式
            try:
                cur.execute(sql, (child_sku, parent_sku))
                if cur.fetchone():
                    return False, f"检测到循环引用：{parent_sku} 和 {child_sku} 不能相互包含"
            except Exception:
                # 回退到迭代检查
                current_parent = parent_sku
                visited = set()
                
                while current_parent:
                    if current_parent in visited:
                        return False, "检测到循环引用"
                    visited.add(current_parent)
                    
                    if current_parent == child_sku:
                        return False, f"检测到循环引用：{parent_sku} 和 {child_sku} 不能相互包含"
                    
                    cur.execute("SELECT parent_sku FROM products WHERE sku = %s", (current_parent,))
                    result = cur.fetchone()
                    current_parent = result['parent_sku'] if result else None
        
        return True, ""
        
    except Exception as e:
        return False, f"循环引用检查失败: {str(e)}"


def validate_sub_products(conn: pymysql.Connection, parent_sku: str, sub_skus: List[str]) -> Tuple[bool, List[str]]:
    """
    验证子产品列表
    
    Args:
        conn: 数据库连接
        parent_sku: 父产品SKU
        sub_skus: 子产品SKU列表
    
    Returns:
        (是否通过验证, 错误消息列表)
    """
    errors = []
    
    if not sub_skus:
        return True, []
    
    if len(sub_skus) > 50:
        errors.append(f"子产品数量不能超过50个，当前为{len(sub_skus)}个")
    
    try:
        with conn.cursor() as cur:
            # 检查所有子产品是否存在且状态正常
            placeholders = ','.join(['%s'] * len(sub_skus))
            sql = f"""
                SELECT sku, status, parent_sku
                FROM products
                WHERE sku IN ({placeholders})
            """
            cur.execute(sql, sub_skus)
            existing_products = {row['sku']: row for row in cur.fetchall()}
            
            for sub_sku in sub_skus:
                if sub_sku not in existing_products:
                    errors.append(f"子产品 {sub_sku} 不存在")
                    continue
                
                product = existing_products[sub_sku]
                if product['status'] != 'normal':
                    errors.append(f"子产品 {sub_sku} 状态不是normal，当前状态为{product['status']}")
                
                # 检查循环引用
                is_valid, error_msg = check_circular_reference(conn, parent_sku, sub_sku)
                if not is_valid:
                    errors.append(error_msg)
        
        return len(errors) == 0, errors
        
    except Exception as e:
        return False, [f"验证子产品失败: {str(e)}"]


def validate_product_update(conn: pymysql.Connection, sku: str, parent_sku: Optional[str] = None) -> Tuple[bool, str]:
    """
    验证产品更新操作
    
    Args:
        conn: 数据库连接
        sku: 产品SKU
        parent_sku: 新的父产品SKU（可选）
    
    Returns:
        (是否通过验证, 错误消息)
    """
    try:
        with conn.cursor() as cur:
            # 检查产品是否存在
            cur.execute("SELECT sku, status FROM products WHERE sku = %s", (sku,))
            product = cur.fetchone()
            
            if not product:
                return False, f"产品 {sku} 不存在"
            
            if product['status'] != 'normal':
                return False, f"产品 {sku} 状态不是normal，当前状态为{product['status']}"
            
            # 如果设置了parent_sku，验证父产品
            if parent_sku:
                cur.execute("SELECT sku, status FROM products WHERE sku = %s", (parent_sku,))
                parent = cur.fetchone()
                
                if not parent:
                    return False, f"父产品 {parent_sku} 不存在"
                
                if parent['status'] != 'normal':
                    return False, f"父产品 {parent_sku} 状态不是normal，当前状态为{parent['status']}"
                
                # 检查循环引用
                is_valid, error_msg = check_circular_reference(conn, parent_sku, sku)
                if not is_valid:
                    return False, error_msg
        
        return True, ""
        
    except Exception as e:
        return False, f"验证产品更新失败: {str(e)}"


def get_sub_products_count(conn: pymysql.Connection, parent_sku: str) -> int:
    """
    获取产品的子产品数量
    
    Args:
        conn: 数据库连接
        parent_sku: 父产品SKU
    
    Returns:
        子产品数量
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) as count FROM products WHERE parent_sku = %s AND status = 'normal'",
                (parent_sku,)
            )
            result = cur.fetchone()
            return result['count'] if result else 0
    except Exception:
        return 0


def is_composite_product(conn: pymysql.Connection, sku: str) -> bool:
    """
    检查产品是否为组合产品
    
    Args:
        conn: 数据库连接
        sku: 产品SKU
    
    Returns:
        是否为组合产品
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) as count FROM products WHERE parent_sku = %s AND status = 'normal'",
                (sku,)
            )
            result = cur.fetchone()
            return result['count'] > 0 if result else False
    except Exception:
        return False
