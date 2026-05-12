from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/ai", tags=["健康检查"])


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    return HealthCheckResponse(
        status="healthy",
        service="python-ai-service",
        version="1.0.0"
    )
