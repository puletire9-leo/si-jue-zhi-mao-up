"""Chat 路由：OpenAI 兼容 /v1/chat/completions。

- 同时挂载 /v1/chat/completions 与 /api/v1/ai/chat/completions，
  前者兼容 openai SDK 默认 base_url 拼接，后者符合项目 /api/v1 约定。
- 鉴权由 require_internal_auth 依赖统一拦截。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.dependencies import require_internal_auth
from app.errors import InvalidRequestError
from app.services.chat import ChatService

router = APIRouter(dependencies=[Depends(require_internal_auth)])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _get_service(request: Request) -> ChatService:
    return request.app.state.chat_service


async def _parse_body(request: Request) -> dict:
    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise InvalidRequestError("Request body must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise InvalidRequestError("Request body must be a JSON object")
    return payload


async def _handle(request: Request) -> JSONResponse | StreamingResponse:
    payload = await _parse_body(request)
    service = _get_service(request)

    if payload.get("stream"):
        # 建流前的校验错误在 stream() 内以异常抛出，交给全局异常处理器转 HTTP。
        # 一旦进入生成器（已 yield），错误会以 SSE error 帧发出。
        stream_iter = service.stream(payload)
        # 预取首帧以便建流前错误仍能返回标准 HTTP 状态码
        try:
            first = await stream_iter.__anext__()
        except StopAsyncIteration:
            async def _empty():
                yield "data: [DONE]\n\n"

            return StreamingResponse(_empty(), media_type="text/event-stream", headers=_SSE_HEADERS)

        async def _body():
            yield first
            async for frame in stream_iter:
                yield frame

        return StreamingResponse(_body(), media_type="text/event-stream", headers=_SSE_HEADERS)

    result = await service.create(payload)
    return JSONResponse(result)


@router.post("/v1/chat/completions")
async def chat_completions(request: Request):
    return await _handle(request)


@router.post("/api/v1/ai/chat/completions")
async def chat_completions_api(request: Request):
    return await _handle(request)
