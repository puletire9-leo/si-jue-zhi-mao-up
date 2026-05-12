from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    SearchRequest, SearchParams
)
from typing import Optional, List, Dict, Any, Union
import numpy as np
import logging

logger = logging.getLogger(__name__)


class QdrantRepository:
    """
    Qdrant向量数据库访问层
    
    功能：
    - 管理Qdrant客户端连接
    - 提供向量集合管理接口
    - 支持向量插入、更新、删除
    - 支持向量相似性搜索
    - 支持混合搜索（向量+过滤条件）
    
    使用场景：
    - 图片向量存储
    - 相似图片搜索
    - 图像特征检索
    - 推荐系统
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 6333,
        collection_name: str = "images",
        vector_size: int = 512,
        distance: str = "Cosine"
    ):
        """
        初始化Qdrant仓库
        
        Args:
            host: Qdrant服务器地址
            port: Qdrant服务器端口
            collection_name: 集合名称
            vector_size: 向量维度
            distance: 距离度量方式（Cosine, Euclid, Dot）
        """
        self.host = host
        self.port = port
        self.collection_name = collection_name
        self.vector_size = vector_size
        self.distance = distance
        
        self.client: Optional[QdrantClient] = None
    
    async def connect(self):
        """
        创建Qdrant客户端连接
        
        Raises:
            Exception: 连接失败时抛出异常
        """
        try:
            # 设置超时参数，避免连接尝试时间过长
            self.client = QdrantClient(
                host=self.host, 
                port=self.port,
                timeout=5.0  # 设置5秒超时
            )
            
            # 测试连接
            collections = self.client.get_collections()
            logger.info(f"[OK] Qdrant连接成功 | 集合数量: {len(collections.collections)}")
            
            # 检查并创建集合
            await self.ensure_collection()
            
        except Exception as e:
            logger.error(f"[FAIL] Qdrant连接失败: {e}")
            raise
    
    async def disconnect(self):
        """
        关闭Qdrant客户端连接
        """
        if self.client:
            self.client.close()
            logger.info("[OK] Qdrant连接已关闭")
    
    async def ensure_collection(self):
        """
        确保集合存在，不存在则创建
        """
        try:
            # 检查集合是否存在
            collections = self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if self.collection_name not in collection_names:
                # 创建集合
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=self._get_distance_metric()
                    )
                )
                logger.info(f"[OK] 创建Qdrant集合: {self.collection_name}")
            else:
                logger.info(f"[OK] Qdrant集合已存在: {self.collection_name}")
                
        except Exception as e:
            logger.error(f"[FAIL] 创建Qdrant集合失败: {e}")
            raise
    
    def _get_distance_metric(self) -> Distance:
        """
        获取距离度量对象
        
        Returns:
            Distance对象
        """
        distance_map = {
            "Cosine": Distance.COSINE,
            "Euclid": Distance.EUCLID,
            "Dot": Distance.DOT
        }
        return distance_map.get(self.distance, Distance.COSINE)
    
    async def insert_point(
        self,
        point_id: int,
        vector: Union[List[float], np.ndarray],
        payload: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        插入向量点
        
        Args:
            point_id: 点ID
            vector: 向量数据
            payload: 附加数据
            
        Returns:
            是否插入成功
        """
        try:
            # 转换为列表
            if isinstance(vector, np.ndarray):
                vector = vector.tolist()
            
            # 创建点
            point = PointStruct(
                id=point_id,
                vector=vector,
                payload=payload or {}
            )
            
            # 插入点
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            
            logger.debug(f"[OK] 插入向量点 | ID: {point_id}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 插入向量点失败 | ID: {point_id} | 错误: {e}")
            return False
    
    async def insert_points(
        self,
        points: List[Dict[str, Any]]
    ) -> bool:
        """
        批量插入向量点
        
        Args:
            points: 点列表，每个点包含id, vector, payload
            
        Returns:
            是否插入成功
        """
        try:
            point_structs = []
            
            for point_data in points:
                point_id = point_data['id']
                vector = point_data['vector']
                payload = point_data.get('payload', {})
                
                # 转换为列表
                if isinstance(vector, np.ndarray):
                    vector = vector.tolist()
                
                point_structs.append(
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                )
            
            # 批量插入
            self.client.upsert(
                collection_name=self.collection_name,
                points=point_structs
            )
            
            logger.info(f"[OK] 批量插入向量点 | 数量: {len(point_structs)}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 批量插入向量点失败 | 错误: {e}")
            return False
    
    async def search(
        self,
        query_vector: Union[List[float], np.ndarray],
        limit: int = 10,
        score_threshold: Optional[float] = None,
        filter_condition: Optional[Filter] = None
    ) -> List[Dict[str, Any]]:
        """
        向量相似性搜索
        
        Args:
            query_vector: 查询向量
            limit: 返回结果数量
            score_threshold: 相似度阈值
            filter_condition: 过滤条件
            
        Returns:
            搜索结果列表，每个结果包含id, score, payload
        """
        try:
            # 转换为列表
            if isinstance(query_vector, np.ndarray):
                query_vector = query_vector.tolist()
            
            # 执行搜索
            search_params = SearchParams(hnsw_ef=128, exact=False)
            
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=filter_condition,
                limit=limit,
                score_threshold=score_threshold,
                search_params=search_params
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'id': result.id,
                    'score': result.score,
                    'payload': result.payload
                })
            
            logger.debug(f"[OK] 向量搜索完成 | 结果数: {len(formatted_results)}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"[FAIL] 向量搜索失败 | 错误: {e}")
            return []
    
    async def search_by_filter(
        self,
        filter_condition: Filter,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        基于过滤条件的搜索
        
        Args:
            filter_condition: 过滤条件
            limit: 返回结果数量
            
        Returns:
            搜索结果列表
        """
        try:
            # 使用零向量进行搜索（仅应用过滤条件）
            zero_vector = [0.0] * self.vector_size
            
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=zero_vector,
                query_filter=filter_condition,
                limit=limit,
                score_threshold=0.0
            )
            
            # 格式化结果
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'id': result.id,
                    'score': result.score,
                    'payload': result.payload
                })
            
            logger.debug(f"[OK] 过滤搜索完成 | 结果数: {len(formatted_results)}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"[FAIL] 过滤搜索失败 | 错误: {e}")
            return []
    
    async def get_point(self, point_id: int) -> Optional[Dict[str, Any]]:
        """
        获取向量点
        
        Args:
            point_id: 点ID
            
        Returns:
            点信息
        """
        try:
            result = self.client.retrieve(
                collection_name=self.collection_name,
                ids=[point_id]
            )
            
            if result:
                return {
                    'id': result[0].id,
                    'vector': result[0].vector,
                    'payload': result[0].payload
                }
            
            return None
            
        except Exception as e:
            logger.error(f"[FAIL] 获取向量点失败 | ID: {point_id} | 错误: {e}")
            return None
    
    async def delete_point(self, point_id: int) -> bool:
        """
        删除向量点
        
        Args:
            point_id: 点ID
            
        Returns:
            是否删除成功
        """
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=[point_id]
            )
            
            logger.debug(f"[OK] 删除向量点 | ID: {point_id}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 删除向量点失败 | ID: {point_id} | 错误: {e}")
            return False
    
    async def delete_points(self, point_ids: List[int]) -> bool:
        """
        批量删除向量点
        
        Args:
            point_ids: 点ID列表
            
        Returns:
            是否删除成功
        """
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=point_ids
            )
            
            logger.info(f"[OK] 批量删除向量点 | 数量: {len(point_ids)}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 批量删除向量点失败 | 错误: {e}")
            return False
    
    async def update_point(
        self,
        point_id: int,
        vector: Optional[Union[List[float], np.ndarray]] = None,
        payload: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        更新向量点
        
        Args:
            point_id: 点ID
            vector: 新的向量（可选）
            payload: 新的附加数据（可选）
            
        Returns:
            是否更新成功
        """
        try:
            # 转换为列表
            if vector is not None and isinstance(vector, np.ndarray):
                vector = vector.tolist()
            
            # 更新点
            self.client.upsert(
                collection_name=self.collection_name,
                points=[PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload or {}
                )]
            )
            
            logger.debug(f"[OK] 更新向量点 | ID: {point_id}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 更新向量点失败 | ID: {point_id} | 错误: {e}")
            return False
    
    async def get_collection_info(self) -> Optional[Dict[str, Any]]:
        """
        获取集合信息
        
        Returns:
            集合信息
        """
        try:
            info = self.client.get_collection(self.collection_name)
            
            return {
                'name': info.config.params.vectors.size,
                'vector_size': info.config.params.vectors.size,
                'distance': info.config.params.vectors.distance.value,
                'points_count': info.points_count,
                'status': info.status.value
            }
            
        except Exception as e:
            logger.error(f"[FAIL] 获取集合信息失败 | 错误: {e}")
            return None
    
    async def delete_collection(self) -> bool:
        """
        删除集合
        
        Returns:
            是否删除成功
        """
        try:
            self.client.delete_collection(self.collection_name)
            logger.info(f"[OK] 删除Qdrant集合: {self.collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"[FAIL] 删除Qdrant集合失败 | 错误: {e}")
            return False
    
    async def count_points(self) -> int:
        """
        统计集合中的点数量
        
        Returns:
            点数量
        """
        try:
            info = self.client.get_collection(self.collection_name)
            return info.points_count
            
        except Exception as e:
            logger.error(f"[FAIL] 统计点数量失败 | 错误: {e}")
            return 0
    
    # 便捷方法：创建过滤条件
    @staticmethod
    def create_filter(field: str, value: Any) -> Filter:
        """
        创建过滤条件
        
        Args:
            field: 字段名
            value: 字段值
            
        Returns:
            Filter对象
        """
        return Filter(
            must=[
                FieldCondition(
                    key=field,
                    match=MatchValue(value=value)
                )
            ]
        )
