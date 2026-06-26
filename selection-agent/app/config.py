from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "selection-agent"
    app_version: str = "0.1.0"
    debug: bool = False

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_reasoning_effort: str | None = "high"
    deepseek_enable_thinking: bool = False
    deepseek_timeout_seconds: float = 90.0

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]
