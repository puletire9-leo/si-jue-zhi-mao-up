import pymysql
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import requests
import asyncio

from ..models.file_link import FileLink, FileLinkCreate, FileLinkUpdate, FileLinkList, FileLinkStatus, FileLinkType
from ..repositories.mysql_repo import MySQLRepository, get_mysql_repo


class FileLinkService:
    """文件链接服务类"""
    
    def __init__(self, db_repo: MySQLRepository = None):
        self.db_repo = db_repo
    
    async def create_file_link(self, file_link: FileLinkCreate) -> FileLink:
        """创建文件链接"""
        # 验证链接类型
        self._validate_link_type(file_link.url, file_link.link_type)
        
        # 插入数据库
        query = """
        INSERT INTO file_links (title, url, link_type, description, tags, category, library_type, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'active')
        """
        
        tags_json = json.dumps(file_link.tags) if file_link.tags else None
        
        result = await self.db_repo.execute_insert(
            query,
            (file_link.title, file_link.url, file_link.link_type.value, 
             file_link.description, tags_json, file_link.category, file_link.library_type)
        )
        
        # 获取创建的链接
        link_id = result['last_id']
        return await self.get_file_link(link_id)
    
    async def get_file_link(self, link_id: int) -> FileLink:
        """获取单个文件链接"""
        query = """
        SELECT id, title, url, link_type, description, tags, category, library_type, 
               status, last_checked, check_result, created_at, updated_at
        FROM file_links 
        WHERE id = %s
        """
        
        result = await self.db_repo.execute_query_one(query, (link_id,))
        if not result:
            raise ValueError(f"文件链接不存在: {link_id}")
        
        return self._row_to_file_link(result)
    
    async def get_file_links(
        self,
        library_type: Optional[str] = None,
        page: int = 1,
        size: int = 12,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        link_type: Optional[FileLinkType] = None,
        status: Optional[FileLinkStatus] = None
    ) -> FileLinkList:
        """获取文件链接列表"""
        
        offset = (page - 1) * size
        
        # 构建查询条件
        conditions = []
        params = []
        
        if library_type:
            conditions.append("library_type = %s")
            params.append(library_type)
        
        if keyword:
            conditions.append("(title LIKE %s OR description LIKE %s)")
            params.extend([f"%{keyword}%", f"%{keyword}%"])
        
        if category:
            conditions.append("category = %s")
            params.append(category)
        
        if link_type:
            conditions.append("link_type = %s")
            params.append(link_type.value)
        
        if status:
            conditions.append("status = %s")
            params.append(status.value)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # 查询总数
        count_query = f"SELECT COUNT(*) as count FROM file_links WHERE {where_clause}"
        total_result = await self.db_repo.execute_query(count_query, tuple(params))
        total = total_result[0]['count'] if total_result and total_result[0] else 0
        
        # 查询数据
        data_query = f"""
        SELECT id, title, url, link_type, description, tags, category, library_type, 
               status, last_checked, check_result, created_at, updated_at
        FROM file_links 
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """
        data_params = params.copy()
        data_params.extend([size, offset])
        data_result = await self.db_repo.execute_query(data_query, tuple(data_params))
        
        items = [self._row_to_file_link(row) for row in data_result]
        
        return FileLinkList(
            items=items,
            total=total,
            page=page,
            size=size
        )
    
    async def update_file_link(self, link_id: int, update_data: FileLinkUpdate) -> FileLink:
        """更新文件链接"""
        # 检查链接是否存在
        await self.get_file_link(link_id)
        
        # 构建更新字段
        update_fields = []
        params = []
        
        if update_data.title is not None:
            update_fields.append("title = %s")
            params.append(update_data.title)
        
        if update_data.url is not None:
            update_fields.append("url = %s")
            params.append(update_data.url)
        
        if update_data.description is not None:
            update_fields.append("description = %s")
            params.append(update_data.description)
        
        if update_data.tags is not None:
            update_fields.append("tags = %s")
            params.append(json.dumps(update_data.tags))
        
        if update_data.category is not None:
            update_fields.append("category = %s")
            params.append(update_data.category)
        
        if update_data.status is not None:
            update_fields.append("status = %s")
            params.append(update_data.status.value)
        
        if not update_fields:
            return await self.get_file_link(link_id)
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        
        query = f"UPDATE file_links SET {', '.join(update_fields)} WHERE id = %s"
        params.append(link_id)
        
        await self.db_repo.execute_update(query, params)
        
        return await self.get_file_link(link_id)
    
    async def delete_file_link(self, link_id: int) -> bool:
        """删除文件链接"""
        # 检查链接是否存在
        await self.get_file_link(link_id)
        
        query = "DELETE FROM file_links WHERE id = %s"
        result = await self.db_repo.execute_delete(query, (link_id,))
        
        return result > 0
    
    async def batch_delete_file_links(self, link_ids: List[int]) -> int:
        """批量删除文件链接"""
        if not link_ids:
            return 0
        
        placeholders = ','.join(['%s'] * len(link_ids))
        query = f"DELETE FROM file_links WHERE id IN ({placeholders})"
        
        result = await self.db_repo.execute_delete(query, link_ids)
        
        return result
    
    async def check_link_status(self, link_id: int) -> Dict[str, Any]:
        """检查链接状态"""
        file_link = await self.get_file_link(link_id)
        
        try:
            # 异步检查链接状态
            status_code, response_time, error_message = await self._check_url_status(file_link.url)
            
            # 更新链接状态
            if status_code == 200:
                new_status = FileLinkStatus.ACTIVE
            elif status_code in [404, 403, 500]:
                new_status = FileLinkStatus.ERROR
            else:
                new_status = FileLinkStatus.INACTIVE
            
            check_result = {
                'status_code': status_code,
                'response_time': response_time,
                'error_message': error_message
            }
            
            await self.db_repo.execute_update(
                "UPDATE file_links SET status = %s, last_checked = %s, check_result = %s WHERE id = %s",
                (new_status.value, datetime.now(), json.dumps(check_result), link_id)
            )
            
            return {
                'link_id': link_id,
                'url': file_link.url,
                'status': new_status,
                'status_code': status_code,
                'response_time': response_time,
                'error_message': error_message,
                'last_checked': datetime.now()
            }
            
        except Exception as e:
            # 更新为错误状态
            await self.db_repo.execute_update(
                "UPDATE file_links SET status = %s, last_checked = %s, check_result = %s WHERE id = %s",
                (FileLinkStatus.ERROR.value, datetime.now(), json.dumps({'error': str(e)}), link_id)
            )
            
            return {
                'link_id': link_id,
                'url': file_link.url,
                'status': FileLinkStatus.ERROR,
                'error_message': str(e),
                'last_checked': datetime.now()
            }
    
    async def get_categories(self, library_type: str) -> List[str]:
        """获取分类列表"""
        query = """
        SELECT DISTINCT category 
        FROM file_links 
        WHERE library_type = %s AND category IS NOT NULL
        ORDER BY category
        """
        
        results = await self.db_repo.execute_query(query, (library_type,))
        return [row[0] for row in results if row[0]]
    
    def _validate_link_type(self, url: str, link_type: FileLinkType):
        """验证链接类型"""
        parsed_url = urlparse(url)
        
        if link_type == FileLinkType.FEISHU_XLSX:
            # 验证飞书xlsx链接格式
            if 'feishu.cn' not in parsed_url.netloc or 'office_edit=1' not in url:
                raise ValueError("无效的飞书xlsx链接格式")
        elif link_type == FileLinkType.STANDARD_URL:
            # 验证标准URL格式
            if not parsed_url.scheme or not parsed_url.netloc:
                raise ValueError("无效的URL格式")
    
    async def _check_url_status(self, url: str) -> tuple:
        """检查URL状态"""
        try:
            start_time = datetime.now()
            
            # 使用异步请求
            response = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: requests.head(url, timeout=10, allow_redirects=True)
            )
            
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            return response.status_code, response_time, None
            
        except requests.exceptions.RequestException as e:
            return None, None, str(e)
    
    def _row_to_file_link(self, row) -> FileLink:
        """将数据库行转换为FileLink对象"""
        return FileLink(
            id=row['id'],
            title=row['title'],
            url=row['url'],
            link_type=FileLinkType(row['link_type']),
            description=row['description'],
            tags=json.loads(row['tags']) if row['tags'] else None,
            category=row['category'],
            library_type=row['library_type'],
            status=FileLinkStatus(row['status']),
            last_checked=row['last_checked'],
            check_result=json.loads(row['check_result']) if row['check_result'] else None,
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )