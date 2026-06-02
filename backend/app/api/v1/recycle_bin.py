"""
[参考] 公共回收站API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: RecycleBinController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List
import logging
import json

from ...repositories import MySQLRepository
from ...middleware.auth_middleware import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recycle-bin", tags=["回收站管理"])


def get_mysql_repo():
    from fastapi import Request
    def _get_repo(request: Request):
        return request.app.state.mysql
    return Depends(_get_repo)


@router.get("/stats", summary="获取回收站统计")
async def get_recycle_bin_stats(
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """获取回收站统计信息"""
    try:
        check_table = await repo.execute_query("SHOW TABLES LIKE 'recycle_bin'")
        if not check_table:
            return {"code": 200, "message": "获取成功", "data": {"total_count": 0, "expiring_count": 0}}

        total_result = await repo.execute_query("SELECT COUNT(*) as count FROM recycle_bin")
        total_count = total_result[0]['count'] if total_result else 0

        # 30天前删除的记录视为即将过期
        expiring_result = await repo.execute_query(
            "SELECT COUNT(*) as count FROM recycle_bin WHERE deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )
        expiring_count = expiring_result[0]['count'] if expiring_result else 0

        return {"code": 200, "message": "获取成功", "data": {"total_count": total_count, "expiring_count": expiring_count}}
    except Exception as e:
        logger.error(f"获取回收站统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站统计失败")


@router.get("/products", summary="获取回收站列表")
async def get_recycle_bin_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="搜索关键词（匹配 original_table 或 data 中的 sku/name）"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """获取回收站列表"""
    try:
        check_table = await repo.execute_query("SHOW TABLES LIKE 'recycle_bin'")
        if not check_table:
            return {"code": 200, "message": "获取成功", "data": {"list": [], "total": 0}}

        offset = (page - 1) * size
        where_conditions = []
        params = []

        if q:
            where_conditions.append("(original_table LIKE %s OR JSON_EXTRACT(data, '$.sku') LIKE %s OR JSON_EXTRACT(data, '$.name') LIKE %s)")
            params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

        if start_date:
            where_conditions.append("deleted_at >= %s")
            params.append(start_date)

        if end_date:
            where_conditions.append("deleted_at <= %s")
            params.append(end_date)

        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

        products = await repo.execute_query(
            f"""
            SELECT id, original_table, original_id, data, deleted_by, deleted_at, restored_by, restored_at
            FROM recycle_bin
            WHERE {where_clause}
            ORDER BY deleted_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params) + (size, offset)
        )

        total_result = await repo.execute_query(
            f"SELECT COUNT(*) as count FROM recycle_bin WHERE {where_clause}",
            tuple(params)
        )
        total = total_result[0]['count'] if total_result else 0

        # 解析 JSON data 字段
        for item in products:
            if isinstance(item.get('data'), str):
                try:
                    item['data'] = json.loads(item['data'])
                except (json.JSONDecodeError, TypeError):
                    item['data'] = {}

        return {"code": 200, "message": "获取成功", "data": {"list": products, "total": total, "page": page, "size": size}}
    except Exception as e:
        logger.error(f"获取回收站列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取回收站列表失败")


@router.post("/restore/{record_id}", summary="恢复记录")
async def restore_record(
    record_id: int,
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """从回收站恢复记录"""
    try:
        records = await repo.execute_query(
            "SELECT * FROM recycle_bin WHERE id = %s", (record_id,)
        )
        if not records:
            raise HTTPException(status_code=404, detail="记录不存在")

        record = records[0]
        data = record.get('data', {})
        if isinstance(data, str):
            data = json.loads(data)

        original_table = record['original_table']

        # 根据原始表名恢复数据
        if original_table == 'products':
            await repo.execute_update(
                """INSERT INTO products (sku, name, product_type, description, developer, image_url, local_path, thumb_path, create_time, update_time, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')""",
                (data.get('sku'), data.get('name'), data.get('product_type'), data.get('description'),
                 data.get('developer'), data.get('image_url'), data.get('local_path'), data.get('thumb_path'),
                 data.get('create_time'), data.get('update_time'))
            )
        elif original_table == 'selection_products':
            await repo.execute_update(
                """INSERT INTO selection_products (asin, product_title, price, image_url, local_path, thumb_path,
                store_name, store_url, shop_id, main_category_name, main_category_rank, tags, notes, product_type,
                product_link, sales_volume, listing_date, delivery_method, similar_products, source, country,
                data_filter_mode, score, grade, week_tag, is_current, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (data.get('asin'), data.get('product_title'), data.get('price'), data.get('image_url'),
                 data.get('local_path'), data.get('thumb_path'), data.get('store_name'), data.get('store_url'),
                 data.get('shop_id'), data.get('main_category_name'), data.get('main_category_rank'),
                 data.get('tags'), data.get('notes'), data.get('product_type'), data.get('product_link'),
                 data.get('sales_volume'), data.get('listing_date'), data.get('delivery_method'),
                 data.get('similar_products'), data.get('source'), data.get('country'),
                 data.get('data_filter_mode'), data.get('score'), data.get('grade'), data.get('week_tag'),
                 data.get('is_current'), data.get('created_at'), data.get('updated_at'))
            )
        else:
            raise HTTPException(status_code=400, detail=f"不支持恢复的表类型: {original_table}")

        # 标记为已恢复
        await repo.execute_update(
            "UPDATE recycle_bin SET restored_by = %s, restored_at = NOW() WHERE id = %s",
            (user_info.get('id', 0), record_id)
        )

        return {"code": 200, "message": "恢复成功", "data": None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"恢复记录失败: {e}")
        raise HTTPException(status_code=500, detail="恢复记录失败")


@router.post("/batch-restore", summary="批量恢复")
async def batch_restore_records(
    record_ids: List[int] = Body(..., description="记录ID列表"),
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """批量恢复回收站记录"""
    try:
        if not record_ids:
            raise HTTPException(status_code=400, detail="请选择要恢复的记录")
        if len(record_ids) > 100:
            raise HTTPException(status_code=400, detail="批量恢复最多支持100条")

        success_count = 0
        errors = []
        for record_id in record_ids:
            try:
                # 复用单条恢复逻辑
                records = await repo.execute_query("SELECT * FROM recycle_bin WHERE id = %s", (record_id,))
                if not records:
                    errors.append({"id": record_id, "error": "记录不存在"})
                    continue

                record = records[0]
                data = record.get('data', {})
                if isinstance(data, str):
                    data = json.loads(data)

                original_table = record['original_table']
                if original_table == 'products':
                    await repo.execute_update(
                        """INSERT INTO products (sku, name, product_type, description, developer, image_url, local_path, thumb_path, create_time, update_time, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')""",
                        (data.get('sku'), data.get('name'), data.get('product_type'), data.get('description'),
                         data.get('developer'), data.get('image_url'), data.get('local_path'), data.get('thumb_path'),
                         data.get('create_time'), data.get('update_time'))
                    )
                elif original_table == 'selection_products':
                    await repo.execute_update(
                        """INSERT INTO selection_products (asin, product_title, price, image_url, local_path, thumb_path,
                        store_name, store_url, shop_id, main_category_name, main_category_rank, tags, notes, product_type,
                        product_link, sales_volume, listing_date, delivery_method, similar_products, source, country,
                        data_filter_mode, score, grade, week_tag, is_current, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                        (data.get('asin'), data.get('product_title'), data.get('price'), data.get('image_url'),
                         data.get('local_path'), data.get('thumb_path'), data.get('store_name'), data.get('store_url'),
                         data.get('shop_id'), data.get('main_category_name'), data.get('main_category_rank'),
                         data.get('tags'), data.get('notes'), data.get('product_type'), data.get('product_link'),
                         data.get('sales_volume'), data.get('listing_date'), data.get('delivery_method'),
                         data.get('similar_products'), data.get('source'), data.get('country'),
                         data.get('data_filter_mode'), data.get('score'), data.get('grade'), data.get('week_tag'),
                         data.get('is_current'), data.get('created_at'), data.get('updated_at'))
                    )
                else:
                    errors.append({"id": record_id, "error": f"不支持恢复的表类型: {original_table}"})
                    continue

                await repo.execute_update(
                    "UPDATE recycle_bin SET restored_by = %s, restored_at = NOW() WHERE id = %s",
                    (user_info.get('id', 0), record_id)
                )
                success_count += 1
            except Exception as e:
                errors.append({"id": record_id, "error": str(e)})

        return {"code": 200, "message": f"批量恢复完成：成功 {success_count} 条", "data": {"success": success_count, "errors": errors}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量恢复失败: {e}")
        raise HTTPException(status_code=500, detail="批量恢复失败")


@router.delete("/{record_id}", summary="永久删除")
async def delete_permanently(
    record_id: int,
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """永久删除回收站记录"""
    try:
        affected = await repo.execute_delete("DELETE FROM recycle_bin WHERE id = %s", (record_id,))
        if affected == 0:
            raise HTTPException(status_code=404, detail="记录不存在")
        return {"code": 200, "message": "删除成功", "data": None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"永久删除失败: {e}")
        raise HTTPException(status_code=500, detail="永久删除失败")


@router.delete("/batch", summary="批量永久删除")
async def batch_delete_permanently(
    record_ids: List[int] = Body(..., description="记录ID列表"),
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """批量永久删除回收站记录"""
    try:
        if not record_ids:
            raise HTTPException(status_code=400, detail="请选择要删除的记录")
        if len(record_ids) > 100:
            raise HTTPException(status_code=400, detail="批量删除最多支持100条")

        placeholders = ','.join(['%s'] * len(record_ids))
        deleted_count = await repo.execute_delete(
            f"DELETE FROM recycle_bin WHERE id IN ({placeholders})",
            tuple(record_ids)
        )
        return {"code": 200, "message": f"成功删除 {deleted_count} 条记录", "data": {"deleted_count": deleted_count}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量永久删除失败: {e}")
        raise HTTPException(status_code=500, detail="批量永久删除失败")


@router.delete("/expired", summary="清理过期记录")
async def clean_expired(
    user_info: dict = Depends(require_auth),
    repo: MySQLRepository = get_mysql_repo()
):
    """清理30天前的回收站记录"""
    try:
        deleted_count = await repo.execute_delete(
            "DELETE FROM recycle_bin WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )
        return {"code": 200, "message": f"清理了 {deleted_count} 条过期记录", "data": {"deleted_count": deleted_count}}
    except Exception as e:
        logger.error(f"清理过期记录失败: {e}")
        raise HTTPException(status_code=500, detail="清理过期记录失败")
