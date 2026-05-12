# 思觉智贸 - Python AI服务

> 向量搜索、图像识别等AI能力服务

## 功能特性

- **向量搜索**：基于CLIP模型的图片向量化与相似度搜索
- **Qdrant集成**：向量数据库存储与检索
- **Java API客户端**：与Java后端无缝对接

## 快速开始

### 本地开发

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置 Qdrant 和 Java API 地址

# 启动服务
python -m app.main
```

### Docker部署

```bash
# 构建镜像
docker build -t sijue/python-ai:latest ./python-ai

# 运行容器
docker run -d \
  --name sijue-python-ai \
  -p 8000:8000 \
  -e AI_QDRANT_HOST=qdrant \
  -e AI_QDRANT_PORT=6333 \
  -e AI_JAVA_API_URL=http://java-backend:8080 \
  sijue/python-ai:latest
```

### docker-compose

```yaml
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

## API文档

启动服务后访问：http://localhost:8000/docs

### 向量搜索 API

```
POST /api/v1/ai/vector/search
```

**请求体**：
```json
{
  "image_url": "https://example.com/image.jpg",
  "limit": 10,
  "category": "electronics"
}
```

**响应**：
```json
{
  "results": [
    {
      "id": "uuid",
      "score": 0.95,
      "payload": {"image_id": 123}
    }
  ],
  "total": 10,
  "query_time_ms": 45.2
}
```

### 图片索引 API

```
POST /api/v1/ai/vector/index
```

**请求体**：
```json
{
  "image_id": 123,
  "image_url": "https://example.com/image.jpg",
  "metadata": {
    "category": "electronics",
    "sku": "SKU001"
  }
}
```

### 健康检查

```
GET /api/v1/ai/vector/health
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_QDRANT_HOST` | localhost | Qdrant服务地址 |
| `AI_QDRANT_PORT` | 6333 | Qdrant服务端口 |
| `AI_QDRANT_COLLECTION` | images | 向量集合名称 |
| `AI_QDRANT_API_KEY` | - | Qdrant API密钥 |
| `AI_JAVA_API_URL` | http://localhost:8080 | Java后端地址 |
| `AI_CLIP_MODEL` | clip-vit-base-patch32 | CLIP模型名称 |
| `AI_HOST` | 0.0.0.0 | 服务监听地址 |
| `AI_PORT` | 8000 | 服务监听端口 |

## 项目结构

```
python-ai/
├── app/
│   ├── main.py              # FastAPI入口
│   ├── config.py            # 配置管理
│   ├── api/
│   │   └── v1/
│   │       ├── vector.py    # 向量搜索API
│   │       └── health.py    # 健康检查
│   ├── services/
│   │   ├── vector_service.py    # 向量提取服务
│   │   └── qdrant_service.py    # Qdrant封装
│   ├── models/
│   │   └── schemas.py       # Pydantic模型
│   ├── clients/
│   │   └── java_api_client.py   # Java API客户端
│   └── repositories/
│       └── qdrant_repo.py   # Qdrant仓库
├── models/                   # AI模型文件
├── tests/                    # 测试
├── requirements.txt
├── Dockerfile
└── README.md
```

## 技术栈

- **FastAPI**：高性能Web框架
- **Qdrant**：向量数据库
- **CLIP**：图像向量化模型
- **Transformers**：Hugging Face模型库
- **httpx**：异步HTTP客户端

## 后续规划

- [ ] 图像识别API（腾讯/百度）
- [ ] 以图搜图API
- [ ] RAG知识库
- [ ] Agent编排

## 许可证

MIT License
