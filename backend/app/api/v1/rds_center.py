"""RDS / 业务库连接实况（不含密码），供 RDS 管理中心合并展示。"""

from fastapi import APIRouter, Depends, Request
from typing import Any, Dict, Optional
import time

from ...middleware.auth_middleware import require_auth
from ...config import settings
from ...repositories import MySQLRepository

router = APIRouter(prefix="/rds-center", tags=["RDS 管理中心"])


def _looks_remote(host: str) -> bool:
    normalized = (host or "").lower()
    if "rds.aliyuncs.com" in normalized:
        return True
    return normalized not in {"mysql", "localhost", "127.0.0.1", "::1", ""}


async def _ping(repo: Optional[MySQLRepository]) -> Dict[str, Any]:
    if repo is None:
        return {"ok": False, "message": "连接池未初始化", "elapsedMs": 0}
    started = time.perf_counter()
    try:
        await repo.execute_query("SELECT 1", fetch_one=True)
        return {"ok": True, "message": "SELECT 1 成功",
                "elapsedMs": int((time.perf_counter() - started) * 1000)}
    except Exception as exc:
        return {"ok": False, "message": str(exc),
                "elapsedMs": int((time.perf_counter() - started) * 1000)}


def _pool(pool_id: str, host: str, port: int, database: str, username: str,
          ping: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": pool_id,
        "host": host,
        "port": port,
        "database": database,
        "username": username,
        "remote": _looks_remote(host),
        "ping": ping,
    }


@router.get("/status")
async def rds_status(request: Request, _user: Dict[str, Any] = Depends(require_auth)):
    business = getattr(request.app.state, "mysql", None)
    user_center = getattr(request.app.state, "user_mysql", None)
    data = {
        "livePools": [
            _pool("python-business", settings.MYSQL_HOST, settings.MYSQL_PORT,
                  settings.MYSQL_DATABASE, settings.MYSQL_USER, await _ping(business)),
            _pool("python-user-center", settings.USER_MYSQL_HOST, settings.USER_MYSQL_PORT,
                  settings.USER_MYSQL_DATABASE, settings.USER_MYSQL_USERNAME,
                  await _ping(user_center)),
        ],
        "rdsOverrideActive": bool((settings.MYSQL_HOST or "") and _looks_remote(settings.MYSQL_HOST)),
        "routes": [
            "/api/v1/products/**",
            "/api/v1/selection/**",
            "/api/v1/final-drafts/**",
            "/api/v1/images/**",
            "/api/v1/import/**",
            "/api/v1/lingxing/**",
            "Celery 任务与 FastAPI 共用 MYSQL 池",
        ],
    }
    return {"code": 200, "message": "success", "data": data}
