"""鉴权测试：无 key / 错误 key → 401；健康检查免鉴权。"""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_missing_key_rejected(client):
    resp = await client.post(
        "/v1/chat/completions",
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["type"] == "authentication_error"


async def test_wrong_key_rejected(client):
    resp = await client.post(
        "/v1/chat/completions",
        headers={"Authorization": "Bearer wrong-key"},
        json={"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 401


async def test_health_no_auth(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


async def test_request_id_echoed(client):
    resp = await client.get("/health", headers={"X-Request-Id": "req-xyz"})
    assert resp.headers.get("X-Request-Id") == "req-xyz"
