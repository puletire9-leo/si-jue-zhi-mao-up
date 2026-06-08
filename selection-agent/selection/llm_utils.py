"""LLM 调用工具 — 各节点共用的 LLM 交互函数。

参考 SuperMew RAG 的 agent_factory.py 中 init_chat_model 模式。
"""

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# LLM 配置（从环境变量读取）
_LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
_LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
_LLM_API_KEY = os.getenv("LLM_API_KEY", "")

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


async def call_llm_json(
    prompt_template: str,
    input_data: Dict[str, Any],
    node_name: str = "unknown",
) -> Optional[Dict[str, Any]]:
    """调用 LLM 并解析 JSON 输出。

    Args:
        prompt_template: 含 {input_data} 占位符的提示词模板
        input_data: 要填入模板的数据字典
        node_name: 节点名称（用于日志）

    Returns:
        LLM 返回的 JSON 字典，失败时返回 None
    """
    try:
        # 填充模板
        prompt = prompt_template.replace(
            "{input_data}", json.dumps(input_data, ensure_ascii=False, indent=2)
        )

        # 调用 LLM
        llm = get_llm()
        response = await llm.ainvoke(prompt)

        # 解析 JSON
        content = response.content
        # 处理 markdown code block 包裹的 JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())
        logger.info(f"[{node_name}] LLM 调用成功")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"[{node_name}] LLM 返回非JSON格式: {e}")
        return None
    except Exception as e:
        logger.error(f"[{node_name}] LLM 调用失败: {e}")
        return None
