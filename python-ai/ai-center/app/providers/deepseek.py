"""DeepSeek Provider：持有 AsyncOpenAI 单例，指向 DeepSeek 上游。

设计要点：
- max_retries=0：中心不做重试，重试策略由调用方（Agent）掌控，避免请求放大
- 标准 OpenAI 字段与 extra_body（thinking/reasoning_effort 等）原样透传
- 生命周期由 FastAPI lifespan 管理，退出时 aclose()
"""

from __future__ import annotations

import httpx
from openai import AsyncOpenAI

from app.config import Settings


class DeepSeekProvider:
    name = "deepseek"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        timeout = httpx.Timeout(
            connect=settings.upstream_connect_timeout,
            read=settings.upstream_read_timeout,
            write=settings.upstream_read_timeout,
            pool=settings.upstream_connect_timeout,
        )
        self._client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            max_retries=0,
            http_client=httpx.AsyncClient(
                timeout=timeout,
                limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            ),
        )

    @property
    def client(self) -> AsyncOpenAI:
        return self._client

    async def aclose(self) -> None:
        await self._client.close()
