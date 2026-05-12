from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "images"
    qdrant_api_key: Optional[str] = None

    java_api_url: str = "http://localhost:8080"
    java_api_token: Optional[str] = None

    clip_model: str = "clip-vit-base-patch32"
    vector_dimensions: int = 512

    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    class Config:
        env_file = ".env"
        env_prefix = "AI_"


settings = Settings()
