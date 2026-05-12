"""
产品搜索模块
"""
from .product_search import (
    parse_search_keywords,
    build_search_sql,
    search_products,
    highlight_search_result,
    validate_search_keyword,
    get_search_suggestions
)

__all__ = [
    'parse_search_keywords',
    'build_search_sql',
    'search_products',
    'highlight_search_result',
    'validate_search_keyword',
    'get_search_suggestions'
]
