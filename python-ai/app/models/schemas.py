from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class VectorSearchRequest(BaseModel):
    image_url: Optional[str] = None
    image_data: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=100)
    category: Optional[str] = None


class VectorSearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int
    query_time_ms: float


class VectorIndexRequest(BaseModel):
    image_id: int
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class VectorIndexResponse(BaseModel):
    point_id: str
    image_id: int
    status: str
    indexed_at: datetime


class HealthResponse(BaseModel):
    status: str
    qdrant_connected: bool
    vector_count: int
    model_loaded: bool


class BatchIndexRequest(BaseModel):
    image_ids: List[int]


class BatchIndexResponse(BaseModel):
    total: int
    success: int
    failed: int
    errors: List[Dict[str, Any]]
