from qdrant_client import QdrantClient
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class QdrantRepository:
    def __init__(
        self,
        host: str,
        port: int,
        collection: str,
        api_key: Optional[str] = None
    ):
        self.collection = collection
        self.client = QdrantClient(host=host, port=port)
        if api_key:
            self.client.set_api_key(api_key)

    def create_collection_if_not_exists(self, vector_size: int):
        try:
            exists = self.client.collectionExists(self.collection)
            if not exists:
                self.client.createCollection(self.collection, vector_size)
                logger.info(f"创建Qdrant集合: {self.collection}")
        except Exception as e:
            logger.error(f"创建集合失败: {e}")
            raise

    def upsert_vector(
        self,
        point_id: str,
        vector: List[float],
        payload: Dict[str, Any]
    ):
        self.client.upsert(self.collection, point_id, vector, payload)

    def search(
        self,
        vector: List[float],
        limit: int,
        filter_conditions: Dict = None
    ) -> List[Dict]:
        results = self.client.search(self.collection, vector, limit)
        return [
            {
                "id": r.id,
                "score": r.score,
                "payload": r.payload
            }
            for r in results
        ]

    def delete_vector(self, point_id: str):
        self.client.delete(self.collection, point_id)

    def get_collection_info(self) -> Dict[str, Any]:
        try:
            info = self.client.getCollectionInfo(self.collection)
            return {
                "vectors_count": info.vectors_count,
                "points_count": info.points_count
            }
        except Exception as e:
            logger.error(f"获取集合信息失败: {e}")
            return {
                "vectors_count": 0,
                "points_count": 0
            }
