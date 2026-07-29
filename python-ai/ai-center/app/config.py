"""配置层：全部来自环境变量，禁止硬编码环境相关值。

约定（见根 AGENTS.md 铁律 3）：
- DeepSeek 上游密钥来自 config/secrets/{dev,prod}.env 中的 DEEPSEEK_* 变量
- 内部调用方鉴权使用 AI_CENTER_INTERNAL_KEY（与上游密钥隔离）
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ai-center"
    app_version: str = "0.1.0"

    # ── 内部鉴权（调用方持有，不等于上游密钥）──
    # 由 AI_CENTER_INTERNAL_KEY 注入。为空时视为未配置，服务会拒绝所有业务请求。
    internal_key: str = ""

    # ── DeepSeek 上游 ──
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # ── 模型白名单（逗号分隔）──
    # 由 AI_CENTER_ALLOWED_MODELS 注入。请求 model 不在白名单直接 400。
    allowed_models: str = "deepseek-v4-flash,deepseek-v4-pro,deepseek-reasoner,deepseek-chat"

    # ── 超时（秒）──
    upstream_connect_timeout: float = 5.0
    upstream_read_timeout: float = 120.0
    upstream_stream_idle_timeout: float = 60.0

    # ── CORS（默认关闭跨域；中心是内部服务，不面向浏览器）──
    cors_origins: str = ""

    def allowed_model_set(self) -> set[str]:
        return {m.strip() for m in self.allowed_models.split(",") if m.strip()}

    def allowed_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


# 环境变量前缀：AI_CENTER_ 优先，其次直接读裸变量（DEEPSEEK_* 等）。
# pydantic-settings 默认按字段名大写匹配环境变量，这里显式声明别名以对齐 config/ 现有命名。
class _EnvSettings(Settings):
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    def __init__(self, **kwargs: object) -> None:  # noqa: D401
        import os

        env = os.environ
        mapped = {
            "internal_key": env.get("AI_CENTER_INTERNAL_KEY", ""),
            "deepseek_api_key": env.get("DEEPSEEK_API_KEY", ""),
            "deepseek_base_url": env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            "allowed_models": env.get(
                "AI_CENTER_ALLOWED_MODELS",
                "deepseek-v4-flash,deepseek-v4-pro,deepseek-reasoner,deepseek-chat",
            ),
            "cors_origins": env.get("AI_CENTER_CORS_ORIGINS", ""),
        }
        mapped.update(kwargs)
        super().__init__(**mapped)


def get_settings() -> Settings:
    return _EnvSettings()
