from functools import lru_cache

from app.config import Settings
from app.services.title_extraction_service import TitleExtractionService


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_title_extraction_service() -> TitleExtractionService:
    return TitleExtractionService(settings=get_settings())
