# Python 后端 - Claude 自动加载上下文

> FastAPI + Python 3.11 + Celery + Qdrant。详情见 [AGENTS.md](AGENTS.md)。

## 路径约定

- 路由前缀: `/api/v1/{resource}/`
- 业务服务: `app/services/`
- 数据模型: `app/models/`（SQLAlchemy）
- 异步任务: `app/tasks/`（Celery）
- 数据库迁移: `migrations/`

## 核心 AI 服务

| 服务 | 文件 | 依赖 |
|------|------|------|
| 向量编码 | `ai_vector_processing/` | torch + transformers |
| 以图搜图 | `tencent_image_search_service.py` | 腾讯云 SDK |
| 图像识别 | `tencent_image_recognition_service.py` | 腾讯云 SDK |
| LLM 视觉 | `tencent_llm_vision_service.py` | 混元大模型 |
| 评分引擎 | `scoring_engine.py` | 纯规则计算 |

## 修改规则

1. 新路由注册到 `app/api/v1/__init__.py` 的 `api_router`
2. 禁止在路由文件写业务逻辑 → 放 `services/` 下
3. AI 服务保持独立，不与 CRUD 逻辑耦合
4. 异步任务放 `tasks/`，通过 Celery 执行
5. DB 变更写 SQL 迁移文件放 `migrations/`
6. 禁止硬编码路径，用 `app/config.py` 的 `Settings`

## 当前状态

**仍在 Python 后端运行的功能：**
- 产品/选品/定稿/素材/运营商 CRUD
- 图片管理（以图搜图、相似搜索、COS 代理）
- 导入导出、数据看板、统计、报表、领星导入
- 系统配置、日志、下载管理

**已迁移到 Java 的功能：**
- 用户认证（登录/注册/刷新/登出）
- 竞品分析、评分引擎、ASIN 导入、筛选预设

新增 API 优先评估是否应在 Java 侧实现。
