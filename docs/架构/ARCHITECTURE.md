# 思觉智贸 (Si Jue Zhi Mao) 系统架构报告

> 生成日期：2026-05-11 | 版本：2.0.0

---

## 一、项目总览

```
si-jue-zhi-mao-up/
├── backend/          # FastAPI (Python) 后端 — 254 个 API 端点
├── frontend/         # Vue 3 + Vite + TypeScript 前端 — 29 个页面路由
├── scripts/          # 启动脚本、生产部署、测试脚本
├── static/           # 生产构建的静态文件
├── 产品数据/          # Parquet 数据分析工具
├── 领星/              # 领星平台集成脚本
├── dev.sh            # 一键启动（Bash）
├── dev.bat           # 一键启动（Windows）
└── .env              # 根级环境变量
```

---

## 二、端口架构（统一设计）

### 设计原则：同源架构（Same-Origin Architecture）

前端使用**相对路径**（`/api/v1/xxx`），不硬编码任何后端地址。

| 模式 | 前端 | 后端 | 通信方式 |
|------|------|------|----------|
| **开发** | Vite `:5175` | Uvicorn `:8003` | Vite proxy 透明转发 `/api` |
| **生产** | 后端 serve 静态文件 | Uvicorn `:8003` | 同源直连 |

```
开发模式:  浏览器 → :5175 (Vite) ──proxy──→ :8003 (FastAPI)
生产模式:  浏览器 → :8003 (FastAPI serve 前端 + API)
```

### 端口配置入口

| 文件 | 作用 |
|------|------|
| `backend/app/config.py:43` | `PORT: int = 8003` |
| `frontend/vite.config.js:33` | `port: 5175` |
| `frontend/vite.config.js:37-40` | proxy `/api` → `localhost:8003` |
| `frontend/src/utils/request.ts:35` | `apiBaseUrl = VITE_API_BASE_URL \|\| ''` |
| `dev.sh` | 一键启动命令 |

---

## 三、后端架构

### 分层架构

```
Route (api/v1/*.py)       ← HTTP 层：参数校验、响应格式化
    ↓
Service (services/*.py)   ← 业务逻辑层：跨 Repository 编排
    ↓
Repository (repositories/*.py)  ← 数据访问层
    ↓
MySQL / Redis / Qdrant / Parquet / COS
```

### 中间件栈（执行顺序）

```
LoggingMiddleware → TimeoutMiddleware → AuthMiddleware → ErrorHandler
```

| 中间件 | 文件 | 职责 |
|--------|------|------|
| Logging | `middleware/logging.py` | 请求/响应日志，唯一请求ID，耗时记录 |
| Timeout | `middleware/timeout.py` | 请求超时控制（默认60s，下载30min） |
| SlowRequest | `middleware/timeout.py` | 慢请求告警（>5s） |
| RequestSize | `middleware/timeout.py` | 请求体大小限制 |
| Auth | `middleware/auth_middleware.py` | JWT Bearer Token 验证 + 权限检查 |
| Error | `middleware/error_handler.py` | 全局异常捕获，统一 JSON 错误响应 |

### API 端点统计（27 个路由文件，254 个端点）

| 模块 | 端点 | 说明 |
|------|------|------|
| `final_drafts` | 27 | 定稿 CRUD、状态流转、ZIP 下载 |
| `carrier_library` | 22 | 载体库管理 |
| `material_library` | 21 | 素材库管理 |
| `selection` | 18 | 选品管理（新品/竞品/郑总店铺） |
| `logs` | 16 | 系统日志/文档/更新记录 |
| `images` | 14 | 图片上传/搜索/元数据 |
| `products` | 14 | 产品 CRUD |
| `file_links` | 11 | 文件链接管理 |
| `system_config` | 11 | 系统配置（备份/开发者/载体列表） |
| `product_data` | 10 | 产品数据看板（Parquet 分析） |
| `selection_recycle` | 8 | 选品回收站 |
| `download_tasks` | 7 | 异步下载任务 |
| `product_recycle` | 7 | 产品回收站 |
| `recycle_bin` | 7 | 图片回收站 |
| `tags` | 7 | 图片标签 |
| `users` | 7 | 用户管理 |
| `categories` | 5 | 图片分类 |
| `image_proxy` | 5 | 图片代理（云端/本地回退） |
| `scoring` | 5 | 产品评分引擎 |
| `statistics` | 5 | 仪表盘统计 |
| `auth` | 4 | 登录/刷新 Token |
| 其他 6 个文件 | 18 | 导入导出、领星、健康检查等 |

### 服务层（26 个服务文件）

| 服务 | 职责 |
|------|------|
| `image_service` | 图片上传、缩略图、向量提取、相似搜索 |
| `product_service` | 产品 CRUD 业务逻辑 |
| `product_data_service` | Pandas/Parquet 产品分析 |
| `cos_service` | 腾讯云 COS 对象存储集成 |
| `image_analysis_service` | Chinese CLIP 图像识别/标签提取 |
| `download_task_service` | ZIP 打包下载任务管理 |
| `scoring_engine` | 产品评分引擎（0-100 分 + S/A/B/C/D 等级） |
| `monitoring_service` | 错误监控和告警 |
| `baidu_image_recognition_service` | 百度 AI 图像识别 |
| `tencent_*_service` (3个) | 腾讯云图像识别/搜索/混元 LLM 视觉 |
| 其他 13 个 | 文件链接/上传/备份/Token/Cache/清理等 |

### 数据存储

| 存储 | 技术 | 用途 |
|------|------|------|
| MySQL | aiomysql (async) + 连接池 (30) | 关系数据：产品、选品、定稿、用户 |
| Redis | redis-py (async) + 连接池 (50) | 缓存、Session、Celery Broker |
| Qdrant | qdrant-client | 向量相似搜索（768维 CLIP 特征） |
| Parquet | Pandas/Polars | 产品销量数据分析 |
| COS | 腾讯云对象存储 | 图片云端存储（开发环境禁用） |

### 安全认证

- **JWT**：HS256 签名，30分钟过期
- **权限模型**：`{resource}:{action}` 格式（如 `product:view`、`selection:manage`）
- **Admin/Developer 角色**：跳过具体权限检查
- **Redis Token 黑名单**：登出时加入黑名单

---

## 四、前端架构

### 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Vue 3 + Composition API |
| 构建 | Vite 6 |
| 语言 | TypeScript (strict) |
| UI 库 | Element Plus |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| HTTP | Axios（带拦截器：重试/去重/Token/错误日志） |
| 图表 | ECharts |
| 代码生成 | @hey-api/openapi-ts（类型模式） |

### 路由权限映射

| 权限标识 | 可访问页面 |
|----------|-----------|
| `dashboard:view` | 首页 (/) → 产品数据看板、数据分析报告 |
| `product:view` | 产品管理、产品详情 |
| `product:manage` | 产品回收站 |
| `selection:view` | 总选品、新品榜、竞品店铺、郑总店铺、选品详情 |
| `selection:manage` | 选品回收站 |
| `resource:view` | 提示词库、资料库、资料集 |
| `final-draft:view` | 定稿、素材库、载体库 |
| `final-draft:manage` | 定稿回收站、载体回收站 |
| `statistics:view` | 统计分析 |
| `user:manage` | 用户管理、账号设置 |
| `download:view` | 下载管理 |
| `config:manage` | 系统设置 |
| `lingxing:import` | 导入领星 |

### Store 架构

| Store | 职责 |
|-------|------|
| `app` | 主题、标签页、侧边栏、全局 UI 状态 |
| `user` | 认证 Token、用户信息、权限列表 |
| `productData` | 产品数据看板筛选状态 |
| `finalDraft` | 定稿管理状态 |
| `systemLog` | 系统日志状态 |
| `settings` | 应用设置状态 |

### HTTP 客户端（Axios 拦截器链）

```
请求拦截器:
  1. Token 注入 (Authorization: Bearer <token>)
  2. 端点超时配置 (auth=60s, download=5min, default=45s)
  3. GET 请求去重 (相同 URL+参数 → 取消前一个)

响应拦截器:
  1. 业务状态码检查 (res.code === 200)
  2. 401 → 清除 Token，跳转登录
  3. 错误分级处理 (400/401/403/404/422/500/502/503/504)

错误重试:
  1. 指数退避 (1s → 2s → 4s)
  2. 可重试: 500/502/503/504 + Network Error
  3. 端点自定义最大重试次数
```

### 可复用组件

| 组件 | 用途 |
|------|------|
| `RecycleBinPage` | **统一回收站**：选品/产品/定稿/载体 4 合 1（路由检测类型） |
| `UniversalList` | 通用列表（带测试） |
| `UniversalCard` | 通用卡片（带测试） |
| `VirtualList` | 虚拟滚动列表 |
| `LazyImage` | 懒加载图片 |
| `ThumbnailViewer` | 缩略图查看器 |
| `SelectionQueryForm` | 选品搜索/过滤表单 |
| `ImageUpload` | 图片上传组件 |
| `ProductDetailDialog` | 产品详情弹窗 |

### Utils 工具层

| 工具 | 用途 |
|------|------|
| `request.ts` | Axios 实例（拦截器核心） |
| `environment.js` | 环境检测 |
| `imageCache.ts` | 图片缓存 |
| `imageOfflineCache.ts` | Service Worker 离线缓存 |
| `memoryMonitor.ts` | 内存泄漏检测 |
| `cacheManager.ts` | 通用 TTL 缓存 |

---

## 五、关键优化记录

### #1 三选品页面合并 → `AllSelection/index.vue`

| 之前 | 之后 |
|------|------|
| 3 个独立目录：`NewProducts/`、`ReferenceProducts/`、`AllSelection/` | 1 个 `AllSelection/index.vue` |
| 3 套重复的模板/样式/逻辑 | 通过 `useRoute().path` 检测页面类型，`switch(activeTab)` 调用对应 API |

### #2 四回收站合并 → `RecycleBinPage/index.vue`

| 之前 | 之后 |
|------|------|
| 4 个独立目录：`SelectionRecycleBin/`、`ProductRecycleBin/`、`FinalDraftRecycleBin/`、`CarrierLibraryRecycleBin/` | 1 个 `RecycleBinPage/index.vue` |
| ~2800 行代码 | ~450 行代码（85% 精简） |
| 每新增类型需要完整新页面 | 配置驱动：加 `recycleType` 映射即可 |

### #3 配置系统清理

- `backend/app/config.py`：统一的 `Settings` 类 + 模块级常量
- `backend/config.py`：桥接兼容，全部从 `app.config` 导入
- 消除重复定义，统一数据源

### #4 权限检查修复

- `auth_middleware.py`：`require_permission` 现在真实检查 `user_info["permissions"]` 列表
- 之前只是占位检查，现在返回 403 并明确提示缺少的权限名

### #5 COS 警告日志降级

- `image_proxy.py`：COS 未启用时提前返回，`logger.warning` → `logger.debug`
- 开发环境不再刷屏 COS 连接警告

### #6 中文 Emoji → ASCII 替换

- 60+ 文件中的 `✅⚠️🎉🛑❌🚀🔍🔥` 等全部替换为 `[OK][WARN][DONE]` 等 ASCII 标记
- 解决 Windows GBK 终端 UnicodeEncodeError 崩溃

### P0 同源架构：删除端口检测

- `request.ts`：删除 22 行端口检测逻辑
- 现在：`apiBaseUrl = VITE_API_BASE_URL || ''`（相对路径）
- 开发 Vite proxy 转发，生产同源直连

### P1 OpenAPI 类型自动生成

- `@hey-api/openapi-ts`：从后端 `/openapi.json` 自动生成 TypeScript 类型
- `npm run gen:api` 一键刷新
- 生成文件：`src/api/generated/types.gen.ts`（~5000 类型定义）

---

## 六、开发命令

```bash
# 一键启动（Git Bash）
bash dev.sh

# 或 Windows 双击
dev.bat

# 手动启动
# 终端1: 后端
cd backend && ./venv/Scripts/python -m uvicorn app.main:app --port 8003

# 终端2: 前端
cd frontend && npx vite --port 5175

# 重新生成 API 类型
cd frontend && npm run gen:api

# 构建
cd frontend && npm run build
```

### 访问地址

| 服务 | URL |
|------|-----|
| 前端 | `http://127.0.0.1:5175` |
| 后端 API | `http://127.0.0.1:8003` |
| API 文档 | `http://127.0.0.1:8003/docs` |
| OpenAPI Schema | `http://127.0.0.1:8003/openapi.json` |

---

## 七、架构图（ASCII）

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│               http://127.0.0.1:5175 (dev)              │
│               http://127.0.0.1:8003 (prod)              │
└────────────────┬────────────────────────────────────────┘
                 │  /api/v1/*
                 ▼
┌────────────────────────────────────────────┐
│           Vite Dev Server (:5175)           │
│         proxy /api → localhost:8003         │
└────────────────┬───────────────────────────┘
                 │  (dev: proxy / prod: 同源)
                 ▼
┌────────────────────────────────────────────┐
│           FastAPI (:8003)                   │
│  ┌─────────────────────────────────────┐   │
│  │        Middleware Stack              │   │
│  │  Logging → Timeout → Auth → Error   │   │
│  └───────────────┬─────────────────────┘   │
│                  ▼                          │
│  ┌─────────────────────────────────────┐   │
│  │    API Routes (27 files, 254 ep)     │   │
│  └───────────────┬─────────────────────┘   │
│                  ▼                          │
│  ┌─────────────────────────────────────┐   │
│  │    Services (26 service files)       │   │
│  └────┬──────┬──────┬──────┬──────────┘   │
│       ▼      ▼      ▼      ▼               │
│   MySQL  Redis  Qdrant  Parquet/COS       │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│           Vue 3 Frontend                    │
│  ┌─────────────────────────────────────┐   │
│  │  Router (beforeEach auth guard)      │   │
│  └──┬────┬────┬────┬────┬──────────┬───┘   │
│     ▼    ▼    ▼    ▼    ▼          ▼       │
│  27 Views  →  API Modules (20)  →  Axios  │
│     │                    │          │       │
│     ▼                    ▼          ▼       │
│  Pinia Stores    Generated Types   request.ts│
│  (6 stores)      (types.gen.ts)   (拦截器)  │
│                                          │   │
│  Shared Components (10)                    │
│  ┌──RecycleBinPage──UniversalList────┐   │
│  │  UniversalCard   VirtualList      │   │
│  │  LazyImage       ThumbnailViewer  │   │
│  │  ImageUpload     SelectionQuery   │   │
│  │  ProductDetailDialog              │   │
│  └───────────────────────────────────┘   │
└────────────────────────────────────────────┘
```
