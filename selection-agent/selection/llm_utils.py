"""LLM 调用工具 — 各节点共用的 LLM 交互函数。

参考 SuperMew RAG 的 agent_factory.py 中 init_chat_model 模式。
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional, Tuple, Type

logger = logging.getLogger(__name__)

# LLM 配置（从环境变量读取）
_LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
_LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
_LLM_API_KEY = os.getenv("LLM_API_KEY", "")
_LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))  # 默认120秒超时

# 全局 LLM 实例（懒加载）
_llm = None


def get_llm():
    """获取全局 LLM 实例（懒加载单例）。"""
    global _llm
    if _llm is None:
        from langchain_openai import ChatOpenAI
        _llm = ChatOpenAI(
            model=_LLM_MODEL,
            api_key=_LLM_API_KEY,
            base_url=_LLM_BASE_URL,
            temperature=0.3,
        )
    return _llm


def _extract_token_usage(response: Any) -> Dict[str, int]:
    """从 LLM response 中提取 Token 消耗。"""
    usage = {}
    try:
        # langchain response_metadata 格式
        meta = getattr(response, "response_metadata", {}) or {}
        token_usage = meta.get("token_usage", {})
        if token_usage:
            usage = {
                "prompt_tokens": token_usage.get("prompt_tokens", 0),
                "completion_tokens": token_usage.get("completion_tokens", 0),
                "total_tokens": token_usage.get("total_tokens", 0),
            }
        else:
            # OpenAI 原生格式
            usage = {
                "prompt_tokens": meta.get("prompt_tokens", 0),
                "completion_tokens": meta.get("completion_tokens", 0),
                "total_tokens": meta.get("total_tokens", 0),
            }
    except Exception:
        pass
    return usage


async def call_llm_json(
    prompt_template: str,
    input_data: Dict[str, Any],
    node_name: str = "unknown",
) -> Optional[Dict[str, Any]]:
    """调用 LLM 并解析 JSON 输出。

    特性：
    - 超时控制（LLM_TIMEOUT 环境变量，默认 120s）
    - Token 消耗记录（附加在返回结果的 _tokenUsage 字段）

    Args:
        prompt_template: 含 {input_data} 占位符的提示词模板
        input_data: 要填入模板的数据字典
        node_name: 节点名称（用于日志）

    Returns:
        LLM 返回的 JSON 字典（含 _tokenUsage），失败时返回 None
    """
    try:
        # 填充模板
        prompt = prompt_template.replace(
            "{input_data}", json.dumps(input_data, ensure_ascii=False, indent=2)
        )

        # 调用 LLM（带超时控制）
        llm = get_llm()
        try:
            response = await asyncio.wait_for(
                llm.ainvoke(prompt),
                timeout=_LLM_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.error(f"[{node_name}] LLM 调用超时 ({_LLM_TIMEOUT}s)")
            return None

        # 提取 Token 消耗
        token_usage = _extract_token_usage(response)
        if token_usage:
            logger.info(
                f"[{node_name}] Token: prompt={token_usage.get('prompt_tokens', 0)}, "
                f"completion={token_usage.get('completion_tokens', 0)}, "
                f"total={token_usage.get('total_tokens', 0)}"
            )

        # 解析 JSON
        content = response.content
        # 处理 markdown code block 包裹的 JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())

        # 附加 Token 消耗到结果（以_开头表示元数据，不影响业务逻辑）
        if isinstance(result, dict):
            result["_tokenUsage"] = token_usage

        logger.info(f"[{node_name}] LLM 调用成功")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"[{node_name}] LLM 返回非JSON格式: {e}")
        return None
    except Exception as e:
        logger.error(f"[{node_name}] LLM 调用失败: {e}")
        return None


async def call_llm_structured(
    prompt_template: str,
    input_data: Dict[str, Any],
    output_model: Type,
    node_name: str = "unknown",
) -> Optional[Any]:
    """调用 LLM 并使用结构化输出（Pydantic model）。

    特性：
    - 使用 `llm.with_structured_output()` 强制 LLM 输出符合 Pydantic schema
    - 超时控制（LLM_TIMEOUT 环境变量，默认 120s）
    - Token 消耗记录
    - 失败时自动降级到 call_llm_json

    Args:
        prompt_template: 含 {input_data} 占位符的提示词模板
        input_data: 要填入模板的数据字典
        output_model: Pydantic BaseModel 子类
        node_name: 节点名称（用于日志）

    Returns:
        Pydantic model 实例，失败时返回 None
    """
    try:
        prompt = prompt_template.replace(
            "{input_data}", json.dumps(input_data, ensure_ascii=False, indent=2)
        )

        llm = get_llm()
        structured_llm = llm.with_structured_output(output_model)

        try:
            response = await asyncio.wait_for(
                structured_llm.ainvoke(prompt),
                timeout=_LLM_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.error(f"[{node_name}] 结构化 LLM 调用超时 ({_LLM_TIMEOUT}s)")
            return None

        logger.info(f"[{node_name}] 结构化 LLM 调用成功: {type(output_model).__name__}")
        return response

    except Exception as e:
        logger.warning(f"[{node_name}] 结构化输出失败，尝试降级: {e}")
        # 降级到 JSON 模式
        fallback = await call_llm_json(prompt_template, input_data, node_name)
        if fallback is not None and isinstance(fallback, dict):
            try:
                return output_model(**fallback)
            except Exception:
                return None
        return None
