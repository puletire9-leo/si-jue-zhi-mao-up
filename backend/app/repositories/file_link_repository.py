import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.file_link import FileLinkBase, FileLinkCreate, FileLinkUpdate, FileLinkInDB
from .mysql_repo import get_mysql_repo

logger = logging.getLogger(__name__)


class FileLinkRepository:
    """文件链接数据访问层"""
    
    def __init__(self):
        self.mysql_repo = get_mysql_repo()
    
    async def create_file_link(self, file_link: FileLinkCreate) -> int:
        """
        创建文件链接
        
        Args:
            file_link: 文件链接创建数据
            
        Returns:
            创建的链接ID
        """
        query = """
            INSERT INTO file_links (
                title, url, link_type, description, tags, category, 
                library_type, status, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (
            file_link.title,
            file_link.url,
            file_link.link_type.value,
            file_link.description,
            str(file_link.tags) if file_link.tags else None,
            file_link.category,
            file_link.library_type,
            'active',
            datetime.now(),
            datetime.now()
        )
        
        result = await self.mysql_repo.execute_insert(query, params)
        return result['last_id']
    
    async def get_file_link_by_id(self, link_id: int) -> Optional[FileLinkInDB]:
        """
        根据ID获取文件链接
        
        Args:
            link_id: 链接ID
            
        Returns:
            文件链接信息
        """
        query = """
            SELECT 
                id, title, url, link_type, description, tags, category,
                library_type, status, last_checked, check_result,
                created_at, updated_at
            FROM file_links 
            WHERE id = %s
        """
        
        result = await self.mysql_repo.execute_query(query, (link_id,), fetch_one=True)
        if not result:
            return None
        
        return FileLinkInDB(**result)
    
    async def get_file_links_by_library(
        self, 
        library_type: str, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[FileLinkInDB]:
        """
        根据库类型获取文件链接列表
        
        Args:
            library_type: 库类型 (prompt-library 或 resource-library)
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            文件链接列表
        """
        query = """
            SELECT 
                id, title, url, link_type, description, tags, category,
                library_type, status, last_checked, check_result,
                created_at, updated_at
            FROM file_links 
            WHERE library_type = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        
        results = await self.mysql_repo.execute_query(query, (library_type, limit, offset))
        return [FileLinkInDB(**result) for result in results]
    
    async def search_file_links(
        self, 
        keyword: str, 
        library_type: Optional[str] = None,
        limit: int = 100, 
        offset: int = 0
    ) -> List[FileLinkInDB]:
        """
        搜索文件链接
        
        Args:
            keyword: 搜索关键词
            library_type: 库类型（可选）
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            文件链接列表
        """
        if library_type:
            query = """
                SELECT 
                    id, title, url, link_type, description, tags, category,
                    library_type, status, last_checked, check_result,
                    created_at, updated_at
                FROM file_links 
                WHERE library_type = %s AND (title LIKE %s OR description LIKE %s)
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            pattern = f"%{keyword}%"
            params = (library_type, pattern, pattern, limit, offset)
        else:
            query = """
                SELECT 
                    id, title, url, link_type, description, tags, category,
                    library_type, status, last_checked, check_result,
                    created_at, updated_at
                FROM file_links 
                WHERE title LIKE %s OR description LIKE %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            pattern = f"%{keyword}%"
            params = (pattern, pattern, limit, offset)
        
        results = await self.mysql_repo.execute_query(query, params)
        return [FileLinkInDB(**result) for result in results]
    
    async def update_file_link(self, link_id: int, file_link: FileLinkUpdate) -> int:
        """
        更新文件链接
        
        Args:
            link_id: 链接ID
            file_link: 文件链接更新数据
            
        Returns:
            受影响的行数
        """
        update_fields = {}
        
        if file_link.title is not None:
            update_fields['title'] = file_link.title
        if file_link.url is not None:
            update_fields['url'] = file_link.url
        if file_link.description is not None:
            update_fields['description'] = file_link.description
        if file_link.tags is not None:
            update_fields['tags'] = str(file_link.tags)
        if file_link.category is not None:
            update_fields['category'] = file_link.category
        if file_link.status is not None:
            update_fields['status'] = file_link.status.value
        
        if not update_fields:
            return 0
        
        update_fields['updated_at'] = datetime.now()
        
        set_clause = ", ".join([f"{key} = %s" for key in update_fields.keys()])
        query = f"UPDATE file_links SET {set_clause} WHERE id = %s"
        params = tuple(update_fields.values()) + (link_id,)
        
        return await self.mysql_repo.execute_update(query, params)
    
    async def delete_file_link(self, link_id: int) -> int:
        """
        删除文件链接
        
        Args:
            link_id: 链接ID
            
        Returns:
            受影响的行数
        """
        query = "DELETE FROM file_links WHERE id = %s"
        return await self.mysql_repo.execute_update(query, (link_id,))
    
    async def batch_delete_file_links(self, link_ids: List[int]) -> int:
        """
        批量删除文件链接
        
        Args:
            link_ids: 链接ID列表
            
        Returns:
            受影响的行数
        """
        if not link_ids:
            return 0
        
        placeholders = ", ".join(["%s"] * len(link_ids))
        query = f"DELETE FROM file_links WHERE id IN ({placeholders})"
        
        return await self.mysql_repo.execute_update(query, tuple(link_ids))
    
    async def get_file_link_count(self, library_type: Optional[str] = None) -> int:
        """
        获取文件链接数量
        
        Args:
            library_type: 库类型（可选）
            
        Returns:
            文件链接数量
        """
        if library_type:
            query = "SELECT COUNT(*) as count FROM file_links WHERE library_type = %s"
            result = await self.mysql_repo.execute_query(query, (library_type,), fetch_one=True)
        else:
            query = "SELECT COUNT(*) as count FROM file_links"
            result = await self.mysql_repo.execute_query(query, fetch_one=True)
        
        return result['count'] if result else 0
    
    async def update_link_status(
        self, 
        link_id: int, 
        status: str,
        check_result: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        更新链接状态
        
        Args:
            link_id: 链接ID
            status: 状态
            check_result: 检查结果
            
        Returns:
            受影响的行数
        """
        query = """
            UPDATE file_links SET 
                status = %s, 
                last_checked = %s, 
                check_result = %s,
                updated_at = %s
            WHERE id = %s
        """
        
        params = (
            status,
            datetime.now(),
            str(check_result) if check_result else None,
            datetime.now(),
            link_id
        )
        
        return await self.mysql_repo.execute_update(query, params)
    
    async def get_links_by_category(
        self, 
        category: str, 
        library_type: Optional[str] = None,
        limit: int = 100, 
        offset: int = 0
    ) -> List[FileLinkInDB]:
        """
        根据分类获取文件链接
        
        Args:
            category: 分类
            library_type: 库类型（可选）
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            文件链接列表
        """
        if library_type:
            query = """
                SELECT 
                    id, title, url, link_type, description, tags, category,
                    library_type, status, last_checked, check_result,
                    created_at, updated_at
                FROM file_links 
                WHERE category = %s AND library_type = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            params = (category, library_type, limit, offset)
        else:
            query = """
                SELECT 
                    id, title, url, link_type, description, tags, category,
                    library_type, status, last_checked, check_result,
                    created_at, updated_at
                FROM file_links 
                WHERE category = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            params = (category, limit, offset)
        
        results = await self.mysql_repo.execute_query(query, params)
        return [FileLinkInDB(**result) for result in results]


# 全局FileLinkRepository实例
_file_link_repo_instance = None


async def get_file_link_repo() -> FileLinkRepository:
    """
    获取FileLinkRepository实例（单例模式）
    
    Returns:
        FileLinkRepository实例
    """
    global _file_link_repo_instance
    
    if _file_link_repo_instance is None:
        _file_link_repo_instance = FileLinkRepository()
    
    return _file_link_repo_instance