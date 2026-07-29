"""流式路径测试：SSE 帧、[DONE]、usage chunk、建流后错误帧。"""

from __future__ import annotations

import json

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


def _parse_sse(text: str) -> list[str]:
    return [line[len("data: "):] for line in text.splitlines() if line.startswith("data: ")]


async def test_stream_basic(client):
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}], "stream": True},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")

    frames = _parse_sse(resp.text)
    assert frames[-1] == "[DONE]"

    first = json.loads(frames[0])
    assert first["choices"][0]["delta"]["content"] == "hi"

    # 含 usage 的 chunk
    usage_frames = [json.loads(f) for f in frames if f != "[DONE]" and json.loads(f).get("usage")]
    assert usage_frames and usage_frames[0]["usage"]["total_tokens"] == 4


async def test_stream_sets_include_usage(client, behavior):
    await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}], "stream": True},
    )
    call = behavior["last_call"]
    assert call["stream"] is True
    assert call["stream_options"] == {"include_usage": True}


async def test_stream_model_not_allowed_pre_stream(client):
    # 建流前的校验错误应返回标准 HTTP 400，而不是 SSE
    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}], "stream": True},
    )
    assert resp.status_code == 400


async def test_stream_error_after_start_emits_error_frame(client, behavior):
    behavior["stream_chunks"] = [
        {"id": "c1", "object": "chat.completion.chunk", "choices": [{"index": 0, "delta": {"content": "par"}}]},
    ]
    behavior["stream_error"] = lambda: RuntimeError("mid-stream boom")

    resp = await client.post(
        "/v1/chat/completions",
        headers=auth_headers(),
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}], "stream": True},
    )
    assert resp.status_code == 200
    frames = _parse_sse(resp.text)
    assert frames[-1] == "[DONE]"
    # 倒数第二帧应为 error 帧
    err = json.loads(frames[-2])
    assert err["error"]["type"] == "upstream_error"
