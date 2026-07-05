"""
[实际] 系统配置API - 仍在 Python 运行（唯一实现）
=========================

[注意] Java 后端并无 SystemConfigController，此前"已迁移"标注为误标（2026-07-03 核实）。
       系统配置目前只有本 Python 实现，前端直接依赖，删除前必须先真正迁移。
"""

import os
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from pydantic import BaseModel

from ...config import settings
from ...middleware.auth_middleware import require_auth


class ImageSettingsUpdate(BaseModel):
    """图片设置更新模型"""
    maxImageSize: int
    productCardWidth: int
    productCardHeight: int


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system-config", tags=["系统配置"])


def get_mysql_repo():
    """
    依赖注入：获取MySQLRepository实例
    
    Returns:
        MySQLRepository实例
    """
    from fastapi import Request
    
    def _get_repo(request: Request):
        return request.app.state.mysql
    
    return Depends(_get_repo)


# 注：开发人列表已废弃，统一改用 /api/v1/auth/members （members.py）
# 该端点从 users 表 role 字段派生，是人员名单唯一真相源


@router.get("/carrier-list", summary="获取载体列表")
async def get_carrier_list(
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    获取载体列表配置
    
    返回载体列表
    
    权限要求: 无需权限
    """
    try:
        # 从数据库获取配置
        query = """
        SELECT config_value
        FROM system_config
        WHERE config_key = 'carrier_list'
        """
        
        result = await mysql_repo.execute_query(query, fetch_one=True)
        
        if not result:
            # 如果没有配置，返回空列表
            return {
                "code": 200,
                "message": "获取成功",
                "data": {
                    "carrierList": []
                }
            }
        
        # 解析配置值
        carrier_str = result["config_value"]
        carrier_list = [carrier.strip() for carrier in carrier_str.split(",") if carrier.strip()]
        
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "carrierList": carrier_list
            }
        }
    
    except Exception as e:
        logger.error(f"获取载体列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取载体列表失败")


@router.put("/carrier-list", summary="更新载体列表")
async def update_carrier_list(
    carrier_list: List[str] = Body(..., description="载体列表"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    更新载体列表配置
    
    - **carrier_list**: 载体列表（必需）
    
    返回更新结果
    
    权限要求: config:write
    """
    try:
        # 过滤空字符串
        filtered_list = [carrier.strip() for carrier in carrier_list if carrier.strip()]
        
        # 转换为逗号分隔的字符串
        config_value = ",".join(filtered_list)
        
        # 更新或插入配置
        query = """
        INSERT INTO system_config (config_key, config_value, description, is_system, updated_by)
        VALUES ('carrier_list', %s, '载体列表，用于系统配置', FALSE, %s)
        ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_by = VALUES(updated_by)
        """
        
        await mysql_repo.execute_update(query, (config_value, user_info["username"]))
        
        return {
            "code": 200,
            "message": "更新成功",
            "data": {
                "carrierList": filtered_list
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新载体列表失败: {e}")
        raise HTTPException(status_code=500, detail="更新载体列表失败")


@router.get("/image-settings", summary="获取图片设置")
async def get_image_settings(
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    获取图片设置配置
    
    返回图片设置，包括最大图片大小等
    
    权限要求: 无需权限
    """
    try:
        # 从数据库获取配置
        query = """
        SELECT config_key, config_value
        FROM system_config
        WHERE config_key IN ('max_image_size', 'product_card_width', 'product_card_height')
        """
        
        results = await mysql_repo.execute_query(query, fetch_all=True)
        
        # 转换为字典
        config_dict = {}
        for row in results:
            config_dict[row["config_key"]] = row["config_value"]
        
        # 构建返回数据
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "maxImageSize": int(config_dict.get("max_image_size", settings.MAX_UPLOAD_SIZE / 1024 / 1024)),
                "productCardWidth": int(config_dict.get("product_card_width", 200)),
                "productCardHeight": int(config_dict.get("product_card_height", 200))
            }
        }
    
    except Exception as e:
        logger.error(f"获取图片设置失败: {e}")
        raise HTTPException(status_code=500, detail="获取图片设置失败")


@router.put("/image-settings", summary="更新图片设置")
async def update_image_settings(
    settings: ImageSettingsUpdate = Body(..., description="图片设置"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    更新图片设置配置
    
    - **maxImageSize**: 最大图片大小（MB，必需）
    - **productCardWidth**: 产品卡片宽度（px，必需）
    - **productCardHeight**: 产品卡片高度（px，必需）
    
    返回更新结果
    
    权限要求: config:write
    """
    try:
        maxImageSize = settings.maxImageSize
        productCardWidth = settings.productCardWidth
        productCardHeight = settings.productCardHeight
        
        # 验证参数
        if maxImageSize < 1 or maxImageSize > 200:
            raise HTTPException(status_code=400, detail="最大图片大小必须在1-200MB之间")
        
        if productCardWidth < 100 or productCardWidth > 500:
            raise HTTPException(status_code=400, detail="产品卡片宽度必须在100-500px之间")
        
        if productCardHeight < 100 or productCardHeight > 500:
            raise HTTPException(status_code=400, detail="产品卡片高度必须在100-500px之间")
        
        # 批量更新配置
        config_items = [
            ("max_image_size", str(maxImageSize), "最大图片大小（MB）", user_info["username"]),
            ("product_card_width", str(productCardWidth), "产品卡片宽度（px）", user_info["username"]),
            ("product_card_height", str(productCardHeight), "产品卡片高度（px）", user_info["username"])
        ]
            
        query = """
        INSERT INTO system_config (config_key, config_value, description, is_system, updated_by)
        VALUES (%s, %s, %s, FALSE, %s)
        ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_by = VALUES(updated_by)
        """
            
        for item in config_items:
            await mysql_repo.execute_update(query, item)
            
        return {
            "code": 200,
            "message": "更新成功",
            "data": {
                "maxImageSize": maxImageSize,
                "productCardWidth": productCardWidth,
                "productCardHeight": productCardHeight
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新图片设置失败: {e}")
        raise HTTPException(status_code=500, detail="更新图片设置失败")


# ============================================================
# 领星导入默认人选配置
# ============================================================
# 存储在 system_config 表,3 个 key:
#   lingxing_default_developer      单个 username
#   lingxing_default_operators      逗号分隔的 username 列表
#   lingxing_default_purchaser      单个 username
# 无配置时前端/lingxing.py 回退到 users 表 role LIKE 查询兜底逻辑
# ============================================================

LINGXING_KEYS = ("lingxing_default_developer", "lingxing_default_operators", "lingxing_default_purchaser")


class LingxingDefaultsUpdate(BaseModel):
    """领星导入默认人选更新模型"""
    developer: str = ""
    operators: List[str] = []
    purchaser: str = ""


@router.get("/lingxing-defaults", summary="获取领星导入默认人选")
async def get_lingxing_defaults(
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    获取领星导入的默认人选配置。

    返回结构:
    {
        "developer":  "张子轩",         # 开发人 单个 username, 未配置时 ""
        "operators":  ["唐若","张亚芳"], # 产品负责人 多人 username, 未配置时 []
        "purchaser":  "王亚成"          # 采购员 单个 username, 未配置时 ""
    }
    """
    try:
        query = "SELECT config_key, config_value FROM system_config WHERE config_key IN (%s, %s, %s)"
        rows = await mysql_repo.execute_query(query, LINGXING_KEYS, fetch_all=True)
        cfg = {row["config_key"]: row["config_value"] or "" for row in (rows or [])}
        operators_raw = cfg.get("lingxing_default_operators", "")
        operators = [name.strip() for name in operators_raw.split(",") if name.strip()]
        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "developer": cfg.get("lingxing_default_developer", ""),
                "operators": operators,
                "purchaser": cfg.get("lingxing_default_purchaser", "")
            }
        }
    except Exception as e:
        logger.error(f"获取领星导入默认人选失败: {e}")
        raise HTTPException(status_code=500, detail="获取领星导入默认人选失败")


@router.put("/lingxing-defaults", summary="更新领星导入默认人选")
async def update_lingxing_defaults(
    payload: LingxingDefaultsUpdate = Body(..., description="领星导入默认人选"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    更新领星导入默认人选配置。空字符串/空数组表示清空该项(导入时回退兜底)。
    """
    try:
        operators_str = ",".join(name.strip() for name in payload.operators if name.strip())
        items = [
            ("lingxing_default_developer", payload.developer.strip(), "领星导入 开发人默认", user_info["username"]),
            ("lingxing_default_operators", operators_str, "领星导入 产品负责人默认(逗号分隔)", user_info["username"]),
            ("lingxing_default_purchaser", payload.purchaser.strip(), "领星导入 采购员默认", user_info["username"]),
        ]
        query = """
        INSERT INTO system_config (config_key, config_value, description, is_system, updated_by)
        VALUES (%s, %s, %s, FALSE, %s)
        ON DUPLICATE KEY UPDATE
            config_value = VALUES(config_value),
            updated_by   = VALUES(updated_by)
        """
        for item in items:
            await mysql_repo.execute_update(query, item)
        return {
            "code": 200,
            "message": "更新成功",
            "data": {
                "developer": payload.developer.strip(),
                "operators": [name.strip() for name in payload.operators if name.strip()],
                "purchaser": payload.purchaser.strip()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新领星导入默认人选失败: {e}")
        raise HTTPException(status_code=500, detail="更新领星导入默认人选失败")


@router.post("/backup/start", summary="开始备份")
async def start_backup(
    backup_type: str = Body(default="local", description="备份类型: local(本地备份) 或 cos(腾讯云备份)", embed=True),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    开始数据库备份
    
    - **backup_type**: 备份类型: local(本地备份) 或 cos(腾讯云备份)
    
    权限要求: config:write
    """
    from ...services.backup_service import backup_service
    
    try:
        result = await backup_service.create_backup(backup_type, mysql_repo)
        
        if result["success"]:
            return {
                "code": 200,
                "message": result["message"],
                "data": result.get("data", {})
            }
        else:
            return {
                "code": 400,
                "message": result["message"]
            }
            
    except Exception as e:
        logger.error(f"开始备份失败: {e}")
        raise HTTPException(status_code=500, detail="开始备份失败")


@router.get("/backup/records", summary="获取备份记录")
async def get_backup_records(
    page: int = Query(default=1, ge=1, description="页码"),
    limit: int = Query(default=10, ge=1, le=100, description="每页数量"),
    storage_location: Optional[str] = Query(default=None, description="存储位置过滤"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    获取备份记录列表
    
    - **page**: 页码
    - **limit**: 每页数量
    - **storage_location**: 存储位置过滤: local(本地备份) 或 cos(腾讯云备份)
    
    权限要求: config:read
    """
    from ...services.backup_service import backup_service
    
    try:
        result = await backup_service.get_backup_records(
            mysql_repo,
            page=page,
            limit=limit,
            storage_location=storage_location
        )
        
        if result["success"]:
            return {
                "code": 200,
                "message": "获取备份记录成功",
                "data": result["data"]
            }
        else:
            return {
                "code": 400,
                "message": result["message"]
            }
            
    except Exception as e:
        logger.error(f"获取备份记录失败: {e}")
        raise HTTPException(status_code=500, detail="获取备份记录失败")


@router.get("/backup/download/{backup_id}", summary="下载备份")
async def download_backup(
    backup_id: int = Path(description="备份记录ID"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    下载备份文件
    
    - **backup_id**: 备份记录ID
    
    权限要求: config:read
    """
    from ...services.backup_service import backup_service
    
    try:
        result = await backup_service.get_backup_url(backup_id, mysql_repo)
        
        if result["success"]:
            return {
                "code": 200,
                "message": "获取备份URL成功",
                "data": result["data"]
            }
        else:
            return {
                "code": 400,
                "message": result["message"]
            }
            
    except Exception as e:
        logger.error(f"获取备份URL失败: {e}")
        raise HTTPException(status_code=500, detail="获取备份URL失败")


@router.get("/backup/download-file/{backup_id}", summary="下载本地备份文件")
async def download_local_backup_file(
    backup_id: int = Path(description="备份记录ID"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    直接下载本地备份文件

    权限要求: config:read
    """
    from starlette.responses import FileResponse
    from ...services.backup_service import backup_service

    try:
        # 获取备份记录
        query = "SELECT name, storage_location FROM backup_records WHERE id = %s"
        result = await mysql_repo.execute_query(query, (backup_id,))
        if not result:
            raise HTTPException(status_code=404, detail="备份记录不存在")

        record = result[0]
        if record["storage_location"] != "local":
            raise HTTPException(status_code=400, detail="非本地备份，请使用下载URL")

        filepath = os.path.join(backup_service.backup_dir, record["name"])
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="备份文件不存在")

        return FileResponse(
            path=filepath,
            filename=record["name"],
            media_type="application/gzip"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载本地备份文件失败: {e}")
        raise HTTPException(status_code=500, detail="下载备份文件失败")


@router.delete("/backup/{backup_id}", summary="删除备份")
async def delete_backup(
    backup_id: int = Path(description="备份记录ID"),
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    删除备份记录和文件
    
    - **backup_id**: 备份记录ID
    
    权限要求: config:write
    """
    from ...services.backup_service import backup_service
    
    try:
        result = await backup_service.delete_backup(backup_id, mysql_repo)
        
        if result["success"]:
            return {
                "code": 200,
                "message": result["message"]
            }
        else:
            return {
                "code": 400,
                "message": result["message"]
            }
            
    except Exception as e:
        logger.error(f"删除备份失败: {e}")
        raise HTTPException(status_code=500, detail="删除备份失败")


@router.get("/backup/expired", summary="获取过期备份记录")
async def get_expired_backups(
    user_info: dict = Depends(require_auth),
    mysql_repo=get_mysql_repo()
):
    """
    获取过期备份记录
    
    返回超过3天的备份记录，可用于手动删除过期备份
    
    权限要求: config:read
    """
    from ...services.backup_service import backup_service
    
    try:
        result = await backup_service.get_expired_backups(mysql_repo)
        
        if result["success"]:
            return {
                "code": 200,
                "message": "获取过期备份记录成功",
                "data": result["data"]
            }
        else:
            return {
                "code": 400,
                "message": result["message"]
            }
            
    except Exception as e:
        logger.error(f"获取过期备份记录失败: {e}")
        raise HTTPException(status_code=500, detail="获取过期备份记录失败")



