"""非流式路径测试：模型白名单、JSON mode、透传、错误映射。"""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_model_not_allowed(client):
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["type"] == "invalid_request_error"


async def test_missing_messages(client):
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash"},
    )
    assert resp.status_code == 400


async def test_non_stream_ok(client):
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["choices"][0]["message"]["content"] == "ok"
    assert body["usage"]["total_tokens"] == 7


async def test_json_mode_and_extra_body_passthrough(client, behavior):
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={
            "model": "deepseek-v4-flash",
            "messages": [{"role": "user", "content": "hi"}],
            "response_format": {"type": "json_object"},
            "reasoning_effort": "medium",
            "thinking": {"type": "enabled"},
            "user_id": "batch_42",
        },
    )
    assert resp.status_code == 200
    call = behavior["last_call"]
    # 标准字段走顶层
    assert call["response_format"] == {"type": "json_object"}
    assert call["reasoning_effort"] == "medium"
    # DeepSeek 特有/未知字段并入 extra_body 透传
    assert call["extra_body"]["thinking"] == {"type": "enabled"}
    assert call["extra_body"]["user_id"] == "batch_42"


async def test_api_v1_alias_path(client):
    resp = await client.post(
        "/api/v1/ai/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 200


async def test_upstream_rate_limit_maps_429(client, behavior):
    from openai import RateLimitError

    class _Resp:
        headers = {"retry-after": "12"}
        status_code = 429
        request = None

    def _raise():
        return RateLimitError("rate limited", response=_Resp(), body=None)

    behavior["error"] = _raise
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 429
    assert resp.headers.get("Retry-After") == "12"


async def test_upstream_error_maps_502(client, behavior):
    def _raise():
        return RuntimeError("boom")

    behavior["error"] = _raise
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["type"] == "upstream_error"
