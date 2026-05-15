from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
import logging
from pydantic import BaseModel

from ...middleware.auth_middleware import auth_middleware

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcement", tags=["公告"])


def get_mysql_repo():
    from fastapi import Request

    def _get_repo(request: Request):
        return request.app.state.mysql

    return Depends(_get_repo)


class AnnouncementUpdate(BaseModel):
    content: str


@router.get("", summary="获取公告")
async def get_announcement(mysql_repo=get_mysql_repo()):
    """获取当前公告内容"""
    try:
        result = await mysql_repo.execute_query(
            "SELECT config_value, updated_by, updated_at FROM system_config WHERE config_key = 'dashboard_announcement'"
        )
        if result:
            return {
                "code": 200,
                "data": {
                    "content": result[0]["config_value"],
                    "updatedBy": result[0].get("updated_by", ""),
                    "updatedAt": result[0].get("updated_at", "")
                }
            }
        return {"code": 200, "data": {"content": "", "updatedBy": "", "updatedAt": ""}}
    except Exception as e:
        logger.error(f"获取公告失败: {e}")
        raise HTTPException(status_code=500, detail="获取公告失败")


@router.put("", summary="更新公告")
async def update_announcement(
    body: AnnouncementUpdate,
    user_info: dict = Depends(auth_middleware.require_admin()),
    mysql_repo=get_mysql_repo()
):
    """更新公告内容（仅管理员）"""
    try:
        await mysql_repo.execute_update("""
            INSERT INTO system_config (config_key, config_value, description, is_system, updated_by)
            VALUES ('dashboard_announcement', %s, '数据看板公告', FALSE, %s)
            ON DUPLICATE KEY UPDATE
                config_value = VALUES(config_value),
                updated_by = VALUES(updated_by)
        """, (body.content, user_info["username"]))

        return {"code": 200, "message": "公告已更新", "data": {"content": body.content}}
    except Exception as e:
        logger.error(f"更新公告失败: {e}")
        raise HTTPException(status_code=500, detail="更新公告失败")
