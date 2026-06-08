"""
思觉智贸 — 选品分析 Agent
独立服务，由 Vue 前端通过 SSE 直接触发。
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title="思觉智贸 — 选品分析 Agent",
        description="LangGraph 9节点选品分析，多小类循环 + SSE实时进度推送",
        version="0.1.0",
    )

    cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "selection-agent"}

    # 注册选品分析路由
    from routers.selection import router as selection_router
    app.include_router(selection_router)

    logger.info("Selection Agent 启动完成")
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )
