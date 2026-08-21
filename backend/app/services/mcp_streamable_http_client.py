"""Minimal MCP Streamable HTTP client used for external MCP servers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import aiohttp


class McpClientError(RuntimeError):
    """Raised when the remote MCP server rejects or cannot process a call."""


@dataclass
class McpResponse:
    payload: dict[str, Any] | None
    session_id: str | None


class McpStreamableHttpClient:
    def __init__(
        self,
        url: str,
        api_key: str,
        *,
        timeout: int = 60,
        protocol_version: str = "2025-06-18",
    ) -> None:
        self.url = url
        self.api_key = api_key
        self.timeout = timeout
        self.protocol_version = protocol_version
        self._request_id = 0
        self._session_id: str | None = None
        self._http: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> "McpStreamableHttpClient":
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        self._http = aiohttp.ClientSession(timeout=timeout)
        await self._initialize()
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        if self._http is not None:
            await self._http.close()
            self._http = None

    async def list_tools(self) -> list[dict[str, Any]]:
        result = await self._rpc("tools/list", {})
        tools = result.get("tools", [])
        if not isinstance(tools, list):
            raise McpClientError("领星 MCP tools/list 返回格式不正确")
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return await self._rpc("tools/call", {"name": name, "arguments": arguments})

    async def _initialize(self) -> None:
        result = await self._rpc(
            "initialize",
            {
                "protocolVersion": self.protocol_version,
                "capabilities": {},
                "clientInfo": {"name": "sjzm-lingxing-client", "version": "1.0.0"},
            },
        )
        negotiated = result.get("protocolVersion")
        if isinstance(negotiated, str) and negotiated:
            self.protocol_version = negotiated
        await self._notification("notifications/initialized", {})

    async def _rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        self._request_id += 1
        response = await self._post(
            {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params,
            }
        )
        payload = response.payload or {}
        if "error" in payload:
            error = payload["error"]
            message = error.get("message", str(error)) if isinstance(error, dict) else str(error)
            raise McpClientError(f"领星 MCP 调用失败（{method}）：{message}")
        result = payload.get("result")
        if not isinstance(result, dict):
            raise McpClientError(f"领星 MCP 返回缺少 result（{method}）")
        return result

    async def _notification(self, method: str, params: dict[str, Any]) -> None:
        await self._post({"jsonrpc": "2.0", "method": method, "params": params})

    async def _post(self, body: dict[str, Any]) -> McpResponse:
        if self._http is None:
            raise McpClientError("MCP 客户端尚未启动")
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": self.protocol_version,
            "X-Mcp-Key": self.api_key,
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        try:
            async with self._http.post(self.url, json=body, headers=headers) as response:
                text = await response.text()
                if response.status >= 400:
                    raise McpClientError(
                        f"领星 MCP HTTP {response.status}: {text[:500]}"
                    )
                session_id = response.headers.get("Mcp-Session-Id") or self._session_id
                self._session_id = session_id
                if response.status == 202 or not text.strip():
                    return McpResponse(None, session_id)
                content_type = response.headers.get("Content-Type", "").lower()
                payload = self._parse_sse(text) if "text/event-stream" in content_type else json.loads(text)
                if not isinstance(payload, dict):
                    raise McpClientError("领星 MCP 返回的 JSON 不是对象")
                return McpResponse(payload, session_id)
        except (aiohttp.ClientError, TimeoutError, json.JSONDecodeError) as exc:
            raise McpClientError(f"无法连接领星 MCP：{exc}") from exc

    @staticmethod
    def _parse_sse(text: str) -> dict[str, Any]:
        for event in text.replace("\r\n", "\n").split("\n\n"):
            data_lines = [line[5:].lstrip() for line in event.splitlines() if line.startswith("data:")]
            if data_lines:
                payload = json.loads("\n".join(data_lines))
                if isinstance(payload, dict) and ("result" in payload or "error" in payload):
                    return payload
        raise McpClientError("领星 MCP SSE 响应中没有 JSON-RPC 结果")
