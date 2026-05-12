from typing import List, Optional
from ..repositories.mysql_repo import MySQLRepository
from ..schemas.system_log import (
    SystemDocCreate, SystemDocUpdate,
    UpdateRecordCreate, UpdateRecordUpdate,
    RequirementCreate, RequirementUpdate
)
import uuid
from datetime import datetime

class SystemLogService:
    """系统日志业务逻辑服务"""

    @staticmethod
    async def get_system_docs(db: MySQLRepository, skip: int = 0, limit: int = 100) -> List[dict]:
        """获取系统文档列表"""
        query = """
        SELECT id, title, content, category, createdAt, updatedAt
        FROM system_docs
        ORDER BY createdAt DESC
        LIMIT %s OFFSET %s
        """
        return await db.execute_query(query, (limit, skip))

    @staticmethod
    async def get_system_doc(db: MySQLRepository, doc_id: str) -> Optional[dict]:
        """获取系统文档详情"""
        query = """
        SELECT id, title, content, category, createdAt, updatedAt
        FROM system_docs
        WHERE id = %s
        """
        return await db.execute_query(query, (doc_id,), fetch_one=True)

    @staticmethod
    async def create_system_doc(db: MySQLRepository, doc: SystemDocCreate) -> dict:
        """创建系统文档"""
        doc_id = str(uuid.uuid4())
        now = datetime.now()
        query = """
        INSERT INTO system_docs (id, title, content, category, createdAt, updatedAt)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        await db.execute_insert(query, (doc_id, doc.title, doc.content, doc.category, now, now))
        return await SystemLogService.get_system_doc(db, doc_id)

    @staticmethod
    async def update_system_doc(db: MySQLRepository, doc_id: str, doc: SystemDocUpdate) -> Optional[dict]:
        """更新系统文档"""
        # 检查文档是否存在
        existing_doc = await SystemLogService.get_system_doc(db, doc_id)
        if not existing_doc:
            return None
        
        # 构建更新语句
        update_fields = []
        params = []
        
        if doc.title is not None:
            update_fields.append("title = %s")
            params.append(doc.title)
        if doc.content is not None:
            update_fields.append("content = %s")
            params.append(doc.content)
        if doc.category is not None:
            update_fields.append("category = %s")
            params.append(doc.category)
        
        # 添加更新时间
        update_fields.append("updatedAt = %s")
        params.append(datetime.now())
        
        # 添加文档ID
        params.append(doc_id)
        
        # 构建完整的更新语句
        set_clause = ", ".join(update_fields)
        query = f"""
        UPDATE system_docs
        SET {set_clause}
        WHERE id = %s
        """
        
        await db.execute_update(query, tuple(params))
        return await SystemLogService.get_system_doc(db, doc_id)

    @staticmethod
    async def delete_system_doc(db: MySQLRepository, doc_id: str) -> Optional[dict]:
        """删除系统文档"""
        # 检查文档是否存在
        existing_doc = await SystemLogService.get_system_doc(db, doc_id)
        if not existing_doc:
            return None
        
        # 删除文档
        query = "DELETE FROM system_docs WHERE id = %s"
        await db.execute_delete(query, (doc_id,))
        return existing_doc

    @staticmethod
    async def get_update_records(db: MySQLRepository, skip: int = 0, limit: int = 100) -> List[dict]:
        """获取更新记录列表"""
        query = """
        SELECT id, date, title, content, implementation, updateType, icon, createdAt
        FROM update_records
        ORDER BY date DESC
        LIMIT %s OFFSET %s
        """
        return await db.execute_query(query, (limit, skip))

    @staticmethod
    async def get_update_record(db: MySQLRepository, record_id: str) -> Optional[dict]:
        """获取更新记录详情"""
        query = """
        SELECT id, date, title, content, implementation, updateType, icon, createdAt
        FROM update_records
        WHERE id = %s
        """
        return await db.execute_query(query, (record_id,), fetch_one=True)

    @staticmethod
    async def create_update_record(db: MySQLRepository, record: UpdateRecordCreate) -> dict:
        """创建更新记录"""
        record_id = str(uuid.uuid4())
        now = datetime.now()
        query = """
        INSERT INTO update_records (id, date, title, content, implementation, updateType, icon, createdAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        await db.execute_insert(query, (
            record_id, record.date, record.title, record.content, 
            record.implementation, record.updateType, record.icon, now
        ))
        return await SystemLogService.get_update_record(db, record_id)

    @staticmethod
    async def update_update_record(db: MySQLRepository, record_id: str, record: UpdateRecordUpdate) -> Optional[dict]:
        """更新更新记录"""
        # 检查记录是否存在
        existing_record = await SystemLogService.get_update_record(db, record_id)
        if not existing_record:
            return None
        
        # 构建更新语句
        update_fields = []
        params = []
        
        if record.date is not None:
            update_fields.append("date = %s")
            params.append(record.date)
        if record.title is not None:
            update_fields.append("title = %s")
            params.append(record.title)
        if record.content is not None:
            update_fields.append("content = %s")
            params.append(record.content)
        if record.implementation is not None:
            update_fields.append("implementation = %s")
            params.append(record.implementation)
        if record.updateType is not None:
            update_fields.append("updateType = %s")
            params.append(record.updateType)
        if record.icon is not None:
            update_fields.append("icon = %s")
            params.append(record.icon)
        
        # 添加记录ID
        params.append(record_id)
        
        # 构建完整的更新语句
        set_clause = ", ".join(update_fields)
        query = f"""
        UPDATE update_records
        SET {set_clause}
        WHERE id = %s
        """
        
        await db.execute_update(query, tuple(params))
        return await SystemLogService.get_update_record(db, record_id)

    @staticmethod
    async def delete_update_record(db: MySQLRepository, record_id: str) -> Optional[dict]:
        """删除更新记录"""
        # 检查记录是否存在
        existing_record = await SystemLogService.get_update_record(db, record_id)
        if not existing_record:
            return None
        
        # 删除记录
        query = "DELETE FROM update_records WHERE id = %s"
        await db.execute_delete(query, (record_id,))
        return existing_record

    @staticmethod
    async def get_requirements(db: MySQLRepository, skip: int = 0, limit: int = 100) -> List[dict]:
        """获取需求清单列表"""
        query = """
        SELECT id, name, description, priority, status, createdAt, updatedAt
        FROM requirements
        ORDER BY createdAt DESC
        LIMIT %s OFFSET %s
        """
        return await db.execute_query(query, (limit, skip))

    @staticmethod
    async def get_requirement(db: MySQLRepository, req_id: str) -> Optional[dict]:
        """获取需求详情"""
        query = """
        SELECT id, name, description, priority, status, createdAt, updatedAt
        FROM requirements
        WHERE id = %s
        """
        return await db.execute_query(query, (req_id,), fetch_one=True)

    @staticmethod
    async def create_requirement(db: MySQLRepository, req: RequirementCreate) -> dict:
        """创建需求"""
        req_id = str(uuid.uuid4())
        now = datetime.now()
        query = """
        INSERT INTO requirements (id, name, description, priority, status, createdAt, updatedAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        await db.execute_insert(query, (
            req_id, req.name, req.description, req.priority, req.status, now, now
        ))
        return await SystemLogService.get_requirement(db, req_id)

    @staticmethod
    async def update_requirement(db: MySQLRepository, req_id: str, req: RequirementUpdate) -> Optional[dict]:
        """更新需求"""
        # 检查需求是否存在
        existing_req = await SystemLogService.get_requirement(db, req_id)
        if not existing_req:
            return None
        
        # 构建更新语句
        update_fields = []
        params = []
        
        if req.name is not None:
            update_fields.append("name = %s")
            params.append(req.name)
        if req.description is not None:
            update_fields.append("description = %s")
            params.append(req.description)
        if req.priority is not None:
            update_fields.append("priority = %s")
            params.append(req.priority)
        if req.status is not None:
            update_fields.append("status = %s")
            params.append(req.status)
        
        # 添加更新时间
        update_fields.append("updatedAt = %s")
        params.append(datetime.now())
        
        # 添加需求ID
        params.append(req_id)
        
        # 构建完整的更新语句
        set_clause = ", ".join(update_fields)
        query = f"""
        UPDATE requirements
        SET {set_clause}
        WHERE id = %s
        """
        
        await db.execute_update(query, tuple(params))
        return await SystemLogService.get_requirement(db, req_id)

    @staticmethod
    async def delete_requirement(db: MySQLRepository, req_id: str) -> Optional[dict]:
        """删除需求"""
        # 检查需求是否存在
        existing_req = await SystemLogService.get_requirement(db, req_id)
        if not existing_req:
            return None
        
        # 删除需求
        query = "DELETE FROM requirements WHERE id = %s"
        await db.execute_delete(query, (req_id,))
        return existing_req
