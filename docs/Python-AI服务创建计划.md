# Python AI服务创建计划

> 项目：思觉智贸 - Python AI服务创建
> 版本：v1.0
> 日期：2026-05-08

---

## 一、目标概述

创建独立的 Python AI 服务，仅保留向量搜索相关的 AI 能力，为将来与 Java 后端对接做准备。

### 范围
- ✅ 向量搜索服务（Qdrant + CLIP）
- ✅ 图片向量化
- ✅ 相似图片搜索
- ⏳ 图像识别（下一阶段）
- ⏳ 以图搜图（下一阶段）

---

## 二、当前状态分析

### Java后端已实现
| 模块 | 状态 | 说明 |
|------|------|------|
| ScoringController | ✅ 完整 | 规则引擎评分 |
| VectorSearchController | ⚠️ 有接口 | 向量搜索控制器，但依赖Python |
| ImageProxyController | ✅ 完整 | 图片代理服务 |
| Qdrant客户端 | ✅ 已配置 | VectorSearchServiceImpl |

### Python后端需保留的AI模块
| 模块 | 原文件 | 功能 |
|------|--------|------|
| Qdrant向量处理 | `services/ai_vector_processing/` | CLIP向量提取 |
| 向量服务 | `services/image_service.py` | 图片向量化 |

---

## 三、创建Python AI服务

### 3.1 目录结构

```
python-ai/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI入口
│   ├── config.py                  # 配置管理
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── vector.py          # 向量搜索API
│   │       └── health.py          # 健康检查
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── qdrant_service.py      # Qdrant操作封装
│   │   └── vector_service.py      # 向量提取服务
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # Pydantic模型
│   │
│   ├── clients/
│   │   ├── __init__.py
│   │   └── java_api_client.py     # 调用Java后端获取数据
│   │
│   └── repositories/
│       ├── __init__.py
│       └── qdrant_repo.py         # Qdrant仓库
│
├── models/                        # AI模型文件
│   └── clip/
│       └── model.bin
│
├── tests/                         # 测试目录
│   ├── __init__.py
│   ├── test_vector.py
│   └── test_qdrant.py
│
├── requirements.txt               # Python依赖
├── Dockerfile                     # Docker构建
└── README.md                      # 服务说明
```

---

## 四、实施步骤

### 阶段一：基础框架搭建 (0.5天)

#### Step 1.1: 创建项目目录
- [ ] 创建 `python-ai/` 目录
- [ ] 创建 `app/` 子目录结构
- [ ] 创建 `__init__.py` 文件

#### Step 1.2: 创建基础配置文件

**文件：`python-ai/requirements.txt`**
```txt
# Web框架
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# 向量数据库
qdrant-client==1.7.0

# LLM集成（预留）
openai==1.10.0
dashscope==1.14.0

# 图像处理
pillow==10.2.0
opencv-python-headless==4.9.0.80

# 工具库
httpx==0.26.0
pydantic==2.5.3
pydantic-settings==2.1.0
numpy==1.26.3
torch==2.1.2
transformers==4.37.0
```

**文件：`python-ai/app/config.py`**
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Qdrant配置
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "images"
    qdrant_api_key: Optional[str] = None

    # Java后端配置
    java_api_url: str = "http://localhost:8080"
    java_api_token: Optional[str] = None

    # CLIP模型配置
    clip_model: str = "clip-vit-base-patch32"
    vector_dimensions: int = 512

    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    class Config:
        env_file = ".env"
        env_prefix = "AI_"

settings = Settings()
```

---

### 阶段二：核心服务实现 (1天)

#### Step 2.1: Qdrant仓库封装

**文件：`python-ai/app/repositories/qdrant_repo.py`**
```python
from qdrant_client import QdrantClient
from qdrant_client.grpc import Collections
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class QdrantRepository:
    def __init__(self, host: str, port: int, collection: str, api_key: Optional[str] = None):
        self.collection = collection
        self.client = QdrantClient(host=host, port=port)
        if api_key:
            self.client.set_api_key(api_key)

    def create_collection_if_not_exists(self, vector_size: int):
        """创建集合（如果不存在）"""
        try:
            exists = self.client.collectionExists(self.collection)
            if not exists:
                self.client.createCollection(self.collection, vector_size)
                logger.info(f"创建Qdrant集合: {self.collection}")
        except Exception as e:
            logger.error(f"创建集合失败: {e}")
            raise

    def upsert_vector(self, point_id: str, vector: List[float], payload: Dict[str, Any]):
        """插入或更新向量"""
        self.client.upsert(self.collection, point_id, vector, payload)

    def search(self, vector: List[float], limit: int, filter_conditions: Dict = None) -> List[Dict]:
        """向量相似度搜索"""
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
        """删除向量"""
        self.client.delete(self.collection, point_id)

    def get_collection_info(self) -> Dict[str, Any]:
        """获取集合信息"""
        info = self.client.getCollectionInfo(self.collection)
        return {
            "vectors_count": info.vectors_count,
            "points_count": info.points_count
        }
```

#### Step 2.2: 向量服务

**文件：`python-ai/app/services/vector_service.py`**
```python
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self, model_name: str = "clip-vit-base-patch32"):
        self.model_name = model_name
        self.model = None
        self.processor = None
        self._load_model()

    def _load_model(self):
        """加载CLIP模型"""
        try:
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            self.model = CLIPModel.from_pretrained(self.model_name)
            self.model.eval()
            logger.info(f"CLIP模型加载成功: {self.model_name}")
        except Exception as e:
            logger.warning(f"CLIP模型加载失败，使用模拟向量: {e}")
            self.model = None
            self.processor = None

    def extract_vector(self, image_path: str) -> Optional[List[float]]:
        """从图片提取向量"""
        try:
            if self.model is None:
                return self._generate_mock_vector(image_path)

            image = Image.open(image_path).convert('RGB')
            inputs = self.processor(images=image, return_tensors="pt")

            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)

            vector = image_features.numpy().flatten().tolist()
            return self._normalize_vector(vector)

        except Exception as e:
            logger.error(f"向量提取失败: {e}")
            return self._generate_mock_vector(image_path)

    def extract_vector_from_bytes(self, image_bytes: bytes) -> Optional[List[float]]:
        """从图片字节提取向量"""
        try:
            if self.model is None:
                return self._generate_mock_vector("bytes")

            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            inputs = self.processor(images=image, return_tensors="pt")

            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)

            vector = image_features.numpy().flatten().tolist()
            return self._normalize_vector(vector)

        except Exception as e:
            logger.error(f"向量提取失败: {e}")
            return self._generate_mock_vector("bytes")

    def _normalize_vector(self, vector: List[float]) -> List[float]:
        """L2归一化"""
        magnitude = np.sqrt(sum(v * v for v in vector))
        if magnitude > 0:
            return [v / magnitude for v in vector]
        return vector

    def _generate_mock_vector(self, seed: str) -> List[float]:
        """生成模拟向量（用于测试）"""
        np.random.seed(hash(seed) % (2**32))
        vector = np.random.randn(512).astype(float)
        return self._normalize_vector(vector.tolist())
```

---

### 阶段三：API接口实现 (0.5天)

#### Step 3.1: Pydantic模型

**文件：`python-ai/app/models/schemas.py`**
```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class VectorSearchRequest(BaseModel):
    image_url: Optional[str] = None
    image_data: Optional[str] = None  # base64
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
```

#### Step 3.2: 向量搜索API

**文件：`python-ai/app/api/v1/vector.py`**
```python
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import (
    VectorSearchRequest,
    VectorSearchResponse,
    VectorIndexRequest,
    VectorIndexResponse,
    HealthResponse
)
from app.services.vector_service import VectorService
from app.services.qdrant_service import QdrantService
from app.config import settings
import time
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai/vector", tags=["向量搜索"])

vector_service = VectorService(settings.clip_model)
qdrant_service = QdrantService(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
    collection=settings.qdrant_collection,
    api_key=settings.qdrant_api_key
)

@router.post("/search", response_model=VectorSearchResponse)
async def search_similar_images(request: VectorSearchRequest):
    """向量相似度搜索"""
    start_time = time.time()

    try:
        # 提取查询图片向量
        if request.image_url:
            # 从URL下载图片
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(request.image_url)
                image_bytes = response.content
        elif request.image_data:
            # 从base64解码
            import base64
            image_bytes = base64.b64decode(request.image_data)
        else:
            raise HTTPException(status_code=400, detail="需要提供image_url或image_data")

        query_vector = vector_service.extract_vector_from_bytes(image_bytes)
        if query_vector is None:
            raise HTTPException(status_code=500, detail="向量提取失败")

        # 执行搜索
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
    """索引图片向量"""
    try:
        # 获取图片数据
        if request.image_path:
            image_path = request.image_path
        elif request.image_url:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(request.image_url)
                image_bytes = response.content
            # 临时保存
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
                f.write(image_bytes)
                image_path = f.name
        else:
            raise HTTPException(status_code=400, detail="需要提供image_path或image_url")

        # 提取向量
        vector = vector_service.extract_vector(image_path)
        if vector is None:
            raise HTTPException(status_code=500, detail="向量提取失败")

        # 构建payload
        import uuid
        point_id = str(uuid.uuid4())
        payload = {
            "image_id": request.image_id,
            **(request.metadata or {})
        }

        # 存入Qdrant
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
    """健康检查"""
    try:
        qdrant_info = qdrant_service.get_collection_info()
        return HealthResponse(
            status="healthy",
            qdrant_connected=True,
            vector_count=qdrant_info.get("vectors_count", 0),
            model_loaded=vector_service.model is not None
        )
    except Exception as e:
        return HealthResponse(
            status="degraded",
            qdrant_connected=False,
            vector_count=0,
            model_loaded=vector_service.model is not None
        )
```

#### Step 3.3: FastAPI入口

**文件：`python-ai/app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import vector, health
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="思觉智贸 - Python AI服务",
    description="向量搜索、图像识别等AI能力",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(vector.router)
app.include_router(health.router)

@app.get("/")
async def root():
    return {"message": "Python AI服务", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
```

---

### 阶段四：Java API客户端 (0.5天)

#### Step 4.1: Java API客户端

**文件：`python-ai/app/clients/java_api_client.py`**
```python
import httpx
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class JavaAPIClient:
    def __init__(self, base_url: str, token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.client = httpx.AsyncClient(timeout=30.0)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def login(self, username: str, password: str) -> str:
        """登录获取token"""
        response = await self.client.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["data"]["accessToken"]
        return self.token

    async def get_images(self, product_id: int) -> List[Dict[str, Any]]:
        """获取产品图片"""
        response = await self.client.get(
            f"{self.base_url}/api/v1/images",
            params={"productId": product_id},
            headers=self._get_headers()
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}).get("items", [])

    async def get_image_url(self, image_id: int) -> Optional[str]:
        """获取图片URL"""
        response = await self.client.get(
            f"{self.base_url}/api/v1/images/{image_id}",
            headers=self._get_headers()
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}).get("url")

    async def update_image_vector_status(self, image_id: int, point_id: str):
        """更新图片向量状态"""
        response = await self.client.put(
            f"{self.base_url}/api/v1/images/{image_id}/vector",
            json={"pointId": point_id, "status": "indexed"},
            headers=self._get_headers()
        )
        response.raise_for_status()

    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
```

---

### 阶段五：Docker配置 (0.5天)

#### Step 5.1: Dockerfile

**文件：`python-ai/Dockerfile`**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/
COPY models/ ./models/

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Step 5.2: docker-compose.yml 更新

```yaml
# 在现有的docker-compose.yml中添加
python-ai:
  build:
    context: ./python-ai
    dockerfile: Dockerfile
  container_name: sijue-python-ai
  environment:
    - AI_QDRANT_HOST=qdrant
    - AI_QDRANT_PORT=6333
    - AI_QDRANT_COLLECTION=images
    - AI_JAVA_API_URL=http://java-backend:8080
  ports:
    - "8000:8000"
  depends_on:
    qdrant:
      condition: service_healthy
  networks:
    - sijue-network
```

---

## 五、测试计划

### 单元测试
- [ ] QdrantRepository 测试
- [ ] VectorService 测试
- [ ] API接口测试

### 集成测试
- [ ] Java后端 → Python AI服务 调用测试
- [ ] 向量搜索端到端测试
- [ ] 图片索引端到端测试

---

## 六、交付物清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `python-ai/app/main.py` | FastAPI入口 | ⏳ |
| `python-ai/app/config.py` | 配置管理 | ⏳ |
| `python-ai/app/api/v1/vector.py` | 向量搜索API | ⏳ |
| `python-ai/app/services/vector_service.py` | 向量服务 | ⏳ |
| `python-ai/app/services/qdrant_service.py` | Qdrant封装 | ⏳ |
| `python-ai/app/clients/java_api_client.py` | Java客户端 | ⏳ |
| `python-ai/requirements.txt` | Python依赖 | ⏳ |
| `python-ai/Dockerfile` | Docker构建 | ⏳ |

---

## 七、时间估算

| 阶段 | 任务 | 时间 |
|------|------|------|
| 一 | 基础框架搭建 | 0.5天 |
| 二 | 核心服务实现 | 1天 |
| 三 | API接口实现 | 0.5天 |
| 四 | Java API客户端 | 0.5天 |
| 五 | Docker配置 | 0.5天 |
| **总计** | | **3天** |

---

## 八、后续扩展

### 阶段二（下一迭代）
- [ ] 图像识别API（腾讯/百度）
- [ ] 以图搜图API
- [ ] 混元视觉API

### 阶段三（未来）
- [ ] RAG知识库
- [ ] Agent编排
- [ ] LangChain集成
