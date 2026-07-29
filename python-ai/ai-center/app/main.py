"""FastAPI 入口：lifespan 管理 provider/service 单例，注册全局异常处理。"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import chat, health
from app.config import get_settings
from app.errors import AICenterError
from app.middleware import RequestContextMiddleware, current_request_id
from app.providers.deepseek import DeepSeekProvider
from app.services.chat import ChatService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ai_center")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if not settings.deepseek_api_key:
        logger.warning("DEEPSEEK_API_KEY 未配置，上游调用将失败（仅健康检查可用）")
    if not settings.internal_key:
        logger.warning("AI_CENTER_INTERNAL_KEY 未配置，所有业务请求将被拒绝")

    provider = DeepSeekProvider(settings)
    app.state.settings = settings
    app.state.provider = provider
    app.state.chat_service = ChatService(provider, settings)
    logger.info(
        "ai-center 启动 allowed_models=%s base_url=%s",
        sorted(settings.allowed_model_set()),
        settings.deepseek_base_url,
    )
    try:
        yield
    finally:
        await provider.aclose()
        logger.info("ai-center 关闭，上游客户端已释放")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="思觉智贸 - AI 请求中心",
        description="集中式 LLM 请求中心（OpenAI 兼容网关）",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(RequestContextMiddleware)

    origins = settings.allowed_origin_list()
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["POST", "GET"],
            allow_headers=["Authorization", "Content-Type", "X-Request-Id", "X-Service-Name"],
        )

    @app.exception_handler(AICenterError)
    async def _handle_center_error(request: Request, exc: AICenterError) -> JSONResponse:
        headers = dict(exc.headers)
        headers.setdefault("X-Request-Id", current_request_id())
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload(), headers=headers)

    app.include_router(health.router)
    app.include_router(chat.router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"service": "ai-center", "version": "0.1.0", "docs": "/docs"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8012)
