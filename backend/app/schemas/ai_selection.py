"""AI 选品 API 请求与响应模型。"""

from typing import List, Optional

from pydantic import BaseModel, Field

MAX_ASINS_PER_REQUEST = 200


class AsinLookupRequest(BaseModel):
    """ASIN 查询请求。"""

    asins: List[str] = Field(
        ..., min_length=1, max_length=MAX_ASINS_PER_REQUEST
    )
    marketplace: Optional[str] = Field(None, pattern="^(UK|DE|US)$")


class PushRequest(AsinLookupRequest):
    """AI Agent 投递请求。"""

    message: Optional[str] = Field(None, max_length=200)


class AiSelectionProduct(BaseModel):
    """兼容 UniversalCard 的商品快照。"""

    asin: str = ""
    productTitle: str = ""
    imageUrl: str = ""
    price: Optional[float] = None
    marketplace: str = ""
    bsr: Optional[int] = None
    units: Optional[int] = None
    unitsGr: Optional[float] = None
    sellerName: str = ""
    mainCategoryName: str = ""
    availableDate: Optional[int] = None
    createdAt: Optional[str] = None
    symbol: str = ""
    rating: Optional[float] = None
    ratings: Optional[int] = None
    fulfillment: str = ""
    sourceTable: str = ""
    productUrl: str = ""
    listingDays: Optional[int] = None


class PushBatch(BaseModel):
    """一次投递批次。"""

    id: str
    message: str = ""
    pushedAt: str
    total: int
    requested: int = 0
    invalidAsins: List[str] = Field(default_factory=list)
    products: List[AiSelectionProduct] = Field(default_factory=list)


class PushResponse(BaseModel):
    batchId: str
    total: int
    requested: int
    invalidAsins: List[str] = Field(default_factory=list)
    products: List[AiSelectionProduct] = Field(default_factory=list)
    message: str


class SessionResponse(BaseModel):
    batches: List[PushBatch] = Field(default_factory=list)


class AsinLookupResponse(BaseModel):
    total: int
    requested: int = 0
    invalidAsins: List[str] = Field(default_factory=list)
    products: List[AiSelectionProduct] = Field(default_factory=list)


class AutoScreeningConfig(BaseModel):
    enabled: bool = False
    method_cards: List[str] = Field(default_factory=lambda: ["M01", "M03"])


class AutoScreeningResponse(BaseModel):
    total_raw: int = 0
    total_after_screening: int = 0
    products: List[AiSelectionProduct] = Field(default_factory=list)
    message: str = "自动筛选框架已预留，暂未实现"
