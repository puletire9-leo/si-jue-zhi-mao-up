import json

from app.config import Settings
from app.schemas.title_extraction import TitleExtractionRequest
from app.services.title_extraction_service import TitleExtractionService


def main() -> None:
    settings = Settings()
    service = TitleExtractionService(settings=settings)
    result = service.extract(
        TitleExtractionRequest(
            marketplace="UK",
            title="Football Canvas Tote Bag, Gift for Women and Girls",
            carrier_candidates=["Canvas Tote Bag", "Suncatcher", "Poster"],
            matched_carrier_anchor="tote bag",
            category_hint="Reusable Shopping Bags",
        )
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
