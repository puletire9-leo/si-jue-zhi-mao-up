from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_title_extraction_service
from app.schemas.title_extraction import (
    BatchTitleExtractionRequest,
    BatchTitleExtractionResponse,
    TitleExtractionRequest,
    TitleExtractionResponse,
)
from app.services.title_extraction_service import TitleExtractionService

router = APIRouter(prefix="/api/v1/title-extraction", tags=["title-extraction"])

ServiceDep = Annotated[TitleExtractionService, Depends(get_title_extraction_service)]


@router.post("/extract", response_model=TitleExtractionResponse)
async def extract_title(
    payload: TitleExtractionRequest,
    service: ServiceDep,
) -> TitleExtractionResponse:
    return service.extract(payload)


@router.post("/extract-batch", response_model=BatchTitleExtractionResponse)
async def extract_title_batch(
    payload: BatchTitleExtractionRequest,
    service: ServiceDep,
) -> BatchTitleExtractionResponse:
    items = service.extract_batch(payload.items)
    return BatchTitleExtractionResponse(total=len(items), items=items)
