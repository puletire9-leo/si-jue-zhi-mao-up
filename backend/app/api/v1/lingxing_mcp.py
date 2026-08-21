"""领星官方 MCP 即时查询 API。"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from ...config import settings
from ...middleware.auth_middleware import require_auth
from ...schemas.lingxing_mcp import (
    LingxingMcpStatus,
    LingxingMcpToolCallRequest,
    LingxingProductDetailRequest,
)
from ...services.lingxing_mcp_service import (
    LingxingMcpArgumentsError,
    LingxingMcpConfigurationError,
    LingxingMcpService,
)
from ...services.mcp_streamable_http_client import McpClientError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lingxing-mcp", tags=["领星 MCP"])


def get_lingxing_mcp_service() -> LingxingMcpService:
    return LingxingMcpService(settings)


@router.get("/status", response_model=LingxingMcpStatus, summary="领星 MCP 配置状态")
async def get_status(
    _user: dict = Depends(require_auth),
    service: LingxingMcpService = Depends(get_lingxing_mcp_service),
):
    return LingxingMcpStatus(
        configured=service.configured,
        protocol_version=settings.LINGXING_MCP_PROTOCOL_VERSION,
    )


@router.get("/tools", summary="查询领星 MCP 可用工具及参数 schema")
async def list_tools(
    _user: dict = Depends(require_auth),
    service: LingxingMcpService = Depends(get_lingxing_mcp_service),
):
    return await _run(service.list_tools())


@router.post("/tools/{tool_name}/call", summary="调用指定领星 MCP 工具")
async def call_tool(
    tool_name: str,
    request: LingxingMcpToolCallRequest,
    _user: dict = Depends(require_auth),
    service: LingxingMcpService = Depends(get_lingxing_mcp_service),
):
    return await _run(service.call_tool(tool_name, request.arguments))


@router.post("/products/detail", summary="通过领星 MCP 即时查询产品详情")
async def get_product_detail(
    request: LingxingProductDetailRequest,
    _user: dict = Depends(require_auth),
    service: LingxingMcpService = Depends(get_lingxing_mcp_service),
):
    try:
        return await service.get_product_detail(
            asin=request.asin,
            sku=request.sku,
            sid=request.sid,
            marketplace=request.marketplace,
            arguments=request.arguments,
        )
    except LingxingMcpArgumentsError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": str(exc), "inputSchema": exc.schema},
        ) from exc
    except (LingxingMcpConfigurationError, McpClientError) as exc:
        status = 503 if isinstance(exc, LingxingMcpConfigurationError) else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("领星 MCP 产品详情查询失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="领星 MCP 产品详情查询失败") from exc


async def _run(awaitable):
    try:
        return await awaitable
    except LingxingMcpConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except McpClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("领星 MCP 调用失败: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="领星 MCP 调用失败") from exc
