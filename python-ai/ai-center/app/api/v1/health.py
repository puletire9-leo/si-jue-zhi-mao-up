"""健康检查：liveness，仅判断进程存活，不触达上游、不计费。"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy"}
