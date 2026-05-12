"""
产品搜索模块
支持组合关键词搜索、多关键词、AND/OR逻辑
"""
import re
from typing import List, Dict, Tuple, Optional
import pymysql


def parse_search_keywords(keyword: str) -> Tuple[List[str], str]:
    """
    解析搜索关键词，提取关键词和搜索模式
    
    Args:
        keyword: 搜索关键词字符串
    
    Returns:
        (关键词列表, 搜索模式) 搜索模式可以是 'AND' 或 'OR'
    """
    if not keyword or not keyword.strip():
        return [], 'AND'
    
    # 移除多余空格
    keyword = keyword.strip()
    
    # 检查是否使用 OR 模式（使用 | 分隔）
    if '|' in keyword:
        keywords = [k.strip() for k in keyword.split('|') if k.strip()]
        return keywords, 'OR'
    
    # 检查是否使用 AND 模式（使用空格分隔）
    # 使用正则表达式分割，保留引号内的内容
    keywords = []
    in_quotes = False
    current_keyword = []
    
    for char in keyword:
        if char == '"':
            in_quotes = not in_quotes
        elif char == ' ' and not in_quotes:
            if current_keyword:
                keywords.append(''.join(current_keyword))
                current_keyword = []
        else:
            current_keyword.append(char)
    
    if current_keyword:
        keywords.append(''.join(current_keyword))
    
    # 移除引号
    keywords = [k.replace('"', '').strip() for k in keywords if k.strip()]
    
    return keywords, 'AND'


def build_search_sql(keywords: List[str], mode: str = 'AND') -> Tuple[str, List]:
    """
    构建搜索SQL语句
    
    Args:
        keywords: 关键词列表
        mode: 搜索模式 ('AND' 或 'OR')
    
    Returns:
        (SQL WHERE子句, 参数列表)
    """
    if not keywords:
        return "", []
    
    conditions = []
    params = []
    
    for keyword in keywords:
        # 支持在SKU、名称、开发者字段中搜索
        condition = "(sku LIKE %s OR name LIKE %s OR developer LIKE %s)"
        conditions.append(condition)
        params.extend([f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'])
    
    if mode == 'AND':
        where_clause = ' AND '.join(conditions)
    else:
        where_clause = ' OR '.join(conditions)
    
    return where_clause, params


def search_products(
    conn: pymysql.Connection,
    keywords: List[str],
    mode: str = 'AND',
    page: int = 1,
    page_size: int = 20
) -> Tuple[List[Dict], int]:
    """
    搜索产品
    
    Args:
        conn: 数据库连接
        keywords: 关键词列表
        mode: 搜索模式 ('AND' 或 'OR')
        page: 页码
        page_size: 每页数量
    
    Returns:
        (产品列表, 总数)
    """
    offset = (page - 1) * page_size
    
    with conn.cursor() as cur:
        # 构建搜索条件
        where_clause, params = build_search_sql(keywords, mode)
        
        # 查询总数
        count_sql = f"""
            SELECT COUNT(DISTINCT sku) as total
            FROM products 
            WHERE status = 'normal'
        """
        if where_clause:
            count_sql += f" AND {where_clause}"
        
        cur.execute(count_sql, params)
        total_result = cur.fetchone()
        total = total_result['total'] if total_result else 0
        
        # 查询产品列表
        list_sql = f"""
            SELECT sku, name, thumb_path, local_path, product_type
            FROM products 
            WHERE status = 'normal'
        """
        if where_clause:
            list_sql += f" AND {where_clause}"
        
        list_sql += """
            GROUP BY sku
            ORDER BY sku DESC 
            LIMIT %s OFFSET %s
        """
        
        cur.execute(list_sql, params + [page_size, offset])
        products = cur.fetchall()
        
        return products, total


def highlight_search_result(text: str, keywords: List[str]) -> str:
    """
    高亮显示搜索结果中的关键词
    
    Args:
        text: 原始文本
        keywords: 关键词列表
    
    Returns:
        高亮后的HTML文本
    """
    if not text or not keywords:
        return text
    
    result = text
    for keyword in keywords:
        # 使用正则表达式进行不区分大小写的替换
        pattern = re.compile(f'({re.escape(keyword)})', re.IGNORECASE)
        result = pattern.sub(r'<mark>\1</mark>', result)
    
    return result


def validate_search_keyword(keyword: str) -> Tuple[bool, str]:
    """
    验证搜索关键词
    
    Args:
        keyword: 搜索关键词
    
    Returns:
        (是否有效, 错误消息)
    """
    if not keyword or not keyword.strip():
        return False, "搜索关键词不能为空"
    
    keyword = keyword.strip()
    
    # 检查关键词长度
    if len(keyword) > 200:
        return False, "搜索关键词过长（最多200个字符）"
    
    # 检查是否包含特殊字符（允许引号、空格、竖线）
    allowed_pattern = r'^[\w\s\|\u4e00-\u9fa5"\-]+$'
    if not re.match(allowed_pattern, keyword):
        return False, "搜索关键词包含非法字符"
    
    return True, ""


def get_search_suggestions(conn: pymysql.Connection, keyword: str, limit: int = 10) -> List[str]:
    """
    获取搜索建议
    
    Args:
        conn: 数据库连接
        keyword: 输入的关键词
        limit: 返回建议数量
    
    Returns:
        建议列表
    """
    if not keyword or len(keyword) < 2:
        return []
    
    with conn.cursor() as cur:
        sql = """
            SELECT DISTINCT name
            FROM products 
            WHERE name LIKE %s AND status = 'normal'
            LIMIT %s
        """
        cur.execute(sql, (f'%{keyword}%', limit))
        results = cur.fetchall()
        
        return [row['name'] for row in results if row['name']]
