from pydantic import BaseModel, Field


class TitleExtractionRequest(BaseModel):
    marketplace: str = Field(min_length=2, max_length=10)
    title: str = Field(min_length=3, max_length=1000)
    carrier_candidates: list[str] = Field(default_factory=list, max_length=100)
    matched_carrier_anchor: str | None = Field(default=None, max_length=200)
    category_hint: str | None = Field(default=None, max_length=200)
    language_hint: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)


class TitleExtractionResponse(BaseModel):
    marketplace: str
    title: str
    is_custom: bool
    carrier: str | None = None
    raw_carrier: str | None = None
    carrier_from_candidates: bool = False
    element: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str
    matched_carrier_anchor: str | None = None


class BatchTitleExtractionRequest(BaseModel):
    items: list[TitleExtractionRequest] = Field(min_length=1, max_length=200)


class BatchTitleExtractionResponse(BaseModel):
    total: int
    items: list[TitleExtractionResponse]
