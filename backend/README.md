# 思觉智贸 - FastAPI后端

高性能思觉智贸系统后端API，基于FastAPI、MySQL、Redis、Qdrant和Celery构建，提供完整的图片管理、产品管理、选品管理等功能。

## 功能特性

- **图片管理**: 上传、下载、预览、搜索、批量操作
- **产品管理**: 创建、编辑、删除、查询、批量导入导出
- **选品管理**: 选品创建、管理、回收站
- **定稿管理**: 定稿创建、编辑、管理
- **用户管理**: 用户认证、权限控制
- **分类管理**: 产品分类管理
- **标签管理**: 产品和图片标签管理
- **统计功能**: 系统数据统计分析
- **日志管理**: 操作日志记录和查询
- **回收站**: 产品和选品回收站管理
- **文件链接**: 文件链接生成和管理
- **系统配置**: 系统参数配置管理
- **图片代理**: 图片访问代理服务
- **性能监控**: 请求性能监控和优化
- **异常处理**: 统一的错误处理机制
- **CORS支持**: 跨域资源共享

## 技术栈

- **Web框架**: FastAPI
- **数据库**: MySQL
- **缓存**: Redis
- **向量数据库**: Qdrant
- **任务队列**: Celery
- **异步支持**: asyncio, aiomysql, aioredis
- **性能监控**: 自定义性能监控中间件
- **日志系统**: 结构化日志记录

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置管理
│   ├── middleware/          # 中间件
│   │   ├── __init__.py
│   │   ├── logging.py       # 日志中间件
│   │   ├── timeout.py       # 超时中间件
│   │   ├── slow_request.py  # 慢请求监控
│   │   └── request_size.py  # 请求大小限制
│   ├── repositories/        # 数据访问层
│   │   ├── __init__.py
│   │   ├── mysql_repo.py    # MySQL仓库
│   │   ├── redis_repo.py    # Redis仓库
│   │   └── qdrant_repo.py   # Qdrant仓库
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── image_service.py # 图片服务
│   │   └── cos_service.py   # COS服务
│   ├── api/                 # API路由层
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── images.py    # 图片API
│   │       ├── products.py  # 产品API
│   │       ├── statistics.py # 统计API
│   │       ├── users.py     # 用户API
│   │       ├── categories.py # 分类API
│   │       ├── tags.py      # 标签API
│   │       ├── logs.py      # 日志API
│   │       ├── recycle_bin.py # 回收站API
│   │       ├── selection.py # 选品API
│   │       ├── auth.py      # 认证API
│   │       ├── export.py    # 导出API
│   │       ├── import_.py   # 导入API
│   │       ├── file_links.py # 文件链接API
│   │       ├── final_drafts.py # 定稿API
│   │       ├── system_config.py # 系统配置API
│   │       ├── image_proxy.py # 图片代理API
│   │       └── health.py    # 健康检查API
│   ├── models/              # 数据模型
│   │   ├── __init__.py
│   │   ├── product.py       # 产品模型
│   │   ├── final_draft.py   # 定稿模型
│   │   └── selection.py     # 选品模型
│   ├── schemas/             # 数据验证模式
│   │   ├── __init__.py
│   │   └── system_log.py    # 系统日志模式
│   ├── tasks/               # Celery任务
│   │   ├── __init__.py
│   │   ├── celery_app.py    # Celery配置
│   │   └── image_tasks.py   # 图片处理任务
│   ├── utils/               # 工具函数
│   │   ├── __init__.py
│   │   ├── jwt_utils.py     # JWT工具
│   │   └── performance_monitor.py # 性能监控工具
│   └── __init__.py
├── migrations/              # 数据库迁移脚本
│   └── init_database.sql
├── scripts/                 # 脚本工具
│   ├── cos_migration.py     # COS迁移脚本
│   └── data_migration.py    # 数据迁移脚本
├── tests/                   # 测试文件
│   ├── data/                # 测试数据
│   └── utils/               # 测试工具
├── requirements.txt         # Python依赖
├── .env.example            # 环境变量示例
├── start_celery.py         # Celery启动脚本
└── README.md               # 项目文档
```

## 快速开始

### 1. 环境要求

- Python 3.8+
- MySQL 8.0+
- Redis 6.0+
- Qdrant 1.7+

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

复制`.env.example`为`.env`，并根据实际情况修改配置：

```bash
cp .env.example .env
```

主要配置项：
- `MYSQL_HOST`: MySQL服务器地址
- `MYSQL_PORT`: MySQL端口
- `MYSQL_USER`: MySQL用户名
- `MYSQL_PASSWORD`: MySQL密码
- `MYSQL_DATABASE`: 数据库名称
- `REDIS_HOST`: Redis服务器地址
- `REDIS_PORT`: Redis端口
- `QDRANT_HOST`: Qdrant服务器地址
- `QDRANT_PORT`: Qdrant端口
- `APP_NAME`: 应用名称
- `APP_VERSION`: 应用版本
- `HOST`: 服务器主机
- `PORT`: 服务器端口
- `DEBUG`: 调试模式

### 4. 初始化数据库

使用项目提供的初始化脚本创建数据库和表结构：

```bash
python scripts/init_dev_database.py
```

或手动创建数据库：

```sql
CREATE DATABASE image_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 启动服务

#### 启动FastAPI应用

**开发模式（热重载）:**
```bash
python -m scripts.startup.start_with_hot_reload
```

**生产模式:**
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### 启动Celery Worker（可选）

```bash
python start_celery.py
```

### 6. 访问API

- API文档: http://localhost:8001/docs
- ReDoc文档: http://localhost:8001/redoc
- 健康检查: http://localhost:8001/health
- 根路径: http://localhost:8001/

## API接口

### 核心API模块

1. **图片管理** (`/api/v1/images/`)
   - 上传图片: `POST /api/v1/images/upload`
   - 批量上传: `POST /api/v1/images/batch-upload`
   - 获取图片: `GET /api/v1/images/{image_id}`
   - 搜索图片: `GET /api/v1/images/search`
   - 删除图片: `DELETE /api/v1/images/{image_id}`

2. **产品管理** (`/api/v1/products/`)
   - 创建产品: `POST /api/v1/products`
   - 获取产品: `GET /api/v1/products/{product_id}`
   - 更新产品: `PUT /api/v1/products/{product_id}`
   - 删除产品: `DELETE /api/v1/products/{product_id}`
   - 产品列表: `GET /api/v1/products`
   - 批量导入: `POST /api/v1/products/import`
   - 批量导出: `GET /api/v1/products/export`

3. **选品管理** (`/api/v1/selection/`)
   - 创建选品: `POST /api/v1/selection`
   - 获取选品: `GET /api/v1/selection/{selection_id}`
   - 更新选品: `PUT /api/v1/selection/{selection_id}`
   - 删除选品: `DELETE /api/v1/selection/{selection_id}`
   - 选品列表: `GET /api/v1/selection`

4. **定稿管理** (`/api/v1/final-drafts/`)
   - 创建定稿: `POST /api/v1/final-drafts`
   - 获取定稿: `GET /api/v1/final-drafts/{draft_id}`
   - 更新定稿: `PUT /api/v1/final-drafts/{draft_id}`
   - 删除定稿: `DELETE /api/v1/final-drafts/{draft_id}`
   - 定稿列表: `GET /api/v1/final-drafts`

5. **用户管理** (`/api/v1/users/`)
   - 创建用户: `POST /api/v1/users`
   - 获取用户: `GET /api/v1/users/{user_id}`
   - 更新用户: `PUT /api/v1/users/{user_id}`
   - 删除用户: `DELETE /api/v1/users/{user_id}`
   - 用户列表: `GET /api/v1/users`

6. **认证管理** (`/api/v1/auth/`)
   - 登录: `POST /api/v1/auth/login`
   - 登出: `POST /api/v1/auth/logout`
   - 刷新令牌: `POST /api/v1/auth/refresh`

7. **统计功能** (`/api/v1/statistics/`)
   - 系统统计: `GET /api/v1/statistics/system`
   - 产品统计: `GET /api/v1/statistics/products`
   - 图片统计: `GET /api/v1/statistics/images`

8. **系统配置** (`/api/v1/system-config/`)
   - 获取配置: `GET /api/v1/system-config`
   - 更新配置: `PUT /api/v1/system-config`

## 开发说明

### 代码规范

- 使用异步编程（async/await）
- 遵循PEP 8代码规范
- 添加详细的文档字符串
- 使用类型注解
- 统一的错误处理机制
- 结构化的日志记录

### 测试

```bash
# 运行测试
python -m pytest tests/

# 运行特定测试
python -m pytest tests/test_api_unit.py

# 生成测试覆盖率报告
python -m pytest tests/ --cov=app --cov-report=html
```

### 性能优化

- 使用连接池管理数据库连接
- 实现请求超时控制
- 慢请求监控和告警
- 请求大小限制
- 静态文件服务优化

### 部署

#### 使用Gunicorn部署（生产环境）

```bash
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --access-logfile - \
    --error-logfile -
```

#### 环境变量配置

生产环境建议使用环境变量管理配置：

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=password
export MYSQL_DATABASE=image_db
export REDIS_HOST=localhost
export REDIS_PORT=6379
export QDRANT_HOST=localhost
export QDRANT_PORT=6333
export APP_ENV=production
export DEBUG=False
```

## 本地开发常见问题

### 登录超时 (Login Timeout)

如果在本地开发环境中遇到登录超时（45s以上未响应），请按以下清单排查：

1.  **重复路径检查**: 确认浏览器 Network 面板中的请求 URL 是否包含重复的 `/api/v1/api/v1`。如果存在，请检查 `.env.development` 中的 `VITE_API_BASE_URL` 是否包含尾随的 `/api/v1`，建议直接注释该配置以启用动态识别。
2.  **后端服务状态**: 确认后端服务（8001/8002端口）已启动且无死循环日志。
3.  **数据库连接**: 检查 MySQL 是否响应缓慢。查看后端日志中的 `数据库查询耗时`。
4.  **代理配置**: 检查 `frontend/vite.config.js` 中的代理 target 是否指向正确的后端端口。
5.  **重试机制**: 系统已内置 1 次自动重试。如果重试后仍失败，请检查网络环境或联系管理员。

**联系方式**: 
- 开发者: Trae AI Assistant
- 内部群: 研发效能组

## 许可证

MIT License
