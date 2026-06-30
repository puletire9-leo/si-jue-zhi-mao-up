"""
轻量级人员名单端点（无 RBAC 拦截）

供前端 ConfigPanel / ReportViewer 等按角色拉取人员名单，
避免调 Java /api/v1/users（要求 user:manage 管理员权限）导致非 admin 被 403。

数据源：users 表 role 字段（支持逗号分隔多角色）
"""

from fastapi import APIRouter, Depends, Request
import logging

from ...middleware.auth_middleware import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(tags=["人员名单"])


@router.get("/auth/members", summary="获取按角色分组的人员名单")
async def get_members(
    request: Request,
    user_info: dict = Depends(require_auth),
):
    """
    返回按角色分组的最小人员名单，供前端下拉 / 默认值使用。

    响应格式：
    {
        "developers": ["张子轩","周沁仪",...],
        "operators":  ["唐若","张亚芳",...],
        "warehouse":  ["王亚成"]
    }

    查询方式：role LIKE '%开发%' 等，兼容一人多角色（逗号分隔）。
    """
    try:
        mysql_repo = request.app.state.mysql

        developers = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE role LIKE '%开发%' ORDER BY id ASC"
        )
        operators = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE role LIKE '%运营%' ORDER BY id ASC"
        )
        purchasers = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE role LIKE '%采购员%' ORDER BY id ASC"
        )

        return {
            "code": 200,
            "message": "获取成功",
            "data": {
                "developers": [r["username"] for r in developers],
                "operators": [r["username"] for r in operators],
                "purchasers": [r["username"] for r in purchasers],
            },
        }

    except Exception as e:
        logger.error(f"获取人员名单失败: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"获取人员名单失败: {str(e)}")
