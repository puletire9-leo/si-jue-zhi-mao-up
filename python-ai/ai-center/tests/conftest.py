"""测试夹具：注入 fake provider，避免真实网络与密钥依赖。

fake client 复刻 openai AsyncOpenAI 的调用面：
    client.chat.completions.create(..., stream=bool) -> 对象 / 异步迭代器
每个返回对象都实现 model_dump()，与真实 SDK 一致。
"""

from __future__ import annotations

import os
from typing import Any, Callable

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

INTERNAL_KEY = "test-internal-key-abc123"


class _FakeObj:
    """最小化的 SDK 返回对象：支持 model_dump()。"""

    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    def model_dump(self) -> dict[str, Any]:
        return self._data


class _FakeCompletions:
    def __init__(self, behavior: dict[str, Any]) -> None:
        self._behavior = behavior

    async def create(self, **kwargs: Any):
        # 记录最后一次调用参数，供断言透传
        self._behavior["last_call"] = kwargs

        error: Callable[[], Exception] | None = self._behavior.get("error")
        if error is not None:
            raise error()

        if kwargs.get("stream"):
            chunks: list[dict[str, Any]] = self._behavior.get(
                "stream_chunks",
                [
                    {"id": "c1", "object": "chat.completion.chunk",
                     "choices": [{"index": 0, "delta": {"content": "hi"}}]},
                    {"id": "c1", "object": "chat.completion.chunk",
                     "choices": [], "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4}},
                ],
            )
            stream_error: Callable[[], Exception] | None = self._behavior.get("stream_error")

            async def _gen():
                for c in chunks:
                    yield _FakeObj(c)
                if stream_error is not None:
                    raise stream_error()

            return _gen()

        return _FakeObj(
            self._behavior.get(
                "response",
                {
                    "id": "chatcmpl-1",
                    "object": "chat.completion",
                    "model": kwargs.get("model"),
                    "choices": [
                        {"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}
                    ],
                    "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
                },
            )
        )


class _FakeChat:
    def __init__(self, behavior: dict[str, Any]) -> None:
        self.completions = _FakeCompletions(behavior)


class FakeClient:
    def __init__(self, behavior: dict[str, Any]) -> None:
        self.chat = _FakeChat(behavior)

    async def close(self) -> None:  # 匹配 provider.aclose()
        pass


class FakeProvider:
    name = "deepseek"

    def __init__(self, behavior: dict[str, Any]) -> None:
        self._client = FakeClient(behavior)

    @property
    def client(self) -> FakeClient:
        return self._client

    async def aclose(self) -> None:
        await self._client.close()


@pytest.fixture
def behavior() -> dict[str, Any]:
    """可变行为字典：测试通过修改它控制 fake 上游返回。"""
    return {}


@pytest_asyncio.fixture
async def client(behavior, monkeypatch):
    monkeypatch.setenv("AI_CENTER_INTERNAL_KEY", INTERNAL_KEY)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-fake")
    monkeypatch.setenv("AI_CENTER_ALLOWED_MODELS", "deepseek-v4-flash,deepseek-reasoner")

    # 延迟导入，确保环境变量先设置
    from app.config import get_settings
    from app.main import create_app
    from app.services.chat import ChatService

    app = create_app()

    # 用 fake provider 覆盖 lifespan 中的真实 provider
    fake_provider = FakeProvider(behavior)

    async with LifespanManager(app):
        app.state.provider = fake_provider
        app.state.chat_service = ChatService(fake_provider, get_settings())
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://ai-center") as ac:
            yield ac


def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {INTERNAL_KEY}"}
