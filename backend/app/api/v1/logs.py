"""
[参考] 日志管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: SystemLogController.java

最终删除日期：项目稳定运行后
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from ...repositories.mysql_repo import MySQLRepository, get_mysql_repo
from ...services.system_log_service import SystemLogService
from ...schemas.system_log import (
    SystemDoc, SystemDocCreate, SystemDocUpdate, SystemDocListResponse,
    UpdateRecord, UpdateRecordCreate, UpdateRecordUpdate, UpdateRecordListResponse,
    Requirement, RequirementCreate, RequirementUpdate, RequirementListResponse
)
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# 系统文档相关接口
@router.get("/system-docs", response_model=SystemDocListResponse)
async def get_system_docs(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回的记录数"),
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取系统文档列表"""
    try:
        docs = await SystemLogService.get_system_docs(db, skip=skip, limit=limit)
        total = len(docs)
        return SystemDocListResponse(list=docs, total=total)
    except Exception as e:
        logger.error(f"获取系统文档列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取系统文档列表失败")

@router.get("/system-docs/{doc_id}", response_model=SystemDoc)
async def get_system_doc(
    doc_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取系统文档详情"""
    try:
        doc = await SystemLogService.get_system_doc(db, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="系统文档不存在")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取系统文档详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取系统文档详情失败")

@router.post("/system-docs", response_model=SystemDoc)
async def create_system_doc(
    doc: SystemDocCreate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """创建系统文档"""
    try:
        return await SystemLogService.create_system_doc(db, doc)
    except Exception as e:
        logger.error(f"创建系统文档失败: {e}")
        raise HTTPException(status_code=500, detail="创建系统文档失败")

@router.put("/system-docs/{doc_id}", response_model=SystemDoc)
async def update_system_doc(
    doc_id: str,
    doc: SystemDocUpdate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """更新系统文档"""
    try:
        updated_doc = await SystemLogService.update_system_doc(db, doc_id, doc)
        if not updated_doc:
            raise HTTPException(status_code=404, detail="系统文档不存在")
        return updated_doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新系统文档失败: {e}")
        raise HTTPException(status_code=500, detail="更新系统文档失败")

@router.delete("/system-docs/{doc_id}")
async def delete_system_doc(
    doc_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """删除系统文档"""
    try:
        deleted_doc = await SystemLogService.delete_system_doc(db, doc_id)
        if not deleted_doc:
            raise HTTPException(status_code=404, detail="系统文档不存在")
        return {"message": "系统文档删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除系统文档失败: {e}")
        raise HTTPException(status_code=500, detail="删除系统文档失败")

# 更新记录相关接口
@router.get("/update-records", response_model=UpdateRecordListResponse)
async def get_update_records(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回的记录数"),
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取更新记录列表"""
    try:
        records = await SystemLogService.get_update_records(db, skip=skip, limit=limit)
        total = len(records)
        return UpdateRecordListResponse(list=records, total=total)
    except Exception as e:
        logger.error(f"获取更新记录列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取更新记录列表失败")

@router.get("/update-records/{record_id}", response_model=UpdateRecord)
async def get_update_record(
    record_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取更新记录详情"""
    try:
        record = await SystemLogService.get_update_record(db, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="更新记录不存在")
        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取更新记录详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取更新记录详情失败")

@router.post("/update-records", response_model=UpdateRecord)
async def create_update_record(
    record: UpdateRecordCreate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """创建更新记录"""
    try:
        return await SystemLogService.create_update_record(db, record)
    except Exception as e:
        logger.error(f"创建更新记录失败: {e}")
        raise HTTPException(status_code=500, detail="创建更新记录失败")

@router.put("/update-records/{record_id}", response_model=UpdateRecord)
async def update_update_record(
    record_id: str,
    record: UpdateRecordUpdate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """更新更新记录"""
    try:
        updated_record = await SystemLogService.update_update_record(db, record_id, record)
        if not updated_record:
            raise HTTPException(status_code=404, detail="更新记录不存在")
        return updated_record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新更新记录失败: {e}")
        raise HTTPException(status_code=500, detail="更新更新记录失败")

@router.delete("/update-records/{record_id}")
async def delete_update_record(
    record_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """删除更新记录"""
    try:
        deleted_record = await SystemLogService.delete_update_record(db, record_id)
        if not deleted_record:
            raise HTTPException(status_code=404, detail="更新记录不存在")
        return {"message": "更新记录删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除更新记录失败: {e}")
        raise HTTPException(status_code=500, detail="删除更新记录失败")

# 需求清单相关接口
@router.get("/requirements", response_model=RequirementListResponse)
async def get_requirements(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回的记录数"),
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取需求清单列表"""
    try:
        requirements = await SystemLogService.get_requirements(db, skip=skip, limit=limit)
        total = len(requirements)
        return RequirementListResponse(list=requirements, total=total)
    except Exception as e:
        logger.error(f"获取需求清单列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取需求清单列表失败")

@router.get("/requirements/{req_id}", response_model=Requirement)
async def get_requirement(
    req_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """获取需求详情"""
    try:
        requirement = await SystemLogService.get_requirement(db, req_id)
        if not requirement:
            raise HTTPException(status_code=404, detail="需求不存在")
        return requirement
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取需求详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取需求详情失败")

@router.post("/requirements", response_model=Requirement)
async def create_requirement(
    requirement: RequirementCreate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """创建需求"""
    try:
        return await SystemLogService.create_requirement(db, requirement)
    except Exception as e:
        logger.error(f"创建需求失败: {e}")
        raise HTTPException(status_code=500, detail="创建需求失败")

@router.put("/requirements/{req_id}", response_model=Requirement)
async def update_requirement(
    req_id: str,
    requirement: RequirementUpdate,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """更新需求"""
    try:
        updated_requirement = await SystemLogService.update_requirement(db, req_id, requirement)
        if not updated_requirement:
            raise HTTPException(status_code=404, detail="需求不存在")
        return updated_requirement
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新需求失败: {e}")
        raise HTTPException(status_code=500, detail="更新需求失败")

@router.delete("/requirements/{req_id}")
async def delete_requirement(
    req_id: str,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """删除需求"""
    try:
        deleted_requirement = await SystemLogService.delete_requirement(db, req_id)
        if not deleted_requirement:
            raise HTTPException(status_code=404, detail="需求不存在")
        return {"message": "需求删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除需求失败: {e}")
        raise HTTPException(status_code=500, detail="删除需求失败")

# 前端日志相关接口
@router.post("/frontend")
async def log_frontend_event(
    event: dict,
    db: MySQLRepository = Depends(get_mysql_repo)
):
    """记录前端事件日志"""
    try:
        # 处理前端日志数据
        logger.info(f"前端事件日志: {event}")
        # 可以根据需要将日志存储到数据库
        return {"message": "前端日志记录成功"}
    except Exception as e:
        logger.error(f"记录前端日志失败: {e}")
        raise HTTPException(status_code=500, detail="记录前端日志失败")
