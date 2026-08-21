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
        "purchasers": ["王亚成"]
    }

    查询方式：兼容中文角色（role LIKE '%运营%'）和英文枚举（role='OPERATOR'）。

    数据源：优先使用RDS用户中心（ai_platform库），回退到本地MySQL。
    """
    try:
        # 优先使用RDS用户中心，回退到本地MySQL
        user_mysql = getattr(request.app.state, 'user_mysql', None)
        mysql_repo = user_mysql if user_mysql else request.app.state.mysql

        if mysql_repo is None:
            logger.error("无可用的MySQL连接")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail="数据库连接不可用")

        # 记录使用的数据源
        data_source = "RDS用户中心" if user_mysql else "本地MySQL"
        logger.info(f"[Members] 使用数据源: {data_source}")

        # 兼容中文角色（本地MySQL）和英文枚举（RDS）
        developers = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE (role LIKE '%开发%' OR role = 'DEVELOPER') AND status=1 ORDER BY id ASC"
        )
        operators = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE (role LIKE '%运营%' OR role = 'OPERATOR') AND status=1 ORDER BY id ASC"
        )
        purchasers = await mysql_repo.execute_query(
            "SELECT username FROM users WHERE (role LIKE '%采购员%' OR role = 'PURCHASER') AND status=1 ORDER BY id ASC"
        )

        logger.info(f"[Members] 查询结果 - 开发: {len(developers)}, 运营: {len(operators)}, 采购: {len(purchasers)}")

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
        logger.error(f"获取人员名单失败: {e}", exc_info=True)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"获取人员名单失败: {str(e)}")
