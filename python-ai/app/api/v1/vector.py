import time
import uuid
import tempfile
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    VectorSearchRequest,
    VectorSearchResponse,
    VectorIndexRequest,
    VectorIndexResponse,
    HealthResponse,
)
from app.services.vector_service import VectorService
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai/vector", tags=["向量搜索"])

vector_service = VectorService(settings.clip_model)


def get_qdrant_service():
    from app.repositories.qdrant_repo import QdrantRepository
    return QdrantRepository(
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        collection=settings.qdrant_collection,
        api_key=settings.qdrant_api_key
    )


@router.post("/search", response_model=VectorSearchResponse)
async def search_similar_images(request: VectorSearchRequest):
    start_time = time.time()

    try:
        if request.image_url:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(request.image_url)
                response.raise_for_status()
                image_bytes = response.content
        elif request.image_data:
            import base64
            image_bytes = base64.b64decode(request.image_data)
        else:
            raise HTTPException(status_code=400, detail="需要提供image_url或image_data")

        query_vector = vector_service.extract_vector_from_bytes(image_bytes)
        if query_vector is None:
            raise HTTPException(status_code=500, detail="向量提取失败")

        qdrant_service = get_qdrant_service()
        results = qdrant_service.search(query_vector, request.limit)

        query_time = (time.time() - start_time) * 1000

        return VectorSearchResponse(
            results=results,
            total=len(results),
            query_time_ms=query_time
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index", response_model=VectorIndexResponse)
async def index_image(request: VectorIndexRequest):
    try:
        image_path = request.image_path

        if request.image_path:
            image_path = request.image_path
        elif request.image_url:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(request.image_url)
                response.raise_for_status()
                image_bytes = response.content
            with tempfile.NamedTemporaryFile(
                suffix=".jpg", delete=False
            ) as f:
                f.write(image_bytes)
                image_path = f.name
        else:
            raise HTTPException(
                status_code=400,
                detail="需要提供image_path或image_url"
            )

        vector = vector_service.extract_vector(image_path)
        if vector is None:
            raise HTTPException(status_code=500, detail="向量提取失败")

        point_id = str(uuid.uuid4())
        payload = {
            "image_id": request.image_id,
            **(request.metadata or {})
        }

        qdrant_service = get_qdrant_service()
        qdrant_service.upsert(point_id, vector, payload)

        return VectorIndexResponse(
            point_id=point_id,
            image_id=request.image_id,
            status="indexed",
            indexed_at=datetime.now()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        qdrant_service = get_qdrant_service()
        qdrant_info = qdrant_service.get_collection_info()
        return HealthResponse(
            status="healthy",
            qdrant_connected=True,
            vector_count=qdrant_info.get("vectors_count", 0),
            model_loaded=vector_service.model is not None
        )
    except Exception as e:
        logger.warning(f"健康检查异常: {e}")
        return HealthResponse(
            status="degraded",
            qdrant_connected=False,
            vector_count=0,
            model_loaded=vector_service.model is not None
        )
