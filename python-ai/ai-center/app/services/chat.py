"""Chat 服务：非流式 + SSE 流式两条路径。

对外契约 = 标准 OpenAI wire：
- 非流式：返回 ChatCompletion JSON（dict）
- 流式：逐帧 `data: {ChatCompletionChunk}\n\n`，以 `data: [DONE]\n\n` 结束

调用方保持使用 openai SDK（stream=True/False），无需感知中心的存在。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, AsyncIterator

from app.config import Settings
from app.errors import InvalidRequestError, ModelNotAllowedError, classify_upstream_exception
from app.middleware import current_request_id, current_service_name
from app.providers.deepseek import DeepSeekProvider

logger = logging.getLogger("ai_center.chat")

# openai SDK 客户端已知的顶层参数；其余未知键统一并入 extra_body 透传给上游。
_KNOWN_TOP_LEVEL = {
    "messages",
    "model",
    "frequency_penalty",
    "logit_bias",
    "logprobs",
    "top_logprobs",
    "max_tokens",
    "max_completion_tokens",
    "n",
    "presence_penalty",
    "response_format",
    "seed",
    "stop",
    "stream",
    "stream_options",
    "temperature",
    "tool_choice",
    "tools",
    "top_p",
    "parallel_tool_calls",
    "user",
    "reasoning_effort",
    "timeout",
}


class ChatService:
    def __init__(self, provider: DeepSeekProvider, settings: Settings) -> None:
        self._provider = provider
        self._settings = settings

    def _validate_and_split(self, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        """校验必填项与模型白名单，拆出顶层参数与 extra_body。"""
        if not isinstance(payload, dict):
            raise InvalidRequestError("Request body must be a JSON object")

        model = payload.get("model")
        if not model or not isinstance(model, str):
            raise InvalidRequestError("'model' is required")

        allowed = self._settings.allowed_model_set()
        if allowed and model not in allowed:
            raise ModelNotAllowedError(
                f"Model '{model}' is not allowed. Allowed: {sorted(allowed)}"
            )

        messages = payload.get("messages")
        if not isinstance(messages, list) or not messages:
            raise InvalidRequestError("'messages' must be a non-empty array")

        top_level: dict[str, Any] = {}
        extra_body: dict[str, Any] = {}
        for key, value in payload.items():
            if key in _KNOWN_TOP_LEVEL:
                top_level[key] = value
            else:
                # thinking / user_id 等 DeepSeek 特有字段原样透传
                extra_body[key] = value

        # 调用方可能把私有字段放进 extra_body（openai SDK 会展开成顶层键，
        # 未知键已在上面归入 extra_body），这里合并调用方显式传的 extra_body。
        caller_extra = payload.get("extra_body")
        if isinstance(caller_extra, dict):
            extra_body.pop("extra_body", None)
            extra_body.update(caller_extra)

        return top_level, extra_body

    async def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        """非流式：返回标准 ChatCompletion dict。"""
        top_level, extra_body = self._validate_and_split(payload)
        top_level["stream"] = False
        started = time.monotonic()
        try:
            completion = await self._provider.client.chat.completions.create(
                **top_level,
                **({"extra_body": extra_body} if extra_body else {}),
            )
        except Exception as exc:  # noqa: BLE001 - 统一归类后重新抛出
            self._log(top_level.get("model"), "error", started, note=type(exc).__name__)
            raise classify_upstream_exception(exc) from exc

        result = completion.model_dump()
        usage = result.get("usage") or {}
        self._log(
            top_level.get("model"),
            "ok",
            started,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )
        return result

    async def stream(self, payload: dict[str, Any]) -> AsyncIterator[str]:
        """流式：产出 SSE 帧字符串（含结尾 [DONE]）。

        建流前的错误按普通 HTTP 抛出；建流后（已开始 yield）的错误只能作为
        SSE error 帧发出，因为响应头已经发送。
        """
        top_level, extra_body = self._validate_and_split(payload)
        top_level["stream"] = True
        # 默认带上 usage 统计（若调用方未显式指定）
        top_level.setdefault("stream_options", {"include_usage": True})
        started = time.monotonic()
        model = top_level.get("model")

        try:
            upstream = await self._provider.client.chat.completions.create(
                **top_level,
                **({"extra_body": extra_body} if extra_body else {}),
            )
        except Exception as exc:  # noqa: BLE001
            self._log(model, "error", started, note=type(exc).__name__)
            # 建流前失败：抛出让路由层转成标准 HTTP 错误
            raise classify_upstream_exception(exc) from exc

        last_usage: dict[str, Any] | None = None
        try:
            async for chunk in upstream:
                data = chunk.model_dump()
                if data.get("usage"):
                    last_usage = data["usage"]
                yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:  # noqa: BLE001
            # 建流后失败：只能发 error 帧
            self._log(model, "stream_error", started, note=type(exc).__name__)
            err = classify_upstream_exception(exc)
            payload_err = json.dumps(err.to_payload(), ensure_ascii=False)
            yield f"data: {payload_err}\n\n"
            yield "data: [DONE]\n\n"
            return

        usage = last_usage or {}
        self._log(
            model,
            "ok",
            started,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            note="stream",
        )

    def _log(
        self,
        model: Any,
        status: str,
        started: float,
        *,
        input_tokens: Any = None,
        output_tokens: Any = None,
        note: str = "",
    ) -> None:
        """结构化日志：不记录 prompt 内容、不记录任何密钥。"""
        logger.info(
            "chat request_id=%s service=%s model=%s status=%s latency_ms=%d "
            "input_tokens=%s output_tokens=%s %s",
            current_request_id(),
            current_service_name(),
            model,
            status,
            int((time.monotonic() - started) * 1000),
            input_tokens if input_tokens is not None else "-",
            output_tokens if output_tokens is not None else "-",
            note,
        )
