# Python 后端 - Agent 开发索引

> FastAPI + Python 3.11 + Celery + Qdrant
> AI 功能后端，处理向量检索、图像识别、评分、LLM 调用

## 应用结构

```
backend/
├── app/
│   ├── main.py                  # FastAPI 启动入口
│   ├── config.py                # pydantic-settings 配置
│   ├── api/v1/                  # API 路由（25个模块）
│   ├── services/                # 业务服务（24个 + 1子包）
│   ├── models/                  # SQLAlchemy 模型（10个）
│   ├── repositories/            # 数据访问（MySQL/Qdrant/Redis）
│   ├── middleware/               # 中间件（认证/错误/日志/超时）
│   ├── schemas/                 # Pydantic Schema
│   ├── tasks/                   # Celery 异步任务
│   └── utils/                   # 工具类
├── migrations/                  # SQL 迁移（39个文件）
├── scripts/                     # 运维脚本
├── Dockerfile
└── requirements.txt
```

## API 路由模块

| 模块 | 路径前缀 | 功能 | Agent 注意 |
|------|---------|------|-----------|
| auth.py | `/api/v1/auth` | 登录/登出/Token | JWT 认证 |
| products.py | `/api/v1/products` | 产品 CRUD | 正在迁移到 Java |
| selection.py | `/api/v1/selection` | 选品管理 | 正在迁移到 Java |
| final_drafts.py | `/api/v1/final-drafts` | 定稿管理 | 正在迁移到 Java |
| material_library.py | `/api/v1/material-library` | 素材库 | 含 AI 分析接口，保留 |
| carrier_library.py | `/api/v1/carrier-library` | 运营商库 | 正在迁移到 Java |
| images.py | `/api/v1/images` | 图片管理 | **核心 AI：以图搜图/相似搜索** |
| scoring.py | `/api/v1/scoring` | 评分引擎 | **核心 AI：ScoringEngine** |
| image_proxy.py | `/api/v1/image-proxy` | 图片代理 | COS 代理+缩略图 |
| product_data.py | `/api/v1/product-data` | 数据看板 | Polars 数据处理 |
| import_.py / export.py | `/api/v1/import\|export` | 导入导出 | Excel 处理 |
| reports.py | `/api/v1/reports` | 报表 | Python 脚本生成 |
| statistics.py | `/api/v1/statistics` | 统计 | 聚合查询 |
| system_config.py | `/api/v1/system-config` | 系统配置 | 备份管理 |
| logs.py | `/api/v1/logs` | 日志文档 | CRUD |
| download_tasks.py | `/api/v1/download-tasks` | 下载任务 | ZIP 打包 |
| lingxing.py | `/api/v1/lingxing` | 领星导入 | COS 上传 |
| file_links.py | `/api/v1/file-links` | 文件链接 | CRUD |
| product_sales.py | `/api/products` | 产品销量 | 独立路由前缀 |

## AI 核心服务

| 服务 | 文件 | 功能 | 依赖 |
|------|------|------|------|
| 向量编码 | `ai_vector_processing/ai_vector_processor.py` | ViT 模型图片编码 | torch + transformers |
| 以图搜图 | `tencent_image_search_service.py` | 腾讯图像搜索 API | 腾讯云 SDK |
| 图像识别 | `tencent_image_recognition_service.py` | 腾讯图像识别 | 腾讯云 SDK |
| 图像识别 | `baidu_image_recognition_service.py` | 百度图像识别 | 百度 SDK |
| LLM 视觉 | `tencent_llm_vision_service.py` | 混元大模型视觉 | 腾讯云 SDK |
| 评分引擎 | `scoring_engine.py` | 选品评分算法 | 纯规则计算 |
| 向量检索 | `repositories/qdrant_repo.py` | Qdrant 操作 | qdrant-client |
| COS 服务 | `cos_service.py` | 腾讯云对象存储 | cos-python-sdk |

## 中间件

| 中间件 | 文件 | 说明 |
|--------|------|------|
| 认证 | `middleware/auth_middleware.py` | JWT Token 验证 |
| 错误处理 | `middleware/error_handler.py` + `error_middleware.py` | 全局异常捕获 |
| 日志 | `middleware/logging.py` | 请求日志记录 |
| 超时 | `middleware/timeout.py` | 请求超时控制 |

## 配置

所有配置通过 `app/config.py` 的 `Settings` 类（pydantic-settings）读取环境变量：

```
ENVIRONMENT, MYSQL_*, REDIS_*, QDRANT_*, COS_*, SECRET_KEY, ...
```

## Agent 修改规则

1. 新增路由放在 `api/v1/` 下，注册到 `api/v1/__init__.py` 的 `api_router`
2. 新增服务放在 `services/` 下，禁止在路由文件中写业务逻辑
3. 新增模型放在 `models/` 下，用 SQLAlchemy 声明式
4. AI 相关服务保持独立，不与 CRUD 逻辑耦合
5. 异步任务放 `tasks/`，通过 Celery 执行
6. 数据库变更写 SQL 迁移文件放 `migrations/`
7. 禁止硬编码路径，用 `settings` 读取配置
