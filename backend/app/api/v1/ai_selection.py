"""AI 选品 ASIN 查询与实时投递 API。"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ...middleware.auth_middleware import require_auth, require_write_role
from ...schemas.ai_selection import (
    AsinLookupRequest,
    AsinLookupResponse,
    AutoScreeningConfig,
    AutoScreeningResponse,
    PushRequest,
    PushResponse,
    SessionResponse,
)
from ...services.ai_selection_service import AiSelectionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-selection", tags=["AI 选品"])


def get_ai_selection_service():
    def _get(request: Request) -> AiSelectionService:
        mysql = getattr(request.app.state, "mysql", None)
        if mysql is None:
            raise HTTPException(status_code=503, detail="数据库连接不可用")
        redis = getattr(request.app.state, "redis", None)
        return AiSelectionService(mysql, redis)

    return Depends(_get)


@router.post(
    "/push",
    response_model=PushResponse,
    summary="AI Agent 投递 ASIN → 实时展示",
)
async def push_asins(
    req: PushRequest,
    user: dict = Depends(require_write_role),
    service: AiSelectionService = get_ai_selection_service(),
):
    """查询 ASIN 并追加到当前认证用户的投递会话。"""
    user_id = str(user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="用户身份无效")
    try:
        return await service.push(
            user_id=user_id,
            raw_asins=req.asins,
            marketplace=req.marketplace,
            message=req.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("AI 投递失败: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="投递失败：查询市场数据出错"
        ) from exc


@router.get(
    "/session",
    response_model=SessionResponse,
    summary="获取当前用户投递会话",
)
async def get_session(
    after_batch_id: str | None = Query(
        None,
        alias="afterBatchId",
        description="只返回该批次之后的新批次",
    ),
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(require_auth),
    service: AiSelectionService = get_ai_selection_service(),
):
    user_id = str(user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="用户身份无效")
    batches = await service.get_batches(user_id, after_batch_id, limit)
    return SessionResponse(batches=batches)


@router.delete("/session", summary="清空当前用户投递会话")
async def clear_session(
    user: dict = Depends(require_write_role),
    service: AiSelectionService = get_ai_selection_service(),
):
    user_id = str(user.get("id") or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="用户身份无效")
    await service.clear_batches(user_id)
    return {"message": "会话已清空"}


@router.post(
    "/lookup",
    response_model=AsinLookupResponse,
    summary="ASIN 查询（一次性，不入会话）",
)
async def lookup_asins(
    req: AsinLookupRequest,
    user: dict = Depends(require_auth),
    service: AiSelectionService = get_ai_selection_service(),
):
    try:
        return await service.lookup(req.asins, req.marketplace)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("ASIN 查询失败: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500, detail="查询市场数据出错"
        ) from exc


@router.post(
    "/auto-screen",
    response_model=AutoScreeningResponse,
    summary="【预留】自动筛选",
)
async def auto_screen(
    config: AutoScreeningConfig,
    user: dict = Depends(require_write_role),
):
    """预留：自动从两表读取数据并按方法卡筛选。"""
    return AutoScreeningResponse(
        message=(
            "自动筛选框架已预留。后续实现：\n"
            "1. 从 shop_products / competitor_products_clean 读取原始数据\n"
            "2. 按 M01/M03 等方法卡阈值过滤\n"
            "3. 输出候选 ASIN 列表"
        ),
    )
